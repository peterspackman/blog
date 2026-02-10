import React, { useRef, useEffect, useMemo } from 'react';
import type { CrystalStructure } from './physics';
import {
    calculateDSpacing,
    calculateTwoTheta,
    atomicFormFactor,
    isAllowedReflection,
} from './physics';
import { interpolateFormFactorSmooth } from './FormFactorEditor';
import type { ControlTheme } from '../shared/controls';
import type { ControlPoint } from './physics';
import { getElementColor } from './physics';

export interface ElectronDensityProps {
    width: number;
    height: number;
    structure: CrystalStructure;
    wavelength: number;
    slicePosition: number; // Position along zone axis (0-1)
    zoneAxis?: [number, number, number]; // Zone axis [uvw] - slice plane is perpendicular to this
    maxHKL: number;
    twoThetaMax?: number; // Max 2θ in degrees - used when detectorLimited is true
    detectorLimited?: boolean; // When true, only use reflections within detector 2θ range
    theme: ControlTheme;
    formFactors?: Record<string, ControlPoint[]>;
    bFactor?: number; // Debye-Waller temperature factor in Ų (default ~1.5)
    noise?: number; // Noise level (0-1) to apply to structure factor amplitudes
    displayMode?: 'signed' | 'magnitude'; // How to display density (default 'magnitude')
    showAtoms?: boolean; // Whether to show atom positions on the slice (default true)
}

// Calculate structure factor with custom form factors, resolution cutoff, and Debye-Waller factor
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
        return null; // Beyond observable resolution
    }

    const twoTheta = calculateTwoTheta(d, wavelength);
    if (isNaN(twoTheta)) {
        return null;
    }

    // sin(θ)/λ for form factor calculation
    const sinTheta_lambda = Math.sin((twoTheta * Math.PI) / 360) / wavelength;

    // Debye-Waller factor: exp(-B * sin²θ/λ²)
    // B is typically 1-3 Ų for atoms at room temperature
    const debyeWaller = Math.exp(-bFactor * sinTheta_lambda * sinTheta_lambda);

    let F = { re: 0, im: 0 };

    for (const atom of structure.atoms) {
        const [x, y, z] = atom.position;
        const phase = 2 * Math.PI * (h * x + k * y + l * z);

        // Get atomic form factor - use custom if provided, otherwise use Cromer-Mann
        let f: number;
        if (formFactors && formFactors[atom.element] && formFactors[atom.element].length > 0) {
            f = interpolateFormFactorSmooth(formFactors[atom.element], sinTheta_lambda);
        } else {
            f = atomicFormFactor(atom.element, sinTheta_lambda);
        }

        // Apply Debye-Waller damping
        f *= debyeWaller;

        // exp(i·phase) = cos(phase) + i·sin(phase)
        F.re += f * Math.cos(phase);
        F.im += f * Math.sin(phase);
    }

    return F;
}

// Vertex shader
const VERTEX_SHADER = `
    attribute vec2 a_position;
    varying vec2 v_texCoord;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = (a_position + 1.0) / 2.0;
    }
`;

