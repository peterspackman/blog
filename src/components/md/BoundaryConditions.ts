export interface ParticleData {
    positions: Float32Array;
    velocities: Float32Array;
    count: number;
}

export interface Bounds {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
}

export abstract class BoundaryCondition {
    protected bounds: Bounds;
    protected damping: number;

    constructor(bounds: Bounds, damping: number = 0.95) {
        this.bounds = bounds;
        this.damping = damping;
    }

    abstract apply(particleData: ParticleData): void;

    updateBounds(bounds: Bounds): void {
        this.bounds = bounds;
    }

    setDamping(damping: number): void {
        this.damping = damping;
    }
}

export class ReflectiveBoundary extends BoundaryCondition {
    apply(particleData: ParticleData): void {
        const { positions, velocities, count } = particleData;
        const { xMin, xMax, yMin, yMax } = this.bounds;

        for (let i = 0; i < count; i++) {
            const idx = i * 2;

            // X boundaries
            if (positions[idx] < xMin) {
                positions[idx] = 2 * xMin - positions[idx];
                velocities[idx] = -velocities[idx] * this.damping;
            } else if (positions[idx] > xMax) {
                positions[idx] = 2 * xMax - positions[idx];
                velocities[idx] = -velocities[idx] * this.damping;
            }

            // Y boundaries
            if (positions[idx + 1] < yMin) {
                positions[idx + 1] = 2 * yMin - positions[idx + 1];
                velocities[idx + 1] = -velocities[idx + 1] * this.damping;
            } else if (positions[idx + 1] > yMax) {
                positions[idx + 1] = 2 * yMax - positions[idx + 1];
                velocities[idx + 1] = -velocities[idx + 1] * this.damping;
            }
        }
    }
}

export class PeriodicBoundary extends BoundaryCondition {
    apply(particleData: ParticleData): void {
        const { positions, count } = particleData;
        const { xMin, xMax, yMin, yMax } = this.bounds;
        const width = xMax - xMin;
        const height = yMax - yMin;

        for (let i = 0; i < count; i++) {
            const idx = i * 2;

            // X boundaries - wrap around
            if (positions[idx] < xMin) {
                positions[idx] += width;
            } else if (positions[idx] > xMax) {
                positions[idx] -= width;
            }

            // Y boundaries - wrap around
            if (positions[idx + 1] < yMin) {
                positions[idx + 1] += height;
            } else if (positions[idx + 1] > yMax) {
                positions[idx + 1] -= height;
            }
        }
    }
}

export class AbsorbingBoundary extends BoundaryCondition {
    private absorbedParticles: Set<number> = new Set();

    apply(particleData: ParticleData): void {
        const { positions, velocities, count } = particleData;
        const { xMin, xMax, yMin, yMax } = this.bounds;

        for (let i = 0; i < count; i++) {
            if (this.absorbedParticles.has(i)) continue;

            const idx = i * 2;

            // Check if particle hits boundary
            if (positions[idx] < xMin || positions[idx] > xMax ||
                positions[idx + 1] < yMin || positions[idx + 1] > yMax) {
                
                // "Absorb" the particle by setting velocity to zero and moving to boundary
                velocities[idx] = 0;
                velocities[idx + 1] = 0;
                
                // Clamp position to boundary
                positions[idx] = Math.max(xMin, Math.min(xMax, positions[idx]));
                positions[idx + 1] = Math.max(yMin, Math.min(yMax, positions[idx + 1]));
                
                this.absorbedParticles.add(i);
            }
        }
    }

    reset(): void {
        this.absorbedParticles.clear();
    }

    getAbsorbedCount(): number {
        return this.absorbedParticles.size;
    }
}

export class ElasticBoundary extends BoundaryCondition {
    private stiffness: number;

    constructor(bounds: Bounds, damping: number = 0.95, stiffness: number = 100) {
        super(bounds, damping);
        this.stiffness = stiffness;
    }

    apply(particleData: ParticleData): void {
        const { positions, velocities, count } = particleData;
        const { xMin, xMax, yMin, yMax } = this.bounds;

        for (let i = 0; i < count; i++) {
            const idx = i * 2;

            // Apply spring force when near boundaries
            const margin = 2.0; // Distance from boundary where spring force starts

            // X boundaries
            if (positions[idx] < xMin + margin) {
                const penetration = (xMin + margin) - positions[idx];
                velocities[idx] += this.stiffness * penetration * 0.01; // Add restoring force
            } else if (positions[idx] > xMax - margin) {
                const penetration = positions[idx] - (xMax - margin);
                velocities[idx] -= this.stiffness * penetration * 0.01;
            }

            // Y boundaries
            if (positions[idx + 1] < yMin + margin) {
                const penetration = (yMin + margin) - positions[idx + 1];
                velocities[idx + 1] += this.stiffness * penetration * 0.01;
            } else if (positions[idx + 1] > yMax - margin) {
                const penetration = positions[idx + 1] - (yMax - margin);
                velocities[idx + 1] -= this.stiffness * penetration * 0.01;
            }

            // Hard boundaries as backup
            if (positions[idx] < xMin) {
                positions[idx] = xMin;
                velocities[idx] = Math.abs(velocities[idx]) * this.damping;
            } else if (positions[idx] > xMax) {
                positions[idx] = xMax;
                velocities[idx] = -Math.abs(velocities[idx]) * this.damping;
            }

            if (positions[idx + 1] < yMin) {
                positions[idx + 1] = yMin;
                velocities[idx + 1] = Math.abs(velocities[idx + 1]) * this.damping;
            } else if (positions[idx + 1] > yMax) {
                positions[idx + 1] = yMax;
                velocities[idx + 1] = -Math.abs(velocities[idx + 1]) * this.damping;
            }
        }
    }

    setStiffness(stiffness: number): void {
        this.stiffness = stiffness;
    }
}

export enum BoundaryType {
    REFLECTIVE = 'reflective',
    PERIODIC = 'periodic',
    ABSORBING = 'absorbing',
    ELASTIC = 'elastic'
}

export function createBoundaryCondition(type: BoundaryType, bounds: Bounds, options?: { damping?: number; stiffness?: number }): BoundaryCondition {
    const damping = options?.damping ?? 0.95;
    
    switch (type) {
        case BoundaryType.REFLECTIVE:
            return new ReflectiveBoundary(bounds, damping);
        case BoundaryType.PERIODIC:
            return new PeriodicBoundary(bounds, damping);
        case BoundaryType.ABSORBING:
            return new AbsorbingBoundary(bounds, damping);
        case BoundaryType.ELASTIC:
            return new ElasticBoundary(bounds, damping, options?.stiffness ?? 100);
        default:
            return new ReflectiveBoundary(bounds, damping);
    }
}