/**
 * Wulff construction by half-space clipping.
 *
 * The equilibrium shape is { x : n_i · x ≤ γ_i for every facet normal n_i }
 * (Wulff's theorem: each facet sits at a distance from the centre
 * proportional to its surface energy). Clipping a large starting box by each
 * half-space is simple and robust: no special cases for facets that drop out,
 * which just never contribute an edge or face.
 */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

// ---------------------------------------------------------------------------
// 2D
// ---------------------------------------------------------------------------

export interface Facet2D {
    /** Outward normal angle in degrees. */
    angle: number;
    gamma: number;
    /** Family index (for colouring and grouping). */
    family: number;
}

export interface WulffShape2D {
    /** Polygon vertices, counter-clockwise. */
    vertices: Vec2[];
    /** For each polygon edge i (vertices[i] → vertices[i+1]), the facet index that made it, or -1. */
    edgeFacet: number[];
    /** Edge length contributed by each facet (0 if the facet is absent). */
    facetLength: number[];
    perimeter: number;
}

interface Vertex2 {
    p: Vec2;
    /** Facet index of the edge from this vertex to the next. */
    edge: number;
}

function clipPolygon2D(poly: Vertex2[], n: Vec2, d: number, facet: number): Vertex2[] {
    const out: Vertex2[] = [];
    const eps = 1e-12;
    const side = (p: Vec2) => n[0] * p[0] + n[1] * p[1] - d;
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        const sa = side(a.p);
        const sb = side(b.p);
        const aIn = sa <= eps;
        const bIn = sb <= eps;
        if (aIn) out.push({ p: a.p, edge: a.edge });
        if (aIn !== bIn) {
            const t = sa / (sa - sb);
            const p: Vec2 = [a.p[0] + t * (b.p[0] - a.p[0]), a.p[1] + t * (b.p[1] - a.p[1])];
            // Leaving the half-plane: the new edge runs along the clip line.
            out.push({ p, edge: aIn ? facet : a.edge });
        }
    }
    return out;
}

export function wulff2D(facets: Facet2D[], extent = 100): WulffShape2D {
    let poly: Vertex2[] = [
        { p: [-extent, -extent], edge: -1 },
        { p: [extent, -extent], edge: -1 },
        { p: [extent, extent], edge: -1 },
        { p: [-extent, extent], edge: -1 },
    ];
    facets.forEach((f, i) => {
        const a = (f.angle * Math.PI) / 180;
        poly = clipPolygon2D(poly, [Math.cos(a), Math.sin(a)], Math.max(f.gamma, 1e-6), i);
    });
    const facetLength = new Array(facets.length).fill(0);
    let perimeter = 0;
    poly.forEach((v, i) => {
        const w = poly[(i + 1) % poly.length];
        const len = Math.hypot(w.p[0] - v.p[0], w.p[1] - v.p[1]);
        perimeter += len;
        if (v.edge >= 0) facetLength[v.edge] += len;
    });
    return { vertices: poly.map((v) => v.p), edgeFacet: poly.map((v) => v.edge), facetLength, perimeter };
}

export type Lattice2D = 'square' | 'rectangular' | 'hexagonal';

export interface LatticeFacet {
    angle: number;
    family: number;
}

/** Family labels per lattice, in family-index order. */
export const LATTICE_FAMILIES: Record<Lattice2D, string[]> = {
    square: ['{10}', '{11}'],
    rectangular: ['{10}', '{01}', '{11}'],
    hexagonal: ['{10}', '{11}'],
};

/**
 * Facet normals for a 2D lattice. In the rectangular lattice (2D analogue of
 * orthorhombic) the a and b directions are inequivalent, and the {11} normal
 * follows the reciprocal metric (1/a, 1/b), so it tilts with b/a.
 */