// Fragment shader - computes Fourier synthesis with Gaussian damping
// Supports arbitrary zone axis slicing
const FRAGMENT_SHADER = `
    precision highp float;
    varying vec2 v_texCoord;
    uniform float u_slicePos;
    uniform vec3 u_zoneAxis; // Zone axis direction (normalized)
    uniform vec3 u_basis1; // First basis vector spanning the slice plane
    uniform vec3 u_basis2; // Second basis vector spanning the slice plane
    uniform int u_numReflections;
    uniform sampler2D u_reflectionData;
    uniform float u_dataSize;
    uniform float u_sigma; // Gaussian damping parameter
    uniform int u_displayMode; // 0=magnitude, 1=signed
    uniform float u_normScale; // Dynamic normalization scale based on structure

    // Viridis colormap for magnitude mode (sequential, perceptually uniform)
    vec3 viridis(float t) {
        t = clamp(t, 0.0, 1.0);
        vec3 c0 = vec3(0.267, 0.004, 0.329);
        vec3 c1 = vec3(0.282, 0.140, 0.458);
        vec3 c2 = vec3(0.254, 0.265, 0.530);
        vec3 c3 = vec3(0.206, 0.372, 0.553);
        vec3 c4 = vec3(0.163, 0.471, 0.558);
        vec3 c5 = vec3(0.128, 0.567, 0.551);
        vec3 c6 = vec3(0.135, 0.659, 0.518);
        vec3 c7 = vec3(0.267, 0.749, 0.441);
        vec3 c8 = vec3(0.478, 0.821, 0.318);
        vec3 c9 = vec3(0.741, 0.873, 0.150);
        vec3 c10 = vec3(0.993, 0.906, 0.144);

        float idx = t * 10.0;
        int i = int(idx);
        float f = fract(idx);

        if (i >= 10) return c10;
        if (i == 0) return mix(c0, c1, f);
        if (i == 1) return mix(c1, c2, f);
        if (i == 2) return mix(c2, c3, f);
        if (i == 3) return mix(c3, c4, f);
        if (i == 4) return mix(c4, c5, f);
        if (i == 5) return mix(c5, c6, f);
        if (i == 6) return mix(c6, c7, f);
        if (i == 7) return mix(c7, c8, f);
        if (i == 8) return mix(c8, c9, f);
        return mix(c9, c10, f);
    }

    // Blue-White-Red diverging colormap for signed mode
    vec3 blueWhiteRed(float t) {
        t = clamp(t, 0.0, 1.0);
        if (t < 0.5) {
            // Red to White (negative to zero)
            float f = t * 2.0;
            return vec3(1.0, f, f);
        } else {
            // White to Blue (zero to positive)
            float f = (t - 0.5) * 2.0;
            return vec3(1.0 - f, 1.0 - f, 1.0);
        }
    }

    void main() {
        // Map texture coords to fractional crystal coords using zone axis and basis vectors
        // The slice plane is perpendicular to u_zoneAxis, at position u_slicePos along that axis
        // u_basis1 and u_basis2 span the plane

        // Position in fractional coordinates
        vec3 pos = u_slicePos * u_zoneAxis + (v_texCoord.x - 0.5) * u_basis1 + (v_texCoord.y - 0.5) * u_basis2;

        float densityRe = 0.0;
        float densityIm = 0.0;
        float TWO_PI = 6.28318530718;
        float sigma2 = u_sigma * u_sigma * 2.0;

        for (int i = 0; i < 2000; i++) {
            if (i >= u_numReflections) break;
            float idx = float(i * 2);
            vec4 hklData = texture2D(u_reflectionData, vec2((idx + 0.5) / u_dataSize, 0.5));
            vec4 fData = texture2D(u_reflectionData, vec2((idx + 1.5) / u_dataSize, 0.5));

            // Gaussian damping to reduce Gibbs ringing
            float s2 = hklData.r * hklData.r + hklData.g * hklData.g + hklData.b * hklData.b;
            float damping = exp(-s2 / sigma2);

            // Phase = -2π(h·x + k·y + l·z) where (x,y,z) = pos
            float phase = -TWO_PI * (hklData.r * pos.x + hklData.g * pos.y + hklData.b * pos.z);

            // Complex multiplication: F * exp(-i*phase)
            float c = cos(phase);
            float s = sin(phase);
            densityRe += damping * (fData.r * c - fData.g * s);
            densityIm += damping * (fData.r * s + fData.g * c);
        }

        vec3 color;
        if (u_displayMode == 0) {
            // Magnitude mode: |rho| = sqrt(re^2 + im^2)
            float mag = sqrt(densityRe * densityRe + densityIm * densityIm);
            float normalized = clamp(mag / u_normScale, 0.0, 1.0);
            color = viridis(normalized);
        } else {
            // Signed mode: show real part with diverging colormap
            float normalized = clamp((densityRe + u_normScale) / (2.0 * u_normScale), 0.0, 1.0);
            color = blueWhiteRed(normalized);
        }

        gl_FragColor = vec4(color, 1.0);
    }
`;

interface ReflectionData {
    h: number;
    k: number;
    l: number;
    fRe: number;
    fIm: number;
}

