import { describe, expect, it } from 'vitest';
import { labelXYZ, usesReducedUnits } from './xyzElements';

const twoFrames = `2
Atoms. Timestep: 0
1 0.0 0.0 0.0
2 1.0 0.0 0.0
2
Atoms. Timestep: 10
1 0.1 0.0 0.0
2 1.1 0.0 0.0`;

describe('labelXYZ', () => {
    it('keeps numeric labels without a mapping and reports them', () => {
        const r = labelXYZ(twoFrames);
        expect(r.allElements).toBe(false);
        expect(r.text).toBe(twoFrames);
    });

    it('maps numeric types in every frame', () => {
        const r = labelXYZ(twoFrames, new Map([[1, 'O'], [2, 'H']]));
        expect(r.allElements).toBe(true);
        expect(r.text.split('\n')[2]).toBe('O 0.0 0.0 0.0');
        expect(r.text.split('\n')[7]).toBe('H 1.1 0.0 0.0');
    });

    it('flags a partial mapping', () => {
        expect(labelXYZ(twoFrames, new Map([[1, 'O']])).allElements).toBe(false);
    });

    it('accepts element labels from dump_modify element', () => {
        expect(labelXYZ('1\nc\nAr 0 0 0\n').allElements).toBe(true);
    });
});

describe('usesReducedUnits', () => {
    it('detects units lj', () => {
        expect(usesReducedUnits('# x\nunits           lj\n')).toBe(true);
        expect(usesReducedUnits('units real\n# units lj\n')).toBe(false);
    });
});
