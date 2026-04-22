/**
 * Physics utilities for 1D quantum mechanics visualization.
 *
 * Natural units: hbar = m = 1. For the harmonic oscillator we additionally
 * set omega = 1 so E_n = n + 1/2.
 *
 * Time evolution uses the dimensionless tau:
 *   tau = E_0 * t / hbar
 * so tau = 2*pi corresponds to one ground-state period T_0 regardless of
 * which potential is selected.
 *
 * Analytic solutions are used for the harmonic oscillator and infinite well;
 * everything else (double well, Morse) is solved numerically via a
 * finite-difference tridiagonal eigensolver and cached in a StateSet.
 */

import { solveTISE, type Eigenpair } from './eigensolver';

export type PotentialType =
    | 'harmonic'
    | 'infinite_well'
    | 'double_well'
    | 'morse'
    | 'lattice';

export interface PotentialParams {
    /** Double well barrier height V0 in V(x) = V0*(x^2/a^2 - 1)^2 */
    doubleWellBarrier?: number;
    /** Double well half-separation a (well minima at +/-a) */
    doubleWellSeparation?: number;
    /** Double well energy asymmetry: adds a linear tilt so left/right minima
     *  are offset in energy. Value is the full offset V(right)-V(left) in energy units. */
    doubleWellTilt?: number;
    /** Morse dissociation energy D_e */
    morseDepth?: number;
    /** Morse range parameter alpha */
    morseAlpha?: number;
    /** Number of wells in a Gaussian-well chain (MO → band demo) */
    latticeWells?: number;
    /** Depth of each well */
    latticeDepth?: number;
    /** Centre-to-centre spacing between adjacent wells */
    latticeSpacing?: number;
}

export interface PotentialConfig extends PotentialParams {
    type: PotentialType;
    xMin: number;
    xMax: number;
}

/** Default parameter values for each potential type */
export function defaultParams(type: PotentialType): PotentialParams {
    switch (type) {
        case 'double_well':
            return { doubleWellBarrier: 4, doubleWellSeparation: 2, doubleWellTilt: 0 };
        case 'morse':
            return { morseDepth: 10, morseAlpha: 0.5 };
        case 'lattice':
            return { latticeWells: 4, latticeDepth: 12, latticeSpacing: 2.2 };
        default:
            return {};
    }
}

/** Sensible x-domain for each potential (may depend on parameters) */
export function defaultDomain(
    type: PotentialType,
    params: PotentialParams = {}
): { xMin: number; xMax: number } {
    switch (type) {
        case 'harmonic':
            return { xMin: -6, xMax: 6 };
        case 'infinite_well':
            return { xMin: -6, xMax: 6 };
        case 'double_well':
            return { xMin: -5, xMax: 5 };
        case 'morse':
            return { xMin: -2, xMax: 14 };
        case 'lattice': {
            const wells = params.latticeWells ?? 4;
            const spacing = params.latticeSpacing ?? 2.2;
            // Centre chain on x=0, add ~2 spacings of padding each side so
            // edge wavefunctions decay well before the Dirichlet boundary.
            const half = ((wells - 1) * spacing) / 2;
            const pad = 2.5 * spacing;
            return { xMin: -(half + pad), xMax: half + pad };
        }
        default:
            return { xMin: -6, xMax: 6 };
    }
}

/**
 * A StateSet represents the solved eigenspectrum for a given potential.
 * Both analytic and numerical potentials expose the same query interface.
 */
export interface StateSet {
    config: PotentialConfig;
    /** Number of bound (or retained) states available */
    numStates: number;
    /** E_n in natural units */
    energy(n: number): number;
    /** Time-independent wavefunction psi_n(x) */
    psi(n: number, x: number): number;
    /** Potential V(x) for plotting */
    potential(x: number): number;
    /** Ground-state energy used for tau normalization */
    groundStateEnergy: number;
    /** Maximum potential value across the domain, for auto-scaling plots */
    maxPotentialDisplay: number;
    /** Minimum potential value across the domain (defaults to 0) */
    minPotentialDisplay: number;
}

// ---------------------------------------------------------------------------
// Analytic: Harmonic oscillator
// ---------------------------------------------------------------------------

const hermitePolynomials: ((x: number) => number)[] = [
    (_) => 1,
    (x) => 2 * x,
    (x) => 4 * x * x - 2,
    (x) => 8 * x * x * x - 12 * x,
    (x) => 16 * Math.pow(x, 4) - 48 * x * x + 12,
    (x) => 32 * Math.pow(x, 5) - 160 * Math.pow(x, 3) + 120 * x,
    (x) => 64 * Math.pow(x, 6) - 480 * Math.pow(x, 4) + 720 * x * x - 120,
    (x) => 128 * Math.pow(x, 7) - 1344 * Math.pow(x, 5) + 3360 * Math.pow(x, 3) - 1680 * x,
];

