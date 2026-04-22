/**
 * Canvas-based 1D plot of the hydrogen radial factors R_{nl}(r) and r²|R|².
 * Both share an x-axis (r in Bohr radii). Nodes of R_{nl} are marked with
 * vertical lines so the radial-vs-angular node distinction is visible.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { radialR, radialProbabilityDensity } from './physics';

interface RadialPlotProps {
    n: number;
    l: number;
    Z?: number;
    rMax: number;
    width: number;
    height: number;
    isDark: boolean;
    colorR: string;
    colorProb: string;
}

// Rough locations of radial nodes (where R_{nl} = 0) for n ≤ 4. Returns r > 0 only.
function radialNodes(n: number, l: number): number[] {
    if (n - l - 1 <= 0) return [];
    // Closed-form roots for the polynomials in radialR.
    if (n === 2 && l === 0) return [2];
    if (n === 3 && l === 0) return [(9 - 3 * Math.sqrt(3)) / 2, (9 + 3 * Math.sqrt(3)) / 2];
    if (n === 3 && l === 1) return [6];
    if (n === 4 && l === 0) {
        // 192 − 144Zr + 24(Zr)² − (Zr)³ = 0. Three real roots; solve numerically.
        return solveCubic(-1, 24, -144, 192);
    }
    if (n === 4 && l === 1) return [10 - 2 * Math.sqrt(5), 10 + 2 * Math.sqrt(5)];
    if (n === 4 && l === 2) return [12];
    return [];
}

/** Solve ax³ + bx² + cx + d = 0, return real positive roots sorted. */
function solveCubic(a: number, b: number, c: number, d: number): number[] {
    // Normalise
    const p1 = b / a;
    const p2 = c / a;
    const p3 = d / a;
    // Depressed cubic t³ + pt + q = 0, x = t − p1/3
    const p = p2 - (p1 * p1) / 3;
    const q = (2 * p1 * p1 * p1) / 27 - (p1 * p2) / 3 + p3;
    const disc = -4 * p * p * p - 27 * q * q;
    const roots: number[] = [];
    if (disc < 0) {
        // One real root
        const sq = Math.sqrt(-disc / 108);
        const u = Math.cbrt(-q / 2 + sq);
        const v = Math.cbrt(-q / 2 - sq);
        roots.push(u + v - p1 / 3);
    } else {
        // Three real roots via trig
        const r = Math.sqrt(-p / 3);
        const phi = Math.acos((3 * q) / (2 * p * r));
        for (let k = 0; k < 3; k++) {
            roots.push(2 * r * Math.cos((phi - 2 * Math.PI * k) / 3) - p1 / 3);
        }
    }
    return roots.filter((r) => r > 1e-6).sort((a, b) => a - b);
}

export const RadialPlot: React.FC<RadialPlotProps> = ({
    n,
    l,
    Z = 1,
    rMax,
    width,
    height,
    isDark,
    colorR,
    colorProb,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const { samples, maxAbsR, maxProb, nodes } = useMemo(() => {
        const N = 400;
        const samples: { r: number; R: number; P: number }[] = [];
        let maxAbsR = 0;
        let maxProb = 0;
        for (let i = 0; i <= N; i++) {
            const r = (i / N) * rMax;
            const R = radialR(n, l, r, Z);
            const P = radialProbabilityDensity(n, l, r, Z);
            samples.push({ r, R, P });
            if (Math.abs(R) > maxAbsR) maxAbsR = Math.abs(R);
            if (P > maxProb) maxProb = P;
        }
        return { samples, maxAbsR, maxProb, nodes: radialNodes(n, l) };
    }, [n, l, Z, rMax]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        const ctx = canvas.getContext('2d')!;
        ctx.scale(dpr, dpr);

        const padL = 34;
        const padR = 10;
        const padT = 10;
        const padB = 20;
        const plotW = width - padL - padR;
        const plotH = height - padT - padB;
        const midY = padT + plotH / 2;

        const bg = isDark ? '#0e0e12' : '#fafbfc';
        const grid = isDark ? '#2a2a30' : '#e5e5e5';
        const axis = isDark ? '#555' : '#888';
        const label = isDark ? '#999' : '#555';

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        // Grid: horizontal zero-line for R, bottom-line for probability
        ctx.strokeStyle = grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, midY);
        ctx.lineTo(padL + plotW, midY);
        ctx.stroke();

        // r axis ticks
        ctx.strokeStyle = axis;
        ctx.fillStyle = label;
        ctx.font = '10px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        const nTicks = 5;
        for (let i = 0; i <= nTicks; i++) {
            const t = i / nTicks;
            const x = padL + t * plotW;
            const r = t * rMax;
            ctx.beginPath();
            ctx.moveTo(x, padT + plotH);
            ctx.lineTo(x, padT + plotH + 3);
            ctx.stroke();
            ctx.fillText(r.toFixed(0), x, padT + plotH + 14);
        }
        ctx.textAlign = 'right';
        ctx.fillText('r / a₀', padL + plotW, padT + plotH + 14);

        // Nodes: vertical dashed lines
        ctx.strokeStyle = isDark ? '#666' : '#aaa';
        ctx.setLineDash([3, 3]);
        for (const rN of nodes) {
            if (rN > rMax) continue;
            const x = padL + (rN / rMax) * plotW;
            ctx.beginPath();
            ctx.moveTo(x, padT);
            ctx.lineTo(x, padT + plotH);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        // r²|R|² curve (positive only, filled under)
        if (maxProb > 1e-12) {
            ctx.beginPath();
            ctx.moveTo(padL, padT + plotH);
            for (const s of samples) {
                const x = padL + (s.r / rMax) * plotW;
                const y = padT + plotH - (s.P / maxProb) * (plotH * 0.45);
                ctx.lineTo(x, y);
            }
            ctx.lineTo(padL + plotW, padT + plotH);
            ctx.closePath();
            ctx.fillStyle = colorProb + '33';
            ctx.fill();
            ctx.strokeStyle = colorProb;
            ctx.lineWidth = 1.6;
            ctx.stroke();
        }

        // R_{nl}(r) curve (signed, drawn across the midline)
        if (maxAbsR > 1e-12) {
            ctx.strokeStyle = colorR;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            samples.forEach((s, i) => {
                const x = padL + (s.r / rMax) * plotW;
                const y = midY - (s.R / maxAbsR) * (plotH * 0.45);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        }

        // Legend + axis label
        ctx.textAlign = 'left';
        ctx.fillStyle = colorR;
        ctx.fillText(`R_${n}${l}(r)`, padL + 4, padT + 12);
        ctx.fillStyle = colorProb;
        ctx.fillText(`r² |R|²`, padL + 4, padT + 25);
    }, [samples, maxAbsR, maxProb, nodes, width, height, isDark, rMax, n, l, colorR, colorProb]);

    return <canvas ref={canvasRef} style={{ width, height, display: 'block' }} />;
};

export default RadialPlot;
