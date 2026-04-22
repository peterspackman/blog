/**
 * Physics primitives for hydrogen orbitals and spherical harmonics.
 *
 * The angular part is computed via a Cartesian solid-harmonics recurrence
 * (ported from OCC's dma/solid_harmonics.cpp). This avoids the polar
 * conversion and z-axis singularity of the standard associated-Legendre
 * path, and compiles cleanly to GLSL.
 *
 * The radial part uses explicit closed-form R_{nl}(r) for n = 1..4 in
 * atomic units (a₀ = ℏ = m_e = 1).
 *
 * Conventions:
 *   - Real spherical harmonics (chemistry).
 *     m > 0  → cosine component  (e.g. Y_{1,+1} = p_x, Y_{2,+2} = d_{x²−y²})
 *     m < 0  → sine component    (e.g. Y_{1,−1} = p_y, Y_{2,−2} = d_{xy})
 *     m = 0  → real              (e.g. Y_{1,0}  = p_z, Y_{2,0}  = d_{z²})
 *   - Unit-normalized: ∫|Y_l^m|² dΩ = 1 over the sphere.
 */

const FOUR_PI = 4 * Math.PI;

/**
 * Index of (l, m) in the flat solid-harmonics array.
 * Layout: Y_{l,0} at l², Y_{l,+|m|} at l²+2|m|−1, Y_{l,−|m|} at l²+2|m|.
 * Total size for L_max is (L_max+1)².
 */
export function solidIndex(l: number, m: number): number {
    if (m === 0) return l * l;
    if (m > 0) return l * l + 2 * m - 1;
    return l * l + 2 * (-m);
}

/**
 * Cartesian solid-harmonics recurrence (regular form r^l · Y_{l,m}, up to a
 * uniform per-l normalization). Returns a flat array of length (lMax+1)²
 * indexed by solidIndex(l, m).
 *
 * Ported from occ::dma::solid_harmonics. The output of index (l, m) is the
 * Racah form r^l · C_{l,m}(θ,φ); to recover the unit-normalized real
 * spherical harmonic, divide by r^l and multiply by sqrt((2l+1)/(4π)).
 */
export function solidHarmonicsRecurrence(
    lMax: number,
    x: number,
    y: number,
    z: number,
): Float64Array {
    const size = (lMax + 1) * (lMax + 1);
    const R = new Float64Array(size);
    const r2 = x * x + y * y + z * z;

    R[0] = 1; // R_{0,0}
    if (lMax === 0) return R;

    R[1] = z; // R_{1,0}
    R[2] = x; // R_{1,+1} (cosine)
    R[3] = y; // R_{1,-1} (sine)

    for (let k = 1; k < lMax; k++) {
        const n = k + 1;
        const levelN = n * n;
        const levelK = k * k;
        const levelP = (k - 1) * (k - 1);
        const a2kp1 = 2 * k + 1;

        // R_{n,0} from R_{k,0} and R_{k-1,0}
        R[levelN] = (a2kp1 * R[levelK] * z - k * r2 * R[levelP]) / (k + 1);

        // R_{n,±m} for m = 1..k-1 (both c and s components couple to k-1)
        for (let m = 1; m < k; m++) {
            const denom = Math.sqrt((n + m) * (n - m));
            const coupling = Math.sqrt((k + m) * (k - m));
            const iN_c = levelN + 2 * m - 1;
            const iN_s = levelN + 2 * m;
            const iK_c = levelK + 2 * m - 1;
            const iK_s = levelK + 2 * m;
            const iP_c = levelP + 2 * m - 1;
            const iP_s = levelP + 2 * m;
            R[iN_c] = (a2kp1 * R[iK_c] * z - coupling * r2 * R[iP_c]) / denom;
            R[iN_s] = (a2kp1 * R[iK_s] * z - coupling * r2 * R[iP_s]) / denom;
        }

        // R_{n,±k}: top of k level, no (k-1) coupling
        {
            const f = Math.sqrt(n + k);
            const iK_c = levelK + 2 * k - 1;
            const iK_s = levelK + 2 * k;
            R[levelN + 2 * k - 1] = f * R[iK_c] * z;
            R[levelN + 2 * k] = f * R[iK_s] * z;
        }

        // R_{n,±n}: new top, built from R_{k,±k} × (x ± iy)
        {
            const s = Math.sqrt(n + k) / Math.sqrt(2 * n);
            const iK_c = levelK + 2 * k - 1;
            const iK_s = levelK + 2 * k;
            R[levelN + 2 * n - 1] = s * (x * R[iK_c] - y * R[iK_s]);
            R[levelN + 2 * n] = s * (x * R[iK_s] + y * R[iK_c]);
        }
    }

    return R;
}

