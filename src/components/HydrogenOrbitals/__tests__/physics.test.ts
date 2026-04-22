import { describe, expect, it } from 'vitest';
import {
    realSphericalHarmonic,
    realSphericalHarmonicAngular,
    solidHarmonicsRecurrence,
    solidIndex,
    complexSphericalHarmonic,
    realFromComplex,
    evalAngularSuperposition,
    radialR,
    radialProbabilityDensity,
    hydrogenPsi,
    hydrogenEnergy,
    nodeCount,
    sampleFieldOnGrid,
    isoForProbability,
} from '../physics';
import { ALL_PRESETS, findPreset, HYBRID_PRESETS, SHELL_PRESETS } from '../presets';

const FOUR_PI = 4 * Math.PI;
const CLOSE = 1e-10;
const LOOSE = 1e-5;

describe('solidIndex layout', () => {
    it('assigns correct flat positions', () => {
        expect(solidIndex(0, 0)).toBe(0);
        expect(solidIndex(1, 0)).toBe(1);
        expect(solidIndex(1, +1)).toBe(2);
        expect(solidIndex(1, -1)).toBe(3);
        expect(solidIndex(2, 0)).toBe(4);
        expect(solidIndex(2, +1)).toBe(5);
        expect(solidIndex(2, -1)).toBe(6);
        expect(solidIndex(2, +2)).toBe(7);
        expect(solidIndex(2, -2)).toBe(8);
        expect(solidIndex(3, +3)).toBe(14);
        expect(solidIndex(3, -3)).toBe(15);
    });
});

describe('realSphericalHarmonic - known values', () => {
    it('Y_{0,0} is constant 1/√(4π) everywhere', () => {
        const expected = Math.sqrt(1 / FOUR_PI);
        for (const p of [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
            [1, 1, 1],
            [-0.3, 0.7, 0.5],
        ]) {
            expect(realSphericalHarmonic(0, 0, p[0], p[1], p[2])).toBeCloseTo(expected, 10);
        }
    });

    it('Y_{1,0} = √(3/4π) · z/r (p_z)', () => {
        const N = Math.sqrt(3 / FOUR_PI);
        expect(realSphericalHarmonic(1, 0, 0, 0, 1)).toBeCloseTo(N, 10);
        expect(realSphericalHarmonic(1, 0, 0, 0, -1)).toBeCloseTo(-N, 10);
        expect(realSphericalHarmonic(1, 0, 1, 0, 0)).toBeCloseTo(0, 10);
        expect(realSphericalHarmonic(1, 0, 0, 0, 2)).toBeCloseTo(N, 10); // unit direction
    });

    it('Y_{1,+1} = √(3/4π) · x/r (p_x) — m > 0 is cosine', () => {
        const N = Math.sqrt(3 / FOUR_PI);
        expect(realSphericalHarmonic(1, +1, 1, 0, 0)).toBeCloseTo(N, 10);
        expect(realSphericalHarmonic(1, +1, 0, 1, 0)).toBeCloseTo(0, 10);
        expect(realSphericalHarmonic(1, +1, 0, 0, 1)).toBeCloseTo(0, 10);
    });

    it('Y_{1,-1} = √(3/4π) · y/r (p_y) — m < 0 is sine', () => {
        const N = Math.sqrt(3 / FOUR_PI);
        expect(realSphericalHarmonic(1, -1, 0, 1, 0)).toBeCloseTo(N, 10);
        expect(realSphericalHarmonic(1, -1, 1, 0, 0)).toBeCloseTo(0, 10);
    });

    it('Y_{2,0} = √(5/16π) · (3z²−r²)/r² (d_{z²})', () => {
        // At pole (θ=0): √(5/16π) · 2 = √(5/4π)
        expect(realSphericalHarmonic(2, 0, 0, 0, 1)).toBeCloseTo(Math.sqrt(5 / FOUR_PI), 10);
        // At equator (θ=π/2): √(5/16π) · (−1)
        expect(realSphericalHarmonic(2, 0, 1, 0, 0)).toBeCloseTo(
            -Math.sqrt(5 / (4 * FOUR_PI)),
            10,
        );
    });

    it('Y_{2,+2} = √(15/16π) · (x²−y²)/r² (d_{x²−y²})', () => {
        const N = Math.sqrt(15 / (4 * FOUR_PI));
        expect(realSphericalHarmonic(2, +2, 1, 0, 0)).toBeCloseTo(N, 10);
        expect(realSphericalHarmonic(2, +2, 0, 1, 0)).toBeCloseTo(-N, 10);
        expect(realSphericalHarmonic(2, +2, 1, 1, 0)).toBeCloseTo(0, 10); // x² = y²
    });

    it('Y_{2,-2} = √(15/4π) · xy/r² (d_{xy})', () => {
        const N = Math.sqrt(15 / FOUR_PI);
        // At (1,1,0)/√2: xy/r² = (1·1)/(2) · (r²=2 → /2) ... hmm let me redo
        // x=1,y=1,z=0 → r²=2, xy=1, xy/r² = 1/2 → N/2
        expect(realSphericalHarmonic(2, -2, 1, 1, 0)).toBeCloseTo(N / 2, 10);
        // At x-axis
        expect(realSphericalHarmonic(2, -2, 1, 0, 0)).toBeCloseTo(0, 10);
    });

    it('Y_{2,+1} = √(15/4π) · xz/r² (d_{xz})', () => {
        const N = Math.sqrt(15 / FOUR_PI);
        expect(realSphericalHarmonic(2, +1, 1, 0, 1)).toBeCloseTo(N / 2, 10);
        expect(realSphericalHarmonic(2, +1, 0, 1, 1)).toBeCloseTo(0, 10);
    });

    it('is independent of radial magnitude (r dependence divided out)', () => {
        for (const scale of [0.1, 1, 2, 10]) {
            expect(realSphericalHarmonic(2, +2, scale, 0, 0)).toBeCloseTo(
                realSphericalHarmonic(2, +2, 1, 0, 0),
                10,
            );
            expect(realSphericalHarmonic(3, -1, scale * 0.3, scale * 0.4, scale * 0.5))
                .toBeCloseTo(realSphericalHarmonic(3, -1, 0.3, 0.4, 0.5), 10);
        }
    });
});

