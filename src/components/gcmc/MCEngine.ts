/**
 * Core Grand Canonical Monte Carlo engine.
 *
 * Stores chemical potential mu (eV) per particle type. Computes the activity
 * z = exp(beta*mu) / Lambda^2 internally using the current temperature and mass,
 * so z updates automatically when T changes.
 *
 * Acceptance criteria (2D):
 *   Displacement: min(1, exp(-beta * deltaU))
 *   Insertion:    min(1, z * V / (N+1) * exp(-beta * deltaU_insert))
 *   Deletion:     min(1, N / (z * V) * exp(beta * E_particle))
 */

import { GCMCParticleData, insertParticle, deleteParticle } from './GCMCParticleData';
import { ExternalPotential } from './ExternalPotentials';
import { BOLTZMANN_CONSTANT } from '../md/constants';

export type TrialMoveType = 'displacement' | 'insertion' | 'deletion';

export interface MCTrialResult {
    type: TrialMoveType;
    accepted: boolean;
    particleIndex: number;
    energyChange: number;
    position: [number, number];
    particleType: number;
}

export interface MoveWeights {
    displacement: number;
    insertion: number;
    deletion: number;
}

export interface MCEngineConfig {
    temperature: number;           // K
    chemicalPotentials: number[];  // mu per type (eV)
    maxDisplacement: number;       // Angstroms
    boxWidth: number;              // Angstroms
    boxHeight: number;             // Angstroms
    moveWeights: MoveWeights;
    masses: number[];              // amu per type
    cutoffRadius: number;          // Angstroms
}

// Planck constant in eV*fs
const PLANCK_CONSTANT_EVFS = 4.135667696e-3;
// 1 amu = 1.03642698e-4 eV*fs^2/A^2
const AMU_TO_EVFS2A2 = 1.03642698e-4;

export class MCEngine {
    private config: MCEngineConfig;
    private potential: { calculate(r: number, type1: number, type2: number): { potential: number } };
    private externalPotential: ExternalPotential | null;

    private stats: Record<TrialMoveType, { attempted: number; accepted: number }>;
    private totalStats: Record<TrialMoveType, { attempted: number; accepted: number }>;

    private displacementTuneInterval = 100;
    private displacementTuneTarget = 0.4;

    constructor(
        config: MCEngineConfig,
        potential: { calculate(r: number, type1: number, type2: number): { potential: number } },
        externalPotential: ExternalPotential | null = null
    ) {
        this.config = { ...config };
        this.potential = potential;
        this.externalPotential = externalPotential;

        this.stats = {
            displacement: { attempted: 0, accepted: 0 },
            insertion: { attempted: 0, accepted: 0 },
            deletion: { attempted: 0, accepted: 0 },
        };
        this.totalStats = {
            displacement: { attempted: 0, accepted: 0 },
            insertion: { attempted: 0, accepted: 0 },
            deletion: { attempted: 0, accepted: 0 },
        };
    }

    updateConfig(updates: Partial<MCEngineConfig>): void {
        Object.assign(this.config, updates);
    }

    updatePotential(potential: typeof this.potential): void {
        this.potential = potential;
    }

    updateExternalPotential(ext: ExternalPotential | null): void {
        this.externalPotential = ext;
    }

    /**
     * Compute activity z = exp(beta*mu) / Lambda^2 for a given type.
     * Lambda^2 = h^2 / (2*pi*m*kBT) in Å².
     * z has units 1/Å²; for ideal gas <N> = z * Area.
     */
    private computeActivity(type: number): number {
        const kBT = BOLTZMANN_CONSTANT * this.config.temperature;
        const mu = this.config.chemicalPotentials[type];
        const m = this.config.masses[type] * AMU_TO_EVFS2A2;
        const lambda2 = (PLANCK_CONSTANT_EVFS * PLANCK_CONSTANT_EVFS) / (2 * Math.PI * m * kBT);
        return Math.exp(mu / kBT) / lambda2;
    }

