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

interface ControlPoint {
    s: number;
    f: number;
}

export interface ElectronDensityProps {
    width: number;
    height: number;
    structure: CrystalStructure;
    wavelength: number;
    slicePosition: number; // Position along slice axis (0-1)
    sliceAxis?: 'x' | 'y' | 'z'; // Which axis to slice along (default 'z')
    resolution: number;
    showContours: boolean;
    maxHKL: number;
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
const FRAGMENT_SHADER = `
    precision highp float;
    varying vec2 v_texCoord;
    uniform float u_slicePos;
    uniform int u_sliceAxis; // 0=x, 1=y, 2=z
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
        // Map texture coords to crystal coords based on slice axis
        // u_sliceAxis: 0=x (slice shows yz), 1=y (slice shows xz), 2=z (slice shows xy)
        float coord1 = v_texCoord.x;
        float coord2 = v_texCoord.y;

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

            // Calculate phase based on slice axis
            float phase;
            if (u_sliceAxis == 0) {
                // x-slice: fixed x=slicePos, show (y, z) plane
                phase = -TWO_PI * (hklData.r * u_slicePos + hklData.g * coord1 + hklData.b * coord2);
            } else if (u_sliceAxis == 1) {
                // y-slice: fixed y=slicePos, show (x, z) plane
                phase = -TWO_PI * (hklData.r * coord1 + hklData.g * u_slicePos + hklData.b * coord2);
            } else {
                // z-slice: fixed z=slicePos, show (x, y) plane
                phase = -TWO_PI * (hklData.r * coord1 + hklData.g * coord2 + hklData.b * u_slicePos);
            }
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
    sliceAxisLoc: WebGLUniformLocation | null;
    numReflectionsLoc: WebGLUniformLocation | null;
    dataSizeLoc: WebGLUniformLocation | null;
    sigmaLoc: WebGLUniformLocation | null;
    displayModeLoc: WebGLUniformLocation | null;
    normScaleLoc: WebGLUniformLocation | null;
}

// Element colors for atom visualization
const ELEMENT_COLORS: Record<string, string> = {
    H: '#FFFFFF', C: '#909090', N: '#3050F8', O: '#FF0D0D',
    Na: '#AB5CF2', Cl: '#1FF01F', Si: '#F0C8A0', Fe: '#E06633',
    Ca: '#3DFF00', Ti: '#BFC2C7', Cs: '#57178F', Ba: '#00C900',
    K: '#8F40D4', I: '#940094', S: '#FFFF30', P: '#FF8000',
    Mg: '#8AFF00', Al: '#BFA6A6', Zn: '#7D80B0', Cu: '#C88033',
};

export const ElectronDensity: React.FC<ElectronDensityProps> = React.memo(({
    width,
    height,
    structure,
    wavelength,
    slicePosition,
    sliceAxis = 'z',
    resolution,
    showContours,
    maxHKL,
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

    const margin = 40;
    const plotWidth = width - 2 * margin;
    const plotHeight = height - 2 * margin;

    // Pre-compute structure factors - depends on wavelength via atomic form factors
    const reflections = useMemo(() => {
        // Seeded random for consistent noise at same level
        const seededRandom = (seed: number) => {
            const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
            return x - Math.floor(x);
        };

        const data: ReflectionData[] = [];
        let index = 0;
        for (let h = -maxHKL; h <= maxHKL; h++) {
            for (let k = -maxHKL; k <= maxHKL; k++) {
                for (let l = -maxHKL; l <= maxHKL; l++) {
                    if (h === 0 && k === 0 && l === 0) continue;
                    if (!isAllowedReflection(Math.abs(h), Math.abs(k), Math.abs(l), structure)) continue;
                    const F = calculateStructureFactorCustom(h, k, l, structure, wavelength, formFactors, bFactor);
                    if (F && (Math.abs(F.re) > 0.01 || Math.abs(F.im) > 0.01)) {
                        let fRe = F.re;
                        let fIm = F.im;

                        // Apply noise to structure factor amplitude
                        if (noise > 0) {
                            const amplitude = Math.sqrt(fRe * fRe + fIm * fIm);
                            const phase = Math.atan2(fIm, fRe);
                            // Poisson-like noise: proportional to sqrt(|F|²) = |F|
                            const noiseScale = amplitude * noise * 0.3;
                            const randomVal = (seededRandom(index * 1000 + noise * 10000) - 0.5) * 2;
                            const noisyAmplitude = Math.max(0, amplitude + randomVal * noiseScale);
                            fRe = noisyAmplitude * Math.cos(phase);
                            fIm = noisyAmplitude * Math.sin(phase);
                        }

                        data.push({ h, k, l, fRe, fIm });
                        index++;
                    }
                }
            }
        }
        return data;
    }, [structure, maxHKL, wavelength, formFactors, bFactor, noise]);

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
            sliceAxisLoc: gl.getUniformLocation(program, 'u_sliceAxis'),
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
            const { gl, program, texture, slicePosLoc, sliceAxisLoc, displayModeLoc, numReflectionsLoc, dataSizeLoc, sigmaLoc, normScaleLoc } = state;

            // Resize canvas if needed
            if (canvas.width !== plotWidth || canvas.height !== plotHeight) {
                canvas.width = plotWidth;
                canvas.height = plotHeight;
            }

            // Convert axis to int: x=0, y=1, z=2
            const axisInt = sliceAxis === 'x' ? 0 : sliceAxis === 'y' ? 1 : 2;
            // Convert display mode: magnitude=0, signed=1
            const displayModeInt = displayMode === 'magnitude' ? 0 : 1;

            // Compute normalization scale from structure factors
            // Max density occurs when all F add constructively: ρ_max ≈ Σ|F|
            // Use this as the normalization scale for good contrast
            let sumF = 0;
            for (const r of reflections) {
                sumF += Math.sqrt(r.fRe * r.fRe + r.fIm * r.fIm);
            }
            // Use ~80% of theoretical max for better contrast
            const normScale = 1000.0; // Math.max(sumF * 0.8, 1);

            // WebGL render
            gl.viewport(0, 0, plotWidth, plotHeight);
            gl.useProgram(program);
            gl.uniform1f(slicePosLoc, slicePosition);
            gl.uniform1i(sliceAxisLoc, axisInt);
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

            // Margins
            const isDark = theme.text.startsWith('#e') || theme.text.startsWith('#f');
            ctx.fillStyle = theme.surface || theme.inputBg;
            ctx.fillRect(0, 0, width, margin);
            ctx.fillRect(0, height - margin, width, margin);
            ctx.fillRect(0, 0, margin, height);
            ctx.fillRect(width - margin, 0, margin, height);

            // Border
            ctx.strokeStyle = theme.border;
            ctx.lineWidth = 1;
            ctx.strokeRect(margin, margin, plotWidth, plotHeight);

            // Atoms - show atoms near the slice plane
            if (showAtoms) {
                for (const atom of structure.atoms) {
                    const [fx, fy, fz] = atom.position;
                    // Get the coordinate along slice axis and the two perpendicular coords
                    let sliceCoord: number, coord1: number, coord2: number;
                    if (sliceAxis === 'x') {
                        sliceCoord = fx; coord1 = fy; coord2 = fz;
                    } else if (sliceAxis === 'y') {
                        sliceCoord = fy; coord1 = fx; coord2 = fz;
                    } else {
                        sliceCoord = fz; coord1 = fx; coord2 = fy;
                    }

                    // Distance from slice plane determines opacity
                    const dist = Math.abs(sliceCoord - slicePosition);
                    if (dist < 0.15) {
                        const ax = margin + coord1 * plotWidth;
                        const ay = margin + (1 - coord2) * plotHeight;
                        const opacity = 1 - dist / 0.15;
                        const radius = 12 - dist * 30; // Larger when closer to plane

                        // Element color
                        const elemColor = ELEMENT_COLORS[atom.element] || '#808080';

                        // Filled circle with element color
                        ctx.beginPath();
                        ctx.arc(ax, ay, radius, 0, 2 * Math.PI);
                        ctx.fillStyle = elemColor;
                        ctx.globalAlpha = opacity * 0.85;
                        ctx.fill();

                        // Border for contrast
                        ctx.globalAlpha = opacity;
                        ctx.strokeStyle = isDark ? '#fff' : '#000';
                        ctx.lineWidth = 2;
                        ctx.stroke();

                        // Element label
                        ctx.globalAlpha = opacity;
                        ctx.fillStyle = isDark ? '#fff' : '#000';
                        ctx.font = 'bold 11px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(atom.element, ax, ay);

                        ctx.globalAlpha = 1;
                    }
                }
            }

            // Title
            ctx.fillStyle = theme.text;
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`Electron Density (${sliceAxis} = ${slicePosition.toFixed(2)})`, 10, 15);

            // Axis labels - depend on slice axis
            const axisLabels = sliceAxis === 'x' ? ['y/b', 'z/c']
                : sliceAxis === 'y' ? ['x/a', 'z/c']
                    : ['x/a', 'y/b'];
            ctx.font = '10px sans-serif';
            ctx.fillStyle = theme.textMuted;
            ctx.textAlign = 'center';
            ctx.fillText(axisLabels[0], width / 2, height - 10);
            ctx.save();
            ctx.translate(15, height / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(axisLabels[1], 0, 0);
            ctx.restore();

            // Legend - colormap depends on display mode
            const lw = 15, lh = plotHeight * 0.6;
            const lx = width - margin + 10;
            const ly = margin + (plotHeight - lh) / 2;

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

            for (let i = 0; i < lh; i++) {
                const t = 1 - i / lh;
                const [r, g, b] = getColor(t);
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(lx, ly + i, lw, 1);
            }
            ctx.strokeStyle = theme.border;
            ctx.strokeRect(lx, ly, lw, lh);
            ctx.fillStyle = theme.textMuted;
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'left';

            if (displayMode === 'magnitude') {
                ctx.fillText('high', lx + lw + 3, ly + 8);
                ctx.fillText('low', lx + lw + 3, ly + lh);
            } else {
                ctx.fillText('+', lx + lw + 3, ly + 8);
                ctx.fillText('0', lx + lw + 3, ly + lh / 2 + 3);
                ctx.fillText('−', lx + lw + 3, ly + lh);
            }
        });

        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, [slicePosition, sliceAxis, displayMode, showAtoms, width, height, plotWidth, plotHeight, structure, reflections, theme, maxHKL]);

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
                    left: margin,
                    top: margin,
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
