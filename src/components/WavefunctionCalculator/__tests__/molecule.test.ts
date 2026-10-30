import { describe, expect, it } from 'vitest';
import { allowedMultiplicities, looksLikeSdf, parseMolecule } from '../molecule';

const WATER_XYZ = `3
water
O 0.0000 0.0000 0.1173
H 0.0000 0.7572 -0.4692
H 0.0000 -0.7572 -0.4692
`;

const METHANOL_SDF = `methanol
  manual

  6  5  0  0  0  0  0  0  0  0999 V2000
   -0.3710    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.0420    0.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
   -0.7300    1.0280    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0
   -0.7300   -0.5140    0.8900 H   0  0  0  0  0  0  0  0  0  0  0  0
   -0.7300   -0.5140   -0.8900 H   0  0  0  0  0  0  0  0  0  0  0  0
    1.3600    0.9000    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0
  1  3  1  0
  1  4  1  0
  1  5  1  0
  2  6  1  0
M  END
$$$$
`;

describe('parseMolecule', () => {
    it('reads XYZ atoms', () => {
        expect(parseMolecule(WATER_XYZ).data.atoms).toHaveLength(3);
    });

    it('computes the display formula', () => {
        expect(parseMolecule(WATER_XYZ).formula).toBe('H₂ O');
    });

    it('sums the nuclear charge', () => {
        expect(parseMolecule(WATER_XYZ).nuclearCharge).toBe(10);
    });

    it('reads SDF text without a filename', () => {
        expect(parseMolecule(METHANOL_SDF).data.atoms).toHaveLength(6);
    });

    it('keeps the bonds an SDF file gives', () => {
        expect(parseMolecule(METHANOL_SDF).data.bonds).toHaveLength(5);
    });

    it('rejects text with no atoms', () => {
        expect(() => parseMolecule('0\nempty\n')).toThrow();
    });
});

describe('looksLikeSdf', () => {
    it('spots a V2000 counts line', () => {
        expect(looksLikeSdf(METHANOL_SDF)).toBe(true);
    });

    it('leaves XYZ alone', () => {
        expect(looksLikeSdf(WATER_XYZ)).toBe(false);
    });
});

describe('allowedMultiplicities', () => {
    it('gives odd multiplicities for an even electron count', () => {
        expect(allowedMultiplicities(10)).toEqual([1, 3, 5, 7]);
    });

    it('gives even multiplicities for an odd electron count', () => {
        expect(allowedMultiplicities(9)).toEqual([2, 4, 6]);
    });

    it('allows only a doublet for one electron', () => {
        expect(allowedMultiplicities(1)).toEqual([2]);
    });
});
