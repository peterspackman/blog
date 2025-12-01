/**
 * Physical constants and unit conversions for molecular dynamics
 *
 * Base units:
 * - Length: Angstroms (Å)
 * - Energy: electron volts (eV)
 * - Temperature: Kelvin (K)
 * - Mass: atomic mass units (amu)
 * - Time: femtoseconds (fs) - derived unit for convenience
 * - Charge: elementary charge (e)
 */

// Fundamental constants
export const BOLTZMANN_CONSTANT = 8.617333262e-5;  // eV/K
export const COULOMB_CONSTANT = 14.3996;           // eV·Å/e² (1/(4πε₀) in these units)

// Time unit: 1 time unit = sqrt(amu·Å²/eV) ≈ 10.18 fs
// This is natural for MD where we have m in amu, distances in Å, energies in eV
export const TIME_UNIT_TO_FS = 10.1805;            // fs per internal time unit

// Argon parameters (commonly used noble gas for MD testing)
export const ARGON = {
    mass: 39.948,           // amu
    epsilon: 0.0104,        // eV (LJ well depth)
    sigma: 3.4,             // Å (LJ size parameter)
    meltingPoint: 83.8,     // K
    boilingPoint: 87.3,     // K
    triplePoint: 83.8,      // K
    criticalPoint: 150.87,  // K
};

// Krypton parameters
export const KRYPTON = {
    mass: 83.798,
    epsilon: 0.0140,        // eV
    sigma: 3.6,             // Å
};

// Lithium ion (for battery simulations)
export const LITHIUM_ION = {
    mass: 6.941,            // amu
    charge: 1.0,            // e
    ionicRadius: 0.76,      // Å
};

// Sodium ion
export const SODIUM_ION = {
    mass: 22.990,
    charge: 1.0,
    ionicRadius: 1.02,      // Å
};

// Chloride ion
export const CHLORIDE_ION = {
    mass: 35.453,
    charge: -1.0,
    ionicRadius: 1.81,      // Å
};

/**
 * Convert reduced temperature (T* = kB*T/epsilon) to Kelvin
 */
export function reducedToKelvin(Tstar: number, epsilon: number): number {
    return Tstar * epsilon / BOLTZMANN_CONSTANT;
}

/**
 * Convert Kelvin to reduced temperature
 */
export function kelvinToReduced(T: number, epsilon: number): number {
    return T * BOLTZMANN_CONSTANT / epsilon;
}

/**
 * Calculate thermal velocity scale: sqrt(kB*T/m)
 * This gives characteristic velocity in Å/time_unit
 */
export function thermalVelocity(temperatureK: number, massAmu: number): number {
    return Math.sqrt(BOLTZMANN_CONSTANT * temperatureK / massAmu);
}

/**
 * Lorentz-Berthelot mixing rules for LJ parameters
 */
export function mixingRules(
    epsilon1: number, sigma1: number,
    epsilon2: number, sigma2: number
): { epsilon: number; sigma: number } {
    return {
        epsilon: Math.sqrt(epsilon1 * epsilon2),  // Geometric mean
        sigma: (sigma1 + sigma2) / 2,             // Arithmetic mean
    };
}

/**
 * Create epsilon matrix for multiple particle types using mixing rules
 */
export function createEpsilonMatrix(epsilons: number[]): number[][] {
    const n = epsilons.length;
    const matrix: number[][] = [];
    for (let i = 0; i < n; i++) {
        matrix[i] = [];
        for (let j = 0; j < n; j++) {
            matrix[i][j] = Math.sqrt(epsilons[i] * epsilons[j]);
        }
    }
    return matrix;
}

/**
 * Create sigma matrix for multiple particle types using mixing rules
 */
export function createSigmaMatrix(sigmas: number[]): number[][] {
    const n = sigmas.length;
    const matrix: number[][] = [];
    for (let i = 0; i < n; i++) {
        matrix[i] = [];
        for (let j = 0; j < n; j++) {
            matrix[i][j] = (sigmas[i] + sigmas[j]) / 2;
        }
    }
    return matrix;
}

// Preset configurations for common simulations
export const PRESETS = {
    // Liquid argon at ~84K (near triple point)
    liquidArgon: {
        epsilon: [[ARGON.epsilon]],
        sigma: [[ARGON.sigma]],
        masses: [ARGON.mass],
        charges: [0],
        temperature: 84,  // K
        density: 0.021,   // atoms/Å³ (experimental liquid density)
    },

    // Gaseous argon at ~300K
    gaseousArgon: {
        epsilon: [[ARGON.epsilon]],
        sigma: [[ARGON.sigma]],
        masses: [ARGON.mass],
        charges: [0],
        temperature: 300, // K
        density: 0.001,   // atoms/Å³
    },

    // NaCl-like ionic system (simplified)
    ionicSalt: {
        epsilon: [
            [0.005, 0.007],  // Na-Na, Na-Cl (eV)
            [0.007, 0.010],  // Cl-Na, Cl-Cl
        ],
        sigma: [
            [2.0, 2.8],      // Å
            [2.8, 3.6],
        ],
        masses: [SODIUM_ION.mass, CHLORIDE_ION.mass],
        charges: [SODIUM_ION.charge, CHLORIDE_ION.charge],
        temperature: 300,
    },
};
