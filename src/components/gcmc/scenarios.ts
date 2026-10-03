import { ExternalPotentialType } from './ExternalPotentials';
import { MoveWeights } from './MCEngine';
import { InitLayout } from './GCMCParticleData';
import { ARGON, SODIUM_ION, CHLORIDE_ION } from '../md/constants';

export type GCMCScenario = 'custom' | 'lj-fluid' | 'adsorption' | 'slit-pore' | 'zeolite' | 'binary-mixture' | 'charged-surface' | 'ion-migration';

export interface ParticleTypeConfig {
    label: string;
    /** Index into the --viz-series palette (theme.series). */
    colorSlot: number;
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
        description: 'A single-component gas exchanging particles with a reservoir; pick any external potential.',
        initLayout: 'empty',
        temperature: 300,
        pressures: [100],
        particleTypes: [
            { label: 'Ar', colorSlot: 0 },
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
        name: 'LJ fluid',
        description: 'Lennard-Jones fluid below the 2D critical temperature (≈55 K): raise the pressure to see droplets form.',
        initLayout: 'empty',
        temperature: 50,
        pressures: [3000],
        particleTypes: [
            { label: 'Ar', colorSlot: 0 },
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
        name: 'Cylindrical pore',
        description: 'Gas adsorbing into a cylindrical pore with attractive walls.',
        initLayout: 'empty',
        temperature: 300,
        pressures: [100],
        particleTypes: [
            { label: 'Ar', colorSlot: 0 },
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
    'slit-pore': {
        name: 'Slit pore',
        description: 'Below the critical temperature, attractive walls make the pore fill with liquid at a pressure where the open fluid is still a gas (capillary condensation).',
        initLayout: 'empty',
        temperature: 50,
        pressures: [300],
        particleTypes: [
            { label: 'Ar', colorSlot: 0 },
        ],
        epsilonMatrix: [[ARGON.epsilon]],
        sigmaMatrix: [[ARGON.sigma]],
        masses: [ARGON.mass],
        charges: [0],
        chargeScale: 0,
        maxDisplacement: 1.0,
        moveWeights: { displacement: 0.5, insertion: 0.25, deletion: 0.25 },
        cutoffRadius: 10.0,
        externalPotential: 'slit-pore',
        externalPotentialParams: { wallEpsilon: 0.03, wallSigma: 3.0, poreWidthFraction: 0.5 },
        typeRatio: 1.0,
    },
    zeolite: {
        name: 'Zeolite',
        description: 'Gas adsorbing into a framework of cages joined by narrow channels. The channels fill first: there both walls attract.',
        initLayout: 'empty',
        temperature: 90,
        pressures: [400],
        particleTypes: [
            { label: 'Ar', colorSlot: 0 },
        ],
        epsilonMatrix: [[ARGON.epsilon]],
        sigmaMatrix: [[ARGON.sigma]],
        masses: [ARGON.mass],
        charges: [0],
        chargeScale: 0,
        maxDisplacement: 1.0,
        moveWeights: { displacement: 0.5, insertion: 0.25, deletion: 0.25 },
        cutoffRadius: 10.0,
        externalPotential: 'zeolite',
        externalPotentialParams: { wallEpsilon: 0.025, wallSigma: 2.5 },
        typeRatio: 1.0,
    },
    'binary-mixture': {
        name: 'Binary mixture',
        description: 'Two gases with separate reservoir pressures; the stickier krypton is enriched.',
        initLayout: 'empty',
        temperature: 300,
        pressures: [100, 100],
        particleTypes: [
            { label: 'Ar', colorSlot: 1 },
            { label: 'Kr', colorSlot: 0 },
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
        name: 'Charged surface',
        description: 'Ions near a charged surface in implicit solvent (water, ε≈80)',
        initLayout: 'empty',
        temperature: 300,
        pressures: [20, 20],
        particleTypes: [
            { label: 'Na\u207A', colorSlot: 1 },
            { label: 'Cl\u207B', colorSlot: 0 },
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
        name: 'Ion migration',
        description: 'A fixed number of ions in a potential gradient; flip the charge to reverse the drift.',
        initLayout: 'random',
        temperature: 300,
        pressures: [100],
        particleTypes: [
            { label: 'Ion', colorSlot: 1 },
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
