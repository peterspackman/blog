import React from 'react';
import styles from './VizThumbs.module.css';

/*
 * Small previews of each visualisation for the index page: a thin outline
 * and a few flat, translucent shapes from the page's physics, on a 240 x 120
 * viewBox in theme colours. They move (CSS only) while their card is
 * hovered or focused, and never with reduced motion.
 */

const W = 240;
const H = 120;
type Pt = [number, number];
const path = (pts: Pt[], close = false) =>
    'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + (close ? 'Z' : '');
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const vars = (v: Record<string, string | number>) => v as React.CSSProperties;

/** Deterministic pseudo-random numbers so previews render identically on server and client. */
function rng(seed: number) {
    let s = seed;
    return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

function Svg({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.thumb} role="img" aria-label={label}>
            {children}
        </svg>
    );
}

/** Soft lobes: three nested flat ellipses each, alternating in strength. */
function Lobes({ centres, rx, ry, signs }: { centres: Pt[]; rx: number; ry: number; signs?: number[] }) {
    return (
        <>
            {centres.map(([x, y], i) => (
                <g key={i} className={styles.slosh} style={vars({ '--delay': i % 2 ? '-2s' : '0s' })}>
                    {[1, 0.7, 0.42].map((r) => (
                        <ellipse
                            key={r}
                            cx={x}
                            cy={y}
                            rx={rx * r}
                            ry={ry * r}
                            className={signs ? (signs[i] > 0 ? styles.cloudPositive : styles.cloudNegative) : styles.cloud}
                        />
                    ))}
                </g>
            ))}
        </>
    );
}

// Harmonic well with |ψ_n|² for the lowest three states sitting on their levels.
function Qm1d() {
    const cx = W / 2, base = 112, sx = 22, k = 14;
    const well = range(81)
        .map((i): Pt => {
            const x = -4.4 + (8.8 * i) / 80;
            return [cx + x * sx, base - k * x * x];
        })
        .filter(([, y]) => y > 4);
    const herm = [() => 1, (x: number) => Math.SQRT2 * x, (x: number) => (2 * x * x - 1) / Math.SQRT2];
    return (
        <Svg label="Harmonic well with the probability densities of its lowest states">
            <path d={path(well)} className={styles.line} />
            {[0, 1, 2].map((n) => {
                const level = base - k * 2 * (n + 0.5);
                const half = Math.sqrt(2 * (n + 0.5)) + 1.6;
                const pts = range(81).map((i): Pt => {
                    const x = -half + (2 * half * i) / 80;
                    const p = herm[n](x) * Math.exp(-x * x / 2);
                    return [cx + x * sx, level - 26 * p * p];
                });
                const l = (cx - half * sx).toFixed(1), r = (cx + half * sx).toFixed(1);
                return (
                    <g key={n} className={styles.slosh} style={vars({ '--delay': `${-n * 0.7}s` })}>
                        <line x1={l} x2={r} y1={level} y2={level} className={styles.faint} />
                        <path d={`${path(pts)}L${r} ${level}L${l} ${level}Z`} className={styles.cloud} />
                    </g>
                );
            })}
        </Svg>
    );
}

// Square box with the (2, 1) state's two lobes, density sloshing between them.
function Qm2d() {
    const s = 96, x0 = (W - s) / 2, y0 = (H - s) / 2;
    return (
        <Svg label="Probability density in a square box">
            <rect x={x0} y={y0} width={s} height={s} className={styles.line} />
            <Lobes centres={[[x0 + s / 4, y0 + s / 2], [x0 + (3 * s) / 4, y0 + s / 2]]} rx={20} ry={30} />
        </Svg>
    );
}