export function latticeFacets(lattice: Lattice2D, bOverA = 1): LatticeFacet[] {
    const out: LatticeFacet[] = [];
    if (lattice === 'rectangular') {
        const phi = (Math.atan2(1 / bOverA, 1) * 180) / Math.PI;
        out.push({ angle: 0, family: 0 }, { angle: 180, family: 0 }, { angle: 90, family: 1 }, { angle: 270, family: 1 });
        for (const a of [phi, 180 - phi, 180 + phi, 360 - phi]) out.push({ angle: a, family: 2 });
    } else {
        const step = lattice === 'square' ? 90 : 60;
        const offset = lattice === 'square' ? 45 : 30;
        for (let a = 0; a < 360; a += step) out.push({ angle: a, family: 0 });
        for (let a = offset; a < 360; a += step) out.push({ angle: a, family: 1 });
    }
    return out.sort((x, y) => x.angle - y.angle);
}

// ---------------------------------------------------------------------------
// 3D
// ---------------------------------------------------------------------------

export interface Plane3D {
    normal: Vec3; // unit
    gamma: number;
    family: number;
}

export interface Face3D {
    vertices: Vec3[];
    /** Family of the facet that made this face, or -1 for the starting box. */
    family: number;
    normal: Vec3;
}

export interface WulffShape3D {
    faces: Face3D[];
    /** Total area per family index. */
    familyArea: number[];
    totalArea: number;
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
};

export function polygonArea3D(vs: Vec3[]): number {
    let s: Vec3 = [0, 0, 0];
    for (let i = 0; i < vs.length; i++) {
        const c = cross(vs[i], vs[(i + 1) % vs.length]);
        s = [s[0] + c[0], s[1] + c[1], s[2] + c[2]];
    }
    return Math.hypot(s[0], s[1], s[2]) / 2;
}

function boxFaces(L: number): Face3D[] {
    const f = (normal: Vec3, vs: Vec3[]): Face3D => ({ vertices: vs, family: -1, normal });
    return [
        f([1, 0, 0], [[L, -L, -L], [L, L, -L], [L, L, L], [L, -L, L]]),
        f([-1, 0, 0], [[-L, -L, -L], [-L, -L, L], [-L, L, L], [-L, L, -L]]),
        f([0, 1, 0], [[-L, L, -L], [-L, L, L], [L, L, L], [L, L, -L]]),
        f([0, -1, 0], [[-L, -L, -L], [L, -L, -L], [L, -L, L], [-L, -L, L]]),
        f([0, 0, 1], [[-L, -L, L], [L, -L, L], [L, L, L], [-L, L, L]]),
        f([0, 0, -1], [[-L, -L, -L], [-L, L, -L], [L, L, -L], [L, -L, -L]]),
    ];
}

function clipPolyhedron(faces: Face3D[], plane: Plane3D): Face3D[] {
    const { normal: n, gamma: d } = plane;
    const eps = 1e-9;
    const out: Face3D[] = [];
    const capPoints: Vec3[] = [];
    for (const face of faces) {
        const vs = face.vertices;
        const kept: Vec3[] = [];
        for (let i = 0; i < vs.length; i++) {
            const a = vs[i];
            const b = vs[(i + 1) % vs.length];
            const sa = dot(n, a) - d;
            const sb = dot(n, b) - d;
            if (sa <= eps) kept.push(a);
            if (Math.abs(sa) <= eps) capPoints.push(a);
            if ((sa < -eps && sb > eps) || (sa > eps && sb < -eps)) {
                const t = sa / (sa - sb);
                const p: Vec3 = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
                kept.push(p);
                capPoints.push(p);
            }
        }
        if (kept.length >= 3 && polygonArea3D(kept) > 1e-10) out.push({ ...face, vertices: kept });
    }
    // Cap: the new face lying in the clip plane.
    const unique: Vec3[] = [];
    for (const p of capPoints) if (!unique.some((q) => Math.hypot(...sub(p, q)) < 1e-7)) unique.push(p);
    if (unique.length >= 3) {
        const c = unique.reduce<Vec3>((acc, p) => [acc[0] + p[0] / unique.length, acc[1] + p[1] / unique.length, acc[2] + p[2] / unique.length], [0, 0, 0]);
        const u = norm(Math.abs(n[0]) < 0.9 ? cross(n, [1, 0, 0]) : cross(n, [0, 1, 0]));
        const v = cross(n, u);
        unique.sort((p, q) => {
            const dp = sub(p, c);
            const dq = sub(q, c);
            return Math.atan2(dot(dp, v), dot(dp, u)) - Math.atan2(dot(dq, v), dot(dq, u));
        });
        if (polygonArea3D(unique) > 1e-10) out.push({ vertices: unique, family: plane.family, normal: n });
    }
    return out;
}

