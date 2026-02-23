/**
 * All 17 wallpaper groups with symmetry operations and tiling.
 *
 * The lattice is defined by two vectors:
 *   a₁ = (cellW, 0)
 *   a₂ = (shear, cellH)
 *
 * User controls angle (θ) and aspect ratio (r = |a₂|/|a₁|).
 * cellH is snapped to N/round(N/idealH) so the pattern tiles exactly,
 * and shear = cellH·cos(θ)/sin(θ) preserves the user's angle.
 */

type SymOp = (x: number, y: number) => [number, number];
type LatticeType = 'oblique' | 'rectangular' | 'square' | 'hexagonal';

export interface WallpaperGroup {
    name: string;
    lattice: LatticeType;
    order: number;
    ops: SymOp[];
}

export interface CellDims {
    cellW: number;
    cellH: number;
    shear: number;
}

export interface TilingOptions {
    applySymmetry?: boolean;
    angle?: number;  // lattice angle in degrees (default per group)
    ratio?: number;  // |a₂|/|a₁| length ratio (default 1.0)
}

const DEG_TO_RAD = Math.PI / 180;
const identityOp: SymOp = (x, y) => [x, y];

function mod1(v: number): number {
    return ((v % 1) + 1) % 1;
}

// ── Group definitions ──────────────────────────────────────────────

const GROUPS: Record<string, WallpaperGroup> = {
    // Oblique
    p1: { name: 'p1', lattice: 'oblique', order: 1, ops: [
        (x, y) => [x, y],
    ]},
    p2: { name: 'p2', lattice: 'oblique', order: 2, ops: [
        (x, y) => [x, y],
        (x, y) => [-x, -y],
    ]},

    // Rectangular
    pm: { name: 'pm', lattice: 'rectangular', order: 2, ops: [
        (x, y) => [x, y],
        (x, y) => [-x, y],
    ]},
    pg: { name: 'pg', lattice: 'rectangular', order: 2, ops: [
        (x, y) => [x, y],
        (x, y) => [-x, y + 0.5],
    ]},
    cm: { name: 'cm', lattice: 'rectangular', order: 4, ops: [
        (x, y) => [x, y],
        (x, y) => [-x, y],
        (x, y) => [x + 0.5, y + 0.5],
        (x, y) => [-x + 0.5, y + 0.5],
    ]},
    pmm: { name: 'pmm', lattice: 'rectangular', order: 4, ops: [
        (x, y) => [x, y],
        (x, y) => [-x, y],
        (x, y) => [x, -y],
        (x, y) => [-x, -y],
    ]},
    pmg: { name: 'pmg', lattice: 'rectangular', order: 4, ops: [
        (x, y) => [x, y],
        (x, y) => [-x, -y],
        (x, y) => [-x + 0.5, y],
        (x, y) => [x + 0.5, -y],
    ]},
    pgg: { name: 'pgg', lattice: 'rectangular', order: 4, ops: [
        (x, y) => [x, y],
        (x, y) => [-x, -y],
        (x, y) => [-x + 0.5, y + 0.5],
        (x, y) => [x + 0.5, -y + 0.5],
    ]},
    cmm: { name: 'cmm', lattice: 'rectangular', order: 8, ops: [
        (x, y) => [x, y],
        (x, y) => [-x, y],
        (x, y) => [x, -y],
        (x, y) => [-x, -y],
        (x, y) => [x + 0.5, y + 0.5],
        (x, y) => [-x + 0.5, y + 0.5],
        (x, y) => [x + 0.5, -y + 0.5],
        (x, y) => [-x + 0.5, -y + 0.5],
    ]},

    // Square
    p4: { name: 'p4', lattice: 'square', order: 4, ops: [
        (x, y) => [x, y],
        (x, y) => [-y, x],
        (x, y) => [-x, -y],
        (x, y) => [y, -x],
    ]},
    p4mm: { name: 'p4mm', lattice: 'square', order: 8, ops: [
        (x, y) => [x, y],
        (x, y) => [-y, x],
        (x, y) => [-x, -y],
        (x, y) => [y, -x],
        (x, y) => [-x, y],
        (x, y) => [x, -y],
        (x, y) => [y, x],
        (x, y) => [-y, -x],
    ]},
    p4gm: { name: 'p4gm', lattice: 'square', order: 8, ops: [
        (x, y) => [x, y],
        (x, y) => [-y, x],
        (x, y) => [-x, -y],
        (x, y) => [y, -x],
        (x, y) => [-x + 0.5, y + 0.5],
        (x, y) => [x + 0.5, -y + 0.5],
        (x, y) => [y + 0.5, x + 0.5],
        (x, y) => [-y + 0.5, -x + 0.5],
    ]},

    // Hexagonal (ops in hex fractional coords)
    p3: { name: 'p3', lattice: 'hexagonal', order: 3, ops: [
        (x, y) => [x, y],
        (x, y) => [-y, x - y],
        (x, y) => [y - x, -x],
    ]},
    p3m1: { name: 'p3m1', lattice: 'hexagonal', order: 6, ops: [
        (x, y) => [x, y],
        (x, y) => [-y, x - y],
        (x, y) => [y - x, -x],
        (x, y) => [-y, -x],
        (x, y) => [y - x, y],
        (x, y) => [x, x - y],
    ]},
    p31m: { name: 'p31m', lattice: 'hexagonal', order: 6, ops: [
        (x, y) => [x, y],
        (x, y) => [-y, x - y],
        (x, y) => [y - x, -x],
        (x, y) => [y, x],
        (x, y) => [-x, y - x],
        (x, y) => [x - y, -y],
    ]},
    p6: { name: 'p6', lattice: 'hexagonal', order: 6, ops: [
        (x, y) => [x, y],
        (x, y) => [-y, x - y],
        (x, y) => [y - x, -x],
        (x, y) => [-x, -y],
        (x, y) => [y, y - x],
        (x, y) => [x - y, x],
    ]},
    p6mm: { name: 'p6mm', lattice: 'hexagonal', order: 12, ops: [
        (x, y) => [x, y],
        (x, y) => [-y, x - y],
        (x, y) => [y - x, -x],
        (x, y) => [-x, -y],
        (x, y) => [y, y - x],
        (x, y) => [x - y, x],
        (x, y) => [-y, -x],
        (x, y) => [y - x, y],
        (x, y) => [x, x - y],
        (x, y) => [y, x],
        (x, y) => [-x, y - x],
        (x, y) => [x - y, -y],
    ]},
};

