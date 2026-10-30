import type { OccCubeParams } from '@peterspackman/ce-calc/occ';

/** 1 Å in Bohr; occ's `--origin` and `-a/-b/-c` grid geometry is in Bohr. */
export const ANGSTROM_TO_BOHR = 1 / 0.52917721067;

/** Space left around the atoms' bounding box, in Å. */
export const BOX_MARGIN = 5;

export type GridQuality = 'coarse' | 'medium' | 'fine';

/** Target voxel spacing in Å for each quality. */
export const GRID_SPACING: Record<GridQuality, number> = { coarse: 0.3, medium: 0.2, fine: 0.12 };

/** Upper bound on points per axis, so a large molecule can't ask for a huge grid. */
export const MAX_STEPS = 120;

type Vec3 = [number, number, number];
export type CubeBox = Required<Pick<OccCubeParams, 'origin' | 'da' | 'db' | 'dc' | 'steps'>>;

/**
 * An explicit, axis-aligned cube grid around the atoms (positions in Å), as
 * occ's cube arguments. occ's adaptive box searches outward from the centre
 * and misses off-centre lobes, so orbitals always use this instead.
 *
 * occ takes one point count for all three axes, so each axis gets its own
 * voxel vector: `steps` points span `steps - 1` intervals of the axis length.
 */
export function cubeBoxAround(positions: ReadonlyArray<{ x: number; y: number; z: number }>, quality: GridQuality): CubeBox {
    if (positions.length === 0) throw new Error('cubeBoxAround: no atoms to box');
    const axis = (k: 'x' | 'y' | 'z') => {
        const v = positions.map((p) => p[k]);
        const lo = Math.min(...v);
        const hi = Math.max(...v);
        return { lo: lo - BOX_MARGIN, size: hi - lo + 2 * BOX_MARGIN };
    };
    const [x, y, z] = [axis('x'), axis('y'), axis('z')];
    const largest = Math.max(x.size, y.size, z.size);
    const steps = Math.min(MAX_STEPS, Math.ceil(largest / GRID_SPACING[quality]) + 1);
    const perStep = ANGSTROM_TO_BOHR / (steps - 1);
    const origin: Vec3 = [x.lo * ANGSTROM_TO_BOHR, y.lo * ANGSTROM_TO_BOHR, z.lo * ANGSTROM_TO_BOHR];
    return {
        origin,
        da: [x.size * perStep, 0, 0],
        db: [0, y.size * perStep, 0],
        dc: [0, 0, z.size * perStep],
        steps,
    };
}
