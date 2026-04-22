/**
 * Symbolic codegen for real spherical harmonics.
 *
 * Runs the OCC Cartesian solid-harmonics recurrence over polynomials in
 * (x, y, z), i.e. multinomials with real coefficients, and emits a
 * straight-line GLSL function `Ylm(int l, int m, float x, float y, float z)`
 * with one hardcoded closed-form expression per (l, m) pair.
 *
 * This replaces the runtime recurrence in the fragment shader: the original
 * approach allocated a 25-float array per fragment, ran the recurrence, and
 * indexed into it with a dynamic m. Profilers hate that. After codegen the
 * shader just evaluates a short polynomial (≤10 monomials even for l=4),
 * with uniform-bound branching over (l, m).
 *
 * The emitted expressions are numerically identical to physics.ts's
 * realSphericalHarmonic (tests in __tests__/codegen.test.ts verify this).
 */

/** A single monomial c · x^i · y^j · z^k. */
interface Mono {
    i: number;
    j: number;
    k: number;
    c: number;
}

/** A polynomial: sum of monomials. */
type Poly = Mono[];

const ZERO: Poly = [];
const ONE: Poly = [{ i: 0, j: 0, k: 0, c: 1 }];
const X: Poly = [{ i: 1, j: 0, k: 0, c: 1 }];
const Y: Poly = [{ i: 0, j: 1, k: 0, c: 1 }];
const Z: Poly = [{ i: 0, j: 0, k: 1, c: 1 }];
const R2: Poly = [
    { i: 2, j: 0, k: 0, c: 1 },
    { i: 0, j: 2, k: 0, c: 1 },
    { i: 0, j: 0, k: 2, c: 1 },
];

function scalePoly(p: Poly, s: number): Poly {
    if (s === 0) return ZERO;
    return p.map((m) => ({ ...m, c: m.c * s }));
}

function addPoly(a: Poly, b: Poly): Poly {
    const out: Poly = [];
    for (const m of a) out.push({ ...m });
    for (const m of b) out.push({ ...m });
    return simplifyPoly(out);
}

function mulMono(a: Mono, b: Mono): Mono {
    return { i: a.i + b.i, j: a.j + b.j, k: a.k + b.k, c: a.c * b.c };
}

function mulPoly(a: Poly, b: Poly): Poly {
    const out: Poly = [];
    for (const mA of a) for (const mB of b) out.push(mulMono(mA, mB));
    return simplifyPoly(out);
}

/** Merge terms with identical exponents; drop zero coefficients. */
function simplifyPoly(p: Poly): Poly {
    const map = new Map<string, number>();
    for (const m of p) {
        const key = `${m.i},${m.j},${m.k}`;
        map.set(key, (map.get(key) ?? 0) + m.c);
    }
    const out: Poly = [];
    for (const [key, c] of map) {
        if (Math.abs(c) < 1e-14) continue;
        const [i, j, k] = key.split(',').map(Number);
        out.push({ i, j, k, c });
    }
    // Stable order: by total degree desc, then by i desc, then by j desc.
    out.sort((a, b) => {
        const dA = a.i + a.j + a.k;
        const dB = b.i + b.j + b.k;
        if (dA !== dB) return dB - dA;
        if (a.i !== b.i) return b.i - a.i;
        if (a.j !== b.j) return b.j - a.j;
        return b.k - a.k;
    });
    return out;
}

/**
 * Run the OCC Cartesian solid-harmonics recurrence with symbolic (x, y, z).
 * Returns the flat array of polynomials at indices matching solidIndex().
 */
