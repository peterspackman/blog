import { describe, expect, it } from 'vitest';
import { orbitalCubeParams } from '../useOrbitalVolumes';
import type { CalculationResult } from '../useCalculation';

const result = {
    wavefunction: { owfJson: new Uint8Array([1, 2, 3]) },
    structure: {
        atoms: [
            { element: 'O', position: { x: 0, y: 0, z: 0.1173 } },
            { element: 'H', position: { x: 0, y: 0.7572, z: -0.4692 } },
        ],
    },
} as unknown as CalculationResult;

describe('orbitalCubeParams', () => {
    it('asks occ for the 1-based orbital number of a 0-based table index', () => {
        // Water's HOMO is table index 4; occ numbers it 5.
        expect(orbitalCubeParams(result, { spin: 'restricted', index: 4 }, 'coarse').orbital).toBe('5');
    });

    it('requests a signed MO grid', () => {
        expect(orbitalCubeParams(result, { spin: 'restricted', index: 0 }, 'coarse').property).toBe('mo');
    });

    it('names the spin block for an unrestricted orbital', () => {
        expect(orbitalCubeParams(result, { spin: 'beta', index: 2 }, 'coarse')).toMatchObject({ spin: 'beta' });
    });

    it('leaves the spin out for a restricted orbital', () => {
        expect(orbitalCubeParams(result, { spin: 'restricted', index: 2 }, 'coarse')).not.toHaveProperty('spin');
    });
});