/**
 * Real spherical harmonic Y_{l,m}(θ,φ) evaluated at the unit vector along
 * (x, y, z). Chemistry convention (m>0 = cos, m<0 = sin). Unit-normalized.
 *
 * For (x, y, z) of arbitrary length, returns Y_{l,m} on the unit vector
 * in that direction (r dependence is divided out).
 */
export function realSphericalHarmonic(
    l: number,
    m: number,
    x: number,
    y: number,
    z: number,
): number {
    if (Math.abs(m) > l) return 0;
    const r2 = x * x + y * y + z * z;
    if (r2 < 1e-20) return l === 0 ? Math.sqrt(1 / FOUR_PI) : 0;
    const R = solidHarmonicsRecurrence(l, x, y, z);
    const rL = Math.pow(Math.sqrt(r2), l);
    const N = Math.sqrt((2 * l + 1) / FOUR_PI);
    return (R[solidIndex(l, m)] / rL) * N;
}

/**
 * Real spherical harmonic evaluated at direction (θ, φ). Equivalent to
 * realSphericalHarmonic(l, m, sinθ·cosφ, sinθ·sinφ, cosθ) but takes polar
 * inputs directly. Useful for 1D plots vs. angle.
 */
export function realSphericalHarmonicAngular(
    l: number,
    m: number,
    theta: number,
    phi: number,
): number {
    const sT = Math.sin(theta);
    return realSphericalHarmonic(l, m, sT * Math.cos(phi), sT * Math.sin(phi), Math.cos(theta));
}

/**
 * Evaluate a superposition of real spherical harmonics Σ cᵢ · Y_{lᵢ,mᵢ}
 * at the unit direction (x, y, z). Computes the recurrence once up to the
 * max l in the term list.
 */
export interface AngularTerm {
    l: number;
    m: number;
    coeff: number;
}

export function evalAngularSuperposition(
    terms: readonly AngularTerm[],
    x: number,
    y: number,
    z: number,
): number {
    if (terms.length === 0) return 0;
    let lMax = 0;
    for (const t of terms) if (t.l > lMax) lMax = t.l;
    const r2 = x * x + y * y + z * z;
    if (r2 < 1e-20) {
        let v = 0;
        for (const t of terms) if (t.l === 0) v += t.coeff * Math.sqrt(1 / FOUR_PI);
        return v;
    }
    const R = solidHarmonicsRecurrence(lMax, x, y, z);
    const r = Math.sqrt(r2);
    let sum = 0;
    for (const t of terms) {
        const N = Math.sqrt((2 * t.l + 1) / FOUR_PI);
        const rL = Math.pow(r, t.l);
        sum += t.coeff * (R[solidIndex(t.l, t.m)] / rL) * N;
    }
    return sum;
}

// -------------------------------------------------------------------------
// Radial functions R_{nl}(r) for hydrogen-like atoms (closed forms, n ≤ 4).
// Atomic units: r in Bohr radii, ∫|R|² r² dr = 1.
// -------------------------------------------------------------------------

