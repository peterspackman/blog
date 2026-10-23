/**
 * Turns the output of `occ cg ... --morphology` (the *_cg_results.json plus
 * stdout) into the plain arrays the figures draw.
 *
 * Energies are kJ/mol, surface energies J/m², lengths Å.
 */
import type { Plane3D, Vec3 } from '../wulff/geometry';

/** One symmetry-unique interaction of the asymmetric-unit molecule. */
export interface CGPair {
    id: number;
    /** Closest atom–atom and centroid–centroid separations. */
    rn: number;
    rc: number;
    /** Symmetry operation of the partner, e.g. "-x,-y+1,-z+2". */
    symop: string;
    /** How many neighbours share this id. */
    count: number;
    eCrys: number;
    /** Share of the longer-ranged energy redistributed onto this contact (mean over the set). */
    eNN: number;
    /** Solvation lost forming the contact, both sides. */
    eSolv: number;
    /** Growth free energy as occ reports it: positive is attractive. */
    eInt: number;
}

export interface CGCut {
    offset: number;
    gammaSolv: number;
    gammaVac: number;
}

export interface CGFace {
    hkl: Vec3;
    d: number;
    area: number;
    cuts: CGCut[];
}

export interface CGSample {
    n: number;
    excess: number;
    surface: number;
    edge: number;
    corner: number;
}

export interface CGTotals {
    temperature: number;
    latticeEnergy: number;
    dHsub: number;
    dGsub: number;
    solvation: number;
    dGsol: number;
    logS: number;
    solubility: number;
}

export interface CGResult {
    title: string;
    model: string;
    solvent: string;
    spaceGroup: string;
    /** Columns are a*, b*, c* (Å⁻¹). */
    reciprocal: number[][];
    /** Rotation parts of the space-group operations, on fractional coordinates. */
    rotations: number[][][];
    totals: CGTotals;
    pairs: CGPair[];
    faces: CGFace[];
    samples: CGSample[];
}

// kJ/mol per Å² to J/m²
const KJMOL_PER_A2 = 1000 / 6.02214076e23 / 1e-20;

/** Rows of the "Neighbors for asymmetric molecule" table in stdout. */
export function parsePairTable(stdout: string): CGPair[] {
    const byId = new Map<number, CGPair & { nnSum: number; intSum: number }>();
    const row = /^\s*\|?\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+\S+?\(([^)]*)\)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*$/;
    let inTable = false;
    for (const line of stdout.split('\n')) {
        if (/^nn\s+id\s+Rn\s+Rc/.test(line)) {
            inTable = true;
            continue;
        }
        if (!inTable || line.startsWith('====')) continue;
        const m = row.exec(line);
        if (!m) {
            inTable = false;
            continue;
        }
        const id = Number(m[1]);
        const eNN = Number(m[9]);
        const eInt = Number(m[10]);
        const prev = byId.get(id);
        if (prev) {
            prev.count += 1;
            prev.nnSum += eNN;
            prev.intSum += eInt;
        } else {
            byId.set(id, {
                id, rn: Number(m[2]), rc: Number(m[3]), symop: m[4], count: 1,
                eCrys: Number(m[5]), eSolv: Number(m[8]), eNN, eInt,
                nnSum: eNN, intSum: eInt,
            });
        }
    }
    return [...byId.values()].map(({ nnSum, intSum, ...p }) => ({ ...p, eNN: nnSum / p.count, eInt: intSum / p.count }));
}

const mulT = (W: number[][], h: number[]): Vec3 => [
    W[0][0] * h[0] + W[1][0] * h[1] + W[2][0] * h[2],
    W[0][1] * h[0] + W[1][1] * h[1] + W[2][1] * h[2],
    W[0][2] * h[0] + W[1][2] * h[1] + W[2][2] * h[2],
];

/** Cartesian reciprocal vector g = h a* + k b* + l c*. */
export function gVector(reciprocal: number[][], hkl: number[]): Vec3 {
    const g: Vec3 = [0, 0, 0];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) g[r] += reciprocal[r][c] * hkl[c];
    return g;
}

