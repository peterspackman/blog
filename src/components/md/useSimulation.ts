import { useState, useCallback, useRef } from 'react';
import { ParticleData, createParticleArrays, initializeParticlePositions, initializeParticleVelocities } from './ParticleData';
import { PotentialManager } from './Potentials';
import { BoundaryCondition } from './BoundaryConditions';
import { Thermostat } from './Thermostats';
import { NeighborList } from './NeighborList';
import { VectorField, FieldPreset } from './VectorField';
import { ElectricField, ElectricFieldPreset } from './ElectricField';
import { AnalyticsEngine } from './Analytics';

interface UseSimulationProps {
    numParticles: number;
    numTypes: number;
    orangeRatio: number;
    width: number;
    height: number;
    temperature: number;  // Kelvin
    timeStep: number;
    baseParticleRadius: number;
    coordinateScale: number;
    initLayout: 'random' | 'separated-lr' | 'separated-tb' | 'center-cluster';
    mass?: number;  // amu - particle mass (default: Argon)
    potentialManager: PotentialManager | null;
    boundaryCondition: BoundaryCondition | null;
    thermostat: Thermostat | null;
    neighborListRef: React.RefObject<NeighborList | null>;
    vectorFieldRef: React.RefObject<VectorField | null>;
    electricFieldRef: React.RefObject<ElectricField | null>;
    fieldPresetRef: React.RefObject<FieldPreset>;
    fieldChargeModeRef: React.RefObject<boolean>;  // If true, field interacts by particle type
    eFieldPresetRef: React.RefObject<ElectricFieldPreset>;
    analytics: AnalyticsEngine | null;
}