// WebGL state stored outside React to avoid re-creation
interface GLState {
    gl: WebGLRenderingContext;
    program: WebGLProgram;
    texture: WebGLTexture;
    slicePosLoc: WebGLUniformLocation | null;
    zoneAxisLoc: WebGLUniformLocation | null;
    basis1Loc: WebGLUniformLocation | null;
    basis2Loc: WebGLUniformLocation | null;
    numReflectionsLoc: WebGLUniformLocation | null;
    dataSizeLoc: WebGLUniformLocation | null;
    sigmaLoc: WebGLUniformLocation | null;
    displayModeLoc: WebGLUniformLocation | null;
    normScaleLoc: WebGLUniformLocation | null;
}


export const ElectronDensity: React.FC<ElectronDensityProps> = React.memo(({
    width,
    height,
    structure,
    wavelength,
    slicePosition,
    zoneAxis = [0, 0, 1],
    maxHKL,
    twoThetaMax = 180,
    detectorLimited = false,
    theme,
    formFactors,
    bFactor = 1.5,
    noise = 0,
    displayMode = 'magnitude',
    showAtoms = true,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const glCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const glStateRef = useRef<GLState | null>(null);
    const animFrameRef = useRef<number>(0);

    const plotWidth = width;
    const plotHeight = height;

    // Compute zone axis and basis vectors for slice plane
    const [u, v, w] = zoneAxis;
    const zoneAxisData = useMemo(() => {
        // Normalize zone axis
        const len = Math.sqrt(u * u + v * v + w * w);
        if (len === 0) {
            // Default to z-axis if invalid
            return {
                norm: [0, 0, 1] as [number, number, number],
                basis1: [1, 0, 0] as [number, number, number],
                basis2: [0, 1, 0] as [number, number, number],
                label: '[001]',
            };
        }
        const norm: [number, number, number] = [u / len, v / len, w / len];

        // Find two orthogonal vectors perpendicular to zone axis using cross products
        let b1x: number, b1y: number, b1z: number;
        if (Math.abs(u) <= Math.abs(v) && Math.abs(u) <= Math.abs(w)) {
            // u is smallest, use [1,0,0] × [u,v,w]
            b1x = 0; b1y = -w; b1z = v;
        } else if (Math.abs(v) <= Math.abs(w)) {
            // v is smallest, use [0,1,0] × [u,v,w]
            b1x = w; b1y = 0; b1z = -u;
        } else {
            // w is smallest, use [0,0,1] × [u,v,w]
            b1x = -v; b1y = u; b1z = 0;
        }

        // Normalize b1
        const b1Len = Math.sqrt(b1x * b1x + b1y * b1y + b1z * b1z);
        if (b1Len > 0) {
            b1x /= b1Len; b1y /= b1Len; b1z /= b1Len;
        }

        // Second basis vector: [u,v,w] × b1 (already perpendicular to both)
        const b2x = norm[1] * b1z - norm[2] * b1y;
        const b2y = norm[2] * b1x - norm[0] * b1z;
        const b2z = norm[0] * b1y - norm[1] * b1x;

        // Normalize b2
        const b2Len = Math.sqrt(b2x * b2x + b2y * b2y + b2z * b2z);

        // Scale basis vectors to span approximately one unit cell
        // Use 1.5x to ensure we cover the cell with some margin for non-principal axes
        const scale = 1.5;
        const basis1: [number, number, number] = [b1x * scale, b1y * scale, b1z * scale];
        const basis2: [number, number, number] = [b2x / b2Len * scale, b2y / b2Len * scale, b2z / b2Len * scale];

        const label = `[${u}${v}${w}]`;

        return { norm, basis1, basis2, label };
    }, [u, v, w]);

    // Pre-compute structure factors - depends on wavelength via atomic form factors
    // Dynamically limit reflections: keep strongest until 99.5% of total intensity captured
    // Also cap at 2000 due to shader loop limit
    const MAX_REFLECTIONS = 2000;
    const INTENSITY_THRESHOLD = 0.995;

    const reflections = useMemo(() => {
        // Seeded random for consistent noise at same level
        const seededRandom = (seed: number) => {
            const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
            return x - Math.floor(x);
        };

        const data: ReflectionData[] = [];
        let totalIntensity = 0;

        for (let h = -maxHKL; h <= maxHKL; h++) {
            for (let k = -maxHKL; k <= maxHKL; k++) {
                for (let l = -maxHKL; l <= maxHKL; l++) {
                    if (h === 0 && k === 0 && l === 0) continue;
                    if (!isAllowedReflection(Math.abs(h), Math.abs(k), Math.abs(l), structure)) continue;

                    // When detector-limited, skip reflections beyond the detector 2θ range
                    if (detectorLimited) {
                        const d = calculateDSpacing(h, k, l, structure);
                        const tt = calculateTwoTheta(d, wavelength);
                        if (isNaN(tt) || tt > twoThetaMax) continue;
                    }

                    const F = calculateStructureFactorCustom(h, k, l, structure, wavelength, formFactors, bFactor);
                    if (F && (Math.abs(F.re) > 0.01 || Math.abs(F.im) > 0.01)) {
                        const intensity = F.re * F.re + F.im * F.im;
                        totalIntensity += intensity;
                        data.push({ h, k, l, fRe: F.re, fIm: F.im });
                    }
                }
            }
        }

        // Sort by intensity (|F|²) descending to keep strongest reflections
        data.sort((a, b) => {
            const intA = a.fRe * a.fRe + a.fIm * a.fIm;
            const intB = b.fRe * b.fRe + b.fIm * b.fIm;
            return intB - intA;
        });

        // Keep reflections until we capture INTENSITY_THRESHOLD of total, capped at MAX_REFLECTIONS
        let cumulative = 0;
        let cutoff = data.length;
        for (let i = 0; i < data.length; i++) {
            const r = data[i];
            cumulative += r.fRe * r.fRe + r.fIm * r.fIm;
            if (cumulative >= totalIntensity * INTENSITY_THRESHOLD || i >= MAX_REFLECTIONS - 1) {
                cutoff = i + 1;
                break;
            }
        }

        const limited = data.slice(0, cutoff);

        // Apply noise after sorting/limiting (noise is seeded by index for reproducibility)
        if (noise > 0) {
            for (let index = 0; index < limited.length; index++) {
                const r = limited[index];
                const amplitude = Math.sqrt(r.fRe * r.fRe + r.fIm * r.fIm);
                const phase = Math.atan2(r.fIm, r.fRe);
                // Poisson-like noise: proportional to sqrt(|F|²) = |F|
                const noiseScale = amplitude * noise * 0.3;
                const randomVal = (seededRandom(index * 1000 + noise * 10000) - 0.5) * 2;
                const noisyAmplitude = Math.max(0, amplitude + randomVal * noiseScale);
                r.fRe = noisyAmplitude * Math.cos(phase);
                r.fIm = noisyAmplitude * Math.sin(phase);
            }
        }

        return limited;
    }, [structure, maxHKL, wavelength, formFactors, bFactor, noise, detectorLimited, twoThetaMax]);

    // Initialize WebGL once
    useEffect(() => {
        const canvas = glCanvasRef.current;
        if (!canvas) return;

        const gl = canvas.getContext('webgl');
        if (!gl) return;

        // Create shaders
        const vs = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(vs, VERTEX_SHADER);
        gl.compileShader(vs);

        const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fs, FRAGMENT_SHADER);
        gl.compileShader(fs);

        const program = gl.createProgram()!;
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        // Vertex buffer
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const posLoc = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        // Texture
        const texture = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        glStateRef.current = {
            gl,
            program,
            texture,
            slicePosLoc: gl.getUniformLocation(program, 'u_slicePos'),
            zoneAxisLoc: gl.getUniformLocation(program, 'u_zoneAxis'),
            basis1Loc: gl.getUniformLocation(program, 'u_basis1'),
            basis2Loc: gl.getUniformLocation(program, 'u_basis2'),
            displayModeLoc: gl.getUniformLocation(program, 'u_displayMode'),
            numReflectionsLoc: gl.getUniformLocation(program, 'u_numReflections'),
            dataSizeLoc: gl.getUniformLocation(program, 'u_dataSize'),
            sigmaLoc: gl.getUniformLocation(program, 'u_sigma'),
            normScaleLoc: gl.getUniformLocation(program, 'u_normScale'),
        };

        return () => {
            gl.deleteProgram(program);
            gl.deleteTexture(texture);
            glStateRef.current = null;
        };
    }, []);

    // Update texture when reflections change
    useEffect(() => {
        const state = glStateRef.current;
        if (!state) return;

        const { gl, texture } = state;
        const dataSize = Math.max(4, reflections.length * 2);
        const textureData = new Float32Array(dataSize * 4);

        for (let i = 0; i < reflections.length; i++) {
            const r = reflections[i];
            const idx = i * 8;
            textureData[idx] = r.h;
            textureData[idx + 1] = r.k;
            textureData[idx + 2] = r.l;
            textureData[idx + 4] = r.fRe;
            textureData[idx + 5] = r.fIm;
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        const ext = gl.getExtension('OES_texture_float');
        if (ext) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, dataSize, 1, 0, gl.RGBA, gl.FLOAT, textureData);
        }
    }, [reflections]);

    // Render loop - runs on every sliceZ change but is very fast
    useEffect(() => {
        const state = glStateRef.current;
        const canvas = glCanvasRef.current;
        const overlayCanvas = overlayCanvasRef.current;
        if (!state || !canvas || !overlayCanvas) return;

        // Cancel any pending frame
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
        }

        animFrameRef.current = requestAnimationFrame(() => {
            const { gl, program, texture, slicePosLoc, zoneAxisLoc, basis1Loc, basis2Loc, displayModeLoc, numReflectionsLoc, dataSizeLoc, sigmaLoc, normScaleLoc } = state;

            // Resize canvas if needed
            if (canvas.width !== plotWidth || canvas.height !== plotHeight) {
                canvas.width = plotWidth;
                canvas.height = plotHeight;
            }

            // Convert display mode: magnitude=0, signed=1
            const displayModeInt = displayMode === 'magnitude' ? 0 : 1;

            // Compute normalization based on average electron density
            // Shader computes Σ F*exp(...) which equals V * ρ(r)
            // At average density: V * ρ_avg = V * (ΣZ/V) = ΣZ = totalElectrons
            let totalElectrons = 0;
            for (const atom of structure.atoms) {
                totalElectrons += atom.atomicNumber || 6; // default to C if not specified
            }

            // Scale so average density maps to ~0.3, giving room for peaks
            // normScale is what maps to 1.0 in the shader
            const normScale = Math.max(totalElectrons * 3.0, 1);

            // WebGL render
            gl.viewport(0, 0, plotWidth, plotHeight);
            gl.useProgram(program);
            gl.uniform1f(slicePosLoc, slicePosition);
            gl.uniform3f(zoneAxisLoc, zoneAxisData.norm[0], zoneAxisData.norm[1], zoneAxisData.norm[2]);
            gl.uniform3f(basis1Loc, zoneAxisData.basis1[0], zoneAxisData.basis1[1], zoneAxisData.basis1[2]);
            gl.uniform3f(basis2Loc, zoneAxisData.basis2[0], zoneAxisData.basis2[1], zoneAxisData.basis2[2]);
            gl.uniform1i(displayModeLoc, displayModeInt);
            gl.uniform1i(numReflectionsLoc, reflections.length);
            gl.uniform1f(dataSizeLoc, Math.max(4, reflections.length * 2));
            // Gaussian damping sigma = maxHKL * 0.8 for smooth falloff
            gl.uniform1f(sigmaLoc, maxHKL * 0.8);
            gl.uniform1f(normScaleLoc, normScale);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            // 2D overlay
            const ctx = overlayCanvas.getContext('2d');
            if (!ctx) return;

            if (overlayCanvas.width !== width || overlayCanvas.height !== height) {
                overlayCanvas.width = width;
                overlayCanvas.height = height;
            }

            ctx.clearRect(0, 0, width, height);

            const isDark = theme.text.startsWith('#e') || theme.text.startsWith('#f');
            const bgAlpha = isDark ? 'rgba(30,30,30,0.7)' : 'rgba(255,255,255,0.7)';

            // Atoms - show atoms near the slice plane, tiled across the entire view
            if (showAtoms) {
                const { norm, basis1, basis2 } = zoneAxisData;

                // Tile across enough unit cells to cover the visible area
                const tileRange = 2;

                for (let ti = -tileRange; ti <= tileRange; ti++) {
                    for (let tj = -tileRange; tj <= tileRange; tj++) {
                        for (let tk = -tileRange; tk <= tileRange; tk++) {
                            for (const atom of structure.atoms) {
                                const fx = atom.position[0] + ti;
                                const fy = atom.position[1] + tj;
                                const fz = atom.position[2] + tk;

                                const distFromPlane = (fx - slicePosition * norm[0]) * norm[0]
                                                    + (fy - slicePosition * norm[1]) * norm[1]
                                                    + (fz - slicePosition * norm[2]) * norm[2];

                                const dist = Math.abs(distFromPlane);
                                if (dist >= 0.12) continue;

                                const relX = fx - slicePosition * norm[0];
                                const relY = fy - slicePosition * norm[1];
                                const relZ = fz - slicePosition * norm[2];

                                const dot1 = relX * basis1[0] + relY * basis1[1] + relZ * basis1[2];
                                const dot2 = relX * basis2[0] + relY * basis2[1] + relZ * basis2[2];
                                const texCoordX = dot1 / 2.25 + 0.5;
                                const texCoordY = dot2 / 2.25 + 0.5;

                                if (texCoordX < -0.05 || texCoordX > 1.05 || texCoordY < -0.05 || texCoordY > 1.05) continue;

                                const ax = texCoordX * plotWidth;
                                const ay = (1 - texCoordY) * plotHeight;

                                const elemColor = getElementColor(atom.element);
                                const opacity = 1 - dist / 0.12;

                                const radius = 5;
                                ctx.beginPath();
                                ctx.arc(ax, ay, radius, 0, 2 * Math.PI);
                                ctx.fillStyle = elemColor;
                                ctx.globalAlpha = opacity * 0.9;
                                ctx.fill();

                                ctx.globalAlpha = opacity * 0.7;
                                ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)';
                                ctx.lineWidth = 1;
                                ctx.stroke();

                                ctx.globalAlpha = 1;
                            }
                        }
                    }
                }
            }

            // Helper to draw text with a semi-transparent background pill
            const drawLabel = (text: string, x: number, y: number, align: CanvasTextAlign = 'left') => {
                ctx.font = '9px sans-serif';
                const metrics = ctx.measureText(text);
                const padX = 4, padY = 2;
                const tw = metrics.width;
                const th = 10; // approximate font height
                let bx = x - padX;
                if (align === 'center') bx = x - tw / 2 - padX;
                else if (align === 'right') bx = x - tw - padX;
                ctx.fillStyle = bgAlpha;
                ctx.fillRect(bx, y - th - padY, tw + 2 * padX, th + 2 * padY);
                ctx.fillStyle = theme.text;
                ctx.textAlign = align;
                ctx.fillText(text, x, y);
            };

            // Axis labels - inside the plot along edges
            let axisLabels: [string, string];
            if (zoneAxis[0] === 0 && zoneAxis[1] === 0 && zoneAxis[2] !== 0) {
                axisLabels = ['x/a', 'y/b'];
            } else if (zoneAxis[0] === 0 && zoneAxis[2] === 0 && zoneAxis[1] !== 0) {
                axisLabels = ['x/a', 'z/c'];
            } else if (zoneAxis[1] === 0 && zoneAxis[2] === 0 && zoneAxis[0] !== 0) {
                axisLabels = ['y/b', 'z/c'];
            } else {
                axisLabels = ['⊥₁', '⊥₂'];
            }

            // X-axis label at bottom center
            drawLabel(axisLabels[0], width / 2, height - 6, 'center');
            // Y-axis label at left center (rotated)
            ctx.save();
            ctx.translate(12, height / 2);
            ctx.rotate(-Math.PI / 2);
            drawLabel(axisLabels[1], 0, 0, 'center');
            ctx.restore();

            // Reflection count - top left inside plot
            const modeLabel = detectorLimited ? `${reflections.length} refl (2θ≤${twoThetaMax}°)` : `${reflections.length} refl`;
            drawLabel(modeLabel, 6, 14);

            // Colorbar - inside plot, right edge
            const lw = 10, lh = Math.min(plotHeight * 0.5, 120);
            const lx = width - lw - 8;
            const ly = (height - lh) / 2;

            // Blue-White-Red colormap function for signed mode
            const blueWhiteRed = (t: number): [number, number, number] => {
                t = Math.max(0, Math.min(1, t));
                if (t < 0.5) {
                    const f = t * 2.0;
                    return [255, Math.round(f * 255), Math.round(f * 255)];
                } else {
                    const f = (t - 0.5) * 2.0;
                    return [Math.round((1 - f) * 255), Math.round((1 - f) * 255), 255];
                }
            };

            // Viridis colormap function for magnitude mode
            const viridisJS = (t: number): [number, number, number] => {
                t = Math.max(0, Math.min(1, t));
                const colors = [
                    [0.267, 0.004, 0.329], [0.282, 0.140, 0.458], [0.254, 0.265, 0.530],
                    [0.206, 0.372, 0.553], [0.163, 0.471, 0.558], [0.128, 0.567, 0.551],
                    [0.135, 0.659, 0.518], [0.267, 0.749, 0.441], [0.478, 0.821, 0.318],
                    [0.741, 0.873, 0.150], [0.993, 0.906, 0.144],
                ];
                const idx = t * 10;
                const i = Math.min(9, Math.floor(idx));
                const f = idx - i;
                const c1 = colors[i], c2 = colors[i + 1];
                return [
                    Math.round((c1[0] + (c2[0] - c1[0]) * f) * 255),
                    Math.round((c1[1] + (c2[1] - c1[1]) * f) * 255),
                    Math.round((c1[2] + (c2[2] - c1[2]) * f) * 255),
                ];
            };

            const getColor = displayMode === 'magnitude' ? viridisJS : blueWhiteRed;

            // Background behind colorbar for readability
            ctx.fillStyle = bgAlpha;
            ctx.fillRect(lx - 3, ly - 14, lw + 6, lh + 26);

            for (let i = 0; i < lh; i++) {
                const t = 1 - i / lh;
                const [r, g, b] = getColor(t);
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(lx, ly + i, lw, 1);
            }
            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 1;
            ctx.strokeRect(lx, ly, lw, lh);

            // Colorbar labels
            ctx.fillStyle = theme.text;
            ctx.font = '8px sans-serif';
            ctx.textAlign = 'center';
            const barCenterX = lx + lw / 2;

            if (displayMode === 'magnitude') {
                ctx.fillText('high', barCenterX, ly - 4);
                ctx.fillText('low', barCenterX, ly + lh + 10);
            } else {
                ctx.fillText('+', barCenterX, ly - 4);
                ctx.fillText('0', barCenterX + lw / 2 + 6, ly + lh / 2 + 3);
                ctx.fillText('−', barCenterX, ly + lh + 10);
            }
        });

        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, [slicePosition, zoneAxis, zoneAxisData, displayMode, showAtoms, width, height, structure, reflections, theme, maxHKL, detectorLimited, twoThetaMax]);

    return (
        <div
            ref={containerRef}
            style={{
                position: 'relative',
                width,
                height,
                borderRadius: '4px',
                border: `1px solid ${theme.border}`,
                overflow: 'hidden',
                backgroundColor: theme.surface || theme.inputBg,
            }}
        >
            <canvas
                ref={glCanvasRef}
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: plotWidth,
                    height: plotHeight,
                }}
            />
            <canvas
                ref={overlayCanvasRef}
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    pointerEvents: 'none',
                }}
            />
        </div>
    );
});

ElectronDensity.displayName = 'ElectronDensity';

export default ElectronDensity;