function factorial(n: number): number {
    let f = 1;
    for (let i = 2; i <= n; i++) f *= i;
    return f;
}

function psiHarmonic(x: number, n: number): number {
    if (n >= hermitePolynomials.length) return 0;
    const prefactor = 1.0 / Math.sqrt(Math.pow(2, n) * factorial(n) * Math.sqrt(Math.PI));
    return prefactor * hermitePolynomials[n](x) * Math.exp(-x * x / 2);
}

function buildHarmonicStateSet(config: PotentialConfig): StateSet {
    return {
        config,
        numStates: hermitePolynomials.length,
        energy: (n) => n + 0.5,
        psi: (n, x) => psiHarmonic(x, n),
        potential: (x) => 0.5 * x * x,
        groundStateEnergy: 0.5,
        maxPotentialDisplay: Math.min(0.5 * config.xMax * config.xMax, 20),
        minPotentialDisplay: 0,
    };
}

// ---------------------------------------------------------------------------
// Analytic: Infinite square well
// ---------------------------------------------------------------------------

function buildInfiniteWellStateSet(config: PotentialConfig): StateSet {
    const L = config.xMax - config.xMin;
    const groundEnergy = (Math.PI * Math.PI) / (2 * L * L);

    return {
        config,
        numStates: 8,
        energy: (n) => {
            const nWell = n + 1;
            return (nWell * nWell * Math.PI * Math.PI) / (2 * L * L);
        },
        psi: (n, x) => {
            const xN = (x - config.xMin) / L;
            if (xN < 0 || xN > 1) return 0;
            const nWell = n + 1;
            return Math.sqrt(2 / L) * Math.sin(nWell * Math.PI * xN);
        },
        potential: (x) => {
            const xN = (x - config.xMin) / L;
            return xN < 0 || xN > 1 ? 10 : 0;
        },
        groundStateEnergy: groundEnergy,
        maxPotentialDisplay: 10,
        minPotentialDisplay: 0,
    };
}

// ---------------------------------------------------------------------------
// Numerical: arbitrary V(x) via finite differences
// ---------------------------------------------------------------------------

const NUMERICAL_GRID_SIZE = 300;
const NUMERICAL_NUM_STATES = 12;

function buildNumericalStateSet(
    config: PotentialConfig,
    V: (x: number) => number,
    maxPotentialDisplay: number,
    minPotentialDisplay = 0,
    numStates = NUMERICAL_NUM_STATES
): StateSet {
    const eig: Eigenpair = solveTISE(
        V,
        config.xMin,
        config.xMax,
        NUMERICAL_GRID_SIZE,
        numStates
    );

    const N = eig.grid.length;
    const dx = eig.grid[1] - eig.grid[0];
    const groundEnergy = Math.max(Math.abs(eig.energies[0]), 0.05); // avoid div-by-zero

    const psiInterp = (n: number, x: number): number => {
        if (n >= eig.eigenvectors.length) return 0;
        if (x <= eig.grid[0] || x >= eig.grid[N - 1]) return 0;
        const t = (x - eig.grid[0]) / dx;
        const i = Math.floor(t);
        const frac = t - i;
        const vec = eig.eigenvectors[n];
        return vec[i] * (1 - frac) + vec[i + 1] * frac;
    };

    return {
        config,
        numStates: eig.energies.length,
        energy: (n) => eig.energies[n] ?? 0,
        psi: psiInterp,
        potential: V,
        groundStateEnergy: groundEnergy,
        maxPotentialDisplay,
        minPotentialDisplay,
    };
}

// Potential functions

function doubleWellV(
    barrier: number,
    a: number,
    tilt: number
): (x: number) => number {
    // V(x) = V0 * (x²/a² − 1)² + tilt * (x / 2a)
    // The tilt term is linear so the total offset between the two minima
    // at x = ±a comes out to `tilt` (right well higher by `tilt`).
    return (x) => {
        const u = (x * x) / (a * a) - 1;
        return barrier * u * u + tilt * (x / (2 * a));
    };
}

function morseV(D: number, alpha: number): (x: number) => number {
    // V(x) = D * (1 - exp(-alpha*x))^2
    return (x) => {
        const f = 1 - Math.exp(-alpha * x);
        return D * f * f;
    };
}

