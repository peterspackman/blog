import { describe, expect, it } from 'vitest';
import { layoutLevels } from '../levelLayout';

// Water HF/3-21G, highest first: LUMO+1, LUMO, HOMO, HOMO-1, HOMO-2, HOMO-3, HOMO-4 (O 1s).
const water = [9.85, 7.17, -13.05, -14.63, -18.65, -36.17, -555.88];

describe('layoutLevels', () => {
    it('puts the highest level at the top and the lowest at the bottom', () => {
        const { y } = layoutLevels(water, 0, 100);
        expect([y[0], y[y.length - 1]]).toEqual([0, 100]);
    });

    it('keeps levels in energy order', () => {
        const { y } = layoutLevels(water, 0, 100);
        expect(y.every((v, i) => i === 0 || v >= y[i - 1])).toBe(true);
    });

    it('shortens the gap down to the core level and marks it', () => {
        expect(layoutLevels(water, 0, 100).breaks).toHaveLength(1);
    });

    it('leaves room for the frontier levels despite the core level', () => {
        const { y } = layoutLevels(water, 0, 100);
        // HOMO (index 2) sits well clear of the top rather than squashed against it.
        expect(y[2]).toBeGreaterThan(15);
    });

    it('slots degenerate levels side by side', () => {
        const { slot } = layoutLevels([1, -5, -5.005, -9], 0, 100);
        expect(slot.slice(1, 3)).toEqual([
            { index: 0, of: 2 },
            { index: 1, of: 2 },
        ]);
    });

    it('centres a single level', () => {
        expect(layoutLevels([-10], 0, 100).y).toEqual([50]);
    });
});
