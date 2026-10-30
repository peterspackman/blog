import { describe, expect, it } from 'vitest';
import type { DmaResult } from '@peterspackman/ce-chem/compute/dma-types.js';
import { atLeastVersion, chargeToUnit, distinctChargeSchemes, dmaCharges, formatCharge, symmetricLimit, xtbCharges } from '../charges';

const dma = (sites: Partial<DmaResult['sites'][number]>[]) =>
    ({ maxRank: 1, units: 'au', punch: '', sites: sites.map((s) => ({ name: 'X', position: [0, 0, 0], maxRank: 1, q: [0], ...s })) }) as DmaResult;

describe('dmaCharges', () => {
    it('takes each site’s monopole as its atom’s charge', () => {
        expect(dmaCharges(dma([{ q: [-0.8, 0, 0, 0] }, { q: [0.4] }, { q: [0.4] }]), 3)).toEqual([-0.8, 0.4, 0.4]);
    });

    it('places a site on the atom it names', () => {
        expect(dmaCharges(dma([{ atomIndex: 1, q: [0.5] }]), 2)).toEqual([0, 0.5]);
    });
});

describe('xtbCharges', () => {
    it('reads charges stored as occ writes vectors, one row per atom', () => {
        expect(xtbCharges({ xtb: { 'atomic charges': [[-0.6], [0.3], [0.3]] } })).toEqual([-0.6, 0.3, 0.3]);
    });

    it('reads a flat list of charges', () => {
        expect(xtbCharges({ xtb: { 'atomic charges': [-0.6, 0.3, 0.3] } })).toEqual([-0.6, 0.3, 0.3]);
    });

    it('finds nothing in a Hartree–Fock wavefunction', () => {
        expect(xtbCharges({ method: 'hf' })).toBeUndefined();
    });
});

describe('distinctChargeSchemes', () => {
    it('drops Mulliken when the GFN2-xTB charges are offered', () => {
        expect(distinctChargeSchemes(['mulliken', 'lowdin', 'xtb'])).toEqual(['lowdin', 'xtb']);
    });

    it('keeps Mulliken for a Hartree–Fock or DFT wavefunction', () => {
        expect(distinctChargeSchemes(['mulliken', 'lowdin'])).toEqual(['mulliken', 'lowdin']);
    });
});

describe('symmetricLimit', () => {
    it('covers the largest charge of either sign', () => {
        expect(symmetricLimit([-0.8, 0.4])).toBe(0.8);
    });

    it('falls back to 1 when every charge is zero', () => {
        expect(symmetricLimit([0, 0])).toBe(1);
    });
});

describe('chargeToUnit', () => {
    it('puts zero in the middle of the scale', () => {
        expect(chargeToUnit(0, 0.8)).toBe(0.5);
    });

    it('puts the most negative charge at the bottom', () => {
        expect(chargeToUnit(-0.8, 0.8)).toBe(0);
    });
});

describe('formatCharge', () => {
    it('writes a negative charge with a true minus sign', () => {
        expect(formatCharge(-0.834)).toBe('−0.83');
    });

    it('signs a positive charge', () => {
        expect(formatCharge(0.417)).toBe('+0.42');
    });

    it('leaves a charge that rounds to zero unsigned', () => {
        expect(formatCharge(-0.001)).toBe('0.00');
    });
});

describe('atLeastVersion', () => {
    it('accepts the minimum itself', () => {
        expect(atLeastVersion('0.9.6', '0.9.6')).toBe(true);
    });

    it('rejects an older patch release', () => {
        expect(atLeastVersion('0.9.5', '0.9.6')).toBe(false);
    });

    it('compares numerically, not as text', () => {
        expect(atLeastVersion('0.10.0', '0.9.6')).toBe(true);
    });

    it('treats an unknown version as too old', () => {
        expect(atLeastVersion(undefined, '0.9.6')).toBe(false);
    });
});
