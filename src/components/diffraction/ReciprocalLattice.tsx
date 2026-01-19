import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import type { CrystalStructure, Reflection } from './physics';
import { isAllowedReflection, calculateStructureFactor, CU_K_ALPHA } from './physics';
import type { ControlTheme } from '../shared/controls';

export interface ReciprocalLatticeProps {
    width: number;
    height: number;
    structure: CrystalStructure;
    reflections: Reflection[];
    plane: 'hk0' | 'h0l' | '0kl';
    maxIndex: number;
    showAbsences: boolean;
    selectedReflection: [number, number, number] | null;
    onSelectReflection?: (hkl: [number, number, number] | null) => void;
    theme: ControlTheme;
    viewMode?: 'reciprocal' | 'detector';
    wavelength?: number;
    detectorDistance?: number;
    oscillationRange?: number;
    twoThetaMax?: number;
    bFactor?: number;
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
        float maxRadius = min(u_resolution.x, u_resolution.y) * 0.45;

        // Theme-aware colors: light mode = white bg, black spots; dark mode = black bg, white spots
        vec3 bgColor = u_isDark == 1 ? vec3(0.02, 0.02, 0.04) : vec3(0.98, 0.98, 0.97);
        vec3 spotColor = u_isDark == 1 ? vec3(1.0, 1.0, 1.0) : vec3(0.0, 0.0, 0.0);
        vec3 borderColor = u_isDark == 1 ? vec3(0.15) : vec3(0.85);
        vec3 edgeColor = u_isDark == 1 ? vec3(0.3) : vec3(0.7);
        vec3 color = bgColor;

