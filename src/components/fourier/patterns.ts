import type { PatternType, PatternParams, PackShape } from './types';

/** Smoothstep: 0 when d >= 0, 1 when d <= -1, smooth in between. */
function coverage(d: number): number {
    if (d >= 1) return 0;
    if (d <= -1) return 1;
    // Hermite interpolation over [-1, 1] → [1, 0]
    const t = (d + 1) * 0.5; // map [-1,1] → [0,1]
    return 1 - t * t * (3 - 2 * t);
}

/** Signed distance for a shape (negative inside, positive outside). */
function shapeSDF(shape: PackShape, dx: number, dy: number, size: number): number {
    switch (shape) {
        case 'circle':
            return Math.sqrt(dx * dx + dy * dy) - size;
        case 'square':
            return Math.max(Math.abs(dx), Math.abs(dy)) - size;
        case 'rhombus':
            // |dx|+|dy| = size defines the diamond; gradient magnitude is sqrt(2)
            return (Math.abs(dx) + Math.abs(dy) - size) / Math.SQRT2;
    }
}

/** Return smooth coverage [0,1] for a shape at (dx,dy) with given size. */
function testShape(shape: PackShape, dx: number, dy: number, size: number): number {
    return coverage(shapeSDF(shape, dx, dy, size));
}

/**
 * Generate a 2D pattern as a Float32Array of size N*N with values in [0, 1].
 * Origin is at center of image (N/2, N/2).
 */