// Cubic box with probability sloshing between two lobes.
function Qm3d() {
    const c: Pt = [W / 2, H / 2 + 6], s = 50;
    const iso = (x: number, y: number, z: number): Pt => [c[0] + (x - z) * s * 0.87, c[1] + (x + z) * s * 0.5 - y * s];
    const v = [0, 1].flatMap((x) => [0, 1].flatMap((y) => [0, 1].map((z) => iso(x - 0.5, y - 0.5, z - 0.5))));
    const edges = [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]];
    return (
        <Svg label="Probability cloud of a particle in a cubic box">
            {edges.map(([a, b], i) => (
                <line key={i} x1={v[a][0]} y1={v[a][1]} x2={v[b][0]} y2={v[b][1]} className={styles.line} />
            ))}
            <Lobes centres={[iso(-0.22, 0, 0), iso(0.22, 0, 0)]} rx={20} ry={16} />
        </Svg>
    );
}

// A p orbital: two lobes of opposite sign, turning slowly.
function Hydrogen() {
    const cx = W / 2, cy = H / 2;
    return (
        <Svg label="A p orbital, with lobes of opposite sign">
            <g className={styles.spin}>
                <Lobes centres={[[cx, cy - 25], [cx, cy + 25]]} rx={19} ry={24} signs={[1, -1]} />
            </g>
        </Svg>
    );
}

// Hückel chain: N levels on the band E(k) = 2β cos k, the lower half filled.
function Bands() {
    const x0 = 60, x1 = 180, top = 16, bottom = 104, n = 8;
    const y = (k: number) => (top + bottom) / 2 - 2 * Math.cos(k) * ((bottom - top) / 4.2);
    const band = range(61).map((i): Pt => [x0 + ((x1 - x0) * i) / 60, y((Math.PI * i) / 60)]);
    return (
        <Svg label="Molecular orbital levels lying on an energy band">
            <path d={path(band)} className={styles.line} />
            {range(n).map((j) => {
                const k = ((j + 1) * Math.PI) / (n + 1);
                const x = x0 + ((x1 - x0) * k) / Math.PI;
                return <circle key={j} cx={x} cy={y(k)} r={3.5} className={j < n / 2 ? styles.dot : styles.dotOpen} />;
            })}
        </Svg>
    );
}

// Planes of atoms, an incoming beam and its reflections from the first two planes.
function Bragg() {
    const rows = [64, 84, 104];
    const hx = W / 2, theta = 0.5;
    const ray = (y: number): Pt[] => {
        const dx = (y - 10) / Math.tan(theta);
        return [[hx - dx, 10], [hx, y], [hx + dx, 10]];
    };
    return (
        <Svg label="X-rays reflecting from planes of atoms">
            {rows.map((y) => range(13).map((i) => <circle key={`${y}-${i}`} cx={24 + i * 16} cy={y} r={2.2} className={styles.atom} />))}
            <path d={path(ray(rows[0]))} className={styles.ray} />
            <path d={path(ray(rows[1]))} className={`${styles.ray} ${styles.rayFaint}`} />
        </Svg>
    );
}

// Reciprocal lattice spots, sized by intensity.
function Diffraction() {
    const spots: { x: number; y: number; r: number; i: number }[] = [];
    for (let h = -5; h <= 5; h++) {
        for (let k = -2; k <= 2; k++) {
            const I = (0.3 + Math.cos((Math.PI * (h + 2 * k)) / 3) ** 2) * Math.exp(-(h * h + 3 * k * k) / 20);
            if (I < 0.06) continue;
            spots.push({ x: W / 2 + h * 18 + k * 6, y: H / 2 + k * 20, r: 1.5 + 4.5 * Math.sqrt(I), i: h + k });
        }
    }
    return (
        <Svg label="Diffraction spots on a reciprocal lattice">
            {spots.map((s, n) => (
                <circle key={n} cx={s.x} cy={s.y} r={s.r} className={`${styles.spot} ${styles.twinkle}`} style={vars({ '--delay': `${-((s.i + 10) % 7) * 0.35}s` })} />
            ))}
        </Svg>
    );
}