/** Symmetry-equivalent faces of (hkl), Friedel pairs included. */
export function equivalentFaces(rotations: number[][][], hkl: number[]): Vec3[] {
    const seen = new Map<string, Vec3>();
    for (const W of rotations) {
        const h = mulT(W, hkl);
        for (const v of [h, [-h[0], -h[1], -h[2]] as Vec3]) {
            const key = v.map((x) => Math.round(x)).join(',');
            if (!seen.has(key)) seen.set(key, v.map((x) => Math.round(x)) as Vec3);
        }
    }
    return [...seen.values()];
}

/** Lowest positive surface energy over a face's terminations. */
export function bestCut(face: CGFace, which: 'solv' | 'vac'): CGCut | null {
    let best: CGCut | null = null;
    for (const c of face.cuts) {
        const g = which === 'solv' ? c.gammaSolv : c.gammaVac;
        if (g > 0 && (!best || g < (which === 'solv' ? best.gammaSolv : best.gammaVac))) best = c;
    }
    return best;
}

/** Half-spaces for the Wulff construction; `family` indexes result.faces. */
export function wulffPlanes(result: CGResult, which: 'solv' | 'vac'): Plane3D[] {
    const planes: Plane3D[] = [];
    result.faces.forEach((face, family) => {
        const cut = bestCut(face, which);
        if (!cut) return;
        const gamma = which === 'solv' ? cut.gammaSolv : cut.gammaVac;
        for (const hkl of equivalentFaces(result.rotations, face.hkl)) {
            const g = gVector(result.reciprocal, hkl);
            const len = Math.hypot(g[0], g[1], g[2]);
            planes.push({ normal: [g[0] / len, g[1] / len, g[2] / len], gamma, family });
        }
    });
    return planes;
}

/**
 * Least-squares fit of E_excess/N = a N^(-1/3) + b N^(-2/3) + c N^(-1).
 * Returns null with fewer than three samples.
 */
