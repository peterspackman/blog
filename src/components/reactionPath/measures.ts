import { atomAngle, atomDihedral, atomDistance, type Measurement } from '@peterspackman/ce-chem/math';
import type { Vec3Tuple } from '@peterspackman/ce-chem/math/vec3.js';

/** A measurement by atom indices: 2 atoms a distance, 3 an angle, 4 a dihedral. */
export type MeasureDef = readonly number[];

/** A measurement shown with its own toggle: one or more defs drawn together. */
export interface NamedMeasure {
    key: string;
    label: string;
    defs: MeasureDef[];
}

/** The measurement for `def` with atoms at `positions` (flat x y z). */
export function measure(def: MeasureDef, positions: ArrayLike<number>): Measurement {
    const p = def.map((i): Vec3Tuple => [positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]]);
    const kind = def.length === 2 ? 'distance' : def.length === 3 ? 'angle' : 'dihedral';
    const value =
        kind === 'distance' ? atomDistance(p[0], p[1]) : kind === 'angle' ? atomAngle(p[0], p[1], p[2]) : atomDihedral(p[0], p[1], p[2], p[3]);
    return {
        kind,
        atomIndices: [...def],
        value,
        unit: kind === 'distance' ? 'Å' : '°',
        positions: p.map(([x, y, z]) => ({ x, y, z })),
    };
}

export function formatMeasure(m: Measurement): string {
    return m.kind === 'distance' ? `${m.value.toFixed(2)} Å` : `${m.value.toFixed(0)}°`;
}

type Point = { x: number; y: number; z: number };

/**
 * Where a measurement's label goes: pushed out from `centre` (the ring's
 * centroid) past the vertex of an angle or the middle of a dihedral's central
 * bond, so labels round a ring spread out instead of meeting in the middle.
 * Distances keep their midpoint.
 */
export function labelAnchor(m: Measurement, centre: Point, push = 0.6): Point {
    const p = m.positions;
    const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
    if (m.kind === 'distance') return mid(p[0], p[1]);
    const at = m.kind === 'angle' ? p[1] : mid(p[1], p[2]);
    const d = { x: at.x - centre.x, y: at.y - centre.y, z: at.z - centre.z };
    const len = Math.hypot(d.x, d.y, d.z) || 1;
    return { x: at.x + (d.x / len) * push, y: at.y + (d.y / len) * push, z: at.z + (d.z / len) * push };
}

/** Centroid of atoms `indices` at `positions` (flat x y z). */
export function centroid(indices: readonly number[], positions: ArrayLike<number>): Point {
    const c = { x: 0, y: 0, z: 0 };
    for (const i of indices) {
        c.x += positions[3 * i] / indices.length;
        c.y += positions[3 * i + 1] / indices.length;
        c.z += positions[3 * i + 2] / indices.length;
    }
    return c;
}