export const GROUP_LIST = Object.keys(GROUPS);

/**
 * Encode symmetry ops as flat float array for GPU upload.
 * Each op is 6 floats: [a, b, tx, c, d, ty] for (x,y)→(ax+by+tx, cx+dy+ty) then mod1.
 * Extracts coefficients by evaluating each op at (0,0), (1,0), (0,1).
 */
export function getOpsAsFloats(
    groupName: string,
    symmetryEnabled: boolean,
): { data: Float32Array; count: number } {
    const group = getGroup(groupName);
    const ops = symmetryEnabled ? group.ops : [identityOp];
    const count = ops.length;
    const data = new Float32Array(count * 6);

    for (let i = 0; i < count; i++) {
        const [tx, ty] = ops[i](0, 0);
        const [ax_tx, cx_ty] = ops[i](1, 0);
        const [by_tx, dy_ty] = ops[i](0, 1);
        const off = i * 6;
        data[off    ] = ax_tx - tx; // a
        data[off + 1] = by_tx - tx; // b
        data[off + 2] = tx;         // tx
        data[off + 3] = cx_ty - ty; // c
        data[off + 4] = dy_ty - ty; // d
        data[off + 5] = ty;         // ty
    }

    return { data, count };
}

export function getGroup(name: string): WallpaperGroup {
    return GROUPS[name] || GROUPS.p1;
}

// ── Default lattice parameters ────────────────────────────────────

export function getDefaultLatticeParams(lattice: LatticeType): { angle: number; ratio: number } {
    if (lattice === 'hexagonal') return { angle: 120, ratio: 1.0 };
    return { angle: 90, ratio: 1.0 };
}

// ── Cell geometry ─────────────────────────────────────────────────

/**
 * Compute cell dimensions from user parameters.
 * cellH is snapped to divide N evenly (clean FFT).
 * Shear preserves the user's requested angle.
 */
export function computeCellDims(
    N: number, tiles: number, angle: number, ratio: number,
): CellDims {
    const cellW = N / tiles;
    const sinA = Math.sin(angle * DEG_TO_RAD);
    const cosA = Math.cos(angle * DEG_TO_RAD);
    const absSinA = Math.max(0.01, Math.abs(sinA)); // guard near-degenerate

    const idealCellH = cellW * ratio * absSinA;
    const vTiles = Math.max(1, Math.round(N / idealCellH));
    const cellH = N / vTiles;
    const shear = cellH * cosA / sinA;

    return { cellW, cellH, shear };
}

// ── Coordinate conversion (general affine) ────────────────────────

export const RAW_SIZE = 128;

/**
 * Canvas pixel → lattice fractional coords.
 * Inverts: [px, py]ᵀ = [cellW shear; 0 cellH] · [fx, fy]ᵀ
 */
