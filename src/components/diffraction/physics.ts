/**
 * Physics calculations for X-ray diffraction simulation
 *
 * Implements:
 * - Bragg's Law: nλ = 2d·sin(θ)
 * - d-spacing for cubic systems
 * - Structure factor calculation
 * - Atomic form factors
 * - Systematic absences
 * - Electron density via Fourier synthesis
 */

// ============================================================================
// Types
// ============================================================================

export interface Atom {
    element: string;
    position: [number, number, number]; // Fractional coordinates (0-1)
    atomicNumber: number;
}

export interface CrystalStructure {
    name: string;
    spaceGroup: string;
    latticeType: 'cubic' | 'tetragonal' | 'orthorhombic' | 'hexagonal' | 'monoclinic' | 'triclinic' | 'fcc' | 'bcc';
    a: number; // Lattice parameter in Å
    b?: number;
    c?: number;
    alpha?: number; // Angle between b and c in degrees (default 90)
    beta?: number;  // Angle between a and c in degrees (default 90)
    gamma?: number; // Angle between a and b in degrees (default 90)
    atoms: Atom[]; // Atoms in the unit cell (all positions, not just asymmetric unit)
}

/**
 * Reciprocal lattice parameters
 */
export interface ReciprocalLattice {
    astar: number; // |a*| in Å⁻¹
    bstar: number; // |b*| in Å⁻¹
    cstar: number; // |c*| in Å⁻¹
    alphaStar: number; // Angle between b* and c* in degrees
    betaStar: number;  // Angle between a* and c* in degrees
    gammaStar: number; // Angle between a* and b* in degrees
    volume: number; // Unit cell volume in Å³
}

/**
 * Calculate reciprocal lattice parameters from real space lattice
 */
export function calculateReciprocalLattice(structure: CrystalStructure): ReciprocalLattice {
    const a = structure.a;
    const b = structure.b ?? structure.a;
    const c = structure.c ?? structure.a;
    const alpha = (structure.alpha ?? 90) * Math.PI / 180;
    const beta = (structure.beta ?? 90) * Math.PI / 180;
    const gamma = (structure.gamma ?? 90) * Math.PI / 180;

    const cosAlpha = Math.cos(alpha);
    const cosBeta = Math.cos(beta);
    const cosGamma = Math.cos(gamma);
    const sinAlpha = Math.sin(alpha);
    const sinBeta = Math.sin(beta);
    const sinGamma = Math.sin(gamma);

    // Unit cell volume
    const volume = a * b * c * Math.sqrt(
        1 - cosAlpha * cosAlpha - cosBeta * cosBeta - cosGamma * cosGamma +
        2 * cosAlpha * cosBeta * cosGamma
    );

    // Reciprocal lattice parameters
    const astar = b * c * sinAlpha / volume;
    const bstar = a * c * sinBeta / volume;
    const cstar = a * b * sinGamma / volume;

    // Reciprocal angles
    const cosAlphaStar = (cosBeta * cosGamma - cosAlpha) / (sinBeta * sinGamma);
    const cosBetaStar = (cosAlpha * cosGamma - cosBeta) / (sinAlpha * sinGamma);
    const cosGammaStar = (cosAlpha * cosBeta - cosGamma) / (sinAlpha * sinBeta);

    const alphaStar = Math.acos(Math.max(-1, Math.min(1, cosAlphaStar))) * 180 / Math.PI;
    const betaStar = Math.acos(Math.max(-1, Math.min(1, cosBetaStar))) * 180 / Math.PI;
    const gammaStar = Math.acos(Math.max(-1, Math.min(1, cosGammaStar))) * 180 / Math.PI;

    return { astar, bstar, cstar, alphaStar, betaStar, gammaStar, volume };
}

export interface Complex {
    re: number;
    im: number;
}

export interface Reflection {
    h: number;
    k: number;
    l: number;
    dSpacing: number;
    twoTheta: number; // in degrees
    intensity: number; // |F|²
    structureFactor: Complex;
    multiplicity: number;
}

