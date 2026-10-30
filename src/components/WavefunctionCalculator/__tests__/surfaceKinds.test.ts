import { describe, expect, it } from 'vitest';
import { getSurfaceKindDescriptor } from '@peterspackman/ce-chem/compute';
import { SIGNED_FIELD_KINDS, gridQualityFor, molecularSurfaceKinds, numberParam, surfaceSettings } from '../surfaceKinds';

const kinds = () => molecularSurfaceKinds().map((d) => d.value);

describe('molecularSurfaceKinds', () => {
    it('offers electron density and ESP', () => {
        expect(kinds()).toEqual(expect.arrayContaining(['electron_density', 'esp']));
    });

    it('leaves out Hirshfeld, which needs surrounding atoms', () => {
        expect(kinds()).not.toContain('hirshfeld');
    });

    it('leaves out orbitals, which have their own tab', () => {
        expect(kinds()).not.toContain('orbital');
    });

    it('leaves out crystal voids', () => {
        expect(kinds()).not.toContain('void');
    });
});

describe('surfaceSettings', () => {
    it('maps ESP onto an electron density surface by default', () => {
        const d = getSurfaceKindDescriptor('electron_density')!;
        expect(surfaceSettings(d, 0.002, 0.2).properties).toContain('esp');
    });

    it('carries the chosen isovalue and resolution', () => {
        const d = getSurfaceKindDescriptor('electron_density')!;
        expect(surfaceSettings(d, 0.01, 0.1)).toMatchObject({ surfaceKind: 'electron_density', isovalue: 0.01, separation: 0.1 });
    });
});

describe('numberParam', () => {
    it('finds the catalog isovalue default', () => {
        expect(numberParam(getSurfaceKindDescriptor('electron_density')!, 'isovalue')?.default).toBe(0.002);
    });
});

describe('signed fields', () => {
    it('draws deformation density from its signed grid', () => {
        expect(SIGNED_FIELD_KINDS.deformation_density?.property).toBe('deformation_density');
    });

    it('draws the electrostatic potential from its signed grid', () => {
        expect(SIGNED_FIELD_KINDS.esp?.property).toBe('esp');
    });

    it('draws electron density as a single isosurface', () => {
        expect(SIGNED_FIELD_KINDS.electron_density).toBeUndefined();
    });
});

describe('gridQualityFor', () => {
    it('matches each resolution preset to a grid quality', () => {
        expect([0.5, 0.2, 0.1].map(gridQualityFor)).toEqual(['coarse', 'medium', 'fine']);
    });
});
