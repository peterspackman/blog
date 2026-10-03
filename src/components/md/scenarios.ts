import { BoundaryType } from './BoundaryConditions';
import { FieldPreset } from './VectorField';
import { ElectricFieldPreset } from './ElectricField';
import { ThermostatType } from './Thermostats';

export type SimulationScenario = 'custom' | 'argon' | 'condensation' | 'nacl' | 'ion-field' | 'mixing';

export interface ParticleTypeConfig {
    label: string;      // e.g., "Na⁺", "Cl⁻", "Ar"
    /** Index into the --viz-series palette (theme.series). */
    colorSlot: number;
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
    thermostat?: ThermostatType; // default: Langevin
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
        description: 'Start from a molten salt and change anything, including drawing your own potential.',
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
            { label: 'Na⁺', colorSlot: 1 },
            { label: 'Cl⁻', colorSlot: 0 },
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
        description: 'Argon just above its triple point: a single-component Lennard-Jones fluid.',
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
            { label: 'Ar', colorSlot: 0 },
            { label: 'Ar', colorSlot: 0 },
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
    condensation: {
        name: 'Condensation',
        description: 'Argon gas cooled well below its critical temperature (≈55 K in 2D) condenses into droplets.',
        numParticles: 160,
        temperature: 35,
        orangeRatio: 1.0,
        boundaryType: BoundaryType.PERIODIC,
        fieldPreset: 'none',
        eFieldPreset: 'none',
        fieldStrength: 50,
        eFieldStrength: 0,
        initLayout: 'random',
        particleTypes: [
            { label: 'Ar', colorSlot: 0 },
            { label: 'Ar', colorSlot: 0 },
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
        thermostat: ThermostatType.LANGEVIN,
    },
    nacl: {
        name: 'NaCl',
        description: 'Molten sodium chloride: Coulomb forces order the ions into alternating shells (see g(r)).',
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
            { label: 'Na⁺', colorSlot: 1 },
            { label: 'Cl⁻', colorSlot: 0 },
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
    'ion-field': {
        name: 'Ions in a field',
        description: 'A uniform electric field pushes cations right and anions left; walls stop them, so charge separates.',
        numParticles: 120,
        temperature: 1500,
        orangeRatio: 0.5,
        boundaryType: BoundaryType.REFLECTIVE,
        fieldPreset: 'none',
        eFieldPreset: 'uniform-right',
        fieldStrength: 50,
        eFieldStrength: 40,
        initLayout: 'random',
        particleTypes: [
            { label: 'Na⁺', colorSlot: 1 },
            { label: 'Cl⁻', colorSlot: 0 },
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
        // Screened (as if in a solvent) so the field can pull ion pairs apart.
        chargeScale: 0.15,
    },
    mixing: {
        name: 'Mixing',
        description: 'Two fluids start side by side and diffuse into each other.',
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
            { label: 'A', colorSlot: 1 },
            { label: 'B', colorSlot: 0 },
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