export function radialR(n: number, l: number, r: number, Z = 1): number {
    if (l < 0 || l >= n) return 0;
    if (r < 0) return 0;
    const Zr = Z * r;
    const Z32 = Math.pow(Z, 1.5);

    switch (n) {
        case 1:
            // 1s
            return 2 * Z32 * Math.exp(-Zr);

        case 2: {
            const e = Math.exp(-Zr / 2);
            if (l === 0) return (1 / (2 * Math.SQRT2)) * Z32 * (2 - Zr) * e;
            if (l === 1) return (1 / (2 * Math.sqrt(6))) * Z32 * Zr * e;
            return 0;
        }

        case 3: {
            const e = Math.exp(-Zr / 3);
            const Zr2 = Zr * Zr;
            if (l === 0)
                return (2 / (81 * Math.sqrt(3))) * Z32 * (27 - 18 * Zr + 2 * Zr2) * e;
            if (l === 1)
                return (4 / (81 * Math.sqrt(6))) * Z32 * Zr * (6 - Zr) * e;
            if (l === 2)
                return (4 / (81 * Math.sqrt(30))) * Z32 * Zr2 * e;
            return 0;
        }

        case 4: {
            const e = Math.exp(-Zr / 4);
            const Zr2 = Zr * Zr;
            const Zr3 = Zr2 * Zr;
            if (l === 0)
                return (1 / 768) * Z32 * (192 - 144 * Zr + 24 * Zr2 - Zr3) * e;
            if (l === 1)
                return (1 / (256 * Math.sqrt(15))) * Z32 * Zr * (80 - 20 * Zr + Zr2) * e;
            if (l === 2)
                return (1 / (768 * Math.sqrt(5))) * Z32 * Zr2 * (12 - Zr) * e;
            if (l === 3)
                return (1 / (768 * Math.sqrt(35))) * Z32 * Zr3 * e;
            return 0;
        }

        default:
            return 0;
    }
}

/**
 * Radial probability density r² |R_{nl}(r)|² — what undergraduates actually
 * plot on the 1D radial chart. Integrates to 1 over r ∈ [0, ∞).
 */
export function radialProbabilityDensity(n: number, l: number, r: number, Z = 1): number {
    const R = radialR(n, l, r, Z);
    return r * r * R * R;
}

/**
 * Full hydrogen orbital ψ_{nlm}(r, θ, φ) = R_{nl}(r) · Y_{l,m}(θ,φ), using the
 * real-harmonic convention for m.
 */
export function hydrogenPsi(
    n: number,
    l: number,
    m: number,
    x: number,
    y: number,
    z: number,
    Z = 1,
): number {
    if (l >= n || Math.abs(m) > l) return 0;
    const r = Math.sqrt(x * x + y * y + z * z);
    const R = radialR(n, l, r, Z);
    if (R === 0) return 0;
    return R * realSphericalHarmonic(l, m, x, y, z);
}

/**
 * Energy eigenvalue for hydrogen-like atom, in eV.
 * E_n = −13.6057 · Z² / n²
 */
export function hydrogenEnergy(n: number, Z = 1): number {
    return (-13.605693 * Z * Z) / (n * n);
}

/**
 * Number of radial nodes for a given (n, l): n − l − 1.
 * Number of angular nodes: l.
 */
export function nodeCount(n: number, l: number): { radial: number; angular: number } {
    return { radial: Math.max(0, n - l - 1), angular: l };
}

/** Description of one summand for use in estimateFieldMaxForTerms. */
export type EstTerm =
    | { kind: 'spherical'; n: number; l: number; m: number; coeff: number }
    | { kind: 'cartesian'; n: number; a: number; b: number; c: number; coeff: number; norm: number };

/** Describes the current render target so one grid sample can drive both
 *  normScale estimation and probability-iso computation. */
export type SampleSpec =
    | { mode: 'angular'; terms: readonly EstTerm[]; envelopeScale: number }
    | { mode: 'full'; terms: readonly EstTerm[] }
    | { mode: 'radial'; n: number; l: number };

/**
 * Sample the current field on a uniform grid inside the bounding sphere.
 * Returns all signed values plus max|field|. Grid size defaults to 20³ for
 * responsiveness (8k samples, ~5ms in JS for eight terms).
 */
