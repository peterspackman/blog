import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import type { CrystalStructure, Reflection } from './physics';
import { isAllowedReflection, calculateStructureFactor, calculateReciprocalLattice, calculateDSpacing, calculateTwoTheta, CU_K_ALPHA } from './physics';
import type { ControlTheme } from '../shared/controls';
import styles from './DiffractionVisualization.module.css';

export interface ReciprocalLatticeProps {
    width: number;
    height: number;
    structure: CrystalStructure;
    reflections: Reflection[];
    zoneAxis: [number, number, number]; // Zone axis [uvw] - shows plane perpendicular to this direction
    maxIndex: number;
    showAbsences: boolean;
    selectedReflection: [number, number, number] | null;
    onSelectReflection?: (hkl: [number, number, number] | null) => void;
    theme: ControlTheme;
    viewMode?: 'reciprocal' | 'detector';
    wavelength?: number;
    detectorDistance?: number;
    twoThetaMax?: number;
    bFactor?: number;
    showIndexingCircles?: boolean; // Show indexing circles for d-spacing families
    onShowIndexingCirclesChange?: (show: boolean) => void;
}

// Vertex shader for detector pattern
const DETECTOR_VERTEX_SHADER = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_uv = (a_position + 1.0) / 2.0;
    }
`;

// Fragment shader for detector pattern - realistic detector image appearance
const DETECTOR_FRAGMENT_SHADER = `
    precision highp float;
    varying vec2 v_uv;

    uniform vec2 u_resolution;
    uniform float u_zoom;
    uniform vec2 u_pan;
    uniform int u_numSpots;
    uniform sampler2D u_spotData;
    uniform float u_dataSize;
    uniform float u_maxIntensity;
    uniform int u_isDark;
    uniform float u_beamStopRadius;
    uniform float u_powderSmear; // 0 = single crystal, 1 = full powder rings
    uniform float u_maxRadius; // Detector radius in pixels

    #define PI 3.14159265359

    // Draw a Gaussian spot, optionally smeared into an arc/ring
    float gaussianSpot(vec2 pos, vec2 center, vec2 spotCenter, float radius, float elongation, float angle, float smear) {
        float spotDistFromCenter = length(spotCenter - center);
        float posDistFromCenter = length(pos - center);

        if (smear < 0.01) {
            // Normal spot rendering - sharp Gaussian
            vec2 delta = pos - spotCenter;
            float c = cos(angle);
            float s = sin(angle);
            vec2 rotated = vec2(c * delta.x + s * delta.y, -s * delta.x + c * delta.y);
            rotated.x /= elongation;
            float dist = length(rotated);
            // Sharp falloff - spots are tight points
            return exp(-dist * dist / (radius * radius * 0.15));
        } else {
            // Smear into arc/ring - keep ring width tight
            float radialDiff = abs(posDistFromCenter - spotDistFromCenter);
            // Thin ring
            float ringWidth = radius * 0.6;
            float radialContrib = exp(-radialDiff * radialDiff / (ringWidth * ringWidth * 0.15));

            // Angular component - spot spreads around the ring
            float spotAngle = atan(spotCenter.y - center.y, spotCenter.x - center.x);
            float posAngle = atan(pos.y - center.y, pos.x - center.x);
            float angleDiff = abs(mod(posAngle - spotAngle + PI, 2.0 * PI) - PI);

            // Angular spread increases with smear
            float angularSpread = smear * PI * 0.8;
            float angularContrib;
            if (smear > 0.95) {
                // Full ring - uniform around circumference
                angularContrib = 1.0;
            } else {
                angularContrib = exp(-angleDiff * angleDiff / (angularSpread * angularSpread * 0.5));
            }

            // Scale by circumference to conserve total intensity
            // As ring spreads, intensity per unit arc decreases
            float circumScale = 1.0 / (1.0 + smear * spotDistFromCenter * 0.02);

            return radialContrib * angularContrib * circumScale;
        }
    }

    void main() {
        vec2 center = u_resolution / 2.0;

        // Apply zoom and pan
        vec2 pos = (v_uv - 0.5) * u_resolution;
        pos = pos / u_zoom + u_pan;
        pos = pos + center;

        // Distance from center
        float distFromCenter = length(pos - center);

        // Theme-aware styling
        vec3 bgColor = u_isDark == 1 ? vec3(0.12, 0.12, 0.12) : vec3(1.0, 1.0, 1.0);
        vec3 spotColor = u_isDark == 1 ? vec3(0.85, 0.9, 1.0) : vec3(0.0, 0.0, 0.0);
        vec3 borderColor = u_isDark == 1 ? vec3(0.2) : vec3(0.95);
        vec3 edgeColor = u_isDark == 1 ? vec3(0.35) : vec3(0.7);
        vec3 color = bgColor;

        // Antialiased detector boundary
        float edgeWidth = 1.5;
        float edgeSoftness = 1.0;
        float insideDetector = 1.0 - smoothstep(u_maxRadius - edgeWidth, u_maxRadius + edgeSoftness, distFromCenter);

        if (insideDetector > 0.01) {
            // Beam stop - contrasting color
            if (distFromCenter < u_beamStopRadius) {
                color = u_isDark == 1 ? vec3(0.0) : vec3(0.5);
            } else {
                // Accumulate spot contributions (counts)
                float totalCounts = 0.0;

                for (int i = 0; i < 4096; i++) {
                    if (i >= u_numSpots) break;

                    float idx = float(i * 2);
                    vec4 posData = texture2D(u_spotData, vec2((idx + 0.5) / u_dataSize, 0.5));
                    vec4 intensityData = texture2D(u_spotData, vec2((idx + 1.5) / u_dataSize, 0.5));

                    // Flip y-coordinate: spot data is in Canvas 2D coords (y-down), WebGL is y-up
                    vec2 spotCenter = center + vec2(posData.x, -posData.y);
                    float spotRadius = posData.z;
                    float elongation = posData.w;
                    float intensity = intensityData.x;
                    float angle = intensityData.y;

                    if (intensity > 0.001) {
                        float contribution = gaussianSpot(pos, center, spotCenter, spotRadius * u_zoom, elongation, angle, u_powderSmear);
                        totalCounts += contribution * intensity;
                    }
                }

                // Apply log scaling for better dynamic range
                float scaleFactor = 5.0 + u_powderSmear * 20.0;
                float logCounts = log(1.0 + totalCounts * scaleFactor) / log(1.0 + u_maxIntensity * 2.0);
                logCounts = clamp(logCounts, 0.0, 1.0);

                // Mix background with spot color based on intensity
                color = mix(bgColor, spotColor, logCounts);
            }

            // Blend with border at edge (antialiased)
            color = mix(borderColor, color, insideDetector);

            // Draw edge ring with antialiasing
            float edgeRing = smoothstep(u_maxRadius - edgeWidth - 0.5, u_maxRadius - edgeWidth + 0.5, distFromCenter) *
                            (1.0 - smoothstep(u_maxRadius - 0.5, u_maxRadius + 0.5, distFromCenter));
            color = mix(color, edgeColor, edgeRing * 0.8);
        } else {
            // Outside detector - border color
            color = borderColor;
        }

        gl_FragColor = vec4(color, 1.0);
    }
