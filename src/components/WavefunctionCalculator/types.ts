/**
 * Shared type definitions for the WavefunctionCalculator.
 * Single source of truth — all components import from here.
 */

// ── Basic data structures ──────────────────────────────────────────────────

export interface MatrixData {
    rows: number;
    cols: number;
    data: number[][];
}

// ── Orbital energies / occupations ─────────────────────────────────────────
// Restricted: plain number array. Unrestricted: object with alpha/beta arrays.
// TODO: migrate to a proper discriminated union in a future refactor pass.

export type OrbitalEnergies = number[] | {
    alpha: number[];
    beta: number[];
    isUnrestricted: true;
};

export type OrbitalOccupations = number[] | {
    alpha: number[];
    beta: number[];
    isUnrestricted: true;
};

// ── Calculation results ────────────────────────────────────────────────────

export interface CalculationProperties {
    homo?: number;
    lumo?: number;
    gap?: number;
    alphaHOMO?: number;
    alphaLUMO?: number;
    betaHOMO?: number;
    betaLUMO?: number;
    isUnrestricted?: boolean;
}

export interface WavefunctionData {
    fchk?: string;
    owfJson?: string;
    numBasisFunctions: number;
    numAtoms: number;
    nAlpha?: number;
    nBeta?: number;
}

export interface Matrices {
    overlap?: MatrixData;
    kinetic?: MatrixData;
    nuclear?: MatrixData;
    fock?: MatrixData;
    density?: MatrixData;
    coefficients?: MatrixData;
}

export interface OptimizationTrajectory {
    energies: number[];
    gradientNorms: number[];
    geometries: string[];
    converged: boolean;
    steps: number;
    finalEnergy: number;
    finalMolecule: string | null;
}

export interface OptimizationResult {
    trajectory: OptimizationTrajectory;
    finalXYZ: string;
    steps: number;
    energies: number[];
    gradientNorms: number[];
}

export interface FrequencyResult {
    frequencies: number[];
    nModes: number;
    nAtoms: number;
    summary: string;
    normalModes?: number[][];
}

export interface CalculationResult {
    energy: number;
    energyInEV: number;
    elapsedMs: number;
    converged: boolean;
    properties?: CalculationProperties;
    wavefunctionData?: WavefunctionData;
    matrices?: Matrices;
    orbitalEnergies?: OrbitalEnergies;
    orbitalOccupations?: OrbitalOccupations;
    optimization?: OptimizationResult;
    frequencies?: FrequencyResult;
}

// ── SCF settings ───────────────────────────────────────────────────────────

export interface SCFSettings {
    method: string;
    basisSet: string;
    charge: number;
    multiplicity: number;
    optimize: boolean;
    computeFrequencies: boolean;
    maxIterations: number;
    energyTolerance: number;
    threads: number;
    logLevel: number;
}

// ── Cube settings ──────────────────────────────────────────────────────────

export interface CubeGeometrySettings {
    gridSteps: number;
    useAdaptive: boolean;
    bufferDistance: number;
    threshold: number;
    customOrigin: boolean;
    origin: [number, number, number];
    customDirections: boolean;
    directionA: [number, number, number];
    directionB: [number, number, number];
    directionC: [number, number, number];
}

// ── Cube grid info (returned from worker) ──────────────────────────────────

export interface GridInfo {
    origin: number[];
    nx: number;
    ny: number;
    nz: number;
    steps: number;
    basis: number[];
}

// ── Worker message types ───────────────────────────────────────────────────

export interface SCFRequest {
    command?: 'scf';
    xyzData: string;
    method: string;
    basis: string;
    charge: number;
    multiplicity: number;
    unrestricted?: boolean;
    threads: number;
    optMaxIterations?: number;
    computeFrequencies?: boolean;
}

export interface CubeRequest {
    command: 'cube';
    owfData: Uint8Array;
    property: string;
    orbital?: number;
    spin?: 'alpha' | 'beta';
    gridSteps: number;
    adaptive?: boolean;
    bufferDistance?: number;
    threshold?: number;
    origin?: [number, number, number];
    directionA?: [number, number, number];
    directionB?: [number, number, number];
    directionC?: [number, number, number];
}

export type WorkerRequest = SCFRequest | CubeRequest;

export type WorkerResponse =
    | { type: 'ready' }
    | { type: 'output'; text: string }
    | { type: 'error'; text: string }
    | {
        type: 'exit';
        code: number;
        files: Record<string, Uint8Array>;
        stdout: string;
        cubeData?: string;
        gridInfo?: GridInfo;
        property?: string;
        orbital?: number;
        spin?: string;
    };

// ── Log entry ──────────────────────────────────────────────────────────────

export interface LogEntry {
    message: string;
    level: string;
    timestamp: Date;
}

// ── Molecule info ──────────────────────────────────────────────────────────

export interface MoleculeInfo {
    name: string;
    formula: string;
    numAtoms: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Build a flat list of orbital items from (possibly unrestricted) energies/occupations. */
export interface OrbitalInfo {
    index: number;
    energy: number;
    occupation: number;
    isOccupied: boolean;
    spin?: 'alpha' | 'beta';
}

/** Check if orbital data is unrestricted (object with alpha/beta). */
export function isUnrestrictedOrbitals<T>(data: T[] | { alpha: T[]; beta: T[]; isUnrestricted: true }): data is { alpha: T[]; beta: T[]; isUnrestricted: true } {
    return !Array.isArray(data) && data != null && 'isUnrestricted' in data;
}

export function getOrbitalList(
    energies: OrbitalEnergies,
    occupations: OrbitalOccupations
): OrbitalInfo[] {
    if (isUnrestrictedOrbitals(energies)) {
        const occ = isUnrestrictedOrbitals(occupations) ? occupations : { alpha: [] as number[], beta: [] as number[] };
        const alpha = energies.alpha.map((e, i) => ({
            index: i,
            energy: e,
            occupation: occ.alpha[i] ?? 0,
            isOccupied: (occ.alpha[i] ?? 0) > 0.5,
            spin: 'alpha' as const,
        }));
        const beta = energies.beta.map((e, i) => ({
            index: i,
            energy: e,
            occupation: occ.beta[i] ?? 0,
            isOccupied: (occ.beta[i] ?? 0) > 0.5,
            spin: 'beta' as const,
        }));
        return [...alpha, ...beta];
    } else {
        const occ = Array.isArray(occupations) ? occupations : [];
        return energies.map((e, i) => ({
            index: i,
            energy: e,
            occupation: occ[i] ?? 0,
            isOccupied: (occ[i] ?? 0) > 0.5,
        }));
    }
}

/** Get energies as a flat array (for restricted) or alpha array (for unrestricted). */
export function getEnergyValues(energies: OrbitalEnergies): number[] {
    return isUnrestrictedOrbitals(energies) ? energies.alpha : energies;
}

/** Get total orbital count. */
export function getOrbitalCount(energies: OrbitalEnergies): number {
    return isUnrestrictedOrbitals(energies) ? energies.alpha.length : energies.length;
}