export function wulff3D(planes: Plane3D[], extent = 100): WulffShape3D {
    let faces = boxFaces(extent);
    for (const p of planes) faces = clipPolyhedron(faces, { ...p, gamma: Math.max(p.gamma, 1e-6) });
    const nFam = Math.max(0, ...planes.map((p) => p.family + 1));
    const familyArea = new Array(nFam).fill(0);
    let totalArea = 0;
    for (const f of faces) {
        const a = polygonArea3D(f.vertices);
        totalArea += a;
        if (f.family >= 0) familyArea[f.family] += a;
    }
    return { faces, familyArea, totalArea };
}

/** All distinct permutations and sign changes of (h, k, l), normalised. */
export function cubicFamily(h: number, k: number, l: number): Vec3[] {
    const perms: Vec3[] = [
        [h, k, l], [h, l, k], [k, h, l], [k, l, h], [l, h, k], [l, k, h],
    ];
    const out: Vec3[] = [];
    for (const [a, b, c] of perms) {
        for (const sa of [1, -1]) for (const sb of [1, -1]) for (const sc of [1, -1]) {
            const v = norm([a * sa, b * sb, c * sc]);
            if (!out.some((w) => Math.hypot(...sub(v, w)) < 1e-9)) out.push(v);
        }
    }
    return out;
}

/** Cubic crystal with {100}, {110}, {111} facets (families 0, 1, 2). */
export function cubicWulff(g100: number, g110: number, g111: number): WulffShape3D {
    const planes: Plane3D[] = [
        ...cubicFamily(1, 0, 0).map((normal) => ({ normal, gamma: g100, family: 0 })),
        ...cubicFamily(1, 1, 0).map((normal) => ({ normal, gamma: g110, family: 1 })),
        ...cubicFamily(1, 1, 1).map((normal) => ({ normal, gamma: g111, family: 2 })),
    ];
    return wulff3D(planes);
}

// ---------------------------------------------------------------------------
// Orthorhombic (point group mmm): no axis is equivalent to another, so each
// of {100}, {010}, {001} has its own energy and needles or plates can form.
// ---------------------------------------------------------------------------

export const ORTHO_FAMILIES = ['100', '010', '001', '110', '101', '011', '111'] as const;
export type OrthoFamily = (typeof ORTHO_FAMILIES)[number];

/** Sign variants of (h, k, l); normals follow the reciprocal metric (h/a, k/b, l/c). */
export function orthoFamily(h: number, k: number, l: number, a: number, b: number, c: number): Vec3[] {
    const out: Vec3[] = [];
    for (const sh of [1, -1]) for (const sk of [1, -1]) for (const sl of [1, -1]) {
        const v = norm([(sh * h) / a, (sk * k) / b, (sl * l) / c]);
        if (!out.some((w) => Math.hypot(...sub(v, w)) < 1e-9)) out.push(v);
    }
    return out;
}

export function orthorhombicWulff(
    gamma: Record<OrthoFamily, number>,
    cell: { a: number; b: number; c: number } = { a: 1, b: 1, c: 1 },
): WulffShape3D {
    const planes: Plane3D[] = [];
    ORTHO_FAMILIES.forEach((fam, i) => {
        const [h, k, l] = fam.split('').map(Number);
        for (const normal of orthoFamily(h, k, l, cell.a, cell.b, cell.c)) planes.push({ normal, gamma: gamma[fam], family: i });
    });
    return wulff3D(planes);
}

