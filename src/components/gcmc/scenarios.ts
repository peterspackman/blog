import { ExternalPotentialType } from './ExternalPotentials';
import { MoveWeights } from './MCEngine';
import { InitLayout } from './GCMCParticleData';
import { ARGON, SODIUM_ION, CHLORIDE_ION } from '../md/constants';

export type GCMCScenario = 'custom' | 'lj-fluid' | 'adsorption' | 'binary-mixture' | 'charged-surface' | 'ion-migration';

export interface ParticleTypeConfig {
    label: string;
    color: string;
}

export interface GCMCScenarioConfig {
    name: string;
    description: string;
    initLayout: InitLayout;
    temperature: number;
    pressures: number[];            // kPa per type
    particleTypes: ParticleTypeConfig[];
    epsilonMatrix: number[][];
    sigmaMatrix: number[][];
    masses: number[];
    charges: number[];              // elementary charge per type (0 = neutral)
    chargeScale: number;            // Coulomb interaction multiplier (0 = off)
    maxDisplacement: number;
    moveWeights: MoveWeights;
    cutoffRadius: number;
    externalPotential: ExternalPotentialType;
    externalPotentialParams: Record<string, number>;
    typeRatio: number;
}

// Krypton for binary mixture
const KR_EPSILON = 0.0140;
const KR_SIGMA = 3.6;
const KR_MASS = 83.798;

// Na+/Cl- ionic parameters
const NA_EPSILON = 0.1;
const CL_EPSILON = 0.1;
const NA_CL_EPSILON = 0.15;
const NA_SIGMA = 2.35;
const CL_SIGMA = 3.50;

export const GCMC_SCENARIOS: Record<GCMCScenario, GCMCScenarioConfig> = {
    custom: {
        name: 'Custom',
        description: 'Configure your own GCMC simulation',
        initLayout: 'empty',
        temperature: 300,
        pressures: [100],
        particleTypes: [
            { label: 'Ar', color: 'rgba(128, 128, 255, 0.8)' },
        ],
        epsilonMatrix: [[ARGON.epsilon]],
        sigmaMatrix: [[ARGON.sigma]],
        masses: [ARGON.mass],
        charges: [0],
        chargeScale: 0,
        maxDisplacement: 1.0,
        moveWeights: { displacement: 0.6, insertion: 0.2, deletion: 0.2 },
        cutoffRadius: 10.0,
        externalPotential: 'none',
        externalPotentialParams: {},
        typeRatio: 1.0,
    },
    'lj-fluid': {
        name: 'LJ Fluid',
        description: 'Lennard-Jones fluid below 2D Tc (~60 K) -- increase pressure to see droplet formation',
        initLayout: 'empty',
        temperature: 50,
        pressures: [3000],
        particleTypes: [
            { label: 'Ar', color: 'rgba(128, 128, 255, 0.8)' },
        ],
        epsilonMatrix: [[ARGON.epsilon]],
        sigmaMatrix: [[ARGON.sigma]],
        masses: [ARGON.mass],
        charges: [0],
        chargeScale: 0,
        maxDisplacement: 1.0,
        moveWeights: { displacement: 0.6, insertion: 0.2, deletion: 0.2 },
        cutoffRadius: 10.0,
        externalPotential: 'none',
        externalPotentialParams: {},
        typeRatio: 1.0,
    },
    adsorption: {
        name: 'Adsorption',
        description: 'Particles adsorbing into a cylindrical pore',
        initLayout: 'empty',
        temperature: 300,
        pressures: [100],
        particleTypes: [
            { label: 'Ar', color: 'rgba(100, 180, 255, 0.8)' },
        ],
        epsilonMatrix: [[ARGON.epsilon]],
        sigmaMatrix: [[ARGON.sigma]],
        masses: [ARGON.mass],
        charges: [0],
        chargeScale: 0,
        maxDisplacement: 1.0,
        moveWeights: { displacement: 0.5, insertion: 0.25, deletion: 0.25 },
        cutoffRadius: 10.0,
        externalPotential: 'cylindrical-pore',
        externalPotentialParams: { wallEpsilon: 0.03, wallSigma: 3.0 },
        typeRatio: 1.0,
    },
    'binary-mixture': {
        name: 'Binary Mixture',
        description: 'Two-component mixture with independent pressures',
        initLayout: 'empty',
        temperature: 300,
        pressures: [100, 100],
        particleTypes: [
            { label: 'Ar', color: 'rgba(255, 140, 100, 0.8)' },
            { label: 'Kr', color: 'rgba(100, 180, 255, 0.8)' },
        ],
        epsilonMatrix: [
            [ARGON.epsilon, Math.sqrt(ARGON.epsilon * KR_EPSILON)],
            [Math.sqrt(ARGON.epsilon * KR_EPSILON), KR_EPSILON],
        ],
        sigmaMatrix: [
            [ARGON.sigma, (ARGON.sigma + KR_SIGMA) / 2],
            [(ARGON.sigma + KR_SIGMA) / 2, KR_SIGMA],
        ],
        masses: [ARGON.mass, KR_MASS],
        charges: [0, 0],
        chargeScale: 0,
        maxDisplacement: 1.0,
        moveWeights: { displacement: 0.5, insertion: 0.25, deletion: 0.25 },
        cutoffRadius: 10.0,
        externalPotential: 'none',
        externalPotentialParams: {},
        typeRatio: 0.5,
    },
    'charged-surface': {
        name: 'Charged Surface',
        description: 'Ions near a charged surface in implicit solvent (water, ε≈80)',
        initLayout: 'empty',
        temperature: 300,
        pressures: [20, 20],
        particleTypes: [
            { label: 'Na\u207A', color: 'rgba(255, 165, 0, 0.8)' },
            { label: 'Cl\u207B', color: 'rgba(0, 100, 255, 0.8)' },
        ],
        epsilonMatrix: [
            [NA_EPSILON, NA_CL_EPSILON],
            [NA_CL_EPSILON, CL_EPSILON],
        ],
        sigmaMatrix: [
            [NA_SIGMA, (NA_SIGMA + CL_SIGMA) / 2],
            [(NA_SIGMA + CL_SIGMA) / 2, CL_SIGMA],
        ],
        masses: [SODIUM_ION.mass, CHLORIDE_ION.mass],
        charges: [1.0, -1.0],
        chargeScale: 0.0125,
        maxDisplacement: 1.0,
        moveWeights: { displacement: 0.5, insertion: 0.25, deletion: 0.25 },
        cutoffRadius: 15.0,
        externalPotential: 'charged-surface',
        externalPotentialParams: { surfaceChargeDensity: 0.02, wallSigma: 2.5 },
        typeRatio: 0.5,
    },
    'ion-migration': {
        name: 'Ion Migration',
        description: 'Ions in an electric potential -- change charge sign to reverse drift direction',
        initLayout: 'random',
        temperature: 300,
        pressures: [100],
        particleTypes: [
            { label: 'Ion', color: 'rgba(255, 165, 0, 0.9)' },
        ],
        epsilonMatrix: [[0.05]],
        sigmaMatrix: [[5.0]],
        masses: [SODIUM_ION.mass],
        charges: [1.0],
        chargeScale: 0,
        maxDisplacement: 2.0,
        moveWeights: { displacement: 1.0, insertion: 0, deletion: 0 },
        cutoffRadius: 12.0,
        externalPotential: 'potential-gradient',
        externalPotentialParams: { depth: 0.4 },
        typeRatio: 1.0,
    },
};
