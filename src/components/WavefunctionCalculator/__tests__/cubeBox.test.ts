import { describe, expect, it } from 'vitest';
import { ANGSTROM_TO_BOHR, BOX_MARGIN, MAX_STEPS, cubeBoxAround } from '../cubeBox';

const water = [
    { x: 0, y: 0, z: 0.1173 },
    { x: 0, y: 0.7572, z: -0.4692 },
    { x: 0, y: -0.7572, z: -0.4692 },
];

describe('cubeBoxAround', () => {
    it('starts the grid one margin below the lowest atom on each axis', () => {
        const box = cubeBoxAround(water, 'medium');
        expect(box.origin[1]).toBeCloseTo((-0.7572 - BOX_MARGIN) * ANGSTROM_TO_BOHR, 10);
    });

    it('spans the bounding box plus both margins across steps - 1 intervals', () => {
        const box = cubeBoxAround(water, 'medium');
        const spanY = box.db[1] * (box.steps - 1);
        expect(spanY).toBeCloseTo((2 * 0.7572 + 2 * BOX_MARGIN) * ANGSTROM_TO_BOHR, 10);
    });

    it('sizes the step count from the largest axis and the quality spacing', () => {
        // Largest axis: 1.5144 + 10 Å; at 0.2 Å that is ceil(57.572) + 1 points.
        expect(cubeBoxAround(water, 'medium').steps).toBe(59);
    });

    it('uses more points for a finer grid', () => {
        expect(cubeBoxAround(water, 'fine').steps).toBeGreaterThan(cubeBoxAround(water, 'coarse').steps);
    });

    it('caps the step count for large molecules', () => {
        const long = [{ x: 0, y: 0, z: 0 }, { x: 60, y: 0, z: 0 }];
        expect(cubeBoxAround(long, 'fine').steps).toBe(MAX_STEPS);
    });

    it('keeps the voxel vectors axis-aligned', () => {
        const box = cubeBoxAround(water, 'coarse');
        expect([box.da[1], box.da[2], box.db[0], box.db[2], box.dc[0], box.dc[1]]).toEqual([0, 0, 0, 0, 0, 0]);
    });

    it('refuses an empty atom list', () => {
        expect(() => cubeBoxAround([], 'medium')).toThrow(/no atoms/);
    });
});
