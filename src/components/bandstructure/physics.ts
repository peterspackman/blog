/**
 * Physics calculations for Hückel/tight-binding model
 *
 * Models a linear chain of N atoms with pi orbitals.
 * Shows emergence of band structure from discrete MO levels.
 * Supports Peierls distortion (bond alternation) and electron filling.
 */

// ============================================================================
// Types
// ============================================================================

export interface HuckelParams {
    N: number;              // Number of atoms in chain
    alpha: number;          // On-site energy (eV), typically 0 as reference
    beta: number;           // Hopping integral (eV), typically -2.5 for C-C
    alternation?: number;   // Bond alternation parameter δ (0 = uniform, 0-1 range)
                            // β₁ = β(1+δ), β₂ = β(1-δ)
}

export interface EnergyLevel {
    k: number;      // MO index (1 to N)
    energy: number; // Energy in eV
    occupied?: boolean; // Whether this level is occupied
}

export interface MOCoefficients {
    k: number;              // MO index
    coefficients: number[]; // c_jk for each atom j (1 to N)
}

export interface DOSPoint {
    energy: number;
    density: number;
}

export interface FermiInfo {
    fermiEnergy: number;    // Fermi energy (chemical potential)
    homoIndex: number;      // Index of HOMO in sorted levels
    lumoIndex: number;      // Index of LUMO in sorted levels
    bandGap: number;        // HOMO-LUMO gap
}

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_ALPHA = 0;       // Reference energy (eV)
export const DEFAULT_BETA = -2.5;     // C-C pi hopping integral (eV)
export const MIN_ATOMS = 2;
export const MAX_ATOMS = 100;

// ============================================================================
// Numerical Linear Algebra for Tridiagonal Matrices
// ============================================================================

/**
 * Build the Hückel Hamiltonian matrix for a linear chain
 * With alternating bonds: β₁ = β(1+δ), β₂ = β(1-δ)
 */
function buildHamiltonianMatrix(params: HuckelParams): { diagonal: number[]; offDiagonal: number[] } {
    const { N, alpha, beta, alternation = 0 } = params;

    const diagonal: number[] = new Array(N).fill(alpha);
    const offDiagonal: number[] = [];

    const beta1 = beta * (1 + alternation);
    const beta2 = beta * (1 - alternation);

    for (let i = 0; i < N - 1; i++) {
        // Alternate between β₁ and β₂
        offDiagonal.push(i % 2 === 0 ? beta1 : beta2);
    }

    return { diagonal, offDiagonal };
}

/**
 * Compute eigenvalues of a symmetric tridiagonal matrix using the QR algorithm
 * with Wilkinson shifts for fast convergence.
 *
 * Input: diagonal elements (d) and off-diagonal elements (e)
 * Returns: sorted eigenvalues (ascending)
 */
function tridiagonalEigenvalues(d: number[], e: number[]): number[] {
    const n = d.length;
    if (n === 0) return [];
    if (n === 1) return [d[0]];

    // Copy arrays to avoid mutation
    const diag = [...d];
    const offDiag = [...e, 0]; // Pad with zero

    const eigenvalues: number[] = [];
    let m = n;

    const maxIterations = 30 * n;
    let iterations = 0;

    while (m > 1 && iterations < maxIterations) {
        iterations++;

        // Check for convergence of last off-diagonal element
        const threshold = 1e-12 * (Math.abs(diag[m - 2]) + Math.abs(diag[m - 1]));
        if (Math.abs(offDiag[m - 2]) < threshold) {
            eigenvalues.push(diag[m - 1]);
            m--;
            continue;
        }

        // Wilkinson shift
        const dd = (diag[m - 2] - diag[m - 1]) / 2;
        const sign = dd >= 0 ? 1 : -1;
        const shift = diag[m - 1] - sign * offDiag[m - 2] * offDiag[m - 2] /
            (Math.abs(dd) + Math.sqrt(dd * dd + offDiag[m - 2] * offDiag[m - 2]));

        // Implicit QR step with shift
        let x = diag[0] - shift;
        let z = offDiag[0];

        for (let k = 0; k < m - 1; k++) {
            // Givens rotation to zero out z
            let r = Math.sqrt(x * x + z * z);
            if (r < 1e-15) r = 1e-15;
            const c = x / r;
            const s = z / r;

            if (k > 0) {
                offDiag[k - 1] = r;
            }

            const d1 = diag[k];
            const d2 = diag[k + 1];
            const e1 = offDiag[k];

            diag[k] = c * c * d1 + 2 * c * s * e1 + s * s * d2;
            diag[k + 1] = s * s * d1 - 2 * c * s * e1 + c * c * d2;
            offDiag[k] = c * s * (d2 - d1) + (c * c - s * s) * e1;

            if (k < m - 2) {
                x = offDiag[k];
                z = s * offDiag[k + 1];
                offDiag[k + 1] = c * offDiag[k + 1];
            }
        }
    }

    // Add remaining diagonal elements
    for (let i = 0; i < m; i++) {
        eigenvalues.push(diag[i]);
    }

    // Sort eigenvalues
    eigenvalues.sort((a, b) => a - b);

    return eigenvalues;
}

