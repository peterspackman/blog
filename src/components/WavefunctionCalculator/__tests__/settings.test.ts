import { describe, expect, it } from 'vitest';
import { effectiveBasis, modelLabel } from '../settings';

describe('effectiveBasis', () => {
    it('sends the placeholder basis for GFN2-xTB', () => {
        expect(effectiveBasis('gfn2-xtb', 'def2-svp')).toBe('builtin');
    });

    it('sends the chosen basis for an ab initio method', () => {
        expect(effectiveBasis('b3lyp', 'def2-svp')).toBe('def2-svp');
    });
});

describe('modelLabel', () => {
    it('omits the basis for GFN2-xTB', () => {
        expect(modelLabel('gfn2-xtb', 'builtin')).toBe('GFN2-xTB');
    });

    it('joins method and basis otherwise', () => {
        expect(modelLabel('b3lyp', 'def2-svp')).toBe('B3LYP/def2-SVP');
    });
});