export interface DiffractionParams {
    wavelength: number; // X-ray wavelength in Å
    structure: CrystalStructure;
    maxHKL: number; // Max Miller index to calculate
    twoThetaMax?: number; // Max 2θ in degrees
    bFactor?: number; // Debye-Waller temperature factor in Ų (0 = no damping)
}

/** Control point for form factor spline editing */
export interface ControlPoint {
    s: number;  // sin(θ)/λ value (x-axis)
    f: number;  // form factor value (y-axis)
}

// ============================================================================
// Constants
// ============================================================================

export const CU_K_ALPHA = 1.5406; // Cu Kα wavelength in Å
export const MO_K_ALPHA = 0.7107; // Mo Kα wavelength in Å

// Atomic form factor coefficients (Cromer-Mann parameterization)
// f(s) = Σᵢ aᵢ·exp(-bᵢ·s²) + c, where s = sin(θ)/λ
// Format: [a1, b1, a2, b2, a3, b3, a4, b4, c]
export const FORM_FACTOR_COEFFS: Record<string, number[]> = {
    H: [0.489918, 20.6593, 0.262003, 7.74039, 0.196767, 49.5519, 0.049879, 2.20159, 0.001305],
    Na: [
        4.7626, 3.285, 3.1736, 8.8422, 1.2674, 0.3136, 1.1128, 129.424, 0.676,
    ],
    Cl: [
        11.4604, 0.0104, 7.1964, 1.1662, 6.2556, 18.5194, 1.6455, 47.7784,
        -9.5574,
    ],
    C: [2.31, 20.8439, 1.02, 10.2075, 1.5886, 0.5687, 0.865, 51.6512, 0.2156],
    N: [12.2126, 0.0057, 3.1322, 9.8933, 2.0125, 28.9975, 1.1663, 0.5826, -11.529],
    O: [3.0485, 13.2771, 2.2868, 5.7011, 1.5463, 0.3239, 0.867, 32.9089, 0.2508],
    Fe: [
        11.7695, 4.7611, 7.3573, 0.3072, 3.5222, 15.3535, 2.3045, 76.8805,
        1.0369,
    ],
    Si: [
        6.2915, 2.4386, 3.0353, 32.3337, 1.9891, 0.6785, 1.541, 81.6937, 1.1407,
    ],
    Ca: [
        8.6266, 10.4421, 7.3873, 0.6599, 1.5899, 85.7484, 1.0211, 178.437,
        1.3751,
    ],
    K: [
        8.2186, 12.7949, 7.4398, 0.7748, 1.0519, 213.187, 0.8659, 41.6841,
        1.4228,
    ],
    Cs: [
        20.3892, 3.569, 19.1062, 0.3107, 10.662, 24.3879, 1.4953, 213.904,
        3.3352,
    ],
    I: [
        20.1472, 4.347, 18.9949, 0.3814, 7.5138, 27.766, 2.2735, 66.8776, 4.0712,
    ],
    Ba: [
        20.1807, 3.21, 19.1136, 0.2855, 10.9054, 20.0558, 0.7763, 51.746, 3.029,
    ],
    Ti: [
        9.7595, 7.8508, 7.3558, 0.5, 1.6991, 35.6338, 1.9021, 116.105, 1.2807,
    ],
    O_minus2: [
        4.758, 7.8313, 3.637, 30.0505, 0.0, 0.0, 0.0, 0.0, 1.594,
    ], // O²⁻ (oxide)
};

// Default coefficients for unknown elements (approximation)
const DEFAULT_FORM_FACTOR = [
    3.0, 15.0, 2.0, 5.0, 1.5, 0.5, 1.0, 40.0, 0.5,
];

// ============================================================================
// Atomic Form Factors
// ============================================================================

/**
 * Calculate atomic form factor using Cromer-Mann parameterization
 * @param element - Element symbol
 * @param sinTheta_lambda - sin(θ)/λ in Å⁻¹
 */
