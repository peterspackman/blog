import { describe, expect, it } from 'vitest';
import data from '../../chairFlip/data/methylcyclohexane_flip.json';
import { buildPath, energyAt, locate, nearestFrame, pointAt, positionsAt, progressOf } from '../path';

const path = buildPath(data);

describe('conformer path', () => {
    it('reproduces every image exactly at its path coordinate', () => {
        path.frames.forEach((frame, i) => {
            expect(energyAt(path, path.s[i])).toBeCloseTo(path.energies[i], 9);
            const x = positionsAt(path, path.s[i]);
            frame.forEach((v, k) => expect(x[k]).toBeCloseTo(v, 5));
        });
    });

    it('clamps outside the path', () => {
        expect(locate(path, -1)).toEqual({ i: 0, t: 0 });
        expect(locate(path, path.length + 1)).toEqual({ i: path.frames.length - 2, t: 1 });
        expect(energyAt(path, path.length + 1)).toBeCloseTo(path.energies[path.energies.length - 1], 9);
    });

    it('interpolates halfway between images', () => {
        const mid = (path.s[3] + path.s[4]) / 2;
        expect(energyAt(path, mid)).toBeCloseTo((path.energies[3] + path.energies[4]) / 2, 9);
        expect([3, 4]).toContain(nearestFrame(path, mid));
    });

    it('marks transition states as the highest image between their minima', () => {
        const pts = path.points;
        expect(pts[0].frame).toBe(0);
        expect(pts[pts.length - 1].frame).toBe(path.frames.length - 1);
        pts.forEach((p, k) => {
            if (p.kind !== 'ts') return;
            const lo = pts[k - 1].frame, hi = pts[k + 1].frame;
            expect(Math.max(...path.energies.slice(lo, hi + 1))).toBe(path.energies[p.frame]);
            expect(pointAt(path, path.s[p.frame])).toBe(k);
        });
    });
});

describe('progress', () => {
    it('puts the stationary points at evenly spaced x and inverts', () => {
        const progress = progressOf(path);
        const n = path.points.length;
        path.points.forEach((p, k) => {
            expect(progress.fromS(path.s[p.frame])).toBeCloseTo(k / (n - 1), 9);
            expect(progress.toS(k / (n - 1))).toBeCloseTo(path.s[p.frame], 9);
        });
        for (const x of [0.03, 0.31, 0.77]) expect(progress.fromS(progress.toS(x))).toBeCloseTo(x, 9);
    });
});