describe('parity Y_l^m(-r) = (-1)^l Y_l^m(r)', () => {
    const samples = [
        [0.3, 0.4, 0.5],
        [-0.2, 0.8, 0.1],
        [0.7, -0.3, 0.6],
        [-0.5, -0.5, 0.5],
    ];
    for (let l = 0; l <= 4; l++) {
        for (let m = -l; m <= l; m++) {
            it(`(l=${l}, m=${m}) parity`, () => {
                for (const [x, y, z] of samples) {
                    const yp = realSphericalHarmonic(l, m, x, y, z);
                    const yn = realSphericalHarmonic(l, m, -x, -y, -z);
                    const sign = l % 2 === 0 ? 1 : -1;
                    expect(yn).toBeCloseTo(sign * yp, 10);
                }
            });
        }
    }
});

describe('orthogonality (sampled on sphere)', () => {
    // ∫ Y_{l,m} Y_{l',m'} dΩ ≈ δ. Use a modest grid; tolerance generous.
    const N_THETA = 60;
    const N_PHI = 120;
    const dtheta = Math.PI / N_THETA;
    const dphi = (2 * Math.PI) / N_PHI;

    function inner(l1: number, m1: number, l2: number, m2: number): number {
        let s = 0;
        for (let i = 0; i < N_THETA; i++) {
            const theta = (i + 0.5) * dtheta;
            const sinT = Math.sin(theta);
            const cosT = Math.cos(theta);
            for (let j = 0; j < N_PHI; j++) {
                const phi = j * dphi;
                const x = sinT * Math.cos(phi);
                const y = sinT * Math.sin(phi);
                const z = cosT;
                const a = realSphericalHarmonic(l1, m1, x, y, z);
                const b = realSphericalHarmonic(l2, m2, x, y, z);
                s += a * b * sinT;
            }
        }
        return s * dtheta * dphi;
    }

    it('diagonal = 1 for assorted (l, m)', () => {
        for (const [l, m] of [
            [0, 0],
            [1, 0],
            [1, 1],
            [1, -1],
            [2, 0],
            [2, 2],
            [2, -2],
            [3, 1],
            [3, -3],
        ]) {
            expect(inner(l, m, l, m)).toBeCloseTo(1, 2);
        }
    });

    it('off-diagonal ≈ 0', () => {
        expect(Math.abs(inner(1, 0, 2, 0))).toBeLessThan(0.02);
        expect(Math.abs(inner(1, 1, 1, -1))).toBeLessThan(0.02);
        expect(Math.abs(inner(2, 2, 2, -2))).toBeLessThan(0.02);
        expect(Math.abs(inner(2, 0, 3, 0))).toBeLessThan(0.02);
    });
});

