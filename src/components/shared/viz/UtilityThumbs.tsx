import React from 'react';
import styles from './VizThumbs.module.css';

/*
 * Previews for the utilities index, in the same style as the visualisation
 * previews: thin outlines and a few flat translucent shapes on a 240 x 120
 * viewBox, moving only while their card is hovered or focused.
 */

const W = 240;
const H = 120;
type Pt = [number, number];
const path = (pts: Pt[], close = false) =>
    'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + (close ? 'Z' : '');
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const vars = (v: Record<string, string | number>) => v as React.CSSProperties;
const add = (a: Pt, b: Pt, s = 1): Pt => [a[0] + b[0] * s, a[1] + b[1] * s];
const dir = (deg: number): Pt => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];

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

function Bond({ a, b, double = false, inner }: { a: Pt; b: Pt; double?: boolean; inner?: Pt }) {
    if (!double) return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className={styles.line} />;
    // Second line offset towards `inner` (a ring centre) or to one side, and shortened.
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    let nx = -dy / len, ny = dx / len;
    if (inner && (inner[0] - a[0]) * nx + (inner[1] - a[1]) * ny < 0) [nx, ny] = [-nx, -ny];
    const o = 3.5, trim = inner ? 0.15 : 0;
    const a2: Pt = [a[0] + nx * o + dx * trim, a[1] + ny * o + dy * trim];
    const b2: Pt = [b[0] + nx * o - dx * trim, b[1] + ny * o - dy * trim];
    return (
        <>
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className={styles.line} />
            <line x1={a2[0]} y1={a2[1]} x2={b2[0]} y2={b2[1]} className={styles.line} />
        </>
    );
}

/** Heteroatom label with a gap in the bonds behind it. */
function Atom({ at, label }: { at: Pt; label: string }) {
    return (
        <>
            <rect x={at[0] - 4.5 * label.length} y={at[1] - 6} width={9 * label.length} height={12} className={styles.labelGap} />
            <text x={at[0]} y={at[1]} className={styles.atomLabel}>{label}</text>
        </>
    );
}

// Formaldehyde with its π orbital: same-phase p lobes on C and O, above and below the plane.
function Wavefunction() {
    const C: Pt = [96, 60], O: Pt = [150, 60];
    const H1 = add(C, dir(210), 30), H2 = add(C, dir(150), 30);
    const lobe = (x: number, y: number, positive: boolean, delay: string) => (
        <g className={styles.slosh} style={vars({ '--delay': delay })}>
            {[1, 0.66].map((r) => (
                <ellipse key={r} cx={x} cy={y} rx={14 * r} ry={22 * r} className={positive ? styles.cloudPositive : styles.cloudNegative} />
            ))}
        </g>
    );
    return (
        <Svg label="Formaldehyde with its pi orbital">
            {lobe(C[0], C[1] - 25, true, '0s')}
            {lobe(O[0], O[1] - 25, true, '0s')}
            {lobe(C[0], C[1] + 25, false, '0s')}
            {lobe(O[0], O[1] + 25, false, '0s')}
            <Bond a={C} b={O} double />
            <Bond a={C} b={H1} />
            <Bond a={C} b={H2} />
            <Atom at={O} label="O" />
        </Svg>
    );
}

// Directional Young's modulus of silicon in the (001) plane, from its elastic
// constants, with a softer second material behind it.
function Elastic() {
    const cx = W / 2, cy = H / 2;
    // Si compliances (1/GPa): S11 = 7.68e-3, S12 = -2.14e-3, S44 = 12.6e-3
    const siE = (t: number) => {
        const l2m2 = (Math.cos(t) * Math.sin(t)) ** 2;
        return 1 / (7.68e-3 - 2 * (7.68e-3 + 2.14e-3 - 6.3e-3) * l2m2);
    };
    const curve = (r: (t: number) => number) =>
        range(121).map((i): Pt => {
            const t = (2 * Math.PI * i) / 120;
            return [cx + r(t) * Math.cos(t), cy + r(t) * Math.sin(t)];
        });
    return (
        <Svg label="Polar plot of the directional Young's modulus of silicon">
            <line x1={cx - 58} x2={cx + 58} y1={cy} y2={cy} className={styles.faint} />
            <line x1={cx} x2={cx} y1={cy - 56} y2={cy + 56} className={styles.faint} />
            <path d={path(curve(() => 24 * 1), true)} className={`${styles.shapeB} ${styles.slosh}`} style={vars({ '--delay': '-1s' })} />
            <path d={path(curve((t) => siE(t) * 0.3), true)} className={styles.shape} />
        </Svg>
    );
}

// Thermo output: temperature settling and total energy flat, in stacked panels.
function Lammps() {
    const r = rng(5);
    const x0 = 34, x1 = 206, n = 60;
    const temp = range(n).map((i): Pt => {
        const t = i / (n - 1);
        return [x0 + (x1 - x0) * t, 22 + 26 * (1 - Math.exp(-t * 9)) + (r() - 0.5) * 5];
    });
    const etot = range(n).map((i): Pt => [x0 + ((x1 - x0) * i) / (n - 1), 88 + (r() - 0.5) * 3]);
    return (
        <Svg label="Thermodynamic output from a LAMMPS run">
            <line x1={x0} x2={x1} y1={56.5} y2={56.5} className={styles.line} />
            <line x1={x0} x2={x1} y1={104.5} y2={104.5} className={styles.line} />
            <path d={path(temp)} className={`${styles.trace} ${styles.draw}`} pathLength={1} />
            <path d={path(etot)} className={`${styles.traceB} ${styles.draw}`} pathLength={1} />
        </Svg>
    );
}

