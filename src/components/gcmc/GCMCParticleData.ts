/**
 * Variable-count particle storage for Grand Canonical Monte Carlo.
 * Unlike MD's ParticleData, no velocities/accelerations are needed.
 * Supports O(1) insertion (append) and deletion (swap-with-last).
 */

export interface GCMCParticleData {
    positions: Float32Array;   // x, y pairs
    types: Uint8Array;         // particle type index
    masses: Float32Array;      // mass per particle
    count: number;             // current active particle count
    capacity: number;          // buffer capacity (max particles before realloc)
    typeCounts: number[];      // count per type
    numTypes: number;
}

export function createGCMCParticleArrays(
    initialCount: number,
    numTypes: number,
    capacity?: number
): GCMCParticleData {
    const cap = capacity ?? Math.max(initialCount * 2, 64);
    return {
        positions: new Float32Array(cap * 2),
        types: new Uint8Array(cap),
        masses: new Float32Array(cap),
        count: 0,
        capacity: cap,
        typeCounts: new Array(numTypes).fill(0),
        numTypes,
    };
}

/**
 * Grow buffers to new capacity, preserving existing data.
 */
function growBuffers(data: GCMCParticleData, newCapacity: number): void {
    const newPositions = new Float32Array(newCapacity * 2);
    newPositions.set(data.positions.subarray(0, data.count * 2));
    data.positions = newPositions;

    const newTypes = new Uint8Array(newCapacity);
    newTypes.set(data.types.subarray(0, data.count));
    data.types = newTypes;

    const newMasses = new Float32Array(newCapacity);
    newMasses.set(data.masses.subarray(0, data.count));
    data.masses = newMasses;

    data.capacity = newCapacity;
}

/**
 * Insert a particle at the end. Grows buffer if needed.
 */
export function insertParticle(
    data: GCMCParticleData,
    x: number,
    y: number,
    type: number,
    mass: number
): number {
    if (data.count >= data.capacity) {
        growBuffers(data, data.capacity * 2);
    }
    const idx = data.count;
    data.positions[idx * 2] = x;
    data.positions[idx * 2 + 1] = y;
    data.types[idx] = type;
    data.masses[idx] = mass;
    data.count++;
    data.typeCounts[type]++;
    return idx;
}

/**
 * Delete a particle by swapping with the last. O(1).
 */
export function deleteParticle(data: GCMCParticleData, index: number): void {
    if (index < 0 || index >= data.count) return;

    const type = data.types[index];
    data.typeCounts[type]--;

    const last = data.count - 1;
    if (index !== last) {
        // Swap with last particle
        data.positions[index * 2] = data.positions[last * 2];
        data.positions[index * 2 + 1] = data.positions[last * 2 + 1];
        data.types[index] = data.types[last];
        data.masses[index] = data.masses[last];
    }
    data.count--;
}

/**
 * Quasi-random Halton sequence for initial placement.
 */
function halton(index: number, base: number): number {
    let result = 0;
    let f = 1 / base;
    let i = index;
    while (i > 0) {
        result += f * (i % base);
        i = Math.floor(i / base);
        f = f / base;
    }
    return result;
}

export type InitLayout = 'empty' | 'random' | 'square-lattice' | 'hex-lattice' | 'ions-left';

/**
 * Initialize particles according to the chosen layout.
 */