export function sampleFieldOnGrid(
    spec: SampleSpec,
    boundingRadius: number,
    Z = 1,
    gridN = 20,
): { values: Float32Array; maxAbs: number } {
    const INV_SQRT_4PI = Math.sqrt(1 / FOUR_PI);
    const step = (2 * boundingRadius) / gridN;
    const bound = boundingRadius * boundingRadius;
    const buf: number[] = [];
    let maxAbs = 0;

    for (let i = 0; i < gridN; i++) {
        const x = -boundingRadius + (i + 0.5) * step;
        for (let j = 0; j < gridN; j++) {
            const y = -boundingRadius + (j + 0.5) * step;
            for (let k = 0; k < gridN; k++) {
                const z = -boundingRadius + (k + 0.5) * step;
                const r2 = x * x + y * y + z * z;
                if (r2 > bound) continue;
                const r = Math.sqrt(r2);
                if (r < 1e-8) continue;

                let v = 0;
                if (spec.mode === 'radial') {
                    v = radialR(spec.n, spec.l, r, Z) * INV_SQRT_4PI;
                } else {
                    const envelope =
                        spec.mode === 'angular'
                            ? Math.exp(-r / Math.max(spec.envelopeScale, 0.01))
                            : 0;
                    for (const t of spec.terms) {
                        let ang: number;
                        let lEq: number;
                        if (t.kind === 'spherical') {
                            ang = realSphericalHarmonic(t.l, t.m, x, y, z);
                            lEq = t.l;
                        } else {
                            const xh = x / r, yh = y / r, zh = z / r;
                            ang =
                                t.norm *
                                Math.pow(xh, t.a) *
                                Math.pow(yh, t.b) *
                                Math.pow(zh, t.c);
                            lEq = t.a + t.b + t.c;
                        }
                        const rad = spec.mode === 'angular' ? envelope : radialR(t.n, lEq, r, Z);
                        v += t.coeff * ang * rad;
                    }
                }
                buf.push(v);
                const av = Math.abs(v);
                if (av > maxAbs) maxAbs = av;
            }
        }
    }

    return { values: Float32Array.from(buf), maxAbs };
}

/**
 * Find the iso level |F| = iso* such that the set {|F| > iso*} contains
 * `fraction` of the total |F|² mass on the sampled grid. This is the
 * standard "contour encloses X% of probability" convention used by
 * chemistry visualization software.
 *
 * Since every grid cell has the same dV, it factors out of the ratio.
 */
export function isoForProbability(values: Float32Array | number[], fraction: number): number {
    if (fraction <= 0) return Number.POSITIVE_INFINITY;
    if (fraction >= 1) return 0;
    const N = values.length;
    if (N === 0) return 0;
    const mag = new Float64Array(N);
    let totalSq = 0;
    for (let i = 0; i < N; i++) {
        const v = Math.abs(values[i]);
        mag[i] = v;
        totalSq += v * v;
    }
    if (totalSq < 1e-20) return 0;
    // Sort ascending (typed arrays are faster than converting to number[])
    mag.sort();
    // Walk from the top, accumulating until we've enclosed the target mass.
    const target = fraction * totalSq;
    let accum = 0;
    for (let i = N - 1; i >= 0; i--) {
        const v = mag[i];
        accum += v * v;
        if (accum >= target) return v;
    }
    return mag[0];
}

/**
 * Estimate max|Σ cᵢ · fᵢ(r,θ,φ)| on a grid inside the bounding sphere, for
 * either 'angular' mode (envelope in place of R_{nl}) or 'full' mode
 * (R_{n_i,l_eq}(r) as the radial factor per term).
 */
