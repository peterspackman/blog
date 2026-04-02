/**
 * External potentials for GCMC simulations.
 * These act on individual particles based on position, not pairwise.
 */

export interface ExternalPotential {
    calculate(x: number, y: number, type: number): number;
    getDescription(): string;
}

/**
 * Cylindrical pore -- like looking down a porous channel.
 * Repulsive core at center (hard wall), attractive annular region near the rim,
 * zero (or repulsive) outside the pore.
 *
 * The potential is radially symmetric around (cx, cy):
 *   r < coreRadius:           hard repulsion (1e6)
 *   coreRadius <= r < poreRadius - wallThickness: zero (bulk region)
 *   poreRadius - wallThickness <= r < poreRadius: attractive (9-3 wall)
 *   r >= poreRadius:          hard repulsion (pore wall)
 */
export class CylindricalPorePotential implements ExternalPotential {
    private cx: number;
    private cy: number;

    constructor(
        private poreRadius: number,        // Angstroms -- outer boundary
        private wallEpsilon: number = 0.03, // eV -- wall attraction strength
        private wallSigma: number = 3.0,    // Angstroms -- wall interaction range
        boxWidth: number = 100,
        boxHeight: number = 100,
    ) {
        this.cx = boxWidth / 2;
        this.cy = boxHeight / 2;
    }

    calculate(x: number, y: number, _type: number): number {
        const dx = x - this.cx;
        const dy = y - this.cy;
        const r = Math.sqrt(dx * dx + dy * dy);

        // Distance from pore wall (inward positive)
        const distFromWall = this.poreRadius - r;

        // Outside pore -- hard repulsion
        if (distFromWall < 0.5) return 1e6;

        // 9-3 wall potential (attractive near wall, repulsive at contact)
        if (distFromWall < this.wallSigma * 2.5) {
            const sigOverZ = this.wallSigma / distFromWall;
            const sigOverZ3 = sigOverZ * sigOverZ * sigOverZ;
            const sigOverZ9 = sigOverZ3 * sigOverZ3 * sigOverZ3;
            return this.wallEpsilon * ((2 / 15) * sigOverZ9 - sigOverZ3);
        }

        return 0; // bulk interior
    }

    getDescription(): string {
        return 'Cylindrical pore (cross-section view)';
    }
}

/**
 * Slit pore: two parallel horizontal walls with attractive 9-3 potential.
 * Particles are confined between the walls.
 */
export class SlitPorePotential implements ExternalPotential {
    private bottomWall: number;
    private topWall: number;

    constructor(
        private epsilonWall: number = 0.03,
        private sigmaWall: number = 3.0,
        boxWidth: number = 100,
        boxHeight: number = 100,
        poreWidthFraction: number = 0.5,    // fraction of box height
    ) {
        const poreWidth = boxHeight * poreWidthFraction;
        this.bottomWall = (boxHeight - poreWidth) / 2;
        this.topWall = (boxHeight + poreWidth) / 2;
    }

    calculate(x: number, y: number, _type: number): number {
        const zBottom = y - this.bottomWall;
        const zTop = this.topWall - y;

        // Outside pore
        if (zBottom < 0.5 || zTop < 0.5) return 1e6;

        const calc93 = (z: number) => {
            if (z > this.sigmaWall * 2.5) return 0;
            const sigOverZ = this.sigmaWall / z;
            const sigOverZ3 = sigOverZ * sigOverZ * sigOverZ;
            const sigOverZ9 = sigOverZ3 * sigOverZ3 * sigOverZ3;
            return this.epsilonWall * ((2 / 15) * sigOverZ9 - sigOverZ3);
        };

        return calc93(zBottom) + calc93(zTop);
    }

    getDescription(): string {
        return 'Slit pore (two parallel walls)';
    }
}

/**
 * Zeolite-like porous material: a periodic grid of circular cavities
 * connected by narrow channels. The solid matrix is hard wall,
 * cavity walls have attractive 9-3 potential. Particles can only
 * exist inside cavities and channels.
 */
export class ZeolitePotential implements ExternalPotential {
    private centres: [number, number][];
    private caveRadius: number;
    private channelHalfWidth: number;