`;

interface SpotData {
    x: number;
    y: number;
    radius: number;
    elongation: number;
    intensity: number;
    angle: number;
    h: number;
    k: number;
    l: number;
    // Extra fields for powder mode
    twoTheta?: number;
    isPowderOnly?: boolean;
    baseIntensity?: number;
}

interface GLState {
    gl: WebGLRenderingContext;
    program: WebGLProgram;
    texture: WebGLTexture;
    uniforms: {
        resolution: WebGLUniformLocation | null;
        zoom: WebGLUniformLocation | null;
        pan: WebGLUniformLocation | null;
        numSpots: WebGLUniformLocation | null;
        dataSize: WebGLUniformLocation | null;
        maxIntensity: WebGLUniformLocation | null;
        isDark: WebGLUniformLocation | null;
        beamStopRadius: WebGLUniformLocation | null;
        powderSmear: WebGLUniformLocation | null;
        maxRadius: WebGLUniformLocation | null;
    };
}

export const ReciprocalLattice: React.FC<ReciprocalLatticeProps> = ({
    width,
    height,
    structure,
    reflections,
    zoneAxis,
    maxIndex,
    showAbsences,
    selectedReflection,
    onSelectReflection,
    theme,
    viewMode = 'reciprocal',
    wavelength = CU_K_ALPHA,
    detectorDistance = 100,
    twoThetaMax = 120,
    bFactor = 0,
    showIndexingCircles = false,
    onShowIndexingCirclesChange,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const glCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const glStateRef = useRef<GLState | null>(null);
    const spotsRef = useRef<SpotData[]>([]);
    const [hoveredPoint, setHoveredPoint] = useState<{ h: number; k: number; l: number; x: number; y: number } | null>(null);

    // Fixed zoom (no pan/zoom interaction)
    const zoom = 1;
    const pan = { x: 0, y: 0 };

    // Powder smear animation state
    const [powderSmear, setPowderSmear] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const animationRef = useRef<number>(0);

    const isDark = theme.text.startsWith('#e') || theme.text.startsWith('#f');

    // Zone axis [u,v,w] - reflections (h,k,l) are in the zone if h*u + k*v + l*w = 0
    // Guard against [0,0,0] which would produce NaN in projections
    const [rawU, rawV, rawW] = zoneAxis;
    const isZeroAxis = rawU === 0 && rawV === 0 && rawW === 0;
    const u = isZeroAxis ? 0 : rawU;
    const v = isZeroAxis ? 0 : rawV;
    const w = isZeroAxis ? 1 : rawW;

    // Check if a reflection is in the zone (satisfies zone law)
    const isInZone = useCallback((h: number, k: number, l: number): boolean => {
        return h * u + k * v + l * w === 0;
    }, [u, v, w]);

    // Format zone axis for display
    const zoneLabel = useMemo(() => `[${u}${v}${w}]`, [u, v, w]);

    // Compute 2D projection basis vectors for the zone axis
    // We need two orthogonal vectors perpendicular to [uvw]
    const projectionBasis = useMemo(() => {
        // Find two vectors perpendicular to [u,v,w]
        // First basis vector: cross product with a convenient vector
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

        // Second basis vector: [u,v,w] × b1
        const b2x = v * b1z - w * b1y;
        const b2y = w * b1x - u * b1z;
        const b2z = u * b1y - v * b1x;

        // Normalize b2
        const b2Len = Math.sqrt(b2x * b2x + b2y * b2y + b2z * b2z);

        return {
            b1: { x: b1x, y: b1y, z: b1z },
            b2: { x: b2x / b2Len, y: b2y / b2Len, z: b2z / b2Len }
        };
    }, [u, v, w]);

    // Project (h,k,l) to 2D coordinates using the basis vectors
    // Uses simplified orthogonal projection
    const projectToPlane = useCallback((h: number, k: number, l: number, recip: { astar: number; bstar: number; cstar: number }) => {
        // Simplified orthogonal projection
        const qx = h * recip.astar;
        const qy = k * recip.bstar;
        const qz = l * recip.cstar;

        // Project onto basis vectors
        const { b1, b2 } = projectionBasis;
        const px = qx * b1.x + qy * b1.y + qz * b1.z;
        const py = qx * b2.x + qy * b2.y + qz * b2.z;

        return { px, py };
    }, [projectionBasis]);

    // Calculate structure factor magnitude for a point
    // Build a lookup map for reflection intensities (from passed reflections which may have noise)
    // For cubic: use sorted absolute values since (h,k,l) and permutations have same intensity
    // For non-cubic: use d-spacing as key since permutations may differ
    const isCubic = structure.latticeType === 'cubic' ||
        structure.latticeType === 'fcc' ||
        structure.latticeType === 'bcc';

    const intensityMap = useMemo(() => {
        const map = new Map<string, number>();
        for (const ref of reflections) {
            let key: string;
            if (isCubic) {
                // Cubic: sorted absolute values (permutations equivalent)
                const sorted = [Math.abs(ref.h), Math.abs(ref.k), Math.abs(ref.l)].sort((a, b) => b - a);
                key = `${sorted[0]},${sorted[1]},${sorted[2]}`;
            } else {
                // Non-cubic: use d-spacing as key (5 decimal places)
                key = ref.dSpacing.toFixed(5);
            }
            if (!map.has(key)) {
                map.set(key, ref.intensity);
            }
        }
        return map;
    }, [reflections, isCubic]);

    const getIntensity = useCallback((h: number, k: number, l: number): number => {
        let key: string;
        if (isCubic) {
            const sorted = [Math.abs(h), Math.abs(k), Math.abs(l)].sort((a, b) => b - a);
            key = `${sorted[0]},${sorted[1]},${sorted[2]}`;
        } else {
            // Non-cubic: calculate d-spacing for this hkl
            const d = calculateDSpacing(h, k, l, structure);
            key = d.toFixed(5);
        }
        const found = intensityMap.get(key);
        if (found !== undefined) return found;

        // Reflection not in list (beyond twoThetaMax or filtered out) - return 0
        return 0;
    }, [intensityMap, isCubic, structure]);

    // Pre-calculate spot data for detector mode
    // Uses linear-in-2θ mapping: r_pixel = (2θ / twoThetaMax) * maxRadius
    // The circle always represents twoThetaMax. Changing it reveals/hides
    // spots near the edge without repositioning existing spots significantly.
    const spotData = useMemo(() => {
        if (viewMode !== 'detector') return [];

        const spots: SpotData[] = [];
        const kWave = 1 / wavelength;
        const plotSize = Math.min(width, height) - 80;
        const maxRadius = plotSize / 2;
        const recip = calculateReciprocalLattice(structure);

        const twoThetaMaxRad = (twoThetaMax * Math.PI) / 180;

        for (let h = -maxIndex; h <= maxIndex; h++) {
            for (let k_idx = -maxIndex; k_idx <= maxIndex; k_idx++) {
                for (let l = -maxIndex; l <= maxIndex; l++) {
                    if (h === 0 && k_idx === 0 && l === 0) continue;

                    const absH = Math.abs(h);
                    const absK = Math.abs(k_idx);
                    const absL = Math.abs(l);

                    const isAllowed = isAllowedReflection(absH, absK, absL, structure);
                    if (!isAllowed) continue;

                    const qx = h * recip.astar;
                    const qy = k_idx * recip.bstar;
                    const qz = l * recip.cstar;
                    const qMag = Math.sqrt(qx * qx + qy * qy + qz * qz);

                    if (qMag === 0) continue;
                    const d = 1 / qMag;
                    const sinTheta = wavelength / (2 * d);

                    if (Math.abs(sinTheta) > 1) continue;

                    const theta = Math.asin(sinTheta);
                    const twoTheta = 2 * theta;

                    const twoThetaDeg = (twoTheta * 180) / Math.PI;
                    if (twoThetaDeg > twoThetaMax) continue;

                    // For single crystal mode: check zone and Ewald sphere
                    // For powder mode (powderSmear > 0): include all reflections
                    const inZone = isInZone(h, k_idx, l);

                    // Project to 2D for azimuthal angle
                    const { px, py } = projectToPlane(h, k_idx, l, recip);

                    // Ewald sphere check (only for single crystal)
                    // Fixed tolerance ~5° oscillation equivalent
                    const qIn2D = Math.sqrt(px * px + py * py);
                    const ewaldRadius = 2 * kWave * Math.sin(theta);
                    const tolerance = (5 * Math.PI / 180) * kWave * 2;
                    const onEwald = Math.abs(qIn2D - ewaldRadius) < tolerance;

                    // Skip if not visible in single crystal mode
                    // But include all for powder mode (we mark isPowderOnly)
                    const visibleInSingleCrystal = inZone && onEwald;

                    // Linear-in-2θ mapping: radius proportional to scattering angle
                    const detectorR = (twoTheta / twoThetaMaxRad) * maxRadius;

                    // Azimuthal angle from the 2D projection
                    const phi = Math.atan2(py, px);

                    const detectorX = detectorR * Math.cos(phi);
                    const detectorY = -detectorR * Math.sin(phi);

                    const intensity = getIntensity(h, k_idx, l);

                    // Spot size scales with detector distance (closer = larger spots)
                    const baseRadius = 2.5 * (100 / detectorDistance);
                    // Mild elongation at high angles (physical effect of oblique incidence)
                    const tanTwoTheta = Math.tan(twoTheta);
                    const radialStretch = 1 + tanTwoTheta * tanTwoTheta * 0.15;
                    const elongation = Math.min(2.5, radialStretch);

                    spots.push({
                        x: detectorX,
                        y: detectorY,
                        radius: baseRadius,
                        elongation,
                        intensity: visibleInSingleCrystal ? intensity : 0,
                        angle: phi,
                        h,
                        k: k_idx,
                        l,
                        twoTheta,
                        isPowderOnly: !visibleInSingleCrystal,
                        baseIntensity: intensity,
                    });
                }
            }
        }

        return spots;
    }, [viewMode, wavelength, structure, maxIndex, isInZone, projectToPlane, getIntensity, detectorDistance, width, height, twoThetaMax]);

    // Initialize WebGL for detector mode
    useEffect(() => {
        if (viewMode !== 'detector') return;

        const canvas = glCanvasRef.current;
        if (!canvas) return;

        const gl = canvas.getContext('webgl');
        if (!gl) return;

        // Create shaders
        const vs = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(vs, DETECTOR_VERTEX_SHADER);
        gl.compileShader(vs);

        const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fs, DETECTOR_FRAGMENT_SHADER);
        gl.compileShader(fs);

        const program = gl.createProgram()!;
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        // Vertex buffer
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
        const posLoc = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        // Texture for spot data
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
            uniforms: {
                resolution: gl.getUniformLocation(program, 'u_resolution'),
                zoom: gl.getUniformLocation(program, 'u_zoom'),
                pan: gl.getUniformLocation(program, 'u_pan'),
                numSpots: gl.getUniformLocation(program, 'u_numSpots'),
                dataSize: gl.getUniformLocation(program, 'u_dataSize'),
                maxIntensity: gl.getUniformLocation(program, 'u_maxIntensity'),
                isDark: gl.getUniformLocation(program, 'u_isDark'),
                beamStopRadius: gl.getUniformLocation(program, 'u_beamStopRadius'),
                powderSmear: gl.getUniformLocation(program, 'u_powderSmear'),
                maxRadius: gl.getUniformLocation(program, 'u_maxRadius'),
            },
        };

        return () => {
            gl.deleteProgram(program);
            gl.deleteTexture(texture);
            glStateRef.current = null;
        };
    }, [viewMode]);

    // Update texture when spots change or powder smear changes
    useEffect(() => {
        if (viewMode !== 'detector') return;
        const state = glStateRef.current;
        if (!state) return;

        const { gl, texture } = state;
        const dataSize = Math.max(4, spotData.length * 2);
        const textureData = new Float32Array(dataSize * 4);

        // For powder mode, interpolate between single crystal and powder intensities
        // Single crystal: only show spots visible in current zone/Ewald
        // Powder: show all reflections with their true intensities (will be smeared to rings)
        let maxIntensity = 1;
        for (const spot of spotData) {
            // Effective intensity depends on powder smear level
            const singleCrystalIntensity = spot.isPowderOnly ? 0 : (spot.baseIntensity ?? spot.intensity);
            const powderIntensity = spot.baseIntensity ?? spot.intensity;
            const effectiveIntensity = singleCrystalIntensity + powderSmear * (powderIntensity - singleCrystalIntensity);
            maxIntensity = Math.max(maxIntensity, effectiveIntensity);
        }

        for (let i = 0; i < spotData.length; i++) {
            const spot = spotData[i];
            const idx = i * 8;

            // Calculate effective intensity based on powder smear
            const singleCrystalIntensity = spot.isPowderOnly ? 0 : (spot.baseIntensity ?? spot.intensity);
            const powderIntensity = spot.baseIntensity ?? spot.intensity;
            const effectiveIntensity = singleCrystalIntensity + powderSmear * (powderIntensity - singleCrystalIntensity);

            // Position data
            textureData[idx] = spot.x;
            textureData[idx + 1] = spot.y;
            textureData[idx + 2] = spot.radius;
            textureData[idx + 3] = spot.elongation;
            // Intensity data
            textureData[idx + 4] = effectiveIntensity;
            textureData[idx + 5] = spot.angle;
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        const ext = gl.getExtension('OES_texture_float');
        if (ext) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, dataSize, 1, 0, gl.RGBA, gl.FLOAT, textureData);
        }

        spotsRef.current = spotData;
    }, [spotData, viewMode, powderSmear]);

    // Render detector pattern
    useEffect(() => {
        if (viewMode !== 'detector') return;

        const state = glStateRef.current;
        const canvas = glCanvasRef.current;
        const overlayCanvas = overlayCanvasRef.current;
        if (!state || !canvas || !overlayCanvas) return;

        const { gl, program, texture, uniforms } = state;

        // Resize canvas if needed
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }

        // Calculate max intensity considering powder smear
        let maxIntensity = 1;
        for (const spot of spotData) {
            const singleCrystalIntensity = spot.isPowderOnly ? 0 : (spot.baseIntensity ?? spot.intensity);
            const powderIntensity = spot.baseIntensity ?? spot.intensity;
            const effectiveIntensity = singleCrystalIntensity + powderSmear * (powderIntensity - singleCrystalIntensity);
            maxIntensity = Math.max(maxIntensity, effectiveIntensity);
        }

        // Calculate detector radius (must match spot positioning)
        const detectorPlotSize = Math.min(width, height) - 80;
        const detectorRadius = detectorPlotSize / 2;

        // WebGL render
        gl.viewport(0, 0, width, height);
        gl.useProgram(program);
        gl.uniform2f(uniforms.resolution, width, height);
        gl.uniform1f(uniforms.zoom, zoom);
        gl.uniform2f(uniforms.pan, pan.x, pan.y);
        gl.uniform1i(uniforms.numSpots, spotData.length);
        gl.uniform1f(uniforms.dataSize, Math.max(4, spotData.length * 2));
        gl.uniform1f(uniforms.maxIntensity, maxIntensity * 0.3);
        gl.uniform1i(uniforms.isDark, isDark ? 1 : 0);
        gl.uniform1f(uniforms.beamStopRadius, 0); // Disabled beam stop
        gl.uniform1f(uniforms.powderSmear, powderSmear);
        gl.uniform1f(uniforms.maxRadius, detectorRadius * zoom);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Draw overlay (labels, selected spot)
        const ctx = overlayCanvas.getContext('2d');
        if (!ctx) return;

        if (overlayCanvas.width !== width || overlayCanvas.height !== height) {
            overlayCanvas.width = width;
            overlayCanvas.height = height;
        }

        ctx.clearRect(0, 0, width, height);

        const centerX = width / 2;
        const centerY = height / 2;
        const plotSize = Math.min(width, height) - 80;
        const maxRadius = plotSize / 2;

        // Detector edge label — circle edge = twoThetaMax
        ctx.fillStyle = theme.textMuted;
        ctx.font = '9px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`2θ_max=${twoThetaMax}°`, centerX, centerY - maxRadius * zoom + 12);

        // Title
        ctx.fillStyle = theme.text;
        ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'left';
        const modeText = powderSmear > 0.5 ? 'Powder' : `Zone ${zoneLabel}`;
        ctx.fillText(`${modeText}`, 10, 15);

        // Info
        ctx.font = '10px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = theme.textMuted;
        ctx.textAlign = 'right';
        const spotCountText = spotData.length > 4000 ? `⚠️ ${spotData.length}` : `${spotData.length}`;
        ctx.fillText(`λ=${wavelength.toFixed(3)}Å | ${spotCountText} spots`, width - 10, height - 10);

        // Draw indexing circles for d-spacing families
        if (showIndexingCircles && powderSmear < 0.5) {
            const twoThetaMaxRad = (twoThetaMax * Math.PI) / 180;

            // Group spots by d-spacing to draw indexing circles
            // Use 2θ as proxy (spots at same 2θ have same d-spacing)
            const visibleSpots = spotData.filter(s => s.intensity > 0.01 && s.twoTheta !== undefined);
            const dSpacingGroups = new Map<string, { twoTheta: number; radius: number; hkl: string; count: number }>();

            for (const spot of visibleSpots) {
                if (spot.twoTheta === undefined) continue;
                // Round 2θ to group equivalent reflections (0.1° tolerance)
                const twoThetaKey = (Math.round(spot.twoTheta * 180 / Math.PI * 10) / 10).toFixed(1);

                if (!dSpacingGroups.has(twoThetaKey)) {
                    // Linear mapping matches spot positioning
                    const circleRadius = (spot.twoTheta / twoThetaMaxRad) * maxRadius * zoom;
                    // Use absolute values for hkl label
                    const h = Math.abs(spot.h), k = Math.abs(spot.k), l = Math.abs(spot.l);
                    // Sort to get canonical form {hkl}
                    const sorted = [h, k, l].sort((a, b) => b - a);
                    dSpacingGroups.set(twoThetaKey, {
                        twoTheta: spot.twoTheta,
                        radius: circleRadius,
                        hkl: `{${sorted[0]}${sorted[1]}${sorted[2]}}`,
                        count: 1
                    });
                } else {
                    dSpacingGroups.get(twoThetaKey)!.count++;
                }
            }

            // Draw indexing circles for each d-spacing family
            ctx.lineWidth = 1.5;
            const colors = [
                'rgba(220, 60, 60, 0.6)',   // red
                'rgba(60, 140, 60, 0.6)',   // green
                'rgba(60, 60, 200, 0.6)',   // blue
                'rgba(180, 120, 40, 0.6)',  // orange
                'rgba(120, 60, 180, 0.6)',  // purple
                'rgba(60, 160, 160, 0.6)',  // teal
            ];

            let colorIdx = 0;
            const sortedGroups = Array.from(dSpacingGroups.values()).sort((a, b) => a.radius - b.radius);

            for (const group of sortedGroups) {
                if (group.radius > 5 && group.radius < maxRadius * zoom * 1.2) {
                    const color = colors[colorIdx % colors.length];
                    ctx.strokeStyle = color;
                    ctx.setLineDash([]);

                    ctx.beginPath();
                    ctx.arc(centerX - pan.x * zoom, centerY + pan.y * zoom, group.radius, 0, 2 * Math.PI);
                    ctx.stroke();

                    // Label with {hkl}
                    ctx.fillStyle = color;
                    ctx.font = 'bold 9px "Segoe UI", system-ui, sans-serif';
                    ctx.textAlign = 'left';
                    // Position label at different angles to avoid overlap
                    const labelAngle = -Math.PI / 4 + (colorIdx * 0.3);
                    const labelX = centerX - pan.x * zoom + group.radius * Math.cos(labelAngle) + 3;
                    const labelY = centerY + pan.y * zoom + group.radius * Math.sin(labelAngle) - 3;
                    ctx.fillText(group.hkl, labelX, labelY);

                    colorIdx++;
                }
            }

        }

        // Draw selected spot highlight
        if (selectedReflection) {
            const spot = spotData.find(s =>
                s.h === selectedReflection[0] &&
                s.k === selectedReflection[1] &&
                s.l === selectedReflection[2]
            );
            if (spot) {
                const pixelX = centerX + (spot.x - pan.x) * zoom;
                const pixelY = centerY + (spot.y - pan.y) * zoom;

                ctx.strokeStyle = '#e67700';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(pixelX, pixelY, spot.radius * zoom + 6, 0, 2 * Math.PI);
                ctx.stroke();

                // Label
                ctx.fillStyle = '#e67700';
                ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(`(${spot.h},${spot.k},${spot.l})`, pixelX + spot.radius * zoom + 8, pixelY + 4);
            }
        }

    }, [viewMode, spotData, zoom, pan, width, height, isDark, theme, selectedReflection, wavelength, zoneLabel, powderSmear, twoThetaMax, detectorDistance, showIndexingCircles]);

    // Draw reciprocal lattice (Canvas 2D mode) - zone axis aware
    useEffect(() => {
        if (viewMode !== 'reciprocal') return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const margin = 40;
        const plotSize = Math.min(width, height) - 2 * margin;
        const centerX = width / 2;
        const centerY = height / 2;

        // Calculate reciprocal lattice parameters
        const recip = calculateReciprocalLattice(structure);

        // Collect all reflections in the zone and compute their 2D positions
        interface PlotPoint {
            h: number; k: number; l: number;
            px: number; py: number;
        }
        const points: PlotPoint[] = [];

        for (let h = -maxIndex; h <= maxIndex; h++) {
            for (let k = -maxIndex; k <= maxIndex; k++) {
                for (let l = -maxIndex; l <= maxIndex; l++) {
                    if (!isInZone(h, k, l)) continue;

                    const { px, py } = projectToPlane(h, k, l, recip);
                    points.push({ h, k, l, px, py });
                }
            }
        }

        // Calculate bounding box for scaling
        let minX = 0, maxX = 0, minY = 0, maxY = 0;
        for (const pt of points) {
            minX = Math.min(minX, pt.px);
            maxX = Math.max(maxX, pt.px);
            minY = Math.min(minY, pt.py);
            maxY = Math.max(maxY, pt.py);
        }
        const extentX = maxX - minX || 1;
        const extentY = maxY - minY || 1;
        const scale = plotSize / Math.max(extentX, extentY) * 0.85;

        // Clear canvas
        ctx.fillStyle = theme.surface || theme.inputBg;
        ctx.fillRect(0, 0, width, height);

        // Draw simple axes through origin
        ctx.strokeStyle = theme.textMuted;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(margin, centerY);
        ctx.lineTo(width - margin, centerY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(centerX, margin);
        ctx.lineTo(centerX, height - margin);
        ctx.stroke();
        ctx.setLineDash([]);

        // Calculate the maximum Q value for the 2θ limit
        // Q_max = 2 * sin(θ_max) / λ = 1 / d_min
        const thetaMaxRad = (twoThetaMax / 2) * Math.PI / 180;
        const qMax = 2 * Math.sin(thetaMaxRad) / wavelength;

        // Draw limiting circle for 2θ max
        // We need to find the radius in projected coordinates
        // The radius in reciprocal space is qMax, we need to project it
        // For simplicity, use the maximum extent to estimate the circle radius
        const qMaxRadius = qMax * scale;
        if (qMaxRadius > 10 && qMaxRadius < plotSize) {
            ctx.strokeStyle = isDark ? 'rgba(255, 180, 100, 0.5)' : 'rgba(200, 100, 50, 0.5)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.arc(centerX, centerY, qMaxRadius, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.setLineDash([]);

            // Label for 2θ max circle
            ctx.font = '9px "Segoe UI", system-ui, sans-serif';
            ctx.fillStyle = isDark ? 'rgba(255, 180, 100, 0.8)' : 'rgba(180, 80, 30, 0.8)';
            ctx.textAlign = 'left';
            ctx.fillText(`2θ=${twoThetaMax}°`, centerX + qMaxRadius * 0.7 + 5, centerY - qMaxRadius * 0.7);
        }

        // Find max intensity for scaling (only for points within 2θ limit)
        let maxIntensity = 1;
        for (const pt of points) {
            if (pt.h === 0 && pt.k === 0 && pt.l === 0) continue;
            if (isAllowedReflection(Math.abs(pt.h), Math.abs(pt.k), Math.abs(pt.l), structure)) {
                // Check if within 2θ limit
                const d = calculateDSpacing(pt.h, pt.k, pt.l, structure);
                const twoTheta = calculateTwoTheta(d, wavelength);
                if (!isNaN(twoTheta) && twoTheta <= twoThetaMax) {
                    const intensity = getIntensity(pt.h, pt.k, pt.l);
                    maxIntensity = Math.max(maxIntensity, intensity);
                }
            }
        }

        // Draw reciprocal lattice points
        for (const pt of points) {
            const x = centerX + pt.px * scale;
            const y = centerY - pt.py * scale;

            const absH = Math.abs(pt.h);
            const absK = Math.abs(pt.k);
            const absL = Math.abs(pt.l);

            const isOrigin = pt.h === 0 && pt.k === 0 && pt.l === 0;
            const isAllowed = isAllowedReflection(absH, absK, absL, structure);
            const isSelected =
                selectedReflection &&
                pt.h === selectedReflection[0] &&
                pt.k === selectedReflection[1] &&
                pt.l === selectedReflection[2];

            // Check 2θ limit for non-origin points
            let withinTwoThetaLimit = true;
            if (!isOrigin) {
                const d = calculateDSpacing(pt.h, pt.k, pt.l, structure);
                const twoTheta = calculateTwoTheta(d, wavelength);
                withinTwoThetaLimit = !isNaN(twoTheta) && twoTheta <= twoThetaMax;
            }

            if (isOrigin) {
                ctx.fillStyle = isDark ? '#888' : '#666';
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, 2 * Math.PI);
                ctx.fill();
            } else if (isAllowed && withinTwoThetaLimit) {
                const intensity = getIntensity(pt.h, pt.k, pt.l);
                const normalizedIntensity = intensity / maxIntensity;
                // Use both size and opacity for intensity visualization
                // Size varies from 4 to 10 based on intensity
                const radius = 4 + normalizedIntensity * 6;
                // Opacity varies from 0.3 to 1.0 based on intensity
                const opacity = 0.3 + normalizedIntensity * 0.7;

                if (isSelected) {
                    ctx.strokeStyle = isDark ? '#fbbf24' : '#d97706';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(x, y, radius + 3, 0, 2 * Math.PI);
                    ctx.stroke();
                }

                // Use rgba for intensity-based darkness
                ctx.fillStyle = isDark
                    ? `rgba(107, 158, 255, ${opacity})`
                    : `rgba(37, 99, 235, ${opacity})`;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, 2 * Math.PI);
                ctx.fill();
            } else if (isAllowed && !withinTwoThetaLimit) {
                // Beyond 2θ limit - show as faded
                ctx.fillStyle = isDark ? 'rgba(107, 158, 255, 0.2)' : 'rgba(37, 99, 235, 0.2)';
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, 2 * Math.PI);
                ctx.fill();
            } else if (showAbsences && withinTwoThetaLimit) {
                ctx.fillStyle = isDark ? 'rgba(180, 180, 180, 0.25)' : 'rgba(100, 100, 100, 0.25)';
                ctx.beginPath();
                ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
                ctx.fill();
            }
        }

        // Info text
        ctx.font = '10px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = theme.textMuted;
        ctx.textAlign = 'right';
        ctx.fillText(`${points.length} reflections`, width - 10, height - 10);

        // Hover tooltip
        if (hoveredPoint) {
            const hp = hoveredPoint;
            const d = calculateDSpacing(hp.h, hp.k, hp.l, structure);
            const twoTheta = calculateTwoTheta(d, wavelength);
            const intensity = getIntensity(hp.h, hp.k, hp.l);
            const label = `(${hp.h} ${hp.k} ${hp.l})`;
            const dLabel = isFinite(d) ? `d=${d.toFixed(3)}Å` : '';
            const twoThetaLabel = !isNaN(twoTheta) ? `2θ=${twoTheta.toFixed(1)}°` : '';
            const iLabel = intensity > 0 ? `I=${intensity.toFixed(1)}` : '';
            const lines = [label, dLabel, twoThetaLabel, iLabel].filter(Boolean);

            ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
            const maxLineWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
            const padX = 6, padY = 4;
            const lineHeight = 14;
            const tooltipW = maxLineWidth + 2 * padX;
            const tooltipH = lines.length * lineHeight + 2 * padY;

            // Position tooltip above and to the right of the point
            let tx = hp.x + 12;
            let ty = hp.y - tooltipH - 4;
            // Keep tooltip within canvas bounds
            if (tx + tooltipW > width) tx = hp.x - tooltipW - 12;
            if (ty < 0) ty = hp.y + 12;

            ctx.fillStyle = isDark ? 'rgba(50, 50, 50, 0.92)' : 'rgba(255, 255, 255, 0.92)';
            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(tx, ty, tooltipW, tooltipH, 4);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = theme.text;
            ctx.textAlign = 'left';
            for (let i = 0; i < lines.length; i++) {
                ctx.font = i === 0 ? 'bold 10px "Segoe UI", system-ui, sans-serif' : '10px "Segoe UI", system-ui, sans-serif';
                ctx.fillText(lines[i], tx + padX, ty + padY + (i + 1) * lineHeight - 3);
            }
        }
    }, [
        viewMode,
        width,
        height,
        structure,
        reflections,
        zoneAxis,
        maxIndex,
        showAbsences,
        selectedReflection,
        theme,
        isDark,
        isInZone,
        projectToPlane,
        getIntensity,
        twoThetaMax,
        wavelength,
        hoveredPoint,
    ]);

    // Handle mouse move for hover tooltip (reciprocal view only)
    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            if (viewMode !== 'reciprocal') return;

            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const mouseX = (e.clientX - rect.left) * scaleX;
            const mouseY = (e.clientY - rect.top) * scaleY;

            const centerX = width / 2;
            const centerY = height / 2;
            const margin = 40;
            const plotSize = Math.min(width, height) - 2 * margin;
            const recip = calculateReciprocalLattice(structure);

            // Build points and compute scale (same as render)
            let minPx = 0, maxPx = 0, minPy = 0, maxPy = 0;
            const zonePoints: { h: number; k: number; l: number; px: number; py: number }[] = [];
            for (let h = -maxIndex; h <= maxIndex; h++) {
                for (let k = -maxIndex; k <= maxIndex; k++) {
                    for (let l = -maxIndex; l <= maxIndex; l++) {
                        if (!isInZone(h, k, l)) continue;
                        if (h === 0 && k === 0 && l === 0) continue;
                        if (!isAllowedReflection(Math.abs(h), Math.abs(k), Math.abs(l), structure)) continue;
                        const { px, py } = projectToPlane(h, k, l, recip);
                        minPx = Math.min(minPx, px); maxPx = Math.max(maxPx, px);
                        minPy = Math.min(minPy, py); maxPy = Math.max(maxPy, py);
                        zonePoints.push({ h, k, l, px, py });
                    }
                }
            }

            const extentX = maxPx - minPx || 1;
            const extentY = maxPy - minPy || 1;
            const scale = plotSize / Math.max(extentX, extentY) * 0.85;

            let closestDist = Infinity;
            let closest: { h: number; k: number; l: number; x: number; y: number } | null = null;
            for (const pt of zonePoints) {
                const x = centerX + pt.px * scale;
                const y = centerY - pt.py * scale;
                const dist = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);
                if (dist < closestDist && dist < 20) {
                    closestDist = dist;
                    closest = { h: pt.h, k: pt.k, l: pt.l, x, y };
                }
            }

            setHoveredPoint(closest);
        },
        [viewMode, width, height, maxIndex, structure, isInZone, projectToPlane]
    );

    const handleMouseLeave = useCallback(() => {
        setHoveredPoint(null);
    }, []);

    // Handle click for selection
    const handleClick = useCallback(
        (e: React.MouseEvent) => {
            if (!onSelectReflection) return;

            const canvas = viewMode === 'detector' ? glCanvasRef.current : canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const clickX = (e.clientX - rect.left) * scaleX;
            const clickY = (e.clientY - rect.top) * scaleY;

            const centerX = width / 2;
            const centerY = height / 2;

            if (viewMode === 'detector') {
                // Transform click position back to spot coordinates
                const spotX = (clickX - centerX) / zoom + pan.x;
                const spotY = (clickY - centerY) / zoom + pan.y;

                let closestDist = Infinity;
                let closestSpot: SpotData | null = null;

                for (const spot of spotsRef.current) {
                    const dist = Math.sqrt((spotX - spot.x) ** 2 + (spotY - spot.y) ** 2);
                    if (dist < closestDist && dist < 20 / zoom) {
                        closestDist = dist;
                        closestSpot = spot;
                    }
                }

                if (closestSpot) {
                    onSelectReflection([closestSpot.h, closestSpot.k, closestSpot.l]);
                }
            } else {
                // For reciprocal view, find the closest point in the zone
                const margin = 40;
                const plotSize = Math.min(width, height) - 2 * margin;
                const recip = calculateReciprocalLattice(structure);

                // Build list of points in zone
                const zonePoints: { h: number; k: number; l: number; px: number; py: number }[] = [];
                let minPx = 0, maxPx = 0, minPy = 0, maxPy = 0;
                for (let h = -maxIndex; h <= maxIndex; h++) {
                    for (let k = -maxIndex; k <= maxIndex; k++) {
                        for (let l = -maxIndex; l <= maxIndex; l++) {
                            if (!isInZone(h, k, l)) continue;
                            const { px, py } = projectToPlane(h, k, l, recip);
                            minPx = Math.min(minPx, px);
                            maxPx = Math.max(maxPx, px);
                            minPy = Math.min(minPy, py);
                            maxPy = Math.max(maxPy, py);
                            zonePoints.push({ h, k, l, px, py });
                        }
                    }
                }

                const extentX = maxPx - minPx || 1;
                const extentY = maxPy - minPy || 1;
                const scale = plotSize / Math.max(extentX, extentY) * 0.85;

                // Find closest point to click
                let closestDist = Infinity;
                let closestPoint: { h: number; k: number; l: number } | null = null;
                for (const pt of zonePoints) {
                    if (pt.h === 0 && pt.k === 0 && pt.l === 0) continue;
                    const x = centerX + pt.px * scale;
                    const y = centerY - pt.py * scale;
                    const dist = Math.sqrt((clickX - x) ** 2 + (clickY - y) ** 2);
                    if (dist < closestDist && dist < 20) {
                        closestDist = dist;
                        closestPoint = { h: pt.h, k: pt.k, l: pt.l };
                    }
                }

                if (closestPoint && isAllowedReflection(Math.abs(closestPoint.h), Math.abs(closestPoint.k), Math.abs(closestPoint.l), structure)) {
                    onSelectReflection([closestPoint.h, closestPoint.k, closestPoint.l]);
                }
            }
        },
        [width, height, maxIndex, structure, onSelectReflection, viewMode, zoom, pan, isInZone, projectToPlane]
    );

    // Reset powder state when switching modes or structure changes
    useEffect(() => {
        setPowderSmear(0);
        setIsAnimating(false);
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }
    }, [viewMode, structure]);

    // Animation effect for powder smearing
    useEffect(() => {
        if (!isAnimating) {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            return;
        }

        let startTime: number | null = null;
        const duration = 3000; // 3 seconds to full powder

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease-out curve for smooth animation
            const eased = 1 - Math.pow(1 - progress, 3);
            setPowderSmear(eased);

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate);
            } else {
                setIsAnimating(false);
            }
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isAnimating]);

    // Toggle powder animation
    const handlePowderToggle = useCallback(() => {
        if (powderSmear > 0.5) {
            // Reset to single crystal
            setPowderSmear(0);
            setIsAnimating(false);
        } else {
            // Start animation to powder
            setIsAnimating(true);
        }
    }, [powderSmear]);

    if (viewMode === 'detector') {
        return (
            <div
                style={{
                    position: 'relative',
                    width,
                    height,
                    borderRadius: '4px',
                    border: `1px solid ${theme.border}`,
                    overflow: 'hidden',
                }}
                onClick={handleClick}
            >
                <canvas
                    ref={glCanvasRef}
                    width={width}
                    height={height}
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                    }}
                />
                <canvas
                    ref={overlayCanvasRef}
                    width={width}
                    height={height}
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        pointerEvents: 'none',
                    }}
                />
                {/* Inline controls */}
                <div className={styles.detectorOverlayControls}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onShowIndexingCirclesChange?.(!showIndexingCircles);
                        }}
                        className={`${styles.detectorOverlayButton} ${showIndexingCircles ? styles.detectorOverlayButtonActive : ''}`}
                        title="Toggle indexing circles"
                    >
                        Index
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handlePowderToggle();
                        }}
                        className={`${styles.detectorOverlayButton} ${powderSmear > 0.5 ? styles.detectorOverlayButtonActive : ''}`}
                        title={powderSmear > 0.5 ? 'Reset to single crystal' : 'Animate to powder pattern'}
                    >
                        {isAnimating ? '...' : (powderSmear > 0.5 ? 'Crystal' : 'Powder')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            onClick={handleClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                cursor: 'pointer',
                borderRadius: '4px',
                border: `1px solid ${theme.border}`,
            }}
        />
    );
};

export default ReciprocalLattice;
