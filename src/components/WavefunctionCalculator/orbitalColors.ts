import type { RGB } from '@peterspackman/ce-viewer/viewer';
import type { VizTheme } from '../shared/viz';

export interface LobeColors {
    positive: RGB;
    negative: RGB;
}

/**
 * A CSS colour as RGB in 0–1. Handles #rgb, #rrggbb (with or without alpha)
 * and rgb()/rgba(): the minifier turns #ffffff into #fff, and computed
 * custom properties can come back in either form.
 */
export function cssColorToRgb(css: string): RGB {
    const s = css.trim();
    const fn = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
    if (fn) return [Number(fn[1]) / 255, Number(fn[2]) / 255, Number(fn[3]) / 255];
    let hex = s.replace('#', '');
    if (hex.length === 3 || hex.length === 4) hex = [...hex.slice(0, 3)].map((c) => c + c).join('');
    const v = parseInt(hex.slice(0, 6), 16);
    if (!/^[0-9a-f]{6}/i.test(hex) || Number.isNaN(v)) throw new Error(`Unrecognised colour "${css}"`);
    return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

/** A CSS colour as the 0xRRGGBB number three.js takes. */
export function cssColorToHex(css: string): number {
    const [r, g, b] = cssColorToRgb(css).map((c) => Math.round(c * 255));
    return (r << 16) | (g << 8) | b;
}

export const rgbToCss = ([r, g, b]: RGB) => `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;

/**
 * Lobe colour pairs, in the order orbitals are selected: the theme's
 * positive/negative pair first, then pairs from the categorical series.
 */
export function lobePalette(theme: VizTheme): LobeColors[] {
    const s = theme.series;
    const pairs: [string, string][] = [
        [theme.positive, theme.negative],
        [s[2], s[6]],
        [s[3], s[4]],
        [s[7], s[5]],
    ];
    return pairs.map(([p, n]) => ({ positive: cssColorToRgb(p), negative: cssColorToRgb(n) }));
}