describe('real-from-complex reconstruction', () => {
    // The real Y should equal the appropriate LC of complex Ys, up to
    // the Condon-Shortley sign convention. Check at random directions.
    const samples = [
        [0.3, 0.7],
        [1.1, -0.5],
        [2.0, 2.5],
        [0.5, 0],
    ];
    for (let l = 0; l <= 3; l++) {
        for (let m = -l; m <= l; m++) {
            it(`(l=${l}, m=${m})`, () => {
                for (const [theta, phi] of samples) {
                    const real = realSphericalHarmonicAngular(l, m, theta, phi);
                    const fromComplex = realFromComplex(l, m, theta, phi);
                    // Allow sign mismatch (Condon-Shortley convention differences
                    // between the two paths) — just compare magnitudes.
                    expect(Math.abs(fromComplex)).toBeCloseTo(Math.abs(real), 8);
                }
            });
        }
    }
});

describe('superposition evaluator', () => {
    it('matches single-term realSphericalHarmonic', () => {
        for (const l of [0, 1, 2, 3]) {
            for (let m = -l; m <= l; m++) {
                const direct = realSphericalHarmonic(l, m, 0.3, 0.5, 0.7);
                const super_ = evalAngularSuperposition(
                    [{ l, m, coeff: 1 }],
                    0.3,
                    0.5,
                    0.7,
                );
                expect(super_).toBeCloseTo(direct, 10);
            }
        }
    });

    it('linear combination: p_x + p_y at (1, 1, 0)/√2', () => {
        // p_x = p_y at (1,1,0)/√2 → sum = 2·p_x
        const N = Math.sqrt(3 / FOUR_PI);
        const inv2 = 1 / Math.sqrt(2);
        const x = inv2,
            y = inv2,
            z = 0;
        const sum = evalAngularSuperposition(
            [
                { l: 1, m: +1, coeff: 1 },
                { l: 1, m: -1, coeff: 1 },
            ],
            x,
            y,
            z,
        );
        expect(sum).toBeCloseTo(2 * N * inv2, 10);
    });
});