export function atomicFormFactor(
    element: string,
    sinTheta_lambda: number
): number {
    const coeffs = FORM_FACTOR_COEFFS[element] || DEFAULT_FORM_FACTOR;

    // s = sin(θ)/λ
    const s2 = sinTheta_lambda * sinTheta_lambda;

    let f = coeffs[8]; // c term
    for (let i = 0; i < 4; i++) {
        const a = coeffs[2 * i];
        const b = coeffs[2 * i + 1];
        f += a * Math.exp(-b * s2);
    }

    return f;
}

// ============================================================================
// D-spacing Calculations
// ============================================================================

/**
 * Calculate d-spacing for a given (hkl) reflection
 * For cubic: d = a / sqrt(h² + k² + l²)
 */
export function calculateDSpacing(
    h: number,
    k: number,
    l: number,
    structure: CrystalStructure
): number {
    const hkl2 = h * h + k * k + l * l;
    if (hkl2 === 0) return Infinity;

    const { a, b, c, latticeType } = structure;

    switch (latticeType) {
        case 'cubic':
        case 'fcc':
        case 'bcc':
            return a / Math.sqrt(hkl2);

        case 'tetragonal':
            // d = 1 / sqrt((h² + k²)/a² + l²/c²)
            const cVal = c || a;
            return 1 / Math.sqrt((h * h + k * k) / (a * a) + (l * l) / (cVal * cVal));

        case 'orthorhombic':
            // d = 1 / sqrt(h²/a² + k²/b² + l²/c²)
            const bVal = b || a;
            const cVal2 = c || a;
            return 1 / Math.sqrt(
                (h * h) / (a * a) + (k * k) / (bVal * bVal) + (l * l) / (cVal2 * cVal2)
            );

        case 'hexagonal':
            // For hexagonal: 1/d² = (4/3)(h² + hk + k²)/a² + l²/c²
            const cHex = c || a;
            const hexTerm = (4 / 3) * (h * h + h * k + k * k) / (a * a);
            const lTerm = (l * l) / (cHex * cHex);
            return 1 / Math.sqrt(hexTerm + lTerm);

        default:
            return a / Math.sqrt(hkl2);
    }
}

/**
 * Calculate 2θ angle from d-spacing using Bragg's law
 * Returns NaN if reflection is beyond observable range
 */
export function calculateTwoTheta(
    dSpacing: number,
    wavelength: number
): number {
    if (dSpacing === Infinity || dSpacing === 0) return NaN;

    const sinTheta = wavelength / (2 * dSpacing);
    if (Math.abs(sinTheta) > 1) return NaN; // Beyond observable range

    return (2 * Math.asin(sinTheta) * 180) / Math.PI;
}

// ============================================================================
// Structure Factor Calculations
// ============================================================================

/**
 * Complex number multiplication
 */
function complexMultiply(a: Complex, b: Complex): Complex {
    return {
        re: a.re * b.re - a.im * b.im,
        im: a.re * b.im + a.im * b.re,
    };
}

/**
 * Complex number addition
 */
function complexAdd(a: Complex, b: Complex): Complex {
    return {
        re: a.re + b.re,
        im: a.im + b.im,
    };
}

/**
 * Complex magnitude squared |z|²
 */
function complexMagnitudeSquared(z: Complex): number {
    return z.re * z.re + z.im * z.im;
}

/**
 * Calculate structure factor F_hkl
 * F_hkl = Σⱼ fⱼ · exp(2πi(h·xⱼ + k·yⱼ + l·zⱼ))
 * @param bFactor - Debye-Waller temperature factor in Ų (typically 1-3 for room temp)
 */
