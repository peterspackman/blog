import { describe, expect, it } from 'vitest';
import {
    evalYlmFromPoly,
    generateSolidPolynomials,
    generateYlmGLSL,
    evalPoly,
    cartesianNorm,
    cartesianMonomials,
    generateRawCartGLSL,
    evalRawCart,
} from '../codegen';
import { realSphericalHarmonic, solidHarmonicsRecurrence } from '../physics';

describe('symbolic recurrence matches numeric recurrence', () => {
    const samples: Array<[number, number, number]> = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
        [0.3, 0.4, 0.5],
        [-0.7, 0.2, -0.3],
        [Math.sqrt(1 / 3), Math.sqrt(1 / 3), Math.sqrt(1 / 3)],
        [1.5, -2.3, 0.8],
    ];

    it('polynomial values agree with numeric recurrence, all (l, idx)', () => {
        const polys = generateSolidPolynomials(4);
        for (const [x, y, z] of samples) {
            const numeric = solidHarmonicsRecurrence(4, x, y, z);
            for (let i = 0; i < polys.length; i++) {
                expect(evalPoly(polys[i], x, y, z)).toBeCloseTo(numeric[i], 10);
            }
        }
    });

    it('evalYlmFromPoly matches realSphericalHarmonic on the unit sphere', () => {
        // Stick to unit-length inputs — the Y_{l,m} values only make sense as
        // functions on S², and the codegen output assumes unit-vector input.
        const unitSamples: Array<[number, number, number]> = [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
            [1 / Math.sqrt(2), 1 / Math.sqrt(2), 0],
            [0, 1 / Math.sqrt(2), 1 / Math.sqrt(2)],
            [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)],
            [0.36, 0.48, 0.8], // pre-normalized
        ];
        for (const [x, y, z] of unitSamples) {
            for (let l = 0; l <= 4; l++) {
                for (let m = -l; m <= l; m++) {
                    const direct = realSphericalHarmonic(l, m, x, y, z);
                    const fromPoly = evalYlmFromPoly(l, m, x, y, z);
                    expect(fromPoly).toBeCloseTo(direct, 10);
                }
            }
        }
    });
});

describe('cartesian monomial basis', () => {
    it('cartesianNorm agrees with closed-form for small cases', () => {
        // (0,0,0): N = 1/√(4π) = 1/(2√π)
        expect(cartesianNorm(0, 0, 0)).toBeCloseTo(1 / (2 * Math.sqrt(Math.PI)), 12);
        // (1,0,0) = x: N = √(3/4π)
        expect(cartesianNorm(1, 0, 0)).toBeCloseTo(Math.sqrt(3 / (4 * Math.PI)), 12);
        // (1,1,0) = xy: N = √(15/4π), which matches the d_{xy} prefactor
        expect(cartesianNorm(1, 1, 0)).toBeCloseTo(Math.sqrt(15 / (4 * Math.PI)), 12);
        // (2,0,0) = x²: N = √(5/(4π)) (different from d_{z²}!)
        expect(cartesianNorm(2, 0, 0)).toBeCloseTo(Math.sqrt(5 / (4 * Math.PI)), 12);
    });

    it('monomial counts per shell match (l+1)(l+2)/2', () => {
        for (let l = 0; l <= 4; l++) {
            expect(cartesianMonomials(l).length).toBe(((l + 1) * (l + 2)) / 2);
        }
    });

    it('each cartesian monomial is unit-normalized on the sphere', () => {
        // Sample ∫|N · x^a y^b z^c|² dΩ ≈ 1.
        const N_THETA = 60;
        const N_PHI = 120;
        const dtheta = Math.PI / N_THETA;
        const dphi = (2 * Math.PI) / N_PHI;
        for (let l = 0; l <= 3; l++) {
            for (const { a, b, c } of cartesianMonomials(l)) {
                let integral = 0;
                for (let i = 0; i < N_THETA; i++) {
                    const theta = (i + 0.5) * dtheta;
                    const sinT = Math.sin(theta);
                    const cosT = Math.cos(theta);
                    for (let j = 0; j < N_PHI; j++) {
                        const phi = j * dphi;
                        const x = sinT * Math.cos(phi);
                        const y = sinT * Math.sin(phi);
                        const z = cosT;
                        const v = evalRawCart(a, b, c, x, y, z);
                        integral += v * v * sinT;
                    }
                }
                integral *= dtheta * dphi;
                expect(integral).toBeCloseTo(1, 2);
            }
        }
    });

    it('"xy" raw monomial equals d_{xy} = Y_{2,-2} (same real harmonic)', () => {
        // Both have the same shape and normalization; switching basis should be a no-op.
        const samples: Array<[number, number, number]> = [
            [1, 0, 0],
            [0.3, 0.5, 0.8],
            [-0.7, 0.2, 0.6],
            [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)],
        ];
        for (const [x, y, z] of samples) {
            // Normalize to unit sphere so comparison is apples-to-apples.
            const r = Math.sqrt(x * x + y * y + z * z);
            const xh = x / r, yh = y / r, zh = z / r;
            const cart = evalRawCart(1, 1, 0, xh, yh, zh);
            const sph = realSphericalHarmonic(2, -2, xh, yh, zh);
            expect(cart).toBeCloseTo(sph, 10);
        }
    });

    it('"x²" raw monomial is NOT the same as d_{z²} = Y_{2,0}', () => {
        // At (0,0,1): x² = 0, but d_{z²} is maximal. Different shapes.
        const xSq = evalRawCart(2, 0, 0, 0, 0, 1);
        const dZ2 = realSphericalHarmonic(2, 0, 0, 0, 1);
        expect(xSq).toBe(0);
        expect(dZ2).toBeCloseTo(Math.sqrt(5 / (4 * Math.PI)), 10);
    });

    it('RawCart GLSL has branches for every (a, b, c) with a+b+c ≤ 4', () => {
        const glsl = generateRawCartGLSL(4);
        for (let l = 0; l <= 4; l++) {
            for (const { a, b, c } of cartesianMonomials(l)) {
                expect(glsl).toContain(`a == ${a} && b == ${b} && c == ${c}`);
            }
        }
    });
});

describe('generated GLSL (smoke)', () => {
    const glsl = generateYlmGLSL(4);

    it('mentions every (l, m) branch', () => {
        for (let l = 0; l <= 4; l++) {
            expect(glsl).toContain(`if (l == ${l})`);
            for (let m = -l; m <= l; m++) {
                expect(glsl).toContain(`if (m == ${m})`);
            }
        }
    });

    it('starts with the function signature and ends with a return', () => {
        expect(glsl.startsWith('float Ylm(int l, int m, float x, float y, float z)')).toBe(true);
        expect(glsl).toContain('return 0.0;');
    });

    it('produces simple monomial-sum bodies (no array, no pow, no loop)', () => {
        expect(glsl).not.toContain('pow(');
        expect(glsl).not.toContain('[');
        expect(glsl).not.toContain('for');
        expect(glsl).not.toContain('while');
    });
});