export function estimateFieldMaxForTerms(
    mode: 'angular' | 'full',
    terms: readonly EstTerm[],
    boundingRadius: number,
    envelopeScale = 2,
    Z = 1,
): number {
    if (terms.length === 0) return 1;
    const N = 20;
    const step = (2 * boundingRadius) / N;
    let maxAbs = 0;

    for (let i = 0; i < N; i++) {
        const x = -boundingRadius + (i + 0.5) * step;
        for (let j = 0; j < N; j++) {
            const y = -boundingRadius + (j + 0.5) * step;
            for (let k = 0; k < N; k++) {
                const z = -boundingRadius + (k + 0.5) * step;
                const r2 = x * x + y * y + z * z;
                if (r2 > boundingRadius * boundingRadius) continue;
                const r = Math.sqrt(r2);
                if (r < 1e-8) continue;

                const envelope =
                    mode === 'angular' ? Math.exp(-r / Math.max(envelopeScale, 0.01)) : 0;

                let sum = 0;
                for (const t of terms) {
                    let ang: number;
                    let lEq: number;
                    if (t.kind === 'spherical') {
                        ang = realSphericalHarmonic(t.l, t.m, x, y, z);
                        lEq = t.l;
                    } else {
                        const xh = x / r, yh = y / r, zh = z / r;
                        ang = t.norm
                            * Math.pow(xh, t.a)
                            * Math.pow(yh, t.b)
                            * Math.pow(zh, t.c);
                        lEq = t.a + t.b + t.c;
                    }
                    const rad = mode === 'angular' ? envelope : radialR(t.n, lEq, r, Z);
                    sum += t.coeff * ang * rad;
                }
                const s = Math.abs(sum);
                if (s > maxAbs) maxAbs = s;
            }
        }
    }
    return maxAbs > 1e-12 ? maxAbs : 1;
}

/**
 * Estimate max|field| on a sampled grid within the bounding sphere. Used to
 * auto-scale density/slice colour intensity so the rendering looks comparable
 * across modes (angular Y_l^m is O(1); radial R_{nl} for n=4 peaks at O(0.01)).
 *
 * 'mode' mirrors DisplayMode: 'angular' | 'radial' | 'full'. In angular mode
 * a cartesian monomial x^a y^b z^c (with normalisation) may be used instead
 * of Y_{l,m} via the optional `cartesian` argument.
 */
export function estimateFieldMax(
    mode: 'angular' | 'radial' | 'full',
    n: number,
    l: number,
    m: number,
    boundingRadius: number,
    envelopeScale = 2,
    Z = 1,
    cartesian?: { a: number; b: number; c: number; norm: number },
): number {
    const N = 20;
    const step = (2 * boundingRadius) / N;
    let maxAbs = 0;
    const INV_SQRT_4PI = Math.sqrt(1 / FOUR_PI);

    for (let i = 0; i < N; i++) {
        const x = -boundingRadius + (i + 0.5) * step;
        for (let j = 0; j < N; j++) {
            const y = -boundingRadius + (j + 0.5) * step;
            for (let k = 0; k < N; k++) {
                const z = -boundingRadius + (k + 0.5) * step;
                const r2 = x * x + y * y + z * z;
                if (r2 > boundingRadius * boundingRadius) continue;
                const r = Math.sqrt(r2);

                let v = 0;
                if (mode === 'angular') {
                    if (r < 1e-8) continue;
                    const envelope = Math.exp(-r / Math.max(envelopeScale, 0.01));
                    if (cartesian) {
                        const xh = x / r, yh = y / r, zh = z / r;
                        v = cartesian.norm
                            * Math.pow(xh, cartesian.a)
                            * Math.pow(yh, cartesian.b)
                            * Math.pow(zh, cartesian.c)
                            * envelope;
                    } else {
                        v = realSphericalHarmonic(l, m, x, y, z) * envelope;
                    }
                } else if (mode === 'radial') {
                    v = radialR(n, l, r, Z) * INV_SQRT_4PI;
                } else {
                    v = hydrogenPsi(n, l, m, x, y, z, Z);
                }
                const av = Math.abs(v);
                if (av > maxAbs) maxAbs = av;
            }
        }
    }
    return maxAbs > 1e-12 ? maxAbs : 1;
}

// -------------------------------------------------------------------------
// Complex spherical harmonics via fully-normalized associated Legendre
// recurrence (ported from occ::sht::AssocLegendreP + SphericalHarmonics).
// Used for the "show the complex basis" toggle and for cross-verification.
// -------------------------------------------------------------------------

/**
 * Fully-normalized associated Legendre P̃_l^m(x) with all spherical-harmonic
 * factors baked in. After multiplication by e^{imφ} this gives the complex
 * spherical harmonic Y_l^m(θ,φ) directly (Condon-Shortley phase included).
 */
