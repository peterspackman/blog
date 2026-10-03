import React, { useEffect, useRef } from 'react';
import { useVizTheme, type VizTheme } from './theme';
import { usePrefersReducedMotion } from './hooks';
import styles from './VizThumbs.module.css';

/*
 * Small previews of each visualisation for the index page. Each one renders
 * a real field or plot from its page's physics onto a 240 x 120 canvas,
 * shaded in theme colours. A preview is drawn once, and animates only while
 * its card is hovered or focused (never with reduced motion).
 */

const W = 240;
const H = 120;
type RGB = [number, number, number];
type Draw = (g: { ctx: CanvasRenderingContext2D; theme: VizTheme; t: number; field: FieldFn }) => void;
type FieldFn = (f: (x: number, y: number) => number, pos: RGB, neg?: RGB, opts?: { gamma?: number; alpha?: number }) => void;

const rgb = (hex: string): RGB => {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a: RGB, b: RGB, s: number): string =>
    `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * s)).join(',')})`;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Deterministic pseudo-random numbers, so a preview looks the same on every load. */
function rng(seed: number) {
    let s = seed;
    return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

/** A small shaded sphere, lit from the upper left. */
function sphere(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: RGB, alpha = 1) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, mix(c, [255, 255, 255], 0.55));
    g.addColorStop(0.65, mix(c, c, 0));
    g.addColorStop(1, mix(c, [0, 0, 0], 0.3));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fill();
    ctx.globalAlpha = 1;
}

function CanvasThumb({ draw, label }: { draw: Draw; label: string }) {
    const ref = useRef<HTMLCanvasElement>(null);
    const theme = useVizTheme();
    const reduced = usePrefersReducedMotion();

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        // Fields are computed at 1 px per logical unit and smoothly upscaled.
        const off = document.createElement('canvas');
        off.width = W;
        off.height = H;
        const octx = off.getContext('2d')!;
        const img = octx.createImageData(W, H);

        const field: FieldFn = (f, pos, neg, opts = {}) => {
            const gamma = opts.gamma ?? 0.8;
            const amax = (opts.alpha ?? 0.92) * 255;
            const d = img.data;
            for (let j = 0; j < H; j++) {
                for (let i = 0; i < W; i++) {
                    const v = f(i + 0.5, j + 0.5);
                    const k = 4 * (j * W + i);
                    const c = v < 0 && neg ? neg : pos;
                    d[k] = c[0];
                    d[k + 1] = c[1];
                    d[k + 2] = c[2];
                    d[k + 3] = Math.min(1, Math.abs(v)) ** gamma * amax;
                }
            }
            octx.putImageData(img, 0, 0);
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(off, 0, 0, W, H);
        };

        let t = 0;
        let last = 0;
        let raf = 0;
        let running = false;
        const render = () => {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);
            draw({ ctx, theme, t, field });
        };
        const frame = (now: number) => {
            if (last) t += Math.min(0.05, (now - last) / 1000);
            last = now;
            render();
            if (running) raf = requestAnimationFrame(frame);
        };
        const start = () => {
            if (reduced || running) return;
            running = true;
            last = 0;
            raf = requestAnimationFrame(frame);
        };
        const stop = () => {
            running = false;
            cancelAnimationFrame(raf);
        };
        render();
        const card = canvas.closest('a') ?? canvas;
        card.addEventListener('mouseenter', start);
        card.addEventListener('mouseleave', stop);
        card.addEventListener('focus', start);
        card.addEventListener('blur', stop);
        return () => {
            stop();
            card.removeEventListener('mouseenter', start);
            card.removeEventListener('mouseleave', stop);
            card.removeEventListener('focus', start);
            card.removeEventListener('blur', stop);
        };
    }, [draw, theme, reduced]);

    return <canvas ref={ref} className={styles.canvas} role="img" aria-label={label} />;
}

// --- The previews -----------------------------------------------------------

// Quantum carpet: |Ψ(x, t)|² for a superposition of the lowest three harmonic
// oscillator states, x across and time down, scrolling as time runs.
const carpet: Draw = ({ theme, t, field }) => {
    const c = [1, 0.8, 0.5];
    const norm = Math.hypot(...c);
    field((px, py) => {
        const x = ((px - W / 2) / W) * 9;
        const tau = (py / H) * 3 * Math.PI + t * 1.2;
        const g = Math.PI ** -0.25 * Math.exp(-x * x / 2);
        const phi = [g, Math.SQRT2 * x * g, ((2 * x * x - 1) / Math.SQRT2) * g];
        let re = 0, im = 0;
        for (let n = 0; n < 3; n++) {
            const e = (n + 0.5) * tau;
            re += c[n] * phi[n] * Math.cos(e);
            im -= c[n] * phi[n] * Math.sin(e);
        }
        return (re * re + im * im) / (norm * norm) / 0.75;
    }, rgb(theme.accent), undefined, { gamma: 0.9 });
};