        // Only render within detector circle
        if (distFromCenter < maxRadius) {
            // Beam stop - contrasting color
            if (distFromCenter < u_beamStopRadius) {
                color = u_isDark == 1 ? vec3(0.0) : vec3(0.5);
            } else {
                // Accumulate spot contributions (counts)
                float totalCounts = 0.0;

                for (int i = 0; i < 1000; i++) {
                    if (i >= u_numSpots) break;

                    float idx = float(i * 2);
                    vec4 posData = texture2D(u_spotData, vec2((idx + 0.5) / u_dataSize, 0.5));
                    vec4 intensityData = texture2D(u_spotData, vec2((idx + 1.5) / u_dataSize, 0.5));

                    vec2 spotCenter = center + posData.xy;
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

                // Add slight noise for realism (detector noise)
                float noise = fract(sin(dot(pos, vec2(12.9898, 78.233))) * 43758.5453);
                float noiseAmount = u_isDark == 1 ? 0.015 : -0.01;
                color += vec3(noise * noiseAmount);
            }
        } else {
            // Outside detector - border color
            color = borderColor;
        }

        // Detector edge highlight
        float edgeDist = abs(distFromCenter - maxRadius);
        if (edgeDist < 2.0) {
            color = edgeColor;
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
    };
}

export const ReciprocalLattice: React.FC<ReciprocalLatticeProps> = ({
    width,
    height,
    structure,
    reflections,
    plane,
    maxIndex,
    showAbsences,
    selectedReflection,
    onSelectReflection,
    theme,
    viewMode = 'reciprocal',
    wavelength = CU_K_ALPHA,
    detectorDistance = 100,
    oscillationRange = 2,
    twoThetaMax = 120,
    bFactor = 0,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const glCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const glStateRef = useRef<GLState | null>(null);
    const spotsRef = useRef<SpotData[]>([]);

    // Zoom and pan state
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const lastMouse = useRef({ x: 0, y: 0 });

    // Powder smear animation state
    const [powderSmear, setPowderSmear] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const animationRef = useRef<number>(0);

    const isDark = theme.text.startsWith('#e') || theme.text.startsWith('#f');

    // Get axis labels and indices based on plane selection
    const getPlaneInfo = useCallback(() => {
        switch (plane) {
            case 'hk0':
                return { xLabel: 'h', yLabel: 'k', fixedIndex: 2, fixedLabel: 'l=0' };
            case 'h0l':
                return { xLabel: 'h', yLabel: 'l', fixedIndex: 1, fixedLabel: 'k=0' };
            case '0kl':
                return { xLabel: 'k', yLabel: 'l', fixedIndex: 0, fixedLabel: 'h=0' };
        }
    }, [plane]);

    // Get hkl from x,y coordinates based on plane
    const getHKL = useCallback((x: number, y: number): [number, number, number] => {
        switch (plane) {
            case 'hk0':
                return [x, y, 0];
            case 'h0l':
                return [x, 0, y];
            case '0kl':
                return [0, x, y];
        }
    }, [plane]);

    // Calculate structure factor magnitude for a point
    // Build a lookup map for reflection intensities (from passed reflections which may have noise)
    // Store by sorted absolute values since (h,k,l) and permutations have same intensity
    const intensityMap = useMemo(() => {
        const map = new Map<string, number>();
        for (const ref of reflections) {
            // Use canonical key: sorted absolute values (since cubic symmetry)
            const sorted = [Math.abs(ref.h), Math.abs(ref.k), Math.abs(ref.l)].sort((a, b) => b - a);
            const key = `${sorted[0]},${sorted[1]},${sorted[2]}`;
            // Only store if not already present (first one wins)
            if (!map.has(key)) {
                map.set(key, ref.intensity);
            }
        }
        return map;
    }, [reflections]);

    const getIntensity = useCallback((h: number, k: number, l: number): number => {
        // Look up from passed reflections using canonical key
        const sorted = [Math.abs(h), Math.abs(k), Math.abs(l)].sort((a, b) => b - a);
        const key = `${sorted[0]},${sorted[1]},${sorted[2]}`;
        const found = intensityMap.get(key);
        if (found !== undefined) return found;

        // Reflection not in list (beyond twoThetaMax or filtered out) - return 0
        return 0;
    }, [intensityMap]);

    // Pre-calculate spot data for detector mode
    const spotData = useMemo(() => {
        if (viewMode !== 'detector') return [];

        const spots: SpotData[] = [];
        const k = 1 / wavelength;
        const astar = 1 / structure.a;
        const oscRad = (oscillationRange * Math.PI) / 180;
        const plotSize = Math.min(width, height) - 80;
        const maxRadius = plotSize / 2;

        for (let i = -maxIndex; i <= maxIndex; i++) {
            for (let j = -maxIndex; j <= maxIndex; j++) {
                if (i === 0 && j === 0) continue;

                const [h, k_idx, l] = getHKL(i, j);
                const absH = Math.abs(h);
                const absK = Math.abs(k_idx);
                const absL = Math.abs(l);

                const isAllowed = isAllowedReflection(absH, absK, absL, structure);

                const qx = h * astar;
                const qy = k_idx * astar;
                const qz = l * astar;
                const qMag = Math.sqrt(qx * qx + qy * qy + qz * qz);

                const d = 1 / qMag;
                const sinTheta = wavelength / (2 * d);

                if (Math.abs(sinTheta) > 1) continue;

                const theta = Math.asin(sinTheta);
                const twoTheta = 2 * theta;

                const qIn2D = Math.sqrt(
                    (plane === '0kl' ? 0 : h * h) * astar * astar +
                    (plane === 'h0l' ? 0 : k_idx * k_idx) * astar * astar +
                    (plane === 'hk0' ? 0 : l * l) * astar * astar
                );

                const ewaldRadius = 2 * k * Math.sin(theta);
                const tolerance = oscRad * k * 2; // Wider tolerance for oscillation
                const onEwald = Math.abs(qIn2D - ewaldRadius) < tolerance;

                if (!isAllowed || !onEwald) continue;

                // Detector position: r = D * tan(2θ)
                // Closer detector = spots spread further apart (wider angle coverage)
                // Further detector = spots closer together (narrower angle coverage)
                const detectorR = Math.tan(twoTheta);
                const phi = Math.atan2(j, i);

                // Scale based on max 2θ we want to show and detector distance
                // Larger detector distance = smaller angular range visible = less spread
                const maxTwoTheta = Math.PI / 3; // 60 degrees max
                const distanceFactor = 100 / detectorDistance; // Normalize to 100mm
                const scale = maxRadius * 0.85 / Math.tan(maxTwoTheta);
                const detectorX = detectorR * Math.cos(phi) * scale * distanceFactor;
                const detectorY = -detectorR * Math.sin(phi) * scale * distanceFactor;

                const intensity = getIntensity(h, k_idx, l);
                // Much smaller, tighter spots
                const baseRadius = 2.5;
                const radius = baseRadius;
                const elongation = 1.0 + twoTheta * 0.15; // Subtle elongation

                spots.push({
                    x: detectorX,
                    y: detectorY,
                    radius,
                    elongation,
                    intensity,
                    angle: phi,
                    h,
                    k: k_idx,
                    l,
                });
            }
        }

        return spots;
    }, [viewMode, wavelength, structure, maxIndex, plane, getHKL, getIntensity, detectorDistance, oscillationRange, width, height]);

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
            },
        };