export function generateSolidPolynomials(lMax: number): Poly[] {
    const size = (lMax + 1) * (lMax + 1);
    const R: Poly[] = new Array(size);
    for (let i = 0; i < size; i++) R[i] = ZERO;

    R[0] = ONE;
    if (lMax === 0) return R;
    R[1] = Z;
    R[2] = X;
    R[3] = Y;

    for (let k = 1; k < lMax; k++) {
        const n = k + 1;
        const levelN = n * n;
        const levelK = k * k;
        const levelP = (k - 1) * (k - 1);
        const a2kp1 = 2 * k + 1;

        // R[n,0] = (a2kp1 · R[k,0] · z − k · r² · R[k-1,0]) / (k+1)
        R[levelN] = scalePoly(
            addPoly(
                scalePoly(mulPoly(R[levelK], Z), a2kp1),
                scalePoly(mulPoly(R[levelP], R2), -k),
            ),
            1 / (k + 1),
        );

        // R[n,±m] inner, m = 1..k-1 (coupling between k and k-1)
        for (let m = 1; m < k; m++) {
            const denom = Math.sqrt((n + m) * (n - m));
            const coupling = Math.sqrt((k + m) * (k - m));
            R[levelN + 2 * m - 1] = scalePoly(
                addPoly(
                    scalePoly(mulPoly(R[levelK + 2 * m - 1], Z), a2kp1),
                    scalePoly(mulPoly(R[levelP + 2 * m - 1], R2), -coupling),
                ),
                1 / denom,
            );
            R[levelN + 2 * m] = scalePoly(
                addPoly(
                    scalePoly(mulPoly(R[levelK + 2 * m], Z), a2kp1),
                    scalePoly(mulPoly(R[levelP + 2 * m], R2), -coupling),
                ),
                1 / denom,
            );
        }

        // R[n,±k] top: √(n+k) · R[k,±k] · z
        const fTop = Math.sqrt(n + k);
        R[levelN + 2 * k - 1] = scalePoly(mulPoly(R[levelK + 2 * k - 1], Z), fTop);
        R[levelN + 2 * k] = scalePoly(mulPoly(R[levelK + 2 * k], Z), fTop);

        // R[n,±n] new top: s · (x · R[k,k_c] ∓ y · R[k,k_s])
        const s = Math.sqrt(n + k) / Math.sqrt(2 * n);
        const Rkc = R[levelK + 2 * k - 1];
        const Rks = R[levelK + 2 * k];
        R[levelN + 2 * n - 1] = scalePoly(
            addPoly(mulPoly(Rkc, X), scalePoly(mulPoly(Rks, Y), -1)),
            s,
        );
        R[levelN + 2 * n] = scalePoly(addPoly(mulPoly(Rks, X), mulPoly(Rkc, Y)), s);
    }

    return R;
}

/** Evaluate a polynomial numerically (for sanity tests). */
export function evalPoly(p: Poly, x: number, y: number, z: number): number {
    let s = 0;
    for (const m of p) s += m.c * Math.pow(x, m.i) * Math.pow(y, m.j) * Math.pow(z, m.k);
    return s;
}

/** 0-indexed flat index matching solidIndex() in physics.ts. */
function solidIndex(l: number, m: number): number {
    if (m === 0) return l * l;
    if (m > 0) return l * l + 2 * m - 1;
    return l * l + 2 * -m;
}

/** Render a monomial as a GLSL expression (no sign prefix). */
function monoToGLSL(mono: Mono): string {
    const parts: string[] = [];
    for (let r = 0; r < mono.i; r++) parts.push('x');
    for (let r = 0; r < mono.j; r++) parts.push('y');
    for (let r = 0; r < mono.k; r++) parts.push('z');
    const abs = Math.abs(mono.c);
    const vars = parts.join(' * ');
    if (parts.length === 0) return formatFloat(abs);
    if (Math.abs(abs - 1) < 1e-14) return vars;
    return `${formatFloat(abs)} * ${vars}`;
}

function formatFloat(x: number): string {
    // Keep full double precision in the literal; GLSL happily parses ~17 digits.
    const s = x.toPrecision(17);
    return s.includes('.') || s.includes('e') ? s : `${s}.0`;
}

/** Render a polynomial as a signed GLSL expression. */
function polyToGLSL(p: Poly): string {
    if (p.length === 0) return '0.0';
    const parts: string[] = [];
    p.forEach((m, idx) => {
        const sign = m.c < 0 ? '-' : '+';
        const body = monoToGLSL(m);
        if (idx === 0) {
            parts.push(m.c < 0 ? `-${body}` : body);
        } else {
            parts.push(`${sign} ${body}`);
        }
    });
    return parts.join(' ');
}

/**
 * Emit the GLSL for a `Ylm` function covering l = 0..lMax, m = −l..+l. Each
 * case is a closed-form polynomial in (x, y, z) with the proper unit-
 * normalised real-spherical-harmonic prefactor √((2l+1)/(4π)) folded in.
 *
 * The input (x, y, z) is expected to be a unit direction vector. The polys
 * are evaluated as-is — they'll give correct Y_{l,m}(θ,φ) on the unit sphere.
 */
export function generateYlmGLSL(lMax: number): string {
    const polys = generateSolidPolynomials(lMax);
    const lines: string[] = [];
    lines.push('float Ylm(int l, int m, float x, float y, float z) {');
    for (let l = 0; l <= lMax; l++) {
        const N = Math.sqrt((2 * l + 1) / (4 * Math.PI));
        lines.push(`    if (l == ${l}) {`);
        for (let m = -l; m <= l; m++) {
            const poly = scalePoly(polys[solidIndex(l, m)], N);
            lines.push(`        if (m == ${m}) return ${polyToGLSL(poly)};`);
        }
        lines.push(`    }`);
    }
    lines.push('    return 0.0;');
    lines.push('}');
    return lines.join('\n');
}