// Particle in a square box: |Ψ(x, y, t)|² of four low states, sloshing.
const box2d: Draw = ({ ctx, theme, t, field }) => {
    const side = 104, x0 = (W - side) / 2, y0 = (H - side) / 2;
    const states: [number, number, number][] = [[1, 1, 1], [2, 1, 0.8], [1, 2, 0.8], [2, 2, 0.6]];
    const norm = states.reduce((s, [, , c]) => s + c * c, 0);
    field((px, py) => {
        const x = (px - x0) / side, y = (py - y0) / side;
        if (x < 0 || x > 1 || y < 0 || y > 1) return 0;
        let re = 0, im = 0;
        for (const [n, m, c] of states) {
            const a = c * Math.sin(n * Math.PI * x) * Math.sin(m * Math.PI * y);
            const e = (n * n + m * m) * t * 0.5;
            re += a * Math.cos(e);
            im -= a * Math.sin(e);
        }
        return (re * re + im * im) / norm / 1.5;
    }, rgb(theme.accent));
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, side - 1, side - 1);
};

// Slice through a hydrogen 3d_z² orbital in the xz plane, turning slowly.
const hydrogen: Draw = ({ theme, t, field }) => {
    const a = t * 0.4, ca = Math.cos(a), sa = Math.sin(a);
    field((px, py) => {
        const u = (px - W / 2) * 0.36, v = (py - H / 2) * 0.36;
        const x = u * ca - v * sa, z = u * sa + v * ca;
        const r2 = x * x + z * z, r = Math.sqrt(r2);
        // r² e^{-r/3} (3cos²θ − 1) = e^{-r/3} (3z² − r²); max ≈ 9.7
        return (Math.exp(-r / 3) * (3 * z * z - r2)) / 9.7;
    }, rgb(theme.positive), rgb(theme.negative), { gamma: 1 });
};

// Hückel chain of 7 atoms: each row is one orbital (highest energy at the
// top), its nodes increasing with energy; rows flicker at their own energies.
const huckel: Draw = ({ theme, t, field }) => {
    const n = 7, rowH = H / n;
    field((px, py) => {
        const row = Math.floor(py / rowH);
        const within = py / rowH - row;
        if (within < 0.2 || within > 0.8 || px < 24 || px > W - 24) return 0;
        const j = n - row;
        const s = ((px - 24) / (W - 48)) * (n + 1);
        const e = 2 * Math.cos((j * Math.PI) / (n + 1));
        return Math.sin((j * Math.PI * s) / (n + 1)) * Math.cos(e * t * 1.5);
    }, rgb(theme.positive), rgb(theme.negative), { gamma: 0.7 });
};

// Incident and reflected waves above a crystal's planes: a standing wave
// across z, travelling along the surface.
const bragg: Draw = ({ ctx, theme, t, field }) => {
    const surface = 80, theta = 0.5, k = 0.16;
    const kx = k * Math.cos(theta), kz = k * Math.sin(theta);
    field((px, py) => {
        if (py > surface) return 0;
        const fade = Math.min(1, (surface - py) / 6 + 0.2);
        return Math.cos(kx * px - t * 3) * Math.cos(kz * (surface - py)) * fade;
    }, rgb(theme.positive), rgb(theme.negative), { gamma: 1.1, alpha: 0.6 });
    const atom = rgb(theme.muted);
    for (const [row, y] of [surface + 8, surface + 22, surface + 36].entries()) {
        for (let i = 0; i < 16; i++) sphere(ctx, 8 + i * 15 + (row % 2) * 7.5, y, 4, atom, 0.85);
    }
};