describe('radial functions', () => {
    it('R_{1,0} at origin: 2 Z^{3/2}', () => {
        expect(radialR(1, 0, 0, 1)).toBeCloseTo(2, 10);
        expect(radialR(1, 0, 0, 2)).toBeCloseTo(2 * Math.pow(2, 1.5), 10);
    });

    it('R_{2,0} has node at r = 2 (for Z=1)', () => {
        expect(Math.abs(radialR(2, 0, 2, 1))).toBeLessThan(CLOSE);
        expect(radialR(2, 0, 1, 1)).toBeGreaterThan(0);
        expect(radialR(2, 0, 3, 1)).toBeLessThan(0);
    });

    it('R_{3,0} has nodes at r = (9 ± 3√3)/2', () => {
        const r1 = (9 - 3 * Math.sqrt(3)) / 2; // ≈ 1.902
        const r2 = (9 + 3 * Math.sqrt(3)) / 2; // ≈ 7.098
        expect(Math.abs(radialR(3, 0, r1, 1))).toBeLessThan(CLOSE);
        expect(Math.abs(radialR(3, 0, r2, 1))).toBeLessThan(CLOSE);
    });

    it('R_{3,1} has node at r = 6', () => {
        expect(Math.abs(radialR(3, 1, 6, 1))).toBeLessThan(CLOSE);
    });

    it('R_{4,1} has nodes at r = 10 ± 2√5', () => {
        const r1 = 10 - 2 * Math.sqrt(5);
        const r2 = 10 + 2 * Math.sqrt(5);
        expect(Math.abs(radialR(4, 1, r1, 1))).toBeLessThan(CLOSE);
        expect(Math.abs(radialR(4, 1, r2, 1))).toBeLessThan(CLOSE);
    });

    it('R_{4,2} has node at r = 12', () => {
        expect(Math.abs(radialR(4, 2, 12, 1))).toBeLessThan(CLOSE);
    });

    it('R_{2,1}, R_{3,2}, R_{4,3} have no radial nodes (only r=0 trivially)', () => {
        // Sample at several positive r and check monotonic-in-sign behaviour.
        for (const [n, l] of [
            [2, 1],
            [3, 2],
            [4, 3],
        ]) {
            const signs = new Set<number>();
            for (let r = 0.1; r < 40; r += 0.1) {
                const v = radialR(n, l, r, 1);
                if (Math.abs(v) > 1e-8) signs.add(Math.sign(v));
            }
            expect(signs.size).toBe(1);
        }
    });

    it('radial normalization: ∫|R_{nl}|² r² dr ≈ 1', () => {
        const RMAX = 80;
        const N = 20000;
        const dr = RMAX / N;
        for (const [n, l] of [
            [1, 0],
            [2, 0],
            [2, 1],
            [3, 0],
            [3, 1],
            [3, 2],
            [4, 0],
            [4, 3],
        ]) {
            let integral = 0;
            for (let i = 0; i < N; i++) {
                const r = (i + 0.5) * dr;
                integral += radialProbabilityDensity(n, l, r, 1) * dr;
            }
            expect(integral).toBeCloseTo(1, 3);
        }
    });
});

describe('hydrogen orbital ψ_{nlm}', () => {
    it('ψ_{100}(0) > 0, ψ_{200} changes sign at r=2', () => {
        expect(hydrogenPsi(1, 0, 0, 0, 0, 0.01)).toBeGreaterThan(0);
        expect(hydrogenPsi(2, 0, 0, 0, 0, 1.5)).toBeGreaterThan(0);
        expect(hydrogenPsi(2, 0, 0, 0, 0, 2.5)).toBeLessThan(0);
    });

    it('ψ_{211} (p_x-like) is zero on yz-plane', () => {
        expect(hydrogenPsi(2, 1, +1, 0, 1, 0)).toBeCloseTo(0, 10);
        expect(hydrogenPsi(2, 1, +1, 0, 0, 1)).toBeCloseTo(0, 10);
        expect(Math.abs(hydrogenPsi(2, 1, +1, 1, 0, 0))).toBeGreaterThan(0);
    });

    it('forbidden quantum numbers return 0', () => {
        expect(hydrogenPsi(1, 1, 0, 1, 0, 0)).toBe(0); // l ≥ n
        expect(hydrogenPsi(2, 1, 2, 1, 0, 0)).toBe(0); // |m| > l
    });
});

describe('hydrogenEnergy and nodeCount', () => {
    it('E_1 = −13.606 eV for Z=1', () => {
        expect(hydrogenEnergy(1, 1)).toBeCloseTo(-13.605693, 5);
    });
    it('E_2 = −3.4 eV, E_3 ≈ −1.51 eV', () => {
        expect(hydrogenEnergy(2, 1)).toBeCloseTo(-3.4014, 3);
        expect(hydrogenEnergy(3, 1)).toBeCloseTo(-1.5117, 3);
    });
    it('Z² scaling: He⁺ 1s has E₁ = −54.4 eV', () => {
        expect(hydrogenEnergy(1, 2)).toBeCloseTo(-54.42, 1);
    });
    it('node counts match n − l − 1 radial and l angular', () => {
        expect(nodeCount(1, 0)).toEqual({ radial: 0, angular: 0 });
        expect(nodeCount(2, 0)).toEqual({ radial: 1, angular: 0 });
        expect(nodeCount(3, 1)).toEqual({ radial: 1, angular: 1 });
        expect(nodeCount(4, 2)).toEqual({ radial: 1, angular: 2 });
        expect(nodeCount(4, 0)).toEqual({ radial: 3, angular: 0 });
    });
});

