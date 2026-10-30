import { describe, expect, it } from 'vitest';
import { viewAxes } from '../orientation';

// Water in the yz plane, H–H along y.
const water = [
    { x: 0, y: 0, z: 0.1173 },
    { x: 0, y: 0.7572, z: -0.4692 },
    { x: 0, y: -0.7572, z: -0.4692 },
];

const absDot = (a: number[], b: number[]) => Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);

describe('viewAxes', () => {
    it('looks along the normal of a planar molecule', () => {
        expect(absDot(viewAxes(water)!.normal, [1, 0, 0])).toBeCloseTo(1, 6);
    });

    it('puts the middle axis up, leaving the longest across the screen', () => {
        expect(absDot(viewAxes(water)!.up, [0, 0, 1])).toBeCloseTo(1, 6);
    });

    it('returns perpendicular axes', () => {
        const { normal, up } = viewAxes(water)!;
        expect(absDot(normal, up)).toBeCloseTo(0, 6);
    });

    it('gives nothing for a single atom', () => {
        expect(viewAxes([{ x: 1, y: 2, z: 3 }])).toBeNull();
    });
});
