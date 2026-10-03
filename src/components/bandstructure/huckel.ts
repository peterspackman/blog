/**
 * Hückel (tight-binding) π-electron model for a chain or ring of N atoms.
 *
 * H_ii = α, H_i,i+1 = β₁ or β₂ alternating, with β₁,₂ = β(1 ± δ) (Peierls
 * bond alternation). A ring adds the bond between atoms N and 1. Energies and
 * orbitals come from exact diagonalisation, so they are correct for any δ.
 */

export type Topology = 'chain' | 'ring';

export interface HuckelInput {
    n: number;
    beta: number; // eV, negative
    delta: number; // bond alternation, 0–0.9
    topology: Topology;
    alpha?: number;
}

export interface HuckelResult {
    /** Ascending energies (eV). */
    energies: number[];
    /** orbitals[i][j]: coefficient of atom j in orbital i (normalised). */
    orbitals: number[][];
    /** Hopping for the bond from atom j to j+1 (ring: last entry closes the ring). */
    bonds: number[];
}

export function bondHoppings({ n, beta, delta, topology }: HuckelInput): number[] {
    const out: number[] = [];
    const nBonds = topology === 'ring' ? n : n - 1;
    for (let j = 0; j < nBonds; j++) out.push(beta * (j % 2 === 0 ? 1 + delta : 1 - delta));
    return out;
}

/** Cyclic Jacobi eigenvalue algorithm for a dense symmetric matrix. */
export function jacobiEigen(a: number[][]): { values: number[]; vectors: number[][] } {
    const n = a.length;
    const m = a.map((row) => [...row]);
    const v: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
        let off = 0;
        for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += m[p][q] * m[p][q];
        if (off < 1e-22) break;
        for (let p = 0; p < n; p++) {
            for (let q = p + 1; q < n; q++) {
                if (Math.abs(m[p][q]) < 1e-15) continue;
                const theta = (m[q][q] - m[p][p]) / (2 * m[p][q]);
                const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
                const c = 1 / Math.sqrt(t * t + 1);
                const s = t * c;
                for (let k = 0; k < n; k++) {
                    const mkp = m[k][p];
                    const mkq = m[k][q];
                    m[k][p] = c * mkp - s * mkq;
                    m[k][q] = s * mkp + c * mkq;
                }
                for (let k = 0; k < n; k++) {
                    const mpk = m[p][k];
                    const mqk = m[q][k];
                    m[p][k] = c * mpk - s * mqk;
                    m[q][k] = s * mpk + c * mqk;
                }
                for (let k = 0; k < n; k++) {
                    const vkp = v[k][p];
                    const vkq = v[k][q];
                    v[k][p] = c * vkp - s * vkq;
                    v[k][q] = s * vkp + c * vkq;
                }
            }
        }
    }
    const order = m.map((_, i) => i).sort((i, j) => m[i][i] - m[j][j]);
    return { values: order.map((i) => m[i][i]), vectors: order.map((i) => v.map((row) => row[i])) };
}

export function solveHuckel(input: HuckelInput): HuckelResult {
    const { n, alpha = 0 } = input;
    const bonds = bondHoppings(input);
    const h = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? alpha : 0)));
    bonds.forEach((b, j) => {
        const k = (j + 1) % n;
        h[j][k] += b;
        h[k][j] += b;
    });
    const { values, vectors } = jacobiEigen(h);
    // Fix the sign convention so orbitals don't flicker between updates.
    const orbitals = vectors.map((vec) => {
        const big = vec.reduce((bi, x, i) => (Math.abs(x) > Math.abs(vec[bi]) + 1e-9 ? i : bi), 0);
        return vec[big] < 0 ? vec.map((x) => -x) : vec;
    });
    return { energies: values, orbitals, bonds };
}

/** Number of sign changes along the chain (ring: around the ring). */
export function nodeCount(orbital: number[], ring: boolean): number {
    const c = orbital.filter((x) => Math.abs(x) > 1e-6);
    let nodes = 0;
    for (let i = 0; i < c.length - 1; i++) if (c[i] * c[i + 1] < 0) nodes++;
    if (ring && c.length > 1 && c[c.length - 1] * c[0] < 0) nodes++;
    return nodes;
}

/**
 * Infinite-chain band in the extended zone of the single-atom lattice,
 * k ∈ [0, π]. With alternation the lower branch (k < π/2) and upper branch
 * (k > π/2) separate by a gap 4|β|δ at k = π/2.
 */
export function bandEnergy(k: number, beta: number, delta: number, alpha = 0): number {
    const b1 = beta * (1 + delta);
    const b2 = beta * (1 - delta);
    const mag = Math.sqrt(b1 * b1 + b2 * b2 + 2 * b1 * b2 * Math.cos(2 * k));
    return alpha + (k <= Math.PI / 2 ? -mag : mag);
}

/** Wavevector at which finite-system level i (ascending) sits on the band. */
export function levelWavevector(i: number, n: number, topology: Topology): number {
    if (topology === 'chain') return ((i + 1) * Math.PI) / (n + 1);
    // Ring: k = 2πm/N, levels ascend as |m| = 0, 1, 1, 2, 2, …
    const m = Math.ceil(i / 2);
    return Math.min(Math.PI, (2 * Math.PI * m) / n);
}

export interface Filling {
    /** Electrons in each level (0, 1 or 2), lowest first. */
    occupation: number[];
    homo: number;
    lumo: number;
    gap: number;
    fermi: number;
}

export function fill(energies: number[], electrons: number): Filling {
    let left = electrons;
    const occupation = energies.map(() => {
        const e = Math.min(2, Math.max(0, left));
        left -= e;
        return e;
    });
    const homo = occupation.reduce((h, o, i) => (o > 0 ? i : h), -1);
    const lumo = occupation.findIndex((o) => o < 2);
    const hasGap = homo >= 0 && lumo >= 0 && lumo > homo;
    const gap = hasGap ? energies[lumo] - energies[homo] : 0;
    const fermi =
        homo < 0 ? energies[0] : lumo < 0 ? energies[energies.length - 1] : hasGap ? (energies[homo] + energies[lumo]) / 2 : energies[homo];
    return { occupation, homo, lumo, gap, fermi };
}