export function calculateStructureFactor(
    h: number,
    k: number,
    l: number,
    structure: CrystalStructure,
    wavelength: number,
    bFactor: number = 0
): Complex {
    const d = calculateDSpacing(h, k, l, structure);
    const twoTheta = calculateTwoTheta(d, wavelength);

    // sin(θ)/λ for form factor calculation
    const sinTheta_lambda = isNaN(twoTheta)
        ? 0
        : Math.sin((twoTheta * Math.PI) / 360) / wavelength;

    // Debye-Waller factor: exp(-B * sin²θ/λ²)
    const debyeWaller = bFactor > 0
        ? Math.exp(-bFactor * sinTheta_lambda * sinTheta_lambda)
        : 1;

    let F: Complex = { re: 0, im: 0 };

    for (const atom of structure.atoms) {
        const [x, y, z] = atom.position;
        const phase = 2 * Math.PI * (h * x + k * y + l * z);

        // Get atomic form factor with Debye-Waller damping
        const f = atomicFormFactor(atom.element, sinTheta_lambda) * debyeWaller;

        // exp(i·phase) = cos(phase) + i·sin(phase)
        const expPhase: Complex = {
            re: Math.cos(phase),
            im: Math.sin(phase),
        };

        // Add f · exp(i·phase) to F
        F = complexAdd(F, {
            re: f * expPhase.re,
            im: f * expPhase.im,
        });
    }

    return F;
}

// ============================================================================
// Systematic Absences
// ============================================================================

/**
 * Check if a reflection is systematically absent based on lattice type
 */
export function isSystematicallyAbsent(
    h: number,
    k: number,
    l: number,
    structure: CrystalStructure
): boolean {
    const { latticeType, spaceGroup } = structure;

    // FCC: h, k, l must be all odd or all even
    if (latticeType === 'fcc' || spaceGroup.includes('F')) {
        const parityH = h % 2;
        const parityK = k % 2;
        const parityL = l % 2;
        // Absent if mixed parity
        if (!(parityH === parityK && parityK === parityL)) {
            return true;
        }
    }

    // BCC: h + k + l must be even
    if (latticeType === 'bcc' || spaceGroup.includes('I')) {
        if ((h + k + l) % 2 !== 0) {
            return true;
        }
    }

    // Pbca (space group 61): glide plane and screw axis absences
    // 0kl: k = 2n (k must be even)
    // h0l: l = 2n (l must be even)
    // hk0: h = 2n (h must be even)
    if (spaceGroup === 'Pbca') {
        if (h === 0 && k % 2 !== 0) return true;  // 0kl: k odd -> absent
        if (k === 0 && l % 2 !== 0) return true;  // h0l: l odd -> absent
        if (l === 0 && h % 2 !== 0) return true;  // hk0: h odd -> absent
    }

    return false;
}

/**
 * Check if a reflection is allowed (not systematically absent)
 */
export function isAllowedReflection(
    h: number,
    k: number,
    l: number,
    structure: CrystalStructure
): boolean {
    return !isSystematicallyAbsent(h, k, l, structure);
}

// ============================================================================
// Multiplicity
// ============================================================================

/**
 * Calculate multiplicity for powder diffraction (cubic only for now)
 * This is the number of equivalent (hkl) planes
 */
export function calculateMultiplicity(
    h: number,
    k: number,
    l: number
): number {
    const absH = Math.abs(h);
    const absK = Math.abs(k);
    const absL = Math.abs(l);

    // Sort to get unique representation
    const sorted = [absH, absK, absL].sort((a, b) => b - a);
    const [a, b, c] = sorted;

    // Count permutations and sign changes
    if (a === 0 && b === 0 && c === 0) return 1;
    if (a === b && b === c) return 8; // (hhh) type
    if (a === b || b === c) return 24; // (hhl) or (hll) type
    if (a !== 0 && b !== 0 && c !== 0) return 48; // (hkl) type
    if (c === 0 && a === b) return 12; // (hh0) type
    if (c === 0) return 24; // (hk0) type
    return 24;
}

// ============================================================================
// Powder Pattern Calculation
// ============================================================================

/**
 * Generate all reflections for a powder diffraction pattern
 */
