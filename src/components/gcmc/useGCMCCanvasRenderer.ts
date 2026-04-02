import { useEffect, useRef } from 'react';
import { GCMCParticleData } from './GCMCParticleData';
import { MCTrialResult } from './MCEngine';
import { ExternalPotential } from './ExternalPotentials';

interface Theme {
    canvasBg: string;
    [key: string]: string;
}

interface UseGCMCCanvasRendererProps {
    canvasRef: React.RefObject<HTMLCanvasElement>;
    particleDataRef: React.RefObject<GCMCParticleData | null>;
    width: number;
    height: number;
    running: boolean;
    isDark: boolean;
    theme: Theme;
    coordinateScale: number;
    visualScale: number;
    sigmaMatrix: number[][];       // sigma per type pair -- used for particle radii
    typeColors: string[];
    stepsPerFrame: number;
    onSimulationStep: () => void;
    showTrialMoves: boolean;
    showExternalPotential: boolean;
    externalPotential: ExternalPotential | null;
    lastTrialRef: React.RefObject<MCTrialResult | null>;
    boxWidth: number;
    boxHeight: number;
}

interface TrialFlash {
    x: number;
    y: number;
    type: 'displacement' | 'insertion' | 'deletion';
    accepted: boolean;
    age: number;
    particleType: number;
}