// ============================================================================
// Core Physics Functions
// ============================================================================

/**
 * Calculate energy level for MO index k (uniform chain only)
 * E_k = alpha + 2*beta*cos(k*pi/(N+1))
 */
export function calculateEnergy(k: number, params: HuckelParams): number {
    const { N, alpha, beta } = params;
    return alpha + 2 * beta * Math.cos((k * Math.PI) / (N + 1));
}

/**
 * Calculate all energy levels for N atoms
 * Uses numerical diagonalization when alternation is present
 * Returns array sorted from lowest to highest energy
 */
export function calculateEnergyLevels(params: HuckelParams, electronCount?: number): EnergyLevel[] {
    const { N, alternation = 0 } = params;

    let energies: number[];

    if (Math.abs(alternation) < 1e-10) {
        // Use analytical formula for uniform chain
        energies = [];
        for (let k = 1; k <= N; k++) {
            energies.push(calculateEnergy(k, params));
        }
        energies.sort((a, b) => a - b);
    } else {
        // Use numerical diagonalization for alternating chain
        const { diagonal, offDiagonal } = buildHamiltonianMatrix(params);
        energies = tridiagonalEigenvalues(diagonal, offDiagonal);
    }

    // Create levels with occupation info
    const levels: EnergyLevel[] = energies.map((energy, index) => ({
        k: index + 1,
        energy,
        occupied: electronCount !== undefined ? index < electronCount : undefined,
    }));

    return levels;
}

/**
 * Calculate MO coefficients for a given orbital k
 * c_jk = sqrt(2/(N+1)) * sin(j*k*pi/(N+1))
 *
 * Note: This is exact only for uniform chain. For alternating chain,
 * we'd need to compute eigenvectors, but this gives a reasonable approximation.
 */
export function calculateMOCoefficients(k: number, N: number): MOCoefficients {
    const norm = Math.sqrt(2 / (N + 1));
    const coefficients: number[] = [];

    for (let j = 1; j <= N; j++) {
        const c_jk = norm * Math.sin((j * k * Math.PI) / (N + 1));
        coefficients.push(c_jk);
    }

    return { k, coefficients };
}

/**
 * Calculate Fermi level information
 * @param levels - Sorted energy levels
 * @param electronCount - Number of electrons (each level holds 2 with spin)
 */
export function calculateFermiLevel(levels: EnergyLevel[], electronCount: number): FermiInfo {
    if (levels.length === 0) {
        return { fermiEnergy: 0, homoIndex: -1, lumoIndex: 0, bandGap: 0 };
    }

    // Each orbital can hold 2 electrons (spin up and down)
    const occupiedLevels = Math.min(Math.ceil(electronCount / 2), levels.length);
    const homoIndex = Math.max(0, occupiedLevels - 1);
    const lumoIndex = Math.min(occupiedLevels, levels.length - 1);

    const homoEnergy = levels[homoIndex].energy;
    const lumoEnergy = levels[lumoIndex].energy;

    // Fermi energy is at midpoint of gap (for insulators) or at HOMO (for metals)
    const fermiEnergy = occupiedLevels < levels.length
        ? (homoEnergy + lumoEnergy) / 2
        : homoEnergy;

    const bandGap = lumoIndex > homoIndex ? lumoEnergy - homoEnergy : 0;

    return { fermiEnergy, homoIndex, lumoIndex, bandGap };
}

/**
 * Calculate the band width (difference between highest and lowest energy)
 * For large N: bandwidth → 4|beta|
 */
export function calculateBandWidth(params: HuckelParams): number {
    const levels = calculateEnergyLevels(params);
    if (levels.length === 0) return 0;
    return levels[levels.length - 1].energy - levels[0].energy;
}

