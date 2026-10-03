import React, { useEffect, useRef } from 'react';
import { canvasFont, setupHiDPICanvas, withAlpha, type VizTheme } from '../shared/viz';
import { bandEnergy, levelWavevector, type Topology } from './huckel';

export interface BandDiagramProps {
    width: number;
    height: number;
    energies: number[];
    occupation: number[];
    fermi: number;
    selected: number;
    onSelect: (index: number) => void;
    beta: number;
    delta: number;
    topology: Topology;
    dosSigma: number;
    theme: VizTheme;
}

/**
 * Three panels on one energy axis: the finite system's MO levels, the
 * infinite band E(k) with those levels placed on it, and the density of
 * states. Sharing the axis is what shows the levels becoming the band.
 */
export function BandDiagram(props: BandDiagramProps) {
    const { width, height, energies, occupation, fermi, selected, onSelect, beta, delta, topology, dosSigma, theme } = props;
    const ref = useRef<HTMLCanvasElement>(null);
    const n = energies.length;

    // Layout (CSS px)
    const pad = { l: 44, r: 12, t: 28, b: 30 };
    const gap = 18;
    const inner = width - pad.l - pad.r - 2 * gap;
    const wLevels = inner * 0.3;
    const wBand = inner * 0.4;
    const wDos = inner * 0.3;
    const x0 = pad.l;
    const x1 = x0 + wLevels + gap;
    const x2 = x1 + wBand + gap;
    const eMax = 2 * Math.abs(beta) * 1.08 + 0.2;
    const Y = (e: number) => pad.t + ((eMax - e) / (2 * eMax)) * (height - pad.t - pad.b);
    const Xk = (k: number) => x1 + (k / Math.PI) * wBand;

    useEffect(() => {
        const ctx = setupHiDPICanvas(ref.current, width, height);
        if (!ctx) return;
        ctx.fillStyle = theme.canvas;
        ctx.fillRect(0, 0, width, height);
        const occ = theme.series[0];
        const sel = theme.series[1];

        // Energy axis and grid
        ctx.font = canvasFont(theme, 11, 'mono');
        ctx.textAlign = 'right';
        ctx.lineWidth = 1;
        const step = eMax > 6 ? 2 : 1;
        for (let e = -Math.floor(eMax / step) * step; e <= eMax; e += step) {
            ctx.strokeStyle = theme.grid;
            ctx.beginPath();
            ctx.moveTo(x0, Y(e));
            ctx.lineTo(width - pad.r, Y(e));
            ctx.stroke();
            ctx.fillStyle = theme.muted;
            ctx.fillText(e.toFixed(0), x0 - 6, Y(e) + 4);
        }
        ctx.save();
        ctx.translate(12, (pad.t + height - pad.b) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.font = canvasFont(theme, 11);
        ctx.fillText('E (eV)', 0, 0);
        ctx.restore();

        // Panel titles
        ctx.font = canvasFont(theme, 12, 'sans', 600);
        ctx.fillStyle = theme.text;
        ctx.textAlign = 'center';
        ctx.fillText(`${n} MO levels`, x0 + wLevels / 2, 16);
        ctx.fillText('Band E(k)', x1 + wBand / 2, 16);
        ctx.fillText('Density of states', x2 + wDos / 2, 16);

        // --- Levels ---
        const thin = n > 40;
        energies.forEach((e, i) => {
            const y = Y(e);
            const filled = occupation[i] > 0;
            ctx.strokeStyle = i === selected ? sel : filled ? occ : theme.muted;
            ctx.lineWidth = i === selected ? 3 : thin ? 1 : 2;
            ctx.setLineDash(filled || i === selected ? [] : [4, 3]);
            ctx.beginPath();
            ctx.moveTo(x0 + 6, y);
            ctx.lineTo(x0 + wLevels - (thin ? 6 : 22), y);
            ctx.stroke();
            ctx.setLineDash([]);
            if (!thin) {
                ctx.fillStyle = occ;
                for (let s = 0; s < occupation[i]; s++) {
                    ctx.beginPath();
                    ctx.arc(x0 + wLevels - 15 + s * 8, y, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        });

        // --- Band ---
        // Gap region at k = π/2 when the bonds alternate
        if (delta > 0) {
            const lo = bandEnergy(Math.PI / 2, beta, delta);
            const hi = bandEnergy(Math.PI / 2 + 1e-9, beta, delta);
            ctx.fillStyle = withAlpha(theme.muted, 0.12);
            ctx.fillRect(x1, Y(hi), wBand, Y(lo) - Y(hi));
            ctx.fillStyle = theme.muted;
            ctx.font = canvasFont(theme, 11);
            ctx.textAlign = 'right';
            ctx.fillText(`gap ${(hi - lo).toFixed(2)} eV`, x1 + wBand - 4, Y(hi) + 14);
        }
        ctx.strokeStyle = withAlpha(occ, 0.55);
        ctx.lineWidth = 2;
        for (const branch of [
            [0, Math.PI / 2],
            [Math.PI / 2 + 1e-9, Math.PI],
        ]) {
            ctx.beginPath();
            for (let s = 0; s <= 100; s++) {
                const k = branch[0] + ((branch[1] - branch[0]) * s) / 100;
                const y = Y(bandEnergy(k, beta, delta));
                if (s === 0) ctx.moveTo(Xk(k), y);
                else ctx.lineTo(Xk(k), y);
            }
            ctx.stroke();
        }
        energies.forEach((e, i) => {
            const k = levelWavevector(i, n, topology);
            const filled = occupation[i] > 0;
            const r = n > 40 ? 2.5 : 4;
            ctx.beginPath();
            ctx.arc(Xk(k), Y(e), r, 0, Math.PI * 2);
            ctx.fillStyle = filled ? occ : theme.canvas;
            ctx.strokeStyle = occ;
            ctx.lineWidth = 1.5;
            ctx.fill();
            ctx.stroke();
            if (i === selected) {
                ctx.strokeStyle = sel;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(Xk(k), Y(e), r + 4, 0, Math.PI * 2);
                ctx.stroke();
            }
        });
        ctx.font = canvasFont(theme, 11, 'mono');
        ctx.fillStyle = theme.muted;
        ctx.textAlign = 'center';
        [
            [0, '0'],
            [Math.PI / 2, 'π/2'],
            [Math.PI, 'π'],
        ].forEach(([k, label]) => ctx.fillText(label as string, Xk(k as number), height - 12));
        ctx.font = canvasFont(theme, 11);
        ctx.fillText('k (1/a)', x1 + wBand / 2, height - 0);

        // --- DOS (Gaussian-broadened levels) ---
        const samples = 240;
        const dos: number[] = [];
        let dmax = 1e-9;
        for (let s = 0; s <= samples; s++) {
            const e = -eMax + (2 * eMax * s) / samples;
            let d = 0;
            for (const ei of energies) d += Math.exp(-0.5 * ((e - ei) / dosSigma) ** 2);
            dos.push(d);
            dmax = Math.max(dmax, d);
        }
        const Xd = (d: number) => x2 + (d / dmax) * (wDos - 6);
        // Occupied part
        ctx.beginPath();
        ctx.moveTo(x2, Y(-eMax));
        for (let s = 0; s <= samples; s++) {
            const e = -eMax + (2 * eMax * s) / samples;
            if (e > fermi) break;
            ctx.lineTo(Xd(dos[s]), Y(e));
        }
        ctx.lineTo(x2, Y(Math.min(fermi, eMax)));
        ctx.closePath();
        ctx.fillStyle = withAlpha(occ, 0.25);
        ctx.fill();
        ctx.beginPath();
        for (let s = 0; s <= samples; s++) {
            const e = -eMax + (2 * eMax * s) / samples;
            if (s === 0) ctx.moveTo(Xd(dos[s]), Y(e));
            else ctx.lineTo(Xd(dos[s]), Y(e));
        }
        ctx.strokeStyle = occ;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.strokeStyle = theme.axis;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x2, pad.t);
        ctx.lineTo(x2, height - pad.b);
        ctx.stroke();

        // Fermi level across everything
        ctx.strokeStyle = theme.text;
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0, Y(fermi));
        ctx.lineTo(width - pad.r, Y(fermi));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = theme.text;
        ctx.font = canvasFont(theme, 11, 'sans', 600);
        ctx.textAlign = 'right';
        ctx.fillText('E_F', width - pad.r, Y(fermi) - 4);
    }, [width, height, energies, occupation, fermi, selected, beta, delta, topology, dosSigma, theme, n]);

    const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        let best = 0;
        let bestD = Infinity;
        energies.forEach((en, i) => {
            const dy = Math.abs(Y(en) - y);
            const inBand = x >= x1 && x <= x1 + wBand;
            const d = inBand ? Math.hypot(Xk(levelWavevector(i, n, topology)) - x, dy) : dy;
            if (d < bestD) {
                bestD = d;
                best = i;
            }
        });
        onSelect(best);
    };

    return (
        <canvas
            ref={ref}
            role="img"
            aria-label="Molecular orbital levels, band dispersion and density of states; click a level to select it"
            onClick={handleClick}
            style={{ display: 'block', cursor: 'pointer' }}
        />
    );
}

export interface OrbitalViewProps {
    width: number;
    height: number;
    coefficients: number[];
    bonds: number[];
    topology: Topology;
    theme: VizTheme;
}

/**
 * The selected orbital seen from above: each atom's coefficient as a disc
 * (area ∝ c², colour = sign). Bond thickness shows the alternation.
 */
export function OrbitalView({ width, height, coefficients, bonds, topology, theme }: OrbitalViewProps) {
    const ref = useRef<HTMLCanvasElement>(null);
    const n = coefficients.length;

    useEffect(() => {
        const ctx = setupHiDPICanvas(ref.current, width, height);
        if (!ctx) return;
        ctx.fillStyle = theme.canvas;
        ctx.fillRect(0, 0, width, height);

        let pos: [number, number][];
        let spacing: number;
        if (topology === 'ring') {
            const R = Math.min(width, height) / 2 - 28;
            spacing = (2 * Math.PI * R) / n;
            pos = coefficients.map((_, j) => {
                const a = -Math.PI / 2 + (2 * Math.PI * j) / n;
                return [width / 2 + R * Math.cos(a), height / 2 + R * Math.sin(a)];
            });
        } else {
            // Leave room for the end discs: their radius is at most half the spacing.
            const margin = Math.min(30, height * 0.3) + 4;
            spacing = (width - 2 * margin) / Math.max(n - 1, 1);
            pos = coefficients.map((_, j) => [margin + j * spacing, height / 2]);
        }
        const cmax = Math.max(...coefficients.map(Math.abs), 1e-9);
        const rmax = Math.min(spacing * 0.48, height * 0.3, 26);
        const bmax = Math.max(...bonds.map(Math.abs), 1e-9);

        // Bonds: stronger hopping drawn thicker
        bonds.forEach((b, j) => {
            const a = pos[j];
            const c = pos[(j + 1) % n];
            ctx.strokeStyle = theme.axis;
            ctx.lineWidth = 1 + 3 * (Math.abs(b) / bmax) ** 2;
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(c[0], c[1]);
            ctx.stroke();
        });

        coefficients.forEach((c, j) => {
            const r = rmax * Math.abs(c) / cmax;
            if (r > 0.5) {
                ctx.fillStyle = withAlpha(c > 0 ? theme.positive : theme.negative, 0.85);
                ctx.beginPath();
                ctx.arc(pos[j][0], pos[j][1], r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = theme.text;
            ctx.beginPath();
            ctx.arc(pos[j][0], pos[j][1], n > 40 ? 1.5 : 2.5, 0, Math.PI * 2);
            ctx.fill();
        });
    }, [width, height, coefficients, bonds, topology, theme, n]);

    return <canvas ref={ref} role="img" aria-label="Selected molecular orbital coefficients" style={{ display: 'block' }} />;
}
