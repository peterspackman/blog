import React, { useRef, useEffect, useMemo } from 'react';
import {
    superposition,
    psiAtTau,
    formatTime,
    getStateColor,
    type StateSet,
} from './physics';
import type { ControlTheme } from '../shared/controls';

export interface DisplayOptions {
    showReal: boolean;
    showImaginary: boolean;
    showProbability: boolean;
    showPotential: boolean;
    showIndividualStates: boolean;
    showEnergyLevels: boolean;
    autoRescale: boolean;
}

export interface WavefunctionCanvasProps {
    width?: number;
    height?: number;
    activeStates: number[];
    tau: number;
    stateSet: StateSet;
    displayOptions: DisplayOptions;
    theme: ControlTheme;
}

/**
 * Parse a short hex like #abc or full #aabbcc to rgb; fallback to grey.
 */
function hexToRgb(hex: string): [number, number, number] {
    const m3 = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(hex);
    if (m3) return [parseInt(m3[1] + m3[1], 16), parseInt(m3[2] + m3[2], 16), parseInt(m3[3] + m3[3], 16)];
    const m6 = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);
    if (m6) return [parseInt(m6[1], 16), parseInt(m6[2], 16), parseInt(m6[3], 16)];
    return [128, 128, 128];
}

function rgba(hex: string, alpha: number): string {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const WavefunctionCanvas: React.FC<WavefunctionCanvasProps> = ({
    width = 800,
    height = 400,
    activeStates,
    tau,
    stateSet,
    displayOptions,
    theme,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { xMin, xMax } = stateSet.config;

    // Sample grid — shared between the time-independent ψ_n(x) precompute
    // and the per-frame superposition. numPoints is tied to width so we
    // refresh the grid when width changes but not every frame.
    const numPoints = Math.max(300, Math.floor(width * 0.8));

    // Stable per-stateSet data: x-grid, V(x) samples, and fixed y-axis bounds.
    // These do NOT depend on which states are active, so toggling active
    // states never rescales the plot.
    const potentialData = useMemo(() => {
        const xs = new Float64Array(numPoints);
        for (let i = 0; i < numPoints; i++) {
            xs[i] = xMin + (xMax - xMin) * (i / (numPoints - 1));
        }

        const pot = new Float64Array(numPoints);
        for (let i = 0; i < numPoints; i++) {
            pot[i] = stateSet.potential(xs[i]);
        }

        // Include all available eigenenergies (not just active ones) in the
        // y-axis span so the view stays put as the user clicks between states.
        const maxLevels = Math.min(stateSet.numStates, 32);
        let highestE = -Infinity;
        let lowestE = Infinity;
        for (let n = 0; n < maxLevels; n++) {
            const E = stateSet.energy(n);
            if (E > highestE) highestE = E;
            if (E < lowestE) lowestE = E;
        }
        if (!Number.isFinite(highestE)) {
            highestE = stateSet.maxPotentialDisplay;
            lowestE = stateSet.minPotentialDisplay;
        }

        const rangeTop = Math.max(stateSet.maxPotentialDisplay, highestE);
        const rangeBot = Math.min(stateSet.minPotentialDisplay, lowestE);
        const range = Math.max(rangeTop - rangeBot, 1e-3);
        const yCeiling = rangeTop + 0.08 * range;
        const yFloor = rangeBot - 0.1 * range;

        return { xs, pot, yCeiling, yFloor };
    }, [stateSet, numPoints, xMin, xMax]);

    // Per-active-states data: static ψ_n samples + amplitude bounds.
    // This IS dependent on activeStates, but does not influence the y-axis.
    const stateData = useMemo(() => {
        const { xs } = potentialData;
        const statePsi: Float64Array[] = [];
        let maxStatePsi = 0;
        for (const n of activeStates) {
            const arr = new Float64Array(numPoints);
            for (let i = 0; i < numPoints; i++) {
                arr[i] = stateSet.psi(n, xs[i]);
                const a = Math.abs(arr[i]);
                if (a > maxStatePsi) maxStatePsi = a;
            }
            statePsi.push(arr);
        }

        // Pointwise sum-of-|ψ_n|, so:
        //   |Re(ψ)|, |Im(ψ)| ≤ (1/√N) · max_x Σ_n |ψ_n(x)|   (triangle)
        //   |ψ|²        ≤ (1/N)   · (max_x Σ_n |ψ_n(x)|)²   (Cauchy–Schwarz)
        let maxSumPsi = 0;
        for (let i = 0; i < numPoints; i++) {
            let s = 0;
            for (const arr of statePsi) s += Math.abs(arr[i]);
            if (s > maxSumPsi) maxSumPsi = s;
        }
        const N = Math.max(1, activeStates.length);

        const activeEnergies = activeStates.map((n) => stateSet.energy(n));
        const ampBaseline =
            activeEnergies.reduce((a, b) => a + b, 0) / Math.max(1, activeEnergies.length);

        return {
            statePsi,
            maxStatePsi: Math.max(maxStatePsi, 1e-6),
            reImBound: Math.max(maxSumPsi / Math.sqrt(N), 1e-6),
            probBound: Math.max((maxSumPsi * maxSumPsi) / N, 1e-6),
            ampBaseline,
        };
    }, [activeStates, stateSet, numPoints, potentialData]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const padLeft = 36;
        const padRight = 12;
        const padTop = 30;
        const padBottom = 22;
        const plotW = width - padLeft - padRight;
        const plotH = height - padTop - padBottom;

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = theme.surface ?? '#fff';
        ctx.fillRect(0, 0, width, height);

        const { xs, pot, yCeiling, yFloor } = potentialData;
        const { statePsi, ampBaseline, reImBound, probBound } = stateData;

        const yToPixel = (E: number): number => {
            const frac = (E - yFloor) / (yCeiling - yFloor);
            return padTop + plotH * (1 - frac);
        };

        // Fixed wavefunction scale: occupy ~15% of plot height for max amplitude.
        // (This is what stops the curves from "bouncing" as phases evolve.)
        const waveScalePx = plotH * 0.18;
        const probScalePx = plotH * 0.22;

        // Compute per-frame superposition using the static ψ samples.
        const re = new Float64Array(numPoints);
        const im = new Float64Array(numPoints);
        const pr = new Float64Array(numPoints);
        const E0 = stateSet.groundStateEnergy;
        const norm = 1 / Math.sqrt(Math.max(1, activeStates.length));
        for (let i = 0; i < numPoints; i++) {
            let r = 0;
            let j = 0;
            for (let k = 0; k < activeStates.length; k++) {
                const phase = -(stateSet.energy(activeStates[k]) / E0) * tau;
                const psiN = statePsi[k][i];
                r += psiN * Math.cos(phase) * norm;
                j += psiN * Math.sin(phase) * norm;
            }
            re[i] = r;
            im[i] = j;
            pr[i] = r * r + j * j;
        }

        // Either use the static (stable) bounds or recompute from this frame
        // to get the "bouncing" look.
        let reImDenom = reImBound;
        let probDenom = probBound;
        if (displayOptions.autoRescale) {
            let maxRe = 1e-6;
            let maxProb = 1e-6;
            for (let i = 0; i < numPoints; i++) {
                const a = Math.max(Math.abs(re[i]), Math.abs(im[i]));
                if (a > maxRe) maxRe = a;
                if (pr[i] > maxProb) maxProb = pr[i];
            }
            reImDenom = maxRe;
            probDenom = maxProb;
        }

        const pxAt = (i: number) => padLeft + (i / (numPoints - 1)) * plotW;

        // ---- draw order: background axis, potential, energy levels, individual
        //      state overlays, superposition re/im/prob, labels.

        // Zero-energy baseline (thin dashed)
        ctx.strokeStyle = rgba(theme.textMuted, 0.25);
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        const zeroY = yToPixel(0);
        ctx.moveTo(padLeft, zeroY);
        ctx.lineTo(padLeft + plotW, zeroY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Potential V(x)
        if (displayOptions.showPotential) {
            // very subtle fill under V
            ctx.beginPath();
            ctx.moveTo(pxAt(0), yToPixel(Math.min(pot[0], yCeiling)));
            for (let i = 0; i < numPoints; i++) {
                ctx.lineTo(pxAt(i), yToPixel(Math.min(pot[i], yCeiling)));
            }
            ctx.lineTo(padLeft + plotW, yToPixel(yFloor));
            ctx.lineTo(padLeft, yToPixel(yFloor));
            ctx.closePath();
            ctx.fillStyle = rgba(theme.textMuted, 0.05);
            ctx.fill();

            ctx.strokeStyle = rgba(theme.textMuted, 0.85);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let i = 0; i < numPoints; i++) {
                const y = yToPixel(Math.min(pot[i], yCeiling));
                if (i === 0) ctx.moveTo(pxAt(i), y);
                else ctx.lineTo(pxAt(i), y);
            }
            ctx.stroke();
        }

        // Energy levels (all of them for context, active ones highlighted)
        if (displayOptions.showEnergyLevels) {
            ctx.font = '11px "Segoe UI", Helvetica, sans-serif';
            const numLevels = Math.min(stateSet.numStates, 32);
            for (let n = 0; n < numLevels; n++) {
                const E = stateSet.energy(n);
                if (E > yCeiling) continue;
                const y = yToPixel(E);
                const active = activeStates.includes(n);
                ctx.strokeStyle = active
                    ? getStateColor(n)
                    : rgba(theme.textMuted, 0.35);
                ctx.lineWidth = active ? 1.5 : 1;
                ctx.setLineDash(active ? [] : [3, 4]);
                ctx.beginPath();
                ctx.moveTo(padLeft, y);
                ctx.lineTo(padLeft + plotW, y);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = active ? getStateColor(n) : theme.textMuted;
                ctx.fillText(`E${subscript(n)}`, padLeft + 3, y - 3);
            }
        }

        // Individual state overlays: each ψ_n drawn around its own E_n.
        // Toggle is independent of real/imag/probability.
        if (displayOptions.showIndividualStates) {
            for (let k = 0; k < activeStates.length; k++) {
                const n = activeStates[k];
                const En = stateSet.energy(n);
                const baselineY = yToPixel(En);
                ctx.strokeStyle = rgba(getStateColor(n), 0.55);
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                for (let i = 0; i < numPoints; i++) {
                    const w = psiAtTau(stateSet, n, tau, xs[i]);
                    const y =
                        baselineY -
                        (w.real / stateData.maxStatePsi) * (waveScalePx * 0.7);
                    if (i === 0) ctx.moveTo(pxAt(i), y);
                    else ctx.lineTo(pxAt(i), y);
                }
                ctx.stroke();
            }
        }

        // Superposition — centered on ampBaseline
        const baselineYSup = yToPixel(ampBaseline);

        if (displayOptions.showReal) {
            ctx.strokeStyle = 'rgba(0, 72, 186, 0.95)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            for (let i = 0; i < numPoints; i++) {
                const y = baselineYSup - (re[i] / reImDenom) * waveScalePx;
                if (i === 0) ctx.moveTo(pxAt(i), y);
                else ctx.lineTo(pxAt(i), y);
            }
            ctx.stroke();
        }

        if (displayOptions.showImaginary) {
            ctx.strokeStyle = 'rgba(220, 20, 60, 0.95)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            for (let i = 0; i < numPoints; i++) {
                const y = baselineYSup - (im[i] / reImDenom) * waveScalePx;
                if (i === 0) ctx.moveTo(pxAt(i), y);
                else ctx.lineTo(pxAt(i), y);
            }
            ctx.stroke();
        }

        if (displayOptions.showProbability) {
            ctx.beginPath();
            for (let i = 0; i < numPoints; i++) {
                const y = baselineYSup - (pr[i] / probDenom) * probScalePx;
                if (i === 0) ctx.moveTo(pxAt(i), y);
                else ctx.lineTo(pxAt(i), y);
            }
            ctx.lineTo(pxAt(numPoints - 1), baselineYSup);
            ctx.lineTo(pxAt(0), baselineYSup);
            ctx.closePath();
            ctx.fillStyle = 'rgba(34, 139, 34, 0.15)';
            ctx.fill();

            ctx.strokeStyle = 'rgba(34, 139, 34, 0.95)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            for (let i = 0; i < numPoints; i++) {
                const y = baselineYSup - (pr[i] / probDenom) * probScalePx;
                if (i === 0) ctx.moveTo(pxAt(i), y);
                else ctx.lineTo(pxAt(i), y);
            }
            ctx.stroke();
        }

        // Top-bar labels
        ctx.fillStyle = theme.text;
        ctx.font = '600 13px "Segoe UI", Helvetica, sans-serif';
        ctx.fillText(
            `States: ${activeStates.map((n) => `n=${n}`).join(', ')}`,
            padLeft,
            18
        );
        ctx.textAlign = 'right';
        ctx.fillText(`t = ${formatTime(tau)}`, width - padRight, 18);

        // x-axis labels
        ctx.fillStyle = theme.textMuted;
        ctx.font = '11px "Segoe UI", Helvetica, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(xMin.toFixed(1), padLeft, height - 6);
        ctx.textAlign = 'right';
        ctx.fillText(xMax.toFixed(1), width - padRight, height - 6);
        ctx.textAlign = 'center';
        ctx.fillText('x', padLeft + plotW / 2, height - 6);
        ctx.textAlign = 'left';

        // y-axis label
        ctx.save();
        ctx.translate(12, padTop + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText('E', 0, 0);
        ctx.restore();
    }, [
        width,
        height,
        activeStates,
        tau,
        stateSet,
        displayOptions,
        theme,
        potentialData,
        stateData,
        numPoints,
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
                borderRadius: '4px',
                display: 'block',
            }}
        />
    );
};

function subscript(n: number): string {
    const map = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
    return String(n)
        .split('')
        .map((d) => map[parseInt(d, 10)] ?? d)
        .join('');
}

export default WavefunctionCanvas;
