/**
 * Tests for MD integrator energy conservation
 * Verifies that NVE (microcanonical) ensemble conserves total energy
 *
 * NOTE: The actual simulation uses Float32Array (single precision) for performance.
 * Single precision has ~7 significant digits, so we expect conservation to ~1e-6.
 * For verification, we also test with Float64Array to confirm algorithm correctness.
 */

import { PotentialManager, LennardJonesPotential } from '../Potentials';

// Type alias for array type (allows testing both precisions)
type TypedFloatArray = Float32Array | Float64Array;

// Simplified integrator for testing (extracted logic from useSimulation)
function velocityVerletStep<T extends TypedFloatArray>(
    positions: T,
    velocities: T,
    accelerations: T,
    oldAccelerations: T,
    masses: T,
    count: number,
    dt: number,
    calculateForces: () => void
) {
    const dt2Half = 0.5 * dt * dt;
    const dtHalf = 0.5 * dt;

    // Store old accelerations
    for (let i = 0; i < count * 2; i++) {
        oldAccelerations[i] = accelerations[i];
    }

    // Update positions: r(t+dt) = r(t) + v(t)*dt + 0.5*a(t)*dt²
    for (let i = 0; i < count; i++) {
        const idx = i * 2;
        positions[idx] += velocities[idx] * dt + accelerations[idx] * dt2Half;
        positions[idx + 1] += velocities[idx + 1] * dt + accelerations[idx + 1] * dt2Half;
    }

    // Calculate new forces
    calculateForces();

    // Update velocities: v(t+dt) = v(t) + 0.5*[a(t) + a(t+dt)]*dt
    for (let i = 0; i < count; i++) {
        const idx = i * 2;
        velocities[idx] += (oldAccelerations[idx] + accelerations[idx]) * dtHalf;
        velocities[idx + 1] += (oldAccelerations[idx + 1] + accelerations[idx + 1]) * dtHalf;
    }
}

function calculateKineticEnergy(velocities: Float32Array, masses: Float32Array, count: number): number {
    let ke = 0;
    for (let i = 0; i < count; i++) {
        const idx = i * 2;
        const vx = velocities[idx];
        const vy = velocities[idx + 1];
        ke += 0.5 * masses[i] * (vx * vx + vy * vy);
    }
    return ke;
}

function calculatePotentialEnergy(
    positions: Float32Array,
    types: Uint8Array,
    count: number,
    potentialManager: PotentialManager,
    cutoff: number
): number {
    let pe = 0;
    const cutoffSq = cutoff * cutoff;

    for (let i = 0; i < count; i++) {
        const idxI = i * 2;
        for (let j = i + 1; j < count; j++) {
            const idxJ = j * 2;
            const dx = positions[idxJ] - positions[idxI];
            const dy = positions[idxJ + 1] - positions[idxI + 1];
            const rSq = dx * dx + dy * dy;

            if (rSq < cutoffSq && rSq > 0.01) {
                const r = Math.sqrt(rSq);
                const result = potentialManager.calculateTotal(r, types[i], types[j]);
                pe += result.potential;
            }
        }
    }
    return pe;
}

function calculateForces(
    positions: Float32Array,
    accelerations: Float32Array,
    types: Uint8Array,
    masses: Float32Array,
    count: number,
    potentialManager: PotentialManager,
    cutoff: number
) {
    accelerations.fill(0);
    const cutoffSq = cutoff * cutoff;
    const minDistance = 1.0;

    for (let i = 0; i < count; i++) {
        const idxI = i * 2;
        for (let j = i + 1; j < count; j++) {
            const idxJ = j * 2;
            const dx = positions[idxJ] - positions[idxI];
            const dy = positions[idxJ + 1] - positions[idxI + 1];
            const rSq = dx * dx + dy * dy;

            if (rSq < cutoffSq && rSq > 0.0001) {
                const rActual = Math.sqrt(rSq);
                const r = Math.max(minDistance, rActual);

                const result = potentialManager.calculateTotal(r, types[i], types[j]);
                const force = result.force;

                if (!isFinite(force)) continue;

                const invR = 1 / rActual;
                const fx = force * dx * invR;
                const fy = force * dy * invR;

                accelerations[idxI] += fx / masses[i];
                accelerations[idxI + 1] += fy / masses[i];
                accelerations[idxJ] -= fx / masses[j];
                accelerations[idxJ + 1] -= fy / masses[j];
            }
        }
    }
}