    /**
     * Calculate energy of a single particle with all others. O(N) scan.
     */
    private singleParticleEnergy(
        data: GCMCParticleData,
        index: number,
        px: number,
        py: number,
        ptype: number
    ): number {
        let energy = 0;
        const { boxWidth, boxHeight, cutoffRadius } = this.config;
        const halfW = boxWidth / 2;
        const halfH = boxHeight / 2;

        for (let j = 0; j < data.count; j++) {
            if (j === index) continue;

            let dx = data.positions[j * 2] - px;
            let dy = data.positions[j * 2 + 1] - py;

            if (dx > halfW) dx -= boxWidth;
            else if (dx < -halfW) dx += boxWidth;
            if (dy > halfH) dy -= boxHeight;
            else if (dy < -halfH) dy += boxHeight;

            const rSq = dx * dx + dy * dy;
            if (rSq > cutoffRadius * cutoffRadius) continue;
            const r = Math.sqrt(rSq);
            if (r < 0.01) {
                // Essentially on top of each other → huge repulsion
                return 1e10;
            }
            energy += this.potential.calculate(r, ptype, data.types[j]).potential;
        }

        if (this.externalPotential) {
            energy += this.externalPotential.calculate(px, py, ptype);
        }

        return energy;
    }

    private pickMoveType(): TrialMoveType {
        const { displacement, insertion, deletion } = this.config.moveWeights;
        const total = displacement + insertion + deletion;
        const r = Math.random() * total;
        if (r < displacement) return 'displacement';
        if (r < displacement + insertion) return 'insertion';
        return 'deletion';
    }

    private pickInsertionType(): number {
        return Math.floor(Math.random() * this.config.chemicalPotentials.length);
    }

    private tryDisplacement(data: GCMCParticleData): MCTrialResult {
        const N = data.count;
        if (N === 0) {
            return { type: 'displacement', accepted: false, particleIndex: -1, energyChange: 0, position: [0, 0], particleType: 0 };
        }

        const idx = Math.floor(Math.random() * N);
        const oldX = data.positions[idx * 2];
        const oldY = data.positions[idx * 2 + 1];
        const ptype = data.types[idx];

        const energyBefore = this.singleParticleEnergy(data, idx, oldX, oldY, ptype);

        const dx = (Math.random() - 0.5) * 2 * this.config.maxDisplacement;
        const dy = (Math.random() - 0.5) * 2 * this.config.maxDisplacement;
        const { boxWidth, boxHeight } = this.config;
        const newX = ((oldX + dx) % boxWidth + boxWidth) % boxWidth;
        const newY = ((oldY + dy) % boxHeight + boxHeight) % boxHeight;

        data.positions[idx * 2] = newX;
        data.positions[idx * 2 + 1] = newY;
        const energyAfter = this.singleParticleEnergy(data, idx, newX, newY, ptype);

        const deltaE = energyAfter - energyBefore;
        const kBT = BOLTZMANN_CONSTANT * this.config.temperature;
        const accepted = deltaE <= 0 || Math.random() < Math.exp(-deltaE / kBT);

        if (!accepted) {
            data.positions[idx * 2] = oldX;
            data.positions[idx * 2 + 1] = oldY;
        }

        return {
            type: 'displacement',
            accepted,
            particleIndex: idx,
            energyChange: accepted ? deltaE : 0,
            position: [accepted ? newX : oldX, accepted ? newY : oldY],
            particleType: ptype,
        };
    }

    private tryInsertion(data: GCMCParticleData): MCTrialResult {
        const { boxWidth, boxHeight } = this.config;
        const type = this.pickInsertionType();
        const x = Math.random() * boxWidth;
        const y = Math.random() * boxHeight;
        const mass = this.config.masses[type];

        const trialEnergy = this.singleParticleEnergy(data, data.count, x, y, type);

        const N = data.count;
        const V = boxWidth * boxHeight;
        const kBT = BOLTZMANN_CONSTANT * this.config.temperature;
        const z = this.computeActivity(type);

        const arg = (z * V / (N + 1)) * Math.exp(-trialEnergy / kBT);
        const accepted = Math.random() < Math.min(1, arg);

        if (accepted) {
            insertParticle(data, x, y, type, mass);
        }

        return {
            type: 'insertion',
            accepted,
            particleIndex: accepted ? data.count - 1 : -1,
            energyChange: accepted ? trialEnergy : 0,
            position: [x, y],
            particleType: type,
        };
    }