    constructor(
        private wallEpsilon: number = 0.025,
        private wallSigma: number = 2.5,
        private boxWidth: number = 100,
        private boxHeight: number = 100,
        private nx: number = 3,
        private ny: number = 3,
    ) {
        // Compute cavity radius from grid spacing
        const spacingX = boxWidth / nx;
        const spacingY = boxHeight / ny;
        this.caveRadius = Math.min(spacingX, spacingY) * 0.32;
        this.channelHalfWidth = this.caveRadius * 0.35;

        // Generate cavity centres
        this.centres = [];
        for (let iy = 0; iy < ny; iy++) {
            for (let ix = 0; ix < nx; ix++) {
                this.centres.push([
                    (ix + 0.5) * spacingX,
                    (iy + 0.5) * spacingY,
                ]);
            }
        }
    }

    private wall93(dist: number): number {
        if (dist < 0.5) return 1e6;
        if (dist > this.wallSigma * 2.5) return 0;
        const s = this.wallSigma / dist;
        const s3 = s * s * s;
        const s9 = s3 * s3 * s3;
        return this.wallEpsilon * ((2 / 15) * s9 - s3);
    }

    calculate(x: number, y: number, _type: number): number {
        // Wrap into box for periodic images
        const px = ((x % this.boxWidth) + this.boxWidth) % this.boxWidth;
        const py = ((y % this.boxHeight) + this.boxHeight) % this.boxHeight;

        // Check if inside any cavity
        for (const [cx, cy] of this.centres) {
            const dx = px - cx;
            const dy = py - cy;
            const r = Math.sqrt(dx * dx + dy * dy);
            if (r < this.caveRadius) {
                return this.wall93(this.caveRadius - r);
            }
        }

        // Check if inside a channel connecting adjacent cavities
        // Channels run horizontally and vertically between neighbours
        const spacingX = this.boxWidth / this.nx;
        const spacingY = this.boxHeight / this.ny;

        for (const [cx, cy] of this.centres) {
            // Horizontal channel to the right
            const rx = cx + spacingX;
            if (Math.abs(py - cy) < this.channelHalfWidth) {
                // Between this cavity edge and next cavity edge
                const leftEdge = cx + this.caveRadius * 0.7;
                const rightEdge = (rx < this.boxWidth + spacingX * 0.5 ? rx : rx - this.boxWidth) - this.caveRadius * 0.7;
                const actualRight = rightEdge < leftEdge ? rightEdge + this.boxWidth : rightEdge;
                let testX = px;
                if (actualRight > this.boxWidth && px < leftEdge) testX += this.boxWidth;

                if (testX > leftEdge && testX < actualRight) {
                    const distFromWall = this.channelHalfWidth - Math.abs(py - cy);
                    return this.wall93(distFromWall);
                }
            }

            // Vertical channel downward
            const ry = cy + spacingY;
            if (Math.abs(px - cx) < this.channelHalfWidth) {
                const topEdge = cy + this.caveRadius * 0.7;
                const bottomEdge = (ry < this.boxHeight + spacingY * 0.5 ? ry : ry - this.boxHeight) - this.caveRadius * 0.7;
                const actualBottom = bottomEdge < topEdge ? bottomEdge + this.boxHeight : bottomEdge;
                let testY = py;
                if (actualBottom > this.boxHeight && py < topEdge) testY += this.boxHeight;

                if (testY > topEdge && testY < actualBottom) {
                    const distFromWall = this.channelHalfWidth - Math.abs(px - cx);
                    return this.wall93(distFromWall);
                }
            }
        }

        // Inside solid matrix
        return 1e6;
    }

    getDescription(): string {
        return 'Zeolite (periodic cavities with channels)';
    }
}

/**
 * Charged slab in the middle of the box.
 * A thin horizontal strip with surface charge that attracts counterions
 * and repels co-ions, forming a double layer on both sides.
 * Placed at box centre so periodic boundaries work naturally.
 */
export class ChargedSurfacePotential implements ExternalPotential {
    private coulombConst = 14.3996; // eV·Å/e²
    private charges: number[];
    private surfaceY: number;

    constructor(
        private surfaceChargeDensity: number = 0.02,
        private wallSigma: number = 2.5,
        boxWidth: number = 100,
        boxHeight: number = 100,
        charges: number[] = [1, -1],
    ) {
        this.charges = charges;
        this.surfaceY = boxHeight / 2;
    }