/**
 * Calculate the band gap for alternating chain
 * Gap ≈ 4|β|δ for small δ
 */
export function calculateBandGap(params: HuckelParams): number {
    const { beta, alternation = 0 } = params;
    // Approximate formula for small alternation
    return 4 * Math.abs(beta) * Math.abs(alternation);
}

/**
 * Get the energy range for the band
 */
export function getEnergyRange(params: HuckelParams): { min: number; max: number } {
    const levels = calculateEnergyLevels(params);
    if (levels.length === 0) {
        return {
            min: params.alpha - 2 * Math.abs(params.beta),
            max: params.alpha + 2 * Math.abs(params.beta)
        };
    }
    // Add small padding
    const padding = 0.3;
    return {
        min: levels[0].energy - padding,
        max: levels[levels.length - 1].energy + padding,
    };
}

// ============================================================================
// Density of States
// ============================================================================

/**
 * Calculate density of states as a histogram
 */
export function calculateDOSHistogram(
    energyLevels: EnergyLevel[],
    binCount: number,
    energyRange?: { min: number; max: number }
): DOSPoint[] {
    if (energyLevels.length === 0) return [];

    const range = energyRange || {
        min: energyLevels[0].energy,
        max: energyLevels[energyLevels.length - 1].energy,
    };

    const binWidth = (range.max - range.min) / binCount;
    const bins: number[] = new Array(binCount).fill(0);

    // Count levels in each bin
    for (const level of energyLevels) {
        const binIndex = Math.floor((level.energy - range.min) / binWidth);
        const clampedIndex = Math.max(0, Math.min(binCount - 1, binIndex));
        bins[clampedIndex]++;
    }

    // Convert to DOS points (center of each bin)
    return bins.map((count, i) => ({
        energy: range.min + (i + 0.5) * binWidth,
        density: count,
    }));
}

/**
 * Calculate smoothed density of states using Gaussian broadening
 */
export function calculateDOSSmoothed(
    energyLevels: EnergyLevel[],
    pointCount: number,
    sigma: number,
    energyRange?: { min: number; max: number }
): DOSPoint[] {
    if (energyLevels.length === 0) return [];

    const range = energyRange || {
        min: energyLevels[0].energy - 3 * sigma,
        max: energyLevels[energyLevels.length - 1].energy + 3 * sigma,
    };

    const points: DOSPoint[] = [];
    const dE = (range.max - range.min) / (pointCount - 1);

    for (let i = 0; i < pointCount; i++) {
        const E = range.min + i * dE;
        let density = 0;

        // Sum Gaussian contributions from each level
        for (const level of energyLevels) {
            const delta = E - level.energy;
            density += Math.exp(-(delta * delta) / (2 * sigma * sigma));
        }

        // Normalize by sqrt(2*pi*sigma^2)
        density /= Math.sqrt(2 * Math.PI) * sigma;

        points.push({ energy: E, density });
    }

    return points;
}

// ============================================================================
// Visualization Helpers
// ============================================================================

/**
 * Get color for energy level based on position in band
 * Blue (bonding, bottom) → Red (antibonding, top)
 */
export function getOrbitalColor(k: number, N: number): string {
    // Normalize k to [0, 1] range
    const t = (k - 1) / Math.max(1, N - 1);

    // Interpolate from blue (#3b82f6) to red (#ef4444)
    const r = Math.round(59 + t * (239 - 59));
    const g = Math.round(130 + t * (68 - 130));
    const b = Math.round(246 + t * (68 - 246));

    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Get bonding character description
 */
export function getBondingCharacter(k: number, N: number): string {
    const ratio = k / N;
    if (ratio <= 0.33) return 'bonding';
    if (ratio <= 0.67) return 'nonbonding';
    return 'antibonding';
}

/**
 * Count number of nodes in an MO
 * Nodes = k - 1 (internal nodes, not counting boundaries)
 */
export function countNodes(k: number): number {
    return k - 1;
}

/**
 * Format energy value for display
 */
export function formatEnergy(energy: number): string {
    return energy.toFixed(2) + ' eV';
}

/**
 * Get default Huckel parameters
 */
export function getDefaultParams(N: number = 10): HuckelParams {
    return {
        N,
        alpha: DEFAULT_ALPHA,
        beta: DEFAULT_BETA,
        alternation: 0,
    };
}
