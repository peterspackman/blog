/**
 * Shared types for the hydrogen orbital / spherical harmonics component.
 */

/** A single term in an orbital wavefunction expansion. */
export interface OrbitalTerm {
    /** Principal quantum number (1..4). */
    n: number;
    /** Azimuthal quantum number (0..n-1). */
    l: number;
    /** Magnetic quantum number (−l..+l). Sign picks cos (m>0) or sin (m<0). */
    m: number;
    /** Coefficient in the superposition. */
    coeff: number;
    /** Optional complex phase in radians (applies only in complex-basis mode). */
    phase?: number;
}

// --- Unified multi-term representation used by the shader ---

/** A real-spherical-harmonic term: coeff · R_{n,l}(r) · Y_{l,m}(θ,φ). */
export interface SphericalTerm {
    kind: 'spherical';
    n: number;
    l: number;
    m: number;
    coeff: number;
}

/** A raw-Cartesian term: coeff · R_{n, a+b+c}(r) · N(a,b,c) · x^a y^b z^c. */
export interface CartesianTerm {
    kind: 'cartesian';
    n: number;
    a: number;
    b: number;
    c: number;
    coeff: number;
}

/** One summand in the wavefunction. */
export type Term = SphericalTerm | CartesianTerm;

/**
 * A chemistry-labelled preset — one orbital or a hybrid — expressed as a
 * sum of OrbitalTerms. Hybrids are normalized so the total probability
 * integrates to 1.
 */
export interface OrbitalPreset {
    /** Short identifier, stable across renders (e.g. '2p_x', 'sp3_1'). */
    id: string;
    /** Display label with Unicode (e.g. '2p_x', 'd_{z²}'). */
    label: string;
    /** KaTeX-ready label (e.g. '2p_x', 'd_{z^2}') for MathFormula. */
    latex: string;
    /** Category for grouping in the UI. */
    category: 'shell' | 'hybrid' | 'cartesian';
    /** Shell identifier for the 'shell' category ('1s', '2p', '3d', ...). */
    shell?: string;
    terms: OrbitalTerm[];
}

/** How the wavefunction is combined from radial and angular parts. */
export type DisplayMode =
    | 'angular' // Y_l^m alone (with a generic envelope)
    | 'radial' // R_{nl}(r) alone (spherical shell rendering)
    | 'full'; // ψ_{nlm} = R_{nl}(r) · Y_l^m

/** Which rendering technique to use for the 3D field. */
export type RenderMode =
    | 'isosurface' // signed isosurface, two-colour for +/- lobes
    | 'density' // accumulated |ψ|² ray march
    | 'slice'; // 2D textured slice plane

/** Basis in which the angular part is expressed. */
export type AngularBasis =
    | 'spherical-real' // chemistry convention: cos/sin real harmonics
    | 'spherical-complex' // complex Y_l^m with e^{imφ}
    | 'cartesian-raw' // raw monomials x^a y^b z^c (overcomplete for l≥2)
    | 'decomposition'; // show cartesian = s-contamination + proper Y

/** Simplified basis toggle exposed in the UI (Stage 4 short form). */
export type BasisMode = 'spherical' | 'cartesian';