// Reciprocal lattice of an oblique crystal; spots near the Ewald circle light up
// as the crystal rocks.
const diffraction: Draw = ({ ctx, theme, t }) => {
    const c = rgb(theme.accent);
    const rock = 0.12 * Math.sin(t * 0.9);
    const R = 150;
    const cx = W / 2, cy = H / 2;
    for (let h = -7; h <= 7; h++) {
        for (let k = -3; k <= 3; k++) {
            const gx0 = h * 16 + k * 7, gy0 = k * 17;
            const gx = gx0 * Math.cos(rock) - gy0 * Math.sin(rock);
            const gy = gx0 * Math.sin(rock) + gy0 * Math.cos(rock);
            const x = cx + gx, y = cy + gy;
            if (x < 4 || x > W - 4 || y < 4 || y > H - 4) continue;
            const F = Math.cos((Math.PI * (h + 2 * k)) / 3) ** 2 + 0.15;
            const excitation = Math.abs(Math.hypot(gx, gy + R) - R);
            const I = F * (0.18 + 0.82 * Math.exp(-(excitation * excitation) / 30)) * Math.exp(-(gx * gx + gy * gy) / 9000);
            const r = 2.5 + 6 * Math.sqrt(I);
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, `rgba(${c.join(',')},${Math.min(1, 0.25 + I * 2)})`);
            g.addColorStop(1, `rgba(${c.join(',')},0)`);
            ctx.fillStyle = g;
            ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
        }
    }
};

