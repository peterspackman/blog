import type { DmaResult } from '@peterspackman/ce-chem/compute/dma-types.js';
import type { ChargeScheme } from '@peterspackman/ce-chem/compute/charge-schemes.js';

/** First occjs whose `occ dma` takes `--charges` (and handles xTB wavefunctions). */
export const POPULATION_OCC_VERSION = '0.9.6';

/** True if a dotted version (e.g. occjs's) is at least `minimum`; false if unknown. */
export function atLeastVersion(version: string | undefined, minimum: string): boolean {
    if (!version) return false;
    const a = version.split(/[.-]/).map((x) => parseInt(x, 10));
    const b = minimum.split('.').map((x) => parseInt(x, 10));
    for (let i = 0; i < b.length; i++) {
        const x = Number.isFinite(a[i]) ? a[i] : 0;
        if (x !== b[i]) return x > b[i];
    }
    return true;
}

/**
 * The schemes worth a column. GFN2-xTB's own charges are Mulliken charges of
 * its minimal basis, so when `xtb` is offered `mulliken` would only repeat it.
 */
export function distinctChargeSchemes(schemes: readonly ChargeScheme[]): ChargeScheme[] {
    return schemes.includes('xtb') ? schemes.filter((s) => s !== 'mulliken') : [...schemes];
}

/** One scheme's partial charges, one per atom, in e. */
export interface ChargeSet {
    id: 'dma' | ChargeScheme;
    label: string;
    values: number[];
}

/**
 * Atomic charges from a distributed multipole analysis: each site's rank-0
 * moment (Q00), placed on its atom.
 */
export function dmaCharges(result: DmaResult, atomCount: number): number[] {
    const out = new Array<number>(atomCount).fill(0);
    result.sites.forEach((site, i) => {
        const atom = site.atomIndex ?? i;
        if (atom >= 0 && atom < atomCount) out[atom] = site.q[0] ?? 0;
    });
    return out;
}

/**
 * GFN2-xTB charges stored in an occ wavefunction file, if it has them. occ
 * writes Eigen vectors as N×1 matrices ([[q1], [q2], …]); a flat list is
 * accepted too.
 */
export function xtbCharges(owf: unknown): number[] | undefined {
    const charges = (owf as { xtb?: { 'atomic charges'?: unknown } } | null)?.xtb?.['atomic charges'];
    if (!Array.isArray(charges)) return undefined;
    const flat = charges.map((q) => (Array.isArray(q) && q.length === 1 ? q[0] : q));
    return flat.every((q) => typeof q === 'number') ? flat : undefined;
}

/** Half-width of a colour range centred on zero that covers every charge. */
export function symmetricLimit(values: readonly number[]): number {
    const max = values.reduce((m, q) => Math.max(m, Math.abs(q)), 0);
    return max > 0 ? max : 1;
}

/** Position of a charge on a diverging scale, 0 (most negative) to 1 (most positive). */
export function chargeToUnit(q: number, limit: number): number {
    return Math.min(1, Math.max(0, (q / limit + 1) / 2));
}

/** A signed charge for a label, with a true minus sign: "+0.42", "−0.83". */
export function formatCharge(q: number, digits = 2): string {
    const s = Math.abs(q).toFixed(digits);
    if (Number(s) === 0) return s;
    return `${q < 0 ? '−' : '+'}${s}`;
}
