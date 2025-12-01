import { ParticleSystemData } from './Thermostats';
import { BOLTZMANN_CONSTANT, ARGON } from './constants';

export interface ParticleData extends ParticleSystemData {
    oldAccelerations: Float32Array;
    types: Uint8Array;
    typeCounts: number[];
}

/**
 * Create typed arrays for particle data
 */
export function createParticleArrays(count: number, numTypes: number): ParticleData {
    return {
        // Main property arrays
        positions: new Float32Array(count * 2),       // x, y pairs
        velocities: new Float32Array(count * 2),      // vx, vy pairs
        accelerations: new Float32Array(count * 2),   // ax, ay pairs
        oldAccelerations: new Float32Array(count * 2),// ax_old, ay_old pairs
        types: new Uint8Array(count),                 // particle type index
        masses: new Float32Array(count),              // mass of each particle

        // Metadata
        count: count,                                // total particle count
        typeCounts: new Array(numTypes).fill(0),    // count per type
    };
}

/**
 * Proper 2D quasi-random sequence generator (Halton sequence)
 */
export function generateQuasiRandom(n: number): number[][] {
    const points: number[][] = [];

    // Halton sequence using bases 2 and 3 for better 2D distribution
    const halton = (index: number, base: number): number => {
        let result = 0;
        let f = 1 / base;
        let i = index;
        while (i > 0) {
            result += f * (i % base);
            i = Math.floor(i / base);
            f = f / base;
        }
        return result;
    };

    for (let i = 0; i < n; i++) {
        const x = halton(i + 1, 2); // Base 2 for x-coordinate
        const y = halton(i + 1, 3); // Base 3 for y-coordinate
        points.push([x, y]);
    }
    return points;
}

/**
 * Initialize particle positions based on layout type
 */
export function initializeParticlePositions(
    particleData: ParticleData,
    orangeRatio: number,
    effectiveWidth: number,
    effectiveHeight: number,
    baseParticleRadius: number,
    initLayout: 'random' | 'separated-lr' | 'separated-tb' | 'center-cluster'
): void {
    const numParticles = particleData.count;
    const quasiPoints = generateQuasiRandom(numParticles);

    // Calculate deterministic particle type distribution
    const numOrange = Math.floor(numParticles * orangeRatio);
    const numBlue = numParticles - numOrange;
    particleData.typeCounts[0] = numOrange; // Orange
    particleData.typeCounts[1] = numBlue;   // Blue

    // Distribute particles based on layout
    const margin = baseParticleRadius * 2;

    for (let i = 0; i < numParticles; i++) {
        let xPos: number, yPos: number;

        // Assign types deterministically: first numOrange particles are orange, rest are blue
        const typeIdx = i < numOrange ? 0 : 1;
        particleData.types[i] = typeIdx;

        switch (initLayout) {
            case 'separated-lr': {
                // Separate by type: orange on left, blue on right
                // For battery: particles start LEFT of the left electrode wall (0-12% region)
                // The electrode wall is at 15%, so we stay in 0-12% to be safe
                if (typeIdx === 0) {
                    // Orange particles on left side (0-12% of width)
                    xPos = margin + quasiPoints[i][0] * (effectiveWidth * 0.12 - margin);
                    yPos = margin + quasiPoints[i][1] * (effectiveHeight - 2 * margin);
                } else {
                    // Blue particles on right side (88-100% of width)
                    xPos = effectiveWidth * 0.88 + quasiPoints[i][0] * (effectiveWidth * 0.12 - margin);
                    yPos = margin + quasiPoints[i][1] * (effectiveHeight - 2 * margin);
                }
                break;
            }
            case 'separated-tb': {
                // Separate by type: orange on top, blue on bottom
                if (typeIdx === 0) {
                    xPos = margin + quasiPoints[i][0] * (effectiveWidth - 2 * margin);
                    yPos = margin + quasiPoints[i][1] * (effectiveHeight * 0.3 - margin);
                } else {
                    xPos = margin + quasiPoints[i][0] * (effectiveWidth - 2 * margin);
                    yPos = effectiveHeight * 0.7 + quasiPoints[i][1] * (effectiveHeight * 0.3 - margin);
                }
                break;
            }
            case 'center-cluster': {
                // All particles clustered in the center
                const centerX = effectiveWidth / 2;
                const centerY = effectiveHeight / 2;
                const clusterRadius = Math.min(effectiveWidth, effectiveHeight) * 0.25;

                // Use quasi-random with offset to cluster in center
                const angle = quasiPoints[i][0] * 2 * Math.PI;
                const r = Math.sqrt(quasiPoints[i][1]) * clusterRadius; // sqrt for uniform distribution
                xPos = centerX + r * Math.cos(angle);
                yPos = centerY + r * Math.sin(angle);
                break;
            }
            case 'random':
            default: {
                // Random distribution (original behavior)
                xPos = margin + quasiPoints[i][0] * (effectiveWidth - 2 * margin);
                yPos = margin + quasiPoints[i][1] * (effectiveHeight - 2 * margin);
                break;
            }
        }

        // Store in typed arrays
        const idx = i * 2;
        particleData.positions[idx] = xPos;
        particleData.positions[idx + 1] = yPos;
    }
}

/**
 * Initialize particle velocities with Maxwell-Boltzmann distribution
 * @param particleData - particle data arrays
 * @param temperatureK - temperature in Kelvin
 * @param mass - particle mass in amu (default: Argon mass)
 */
export function initializeParticleVelocities(
    particleData: ParticleData,
    temperatureK: number,
    mass: number = ARGON.mass
): void {
    const numParticles = particleData.count;

    // Thermal velocity scale: sqrt(kB*T/m)
    // With kB in eV/K, T in K, m in amu, gives velocity in Å/time_unit
    const thermalVelocity = Math.sqrt(BOLTZMANN_CONSTANT * temperatureK / mass);

    for (let i = 0; i < numParticles; i++) {
        // Box-Muller for Gaussian velocity distribution
        const u1 = Math.random();
        const u2 = Math.random();
        const u3 = Math.random();
        const u4 = Math.random();

        // Two independent Gaussian random numbers
        const vx = thermalVelocity * Math.sqrt(-2 * Math.log(Math.max(1e-10, u1))) * Math.cos(2 * Math.PI * u2);
        const vy = thermalVelocity * Math.sqrt(-2 * Math.log(Math.max(1e-10, u3))) * Math.cos(2 * Math.PI * u4);

        const idx = i * 2;
        particleData.velocities[idx] = vx;
        particleData.velocities[idx + 1] = vy;
        particleData.accelerations[idx] = 0;
        particleData.accelerations[idx + 1] = 0;
        particleData.oldAccelerations[idx] = 0;
        particleData.oldAccelerations[idx + 1] = 0;
        particleData.masses[i] = mass;  // Set mass properly
    }
}