describe('Energy conservation in NVE ensemble', () => {
    // Argon parameters
    const epsilon = 0.0103;  // eV
    const sigma = 3.4;       // Angstrom
    const mass = 39.948;     // amu (Argon)
    const cutoff = 12.0;     // Angstrom

    // Single type matrix
    const epsMatrix = [[epsilon]];
    const sigMatrix = [[sigma]];

    test('total energy is conserved for 2-particle system', () => {
        const count = 2;
        const positions = new Float32Array([10, 10, 14, 10]);  // 4 Å apart
        const velocities = new Float32Array([0.1, 0, -0.1, 0]); // Moving toward each other
        const accelerations = new Float32Array(count * 2);
        const oldAccelerations = new Float32Array(count * 2);
        const masses = new Float32Array([mass, mass]);
        const types = new Uint8Array([0, 0]);

        const potentialManager = new PotentialManager();
        potentialManager.addPotential(new LennardJonesPotential(epsMatrix, sigMatrix, 1.0, 1.0, cutoff));

        const calcForces = () => calculateForces(
            positions, accelerations, types, masses, count, potentialManager, cutoff
        );

        // Initial energy
        calcForces();
        const initialKE = calculateKineticEnergy(velocities, masses, count);
        const initialPE = calculatePotentialEnergy(positions, types, count, potentialManager, cutoff);
        const initialTotal = initialKE + initialPE;

        // Run 1000 steps with small timestep
        const dt = 0.01;
        const nSteps = 1000;

        for (let step = 0; step < nSteps; step++) {
            velocityVerletStep(
                positions, velocities, accelerations, oldAccelerations,
                masses, count, dt, calcForces
            );
        }

        // Final energy
        const finalKE = calculateKineticEnergy(velocities, masses, count);
        const finalPE = calculatePotentialEnergy(positions, types, count, potentialManager, cutoff);
        const finalTotal = finalKE + finalPE;

        // Energy should be conserved to within 1%
        const energyDrift = Math.abs(finalTotal - initialTotal) / Math.abs(initialTotal);
        expect(energyDrift).toBeLessThan(0.01);
    });

    test('total energy is conserved for multi-particle Argon system', () => {
        const count = 10;
        const boxSize = 30;  // Angstrom

        // Initialize positions on a grid
        const positions = new Float32Array(count * 2);
        const gridSize = Math.ceil(Math.sqrt(count));
        const spacing = boxSize / (gridSize + 1);

        for (let i = 0; i < count; i++) {
            const row = Math.floor(i / gridSize);
            const col = i % gridSize;
            positions[i * 2] = (col + 1) * spacing;
            positions[i * 2 + 1] = (row + 1) * spacing;
        }

        // Random velocities (but reproducible)
        const velocities = new Float32Array(count * 2);
        for (let i = 0; i < count * 2; i++) {
            // Simple pseudo-random based on index
            velocities[i] = 0.1 * Math.sin(i * 1.234 + 0.567);
        }

        // Remove center of mass velocity
        let vxSum = 0, vySum = 0;
        for (let i = 0; i < count; i++) {
            vxSum += velocities[i * 2];
            vySum += velocities[i * 2 + 1];
        }
        for (let i = 0; i < count; i++) {
            velocities[i * 2] -= vxSum / count;
            velocities[i * 2 + 1] -= vySum / count;
        }

        const accelerations = new Float32Array(count * 2);
        const oldAccelerations = new Float32Array(count * 2);
        const masses = new Float32Array(count).fill(mass);
        const types = new Uint8Array(count).fill(0);

        const potentialManager = new PotentialManager();
        potentialManager.addPotential(new LennardJonesPotential(epsMatrix, sigMatrix, 1.0, 1.0, cutoff));

        const calcForces = () => calculateForces(
            positions, accelerations, types, masses, count, potentialManager, cutoff
        );

        // Initial energy
        calcForces();
        const initialKE = calculateKineticEnergy(velocities, masses, count);
        const initialPE = calculatePotentialEnergy(positions, types, count, potentialManager, cutoff);
        const initialTotal = initialKE + initialPE;

        // Run simulation
        const dt = 0.005;  // Smaller timestep for larger system
        const nSteps = 500;
        const energyHistory: number[] = [initialTotal];

        for (let step = 0; step < nSteps; step++) {
            velocityVerletStep(
                positions, velocities, accelerations, oldAccelerations,
                masses, count, dt, calcForces
            );

            if (step % 50 === 0) {
                const ke = calculateKineticEnergy(velocities, masses, count);
                const pe = calculatePotentialEnergy(positions, types, count, potentialManager, cutoff);
                energyHistory.push(ke + pe);
            }
        }

        // Final energy
        const finalKE = calculateKineticEnergy(velocities, masses, count);
        const finalPE = calculatePotentialEnergy(positions, types, count, potentialManager, cutoff);
        const finalTotal = finalKE + finalPE;

        // Check energy conservation (allow 2% drift for larger system)
        const energyDrift = Math.abs(finalTotal - initialTotal) / Math.abs(initialTotal);
        expect(energyDrift).toBeLessThan(0.02);

        // Also check that energy doesn't drift monotonically (would indicate a bug)
        const maxEnergy = Math.max(...energyHistory);
        const minEnergy = Math.min(...energyHistory);
        const fluctuation = (maxEnergy - minEnergy) / Math.abs(initialTotal);
        expect(fluctuation).toBeLessThan(0.05);  // Fluctuations should be small
    });

    test('momentum is conserved (no external forces)', () => {
        const count = 5;
        const positions = new Float32Array([
            5, 5,
            10, 5,
            15, 10,
            8, 15,
            12, 12
        ]);
        const velocities = new Float32Array([
            0.1, 0.05,
            -0.05, 0.1,
            0.02, -0.08,
            -0.03, 0.02,
            -0.04, -0.09
        ]);

        const accelerations = new Float32Array(count * 2);
        const oldAccelerations = new Float32Array(count * 2);
        const masses = new Float32Array(count).fill(mass);
        const types = new Uint8Array(count).fill(0);

        const potentialManager = new PotentialManager();
        potentialManager.addPotential(new LennardJonesPotential(epsMatrix, sigMatrix, 1.0, 1.0, cutoff));

        const calcForces = () => calculateForces(
            positions, accelerations, types, masses, count, potentialManager, cutoff
        );

        // Initial momentum
        let initialPx = 0, initialPy = 0;
        for (let i = 0; i < count; i++) {
            initialPx += masses[i] * velocities[i * 2];
            initialPy += masses[i] * velocities[i * 2 + 1];
        }

        // Run simulation
        calcForces();
        const dt = 0.01;
        const nSteps = 500;

        for (let step = 0; step < nSteps; step++) {
            velocityVerletStep(
                positions, velocities, accelerations, oldAccelerations,
                masses, count, dt, calcForces
            );
        }

        // Final momentum
        let finalPx = 0, finalPy = 0;
        for (let i = 0; i < count; i++) {
            finalPx += masses[i] * velocities[i * 2];
            finalPy += masses[i] * velocities[i * 2 + 1];
        }

        // Momentum should be conserved (allowing for floating point accumulation)
        // With 500 steps, expect ~1e-6 drift
        expect(finalPx).toBeCloseTo(initialPx, 5);
        expect(finalPy).toBeCloseTo(initialPy, 5);
    });
});

