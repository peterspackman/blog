import FFT from 'fft.js';
import type { FFTResult } from './types';
import { applyFftShift } from './patterns';

/**
 * Compute 2D FFT using row-column decomposition.
 * Input: Float32Array of N*N real values.
 * Returns: FFTResult with magnitude, phase, real, imaginary (all N*N Float32Arrays).
 *
 * Uses fftshift pre-multiplication so DC is centered in the output.
 */
export function compute2DFFT(input: Float32Array, N: number): FFTResult {
    // Apply fftshift pre-multiplication: multiply by (-1)^(r+c)
    const shifted = applyFftShift(input, N);

    const fft = new FFT(N);

    // Step 1: FFT each row
    // Each row is N real values -> N complex values (2*N floats interleaved)
    const rowTransformed = new Float32Array(N * N * 2); // complex interleaved
    const rowIn = new Float32Array(N);
    const rowOut = fft.createComplexArray();

    for (let r = 0; r < N; r++) {
        // Extract row
        for (let c = 0; c < N; c++) {
            rowIn[c] = shifted[r * N + c];
        }
        fft.realTransform(rowOut, rowIn);
        fft.completeSpectrum(rowOut);

        // Store interleaved complex into rowTransformed
        for (let c = 0; c < N; c++) {
            rowTransformed[(r * N + c) * 2] = rowOut[c * 2];       // real
            rowTransformed[(r * N + c) * 2 + 1] = rowOut[c * 2 + 1]; // imag
        }
    }

    // Step 2: FFT each column (on already complex data)
    const result = new Float32Array(N * N * 2);
    const colIn = fft.createComplexArray();
    const colOut = fft.createComplexArray();

    for (let c = 0; c < N; c++) {
        // Extract column (complex interleaved)
        for (let r = 0; r < N; r++) {
            colIn[r * 2] = rowTransformed[(r * N + c) * 2];
            colIn[r * 2 + 1] = rowTransformed[(r * N + c) * 2 + 1];
        }
        fft.transform(colOut, colIn);

        // Store back
        for (let r = 0; r < N; r++) {
            result[(r * N + c) * 2] = colOut[r * 2];
            result[(r * N + c) * 2 + 1] = colOut[r * 2 + 1];
        }
    }

    // Extract components
    const magnitude = new Float32Array(N * N);
    const phase = new Float32Array(N * N);
    const real = new Float32Array(N * N);
    const imaginary = new Float32Array(N * N);

    for (let i = 0; i < N * N; i++) {
        const re = result[i * 2];
        const im = result[i * 2 + 1];
        real[i] = re;
        imaginary[i] = im;
        magnitude[i] = Math.sqrt(re * re + im * im);
        phase[i] = Math.atan2(im, re);
    }

    return { magnitude, phase, real, imaginary };
}

/**
 * Log-normalize an array: output = log(1 + input) / log(1 + max).
 * Maps to [0, 1] range. Good for magnitude display.
 */
export function logNormalize(data: Float32Array): Float32Array {
    let max = 0;
    for (let i = 0; i < data.length; i++) {
        if (data[i] > max) max = data[i];
    }
    const logMax = Math.log1p(max);
    if (logMax === 0) return new Float32Array(data.length);

    const out = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
        out[i] = Math.log1p(data[i]) / logMax;
    }
    return out;
}

/**
 * Linear normalize: map [min, max] -> [0, 1].
 * For signed data (real/imaginary), maps [-|max|, |max|] -> [0, 1].
 */
export function linearNormalize(data: Float32Array, symmetric = false): Float32Array {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < data.length; i++) {
        if (data[i] < min) min = data[i];
        if (data[i] > max) max = data[i];
    }

    if (symmetric) {
        const absMax = Math.max(Math.abs(min), Math.abs(max));
        min = -absMax;
        max = absMax;
    }

    const range = max - min;
    if (range === 0) return new Float32Array(data.length).fill(0.5);

    const out = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
        out[i] = (data[i] - min) / range;
    }
    return out;
}