export function useSimulation({
    numParticles,
    numTypes,
    orangeRatio,
    width,
    height,
    temperature,
    timeStep,
    baseParticleRadius,
    coordinateScale,
    initLayout,
    mass = 39.948,  // Default: Argon mass in amu
    potentialManager,
    boundaryCondition,
    thermostat,
    neighborListRef,
    vectorFieldRef,
    electricFieldRef,
    fieldPresetRef,
    fieldChargeModeRef,
    eFieldPresetRef,
    analytics,
}: UseSimulationProps) {
    const [particleData, setParticleData] = useState<ParticleData | null>(null);
    const stepCountRef = useRef(0);
    const [displayStepCount, setDisplayStepCount] = useState(0);

    // Initialize particles
    const initializeParticles = useCallback(() => {
        // Create new typed arrays for particles
        const newParticleData = createParticleArrays(numParticles, numTypes);

        // Calculate simulation space in angstroms (independent of visual scale)
        const physicsScale = 5.0; // Fixed physics scale: pixels to angstroms
        const effectiveWidth = width / physicsScale;
        const effectiveHeight = height / physicsScale;

        // Initialize positions
        initializeParticlePositions(
            newParticleData,
            orangeRatio,
            effectiveWidth,
            effectiveHeight,
            baseParticleRadius,
            initLayout
        );

        // Run steepest descent energy minimization to remove bad contacts
        // Uses O(N²) pairwise forces - acceptable for one-time initialization
        if (potentialManager && numParticles > 1) {
            const minSteps = 10;
            const stepSize = 0.01;  // Å per unit force
            const minDistance = 1.0;
            const maxDisplacement = 0.3;  // Max movement per step in Å
            const cutoffSq = 144;  // 12 Å cutoff squared
            const positions = newParticleData.positions;
            const masses = newParticleData.masses;
            const types = newParticleData.types;
            const count = newParticleData.count;
            const forces = new Float32Array(count * 2);

            for (let step = 0; step < minSteps; step++) {
                // Reset forces
                forces.fill(0);

                // O(N²) pairwise force calculation
                for (let i = 0; i < count; i++) {
                    const idxI = i * 2;
                    const xi = positions[idxI];
                    const yi = positions[idxI + 1];

                    for (let j = i + 1; j < count; j++) {
                        const idxJ = j * 2;
                        const dx = positions[idxJ] - xi;
                        const dy = positions[idxJ + 1] - yi;
                        const rSq = dx * dx + dy * dy;

                        if (rSq > cutoffSq || rSq < 0.0001) continue;

                        const rActual = Math.sqrt(rSq);
                        const r = Math.max(minDistance, rActual);

                        const result = potentialManager.calculateTotal(r, types[i], types[j]);
                        const totalForce = result.force;

                        if (!isFinite(totalForce)) continue;

                        const invR = 1 / rActual;
                        const fx = totalForce * dx * invR;
                        const fy = totalForce * dy * invR;

                        forces[idxI] += fx / masses[i];
                        forces[idxI + 1] += fy / masses[i];
                        forces[idxJ] -= fx / masses[j];
                        forces[idxJ + 1] -= fy / masses[j];
                    }
                }

                // Move particles along force direction (steepest descent)
                for (let i = 0; i < count; i++) {
                    const idx = i * 2;
                    let dispX = forces[idx] * stepSize;
                    let dispY = forces[idx + 1] * stepSize;

                    // Skip if forces are invalid
                    if (!isFinite(dispX) || !isFinite(dispY)) continue;

                    // Clamp displacement magnitude
                    const dispMag = Math.sqrt(dispX * dispX + dispY * dispY);
                    if (dispMag > maxDisplacement) {
                        const scale = maxDisplacement / dispMag;
                        dispX *= scale;
                        dispY *= scale;
                    }

                    positions[idx] += dispX;
                    positions[idx + 1] += dispY;

                    // Keep within bounds
                    positions[idx] = Math.max(baseParticleRadius, Math.min(effectiveWidth - baseParticleRadius, positions[idx]));
                    positions[idx + 1] = Math.max(baseParticleRadius, Math.min(effectiveHeight - baseParticleRadius, positions[idx + 1]));
                }
            }
        }

        // Initialize velocities with proper temperature and mass
        initializeParticleVelocities(newParticleData, temperature, mass);

        // Reset and update analytics with new particle types
        if (analytics) {
            analytics.reset(); // Clear all previous data
            analytics.setParticleTypes(newParticleData.types);
        }

        // Invalidate neighbor list so it rebuilds on next force calculation
        if (neighborListRef.current) {
            neighborListRef.current.invalidate();
        }

        // Reset step counter
        stepCountRef.current = 0;
        setDisplayStepCount(0);

        setParticleData(newParticleData);
    }, [numParticles, numTypes, orangeRatio, width, height, temperature, mass, baseParticleRadius, initLayout, analytics, neighborListRef, potentialManager]);

    // Calculate forces between particles using modular potential system with neighbor list
    // Units: positions in Å, forces in eV/Å, accelerations in eV/(Å·amu) = Å/time_unit²
    const calculateForces = useCallback(() => {
        if (!particleData || !potentialManager || !neighborListRef.current) return;

        // Reset accelerations
        particleData.accelerations.fill(0);

        const positions = particleData.positions;
        const accelerations = particleData.accelerations;
        const types = particleData.types;
        const masses = particleData.masses;
        const count = particleData.count;

        // Update neighbor list (will rebuild if needed based on displacement or interval)
        neighborListRef.current.update(positions, count);

        let totalPotentialEnergy = 0;
        let totalVirial = 0;

        // Use neighbor list for O(N) force calculation with proper minimum image
        // Minimum distance to prevent singularity when particles overlap
        const minDistance = 1.0;  // Å - clamp r to avoid extreme forces at small separations

        neighborListRef.current.forEachPair((i, j, dx, dy, rSquared) => {
            const typeI = types[i];
            const typeJ = types[j];
            const massI = masses[i];
            const massJ = masses[j];
            const idxI = i * 2;
            const idxJ = j * 2;

            // Clamp distance to minimum to prevent singularity
            const rActual = Math.sqrt(rSquared);
            const r = Math.max(minDistance, rActual);

            // Use potential manager to calculate total force and potential
            // Force is in eV/Å, potential is in eV
            const result = potentialManager.calculateTotal(r, typeI, typeJ);
            const totalForce = result.force;
            totalPotentialEnergy += result.potential;

            // Calculate virial for pressure calculation: W = sum(r · F)
            totalVirial += totalForce * r;

            // Project force onto x and y components
            // dx, dy already have minimum image applied from neighbor list
            // Use actual distance for direction, clamped distance for force magnitude
            const invR = rActual > 0.001 ? 1 / rActual : 0;
            const fx = totalForce * dx * invR;
            const fy = totalForce * dy * invR;

            // Apply Newton's third law directly to accelerations
            // a = F/m, units: (eV/Å) / amu = Å/time_unit²
            const axI = fx / massI;
            const ayI = fy / massI;
            const axJ = fx / massJ;
            const ayJ = fy / massJ;

            accelerations[idxI] += axI;
            accelerations[idxI + 1] += ayI;
            accelerations[idxJ] -= axJ;
            accelerations[idxJ + 1] -= ayJ;
        }, count);

        // Apply external vector field forces (O(N) - one lookup per particle)
        // This is for drawn barriers/wells
        // If chargeMode is on, orange (+) and blue (-) particles interact oppositely
        // Field forces are in arbitrary UI units, scale to ~0.01 eV/Å
        if (vectorFieldRef.current && fieldPresetRef.current !== 'none') {
            const field = vectorFieldRef.current;
            const fieldScale = 0.001;  // Convert UI field strength to eV/Å
            const chargeMode = fieldChargeModeRef.current;

            for (let i = 0; i < count; i++) {
                const idx = i * 2;
                const x = positions[idx];
                const y = positions[idx + 1];

                // O(1) lookup with bilinear interpolation
                const { fx, fy } = field.getForce(x, y, true);

                // In charge mode: type 0 (orange) = +1, type 1 (blue) = -1
                // Blue particles are attracted to repulsive regions, repelled from attractive
                const sign = chargeMode ? (types[i] === 0 ? 1 : -1) : 1;

                accelerations[idx] += sign * fx * fieldScale / masses[i];
                accelerations[idx + 1] += sign * fy * fieldScale / masses[i];

                // Add field potential to total
                totalPotentialEnergy += field.getPotential(x, y, true) * fieldScale;
            }
        }

        // Apply electric field (grid-based, affects particles by charge)
        // E-field in UI units, scale to give reasonable acceleration
        if (electricFieldRef.current && eFieldPresetRef.current !== 'none') {
            const eField = electricFieldRef.current;
            const eFieldScale = 0.001;  // Convert UI field strength to eV/(Å·e)

            for (let i = 0; i < count; i++) {
                const idx = i * 2;
                const x = positions[idx];
                const y = positions[idx + 1];

                // Get field at particle position (with interpolation)
                const { ex, ey } = eField.getField(x, y, true);

                // Type 0 (orange): positive charge (+1e), Type 1 (blue): negative charge (-1e)
                const charge = types[i] === 0 ? 1 : -1;

                // F = q*E, a = F/m
                accelerations[idx] += ex * charge * eFieldScale / masses[i];
                accelerations[idx + 1] += ey * charge * eFieldScale / masses[i];
            }
        }

        // Update analytics if available
        if (analytics && particleData) {
            // System area in Å² (2D simulation)
            const physicsScale = 5.0;  // pixels to Å
            const systemArea = (width / physicsScale) * (height / physicsScale);
            analytics.updateTime(timeStep);
            analytics.calculateAndSample(particleData, totalPotentialEnergy, systemArea, totalVirial);
        }
    }, [particleData, potentialManager, neighborListRef, vectorFieldRef, electricFieldRef, fieldPresetRef, fieldChargeModeRef, eFieldPresetRef, analytics, width, height, timeStep]);

    // Integration using Velocity Verlet algorithm with adaptive timestep
    const velocityVerlet = useCallback(() => {
        if (!particleData) return;

        const positions = particleData.positions;
        const velocities = particleData.velocities;
        const accels = particleData.accelerations;
        const oldAccels = particleData.oldAccelerations;
        const count = particleData.count;

        const dt = timeStep;
        const dt2Half = 0.5 * dt * dt;
        const dtHalf = 0.5 * dt;
        const maxVelocity = 5.0;  // Å/time_unit - safety clamp

        // Store old accelerations (valid from end of previous call, or zero on first call)
        for (let i = 0; i < count * 2; i++) {
            oldAccels[i] = accels[i];
        }

        // Update positions: r(t+dt) = r(t) + v(t)*dt + 0.5*a(t)*dt²
        for (let i = 0; i < count; i++) {
            const idx = i * 2;
            positions[idx] += velocities[idx] * dt + accels[idx] * dt2Half;
            positions[idx + 1] += velocities[idx + 1] * dt + accels[idx + 1] * dt2Half;
        }

        // Apply boundary conditions before force calculation
        if (boundaryCondition) {
            boundaryCondition.apply(particleData);
        }

        // Calculate forces at new positions
        calculateForces();

        // Update velocities: v(t+dt) = v(t) + 0.5*[a(t) + a(t+dt)]*dt
        for (let i = 0; i < count; i++) {
            const idx = i * 2;
            velocities[idx] += (oldAccels[idx] + accels[idx]) * dtHalf;
            velocities[idx + 1] += (oldAccels[idx + 1] + accels[idx + 1]) * dtHalf;

            // Safety clamp for extreme cases (close approaches cause huge LJ forces)
            const vSq = velocities[idx] * velocities[idx] + velocities[idx + 1] * velocities[idx + 1];
            if (vSq > maxVelocity * maxVelocity) {
                const scale = maxVelocity / Math.sqrt(vSq);
                velocities[idx] *= scale;
                velocities[idx + 1] *= scale;
            }
        }

        // Apply thermostat once per full step
        if (thermostat) {
            thermostat.apply(particleData);
        }

        // Increment step counter and update display every 50 steps
        stepCountRef.current++;
        if (stepCountRef.current % 50 === 0) {
            setDisplayStepCount(stepCountRef.current);
        }
    }, [particleData, timeStep, calculateForces, boundaryCondition, thermostat]);

    // FIRE minimization state (persistent across calls)
    const fireStateRef = useRef({
        dt: 0.01,
        alpha: 0.1,
        stepsSinceNegative: 0,
        velocities: null as Float32Array | null,
    });

    // Single step of FIRE minimization (Fast Inertial Relaxation Engine)
    const minimizeStep = useCallback(() => {
        if (!particleData || !potentialManager) return false;

        // FIRE parameters
        const dtMax = 0.05;
        const dtMin = 0.001;
        const nMin = 5;
        const fInc = 1.1;
        const fDec = 0.5;
        const alphaStart = 0.1;
        const fAlpha = 0.99;
        const minDistance = 1.0;
        const cutoffSq = 144;

        const positions = particleData.positions;
        const masses = particleData.masses;
        const types = particleData.types;
        const count = particleData.count;

        // Initialize FIRE velocities if needed
        if (!fireStateRef.current.velocities || fireStateRef.current.velocities.length !== count * 2) {
            fireStateRef.current.velocities = new Float32Array(count * 2);
            fireStateRef.current.dt = 0.01;
            fireStateRef.current.alpha = alphaStart;
            fireStateRef.current.stepsSinceNegative = 0;
        }

        const vel = fireStateRef.current.velocities;
        const forces = new Float32Array(count * 2);

        // Calculate forces (O(N²))
        for (let i = 0; i < count; i++) {
            const idxI = i * 2;
            const xi = positions[idxI];
            const yi = positions[idxI + 1];

            for (let j = i + 1; j < count; j++) {
                const idxJ = j * 2;
                const dx = positions[idxJ] - xi;
                const dy = positions[idxJ + 1] - yi;
                const rSq = dx * dx + dy * dy;

                if (rSq > cutoffSq || rSq < 0.0001) continue;

                const rActual = Math.sqrt(rSq);
                const r = Math.max(minDistance, rActual);

                const result = potentialManager.calculateTotal(r, types[i], types[j]);
                const totalForce = result.force;

                if (!isFinite(totalForce)) continue;

                const invR = 1 / rActual;
                const fx = totalForce * dx * invR;
                const fy = totalForce * dy * invR;

                forces[idxI] += fx / masses[i];
                forces[idxI + 1] += fy / masses[i];
                forces[idxJ] -= fx / masses[j];
                forces[idxJ + 1] -= fy / masses[j];
            }
        }

        // Calculate P = F · v and |F|, |v|
        let power = 0;
        let fNorm = 0;
        let vNorm = 0;
        for (let i = 0; i < count * 2; i++) {
            power += forces[i] * vel[i];
            fNorm += forces[i] * forces[i];
            vNorm += vel[i] * vel[i];
        }
        fNorm = Math.sqrt(fNorm);
        vNorm = Math.sqrt(vNorm);

        // FIRE velocity update
        const state = fireStateRef.current;
        if (power > 0 && fNorm > 0) {
            // Going downhill: mix velocity with force direction
            const alpha = state.alpha;
            const scale = vNorm / fNorm;
            for (let i = 0; i < count * 2; i++) {
                vel[i] = (1 - alpha) * vel[i] + alpha * scale * forces[i];
            }
            // Increase timestep if we've been going downhill for a while
            if (state.stepsSinceNegative > nMin) {
                state.dt = Math.min(state.dt * fInc, dtMax);
                state.alpha *= fAlpha;
            }
            state.stepsSinceNegative++;
        } else {
            // Going uphill or stalled: reset
            vel.fill(0);
            state.dt = Math.max(state.dt * fDec, dtMin);
            state.alpha = alphaStart;
            state.stepsSinceNegative = 0;
        }

        // Velocity Verlet integration
        const dt = state.dt;
        const physicsScale = 5.0;
        const effectiveWidth = width / physicsScale;
        const effectiveHeight = height / physicsScale;

        let maxForce = 0;
        for (let i = 0; i < count; i++) {
            const idx = i * 2;

            // Update velocities (half step)
            vel[idx] += 0.5 * forces[idx] * dt;
            vel[idx + 1] += 0.5 * forces[idx + 1] * dt;

            // Update positions
            positions[idx] += vel[idx] * dt;
            positions[idx + 1] += vel[idx + 1] * dt;

            // Keep within bounds
            positions[idx] = Math.max(baseParticleRadius, Math.min(effectiveWidth - baseParticleRadius, positions[idx]));
            positions[idx + 1] = Math.max(baseParticleRadius, Math.min(effectiveHeight - baseParticleRadius, positions[idx + 1]));

            // Track max force for convergence
            const fMag = Math.sqrt(forces[idx] * forces[idx] + forces[idx + 1] * forces[idx + 1]);
            if (fMag > maxForce) maxForce = fMag;
        }

        // Zero the main simulation velocities
        particleData.velocities.fill(0);

        // Return true if converged (forces are small)
        return maxForce < 0.01;
    }, [particleData, potentialManager, width, height, baseParticleRadius]);

    return {
        particleData,
        setParticleData,
        initializeParticles,
        calculateForces,
        velocityVerlet,
        minimizeStep,
        stepCount: displayStepCount,
    };
}
