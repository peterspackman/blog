import { describe, expect, it } from 'vitest';
import data from '../../chairFlip/data/methylcyclohexane_flip.json';
import { measure } from '../measures';
import { buildPath } from '../path';

const path = buildPath(data);
const at = (k: number) => path.ring[(k + 6) % 6];
const torsions = { defs: path.ring.map((_, k) => [at(k), at(k + 1), at(k + 2), at(k + 3)]) };
const angles = { defs: path.ring.map((_, k) => [at(k - 1), at(k), at(k + 1)]) };

describe('ring measurements', () => {
    it('alternate ±57° round the equatorial chair and invert in the axial one', () => {
        const first = torsions.defs.map((d) => measure(d, path.frames[0]).value);
        const last = torsions.defs.map((d) => measure(d, path.frames[path.frames.length - 1]).value);
        first.forEach((t, k) => {
            expect(Math.abs(t)).toBeGreaterThan(50);
            expect(Math.sign(t)).toBe(-Math.sign(first[(k + 1) % 6]));
            expect(Math.sign(last[k])).toBe(-Math.sign(t));
        });
    });

    it('measures the boat as two eclipsed bonds', () => {
        const boat = path.points.find((p) => p.label === 'Boat')!;
        const t = torsions.defs.map((d) => Math.abs(measure(d, path.frames[boat.frame]).value));
        expect(t.filter((v) => v < 5)).toHaveLength(2);
    });

    it('gives near-tetrahedral ring angles in the chair', () => {
        angles.defs.forEach((d) => {
            const v = measure(d, path.frames[0]).value;
            expect(v).toBeGreaterThan(109);
            expect(v).toBeLessThan(112);
        });
    });

    it('puts the methyl anti to C3 when equatorial and gauche when axial', () => {
        const def = [0, at(0), at(1), at(2)];
        expect(Math.abs(measure(def, path.frames[0]).value)).toBeGreaterThan(170);
        expect(Math.abs(measure(def, path.frames[path.frames.length - 1]).value)).toBeLessThan(80);
    });
});