export function calculatePowderPattern(params: DiffractionParams): Reflection[] {
    const { wavelength, structure, maxHKL, twoThetaMax = 180, bFactor = 0 } = params;
    const reflections: Reflection[] = [];
    const seen = new Set<string>();

    const isCubic = structure.latticeType === 'cubic' ||
        structure.latticeType === 'fcc' ||
        structure.latticeType === 'bcc';

    // For cubic systems, h >= k >= l is sufficient due to symmetry
    // For non-cubic systems, we need all independent (h,k,l) combinations
    if (isCubic) {
        // Cubic: iterate h >= k >= l (d-spacing is symmetric in h,k,l)
        for (let h = 0; h <= maxHKL; h++) {
            for (let k = 0; k <= h; k++) {
                for (let l = 0; l <= k; l++) {
                    if (h === 0 && k === 0 && l === 0) continue;
                    if (!isAllowedReflection(h, k, l, structure)) continue;

                    const d = calculateDSpacing(h, k, l, structure);
                    const twoTheta = calculateTwoTheta(d, wavelength);
                    if (isNaN(twoTheta) || twoTheta > twoThetaMax) continue;

                    const key = d.toFixed(6);
                    if (seen.has(key)) continue;
                    seen.add(key);

                    const F = calculateStructureFactor(h, k, l, structure, wavelength, bFactor);
                    const intensity = complexMagnitudeSquared(F);
                    if (intensity < 0.001) continue;

                    const multiplicity = calculateMultiplicity(h, k, l);

                    // Lorentz-polarization factor: (1 + cos²2θ) / (sin²θ · cosθ)
                    const twoThetaRad = twoTheta * Math.PI / 180;
                    const sinTheta = Math.sin(twoThetaRad / 2);
                    const cosTheta = Math.cos(twoThetaRad / 2);
                    const cos2Theta = Math.cos(twoThetaRad);
                    const lp = (1 + cos2Theta * cos2Theta) / (sinTheta * sinTheta * cosTheta);

                    reflections.push({
                        h, k, l,
                        dSpacing: d,
                        twoTheta,
                        intensity: intensity * multiplicity * lp,
                        structureFactor: F,
                        multiplicity,
                    });
                }
            }
        }
    } else {
        // Non-cubic: iterate all h, k, l >= 0 (d-spacing differs for permutations)
        for (let h = 0; h <= maxHKL; h++) {
            for (let k = 0; k <= maxHKL; k++) {
                for (let l = 0; l <= maxHKL; l++) {
                    if (h === 0 && k === 0 && l === 0) continue;
                    if (!isAllowedReflection(h, k, l, structure)) continue;

                    const d = calculateDSpacing(h, k, l, structure);
                    const twoTheta = calculateTwoTheta(d, wavelength);
                    if (isNaN(twoTheta) || twoTheta > twoThetaMax) continue;

                    // Use d-spacing as key to merge truly equivalent reflections
                    const key = d.toFixed(5);
                    if (seen.has(key)) continue;
                    seen.add(key);

                    const F = calculateStructureFactor(h, k, l, structure, wavelength, bFactor);
                    const intensity = complexMagnitudeSquared(F);
                    if (intensity < 0.001) continue;

                    // For non-cubic, multiplicity is simpler (just ±h, ±k, ±l variants)
                    // Count non-zero indices for sign permutations
                    const nonZero = (h !== 0 ? 1 : 0) + (k !== 0 ? 1 : 0) + (l !== 0 ? 1 : 0);
                    const multiplicity = Math.pow(2, nonZero);

                    // Lorentz-polarization factor: (1 + cos²2θ) / (sin²θ · cosθ)
                    const twoThetaRad = twoTheta * Math.PI / 180;
                    const sinTheta = Math.sin(twoThetaRad / 2);
                    const cosTheta = Math.cos(twoThetaRad / 2);
                    const cos2Theta = Math.cos(twoThetaRad);
                    const lp = (1 + cos2Theta * cos2Theta) / (sinTheta * sinTheta * cosTheta);

                    reflections.push({
                        h, k, l,
                        dSpacing: d,
                        twoTheta,
                        intensity: intensity * multiplicity * lp,
                        structureFactor: F,
                        multiplicity,
                    });
                }
            }
        }
    }

    // Sort by 2θ
    reflections.sort((a, b) => a.twoTheta - b.twoTheta);

    // Normalize intensities to max = 100
    const maxIntensity = Math.max(...reflections.map((r) => r.intensity));
    if (maxIntensity > 0) {
        for (const r of reflections) {
            r.intensity = (r.intensity / maxIntensity) * 100;
        }
    }

    // Filter out very weak reflections (< 0.5% of max) to reduce clutter
    // This is especially important for molecular crystals with many overlapping peaks
    return reflections.filter(r => r.intensity >= 0.5);
}

