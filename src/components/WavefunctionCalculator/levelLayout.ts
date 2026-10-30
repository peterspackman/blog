/** Levels closer than this (eV) are drawn side by side as degenerate. */
export const DEGENERATE_EV = 0.01;

/** A gap longer than this many times the median gap is shortened and marked as broken. */
export const MAX_GAP_RATIO = 3;

export interface LevelLayout {
    /** Vertical position of each level, matching the input order. */
    y: number[];
    /** Horizontal slot of each level and how many share its energy, for degenerate sets. */
    slot: { index: number; of: number }[];
    /** Positions (midway along a shortened gap) to draw an axis break. */
    breaks: number[];
}

/**
 * Where to draw energy levels (eV, highest first) on a vertical axis from
 * `top` to `bottom`. Spacing follows the energies, except that gaps much
 * longer than the typical one (core levels, far virtuals) are shortened so
 * the frontier levels stay readable.
 */
export function layoutLevels(energiesDescending: readonly number[], top: number, bottom: number): LevelLayout {
    const n = energiesDescending.length;
    const gaps = energiesDescending.slice(1).map((e, i) => Math.max(0, energiesDescending[i] - e));
    const real = gaps.filter((g) => g > DEGENERATE_EV).sort((a, b) => a - b);
    const median = real.length ? real[Math.floor(real.length / 2)] : 0;
    const cap = median * MAX_GAP_RATIO;
    const shortened = gaps.map((g) => (median > 0 && g > cap ? cap : g));

    const total = shortened.reduce((a, b) => a + b, 0);
    const span = bottom - top;
    const y: number[] = [];
    let at = 0;
    for (let i = 0; i < n; i++) {
        y.push(total > 0 ? top + (at / total) * span : (top + bottom) / 2);
        if (i < n - 1) at += shortened[i];
    }
    const breaks = gaps.flatMap((g, i) => (median > 0 && g > cap ? [(y[i] + y[i + 1]) / 2] : []));

    const slot: LevelLayout['slot'] = [];
    for (let i = 0; i < n; ) {
        let j = i + 1;
        while (j < n && energiesDescending[i] - energiesDescending[j] <= DEGENERATE_EV) j++;
        for (let k = i; k < j; k++) slot.push({ index: k - i, of: j - i });
        i = j;
    }
    return { y, slot, breaks };
}