/** Full extent of the shape along x, y and z. */
export function extents(shape: WulffShape3D): Vec3 {
    const lo: Vec3 = [Infinity, Infinity, Infinity];
    const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const f of shape.faces) for (const p of f.vertices) for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i], p[i]);
        hi[i] = Math.max(hi[i], p[i]);
    }
    return [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
}

// ---------------------------------------------------------------------------
// Smooth (cusped) surface energies: the path from a liquid droplet to a
// faceted crystal. γ has sharp minima (cusps) at low-index directions; those
// orientations become flat facets, the rest of the surface stays curved.
// ε = 0 is isotropic: a circle or sphere.
// ---------------------------------------------------------------------------

/** 2D cusped γ(θ) = 1 + ε |sin(m θ / 2)| with m cusps around the circle. */
export function smoothGamma2D(thetaDeg: number, eps: number, cusps: number): number {
    return 1 + eps * Math.abs(Math.sin((cusps * thetaDeg * Math.PI) / 360));
}

export function smoothWulff2D(eps: number, cusps: number, samples = 360): { facets: Facet2D[]; shape: WulffShape2D } {
    const facets: Facet2D[] = [];
    for (let i = 0; i < samples; i++) {
        const angle = (360 * i) / samples;
        // Family 0 marks the cusp directions themselves (the flat facets).
        const onCusp = Math.abs(Math.sin((cusps * angle * Math.PI) / 360)) < 1e-9;
        facets.push({ angle, gamma: smoothGamma2D(angle, eps, cusps), family: onCusp ? 0 : 1 });
    }
    return { facets, shape: wulff2D(facets) };
}

/** Cubic cusped γ(n) = 1 + ε (|nx| + |ny| + |nz| − 1)/(√3 − 1): cusps at ⟨100⟩, maximum ε at ⟨111⟩. */
export function smoothGammaCubic(n: Vec3, eps: number): number {
    return 1 + (eps * (Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2]) - 1)) / (Math.sqrt(3) - 1);
}

/** Roughly uniform directions on the sphere (Fibonacci lattice). */
export function sphereDirections(count: number): Vec3[] {
    const out: Vec3[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
        const z = 1 - (2 * (i + 0.5)) / count;
        const r = Math.sqrt(1 - z * z);
        out.push([r * Math.cos(golden * i), r * Math.sin(golden * i), z]);
    }
    return out;
}

/** Family 0: the six {100} cusp facets; family 1: everything else (curved). */
export function smoothCubicWulff(eps: number, samples = 320): WulffShape3D {
    const planes: Plane3D[] = [
        // At ε = 0 there are no cusps, so the axis directions are ordinary curved surface.
        ...cubicFamily(1, 0, 0).map((normal) => ({ normal, gamma: 1, family: eps > 0 ? 0 : 1 })),
        ...sphereDirections(samples).map((normal) => ({ normal, gamma: smoothGammaCubic(normal, eps), family: 1 })),
    ];
    return wulff3D(planes, 10);
}

/**
 * Rectangular lattice: blend between a liquid (ε = 0, γ = γ̄ in every
 * direction) and a broken-bond crystal (ε = 1, γ = γ10|cos θ| + γ01|sin θ|,
 * whose Wulff shape is the 2γ10 × 2γ01 rectangle). Cusps sit at 0°/180°
 * ({10}, family 0) and 90°/270° ({01}, family 1); family 2 is curved.
 */
export function smoothRectWulff2D(eps: number, g10: number, g01: number, samples = 360): { facets: Facet2D[]; shape: WulffShape2D } {
    const mean = (g10 + g01) / 2;
    const facets: Facet2D[] = [];
    for (let i = 0; i < samples; i++) {
        const angle = (360 * i) / samples;
        const t = (angle * Math.PI) / 180;
        const gamma = (1 - eps) * mean + eps * (g10 * Math.abs(Math.cos(t)) + g01 * Math.abs(Math.sin(t)));
        const family = eps > 0 && angle % 180 === 0 ? 0 : eps > 0 && angle % 180 === 90 ? 1 : 2;
        facets.push({ angle, gamma, family });
    }
    return { facets, shape: wulff2D(facets) };
}
