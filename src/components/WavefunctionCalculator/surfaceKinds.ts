import { defaultParamValues, listSurfaceKindDescriptors } from '@peterspackman/ce-chem/compute';
import type { SurfaceKindDescriptor, SurfaceParam, SurfaceSettings } from '@peterspackman/ce-chem/compute/surface-types.js';
import type { GridQuality } from './cubeBox';

/**
 * The surface kinds that make sense for one isolated molecule with a
 * wavefunction: ce-chem's catalog minus crystal-only kinds, kinds that divide
 * space against surrounding atoms (Hirshfeld and relatives), advanced research
 * kinds, and orbitals, which have their own tab.
 */
export function molecularSurfaceKinds(descriptors: readonly SurfaceKindDescriptor[] = listSurfaceKindDescriptors()): SurfaceKindDescriptor[] {
    return descriptors.filter(
        (d) =>
            (d.category === 'molecule' || d.category === 'wavefunction') &&
            !d.advanced &&
            !d.requiresCrystal &&
            !d.partitionsEnvironment &&
            d.value !== 'orbital',
    );
}

type NumberParam = Extract<SurfaceParam, { kind: 'number' }>;

/** A kind's numeric parameter (isovalue, separation) by key, for building controls from the catalog. */
export function numberParam(d: SurfaceKindDescriptor, key: string): NumberParam | undefined {
    return d.parameters.find((p): p is NumberParam => p.kind === 'number' && p.key === key);
}

/** The compute settings for a kind at the given isovalue and resolution, with the catalog's default properties. */
export function surfaceSettings(d: SurfaceKindDescriptor, isovalue: number, separation: number): SurfaceSettings {
    return d.toSettings({ ...defaultParamValues(d), isovalue, separation });
}

/** How a signed field is evaluated and what its two signs mean. */
export interface SignedField {
    /** occ cube property that evaluates the field on a grid. */
    property: string;
    positive: string;
    negative: string;
    /** Draw + in the theme's negative colour and − in its positive one, to agree
     *  with the property colormap (ESP's runs red for negative to blue for positive). */
    invertColours?: boolean;
}

/**
 * Kinds whose field is signed. occ's isosurface command meshes one isovalue,
 * so these come back as a grid instead and are drawn as + and − lobes at
 * ±isovalue, like an orbital.
 */
export const SIGNED_FIELD_KINDS: Partial<Record<SurfaceKindDescriptor['value'], SignedField>> = {
    deformation_density: { property: 'deformation_density', positive: 'build-up', negative: 'depletion' },
    esp: { property: 'esp', positive: 'positive potential', negative: 'negative potential', invertColours: true },
};

/** The cube grid quality closest to an isosurface resolution (Å). */
export function gridQualityFor(separation: number): GridQuality {
    if (separation <= 0.12) return 'fine';
    if (separation <= 0.25) return 'medium';
    return 'coarse';
}