/**
 * Mirror of the GLSL computeSolidHarmonics() in shaders.ts, written with
 * the exact same fixed-size array + break-in-loop structure, so that if
 * the port diverges from physics.ts we'll see it here.
 */
function glslMirrorSolidHarmonics(x: number, y: number, z: number): Float64Array {
    const L_MAX = 4;
    const SOLID_SIZE = (L_MAX + 1) * (L_MAX + 1);
    const R = new Float64Array(SOLID_SIZE); // zero-initialized
    const r2 = x * x + y * y + z * z;

    R[0] = 1;
    R[1] = z;
    R[2] = x;
    R[3] = y;

    for (let k = 1; k < L_MAX; k++) {
        const n = k + 1;
        const levelN = n * n;
        const levelK = k * k;
        const levelP = (k - 1) * (k - 1);
        const a2kp1 = 2 * k + 1;
        const fk = k;
        const fn = n;

        R[levelN] = (a2kp1 * R[levelK] * z - fk * r2 * R[levelP]) / (fk + 1);

        for (let m = 1; m < L_MAX; m++) {
            if (m >= k) break;
            const denom = Math.sqrt((fn + m) * (fn - m));
            const coupling = Math.sqrt((fk + m) * (fk - m));
            R[levelN + 2 * m - 1] =
                (a2kp1 * R[levelK + 2 * m - 1] * z - coupling * r2 * R[levelP + 2 * m - 1]) / denom;
            R[levelN + 2 * m] =
                (a2kp1 * R[levelK + 2 * m] * z - coupling * r2 * R[levelP + 2 * m]) / denom;
        }

        const fTop = Math.sqrt(fn + fk);
        R[levelN + 2 * k - 1] = fTop * R[levelK + 2 * k - 1] * z;
        R[levelN + 2 * k] = fTop * R[levelK + 2 * k] * z;

        const s = Math.sqrt(fn + fk) / Math.sqrt(2 * fn);
        R[levelN + 2 * n - 1] = s * (x * R[levelK + 2 * k - 1] - y * R[levelK + 2 * k]);
        R[levelN + 2 * n] = s * (x * R[levelK + 2 * k] + y * R[levelK + 2 * k - 1]);
    }

    return R;
}

describe('GLSL mirror matches TS recurrence', () => {
    const samples = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
        [0.3, 0.4, 0.5],
        [-0.7, 0.2, -0.3],
        [0.577, 0.577, 0.577],
        [1.5, -2.3, 0.8],
    ];
    it('every index agrees for assorted points', () => {
        for (const [x, y, z] of samples) {
            const ref = solidHarmonicsRecurrence(4, x, y, z);
            const mirror = glslMirrorSolidHarmonics(x, y, z);
            for (let i = 0; i < ref.length; i++) {
                expect(mirror[i]).toBeCloseTo(ref[i], 12);
            }
        }
    });
});