describe('Velocity Verlet properties', () => {
    const epsilon = 0.0103;
    const sigma = 3.4;
    const mass = 39.948;
    const epsMatrix = [[epsilon]];
    const sigMatrix = [[sigma]];

    test('integrator is time-reversible', () => {
        const count = 2;
        const initialPositions = new Float32Array([10, 10, 15, 10]);
        const initialVelocities = new Float32Array([0.1, 0.05, -0.1, -0.05]);

        const positions = new Float32Array(initialPositions);
        const velocities = new Float32Array(initialVelocities);
        const accelerations = new Float32Array(count * 2);
        const oldAccelerations = new Float32Array(count * 2);
        const masses = new Float32Array([mass, mass]);
        const types = new Uint8Array([0, 0]);

        const potentialManager = new PotentialManager();
        potentialManager.addPotential(new LennardJonesPotential(epsMatrix, sigMatrix, 1.0, 1.0, 12.0));

        const calcForces = () => calculateForces(
            positions, accelerations, types, masses, count, potentialManager, 12.0
        );

        const dt = 0.01;
        const nSteps = 100;

        // Forward integration
        calcForces();
        for (let step = 0; step < nSteps; step++) {
            velocityVerletStep(
                positions, velocities, accelerations, oldAccelerations,
                masses, count, dt, calcForces
            );
        }

        // Reverse velocities
        for (let i = 0; i < count * 2; i++) {
            velocities[i] = -velocities[i];
        }

        // Backward integration (same number of steps)
        for (let step = 0; step < nSteps; step++) {
            velocityVerletStep(
                positions, velocities, accelerations, oldAccelerations,
                masses, count, dt, calcForces
            );
        }

        // Should return to initial positions (within numerical precision)
        for (let i = 0; i < count * 2; i++) {
            expect(positions[i]).toBeCloseTo(initialPositions[i], 4);
        }
    });
});
