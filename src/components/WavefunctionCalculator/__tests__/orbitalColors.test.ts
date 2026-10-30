import { describe, expect, it } from 'vitest';
import { cssColorToHex, cssColorToRgb } from '../orbitalColors';

describe('cssColorToHex', () => {
    it('reads six-digit hex', () => {
        expect(cssColorToHex('#1f5bbf')).toBe(0x1f5bbf);
    });

    it('expands three-digit hex, as the CSS minifier writes white', () => {
        expect(cssColorToHex('#fff')).toBe(0xffffff);
    });

    it('reads rgb()', () => {
        expect(cssColorToHex('rgb(34, 36, 41)')).toBe(0x222429);
    });

    it('ignores an alpha channel', () => {
        expect(cssColorToHex('#22242980')).toBe(0x222429);
    });
});

describe('cssColorToRgb', () => {
    it('scales channels to 0–1', () => {
        expect(cssColorToRgb('#ff0000')).toEqual([1, 0, 0]);
    });

    it('rejects text that is not a colour', () => {
        expect(() => cssColorToRgb('var(--viz-canvas)')).toThrow(/Unrecognised colour/);
    });
});
