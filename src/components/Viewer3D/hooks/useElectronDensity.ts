/**
 * useElectronDensity - Hook to calculate electron density volume grid
 *
 * Computes structure factors and performs 3D FFT to generate
 * electron density for volumetric rendering.
 */

import { useMemo } from 'react';
import type { CrystalStructure } from '../../diffraction/physics';
import {
    isAllowedReflection,
    calculateDSpacing,
    calculateTwoTheta,
    atomicFormFactor,
} from '../../diffraction/physics';
import { calculateElectronDensityFFT } from '../../diffraction/fft3d';
import type { VolumeGrid } from '../types';

interface ControlPoint {
    s: number;
    f: number;
}

interface ReflectionData {
    h: number;
    k: number;
    l: number;
    fRe: number;
    fIm: number;
}

// Interpolate form factor from control points
function interpolateFormFactor(points: ControlPoint[], s: number): number {
    if (points.length === 0) return 0;
    if (s <= points[0].s) return points[0].f;
    if (s >= points[points.length - 1].s) return points[points.length - 1].f;

    for (let i = 0; i < points.length - 1; i++) {
        if (s >= points[i].s && s <= points[i + 1].s) {
            const t = (s - points[i].s) / (points[i + 1].s - points[i].s);
            return points[i].f + t * (points[i + 1].f - points[i].f);
        }
    }
    return points[points.length - 1].f;
}

// Calculate structure factor with custom form factors and Debye-Waller factor
function calculateStructureFactorCustom(
    h: number,
    k: number,
    l: number,
    structure: CrystalStructure,
    wavelength: number,
    formFactors?: Record<string, ControlPoint[]>,
    bFactor: number = 1.5
): { re: number; im: number } | null {
    const d = calculateDSpacing(h, k, l, structure);

    // Resolution cutoff: d_min = λ/2 (Bragg limit)
    const dMin = wavelength / 2;
    if (d < dMin) {
        return null;
    }

    const twoTheta = calculateTwoTheta(d, wavelength);
    if (isNaN(twoTheta)) {
        return null;
    }

    const sinTheta_lambda = Math.sin((twoTheta * Math.PI) / 360) / wavelength;
    const debyeWaller = Math.exp(-bFactor * sinTheta_lambda * sinTheta_lambda);

    let F = { re: 0, im: 0 };

    for (const atom of structure.atoms) {
        const [x, y, z] = atom.position;
        const phase = 2 * Math.PI * (h * x + k * y + l * z);

        let f: number;
        if (formFactors && formFactors[atom.element] && formFactors[atom.element].length > 0) {
            f = interpolateFormFactor(formFactors[atom.element], sinTheta_lambda);
        } else {
            f = atomicFormFactor(atom.element, sinTheta_lambda);
        }

        f *= debyeWaller;

        F.re += f * Math.cos(phase);
        F.im += f * Math.sin(phase);
    }

    return F;
}

export interface UseElectronDensityOptions {
    structure: CrystalStructure;
    wavelength: number;
    maxHKL: number;
    resolution: number;
    formFactors?: Record<string, ControlPoint[]>;
    bFactor?: number;
}

export interface ElectronDensityResult {
    volumeGrid: VolumeGrid;
    minDensity: number;
    maxDensity: number;
}

export function useElectronDensity({
    structure,
    wavelength,
    maxHKL,
    resolution,
    formFactors,
    bFactor = 1.5,
}: UseElectronDensityOptions): ElectronDensityResult {
    // Pre-compute reflections
    const reflections = useMemo(() => {
        const data: ReflectionData[] = [];
        for (let h = -maxHKL; h <= maxHKL; h++) {
            for (let k = -maxHKL; k <= maxHKL; k++) {
                for (let l = -maxHKL; l <= maxHKL; l++) {
                    if (h === 0 && k === 0 && l === 0) continue;
                    if (!isAllowedReflection(Math.abs(h), Math.abs(k), Math.abs(l), structure)) continue;
                    const F = calculateStructureFactorCustom(h, k, l, structure, wavelength, formFactors, bFactor);
                    if (F && (Math.abs(F.re) > 0.01 || Math.abs(F.im) > 0.01)) {
                        data.push({ h, k, l, fRe: F.re, fIm: F.im });
                    }
                }
            }
        }
        return data;
    }, [structure, maxHKL, wavelength, formFactors, bFactor]);

    // Compute 3D electron density grid using FFT
    const result = useMemo(() => {
        const sigma = maxHKL * 0.8;
        const fftResult = calculateElectronDensityFFT(reflections, resolution, sigma);
        const n = Math.pow(2, Math.ceil(Math.log2(resolution)));

        // Normalize grid to 0-1 range for volumetric rendering
        const { grid, minDensity, maxDensity } = fftResult;
        const range = maxDensity - minDensity || 1;
        const normalizedGrid = new Float32Array(grid.length);
        for (let i = 0; i < grid.length; i++) {
            normalizedGrid[i] = (grid[i] - minDensity) / range;
        }

        const volumeGrid: VolumeGrid = {
            data: normalizedGrid,
            dimensions: [n, n, n],
            origin: [0, 0, 0],
            spacing: [1 / n, 1 / n, 1 / n],
        };

        return {
            volumeGrid,
            minDensity,
            maxDensity,
        };
    }, [reflections, resolution, maxHKL]);

    return result;
}

export default useElectronDensity;