export function fitExcess(samples: CGSample[]): { a: number; b: number; c: number } | null {
    if (samples.length < 3) return null;
    // Normal equations, 3×3.
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const y = [0, 0, 0];
    for (const s of samples) {
        const x = [s.n ** (-1 / 3), s.n ** (-2 / 3), 1 / s.n];
        const t = s.excess / s.n;
        for (let i = 0; i < 3; i++) {
            y[i] += x[i] * t;
            for (let j = 0; j < 3; j++) A[i][j] += x[i] * x[j];
        }
    }
    // Gaussian elimination with partial pivoting.
    for (let i = 0; i < 3; i++) {
        let p = i;
        for (let r = i + 1; r < 3; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
        [A[i], A[p]] = [A[p], A[i]];
        [y[i], y[p]] = [y[p], y[i]];
        for (let r = i + 1; r < 3; r++) {
            const f = A[r][i] / A[i][i];
            for (let c = i; c < 3; c++) A[r][c] -= f * A[i][c];
            y[r] -= f * y[i];
        }
    }
    const x = [0, 0, 0];
    for (let i = 2; i >= 0; i--) {
        let s = y[i];
        for (let c = i + 1; c < 3; c++) s -= A[i][c] * x[c];
        x[i] = s / A[i][i];
    }
    return { a: x[0], b: x[1], c: x[2] };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseCGResult(json: any, stdout: string): CGResult {
    const crystal = json.crystal;
    const reciprocal: number[][] = crystal['unit cell'].reciprocal_matrix;
    const rotations: number[][][] = crystal['space group'].symmetry_operations.map((op: any) =>
        op.seitz.slice(0, 3).map((r: number[]) => r.slice(0, 3)),
    );

    const fe = json.totals_per_molecule[0].free_energy;
    const totals: CGTotals = {
        temperature: fe.temperature,
        latticeEnergy: fe.lattice_energy,
        dHsub: fe.dH_sublimation,
        dGsub: fe.dG_sublimation,
        solvation: fe.solvation_free_energy,
        dGsol: fe.dG_solution,
        logS: fe.log_S,
        solubility: fe.solubility_g_per_L,
    };

    // Each cut lists, per asymmetric-unit molecule, how many of each of that
    // molecule's leading neighbours it severs; γ is their summed energy over
    // twice the surface-cell area. occ reports the solvated value; the vacuum
    // one uses the same counts with the vacuum pair energies.
    const vacPairs: any[][] = json.surface_cuts.vacuum;
    const faces: CGFace[] = [];
    const byKey = new Map<string, CGFace>();
    for (const f of json.surface_cuts.surface_energies.facets) {
        const key = f.hkl.join(',');
        let face = byKey.get(key);
        if (!face) {
            const g = gVector(reciprocal, f.hkl);
            face = { hkl: f.hkl as Vec3, d: 1 / Math.hypot(g[0], g[1], g[2]), area: f.area, cuts: [] };
            byKey.set(key, face);
            faces.push(face);
        }
        let vac = 0;
        f.interaction_energy_counts.forEach((counts: number[], mol: number) => {
            counts.forEach((n, i) => {
                vac += n * vacPairs[mol][i].Total;
            });
        });
        face.cuts.push({ offset: f.offset, gammaSolv: f.energy, gammaVac: (-vac * KJMOL_PER_A2) / (2 * f.area) });
    }

    const samples: CGSample[] = (json.morphology?.samples ?? []).map((s: any) => ({
        n: s.n_molecules,
        excess: s.e_excess,
        surface: s.e_surface,
        edge: s.e_edge,
        corner: s.e_corner,
    }));

    return {
        title: json.title,
        model: json.energy_model,
        solvent: json.solvent,
        spaceGroup: crystal['space group']['short name'],
        reciprocal,
        rotations,
        totals,
        pairs: parsePairTable(stdout),
        faces,
        samples,
    };
}

/**
 * Drop what the figures don't read (the full pair list with atom offsets is
 * several MB), keeping the shape parseCGResult expects.
 */
export function trimCGJson(json: any): any {
    const nn = (list: any[]) => list.filter((p: any) => p['Nearest Neighbor'] !== false);
    const lead = (pairs: any[][], counts: number) => pairs.map((list) => list.slice(0, counts));
    const nCounts = Math.max(
        0,
        ...json.surface_cuts.surface_energies.facets.flatMap((f: any) => f.interaction_energy_counts.map((c: number[]) => c.length)),
    );
    return {
        title: json.title,
        energy_model: json.energy_model,
        solvent: json.solvent,
        crystal: {
            'unit cell': json.crystal['unit cell'],
            'space group': {
                'short name': json.crystal['space group']['short name'],
                symmetry_operations: json.crystal['space group'].symmetry_operations.map((op: any) => ({ seitz: op.seitz })),
            },
        },
        pairs: lead(json.pairs.map(nn), nCounts).map((list) => list.map((p: any) => ({ energies: p.energies }))),
        surface_cuts: {
            vacuum: lead(json.surface_cuts.vacuum, nCounts),
            surface_energies: {
                facets: json.surface_cuts.surface_energies.facets.map((f: any) => ({
                    hkl: f.hkl, offset: f.offset, area: f.area, energy: f.energy,
                    interaction_energy_counts: f.interaction_energy_counts,
                })),
            },
        },
        morphology: json.morphology && { samples: json.morphology.samples },
        totals_per_molecule: json.totals_per_molecule.map((t: any) => ({ free_energy: t.free_energy })),
    };
}

/** Just the neighbour table from stdout, which is all parseCGResult reads. */
export function trimStdout(stdout: string): string {
    const lines = stdout.split('\n');
    const start = lines.findIndex((l) => /^nn\s+id\s+Rn\s+Rc/.test(l));
    if (start < 0) return '';
    let end = start + 2;
    while (end < lines.length && /^\s*\|/.test(lines[end])) end++;
    return lines.slice(start, end).join('\n');
}