// γ-plot and the truncated-square Wulff shape it gives.
function Wulff() {
    const cx = W / 2, cy = H / 2, s = 30, eps = 0.18;
    const gamma = (t: number) => 1 + eps * Math.abs(Math.sin(2 * t));
    const g = range(181).map((i): Pt => {
        const t = (2 * Math.PI * i) / 180;
        return [cx + gamma(t) * s * 1.4 * Math.cos(t), cy + gamma(t) * s * 1.4 * Math.sin(t)];
    });
    const b = (1 + eps) * Math.SQRT2 - 1;
    const oct: Pt[] = [[1, b], [b, 1], [-b, 1], [-1, b], [-1, -b], [-b, -1], [b, -1], [1, -b]].map(([x, y]) => [cx + x * s, cy + y * s]);
    return (
        <Svg label="Surface energy plot and the resulting Wulff shape">
            <path d={path(g, true)} className={styles.line} />
            <path d={path(oct, true)} className={`${styles.shape} ${styles.slosh}`} />
        </Svg>
    );
}

// A plane wave and its two Fourier spots.
function Fourier() {
    const s = 84, y0 = (H - s) / 2, xl = 26, xr = W - 26 - s;
    return (
        <Svg label="A plane wave and its Fourier transform">
            <clipPath id="fourier-thumb-clip">
                <rect x={xl} y={y0} width={s} height={s} />
            </clipPath>
            <g clipPath="url(#fourier-thumb-clip)">
                <g className={styles.slide}>
                    {range(10).map((i) => (
                        <rect key={i} x={xl - 60 + i * 20} y={y0 - 40} width={10} height={s + 80} transform="skewX(-30)" className={styles.cloud} />
                    ))}
                </g>
            </g>
            <rect x={xl} y={y0} width={s} height={s} className={styles.line} />
            <rect x={xr} y={y0} width={s} height={s} className={styles.line} />
            {[-1, 0, 1].map((k) => (
                <circle key={k} cx={xr + s / 2 + k * 15} cy={H / 2 + k * 8.7} r={k ? 4 : 2.5} className={k ? styles.dot : styles.atom} />
            ))}
        </Svg>
    );
}

// Particles in a box.
function Md() {
    const r = rng(7);
    const parts = range(24).map((i) => ({ x: 46 + r() * 148, y: 16 + r() * 88, dx: (r() - 0.5) * 8, dy: (r() - 0.5) * 8, t: 1.3 + r() * 1.2, b: i % 3 === 0 }));
    return (
        <Svg label="Particles in a molecular dynamics simulation box">
            <rect x={36} y={6} width={168} height={108} className={styles.line} />
            {parts.map((p, i) => (
                <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={p.b ? 5 : 4}
                    className={`${p.b ? styles.particleB : styles.particle} ${styles.jiggle}`}
                    style={vars({ '--dx': `${p.dx.toFixed(1)}px`, '--dy': `${p.dy.toFixed(1)}px`, '--period': `${p.t.toFixed(2)}s` })}
                />
            ))}
        </Svg>
    );
}

// Slit pore: particles adsorbed along both walls, a few coming and going.
function Gcmc() {
    const r = rng(11);
    const parts = range(22).map(() => {
        const u = r();
        const y = u < 0.4 ? 20 + r() * 3 : u < 0.8 ? 97 + r() * 3 : 40 + r() * 40;
        return { x: 30 + r() * 180, y, blink: r() < 0.35, delay: r() * 3 };
    });
    return (
        <Svg label="Particles adsorbing in a slit pore">
            <line x1={20} x2={220} y1={12.5} y2={12.5} className={styles.line} />
            <line x1={20} x2={220} y1={107.5} y2={107.5} className={styles.line} />
            {parts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={4} className={`${styles.particle} ${p.blink ? styles.blink : ''}`} style={vars({ '--delay': `-${p.delay.toFixed(2)}s` })} />
            ))}
        </Svg>
    );
}

export const VIZ_THUMBS: Record<string, React.FC> = {
    '/qm1d': Qm1d,
    '/qm2d': Qm2d,
    '/qm3d': Qm3d,
    '/spherical-harmonics': Hydrogen,
    '/bandstructure': Bands,
    '/bragg': Bragg,
    '/diffraction': Diffraction,
    '/wulff': Wulff,
    '/fourier': Fourier,
    '/md': Md,
    '/gcmc': Gcmc,
};