function pixelToFrac(px: number, py: number, d: CellDims): [number, number] {
    const fy = py / d.cellH;
    const fx = (px - d.shear * fy) / d.cellW;
    return [fx, fy];
}

/** Lattice fractional coords → canvas pixel. */
function fracToPixel(fx: number, fy: number, d: CellDims): [number, number] {
    return [fx * d.cellW + fy * d.shear, fy * d.cellH];
}

// ── Tiling ────────────────────────────────────────────────────────

/** Expand a fractional point across all lattice translations in [0,N)². */
function tileFractional(
    fx: number, fy: number, d: CellDims, N: number,
    out: Array<[number, number]>,
): void {
    const tilesY = Math.ceil(N / d.cellH) + 1;
    const shearExtra = d.shear !== 0
        ? Math.ceil(Math.abs(d.shear) * tilesY / d.cellW) + 1
        : 0;
    const n1Min = -shearExtra;
    const n1Max = Math.ceil(N / d.cellW) + shearExtra + 1;

    for (let n2 = 0; n2 < tilesY; n2++) {
        for (let n1 = n1Min; n1 < n1Max; n1++) {
            const [px, py] = fracToPixel(fx + n1, fy + n2, d);
            const rpx = Math.round(px);
            const rpy = Math.round(py);
            if (rpx >= 0 && rpx < N && rpy >= 0 && rpy < N) {
                out.push([rpx, rpy]);
            }
        }
    }
}

// ── Resolve dims helper ───────────────────────────────────────────

function resolveDims(groupName: string, N: number, tiles: number, opts?: TilingOptions): CellDims {
    const group = getGroup(groupName);
    const defaults = getDefaultLatticeParams(group.lattice);
    return computeCellDims(
        N, tiles,
        opts?.angle ?? defaults.angle,
        opts?.ratio ?? defaults.ratio,
    );
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Generate the full NxN tiled pattern from a raw strokes buffer.
 * Backward-maps each output pixel through the symmetry group to the raw buffer.
 */
export function generateSymmetricPattern(
    rawBuffer: Float32Array,
    N: number,
    groupName: string,
    tiles: number,
    opts?: TilingOptions,
): Float32Array {
    const group = getGroup(groupName);
    const dims = resolveDims(groupName, N, tiles, opts);
    const ops: SymOp[] = (opts?.applySymmetry ?? true) ? group.ops : [identityOp];
    const output = new Float32Array(N * N);

    for (let py = 0; py < N; py++) {
        for (let px = 0; px < N; px++) {
            const [fx, fy] = pixelToFrac(px, py, dims);
            const fxCell = mod1(fx);
            const fyCell = mod1(fy);

            let val = 0;
            for (let i = 0; i < ops.length; i++) {
                const [sx, sy] = ops[i](fxCell, fyCell);
                const rx = Math.floor(mod1(sx) * RAW_SIZE);
                const ry = Math.floor(mod1(sy) * RAW_SIZE);
                const rv = rawBuffer[ry * RAW_SIZE + rx];
                if (rv > val) {
                    val = rv;
                    if (val >= 1) break;
                }
            }
            output[py * N + px] = val;
        }
    }

    return output;
}

/**
 * For a draw stroke at canvas pixel (px,py), compute all equivalent positions
 * across symmetry + tiling. Returns array of [px,py] pairs.
 */
export function getEquivalentPositions(
    px: number, py: number,
    N: number, groupName: string, tiles: number,
    opts?: TilingOptions,
): Array<[number, number]> {
    const group = getGroup(groupName);
    const dims = resolveDims(groupName, N, tiles, opts);
    const [fx, fy] = pixelToFrac(px, py, dims);
    const fxCell = mod1(fx);
    const fyCell = mod1(fy);

    const ops: SymOp[] = (opts?.applySymmetry ?? true) ? group.ops : [identityOp];
    const results: Array<[number, number]> = [];

    for (const op of ops) {
        const [sx, sy] = op(fxCell, fyCell);
        tileFractional(mod1(sx), mod1(sy), dims, N, results);
    }

    return results;
}

/**
 * Map a canvas pixel to the raw buffer coordinates.
 */
export function canvasToRaw(
    px: number, py: number,
    groupName: string, N: number, tiles: number,
    opts?: TilingOptions,
): [number, number] {
    const dims = resolveDims(groupName, N, tiles, opts);
    const [fx, fy] = pixelToFrac(px, py, dims);
    const rx = Math.floor(mod1(fx) * RAW_SIZE);
    const ry = Math.floor(mod1(fy) * RAW_SIZE);
    return [
        Math.max(0, Math.min(RAW_SIZE - 1, rx)),
        Math.max(0, Math.min(RAW_SIZE - 1, ry)),
    ];
}
