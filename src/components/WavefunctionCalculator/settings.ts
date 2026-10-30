import { BASIS_FREE_METHODS } from '@peterspackman/ce-chem/compute/surface-types.js';
import type { GridQuality } from './cubeBox';

export const METHODS = [
    { value: 'hf', label: 'Hartree–Fock' },
    { value: 'b3lyp', label: 'B3LYP' },
    { value: 'pbe', label: 'PBE' },
    { value: 'pbe0', label: 'PBE0' },
    { value: 'blyp', label: 'BLYP' },
    { value: 'wb97x', label: 'ωB97X' },
    { value: 'gfn2-xtb', label: 'GFN2-xTB' },
];

/** Tight-binding methods carry their own minimal basis; occ still wants a placeholder. */
export const usesBuiltinBasis = (method: string) => BASIS_FREE_METHODS.has(method);

/** The basis to send occ for a method. */
export const effectiveBasis = (method: string, basis: string) => (usesBuiltinBasis(method) ? 'builtin' : basis);

/** Only basis sets packaged in occ.data (static/wasm), smallest first. */
export const BASIS_SETS = [
    { value: 'sto-3g', label: 'STO-3G' },
    { value: '3-21g', label: '3-21G' },
    { value: '6-31g', label: '6-31G' },
    { value: 'def2-svp', label: 'def2-SVP' },
    { value: 'pcseg-1', label: 'pcseg-1' },
    { value: 'cc-pvdz', label: 'cc-pVDZ' },
    { value: 'def2-tzvp', label: 'def2-TZVP' },
];

export interface CalculationSettings {
    method: string;
    basis: string;
    charge: number;
    multiplicity: number;
    /** Unrestricted even for a singlet. Open shells are always unrestricted. */
    unrestricted: boolean;
    optimize: boolean;
    frequencies: boolean;
    maxScfIterations: number;
    maxOptSteps: number;
}

export const DEFAULT_SETTINGS: CalculationSettings = {
    method: 'hf',
    basis: '3-21g',
    charge: 0,
    multiplicity: 1,
    unrestricted: false,
    optimize: false,
    frequencies: false,
    maxScfIterations: 100,
    maxOptSteps: 100,
};

export interface DisplaySettings {
    representation: 'ball+stick' | 'spacefill' | 'tube' | 'wireframe';
    gridQuality: GridQuality;
    isovalue: number;
    opacity: number;
    surfaceStyle: 'solid' | 'wireframe';
}

export const DEFAULT_DISPLAY: DisplaySettings = {
    representation: 'ball+stick',
    gridQuality: 'medium',
    isovalue: 0.02,
    opacity: 0.85,
    surfaceStyle: 'solid',
};

export const methodLabel = (value: string) => METHODS.find((m) => m.value === value)?.label ?? value;
export const basisLabel = (value: string) => BASIS_SETS.find((b) => b.value === value)?.label ?? value;

/** "B3LYP/def2-SVP", or just "GFN2-xTB" for a method with a built-in basis. */
export const modelLabel = (method: string, basis: string) =>
    usesBuiltinBasis(method) ? methodLabel(method) : `${methodLabel(method)}/${basisLabel(basis)}`;
