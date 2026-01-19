import React, { useRef, useEffect } from 'react';
import {
    psi,
    psiT,
    superpositionPsiT,
    potential,
    formatTime,
    getStateColor,
    type PotentialConfig,
} from './physics';

export interface DisplayOptions {
    showReal: boolean;
    showImaginary: boolean;
    showProbability: boolean;
    showPotential: boolean;
    showIndividualStates: boolean;
}

export interface WavefunctionCanvasProps {
    width?: number;
    height?: number;
    activeStates: number[];
    tau: number;
    potentialConfig: PotentialConfig;
    displayOptions: DisplayOptions;
}

export const WavefunctionCanvas: React.FC<WavefunctionCanvasProps> = ({
    width = 800,
    height = 400,
    activeStates,
    tau,
    potentialConfig,
    displayOptions,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const { xMin, xMax } = potentialConfig;
    const yRange = 2;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, width, height);

        // Draw coordinate axes
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(width / 2, 0);
        ctx.lineTo(width / 2, height);
        ctx.stroke();

        // Current time
        const currentTau = tau;

        // Sample points along x-axis
        const numPoints = Math.floor(width / 2);
        const points: { x: number; px: number }[] = [];
        for (let i = 0; i < numPoints; i++) {
            const px = (i / numPoints) * width;
            const x = xMin + (xMax - xMin) * (i / numPoints);
            points.push({ x, px });
        }

        // Calculate superposition wavefunction
        const superpositionPoints = points.map((p) => {
            const wave = superpositionPsiT(p.x, activeStates, currentTau, potentialConfig);
            return {
                ...p,
                real: wave.real,
                imag: wave.imag,
                prob: wave.prob,
                pot: potential(p.x, potentialConfig),
            };
        });

        // Calculate individual state wavefunctions for overlay
        const stateWavefunctions = activeStates.map((n) =>
            points.map((p) => {
                const wave = psiT(p.x, n, currentTau, potentialConfig);
                return {
                    ...p,
                    real: wave.real,
                    imag: wave.imag,
                };
            })
        );

        // Calculate scales
        const maxProb = Math.max(...superpositionPoints.map((p) => p.prob), 0.1);
        const maxAmp = Math.max(
            ...superpositionPoints.map((p) => Math.max(Math.abs(p.real), Math.abs(p.imag))),
            0.1
        );
        const maxPot = Math.max(...superpositionPoints.map((p) => p.pot), 0.1);

        const scale = (height / 2) / Math.max(yRange, maxAmp);
        const probScale = (height / 3) / maxProb;
        const potScale = (height / 3) / maxPot;

        const centerY = height / 2;

        // Draw potential
        if (displayOptions.showPotential) {
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            superpositionPoints.forEach((p, i) => {
                const y = centerY - p.pot * potScale;
                if (i === 0) ctx.moveTo(p.px, y);
                else ctx.lineTo(p.px, y);
            });
            ctx.stroke();
        }

        // Draw individual state wavefunctions (faded)
        if (displayOptions.showIndividualStates && displayOptions.showReal) {
            stateWavefunctions.forEach((statePoints, idx) => {
                const n = activeStates[idx];
                const color = getStateColor(n);

                ctx.strokeStyle = `${color}50`; // 30% opacity
                ctx.lineWidth = 2;
                ctx.beginPath();
                statePoints.forEach((p, i) => {
                    const y = centerY - p.real * scale;
                    if (i === 0) ctx.moveTo(p.px, y);
                    else ctx.lineTo(p.px, y);
                });
                ctx.stroke();
            });
        }

        // Draw superposition real part
        if (displayOptions.showReal) {
            ctx.strokeStyle = 'rgba(0, 72, 186, 0.9)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            superpositionPoints.forEach((p, i) => {
                const y = centerY - p.real * scale;
                if (i === 0) ctx.moveTo(p.px, y);
                else ctx.lineTo(p.px, y);
            });
            ctx.stroke();
        }

        // Draw superposition imaginary part
        if (displayOptions.showImaginary) {
            ctx.strokeStyle = 'rgba(220, 20, 60, 0.9)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            superpositionPoints.forEach((p, i) => {
                const y = centerY - p.imag * scale;
                if (i === 0) ctx.moveTo(p.px, y);
                else ctx.lineTo(p.px, y);
            });
            ctx.stroke();
        }

        // Draw probability density
        if (displayOptions.showProbability) {
            ctx.strokeStyle = 'rgba(34, 139, 34, 0.9)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            superpositionPoints.forEach((p, i) => {
                const y = centerY - p.prob * probScale;
                if (i === 0) ctx.moveTo(p.px, y);
                else ctx.lineTo(p.px, y);
            });
            ctx.stroke();

            // Fill area under probability curve
            ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
            ctx.lineTo(superpositionPoints[superpositionPoints.length - 1].px, centerY);
            ctx.lineTo(superpositionPoints[0].px, centerY);
            ctx.fill();
        }

        // Draw labels
        ctx.fillStyle = '#333';
        ctx.font = 'bold 14px "Segoe UI", Helvetica, sans-serif';

        // Active states label
        ctx.fillText(`States: ${activeStates.map((n) => `n=${n}`).join(', ')}`, 15, 25);

        // Time label
        ctx.fillText(`t = ${formatTime(tau)}`, width - 100, 25);

        ctx.lineWidth = 1;
    }, [
        width,
        height,
        activeStates,
        tau,
        potentialConfig,
        displayOptions,
    ]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{
                width: '100%',
                maxWidth: `${width}px`,
                height: 'auto',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                backgroundColor: '#fff',
            }}
        />
    );
};

export default WavefunctionCanvas;