describe('presets', () => {
    it('all presets have unique ids', () => {
        const ids = ALL_PRESETS.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('all preset quantum numbers are valid', () => {
        for (const preset of ALL_PRESETS) {
            for (const t of preset.terms) {
                expect(t.n).toBeGreaterThanOrEqual(1);
                expect(t.n).toBeLessThanOrEqual(4);
                expect(t.l).toBeGreaterThanOrEqual(0);
                expect(t.l).toBeLessThan(t.n);
                expect(Math.abs(t.m)).toBeLessThanOrEqual(t.l);
            }
        }
    });

    it('shell-category presets have exactly one term', () => {
        for (const preset of SHELL_PRESETS) {
            expect(preset.terms.length).toBe(1);
        }
    });

    it('hybrid presets have Σ|cᵢ|² = 1 (normalized)', () => {
        for (const preset of HYBRID_PRESETS) {
            const sum = preset.terms.reduce((s, t) => s + t.coeff * t.coeff, 0);
            expect(sum).toBeCloseTo(1, 10);
        }
    });

    it('sp hybrid has maximum along +z', () => {
        const sp = findPreset('sp_z')!;
        // Sample ψ along +z vs −z; +z should be larger in magnitude (constructive).
        function psi(x: number, y: number, z: number): number {
            let sum = 0;
            for (const t of sp.terms) sum += t.coeff * hydrogenPsi(t.n, t.l, t.m, x, y, z);
            return sum;
        }
        // Avoid r = 2 (2s radial node, where the s-term vanishes and the
        // test would degenerate to |p| vs |−p|).
        const along_plus = psi(0, 0, 1.5);
        const along_minus = psi(0, 0, -1.5);
        expect(Math.abs(along_plus)).toBeGreaterThan(Math.abs(along_minus));
    });

    it('sp³ along [1,1,1] has maximum along [1,1,1] direction', () => {
        const sp3 = findPreset('sp3_111')!;
        function psi(x: number, y: number, z: number): number {
            let sum = 0;
            for (const t of sp3.terms) sum += t.coeff * hydrogenPsi(t.n, t.l, t.m, x, y, z);
            return sum;
        }
        // Pick r ≠ 2 (avoid 2s radial node).
        const r = 1.5;
        const along = psi(r / Math.sqrt(3), r / Math.sqrt(3), r / Math.sqrt(3));
        const against = psi(-r / Math.sqrt(3), -r / Math.sqrt(3), -r / Math.sqrt(3));
        expect(Math.abs(along)).toBeGreaterThan(Math.abs(against));
    });
});

describe('probability-enclosing iso', () => {
    it('fraction → 0 gives iso ≥ max; fraction → 1 gives iso → 0', () => {
        const vals = new Float32Array([0.1, 0.2, 0.5, 1.0, 0.3]);
        expect(isoForProbability(vals, 0)).toBe(Infinity);
        expect(isoForProbability(vals, 1)).toBe(0);
    });

    it('monotonic: bigger fraction ⇒ smaller or equal iso', () => {
        const { values } = sampleFieldOnGrid(
            {
                mode: 'full',
                terms: [{ kind: 'spherical', n: 2, l: 0, m: 0, coeff: 1 }],
            },
            10,
        );
        const fractions = [0.3, 0.5, 0.7, 0.9, 0.95, 0.99];
        const isos = fractions.map((f) => isoForProbability(values, f));
        for (let i = 1; i < isos.length; i++) {
            expect(isos[i]).toBeLessThanOrEqual(isos[i - 1]);
        }
    });

    it('the 90%-iso of 2s field is a sensible positive number', () => {
        const { values, maxAbs } = sampleFieldOnGrid(
            {
                mode: 'full',
                terms: [{ kind: 'spherical', n: 2, l: 0, m: 0, coeff: 1 }],
            },
            14,
        );
        const iso = isoForProbability(values, 0.9);
        expect(iso).toBeGreaterThan(0);
        expect(iso).toBeLessThan(maxAbs);
    });
});

describe('raw solid-harmonic recurrence (sanity)', () => {
    it('seeds 1, z, x, y correctly', () => {
        const R = solidHarmonicsRecurrence(1, 0.3, 0.4, 0.5);
        expect(R[0]).toBe(1);
        expect(R[1]).toBe(0.5);
        expect(R[2]).toBe(0.3);
        expect(R[3]).toBe(0.4);
    });

    it('array length is (L+1)²', () => {
        expect(solidHarmonicsRecurrence(0, 1, 0, 0).length).toBe(1);
        expect(solidHarmonicsRecurrence(1, 1, 0, 0).length).toBe(4);
        expect(solidHarmonicsRecurrence(3, 1, 0, 0).length).toBe(16);
        expect(solidHarmonicsRecurrence(4, 1, 0, 0).length).toBe(25);
    });
});
