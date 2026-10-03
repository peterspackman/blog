import { describe, expect, it } from 'vitest';
import { braggAngles, intensity, phaseStep } from '../physics';

describe('bragg physics', () => {
    it('intensity is 1 at a Bragg angle and small between peaks', () => {
        const d = 3, lambda = 1.5;
        for (const { theta } of braggAngles(d, lambda)) {
            expect(intensity(5, phaseStep(d, theta, lambda))).toBeCloseTo(1, 9);
        }
        // Half-way in phase between orders: complete cancellation for even N.
        expect(intensity(4, Math.PI)).toBeCloseTo(0, 12);
    });

    it('lists orders up to nλ ≤ 2d', () => {
        expect(braggAngles(3, 1.5).map((b) => b.order)).toEqual([1, 2, 3, 4]);
        expect(braggAngles(3, 1.5)[0].theta).toBeCloseTo((Math.asin(0.25) * 180) / Math.PI, 12);
    });
});