/** Evaluate Y_{l,m} numerically using the symbolic polynomials (test helper). */
export function evalYlmFromPoly(l: number, m: number, x: number, y: number, z: number): number {
    const polys = generateSolidPolynomials(Math.max(l, 0));
    const N = Math.sqrt((2 * l + 1) / (4 * Math.PI));
    return N * evalPoly(polys[solidIndex(l, m)], x, y, z);
}

/** Maximum l supported by the generated shader. */
export const SHADER_L_MAX = 4;

/** Pre-generated Ylm GLSL (computed once at module load). */
export const YLM_GLSL = generateYlmGLSL(SHADER_L_MAX);

// -----------------------------------------------------------------------
// Cartesian raw monomial basis
//
// For a+b+c = l there are (l+1)(l+2)/2 monomials x^a·y^b·z^c. This basis
// is overcomplete for l ≥ 2 (e.g. six d-functions vs five real Y_{2,m}) —
// the extras carry lower-l contamination (x²+y²+z² = r², an s-like piece).
// Students comparing "x²" against d_{z²} see that they're not the same
// thing, which is the pedagogical payoff of this mode.
//
// Normalization: each monomial is scaled so ∫(N·x^a y^b z^c)² dΩ = 1 over
// the unit sphere — matching the unit-normalization used for Y_{l,m}, so
// peak amplitudes are comparable between the two bases.
// -----------------------------------------------------------------------

/** Γ(k + 1/2) for non-negative integer k. Γ(1/2) = √π. */
function gammaHalfInt(k: number): number {
    let v = Math.sqrt(Math.PI);
    for (let i = 1; i <= k; i++) v *= (2 * i - 1) / 2;
    return v;
}

/**
 * Cartesian monomial normalization factor N so ∫(N·x^a y^b z^c)² dΩ = 1.
 * Derived from ∫_{S²} x^{2a} y^{2b} z^{2c} dΩ = 2·Γ(a+½)Γ(b+½)Γ(c+½)/Γ(l+3/2).
 */
export function cartesianNorm(a: number, b: number, c: number): number {
    const l = a + b + c;
    const I = (2 * gammaHalfInt(a) * gammaHalfInt(b) * gammaHalfInt(c)) / gammaHalfInt(l + 1);
    return 1 / Math.sqrt(I);
}

export interface CartesianMonomial {
    a: number;
    b: number;
    c: number;
    /** Unicode label like "x²y", "xyz", "z⁴". */
    label: string;
}

/** Enumerate all monomials x^a y^b z^c with a+b+c = l, in a stable order. */
export function cartesianMonomials(l: number): CartesianMonomial[] {
    const out: CartesianMonomial[] = [];
    for (let a = l; a >= 0; a--) {
        for (let b = l - a; b >= 0; b--) {
            const c = l - a - b;
            out.push({ a, b, c, label: monoLabel(a, b, c) });
        }
    }
    return out;
}

function monoLabel(a: number, b: number, c: number): string {
    const sup = (n: number) => (['', '', '²', '³', '⁴'][n] ?? `^${n}`);
    const part = (letter: string, n: number) => (n === 0 ? '' : `${letter}${sup(n)}`);
    const s = part('x', a) + part('y', b) + part('z', c);
    return s || '1';
}

/** Emit GLSL for a `RawCart(a, b, c, x, y, z)` function covering l = 0..lMax. */
export function generateRawCartGLSL(lMax: number): string {
    const lines: string[] = [];
    lines.push('float RawCart(int a, int b, int c, float x, float y, float z) {');
    for (let l = 0; l <= lMax; l++) {
        lines.push(`    if (a + b + c == ${l}) {`);
        for (const { a, b, c } of cartesianMonomials(l)) {
            const N = cartesianNorm(a, b, c);
            lines.push(
                `        if (a == ${a} && b == ${b} && c == ${c}) return ${monoBodyGLSL(a, b, c, N)};`,
            );
        }
        lines.push('    }');
    }
    lines.push('    return 0.0;');
    lines.push('}');
    return lines.join('\n');
}

function monoBodyGLSL(a: number, b: number, c: number, N: number): string {
    const parts: string[] = [];
    for (let i = 0; i < a; i++) parts.push('x');
    for (let i = 0; i < b; i++) parts.push('y');
    for (let i = 0; i < c; i++) parts.push('z');
    const nLit = N.toPrecision(17);
    const nPart = nLit.includes('.') || nLit.includes('e') ? nLit : `${nLit}.0`;
    if (parts.length === 0) return nPart;
    return `${nPart} * ${parts.join(' * ')}`;
}

/** Evaluate a raw Cartesian monomial with unit-sphere normalization. */
export function evalRawCart(a: number, b: number, c: number, x: number, y: number, z: number): number {
    return cartesianNorm(a, b, c) * Math.pow(x, a) * Math.pow(y, b) * Math.pow(z, c);
}

/** Pre-generated RawCart GLSL. */
export const RAW_CART_GLSL = generateRawCartGLSL(SHADER_L_MAX);
