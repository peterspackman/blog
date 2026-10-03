import React, { useEffect, useRef } from 'react';
import { canvasFont, setupHiDPICanvas, withAlpha, usePrefersReducedMotion, type VizTheme } from '../shared/viz';
import { braggAngles, intensity, phaseStep, toRad } from './physics';

export interface BraggParams {
    lambda: number;
    d: number;
    theta: number;
    planes: number;
}

function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size = 7) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - size * Math.cos(angle - Math.PI / 7), y - size * Math.sin(angle - Math.PI / 7));
    ctx.lineTo(x - size * Math.cos(angle + Math.PI / 7), y - size * Math.sin(angle + Math.PI / 7));
    ctx.closePath();
    ctx.fill();
}

/** Planes, rays, and the extra path 2d sin θ travelled by the deeper ray. */
export function BraggGeometry({ width, height, params, theme }: { width: number; height: number; params: BraggParams; theme: VizTheme }) {
    const ref = useRef<HTMLCanvasElement>(null);
    const { d, theta, planes } = params;

    useEffect(() => {
        const ctx = setupHiDPICanvas(ref.current, width, height);
        if (!ctx) return;
        ctx.fillStyle = theme.canvas;
        ctx.fillRect(0, 0, width, height);

        const t = toRad(theta);
        const x0 = width / 2;
        // Fit rays above the first plane and the stack of planes below, centred vertically.
        const spacing = Math.min((height * 0.45) / Math.max(planes - 1, 1), 42);
        const stack = (planes - 1) * spacing;
        const L = Math.min(width * 0.42, (height - stack - 56) / Math.max(Math.sin(t), 0.2));
        const top = 36 + (height - 36 - stack - L * Math.sin(t)) / 2 + L * Math.sin(t);
        const u = [Math.cos(t), Math.sin(t)]; // incident direction (canvas y down)
        const v = [Math.cos(t), -Math.sin(t)]; // reflected direction

        // Planes with atoms
        for (let k = 0; k < planes; k++) {
            const y = top + k * spacing;
            ctx.strokeStyle = theme.axis;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(16, y);
            ctx.lineTo(width - 16, y);
            ctx.stroke();
            ctx.fillStyle = withAlpha(theme.muted, 0.6);
            const step = Math.max(spacing * 0.9, 18);
            for (let x = x0 - Math.floor((x0 - 16) / step) * step; x < width - 16; x += step) {
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Rays to and from each plane, faded with depth
        for (let k = 0; k < planes; k++) {
            const y = top + k * spacing;
            const alpha = Math.max(0.25, 1 - k * 0.12);
            ctx.strokeStyle = withAlpha(theme.series[0], alpha);
            ctx.fillStyle = withAlpha(theme.series[0], alpha);
            ctx.lineWidth = 1.75;
            const sx = x0 - L * u[0];
            const sy = y - L * u[1];
            const ex = x0 + L * v[0];
            const ey = y + L * v[1];
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(x0, y);
            ctx.lineTo(ex, ey);
            ctx.stroke();
            arrow(ctx, (sx + x0) / 2 + 4 * u[0], (sy + y) / 2 + 4 * u[1], t);
            arrow(ctx, ex, ey, -t);
        }

        if (planes > 1) {
            // Extra path for the second ray: perpendicular feet from the first reflection point.
            const p0 = [x0, top];
            const p1 = [x0, top + spacing];
            const proj = (dir: number[]) => {
                const s = (p0[0] - p1[0]) * dir[0] + (p0[1] - p1[1]) * dir[1];
                return [p1[0] + s * dir[0], p1[1] + s * dir[1]];
            };
            const a = proj(u);
            const b = proj(v);
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = theme.muted;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p0[0], p0[1]);
            ctx.lineTo(a[0], a[1]);
            ctx.moveTo(p0[0], p0[1]);
            ctx.lineTo(b[0], b[1]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.strokeStyle = theme.series[1];
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(p1[0], p1[1]);
            ctx.lineTo(b[0], b[1]);
            ctx.stroke();
            ctx.lineCap = 'butt';

            // d marker
            const mx = width - 30;
            ctx.strokeStyle = theme.text;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(mx, top);
            ctx.lineTo(mx, top + spacing);
            ctx.moveTo(mx - 4, top);
            ctx.lineTo(mx + 4, top);
            ctx.moveTo(mx - 4, top + spacing);
            ctx.lineTo(mx + 4, top + spacing);
            ctx.stroke();
            ctx.fillStyle = theme.text;
            ctx.font = canvasFont(theme, 12, 'sans', 600);
            ctx.textAlign = 'right';
            ctx.fillText('d', mx - 8, top + spacing / 2 + 4);
        }

        // θ arc on the top plane
        ctx.strokeStyle = theme.text;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x0, top, 26, Math.PI, Math.PI + t, false);
        ctx.stroke();
        ctx.fillStyle = theme.text;
        ctx.font = canvasFont(theme, 13);
        ctx.textAlign = 'right';
        ctx.fillText('θ', x0 - 34 - 6 * Math.cos(t), top - 4);

        // Legend
        ctx.textAlign = 'left';
        ctx.font = canvasFont(theme, 12);
        ctx.fillStyle = theme.series[1];
        ctx.fillRect(16, 16, 14, 4);
        ctx.fillStyle = theme.muted;
        ctx.fillText(`extra path 2d sin θ = ${(2 * d * Math.sin(t)).toFixed(2)} Å`, 36, 22);
    }, [width, height, d, theta, planes, theme]);

    return <canvas ref={ref} role="img" aria-label="Rays reflecting from crystal planes" style={{ display: 'block' }} />;
}

/** The reflected waves from each plane and their sum, drifting in time. */
export function BraggWaves({
    width,
    height,
    params,
    theme,
    animate,
}: {
    width: number;
    height: number;
    params: BraggParams;
    theme: VizTheme;
    animate: boolean;
}) {
    const ref = useRef<HTMLCanvasElement>(null);
    const reduced = usePrefersReducedMotion();
    const { lambda, d, theta, planes } = params;

    useEffect(() => {
        const phi = phaseStep(d, theta, lambda);
        let raf = 0;
        let t = 0;
        let last = performance.now();
        const draw = (now: number) => {
            const ctx = setupHiDPICanvas(ref.current, width, height);
            if (!ctx) return;
            t += ((now - last) / 1000) * 2.5;
            last = now;
            ctx.fillStyle = theme.canvas;
            ctx.fillRect(0, 0, width, height);

            const mid = height / 2;
            const amp = height * 0.24;
            const k = (2 * Math.PI) / Math.max(width / 5, 40);
            const env = (x: number) => Math.exp(-(((x - width / 2) / (width * 0.32)) ** 2));

            ctx.setLineDash([3, 4]);
            ctx.strokeStyle = theme.grid;
            ctx.beginPath();
            ctx.moveTo(0, mid);
            ctx.lineTo(width, mid);
            ctx.stroke();
            ctx.setLineDash([]);

            for (let n = 0; n < planes; n++) {
                ctx.strokeStyle = withAlpha(theme.series[0], Math.max(0.2, 0.75 - n * 0.08));
                ctx.lineWidth = 1.25;
                ctx.beginPath();
                for (let x = 0; x <= width; x += 2) {
                    const y = mid - amp * env(x) * Math.sin(k * x - t - n * phi);
                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }

            // Sum, scaled by 1/√N so random phases stay on screen while in-phase waves grow.
            ctx.strokeStyle = theme.series[1];
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            for (let x = 0; x <= width; x += 2) {
                let s = 0;
                for (let n = 0; n < planes; n++) s += Math.sin(k * x - t - n * phi);
                const y = mid - (amp * env(x) * s) / Math.sqrt(planes);
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            ctx.font = canvasFont(theme, 12);
            ctx.textAlign = 'left';
            ctx.fillStyle = theme.series[0];
            ctx.fillRect(12, 14, 14, 3);
            ctx.fillStyle = theme.muted;
            ctx.fillText('from each plane', 32, 19);
            ctx.fillStyle = theme.series[1];
            ctx.fillRect(12, 32, 14, 3);
            ctx.fillStyle = theme.muted;
            ctx.fillText('sum (reflected beam)', 32, 37);

            if (animate && !reduced) raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(raf);
    }, [width, height, lambda, d, theta, planes, theme, animate, reduced]);

    return <canvas ref={ref} role="img" aria-label="Waves reflected from each plane and their sum" style={{ display: 'block' }} />;
}

/** Reflected intensity against angle, with the current θ marked. */
export function BraggIntensity({
    width,
    height,
    params,
    theme,
    onSelectTheta,
}: {
    width: number;
    height: number;
    params: BraggParams;
    theme: VizTheme;
    onSelectTheta: (theta: number) => void;
}) {
    const ref = useRef<HTMLCanvasElement>(null);
    const { lambda, d, theta, planes } = params;
    const pad = { l: 40, r: 16, t: 24, b: 24 };

    useEffect(() => {
        const ctx = setupHiDPICanvas(ref.current, width, height);
        if (!ctx) return;
        const pw = width - pad.l - pad.r;
        const ph = height - pad.t - pad.b;
        const X = (deg: number) => pad.l + (deg / 90) * pw;
        const Y = (i: number) => pad.t + (1 - i) * ph;

        ctx.fillStyle = theme.canvas;
        ctx.fillRect(0, 0, width, height);

        ctx.font = canvasFont(theme, 11, 'mono');
        ctx.fillStyle = theme.muted;
        ctx.strokeStyle = theme.grid;
        ctx.lineWidth = 1;
        ctx.textAlign = 'center';
        for (let deg = 0; deg <= 90; deg += 15) {
            ctx.beginPath();
            ctx.moveTo(X(deg), pad.t);
            ctx.lineTo(X(deg), pad.t + ph);
            ctx.stroke();
            ctx.fillText(`${deg}°`, X(deg), height - 6);
        }
        ctx.textAlign = 'right';
        for (const i of [0, 0.5, 1]) ctx.fillText(i.toFixed(1), pad.l - 6, Y(i) + 4);

        // Curve, filled
        ctx.beginPath();
        for (let px = 0; px <= pw; px++) {
            const deg = (px / pw) * 90;
            const y = Y(intensity(planes, phaseStep(d, deg, lambda)));
            if (px === 0) ctx.moveTo(pad.l + px, y);
            else ctx.lineTo(pad.l + px, y);
        }
        ctx.strokeStyle = theme.series[0];
        ctx.lineWidth = 1.75;
        ctx.stroke();
        ctx.lineTo(pad.l + pw, Y(0));
        ctx.lineTo(pad.l, Y(0));
        ctx.closePath();
        ctx.fillStyle = withAlpha(theme.series[0], 0.12);
        ctx.fill();

        // Order labels
        ctx.font = canvasFont(theme, 11);
        ctx.fillStyle = theme.text;
        for (const { order, theta: th } of braggAngles(d, lambda)) ctx.fillText(`n=${order}`, X(th), pad.t - 8);

        // Current angle
        const cur = intensity(planes, phaseStep(d, theta, lambda));
        ctx.strokeStyle = theme.series[1];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(X(theta), pad.t);
        ctx.lineTo(X(theta), pad.t + ph);
        ctx.stroke();
        ctx.fillStyle = theme.series[1];
        ctx.beginPath();
        ctx.arc(X(theta), Y(cur), 4.5, 0, Math.PI * 2);
        ctx.fill();
    }, [width, height, lambda, d, theta, planes, theme]);

    return (
        <canvas
            ref={ref}
            role="img"
            aria-label="Reflected intensity against angle; click to set the angle"
            style={{ display: 'block', cursor: 'pointer' }}
            onClick={(e) => {
                const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
                const deg = ((e.clientX - rect.left - pad.l) / (rect.width - pad.l - pad.r)) * 90;
                onSelectTheta(Math.min(89, Math.max(1, Math.round(deg * 10) / 10)));
            }}
        />
    );
}