export function useGCMCCanvasRenderer({
    canvasRef,
    particleDataRef,
    width,
    height,
    running,
    isDark,
    theme,
    coordinateScale,
    visualScale,
    sigmaMatrix,
    typeColors,
    stepsPerFrame,
    onSimulationStep,
    showTrialMoves,
    showExternalPotential,
    externalPotential,
    lastTrialRef,
    boxWidth,
    boxHeight,
}: UseGCMCCanvasRendererProps) {
    const trialFlashesRef = useRef<TrialFlash[]>([]);
    const extPotCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const extPotCacheKeyRef = useRef<string>('');
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

    const setupCanvasDPI = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
    };

    useEffect(() => {
        setupCanvasDPI();
    }, [width, height, dpr]);

    // Invalidate potential cache when external potential changes
    useEffect(() => {
        extPotCanvasRef.current = null;
        extPotCacheKeyRef.current = '';
    }, [externalPotential]);

    // Pre-render external potential to an offscreen canvas (cached)
    const getExternalPotentialCanvas = (): HTMLCanvasElement | null => {
        if (!externalPotential || !showExternalPotential) return null;

        const cacheKey = `${boxWidth},${boxHeight},${width},${height},${isDark}`;
        if (extPotCacheKeyRef.current === cacheKey && extPotCanvasRef.current) {
            return extPotCanvasRef.current;
        }

        const offscreen = document.createElement('canvas');
        offscreen.width = width;
        offscreen.height = height;
        const ctx = offscreen.getContext('2d');
        if (!ctx) return null;

        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        const step = 2;
        for (let py = 0; py < height; py += step) {
            for (let px = 0; px < width; px += step) {
                const x = px / coordinateScale;
                const y = py / coordinateScale;
                // Sample across all types, use the one with largest magnitude
                let energy = externalPotential.calculate(x, y, 0);
                for (let t = 1; t < typeColors.length; t++) {
                    const e = externalPotential.calculate(x, y, t);
                    if (Math.abs(e) > Math.abs(energy)) energy = e;
                }

                let r = 0, g = 0, b = 0, a = 0;
                if (energy > 1e5) {
                    if (isDark) { r = 55; g = 55; b = 65; a = 220; }
                    else { r = 175; g = 175; b = 185; a = 200; }
                } else if (energy < -1e-6) {
                    const intensity = Math.min(1, Math.abs(energy) / 0.03);
                    if (isDark) { r = 30; g = 60; b = 140; }
                    else { r = 60; g = 120; b = 220; }
                    a = Math.floor(intensity * 120);
                } else if (energy > 1e-6 && energy < 1e5) {
                    const intensity = Math.min(1, energy / 0.05);
                    r = 220; g = 80; b = 60;
                    a = Math.floor(intensity * 100);
                }

                if (a > 0) {
                    for (let dy = 0; dy < step && py + dy < height; dy++) {
                        for (let dx = 0; dx < step && px + dx < width; dx++) {
                            const idx = ((py + dy) * width + (px + dx)) * 4;
                            data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = a;
                        }
                    }
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);
        extPotCanvasRef.current = offscreen;
        extPotCacheKeyRef.current = cacheKey;
        return offscreen;
    };

    // Compute per-type visual radii from sigma (sigma/2 * visualScale, in pixels)
    const getTypeRadius = (typeIdx: number): number => {
        const sigma = sigmaMatrix[typeIdx]?.[typeIdx] ?? sigmaMatrix[0]?.[0] ?? 3.4;
        return (sigma / 2) * visualScale;
    };

    useEffect(() => {
        let animationFrameId: number;

        const render = () => {
            const canvas = canvasRef.current;
            const data = particleDataRef.current;
            if (!canvas || !data) {
                animationFrameId = requestAnimationFrame(render);
                return;
            }

            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) return;

            // Run simulation steps
            if (running) {
                for (let s = 0; s < stepsPerFrame; s++) {
                    onSimulationStep();
                }

                // Collect trial flash from last step
                const lastTrial = lastTrialRef.current;
                if (lastTrial && showTrialMoves) {
                    trialFlashesRef.current.push({
                        x: lastTrial.position[0],
                        y: lastTrial.position[1],
                        type: lastTrial.type,
                        accepted: lastTrial.accepted,
                        age: 0,
                        particleType: lastTrial.particleType,
                    });
                }
            }

            // Reset transform
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // Clear
            ctx.fillStyle = theme.canvasBg;
            ctx.fillRect(0, 0, width, height);

            // Draw external potential overlay (cached offscreen canvas)
            if (showExternalPotential && externalPotential) {
                const potCanvas = getExternalPotentialCanvas();
                if (potCanvas) {
                    ctx.drawImage(potCanvas, 0, 0);
                }
            }

            // Border (matches MD: single thin border at canvas edge)
            ctx.strokeStyle = isDark ? '#444' : '#000';
            ctx.lineWidth = 1;
            ctx.strokeRect(0, 0, width, height);

            // Draw particles with sigma-based radii
            ctx.strokeStyle = isDark ? '#555' : '#000';
            ctx.lineWidth = 0.5;

            for (let i = 0; i < data.count; i++) {
                const px = data.positions[i * 2] * coordinateScale;
                const py = data.positions[i * 2 + 1] * coordinateScale;
                const typeIdx = data.types[i];
                const radius = getTypeRadius(typeIdx);

                ctx.beginPath();
                ctx.arc(px, py, radius, 0, Math.PI * 2);
                ctx.fillStyle = typeColors[typeIdx] || typeColors[0];
                ctx.fill();
                ctx.stroke();
            }

            // Draw trial move flashes
            const flashes = trialFlashesRef.current;
            const maxAge = 15;
            for (let i = flashes.length - 1; i >= 0; i--) {
                const flash = flashes[i];
                flash.age++;

                if (flash.age > maxAge) {
                    flashes.splice(i, 1);
                    continue;
                }

                const alpha = 1 - flash.age / maxAge;
                const px = flash.x * coordinateScale;
                const py = flash.y * coordinateScale;
                const flashRadius = getTypeRadius(flash.particleType);

                if (flash.type === 'insertion') {
                    const ringRadius = flashRadius * (1 + flash.age * 0.3);
                    ctx.beginPath();
                    ctx.arc(px, py, ringRadius, 0, Math.PI * 2);
                    ctx.strokeStyle = flash.accepted
                        ? `rgba(16, 185, 129, ${alpha * 0.8})`
                        : `rgba(239, 68, 68, ${alpha * 0.6})`;
                    ctx.lineWidth = flash.accepted ? 2.5 : 1.5;
                    ctx.stroke();

                    if (flash.accepted) {
                        const s = 4 * alpha;
                        ctx.strokeStyle = `rgba(16, 185, 129, ${alpha * 0.6})`;
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(px - s, py); ctx.lineTo(px + s, py);
                        ctx.moveTo(px, py - s); ctx.lineTo(px, py + s);
                        ctx.stroke();
                    }
                } else if (flash.type === 'deletion') {
                    const ringRadius = flashRadius * Math.max(0.1, 2 - flash.age * 0.15);
                    ctx.beginPath();
                    ctx.arc(px, py, ringRadius, 0, Math.PI * 2);
                    ctx.strokeStyle = flash.accepted
                        ? `rgba(239, 68, 68, ${alpha * 0.8})`
                        : `rgba(156, 163, 175, ${alpha * 0.4})`;
                    ctx.lineWidth = flash.accepted ? 2.5 : 1.5;
                    ctx.stroke();

                    if (flash.accepted) {
                        const s = 4 * alpha;
                        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.6})`;
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(px - s, py - s); ctx.lineTo(px + s, py + s);
                        ctx.moveTo(px + s, py - s); ctx.lineTo(px - s, py + s);
                        ctx.stroke();
                    }
                } else {
                    ctx.beginPath();
                    ctx.arc(px, py, flashRadius * 1.4, 0, Math.PI * 2);
                    ctx.strokeStyle = flash.accepted
                        ? `rgba(16, 185, 129, ${alpha * 0.6})`
                        : `rgba(239, 68, 68, ${alpha * 0.4})`;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                }
            }

            animationFrameId = requestAnimationFrame(render);
        };

        animationFrameId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(animationFrameId);
    }, [running, width, height, isDark, theme, coordinateScale, visualScale,
        sigmaMatrix, typeColors, stepsPerFrame, onSimulationStep,
        showTrialMoves, showExternalPotential, externalPotential, boxWidth, boxHeight, dpr]);
}
