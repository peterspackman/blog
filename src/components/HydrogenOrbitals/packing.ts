/**
 * Packs a wavefunction into the flat uniform arrays read by the orbital
 * fragment shader. Every display mode reduces to the same form:
 *
 *   ψ(r) = Σ_i  A_i(r̂) · F_i(r)
 *
 *   A_i(r̂)  homogeneous polynomial of degree l_i in the unit direction,
 *            coefficients (incl. the term's weight and normalisation) in
 *            angCoeffs[i * ANG_SLOTS + slot]
 *   F_i(r)   either the angular-mode envelope exp(-r/λ) (useEnvelope), or
 *            R_{n,l}(r) = (Zr)^l · (c0 + c1 Zr + c2 Zr² + c3 Zr³) · exp(-Zr/n)
 *            with Z^{3/2} and the normalisation folded into c0..c3.
 *
 * evalPacked() mirrors the shader in TypeScript so tests can check the packed
 * form against physics.ts.
 */
import { cartesianNorm, monomialSlot, sphericalMonomials, SHADER_L_MAX } from './codegen';
import type { DisplayMode, Term } from './types';

export const MAX_TERMS = 8;
/** (L+1)(L+2)/2 monomials of degree L = 4. */
export const ANG_SLOTS = ((SHADER_L_MAX + 1) * (SHADER_L_MAX + 2)) / 2;

export interface PackedOrbital {
    numTerms: number;
    useEnvelope: boolean;
    /** Angular degree per term. */
    degree: number[];
    /** MAX_TERMS * ANG_SLOTS monomial coefficients. */
    angCoeffs: number[];
    /** MAX_TERMS * 4 radial polynomial coefficients (c0..c3). */
    radPoly: number[];
    /** Power of Zr in front of the radial polynomial (the orbital's l). */
    radPower: number[];
    /** 1/n, the radial exponential decay rate in units of Zr. */
    radInvN: number[];
}

const INV_SQRT_4PI = 0.28209479177387814;

/**
 * R_{nl}(r) = Z^{3/2} · norm · (Zr)^l · poly(Zr) · exp(-Zr/n), n ≤ 4.
 * Transcribed from radialR() in physics.ts (tests check they agree).
 */
export function radialPolynomial(n: number, l: number): { norm: number; poly: [number, number, number, number] } {
    const s = Math.sqrt;
    const table: Record<string, [number, [number, number, number, number]]> = {
        '1,0': [2, [1, 0, 0, 0]],
        '2,0': [1 / (2 * Math.SQRT2), [2, -1, 0, 0]],
        '2,1': [1 / (2 * s(6)), [1, 0, 0, 0]],
        '3,0': [2 / (81 * s(3)), [27, -18, 2, 0]],
        '3,1': [4 / (81 * s(6)), [6, -1, 0, 0]],
        '3,2': [4 / (81 * s(30)), [1, 0, 0, 0]],
        '4,0': [1 / 768, [192, -144, 24, -1]],
        '4,1': [1 / (256 * s(15)), [80, -20, 1, 0]],
        '4,2': [1 / (768 * s(5)), [12, -1, 0, 0]],
        '4,3': [1 / (768 * s(35)), [1, 0, 0, 0]],
    };
    const hit = table[`${n},${l}`];
    return hit ? { norm: hit[0], poly: hit[1] } : { norm: 0, poly: [0, 0, 0, 0] };
}

function empty(): PackedOrbital {
    return {
        numTerms: 0,
        useEnvelope: false,
        degree: new Array(MAX_TERMS).fill(0),
        angCoeffs: new Array(MAX_TERMS * ANG_SLOTS).fill(0),
        radPoly: new Array(MAX_TERMS * 4).fill(0),
        radPower: new Array(MAX_TERMS).fill(0),
        radInvN: new Array(MAX_TERMS).fill(1),
    };
}

function setRadial(p: PackedOrbital, i: number, n: number, l: number, Z: number) {
    const { norm, poly } = radialPolynomial(n, l);
    const k = Math.pow(Z, 1.5) * norm;
    for (let j = 0; j < 4; j++) p.radPoly[i * 4 + j] = k * poly[j];
    p.radPower[i] = l;
    p.radInvN[i] = 1 / n;
}

export function packOrbital(
    terms: readonly Term[],
    displayMode: DisplayMode,
    radN: number,
    radL: number,
    Z: number,
): PackedOrbital {
    const p = empty();

    if (displayMode === 'radial') {
        // R_{nl}(r) · Y_00: one term, constant angular part.
        p.numTerms = 1;
        p.degree[0] = 0;
        p.angCoeffs[0] = INV_SQRT_4PI;
        setRadial(p, 0, radN, radL, Z);
        return p;
    }

    p.useEnvelope = displayMode === 'angular';
    const bounded = terms.slice(0, MAX_TERMS);
    p.numTerms = Math.max(1, bounded.length);
    bounded.forEach((t, i) => {
        let l: number;
        if (t.kind === 'spherical') {
            l = t.l;
            for (const mono of sphericalMonomials(t.l, t.m)) {
                p.angCoeffs[i * ANG_SLOTS + monomialSlot(mono.a, mono.b, l)] += t.coeff * mono.coeff;
            }
        } else {
            l = t.a + t.b + t.c;
            if (l <= SHADER_L_MAX) {
                p.angCoeffs[i * ANG_SLOTS + monomialSlot(t.a, t.b, l)] = t.coeff * cartesianNorm(t.a, t.b, t.c);
            }
        }
        p.degree[i] = Math.min(l, SHADER_L_MAX);
        setRadial(p, i, t.n, l, Z);
    });
    return p;
}

/** TypeScript mirror of the shader's sampleField(). */
export function evalPacked(p: PackedOrbital, x: number, y: number, z: number, Z: number, envelopeScale: number): number {
    const r = Math.hypot(x, y, z);
    if (r < 1e-4) return 0;
    const ux = x / r, uy = y / r, uz = z / r;
    const Zr = Z * r;
    let sum = 0;
    for (let i = 0; i < p.numTerms; i++) {
        const l = p.degree[i];
        let ang = 0;
        let k = 0;
        for (let a = l; a >= 0; a--) {
            for (let b = l - a; b >= 0; b--) {
                const c = l - a - b;
                ang += p.angCoeffs[i * ANG_SLOTS + k] * ux ** a * uy ** b * uz ** c;
                k++;
            }
        }
        let rad: number;
        if (p.useEnvelope) rad = Math.exp(-r / Math.max(envelopeScale, 0.01));
        else {
            const c = p.radPoly.slice(i * 4, i * 4 + 4);
            rad = Zr ** p.radPower[i] * (c[0] + Zr * (c[1] + Zr * (c[2] + Zr * c[3]))) * Math.exp(-Zr * p.radInvN[i]);
        }
        sum += ang * rad;
    }
    return sum;
}