export function initializeGCMCPositions(
    data: GCMCParticleData,
    layout: InitLayout,
    boxWidth: number,
    boxHeight: number,
    masses: number[],
    sigma: number = 3.4,
    typeRatio: number = 0.5
): void {
    data.count = 0;
    data.typeCounts.fill(0);

    if (layout === 'empty') return;

    // Spacing based on sigma -- particles sit at ~1.1*sigma apart
    const spacing = sigma * 1.2;
    const margin = sigma;

    if (layout === 'random') {
        // ~30 quasi-random particles
        const numParticles = 30;
        const numType0 = Math.floor(numParticles * typeRatio);
        for (let i = 0; i < numParticles; i++) {
            const x = margin + halton(i + 1, 2) * (boxWidth - 2 * margin);
            const y = margin + halton(i + 1, 3) * (boxHeight - 2 * margin);
            const type = i < numType0 ? 0 : Math.min(1, data.numTypes - 1);
            insertParticle(data, x, y, type, masses[type]);
        }
    } else if (layout === 'square-lattice') {
        const nx = Math.floor((boxWidth - 2 * margin) / spacing);
        const ny = Math.floor((boxHeight - 2 * margin) / spacing);
        let idx = 0;
        const total = nx * ny;
        const numType0 = Math.floor(total * typeRatio);
        for (let iy = 0; iy < ny; iy++) {
            for (let ix = 0; ix < nx; ix++) {
                const x = margin + (ix + 0.5) * spacing;
                const y = margin + (iy + 0.5) * spacing;
                const type = idx < numType0 ? 0 : Math.min(1, data.numTypes - 1);
                insertParticle(data, x, y, type, masses[type]);
                idx++;
            }
        }
    } else if (layout === 'hex-lattice') {
        const nx = Math.floor((boxWidth - 2 * margin) / spacing);
        const rowSpacing = spacing * Math.sqrt(3) / 2;
        const ny = Math.floor((boxHeight - 2 * margin) / rowSpacing);
        let idx = 0;
        const total = nx * ny;
        const numType0 = Math.floor(total * typeRatio);
        for (let iy = 0; iy < ny; iy++) {
            const offset = (iy % 2 === 1) ? spacing * 0.5 : 0;
            for (let ix = 0; ix < nx; ix++) {
                const x = margin + (ix + 0.5) * spacing + offset;
                const y = margin + (iy + 0.5) * rowSpacing;
                if (x > boxWidth - margin) continue;
                const type = idx < numType0 ? 0 : Math.min(1, data.numTypes - 1);
                insertParticle(data, x, y, type, masses[type]);
                idx++;
            }
        }
    } else if (layout === 'ions-left') {
        // Place particles on the left side of the box.
        // If multiple types: type 0 fills the box, type 1 on the left.
        // If single type: just place particles on the left.
        if (data.numTypes > 1) {
            // Fill with neutrals (type 0)
            const rowSpacing = spacing * Math.sqrt(3) / 2;
            const nx = Math.floor((boxWidth - 2 * margin) / spacing);
            const ny = Math.floor((boxHeight - 2 * margin) / rowSpacing);
            for (let iy = 0; iy < ny; iy++) {
                const offset = (iy % 2 === 1) ? spacing * 0.5 : 0;
                for (let ix = 0; ix < nx; ix++) {
                    const x = margin + (ix + 0.5) * spacing + offset;
                    const y = margin + (iy + 0.5) * rowSpacing;
                    if (x > boxWidth - margin) continue;
                    insertParticle(data, x, y, 0, masses[0]);
                }
            }
            // Place ions (type 1) on the left
            const ionSpacing = spacing * 1.3;
            const ionRegion = boxWidth * 0.2;
            const ionNx = Math.max(1, Math.floor((ionRegion - margin) / ionSpacing));
            const ionNy = Math.floor((boxHeight - 2 * margin) / ionSpacing);
            for (let iy = 0; iy < ionNy; iy++) {
                for (let ix = 0; ix < ionNx; ix++) {
                    const x = margin + (ix + 0.5) * ionSpacing;
                    const y = margin + (iy + 0.5) * ionSpacing;
                    insertParticle(data, x, y, 1, masses[1] ?? masses[0]);
                }
            }
        } else {
            // Single type: loose grid on the left quarter (~20-30 particles)
            const region = boxWidth * 0.25;
            const ionSpacing = Math.max(sigma * 2, 8);
            const rowSpacing = ionSpacing * Math.sqrt(3) / 2;
            const nx = Math.max(1, Math.floor((region - margin) / ionSpacing));
            const ny = Math.floor((boxHeight - 2 * margin) / rowSpacing);
            for (let iy = 0; iy < ny; iy++) {
                const offset = (iy % 2 === 1) ? ionSpacing * 0.5 : 0;
                for (let ix = 0; ix < nx; ix++) {
                    const x = margin + (ix + 0.5) * ionSpacing + offset;
                    const y = margin + (iy + 0.5) * rowSpacing;
                    if (x > region) continue;
                    insertParticle(data, x, y, 0, masses[0]);
                }
            }
        }
    }
}

/**
 * Calculate total potential energy of the system using O(N^2) pairwise sum.
 */
export function calculateTotalEnergy(
    data: GCMCParticleData,
    potential: { calculate(r: number, type1: number, type2: number): { potential: number } },
    boxWidth: number,
    boxHeight: number
): number {
    let totalEnergy = 0;
    const N = data.count;

    for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
            let dx = data.positions[j * 2] - data.positions[i * 2];
            let dy = data.positions[j * 2 + 1] - data.positions[i * 2 + 1];

            // Minimum image convention
            if (dx > boxWidth / 2) dx -= boxWidth;
            else if (dx < -boxWidth / 2) dx += boxWidth;
            if (dy > boxHeight / 2) dy -= boxHeight;
            else if (dy < -boxHeight / 2) dy += boxHeight;

            const r = Math.sqrt(dx * dx + dy * dy);
            if (r < 0.01) {
                totalEnergy += 1e10;
            } else {
                totalEnergy += potential.calculate(r, data.types[i], data.types[j]).potential;
            }
        }
    }
    return totalEnergy;
}
