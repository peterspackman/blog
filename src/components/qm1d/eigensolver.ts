/**
 * Finite-difference eigensolver for the 1D time-independent Schrödinger equation.
 *
 *   -½ ψ''(x) + V(x) ψ(x) = E ψ(x)   on [xMin, xMax], ψ = 0 at endpoints
 *
 * Natural units: hbar = m = 1.
 *
 * The Hamiltonian is symmetric tridiagonal. We want only the lowest k
 * eigenpairs, so a full O(N³) diagonalization is wasteful.  Strategy:
 *
 *   1. QL algorithm with implicit shifts, WITHOUT accumulating eigenvectors,
 *      gets all N eigenvalues in O(N²).
 *
 *   2. Inverse iteration for each of the k lowest eigenvalues, re-solving a
 *      tridiagonal system at each step (O(N) per solve). Previously-computed
 *      eigenvectors are used for Gram–Schmidt orthogonalization so
 *      near-degenerate pairs (e.g. the double-well splitting) come out clean.
 *
 * The total cost is O(N²) + O(k · N · itersPerEig), which is easily 100×
 * cheaper than accumulating the full N×N eigenvector matrix in QL for a
 * modest k.
 */

export interface Eigenpair {
    /** Sorted eigenvalues, ascending */
    energies: Float64Array;
    /** eigenvectors[n][i] = psi_n(x_i), already L2-normalized */
    eigenvectors: Float64Array[];
    /** Grid points x_i including endpoints (endpoints hold psi = 0) */
    grid: Float64Array;
    xMin: number;
    xMax: number;
}

const INVERSE_ITER_STEPS = 4; // converges quadratically once near the target

/**
 * Solve for the lowest `numStates` eigenstates of V(x) on [xMin, xMax].
 * `gridSize` is the number of interior grid points.
 */
export function solveTISE(
    V: (x: number) => number,
    xMin: number,
    xMax: number,
    gridSize: number,
    numStates: number
): Eigenpair {
    const N = gridSize;
    const dx = (xMax - xMin) / (N + 1);
    const invDx2 = 1 / (dx * dx);

    // Hamiltonian diagonal and sub-diagonal.
    // Convention: e[i] for i = 1 .. N-1 is the coupling between d[i-1] and d[i];
    // e[0] is unused.
    const d = new Float64Array(N);
    const e = new Float64Array(N);
    for (let i = 0; i < N; i++) {
        const x = xMin + (i + 1) * dx;
        d[i] = invDx2 + V(x);
    }
    const offDiag = -0.5 * invDx2;
    for (let i = 1; i < N; i++) e[i] = offDiag;

    // Phase 1: eigenvalues only. tqli destroys its inputs, so pass copies.
    const evDiag = new Float64Array(d);
    const evSub = new Float64Array(N); // shifted to indices [0..N-2]
    for (let i = 0; i < N - 1; i++) evSub[i] = e[i + 1];
    evSub[N - 1] = 0;
    tqliEigenvaluesOnly(evDiag, evSub);

    // Sort and keep the lowest k
    const indices = Array.from({ length: N }, (_, i) => i);
    indices.sort((a, b) => evDiag[a] - evDiag[b]);
    const k = Math.min(numStates, N);
    const energies = new Float64Array(k);
    for (let i = 0; i < k; i++) energies[i] = evDiag[indices[i]];

    // Phase 2: inverse iteration for eigenvectors.
    // We keep interior-only, unit-normalized copies for Gram–Schmidt (cheap
    // dot products), and produce full-grid dx-normalized copies for output.
    const interiorVecs: Float64Array[] = [];
    const eigenvectors: Float64Array[] = [];

    const buf = {
        v: new Float64Array(N),
        w: new Float64Array(N),
        dp: new Float64Array(N),
        rp: new Float64Array(N),
    };

    const fullGrid = new Float64Array(N + 2);
    for (let i = 0; i < N + 2; i++) fullGrid[i] = xMin + i * dx;

    // Conversion factor between unit norm (Σv² = 1) and dx norm (Σv²·dx = 1).
    const dxScale = 1 / Math.sqrt(dx);

    for (let n = 0; n < k; n++) {
        const interior = inverseIterationTridiag(
            d,
            e,
            energies[n],
            interiorVecs,
            buf
        );
        interiorVecs.push(interior);

        const vec = new Float64Array(N + 2);
        for (let i = 0; i < N; i++) vec[i + 1] = interior[i] * dxScale;

        // Sign convention: make first non-negligible component positive so
        // eigenvectors don't flip sign between renders when parameters change.
        let peak = 0;
        for (let i = 0; i < N + 2; i++) {
            const a = Math.abs(vec[i]);
            if (a > peak) peak = a;
        }
        const thresh = 1e-6 * peak;
        let sign = 1;
        for (let i = 0; i < N + 2; i++) {
            if (Math.abs(vec[i]) > thresh) {
                sign = vec[i] >= 0 ? 1 : -1;
                break;
            }
        }
        if (sign < 0) for (let i = 0; i < N + 2; i++) vec[i] = -vec[i];

        eigenvectors.push(vec);
    }

    return { energies, eigenvectors, grid: fullGrid, xMin, xMax };
}

// ---------------------------------------------------------------------------
// Inverse iteration for a specific eigenvalue of a symmetric tridiagonal
// matrix.  Returns the interior-only eigenvector (length N).
// ---------------------------------------------------------------------------