function latticeV(
    wells: number,
    depth: number,
    spacing: number
): (x: number) => number {
    // Chain of N Gaussian wells of common width sigma, centered on x=0.
    //   V(x) = -depth · Σ_i exp( -(x - x_i)² / (2σ²) )
    // σ scales with spacing so well overlap stays physically reasonable.
    // Floor σ so spacing→0 doesn't blow up the exponent; this lets the
    // chain smoothly collapse into a single merged well at small spacing.
    const sigma = Math.max(0.35 * spacing, 0.1);
    const twoSigma2 = 2 * sigma * sigma;
    const half = ((wells - 1) * spacing) / 2;
    const positions: number[] = [];
    for (let i = 0; i < wells; i++) positions.push(i * spacing - half);
    return (x) => {
        let v = 0;
        for (const x0 of positions) {
            const d = x - x0;
            v -= depth * Math.exp(-(d * d) / twoSigma2);
        }
        return v;
    };
}

// ---------------------------------------------------------------------------
// Top-level StateSet builder
// ---------------------------------------------------------------------------

export function buildStateSet(config: PotentialConfig): StateSet {
    switch (config.type) {
        case 'harmonic':
            return buildHarmonicStateSet(config);
        case 'infinite_well':
            return buildInfiniteWellStateSet(config);
        case 'double_well': {
            const V0 = config.doubleWellBarrier ?? 4;
            const a = config.doubleWellSeparation ?? 2;
            const tilt = config.doubleWellTilt ?? 0;
            return buildNumericalStateSet(
                config,
                doubleWellV(V0, a, tilt),
                V0 * 1.15 + Math.abs(tilt),
                -Math.abs(tilt) / 2 - 0.1
            );
        }
        case 'morse': {
            const D = config.morseDepth ?? 10;
            const alpha = config.morseAlpha ?? 0.5;
            return buildNumericalStateSet(config, morseV(D, alpha), D * 1.05, 0);
        }
        case 'lattice': {
            const wells = Math.max(1, Math.round(config.latticeWells ?? 4));
            const depth = config.latticeDepth ?? 12;
            const spacing = config.latticeSpacing ?? 2.2;
            // Aim for ~2 bands (2 × number of wells) so the band gap is
            // visible alongside the band itself. Cap at MAX_STATES.
            const numStates = Math.min(Math.max(wells * 2, 8), MAX_STATES);
            return buildNumericalStateSet(
                config,
                latticeV(wells, depth, spacing),
                Math.max(0.1 * depth, 0.5),
                -depth * 1.05,
                numStates
            );
        }
    }
}

/**
 * Compute a superposition wavefunction psi(x, tau) with equal weights.
 */
export function superposition(
    stateSet: StateSet,
    states: number[],
    tau: number,
    x: number
): { real: number; imag: number; prob: number } {
    if (states.length === 0) return { real: 0, imag: 0, prob: 0 };
    const norm = 1 / Math.sqrt(states.length);
    const E0 = stateSet.groundStateEnergy;
    let re = 0;
    let im = 0;
    for (const n of states) {
        const psiN = stateSet.psi(n, x);
        const phase = -(stateSet.energy(n) / E0) * tau;
        re += psiN * Math.cos(phase) * norm;
        im += psiN * Math.sin(phase) * norm;
    }
    return { real: re, imag: im, prob: re * re + im * im };
}

/**
 * Single-state wavefunction at time tau (for overlays).
 */
export function psiAtTau(
    stateSet: StateSet,
    n: number,
    tau: number,
    x: number
): { real: number; imag: number } {
    const psiN = stateSet.psi(n, x);
    const phase = -(stateSet.energy(n) / stateSet.groundStateEnergy) * tau;
    return { real: psiN * Math.cos(phase), imag: psiN * Math.sin(phase) };
}

/**
 * Energy ratio E_n / E_0 — controls phasor rotation rate.
 */
export function energyRatio(stateSet: StateSet, n: number): number {
    return stateSet.energy(n) / stateSet.groundStateEnergy;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export function formatTime(tau: number): string {
    const periods = tau / (2 * Math.PI);
    if (periods < 0.01) return `${periods.toExponential(1)} T₀`;
    return `${periods.toFixed(2)} T₀`;
}

export function getPotentialDisplayName(type: PotentialType): string {
    switch (type) {
        case 'harmonic':
            return 'Harmonic Oscillator';
        case 'infinite_well':
            return 'Particle in a Box';
        case 'double_well':
            return 'Double Well';
        case 'morse':
            return 'Morse Potential';
        case 'lattice':
            return 'Lattice of Wells';
    }
}

/**
 * Color scheme for quantum states.
 */
export const STATE_COLORS = [
    '#0048BA',
    '#DC143C',
    '#228B22',
    '#FF8C00',
    '#8A2BE2',
    '#008B8B',
    '#FF1493',
    '#8B4513',
];

export function getStateColor(n: number): string {
    return STATE_COLORS[n % STATE_COLORS.length];
}

export const MAX_STATES = 32;
