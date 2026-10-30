import { describe, expect, it } from 'vitest';
import { countScfBlocks, lastScfBlock } from '../scfBlocks';

const its = (...iters: number[]) => iters.map((iter) => ({ iter }));

describe('lastScfBlock', () => {
    it('returns a single SCF unchanged', () => {
        expect(lastScfBlock(its(1, 2, 3))).toEqual(its(1, 2, 3));
    });

    it('returns only the iterations after the last restart', () => {
        expect(lastScfBlock(its(1, 2, 3, 1, 2))).toEqual(its(1, 2));
    });

    it('handles a log with no iterations', () => {
        expect(lastScfBlock([])).toEqual([]);
    });
});

describe('countScfBlocks', () => {
    it('counts each restart of the iteration counter', () => {
        expect(countScfBlocks(its(1, 2, 1, 2, 3, 1))).toBe(3);
    });

    it('counts nothing in an empty log', () => {
        expect(countScfBlocks([])).toBe(0);
    });
});
