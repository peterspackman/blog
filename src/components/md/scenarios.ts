import { BoundaryType } from './BoundaryConditions';
import { FieldPreset } from './VectorField';
import { ElectricFieldPreset } from './ElectricField';

export type SimulationScenario = 'custom' | 'argon' | 'nacl' | 'mixing';

export interface ParticleTypeConfig {
    label: string;      // e.g., "Na⁺", "Cl⁻", "Ar"
    color: string;      // CSS color string
}

export interface ScenarioConfig {
    name: string;
    description: string;
    numParticles: number;
    temperature: number;  // Kelvin
    orangeRatio: number;  // 1.0 = all type 0, 0.0 = all type 1, 0.5 = equal mix
    boundaryType: BoundaryType;
    fieldPreset: FieldPreset;
    eFieldPreset: ElectricFieldPreset;
    fieldStrength: number;
    eFieldStrength: number;
    initLayout: 'random' | 'separated-lr' | 'separated-tb' | 'center-cluster';
    // Particle type configuration
    particleTypes: ParticleTypeConfig[];
    // LJ parameters for each pair
    epsilonMatrix: number[][];  // eV - [type_i][type_j]
    sigmaMatrix: number[][];    // Å - [type_i][type_j]
    masses: number[];           // amu per type
    charges: number[];          // elementary charge per type
    chargeScale: number;        // Coulomb interaction multiplier (0 = off)
}

// Argon parameters
const AR_EPSILON = 0.0104;  // eV
const AR_SIGMA = 3.4;       // Å
const AR_MASS = 39.948;     // amu

// NaCl parameters - stronger LJ to prevent Coulomb collapse
// Based on Tosi-Fumi potential converted to effective LJ
const NA_EPSILON = 0.1;     // eV - strong repulsion to compete with Coulomb
const CL_EPSILON = 0.1;     // eV
const NA_CL_EPSILON = 0.15; // eV - stronger for unlike pairs (they attract via Coulomb)
const NA_SIGMA = 2.35;      // Å - Na+ ionic diameter
const CL_SIGMA = 3.50;      // Å - Cl- ionic diameter
const NA_MASS = 22.99;      // amu
const CL_MASS = 35.45;      // amu

export const SCENARIOS: Record<SimulationScenario, ScenarioConfig> = {
    custom: {
        name: 'Custom',
        description: 'Configure your own simulation',
        numParticles: 250,
        temperature: 1000,
        orangeRatio: 0.5,
        boundaryType: BoundaryType.PERIODIC,
        fieldPreset: 'none',
        eFieldPreset: 'none',
        fieldStrength: 50,
        eFieldStrength: 0,
        initLayout: 'random',
        particleTypes: [
            { label: 'Na⁺', color: 'rgba(255, 165, 0, 0.8)' },
            { label: 'Cl⁻', color: 'rgba(0, 100, 255, 0.8)' },
        ],
        epsilonMatrix: [
            [NA_EPSILON, NA_CL_EPSILON],
            [NA_CL_EPSILON, CL_EPSILON],
        ],
        sigmaMatrix: [
            [NA_SIGMA, (NA_SIGMA + CL_SIGMA) / 2],
            [(NA_SIGMA + CL_SIGMA) / 2, CL_SIGMA],
        ],
        masses: [NA_MASS, CL_MASS],
        charges: [1.0, -1.0],
        chargeScale: 1.0,
    },
    argon: {
        name: 'Argon',
        description: 'Liquid argon - single component LJ fluid',
        numParticles: 100,
        temperature: 90,  // K - just above triple point (84K)
        orangeRatio: 1.0, // All same type
        boundaryType: BoundaryType.PERIODIC,
        fieldPreset: 'none',
        eFieldPreset: 'none',
        fieldStrength: 50,
        eFieldStrength: 0,
        initLayout: 'random',
        particleTypes: [
            { label: 'Ar', color: 'rgba(128, 128, 255, 0.8)' },
            { label: 'Ar', color: 'rgba(128, 128, 255, 0.8)' },
        ],
        epsilonMatrix: [
            [AR_EPSILON, AR_EPSILON],
            [AR_EPSILON, AR_EPSILON],
        ],
        sigmaMatrix: [
            [AR_SIGMA, AR_SIGMA],
            [AR_SIGMA, AR_SIGMA],
        ],
        masses: [AR_MASS, AR_MASS],
        charges: [0, 0],
        chargeScale: 0,
    },
    nacl: {
        name: 'NaCl',
        description: 'Molten salt with Coulomb interactions',
        numParticles: 250,
        temperature: 1200,  // K - above melting point (1074K)
        orangeRatio: 0.5,   // Equal Na+ and Cl-
        boundaryType: BoundaryType.PERIODIC,
        fieldPreset: 'none',
        eFieldPreset: 'none',
        fieldStrength: 50,
        eFieldStrength: 0,
        initLayout: 'random',
        particleTypes: [
            { label: 'Na⁺', color: 'rgba(255, 165, 0, 0.8)' },
            { label: 'Cl⁻', color: 'rgba(0, 100, 255, 0.8)' },
        ],
        epsilonMatrix: [
            [NA_EPSILON, NA_CL_EPSILON],
            [NA_CL_EPSILON, CL_EPSILON],
        ],
        sigmaMatrix: [
            [NA_SIGMA, (NA_SIGMA + CL_SIGMA) / 2],
            [(NA_SIGMA + CL_SIGMA) / 2, CL_SIGMA],
        ],
        masses: [NA_MASS, CL_MASS],
        charges: [1.0, -1.0],  // Na+ and Cl-
        chargeScale: 1.0,
    },
    mixing: {
        name: 'Mixing',
        description: 'Two separated fluids diffusing',
        numParticles: 120,
        temperature: 150,
        orangeRatio: 0.5,
        boundaryType: BoundaryType.PERIODIC,
        fieldPreset: 'none',
        eFieldPreset: 'none',
        fieldStrength: 50,
        eFieldStrength: 0,
        initLayout: 'separated-lr',
        particleTypes: [
            { label: 'A', color: 'rgba(255, 100, 100, 0.8)' },
            { label: 'B', color: 'rgba(100, 100, 255, 0.8)' },
        ],
        epsilonMatrix: [
            [AR_EPSILON, AR_EPSILON * 0.7],  // Weaker cross-interaction promotes mixing
            [AR_EPSILON * 0.7, AR_EPSILON],
        ],
        sigmaMatrix: [
            [AR_SIGMA, AR_SIGMA],
            [AR_SIGMA, AR_SIGMA],
        ],
        masses: [AR_MASS, AR_MASS],
        charges: [0, 0],
        chargeScale: 0,
    },
};