// ============================================================================
// Electron Density (Fourier Synthesis)
// ============================================================================

/**
 * Calculate electron density at a point using Fourier synthesis
 * ρ(r) = (1/V) Σ_hkl F_hkl · exp(-2πi(h·x + k·y + l·z))
 *
 * For visualization, we sum over available reflections
 */
export function calculateElectronDensity(
    x: number,
    y: number,
    z: number,
    reflections: Reflection[],
    structure: CrystalStructure,
    maxHKL: number = 10
): number {
    let density = 0;

    // Sum over all hkl (including negative indices)
    for (let h = -maxHKL; h <= maxHKL; h++) {
        for (let k = -maxHKL; k <= maxHKL; k++) {
            for (let l = -maxHKL; l <= maxHKL; l++) {
                if (h === 0 && k === 0 && l === 0) continue;
                if (!isAllowedReflection(Math.abs(h), Math.abs(k), Math.abs(l), structure)) continue;

                // Find the corresponding reflection (use absolute indices)
                const absH = Math.abs(h);
                const absK = Math.abs(k);
                const absL = Math.abs(l);

                // Calculate structure factor directly for this (h,k,l)
                const F = calculateStructureFactor(h, k, l, structure, CU_K_ALPHA);

                // Phase for this position
                const phase = -2 * Math.PI * (h * x + k * y + l * z);

                // F · exp(-2πi(h·x + k·y + l·z))
                // = (F.re + i·F.im) · (cos(phase) + i·sin(phase))
                // Real part: F.re·cos(phase) - F.im·sin(phase)
                density += F.re * Math.cos(phase) - F.im * Math.sin(phase);
            }
        }
    }

    return density;
}

/**
 * Calculate electron density on a 2D grid (for slice visualization)
 */
export function calculateElectronDensitySlice(
    structure: CrystalStructure,
    sliceZ: number,
    resolution: number,
    maxHKL: number = 8
): number[][] {
    const grid: number[][] = [];

    for (let iy = 0; iy < resolution; iy++) {
        const row: number[] = [];
        const y = iy / resolution;

        for (let ix = 0; ix < resolution; ix++) {
            const x = ix / resolution;
            const density = calculateElectronDensity(
                x,
                y,
                sliceZ,
                [],
                structure,
                maxHKL
            );
            row.push(density);
        }
        grid.push(row);
    }

    return grid;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format Miller indices as string
 */
export function formatHKL(h: number, k: number, l: number): string {
    return `(${h}${k}${l})`;
}

/**
 * Get color for an element (for visualization)
 */
export function getElementColor(element: string): string {
    const colors: Record<string, string> = {
        Na: '#ab5cf2', // Purple
        Cl: '#1ff01f', // Green
        C: '#909090', // Gray
        O: '#ff0d0d', // Red
        Fe: '#e06633', // Orange
        Si: '#f0c8a0', // Beige
        Ca: '#3dff00', // Lime
        K: '#8f40d4', // Violet
        Cs: '#57178f', // Dark purple
        I: '#940094', // Magenta
        Ba: '#00c900', // Green
        Ti: '#bfc2c7', // Silver
    };
    return colors[element] || '#808080';
}

/**
 * Get atomic radius for visualization (in Å)
 */
export function getAtomicRadius(element: string): number {
    const radii: Record<string, number> = {
        Na: 1.86,
        Cl: 1.81,
        C: 0.77,
        O: 0.73,
        Fe: 1.26,
        Si: 1.17,
        Ca: 1.97,
        K: 2.27,
        Cs: 2.65,
        I: 1.98,
        Ba: 2.17,
        Ti: 1.47,
    };
    return radii[element] || 1.5;
}
