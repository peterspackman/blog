import { jacobiEigen } from '@peterspackman/ce-chem/math';

type Vec3 = [number, number, number];

export interface ViewAxes {
    /** Direction of least spread: look along it to see a planar molecule face-on. */
    normal: Vec3;
    /** Middle axis, used as screen-up so the longest axis lies across the (wider) viewport. */
    up: Vec3;
}

/**
 * Principal axes of the atom positions (unweighted), for a face-on default
 * view. Null when there is no spread to orient by (a single atom).
 */
export function viewAxes(positions: ReadonlyArray<{ x: number; y: number; z: number }>): ViewAxes | null {
    const n = positions.length;
    if (n < 2) return null;
    const c = [0, 0, 0];
    for (const p of positions) {
        c[0] += p.x / n;
        c[1] += p.y / n;
        c[2] += p.z / n;
    }
    const cov = new Float64Array(9);
    for (const p of positions) {
        const d = [p.x - c[0], p.y - c[1], p.z - c[2]];
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i * 3 + j] += d[i] * d[j];
    }
    const { values, vectors } = jacobiEigen(cov, 3);
    if (values[2] < 1e-8) return null;
    // Column-major: eigenvector j is vectors[j*3 .. j*3+2], eigenvalues ascending.
    const column = (j: number): Vec3 => [vectors[j * 3], vectors[j * 3 + 1], vectors[j * 3 + 2]];
    return { normal: column(0), up: column(1) };
}
