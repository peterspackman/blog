import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bestCut, equivalentFaces, fitExcess, parseCGResult, trimStdout, wulffPlanes } from '../parse';
import { wulff3D } from '../../wulff/geometry';

const set = JSON.parse(readFileSync('static/data/cg/paracetamol.json', 'utf8'));
const { json, stdout } = set.results.water;
const result = parseCGResult(json, stdout);

describe('parseCGResult (paracetamol form I, GFN2-xTB, water)', () => {
    it('reads the free-energy summary', () => {
        expect(result.totals.latticeEnergy).toBeCloseTo(-134.226, 3);
        expect(result.totals.logS).toBeCloseTo(-3.055, 3);
    });

    it('groups the neighbour table by unique interaction', () => {
        expect(result.pairs).toHaveLength(10);
        expect(result.pairs.reduce((n, p) => n + p.count, 0)).toBe(16);
        const stack = result.pairs.find((p) => p.id === 6)!;
        expect(stack.rc).toBeCloseTo(3.41, 2);
        expect(stack.symop).toBe('-x,-y+1,-z+2');
        // E_int = -(E_crys + E_nn) + E_S
        for (const p of result.pairs) expect(p.eInt).toBeCloseTo(-(p.eCrys + p.eNN) + p.eSolv, 1);
    });

    it('recovers the vacuum surface energies occ writes to the .gmf', () => {
        const f001 = result.faces.find((f) => f.hkl.join() === '0,0,1')!;
        expect(f001.d).toBeCloseTo(11.438, 3);
        expect(bestCut(f001, 'vac')!.gammaVac).toBeCloseTo(0.2204, 4);
        expect(bestCut(f001, 'solv')!.gammaSolv).toBeCloseTo(0.0908, 4);
    });

    it('expands faces by the point group, with Friedel pairs', () => {
        expect(equivalentFaces(result.rotations, [1, 1, 0])).toHaveLength(4);
        expect(equivalentFaces(result.rotations, [0, 1, 0])).toHaveLength(2);
    });

    it('builds a closed, centrosymmetric Wulff shape', () => {
        const shape = wulff3D(wulffPlanes(result, 'solv'), 10);
        expect(shape.faces.every((f) => f.family >= 0)).toBe(true);
        expect(shape.familyArea[result.faces.findIndex((f) => f.hkl.join() === '1,0,1')]).toBeGreaterThan(0);
    });

    it('fits the finite-size coefficients', () => {
        const fit = fitExcess(result.samples)!;
        expect(fit.a).toBeGreaterThan(0);
        for (const s of result.samples) {
            const model = fit.a * s.n ** (-1 / 3) + fit.b * s.n ** (-2 / 3) + fit.c / s.n;
            expect(Math.abs(model - s.excess / s.n)).toBeLessThan(0.1);
        }
    });
});

describe('precomputed solvent set', () => {
    it('keeps only the neighbour table of stdout, and it still parses', () => {
        expect(trimStdout(stdout)).toBe(stdout);
        expect(stdout.split('\n')).toHaveLength(18);
    });

    it('has the same faces in every solvent, so colours can follow the face', () => {
        const keys = Object.values(set.results).map((r: any) =>
            parseCGResult(r.json, r.stdout).faces.map((f) => f.hkl.join()).join(' '),
        );
        expect(new Set(keys).size).toBe(1);
    });
});