// A bent triatomic relaxing from linear, frames ghosted, with a playback bar.
function Trajectory() {
    const centre: Pt = [W / 2, 52];
    const frames = range(5).map((k) => 180 - (k * (180 - 104)) / 4);
    return (
        <Svg label="Frames of a molecule relaxing during a geometry optimisation">
            {frames.map((angle, k) => {
                const half = angle / 2;
                const a = add(centre, dir(90 + half), 30);
                const b = add(centre, dir(90 - half), 30);
                return (
                    <g key={k} style={{ opacity: 0.2 + (0.8 * k) / 4 }}>
                        <g className={styles.twinkle} style={vars({ '--delay': `${-(4 - k) * 0.3}s` })}>
                            <line x1={centre[0]} y1={centre[1]} x2={a[0]} y2={a[1]} className={styles.line} />
                            <line x1={centre[0]} y1={centre[1]} x2={b[0]} y2={b[1]} className={styles.line} />
                            <circle cx={a[0]} cy={a[1]} r={4} className={styles.particle} />
                            <circle cx={b[0]} cy={b[1]} r={4} className={styles.particle} />
                            <circle cx={centre[0]} cy={centre[1]} r={6} className={styles.particleB} />
                        </g>
                    </g>
                );
            })}
            <line x1={40} x2={200} y1={104} y2={104} className={styles.line} />
            <circle cx={40 + 160 * 0.7} cy={104} r={3.5} className={styles.dot} />
        </Svg>
    );
}

// Aspirin as a skeletal formula.
function Smiles() {
    const c: Pt = [90, 74], R = 21, L = 21;
    const v = range(6).map((k) => add(c, dir(-90 + 60 * k), R));
    const acid = add(v[0], [0, -1], L);
    const oDouble = add(acid, dir(210), L);
    const oh = add(acid, dir(-30), L);
    const ester = add(v[1], dir(-30), L);
    const carbonyl = add(ester, dir(30), L);
    const o2 = add(carbonyl, [0, -1], L);
    const methyl = add(carbonyl, dir(-30) as Pt, L);
    return (
        <Svg label="Skeletal formula of aspirin">
            {range(6).map((k) => (
                <Bond key={k} a={v[k]} b={v[(k + 1) % 6]} double={k % 2 === 1} inner={c} />
            ))}
            <Bond a={v[0]} b={acid} />
            <Bond a={acid} b={oDouble} double />
            <Bond a={acid} b={oh} />
            <Bond a={v[1]} b={ester} />
            <Bond a={ester} b={carbonyl} />
            <Bond a={carbonyl} b={o2} double />
            <Bond a={carbonyl} b={methyl} />
            <Atom at={oDouble} label="O" />
            <Atom at={oh} label="OH" />
            <Atom at={ester} label="O" />
            <Atom at={o2} label="O" />
        </Svg>
    );
}

// A grid of small random skeletal fragments, fading in turn.
function Infinite() {
    const r = rng(23);
    const cols = 3, rows = 2, cw = 64, ch = 48, x0 = (W - cols * cw - (cols - 1) * 6) / 2, y0 = (H - rows * ch - 6) / 2;
    const tiles = range(cols * rows).map((i) => {
        const tx = x0 + (i % cols) * (cw + 6), ty = y0 + Math.floor(i / cols) * (ch + 6);
        const ring = r() < 0.4;
        const bonds: [Pt, Pt][] = [];
        let p: Pt = [tx + 10, ty + ch / 2 + 5];
        if (ring) {
            const c: Pt = [tx + 18, ty + ch / 2];
            const v = range(6).map((k) => add(c, dir(30 + 60 * k), 10));
            range(6).forEach((k) => bonds.push([v[k], v[(k + 1) % 6]]));
            p = v[0];
        }
        const n = 3 + Math.floor(r() * 3);
        let up = r() < 0.5;
        for (let k = 0; k < n; k++) {
            const q = add(p, dir(up ? -30 : 30), 11);
            if (q[0] > tx + cw - 4) break;
            bonds.push([p, q]);
            if (r() < 0.3) bonds.push([q, add(q, [0, up ? -1 : 1], 10)]);
            p = q;
            up = !up;
        }
        return { tx, ty, bonds, d: i };
    });
    return (
        <Svg label="A grid of generated molecules">
            {tiles.map((t) => (
                <g key={t.d}>
                    <rect x={t.tx} y={t.ty} width={cw} height={ch} className={styles.faintBox} />
                    <g className={styles.twinkle} style={vars({ '--delay': `${-t.d * 0.4}s` })}>
                        {t.bonds.map(([a, b], k) => (
                            <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className={styles.line} />
                        ))}
                    </g>
                </g>
            ))}
        </Svg>
    );
}

export const UTILITY_THUMBS: Record<string, React.FC> = {
    '/utilities/wavefunction-calculator': Wavefunction,
    '/utilities/elastic-tensor': Elastic,
    '/utilities/lammps-interface': Lammps,
    '/utilities/xyz-trajectory': Trajectory,
    '/utilities/smiles-viewer': Smiles,
    '/utilities/infinite-molecules': Infinite,
};