    calculate(x: number, y: number, type: number): number {
        const q = this.charges[type] ?? 0;
        if (q === 0) return 0;

        // Distance from the charged slab at the centre
        const dist = Math.abs(y - this.surfaceY);

        // Hard-core repulsion inside the slab
        if (dist < 0.5) return 1e6;

        let energy = 0;

        // Electrostatic interaction with hard cutoff at 20 Å.
        // Cosine switching from 15-20 Å for smooth decay to zero.
        const cutoff = 20.0;
        const switchStart = 15.0;
        if (dist < cutoff) {
            let V = this.surfaceChargeDensity * this.coulombConst * q / dist;
            if (dist > switchStart) {
                // Smooth switch to zero: cos²-based
                const t = (dist - switchStart) / (cutoff - switchStart);
                V *= (1 - t * t * (3 - 2 * t)); // smoothstep, 1→0
            }
            energy += V;
        }

        // Short-range repulsive wall (9-3)
        if (dist < this.wallSigma * 2) {
            const sigOverZ = this.wallSigma / dist;
            const sigOverZ3 = sigOverZ * sigOverZ * sigOverZ;
            const sigOverZ9 = sigOverZ3 * sigOverZ3 * sigOverZ3;
            energy += 0.05 * ((2 / 15) * sigOverZ9 - sigOverZ3);
        }

        return energy;
    }

    getDescription(): string {
        return 'Charged surface (centre slab)';
    }
}

/**
 * Electric potential: negative on the left, positive on the right.
 * V(x, q) = depth * q * (2*x/boxWidth - 1)
 *
 * At left edge:  V = -depth * q  (attracts positive charges)
 * At centre:     V = 0
 * At right edge: V = +depth * q  (attracts negative charges)
 *
 * So positive ions (q>0) drift left, negative ions (q<0) drift right.
 * Flipping the sign of q reverses the direction.
 */
export class PotentialGradient implements ExternalPotential {
    private charges: number[];

    constructor(
        private depth: number = 0.4,    // eV half-amplitude
        private boxWidth: number = 100,
        charges: number[] = [1],
    ) {
        this.charges = charges;
    }

    calculate(x: number, _y: number, type: number): number {
        // Hard walls at left and right edges
        if (x < 1.0 || x > this.boxWidth - 1.0) return 1e6;

        const q = this.charges[type] ?? 0;
        if (q === 0) return 0;
        // Linear from -depth*q at x=0 to +depth*q at x=boxWidth
        const frac = (2 * x / this.boxWidth) - 1; // -1 at left, +1 at right
        return this.depth * q * frac;
    }

    getDescription(): string {
        return 'Electric potential (−left, +right)';
    }
}

export type ExternalPotentialType = 'none' | 'cylindrical-pore' | 'slit-pore' | 'zeolite' | 'charged-surface' | 'potential-gradient';

export function createExternalPotential(
    type: ExternalPotentialType,
    boxWidth: number,
    boxHeight: number,
    params?: Record<string, number>,
    charges?: number[],
): ExternalPotential | null {
    const minDim = Math.min(boxWidth, boxHeight);
    switch (type) {
        case 'cylindrical-pore':
            return new CylindricalPorePotential(
                params?.poreRadius ?? minDim * 0.42,
                params?.wallEpsilon ?? 0.03,
                params?.wallSigma ?? 3.0,
                boxWidth,
                boxHeight,
            );
        case 'slit-pore':
            return new SlitPorePotential(
                params?.wallEpsilon ?? 0.03,
                params?.wallSigma ?? 3.0,
                boxWidth,
                boxHeight,
                params?.poreWidthFraction ?? 0.5,
            );
        case 'zeolite':
            return new ZeolitePotential(
                params?.wallEpsilon ?? 0.025,
                params?.wallSigma ?? 2.5,
                boxWidth,
                boxHeight,
                params?.nx ?? 3,
                params?.ny ?? 3,
            );
        case 'charged-surface':
            return new ChargedSurfacePotential(
                params?.surfaceChargeDensity ?? 0.02,
                params?.wallSigma ?? 2.5,
                boxWidth,
                boxHeight,
                charges ?? [1, -1],
            );
        case 'potential-gradient':
            return new PotentialGradient(
                params?.depth ?? 0.4,
                boxWidth,
                charges ?? [1],
            );
        case 'none':
        default:
            return null;
    }
}