function inverseIterationTridiag(
    d: Float64Array,
    e: Float64Array,
    lambda: number,
    previousVecs: Float64Array[],
    buf: {
        v: Float64Array;
        w: Float64Array;
        dp: Float64Array;
        rp: Float64Array;
    }
): Float64Array {
    const N = d.length;
    const v = buf.v;
    const w = buf.w;

    // Tiny perturbation to keep (T - lambda I) non-singular during Thomas solve.
    // Too small and we get Inf/NaN; too large and convergence slows.
    const eps = Math.max(Math.abs(lambda), 1) * 1e-10;
    const shift = lambda + eps;

    // Starting vector: fixed pseudo-random pattern seeded by N and lambda so
    // it's deterministic across renders. A smooth start helps when lambda
    // corresponds to a low-node-count eigenvector.
    for (let i = 0; i < N; i++) {
        v[i] = Math.sin((i + 1) * (0.13 + 0.0001 * (lambda + 5)));
    }
    orthogonalize(v, previousVecs);
    normalize(v);

    for (let iter = 0; iter < INVERSE_ITER_STEPS; iter++) {
        solveShiftedTridiag(d, e, shift, v, w, buf.dp, buf.rp);
        orthogonalize(w, previousVecs);
        normalize(w);
        // Swap v and w for the next iteration (cheap)
        for (let i = 0; i < N; i++) v[i] = w[i];
    }

    // Return a fresh copy (v/w are reused buffers)
    const out = new Float64Array(N);
    for (let i = 0; i < N; i++) out[i] = v[i];
    return out;
}

function orthogonalize(v: Float64Array, previous: Float64Array[]): void {
    for (const u of previous) {
        let dot = 0;
        for (let i = 0; i < v.length; i++) dot += v[i] * u[i];
        if (Math.abs(dot) < 1e-14) continue;
        for (let i = 0; i < v.length; i++) v[i] -= dot * u[i];
    }
}

function normalize(v: Float64Array): void {
    let s = 0;
    for (let i = 0; i < v.length; i++) s += v[i] * v[i];
    if (s <= 0) return;
    const inv = 1 / Math.sqrt(s);
    for (let i = 0; i < v.length; i++) v[i] *= inv;
}

/**
 * Solve (T − shift·I) x = rhs for a symmetric tridiagonal T with diagonal d
 * and sub-/super-diagonal e[1..N-1]. Uses the Thomas algorithm in place on
 * provided work buffers dp, rp.
 */
function solveShiftedTridiag(
    d: Float64Array,
    e: Float64Array,
    shift: number,
    rhs: Float64Array,
    out: Float64Array,
    dp: Float64Array,
    rp: Float64Array
): void {
    const N = d.length;

    // Initialize shifted diagonal and a copy of rhs
    dp[0] = d[0] - shift;
    rp[0] = rhs[0];

    // Forward elimination
    for (let i = 1; i < N; i++) {
        // Guard against near-zero pivot — if we happen to hit one, nudge it.
        if (Math.abs(dp[i - 1]) < 1e-300) dp[i - 1] = 1e-300;
        const m = e[i] / dp[i - 1];
        dp[i] = d[i] - shift - m * e[i];
        rp[i] = rhs[i] - m * rp[i - 1];
    }

    // Back substitution
    if (Math.abs(dp[N - 1]) < 1e-300) dp[N - 1] = 1e-300;
    out[N - 1] = rp[N - 1] / dp[N - 1];
    for (let i = N - 2; i >= 0; i--) {
        out[i] = (rp[i] - e[i + 1] * out[i + 1]) / dp[i];
    }
}

// ---------------------------------------------------------------------------
// Symmetric tridiagonal QL algorithm, eigenvalues only.
// Port of Numerical Recipes `tqli` without eigenvector accumulation.
// d: diagonal, length N (modified in place to hold eigenvalues)
// sub: e[i] for i=0..N-2 is the element between d[i] and d[i+1]; sub[N-1]=0
// ---------------------------------------------------------------------------
function tqliEigenvaluesOnly(d: Float64Array, sub: Float64Array): void {
    const N = d.length;
    if (N === 0) return;

    const MAX_ITER = 30;
    for (let l = 0; l < N; l++) {
        let iter = 0;
        let m: number;
        do {
            for (m = l; m < N - 1; m++) {
                const dd = Math.abs(d[m]) + Math.abs(d[m + 1]);
                if (Math.abs(sub[m]) + dd === dd) break;
            }
            if (m !== l) {
                if (iter++ === MAX_ITER) {
                    throw new Error('tqli: too many iterations');
                }
                let g = (d[l + 1] - d[l]) / (2 * sub[l]);
                let r = Math.hypot(g, 1);
                g = d[m] - d[l] + sub[l] / (g + (g >= 0 ? Math.abs(r) : -Math.abs(r)));
                let s = 1;
                let c = 1;
                let p = 0;
                let i: number;
                for (i = m - 1; i >= l; i--) {
                    const f = s * sub[i];
                    const b = c * sub[i];
                    r = Math.hypot(f, g);
                    sub[i + 1] = r;
                    if (r === 0) {
                        d[i + 1] -= p;
                        sub[m] = 0;
                        break;
                    }
                    s = f / r;
                    c = g / r;
                    g = d[i + 1] - p;
                    const t = (d[i] - g) * s + 2 * c * b;
                    p = s * t;
                    d[i + 1] = g + p;
                    g = c * t - b;
                }
                if (r === 0 && i >= l) continue;
                d[l] -= p;
                sub[l] = g;
                sub[m] = 0;
            }
        } while (m !== l);
    }
}
