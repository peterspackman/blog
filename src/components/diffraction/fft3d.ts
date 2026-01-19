/**
 * 3D FFT for electron density calculation
 * Uses fft.js for efficient radix-4 FFT operations
 */

import FFT from 'fft.js';

export interface Complex {
    re: number;
    im: number;
}

/**
 * Perform 3D inverse FFT on a grid of structure factors
 * Returns electron density in real space
 *
 * @param structureFactors - 3D array of complex structure factors F(h,k,l)
 *                           Indexed as [h + n/2][k + n/2][l + n/2] for h,k,l from -n/2 to n/2-1
 * @param n - Grid size (must be power of 2)
 * @returns Float32Array of electron density values
 */
export function ifft3d(structureFactors: Complex[][][], n: number): Float32Array {
    const fft = new FFT(n);
    const result = new Float32Array(n * n * n);

    // Temporary arrays for FFT operations
    // fft.js uses interleaved format: [re0, im0, re1, im1, ...]
    const temp1 = new Float32Array(n * 2);
    const temp2 = new Float32Array(n * 2);

    // Create working 3D complex array (interleaved)
    // Each element is [re, im]
    const work = new Float32Array(n * n * n * 2);

    // Copy structure factors into working array
    for (let iz = 0; iz < n; iz++) {
        for (let iy = 0; iy < n; iy++) {
            for (let ix = 0; ix < n; ix++) {
                const idx = (ix + iy * n + iz * n * n) * 2;
                const sf = structureFactors[ix][iy][iz];
                work[idx] = sf.re;
                work[idx + 1] = sf.im;
            }
        }
    }

    // 1D inverse FFT along x-axis
    for (let iz = 0; iz < n; iz++) {
        for (let iy = 0; iy < n; iy++) {
            // Extract row
            for (let ix = 0; ix < n; ix++) {
                const srcIdx = (ix + iy * n + iz * n * n) * 2;
                temp1[ix * 2] = work[srcIdx];
                temp1[ix * 2 + 1] = work[srcIdx + 1];
            }
            // Inverse FFT
            fft.inverseTransform(temp2, temp1);
            // Write back
            for (let ix = 0; ix < n; ix++) {
                const dstIdx = (ix + iy * n + iz * n * n) * 2;
                work[dstIdx] = temp2[ix * 2];
                work[dstIdx + 1] = temp2[ix * 2 + 1];
            }
        }
    }

    // 1D inverse FFT along y-axis
    for (let iz = 0; iz < n; iz++) {
        for (let ix = 0; ix < n; ix++) {
            // Extract column
            for (let iy = 0; iy < n; iy++) {
                const srcIdx = (ix + iy * n + iz * n * n) * 2;
                temp1[iy * 2] = work[srcIdx];
                temp1[iy * 2 + 1] = work[srcIdx + 1];
            }
            // Inverse FFT
            fft.inverseTransform(temp2, temp1);
            // Write back
            for (let iy = 0; iy < n; iy++) {
                const dstIdx = (ix + iy * n + iz * n * n) * 2;
                work[dstIdx] = temp2[iy * 2];
                work[dstIdx + 1] = temp2[iy * 2 + 1];
            }
        }
    }

    // 1D inverse FFT along z-axis
    for (let iy = 0; iy < n; iy++) {
        for (let ix = 0; ix < n; ix++) {
            // Extract depth column
            for (let iz = 0; iz < n; iz++) {
                const srcIdx = (ix + iy * n + iz * n * n) * 2;
                temp1[iz * 2] = work[srcIdx];
                temp1[iz * 2 + 1] = work[srcIdx + 1];
            }
            // Inverse FFT
            fft.inverseTransform(temp2, temp1);
            // Write back (only real part needed for density)
            for (let iz = 0; iz < n; iz++) {
                const resultIdx = ix + iy * n + iz * n * n;
                result[resultIdx] = temp2[iz * 2]; // Real part only
            }
        }
    }

    return result;
}

/**
 * Calculate electron density using 3D FFT
 *
 * @param reflections - Array of {h, k, l, fRe, fIm} structure factors
 * @param resolution - Grid resolution (will be rounded up to power of 2)
 * @param sigma - Optional Gaussian damping width (larger = less smoothing, default 0 = no smoothing)
 * @returns Object with grid data and min/max values
 */
export function calculateElectronDensityFFT(
    reflections: { h: number; k: number; l: number; fRe: number; fIm: number }[],
    resolution: number,
    sigma: number = 0
): { grid: Float32Array; minDensity: number; maxDensity: number } {
    // Round up to power of 2
    const n = Math.pow(2, Math.ceil(Math.log2(resolution)));

    // Initialize structure factor grid with zeros
    const sf: Complex[][][] = [];
    for (let i = 0; i < n; i++) {
        sf[i] = [];
        for (let j = 0; j < n; j++) {
            sf[i][j] = [];
            for (let k = 0; k < n; k++) {
                sf[i][j][k] = { re: 0, im: 0 };
            }
        }
    }

    // Place structure factors in the grid with optional Gaussian damping
    // This reduces Gibbs ringing by smoothly attenuating high-frequency terms
    for (const r of reflections) {
        // Map h,k,l to FFT indices (handling negative frequencies)
        const ih = ((r.h % n) + n) % n;
        const ik = ((r.k % n) + n) % n;
        const il = ((r.l % n) + n) % n;

        if (ih < n && ik < n && il < n) {
            // Apply Gaussian damping to reduce Gibbs ringing
            let damping = 1.0;
            if (sigma > 0) {
                const s2 = r.h * r.h + r.k * r.k + r.l * r.l;
                damping = Math.exp(-s2 / (2 * sigma * sigma));
            }
            sf[ih][ik][il] = { re: r.fRe * damping, im: r.fIm * damping };
        }
    }

    // Perform 3D inverse FFT
    const grid = ifft3d(sf, n);

    // Find min/max
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < grid.length; i++) {
        min = Math.min(min, grid[i]);
        max = Math.max(max, grid[i]);
    }

    // Normalize to 0-1 for consistent isosurface handling
    const range = max - min || 1;
    for (let i = 0; i < grid.length; i++) {
        grid[i] = (grid[i] - min) / range;
    }

    return {
        grid,
        minDensity: min,
        maxDensity: max
    };
}

/**
 * Apply a Gaussian window to reduce Gibbs ringing
 * The window is applied to structure factors based on their (h,k,l) values
 *
 * @param reflections - Array of reflections
 * @param sigma - Width parameter (smaller = more smoothing)
 * @returns New array with dampened structure factors
 */
export function applyGaussianWindow(
    reflections: { h: number; k: number; l: number; fRe: number; fIm: number }[],
    sigma: number
): { h: number; k: number; l: number; fRe: number; fIm: number }[] {
    return reflections.map(r => {
        // Distance in reciprocal space
        const s2 = r.h * r.h + r.k * r.k + r.l * r.l;
        // Gaussian damping factor
        const damping = Math.exp(-s2 / (2 * sigma * sigma));
        return {
            ...r,
            fRe: r.fRe * damping,
            fIm: r.fIm * damping
        };
    });
}
