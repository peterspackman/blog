/**
 * Physics utilities for 1D quantum mechanics visualization
 *
 * Uses coherent dimensionless time units:
 * - tau = E_0 * t / hbar (dimensionless time)
 * - tau = 2*pi corresponds to one ground state oscillation period
 * - Displayed as "T_0" (ground state periods)
 */

export type PotentialType = 'harmonic' | 'infinite_well';

export interface PotentialConfig {
    type: PotentialType;
    xMin: number;
    xMax: number;
}

// Hermite polynomials for harmonic oscillator (up to n=7)
const hermitePolynomials: ((x: number) => number)[] = [
    (x) => 1,
    (x) => 2 * x,
    (x) => 4 * x * x - 2,
    (x) => 8 * x * x * x - 12 * x,
    (x) => 16 * Math.pow(x, 4) - 48 * x * x + 12,
    (x) => 32 * Math.pow(x, 5) - 160 * Math.pow(x, 3) + 120 * x,
    (x) => 64 * Math.pow(x, 6) - 480 * Math.pow(x, 4) + 720 * x * x - 120,
    (x) => 128 * Math.pow(x, 7) - 1344 * Math.pow(x, 5) + 3360 * Math.pow(x, 3) - 1680 * x,
];

function factorial(n: number): number {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

/**
 * Get the dimensionless energy for state n
 * Returns E_n in units where ground state energy ratios are simple
 */
export function getEnergy(n: number, config: PotentialConfig): number {
    switch (config.type) {
        case 'harmonic':
            // E_n = (n + 1/2) in units of hbar*omega
            return n + 0.5;
        case 'infinite_well': {
            // E_n = (n+1)^2 * pi^2 / (2 * L^2) in atomic units
            // We normalize so E_0 is comparable to harmonic
            const L = config.xMax - config.xMin;
            const nWell = n + 1; // quantum number starts at 1
            return (nWell * nWell * Math.PI * Math.PI) / (2 * L * L);
        }
        default:
            return n + 0.5;
    }
}

/**
 * Get the ground state energy for normalization
 */
export function getGroundStateEnergy(config: PotentialConfig): number {
    return getEnergy(0, config);
}

/**
 * Get the energy ratio E_n / E_0 for phase calculations
 * This is what determines relative rotation speeds in the phasor diagram
 */
export function getEnergyRatio(n: number, config: PotentialConfig): number {
    const E_n = getEnergy(n, config);
    const E_0 = getGroundStateEnergy(config);
    return E_n / E_0;
}

/**
 * Format dimensionless time as ground state periods
 * tau = 2*pi corresponds to T_0 = 1
 */
export function formatTime(tau: number): string {
    const periods = tau / (2 * Math.PI);
    if (periods < 0.01) {
        return `${periods.toExponential(1)} T\u2080`;
    }
    return `${periods.toFixed(2)} T\u2080`;
}

/**
 * Get the time-independent wavefunction psi_n(x)
 */
export function psi(x: number, n: number, config: PotentialConfig): number {
    switch (config.type) {
        case 'harmonic':
            return psiHarmonic(x, n);
        case 'infinite_well':
            return psiInfiniteWell(x, n, config);
        default:
            return psiHarmonic(x, n);
    }
}

/**
 * Harmonic oscillator wavefunction
 */
function psiHarmonic(x: number, n: number): number {
    if (n >= hermitePolynomials.length) return 0;
    const prefactor = 1.0 / Math.sqrt(Math.pow(2, n) * factorial(n) * Math.sqrt(Math.PI));
    return prefactor * hermitePolynomials[n](x) * Math.exp(-x * x / 2);
}

/**
 * Infinite square well (particle in a box) wavefunction
 */
function psiInfiniteWell(x: number, n: number, config: PotentialConfig): number {
    const L = config.xMax - config.xMin;
    const xNormalized = (x - config.xMin) / L;

    // Outside the well, wavefunction is zero
    if (xNormalized < 0 || xNormalized > 1) {
        return 0;
    }

    // Quantum number for infinite well (n=0 in our indexing -> n=1 in traditional)
    const nWell = n + 1;
    return Math.sqrt(2 / L) * Math.sin(nWell * Math.PI * xNormalized);
}

/**
 * Get the time-dependent wavefunction psi_n(x, tau)
 * tau is dimensionless time (tau = E_0 * t / hbar)
 */
export function psiT(
    x: number,
    n: number,
    tau: number,
    config: PotentialConfig
): { real: number; imag: number; phase: number } {
    const staticPsi = psi(x, n, config);
    const energyRatio = getEnergyRatio(n, config);

    // Phase evolution: exp(-i * E_n * t / hbar) = exp(-i * energyRatio * tau)
    const phase = -energyRatio * tau;

    return {
        real: staticPsi * Math.cos(phase),
        imag: staticPsi * Math.sin(phase),
        phase,
    };
}

/**
 * Calculate superposition of multiple states
 */
export function superpositionPsiT(
    x: number,
    states: number[],
    tau: number,
    config: PotentialConfig
): { real: number; imag: number; prob: number } {
    if (states.length === 0) {
        return { real: 0, imag: 0, prob: 0 };
    }

    // Equal weight normalization
    const normalization = 1 / Math.sqrt(states.length);

    let realSum = 0;
    let imagSum = 0;

    for (const n of states) {
        const wave = psiT(x, n, tau, config);
        realSum += wave.real * normalization;
        imagSum += wave.imag * normalization;
    }

    return {
        real: realSum,
        imag: imagSum,
        prob: realSum * realSum + imagSum * imagSum,
    };
}

/**
 * Get the potential energy V(x)
 */
export function potential(x: number, config: PotentialConfig): number {
    switch (config.type) {
        case 'harmonic':
            return 0.5 * x * x;
        case 'infinite_well': {
            const L = config.xMax - config.xMin;
            const xNormalized = (x - config.xMin) / L;
            // Return high value outside well to represent "infinity"
            if (xNormalized < 0 || xNormalized > 1) {
                return 10; // High enough to be off the scale
            }
            return 0;
        }
        default:
            return 0.5 * x * x;
    }
}

/**
 * Get display name for potential type
 */
export function getPotentialDisplayName(type: PotentialType): string {
    switch (type) {
        case 'harmonic':
            return 'Harmonic Oscillator';
        case 'infinite_well':
            return 'Particle in a Box';
        default:
            return 'Harmonic Oscillator';
    }
}

/**
 * Get energy label with appropriate formula
 */
export function getEnergyLabelTeX(n: number, config: PotentialConfig): string {
    switch (config.type) {
        case 'harmonic':
            return `E_{${n}} = (${n} + \\frac{1}{2})\\hbar\\omega`;
        case 'infinite_well': {
            const nWell = n + 1;
            return `E_{${n}} = \\frac{${nWell}^2 \\pi^2 \\hbar^2}{2mL^2}`;
        }
        default:
            return `E_{${n}}`;
    }
}

/**
 * Color scheme for quantum states
 */
export const STATE_COLORS = [
    '#0048BA', // Blue
    '#DC143C', // Crimson
    '#228B22', // Forest Green
    '#FF8C00', // Dark Orange
    '#8A2BE2', // Blue Violet
    '#008B8B', // Teal
    '#FF1493', // Deep Pink
    '#8B4513', // Saddle Brown
];

export function getStateColor(n: number): string {
    return STATE_COLORS[n % STATE_COLORS.length];
}

/**
 * Maximum number of states supported
 */
export const MAX_STATES = 8;