        return () => {
            gl.deleteProgram(program);
            gl.deleteTexture(texture);
            glStateRef.current = null;
        };
    }, [viewMode]);

    // Update texture when spots change
    useEffect(() => {
        if (viewMode !== 'detector') return;
        const state = glStateRef.current;
        if (!state) return;

        const { gl, texture } = state;
        const dataSize = Math.max(4, spotData.length * 2);
        const textureData = new Float32Array(dataSize * 4);

        let maxIntensity = 1;
        for (const spot of spotData) {
            maxIntensity = Math.max(maxIntensity, spot.intensity);
        }

        for (let i = 0; i < spotData.length; i++) {
            const spot = spotData[i];
            const idx = i * 8;
            // Position data
            textureData[idx] = spot.x;
            textureData[idx + 1] = spot.y;
            textureData[idx + 2] = spot.radius;
            textureData[idx + 3] = spot.elongation;
            // Intensity data
            textureData[idx + 4] = spot.intensity;
            textureData[idx + 5] = spot.angle;
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        const ext = gl.getExtension('OES_texture_float');
        if (ext) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, dataSize, 1, 0, gl.RGBA, gl.FLOAT, textureData);
        }

        spotsRef.current = spotData;
    }, [spotData, viewMode]);

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

        let maxIntensity = 1;
        for (const spot of spotData) {
            maxIntensity = Math.max(maxIntensity, spot.intensity);
        }

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

        const { fixedLabel } = getPlaneInfo();
        const centerX = width / 2;
        const centerY = height / 2;
        const plotSize = Math.min(width, height) - 80;
        const maxRadius = plotSize / 2;

        // Calculate 2θ max ring position (same math as spot positioning)
        const maxTwoThetaRef = Math.PI / 3; // 60 degrees reference
        const distanceFactor = 100 / detectorDistance;
        const scale = maxRadius * 0.85 / Math.tan(maxTwoThetaRef);
        const twoThetaMaxRad = (twoThetaMax * Math.PI) / 180;
        const twoThetaMaxRadius = Math.tan(twoThetaMaxRad) * scale * distanceFactor * zoom;

        // Draw 2θ max boundary ring
        if (twoThetaMaxRadius > 10 && twoThetaMaxRadius < maxRadius * 2) {
            ctx.strokeStyle = isDark ? 'rgba(147, 197, 253, 0.6)' : 'rgba(37, 99, 235, 0.5)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.arc(centerX - pan.x * zoom, centerY + pan.y * zoom, twoThetaMaxRadius, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.setLineDash([]);

            // Label the ring
            ctx.fillStyle = isDark ? 'rgba(147, 197, 253, 0.9)' : 'rgba(37, 99, 235, 0.8)';
            ctx.font = '9px "Segoe UI", system-ui, sans-serif';
            ctx.textAlign = 'left';
            const labelX = centerX - pan.x * zoom + twoThetaMaxRadius * 0.707 + 4;
            const labelY = centerY + pan.y * zoom - twoThetaMaxRadius * 0.707 - 4;
            if (labelX > 20 && labelX < width - 40 && labelY > 20 && labelY < height - 20) {
                ctx.fillText(`2θ=${twoThetaMax}°`, labelX, labelY);
            }
        }

        // Title
        ctx.fillStyle = theme.text;
        ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Detector Pattern (${fixedLabel})`, 10, 15);

        // Info
        ctx.font = '10px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = theme.textMuted;
        ctx.textAlign = 'right';
        const smearText = powderSmear > 0.01 ? ` | Smear: ${(powderSmear * 100).toFixed(0)}%` : '';
        ctx.fillText(`Zoom: ${zoom.toFixed(1)}x | λ=${wavelength.toFixed(3)}Å${smearText}`, width - 10, height - 10);

        // Draw selected spot highlight
        if (selectedReflection) {
            const spot = spotData.find(s =>
                s.h === selectedReflection[0] &&
                s.k === selectedReflection[1] &&
                s.l === selectedReflection[2]
            );
            if (spot) {
                const centerX = width / 2;
                const centerY = height / 2;
                const pixelX = centerX + (spot.x - pan.x) * zoom;
                const pixelY = centerY + (spot.y - pan.y) * zoom;

                ctx.strokeStyle = isDark ? '#fbbf24' : '#d97706';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(pixelX, pixelY, spot.radius * zoom + 6, 0, 2 * Math.PI);
                ctx.stroke();

                // Label
                ctx.fillStyle = isDark ? '#fbbf24' : '#d97706';
                ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(`(${spot.h},${spot.k},${spot.l})`, pixelX + spot.radius * zoom + 8, pixelY + 4);
            }
        }

        // Zoom instructions
        ctx.fillStyle = theme.textMuted;
        ctx.font = '9px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Scroll to zoom, drag to pan', 10, height - 10);

    }, [viewMode, spotData, zoom, pan, width, height, isDark, theme, selectedReflection, wavelength, getPlaneInfo, powderSmear, twoThetaMax, detectorDistance]);

    // Draw reciprocal lattice (original Canvas 2D mode)
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
        const scale = plotSize / (2 * maxIndex + 1);

        const { xLabel, yLabel, fixedLabel } = getPlaneInfo();

        // Clear canvas
        ctx.fillStyle = theme.surface || theme.inputBg;
        ctx.fillRect(0, 0, width, height);

        // Draw grid
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;

        for (let i = -maxIndex; i <= maxIndex; i++) {
            const x = centerX + i * scale;
            ctx.beginPath();
            ctx.moveTo(x, margin);
            ctx.lineTo(x, height - margin);
            ctx.stroke();

            const y = centerY - i * scale;
            ctx.beginPath();
            ctx.moveTo(margin, y);
            ctx.lineTo(width - margin, y);
            ctx.stroke();
        }

        // Draw axes
        ctx.strokeStyle = theme.textMuted;
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(margin, centerY);
        ctx.lineTo(width - margin, centerY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(centerX, margin);
        ctx.lineTo(centerX, height - margin);
        ctx.stroke();

        // Find max intensity for scaling
        let maxIntensity = 1;
        for (let i = -maxIndex; i <= maxIndex; i++) {
            for (let j = -maxIndex; j <= maxIndex; j++) {
                if (i === 0 && j === 0) continue;
                const [h, k, l] = getHKL(i, j);
                if (isAllowedReflection(Math.abs(h), Math.abs(k), Math.abs(l), structure)) {
                    const intensity = getIntensity(h, k, l);
                    maxIntensity = Math.max(maxIntensity, intensity);
                }
            }
        }

        // Draw reciprocal lattice points
        for (let i = -maxIndex; i <= maxIndex; i++) {
            for (let j = -maxIndex; j <= maxIndex; j++) {
                const x = centerX + i * scale;
                const y = centerY - j * scale;

                const [h, k, l] = getHKL(i, j);
                const absH = Math.abs(h);
                const absK = Math.abs(k);
                const absL = Math.abs(l);

                const isOrigin = i === 0 && j === 0;
                const isAllowed = isAllowedReflection(absH, absK, absL, structure);
                const isSelected =
                    selectedReflection &&
                    h === selectedReflection[0] &&
                    k === selectedReflection[1] &&
                    l === selectedReflection[2];

                if (isOrigin) {
                    ctx.fillStyle = isDark ? '#888' : '#666';
                    ctx.beginPath();
                    ctx.arc(x, y, 3, 0, 2 * Math.PI);
                    ctx.fill();
                } else if (isAllowed) {
                    const intensity = getIntensity(h, k, l);
                    const normalizedIntensity = intensity / maxIntensity;
                    const radius = 3 + normalizedIntensity * 12;

                    if (isSelected) {
                        ctx.fillStyle = isDark ? '#fbbf24' : '#d97706';
                        ctx.strokeStyle = isDark ? '#fbbf24' : '#d97706';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.arc(x, y, radius + 3, 0, 2 * Math.PI);
                        ctx.stroke();
                    }

                    ctx.fillStyle = isDark ? '#6b9eff' : '#2563eb';
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, 2 * Math.PI);
                    ctx.fill();
                } else if (showAbsences) {
                    // Small grey dots with 25% opacity for systematic absences
                    ctx.fillStyle = isDark ? 'rgba(180, 180, 180, 0.25)' : 'rgba(100, 100, 100, 0.25)';
                    ctx.beginPath();
                    ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        }

        // Draw axis labels
        ctx.fillStyle = theme.text;
        ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';

        ctx.fillText(xLabel, width - margin + 15, centerY + 4);
        ctx.fillText(yLabel, centerX, margin - 10);

        // Title
        ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Reciprocal Space (${fixedLabel})`, 10, 15);

        // Scale indicator
        ctx.font = '10px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = theme.textMuted;
        ctx.textAlign = 'right';
        ctx.fillText(`Max: ${maxIndex}`, width - 10, height - 10);
    }, [
        viewMode,
        width,
        height,
        structure,
        reflections,
        plane,
        maxIndex,
        showAbsences,
        selectedReflection,
        theme,
        isDark,
        getPlaneInfo,
        getHKL,
        getIntensity,
    ]);

    // Mouse handlers for zoom/pan
    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (viewMode !== 'detector') return;
        e.preventDefault();

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(z => Math.max(0.5, Math.min(10, z * delta)));
    }, [viewMode]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (viewMode !== 'detector') return;
        isDragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
    }, [viewMode]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (viewMode !== 'detector' || !isDragging.current) return;

        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        lastMouse.current = { x: e.clientX, y: e.clientY };

        setPan(p => ({ x: p.x - dx / zoom, y: p.y + dy / zoom }));
    }, [viewMode, zoom]);

    const handleMouseUp = useCallback(() => {
        isDragging.current = false;
    }, []);

    const handleDoubleClick = useCallback(() => {
        if (viewMode !== 'detector') return;
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, [viewMode]);

    // Handle click for selection
    const handleClick = useCallback(
        (e: React.MouseEvent) => {
            if (!onSelectReflection || isDragging.current) return;

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
                const plotSize = Math.min(width, height) - 80;
                const scale = plotSize / (2 * maxIndex + 1);

                const i = Math.round((clickX - centerX) / scale);
                const j = Math.round((centerY - clickY) / scale);

                if (
                    Math.abs(i) <= maxIndex &&
                    Math.abs(j) <= maxIndex &&
                    !(i === 0 && j === 0)
                ) {
                    const [h, k, l] = getHKL(i, j);
                    if (isAllowedReflection(Math.abs(h), Math.abs(k), Math.abs(l), structure)) {
                        onSelectReflection([h, k, l]);
                    }
                }
            }
        },
        [width, height, maxIndex, plane, structure, onSelectReflection, viewMode, zoom, pan, getHKL]
    );

    // Reset zoom/pan when switching modes or structure changes
    useEffect(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
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
                    cursor: isDragging.current ? 'grabbing' : 'grab',
                }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onDoubleClick={handleDoubleClick}
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
                {/* Powder animation button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handlePowderToggle();
                    }}
                    style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        padding: '4px 8px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        border: `1px solid ${theme.border}`,
                        borderRadius: '4px',
                        backgroundColor: powderSmear > 0.5
                            ? (theme.accent || '#2563eb')
                            : (isDark ? 'rgba(60,60,60,0.9)' : 'rgba(255,255,255,0.9)'),
                        color: powderSmear > 0.5 ? '#fff' : theme.text,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}
                    title={powderSmear > 0.5 ? 'Reset to single crystal' : 'Animate to powder pattern'}
                >
                    {isAnimating ? 'Smearing...' : (powderSmear > 0.5 ? 'Reset' : 'Powder')}
                </button>
            </div>
        );
    }

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            onClick={handleClick}
            style={{
                cursor: 'pointer',
                borderRadius: '4px',
                border: `1px solid ${theme.border}`,
            }}
        />
    );
};

export default ReciprocalLattice;
