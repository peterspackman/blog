/**
 * A conformational path: NEB images with their energies, and the stationary
 * points along it. Positions between images are interpolated linearly, so
 * playback and scrubbing are smooth while every image stays exact.
 *
 * Distance along the path is `s`, the cumulative all-atom displacement (Å)
 * from the first image; images sit at `s[i]`.
 */

export type PointKind = 'min' | 'ts';

export interface StationaryPoint {
    kind: PointKind;
    label: string;
    frame: number;
}

export interface PathData {
    method: string;
    symbols: string[];
    /** Ring atom indices in ring order, for a ring that's worth drawing. */
    ring?: number[];
    /** kJ/mol, relative to a reference shared by every path being compared. */
    energies: number[];
    /** Per image, flattened x y z (Å). */
    frames: number[][];
    /** Per image, a partial charge per atom (e). */
    charges?: number[][];
    points: { kind: string; label: string; frame: number }[];
}

export interface ConformerPath {
    method: string;
    symbols: string[];
    ring: number[];
    energies: number[];
    frames: Float32Array[];
    charges: Float32Array[] | null;
    /** Path coordinate of each image (Å). */
    s: number[];
    length: number;
    points: StationaryPoint[];
}

export function buildPath(data: PathData): ConformerPath {
    const frames = data.frames.map((f) => Float32Array.from(f));
    const s = [0];
    for (let i = 1; i < frames.length; i++) {
        const a = frames[i - 1], b = frames[i];
        let d2 = 0;
        for (let k = 0; k < a.length; k++) d2 += (b[k] - a[k]) ** 2;
        s.push(s[i - 1] + Math.sqrt(d2));
    }
    return {
        method: data.method,
        symbols: data.symbols,
        ring: data.ring ?? [],
        energies: data.energies,
        frames,
        charges: data.charges ? data.charges.map((q) => Float32Array.from(q)) : null,
        s,
        length: s[s.length - 1],
        points: data.points.map((p) => ({ kind: p.kind === 'ts' ? 'ts' : 'min', label: p.label, frame: p.frame })),
    };
}

/** Hydrogens within bonding distance of atom `i` in the first image. */
export function bondedHydrogens(path: ConformerPath, i: number, cutoff = 1.2): number[] {
    const x = path.frames[0];
    const out: number[] = [];
    path.symbols.forEach((el, j) => {
        if (el !== 'H' || j === i) return;
        const d = Math.hypot(x[3 * j] - x[3 * i], x[3 * j + 1] - x[3 * i + 1], x[3 * j + 2] - x[3 * i + 2]);
        if (d < cutoff) out.push(j);
    });
    return out;
}

/** The image interval containing `s`, and how far through it (0–1). */
export function locate(path: ConformerPath, s: number): { i: number; t: number } {
    const { s: knots } = path;
    const last = knots.length - 1;
    if (s <= 0) return { i: 0, t: 0 };
    if (s >= path.length) return { i: last - 1, t: 1 };
    let lo = 0, hi = last;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (knots[mid] <= s) lo = mid;
        else hi = mid;
    }
    return { i: lo, t: (s - knots[lo]) / (knots[lo + 1] - knots[lo]) };
}

export function energyAt(path: ConformerPath, s: number): number {
    const { i, t } = locate(path, s);
    return path.energies[i] * (1 - t) + path.energies[i + 1] * t;
}

/** Positions at `s`, written into `out` (allocated if not given). */
export function positionsAt(path: ConformerPath, s: number, out?: Float32Array): Float32Array {
    const { i, t } = locate(path, s);
    const a = path.frames[i], b = path.frames[i + 1];
    const result = out ?? new Float32Array(a.length);
    for (let k = 0; k < a.length; k++) result[k] = a[k] + (b[k] - a[k]) * t;
    return result;
}

/** Charges at `s`, interpolated like the positions; null if the path has none. */
export function chargesAt(path: ConformerPath, s: number, out?: Float32Array): Float32Array | null {
    if (!path.charges) return null;
    const { i, t } = locate(path, s);
    const a = path.charges[i], b = path.charges[i + 1];
    const result = out ?? new Float32Array(a.length);
    for (let k = 0; k < a.length; k++) result[k] = a[k] + (b[k] - a[k]) * t;
    return result;
}

/**
 * A shared x for comparing paths: the stationary points sit at evenly spaced
 * x from 0 to 1 on every path (so all the transition states line up), with s
 * linear in x between them.
 */
export interface Progress {
    toS(x: number): number;
    fromS(s: number): number;
}

export function progressOf(path: ConformerPath): Progress {
    const knotsS = path.points.map((p) => path.s[p.frame]);
    const knotsX = knotsS.map((_, k) => k / (knotsS.length - 1));
    const interp = (v: number, from: number[], to: number[]) => {
        if (v <= from[0]) return to[0];
        for (let k = 1; k < from.length; k++) {
            if (v <= from[k]) return to[k - 1] + ((v - from[k - 1]) / (from[k] - from[k - 1])) * (to[k] - to[k - 1]);
        }
        return to[to.length - 1];
    };
    return { toS: (x) => interp(x, knotsX, knotsS), fromS: (s) => interp(s, knotsS, knotsX) };
}

/** The identity: x is s, for a page showing one path. */
export const distanceAlong: Progress = { toS: (x) => x, fromS: (s) => s };

/** The nearest image to `s`. */
export function nearestFrame(path: ConformerPath, s: number): number {
    const { i, t } = locate(path, s);
    return t < 0.5 ? i : i + 1;
}

/** The stationary point within `tolerance` Å of `s`, if any. */
export function pointAt(path: ConformerPath, s: number, tolerance = 0.05): number {
    return path.points.findIndex((p) => Math.abs(path.s[p.frame] - s) <= tolerance);
}

/**
 * Where on the path we are, held outside React state so a playing animation
 * only re-renders what reads it (the viewer, the profile marker, readouts).
 */
export interface PathCursor {
    get(): number;
    set(s: number): void;
    subscribe(listener: () => void): () => void;
}

export function createCursor(initial = 0): PathCursor {
    let s = initial;
    const listeners = new Set<() => void>();
    return {
        get: () => s,
        set(next) {
            if (next === s) return;
            s = next;
            listeners.forEach((l) => l());
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}