// Wulff shape from a cusped γ(θ) = 1 + ε|sin 2θ|, as ε grows from nearly
// isotropic (round) to strongly faceted (square).
const wulff: Draw = ({ ctx, theme, t }) => {
    const eps = 0.03 + 0.35 * (0.5 - 0.5 * Math.cos(t * 0.9 + 1.2));
    const gamma = (th: number) => 1 + eps * Math.abs(Math.sin(2 * th));
    const cx = W / 2, cy = H / 2, s = 34;
    const normals = range(180).map((i) => (2 * Math.PI * i) / 180);
    const shape = range(240).map((i) => {
        const phi = (2 * Math.PI * i) / 240;
        let r = Infinity;
        for (const th of normals) {
            const c = Math.cos(phi - th);
            if (c > 1e-3) r = Math.min(r, gamma(th) / c);
        }
        return [cx + r * s * Math.cos(phi), cy + r * s * Math.sin(phi)] as const;
    });
    const fill = rgb(theme.accent);
    const grad = ctx.createRadialGradient(cx - 10, cy - 12, 4, cx, cy, s * 1.4);
    grad.addColorStop(0, `rgba(${fill.join(',')},0.10)`);
    grad.addColorStop(1, `rgba(${fill.join(',')},0.38)`);
    ctx.beginPath();
    shape.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.beginPath();
    normals.forEach((th, i) => {
        const x = cx + gamma(th) * s * 1.42 * Math.cos(th), y = cy + gamma(th) * s * 1.42 * Math.sin(th);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = theme.muted;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
};

// Hexagonal pattern from three plane waves (left) and its Fourier transform (right).
const fourier: Draw = ({ ctx, theme, t, field }) => {
    const rot = t * 0.25, k = 0.24;
    const ks = [0, 1, 2].map((i) => {
        const a = rot + (i * 2 * Math.PI) / 3;
        return [k * Math.cos(a), k * Math.sin(a)];
    });
    const side = 100, x0 = 12, y0 = (H - side) / 2;
    field((px, py) => {
        const x = px - x0 - side / 2, y = py - y0 - side / 2;
        if (Math.abs(x) > side / 2 || Math.abs(y) > side / 2) return 0;
        return ks.reduce((s, [kx, ky]) => s + Math.cos(kx * x + ky * y), 0) / 3;
    }, rgb(theme.positive), rgb(theme.negative), { gamma: 0.8, alpha: 0.85 });
    const fx = W - 12 - side / 2, fy = H / 2;
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(W - 12 - side + 0.5, y0 + 0.5, side - 1, side - 1);
    const c = rgb(theme.accent);
    const spots = [[0, 0], ...ks.flatMap(([kx, ky]) => [[kx, ky], [-kx, -ky]])];
    for (const [kx, ky] of spots) {
        const x = fx + (kx / k) * 30, y = fy + (ky / k) * 30, r = kx || ky ? 7 : 9;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${c.join(',')},0.95)`);
        g.addColorStop(1, `rgba(${c.join(',')},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
};

// A Lennard-Jones liquid: shaded particles of two species, jostling.
const mdParticles = (() => {
    const r = rng(7);
    return range(34).map((i) => ({ x: 14 + r() * 212, y: 10 + r() * 100, p: r() * 6.28, q: r() * 6.28, w: 1 + r() * 1.5, s: i % 3 === 0 ? 1 : 0 }));
})();
const md: Draw = ({ ctx, theme, t }) => {
    const cols = [rgb(theme.series[0]), rgb(theme.series[1])];
    const sorted = [...mdParticles].sort((a, b) => a.y - b.y);
    for (const p of sorted) {
        sphere(ctx, p.x + 3 * Math.sin(p.w * t * 2 + p.p), p.y + 3 * Math.cos(p.w * t * 1.7 + p.q), p.s ? 6.5 : 5.5, cols[p.s]);
    }
};

// Slit pore: adsorbed layers near both walls, with molecules inserted and deleted.
const gcmcParticles = (() => {
    const r = rng(11);
    return range(30).map(() => {
        const layer = r();
        const y = layer < 0.38 ? 25 + r() * 4 : layer < 0.76 ? 91 + r() * 4 : 40 + r() * 40;
        return { x: 10 + r() * 220, y, p: r() * 6.28, blink: r() < 0.4 };
    });
})();
const gcmc: Draw = ({ ctx, theme, t, field }) => {
    // Average density across the pore: peaks one layer in from each wall.
    field((_, py) => {
        const layer = (y: number) => Math.exp(-((py - y) ** 2) / 40);
        return py < 18 || py > 102 ? 0 : 0.55 * (layer(27) + layer(93)) + 0.12;
    }, rgb(theme.accent), undefined, { alpha: 0.35 });
    ctx.fillStyle = theme.surfaceSubtle;
    ctx.strokeStyle = theme.border;
    for (const y of [0, 102]) {
        ctx.fillRect(0, y, W, 18);
        ctx.beginPath();
        ctx.moveTo(0, y ? y + 0.5 : 17.5);
        ctx.lineTo(W, y ? y + 0.5 : 17.5);
        ctx.stroke();
    }
    const c = rgb(theme.series[0]);
    for (const p of gcmcParticles) {
        const alpha = p.blink ? Math.max(0, Math.min(1, 1.6 * Math.cos(t * 1.4 + p.p) + 0.6)) : 1;
        if (alpha > 0.02) sphere(ctx, p.x, p.y, 5, c, alpha);
    }
};

// Cubic box with probability sloshing between two lobes (vector, static shape).
function Qm3d() {
    const c: [number, number] = [W / 2, H / 2 + 6], s = 50;
    const iso = (x: number, y: number, z: number): [number, number] => [c[0] + (x - z) * s * 0.87, c[1] + (x + z) * s * 0.5 - y * s];
    const v = [0, 1].flatMap((x) => [0, 1].flatMap((y) => [0, 1].map((z) => iso(x - 0.5, y - 0.5, z - 0.5))));
    const edges = [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]];
    const lobes = [iso(-0.22, 0, 0), iso(0.22, 0, 0)];
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.canvas} role="img" aria-label="Probability cloud of a particle in a cubic box">
            {edges.map(([a, b], i) => (
                <line key={i} x1={v[a][0]} y1={v[a][1]} x2={v[b][0]} y2={v[b][1]} className={styles.boxEdge} />
            ))}
            {lobes.map(([x, y], i) => (
                <g key={i} className={styles.slosh} style={{ animationDelay: i ? '-2s' : '0s' }}>
                    {[1, 0.7, 0.42].map((r) => (
                        <ellipse key={r} cx={x} cy={y} rx={20 * r} ry={16 * r} className={styles.cloud} />
                    ))}
                </g>
            ))}
        </svg>
    );
}

const thumb = (draw: Draw, label: string): React.FC => () => <CanvasThumb draw={draw} label={label} />;

export const VIZ_THUMBS: Record<string, React.FC> = {
    '/qm1d': thumb(carpet, 'Probability density of a harmonic oscillator superposition over time'),
    '/qm2d': thumb(box2d, 'Probability density of a superposition in a square box'),
    '/qm3d': Qm3d,
    '/spherical-harmonics': thumb(hydrogen, 'Slice through a hydrogen 3d orbital'),
    '/bandstructure': thumb(huckel, 'Molecular orbitals of a Hückel chain, ordered by energy'),
    '/bragg': thumb(bragg, 'Standing wave of X-rays above planes of atoms'),
    '/diffraction': thumb(diffraction, 'Diffraction spots of a rocking crystal'),
    '/wulff': thumb(wulff, 'Wulff shape changing with surface energy anisotropy'),
    '/fourier': thumb(fourier, 'A hexagonal wave pattern and its Fourier transform'),
    '/md': thumb(md, 'Particles in a Lennard-Jones liquid'),
    '/gcmc': thumb(gcmc, 'Particles adsorbing in a slit pore'),
};