export function generatePattern(
    type: PatternType,
    params: PatternParams,
    N: number,
): Float32Array {
    const data = new Float32Array(N * N);
    const half = N / 2;

    switch (type) {
        case 'rectangle': {
            // SDF for axis-aligned box: max(|x|-hw, |y|-hh)
            const hw = params.rectWidth * half;
            const hh = params.rectHeight * half;
            for (let r = 0; r < N; r++) {
                for (let c = 0; c < N; c++) {
                    const x = c - half;
                    const y = r - half;
                    const d = Math.max(Math.abs(x) - hw, Math.abs(y) - hh);
                    data[r * N + c] = coverage(d);
                }
            }
            break;
        }
        case 'doubleSlit': {
            const sw = params.slitWidth * half;
            const sep = params.slitSeparation * half;
            const slitH = 0.4 * half;
            for (let r = 0; r < N; r++) {
                for (let c = 0; c < N; c++) {
                    const x = c - half;
                    const y = r - half;
                    // SDF for each slit (rectangle centered at ±sep)
                    const dLeft = Math.max(Math.abs(x + sep) - sw, Math.abs(y) - slitH);
                    const dRight = Math.max(Math.abs(x - sep) - sw, Math.abs(y) - slitH);
                    // Union: min of the two distances
                    data[r * N + c] = coverage(Math.min(dLeft, dRight));
                }
            }
            break;
        }
        case 'circle': {
            const rad = params.circleRadius * half;
            for (let r = 0; r < N; r++) {
                for (let c = 0; c < N; c++) {
                    const x = c - half;
                    const y = r - half;
                    const d = Math.sqrt(x * x + y * y) - rad;
                    data[r * N + c] = coverage(d);
                }
            }
            break;
        }
        case 'grating': {
            const freq = params.gratingFrequency;
            const angle = (params.gratingAngle * Math.PI) / 180;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            // Anti-aliased square wave via smoothstep at zero-crossings
            // The sine has slope 2πf at zero crossings; scale to pixel distance
            const slopeAtZero = 2 * Math.PI * freq / N;
            for (let r = 0; r < N; r++) {
                for (let c = 0; c < N; c++) {
                    const x = (c - half) / N;
                    const y = (r - half) / N;
                    const rotated = x * cosA + y * sinA;
                    const s = Math.sin(2 * Math.PI * freq * rotated);
                    // Convert sine value to approximate pixel distance from edge
                    const d = -s / slopeAtZero;
                    data[r * N + c] = coverage(d);
                }
            }
            break;
        }
        case 'gaussian': {
            const sx = params.sigmaX * half;
            const sy = params.sigmaY * half;
            const sx2 = 2 * sx * sx;
            const sy2 = 2 * sy * sy;
            for (let r = 0; r < N; r++) {
                for (let c = 0; c < N; c++) {
                    const x = c - half;
                    const y = r - half;
                    data[r * N + c] = Math.exp(-(x * x) / sx2 - (y * y) / sy2);
                }
            }
            break;
        }
        case 'pointSources': {
            const count = Math.max(1, Math.round(params.pointCount));
            const spacing = params.pointSpacing * half;
            const startX = -((count - 1) * spacing) / 2;
            const pointRadius = 2;
            for (let i = 0; i < count; i++) {
                const cx = startX + i * spacing;
                const cy = 0;
                for (let r = 0; r < N; r++) {
                    for (let c = 0; c < N; c++) {
                        const x = c - half - cx;
                        const y = r - half - cy;
                        const d = Math.sqrt(x * x + y * y) - pointRadius;
                        const v = coverage(d);
                        if (v > data[r * N + c]) {
                            data[r * N + c] = v;
                        }
                    }
                }
            }
            break;
        }
        case 'rhombus': {
            // Diamond shape: |x|/hw + |y|/hh <= 1, with anti-aliased edges
            const hw = params.rhombusWidth * half;   // half horizontal diagonal
            const hh = params.rhombusHeight * half;  // half vertical diagonal
            // Gradient magnitude of (|x|/hw + |y|/hh) is sqrt(1/hw² + 1/hh²)
            const gradMag = Math.sqrt(1 / (hw * hw) + 1 / (hh * hh));
            for (let r = 0; r < N; r++) {
                for (let c = 0; c < N; c++) {
                    const x = c - half;
                    const y = r - half;
                    // Signed distance in pixels: (f(x,y) - 1) / |∇f|
                    const d = (Math.abs(x) / hw + Math.abs(y) / hh - 1) / gradMag;
                    data[r * N + c] = coverage(d);
                }
            }
            break;
        }
        case 'packedShapes': {
            const envR = params.packEnvelopeRadius * half;
            const spacing = params.packSpacing * half;
            const elemSize = params.packElementSize * half;
            const shape = params.packShape;
            const isHex = params.packPacking === 'hex';
            const rowH = isHex ? spacing * Math.sqrt(3) / 2 : spacing;

            for (let r = 0; r < N; r++) {
                for (let c = 0; c < N; c++) {
                    const px = c - half;
                    const py = r - half;
                    // Anti-aliased circular envelope
                    const envDist = Math.sqrt(px * px + py * py) - envR;
                    const envCov = coverage(envDist);
                    if (envCov <= 0) continue;
                    // Find nearest grid center
                    const rowIdx = Math.round(py / rowH);
                    const rowOffset = isHex && (rowIdx & 1) !== 0 ? spacing * 0.5 : 0;
                    const colIdx = Math.round((px - rowOffset) / spacing);
                    const cx = colIdx * spacing + rowOffset;
                    const cy = rowIdx * rowH;
                    // Offset from nearest center
                    const dx = px - cx;
                    const dy = py - cy;
                    const shapeCov = testShape(shape, dx, dy, elemSize);
                    if (shapeCov > 0) {
                        data[r * N + c] = envCov * shapeCov;
                    }
                }
            }
            break;
        }
    }

    return data;
}

/**
 * Multiply input by (-1)^(r+c) to center the DC component after FFT.
 * This is the standard fftshift pre-multiplication trick.
 */
export function applyFftShift(data: Float32Array, N: number): Float32Array {
    const shifted = new Float32Array(N * N);
    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            const sign = ((r + c) & 1) === 0 ? 1 : -1;
            shifted[r * N + c] = data[r * N + c] * sign;
        }
    }
    return shifted;
}