    private tryDeletion(data: GCMCParticleData): MCTrialResult {
        const N = data.count;
        if (N === 0) {
            return { type: 'deletion', accepted: false, particleIndex: -1, energyChange: 0, position: [0, 0], particleType: 0 };
        }

        const idx = Math.floor(Math.random() * N);
        const x = data.positions[idx * 2];
        const y = data.positions[idx * 2 + 1];
        const type = data.types[idx];

        const particleEnergy = this.singleParticleEnergy(data, idx, x, y, type);

        const V = this.config.boxWidth * this.config.boxHeight;
        const kBT = BOLTZMANN_CONSTANT * this.config.temperature;
        const z = this.computeActivity(type);

        const arg = (N / (z * V)) * Math.exp(particleEnergy / kBT);
        const accepted = Math.random() < Math.min(1, arg);

        if (accepted) {
            deleteParticle(data, idx);
        }

        return {
            type: 'deletion',
            accepted,
            particleIndex: accepted ? -1 : idx,
            energyChange: accepted ? -particleEnergy : 0,
            position: [x, y],
            particleType: type,
        };
    }

    step(data: GCMCParticleData): MCTrialResult {
        const moveType = this.pickMoveType();
        let result: MCTrialResult;

        switch (moveType) {
            case 'displacement':
                result = this.tryDisplacement(data);
                break;
            case 'insertion':
                result = this.tryInsertion(data);
                break;
            case 'deletion':
                result = this.tryDeletion(data);
                break;
        }

        this.stats[moveType].attempted++;
        this.totalStats[moveType].attempted++;
        if (result.accepted) {
            this.stats[moveType].accepted++;
            this.totalStats[moveType].accepted++;
        }

        if (moveType === 'displacement' &&
            this.stats.displacement.attempted % this.displacementTuneInterval === 0) {
            this.autoTuneDisplacement();
        }

        return result;
    }

    private autoTuneDisplacement(): void {
        const { attempted, accepted } = this.stats.displacement;
        if (attempted < 10) return;

        const rate = accepted / attempted;
        if (rate > this.displacementTuneTarget + 0.05) {
            this.config.maxDisplacement *= 1.05;
        } else if (rate < this.displacementTuneTarget - 0.05) {
            this.config.maxDisplacement *= 0.95;
        }
        this.config.maxDisplacement = Math.max(0.1, Math.min(this.config.boxWidth / 4, this.config.maxDisplacement));
    }

    getAcceptanceRates(): Record<TrialMoveType, number> {
        const rates: Record<TrialMoveType, number> = { displacement: 0, insertion: 0, deletion: 0 };
        for (const type of ['displacement', 'insertion', 'deletion'] as TrialMoveType[]) {
            const { attempted, accepted } = this.totalStats[type];
            rates[type] = attempted > 0 ? accepted / attempted : 0;
        }
        return rates;
    }

    getRecentAcceptanceRates(): Record<TrialMoveType, number> {
        const rates: Record<TrialMoveType, number> = { displacement: 0, insertion: 0, deletion: 0 };
        for (const type of ['displacement', 'insertion', 'deletion'] as TrialMoveType[]) {
            const { attempted, accepted } = this.stats[type];
            rates[type] = attempted > 0 ? accepted / attempted : 0;
        }
        return rates;
    }

    resetStats(): void {
        for (const type of ['displacement', 'insertion', 'deletion'] as TrialMoveType[]) {
            this.stats[type] = { attempted: 0, accepted: 0 };
            this.totalStats[type] = { attempted: 0, accepted: 0 };
        }
    }

    getMaxDisplacement(): number {
        return this.config.maxDisplacement;
    }
}