export function normalizedLegendre(l: number, m: number, x: number): number {
    if (m < 0 || m > l) return 0;

    // a_{m,m} = sqrt(prod_{k=1..m} (2k+1)/(2k) / (4π))
    let amm = 1 / FOUR_PI;
    for (let k = 1; k <= m; k++) amm *= (2 * k + 1) / (2 * k);
    amm = Math.sqrt(amm);

    // P_{m,m}(x) = a_{m,m} · (1-x²)^{m/2}
    const sinPow = Math.pow(1 - x * x, 0.5 * m);
    let pPrev2 = 0;
    let pPrev1 = amm * sinPow;
    if (l === m) return pPrev1;

    // P_{m+1,m}(x) = a_{m+1,m} · x · P_{m,m}(x)
    const alm_m1 = Math.sqrt((4 * (m + 1) * (m + 1) - 1) / ((m + 1) * (m + 1) - m * m));
    let pCurr = alm_m1 * x * pPrev1;
    if (l === m + 1) return pCurr;

    // Recurrence up to l
    pPrev2 = pPrev1;
    pPrev1 = pCurr;
    for (let ll = m + 2; ll <= l; ll++) {
        const a = Math.sqrt((4 * ll * ll - 1) / (ll * ll - m * m));
        const b = -Math.sqrt(
            ((2 * ll + 1) * ((ll - 1) * (ll - 1) - m * m)) /
                ((2 * ll - 3) * (ll * ll - m * m)),
        );
        pCurr = a * x * pPrev1 + b * pPrev2;
        pPrev2 = pPrev1;
        pPrev1 = pCurr;
    }
    return pCurr;
}

export interface Complex {
    re: number;
    im: number;
}

/**
 * Complex spherical harmonic Y_l^m(θ,φ) following the OCC convention:
 *   Y_l^m   = (-1)^m · P̃_l^|m| · e^{imφ}   for m > 0  (Condon-Shortley phase)
 *   Y_l^0   = P̃_l^0
 *   Y_l^{-|m|} = P̃_l^{|m|} · e^{-i|m|φ}   for m < 0
 * Equivalent to the standard identity Y_l^{-m} = (-1)^m · conj(Y_l^m).
 */
export function complexSphericalHarmonic(
    l: number,
    m: number,
    theta: number,
    phi: number,
): Complex {
    if (Math.abs(m) > l) return { re: 0, im: 0 };
    const p = normalizedLegendre(l, Math.abs(m), Math.cos(theta));
    const phase = m > 0 && m % 2 !== 0 ? -1 : 1;
    const mag = phase * p;
    const angle = m * phi;
    return { re: mag * Math.cos(angle), im: mag * Math.sin(angle) };
}

/**
 * Build the real spherical harmonic as a linear combination of complex
 * ones. Used for the pedagogical "real = LC of complex" view.
 *
 * Y_{l,+|m|,real} = (Y_l^{-|m|} + (-1)^|m| Y_l^{+|m|}) / √2
 * Y_{l,-|m|,real} = i · (Y_l^{-|m|} - (-1)^|m| Y_l^{+|m|}) / √2
 */
export function realFromComplex(
    l: number,
    m: number,
    theta: number,
    phi: number,
): number {
    if (m === 0) return complexSphericalHarmonic(l, 0, theta, phi).re;
    const absM = Math.abs(m);
    const yPlus = complexSphericalHarmonic(l, absM, theta, phi);
    const yMinus = complexSphericalHarmonic(l, -absM, theta, phi);
    const sign = absM % 2 === 0 ? 1 : -1; // (-1)^|m|
    const invSqrt2 = 1 / Math.SQRT2;
    if (m > 0) {
        // Re: (yMinus.re + sign·yPlus.re)/√2
        return invSqrt2 * (yMinus.re + sign * yPlus.re);
    }
    // m < 0: i · (yMinus - sign·yPlus)/√2 → Re = −Im part
    return invSqrt2 * -(yMinus.im - sign * yPlus.im);
}
