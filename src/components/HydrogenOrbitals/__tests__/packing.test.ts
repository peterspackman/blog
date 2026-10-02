import { describe, expect, it } from 'vitest';
import { evalPacked, packOrbital, radialPolynomial } from '../packing';
import { radialR, realSphericalHarmonic } from '../physics';
import { cartesianNorm, monomialSlot } from '../codegen';
import type { Term } from '../types';

const points: [number, number, number][] = [
    [1.3, -0.4, 0.7],
    [-2.1, 0.9, -1.5],
    [0.2, 3.4, 0.1],
    [4.0, -3.0, 2.5],
];

describe('monomialSlot', () => {
    it('enumerates degree-l monomials densely in shader order', () => {
        for (let l = 0; l <= 4; l++) {
            const seen: number[] = [];
            for (let a = l; a >= 0; a--) for (let b = l - a; b >= 0; b--) seen.push(monomialSlot(a, b, l));
            expect(seen).toEqual([...seen.keys()]);
        }
    });
});

describe('radialPolynomial', () => {
    it('matches physics.radialR for every (n, l) with n <= 4', () => {
        for (let n = 1; n <= 4; n++) {
            for (let l = 0; l < n; l++) {
                for (const Z of [1, 2.5]) {
                    for (const r of [0.1, 0.8, 2, 5, 11]) {
                        const { norm, poly } = radialPolynomial(n, l);
                        const Zr = Z * r;
                        const v = Z ** 1.5 * norm * Zr ** l * (poly[0] + Zr * (poly[1] + Zr * (poly[2] + Zr * poly[3]))) * Math.exp(-Zr / n);
                        expect(v).toBeCloseTo(radialR(n, l, r, Z), 10);
                    }
                }
            }
        }
    });
});

describe('packOrbital + evalPacked', () => {
    it('full mode reproduces Σ c · R_nl · Y_lm', () => {
        const terms: Term[] = [
            { kind: 'spherical', n: 3, l: 2, m: -1, coeff: 0.6 },
            { kind: 'spherical', n: 4, l: 3, m: 2, coeff: -0.8 },
            { kind: 'spherical', n: 2, l: 0, m: 0, coeff: 0.3 },
            { kind: 'spherical', n: 4, l: 4, m: 0, coeff: 1 }, // invalid l >= n: contributes 0
        ];
        const Z = 1.5;
        const packed = packOrbital(terms, 'full', 1, 0, Z);
        for (const [x, y, z] of points) {
            const r = Math.hypot(x, y, z);
            let expected = 0;
            for (const t of terms) {
                if (t.kind !== 'spherical') continue;
                expected += t.coeff * radialR(t.n, t.l, r, Z) * realSphericalHarmonic(t.l, t.m, x / r, y / r, z / r);
            }
            expect(evalPacked(packed, x, y, z, Z, 2)).toBeCloseTo(expected, 10);
        }
    });

    it('angular mode uses the envelope instead of R(r)', () => {
        const terms: Term[] = [{ kind: 'spherical', n: 4, l: 4, m: -3, coeff: 1 }];
        const packed = packOrbital(terms, 'angular', 1, 0, 1);
        for (const [x, y, z] of points) {
            const r = Math.hypot(x, y, z);
            const expected = realSphericalHarmonic(4, -3, x / r, y / r, z / r) * Math.exp(-r / 1.7);
            expect(evalPacked(packed, x, y, z, 1, 1.7)).toBeCloseTo(expected, 10);
        }
    });

    it('radial mode is R_nl · Y_00 regardless of terms', () => {
        const packed = packOrbital([{ kind: 'spherical', n: 2, l: 1, m: 0, coeff: 1 }], 'radial', 3, 1, 1);
        for (const [x, y, z] of points) {
            const r = Math.hypot(x, y, z);
            expect(evalPacked(packed, x, y, z, 1, 2)).toBeCloseTo(radialR(3, 1, r, 1) * 0.28209479177387814, 10);
        }
    });

    it('cartesian terms are normalised monomials', () => {
        const terms: Term[] = [{ kind: 'cartesian', n: 3, a: 1, b: 1, c: 0, coeff: 0.9 }];
        const packed = packOrbital(terms, 'full', 1, 0, 1);
        for (const [x, y, z] of points) {
            const r = Math.hypot(x, y, z);
            const expected = 0.9 * cartesianNorm(1, 1, 0) * (x / r) * (y / r) * radialR(3, 2, r, 1);
            expect(evalPacked(packed, x, y, z, 1, 2)).toBeCloseTo(expected, 10);
        }
    });
});
