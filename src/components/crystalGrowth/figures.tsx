import React, { lazy, Suspense, useMemo } from 'react';
import clsx from 'clsx';
import type * as echarts from 'echarts';
import { echartsAxis, echartsBase, echartsLegend, useContainerSize, useVizTheme, type VizTheme } from '../shared/viz';
import { useEChart } from '../shared/viz/useEChart';
import { wulff3D, type WulffShape3D } from '../wulff/geometry';
import { bestCut, fitExcess, wulffPlanes, type CGFace, type CGResult } from './parse';
import styles from './CrystalGrowth.module.css';

const Wulff3D = lazy(() => import('../wulff/Wulff3D'));

/** (1 0 -1) -> "(1 0 1̄)" */
export function millerLabel(hkl: number[]): string {
    return `(${hkl.map((x) => (x < 0 ? `${-x}̅` : String(x))).join(' ')})`;
}

const fmt = (x: number, dp = 1) => (Math.abs(x) < 0.5 * 10 ** -dp ? 0 : x).toFixed(dp).replace('-', '−');

function Chart({ option, height }: { option: echarts.EChartsCoreOption | null; height: number }) {
    const [ref] = useEChart(option);
    return <div ref={ref} style={{ width: '100%', height }} />;
}

/* Pair interactions ---------------------------------------------------- */

/** Axis ranges shared by every solvent, so cycling changes the data, not the scale. */
export interface Extents {
    pair: [number, number];
    gamma: [number, number];
    finite: [number, number];
}

const floorTo = (x: number, step: number) => Math.floor(x / step) * step;
const ceilTo = (x: number, step: number) => Math.ceil(x / step) * step;

export function sharedExtents(results: CGResult[]): Extents {
    let pLo = 0, pHi = 0, gLo = Infinity, gHi = -Infinity, fLo = 0, fHi = 0;
    for (const r of results) {
        for (const p of r.pairs) {
            const parts = [p.eCrys, p.eNN, -p.eSolv];
            const neg = parts.filter((x) => x < 0).reduce((a, x) => a + x, 0);
            const pos = parts.filter((x) => x > 0).reduce((a, x) => a + x, 0);
            pLo = Math.min(pLo, neg, -p.eInt);
            pHi = Math.max(pHi, pos, -p.eInt);
        }
        for (const f of r.faces) {
            for (const c of f.cuts) {
                for (const g of [c.gammaSolv, c.gammaVac]) {
                    gLo = Math.min(gLo, g);
                    gHi = Math.max(gHi, g);
                }
            }
        }
        for (const x of r.samples) {
            for (const v of [x.excess, x.surface, x.edge, x.corner]) {
                fLo = Math.min(fLo, v / x.n);
                fHi = Math.max(fHi, v / x.n);
            }
        }
    }
    if (!Number.isFinite(gLo)) [gLo, gHi] = [0, 0.3];
    return {
        pair: [floorTo(pLo, 10), ceilTo(pHi, 10)],
        gamma: [Math.max(0, floorTo(gLo, 0.05)), ceilTo(gHi, 0.05)],
        finite: [floorTo(fLo, 10), ceilTo(fHi, 10)],
    };
}

export function PairFigure({ result, extents }: { result: CGResult; extents?: Extents }) {
    const theme = useVizTheme();
    const option = useMemo(() => {
        // Attractive is negative here, as in the paper: ΔG_i = E_crys + E_nn − E_S.
        // Categories run bottom-up, so this puts the most attractive contact on top.
        // Categories run bottom-up. Order by the solvent-independent crystal energy so rows
        // keep their place when the solvent changes; the most attractive is on top.
        const pairs = [...result.pairs].sort((a, b) => b.eCrys + b.eNN - (a.eCrys + a.eNN));
        const cats = pairs.map((p) => `${p.rc.toFixed(2)} Å  ×${p.count}`);
        const bar = (name: string, color: string, values: number[]) => ({
            name, type: 'bar', stack: 'g', barWidth: '58%', data: values,
            itemStyle: { color, borderColor: theme.surface, borderWidth: 1, borderRadius: 2 },
            emphasis: { focus: 'series' },
        });
        return {
            ...echartsBase(theme),
            legend: { ...echartsLegend(theme), top: 0, left: 0, itemWidth: 12, itemHeight: 8 },
            grid: { left: 96, right: 16, top: 34, bottom: 36 },
            tooltip: {
                ...echartsBase(theme).tooltip,
                trigger: 'axis', axisPointer: { type: 'shadow' },
                formatter: (items: { dataIndex: number }[]) => {
                    const p = pairs[items[0].dataIndex];
                    return [
                        `<b>${p.symop}</b> &nbsp;R<sub>c</sub> ${p.rc.toFixed(2)} Å, ×${p.count}`,
                        `crystal ${fmt(p.eCrys)}`,
                        `long-range share ${fmt(p.eNN)}`,
                        `desolvation ${fmt(-p.eSolv)}`,
                        `<b>growth ΔG ${fmt(-p.eInt)}</b> kJ/mol`,
                    ].join('<br/>');
                },
            },
            xAxis: {
                ...echartsAxis(theme), type: 'value', name: 'kJ/mol', nameLocation: 'middle', nameGap: 24,
                min: extents?.pair[0], max: extents?.pair[1],
            },
            yAxis: { ...echartsAxis(theme), type: 'category', data: cats, axisTick: { show: false } },
            series: [
                bar('crystal', theme.series[0], pairs.map((p) => p.eCrys)),
                bar('long-range share', theme.series[2], pairs.map((p) => p.eNN)),
                bar('desolvation', theme.series[1], pairs.map((p) => -p.eSolv)),
                {
                    name: 'growth ΔG', type: 'scatter', symbol: 'diamond', symbolSize: 11, z: 5,
                    data: pairs.map((p) => -p.eInt),
                    itemStyle: { color: theme.text, borderColor: theme.surface, borderWidth: 2 },
                },
            ],
        };
    }, [result, theme, extents]);
    return <Chart option={option} height={Math.max(260, 60 + result.pairs.length * 30)} />;
}

/* Surface energies by termination -------------------------------------- */

export function SurfaceFigure({ result, extents }: { result: CGResult; extents?: Extents }) {
    const theme = useVizTheme();
    const solventName = solventLabel(result.solvent);
    const option = useMemo(() => {
        const faces = [...result.faces].sort((a, b) => b.d - a.d);
        const cats = faces.map((f) => millerLabel(f.hkl));
        const all = (which: 'solv' | 'vac') =>
            faces.flatMap((f, i) => f.cuts.map((c) => [i, which === 'solv' ? c.gammaSolv : c.gammaVac, c.offset]));
        const best = (which: 'solv' | 'vac') =>
            faces.map((f, i) => {
                const c = bestCut(f, which);
                return c ? [i, which === 'solv' ? c.gammaSolv : c.gammaVac, c.offset] : [i, null, null];
            });
        const others = (name: string, color: string, data: unknown[]) => ({
            name, type: 'scatter', data, symbolSize: 7, symbol: 'circle',
            itemStyle: { color: 'transparent', borderColor: color, borderWidth: 1.25, opacity: 0.55 },
        });
        const chosen = (name: string, color: string, data: unknown[]) => ({
            name, type: 'scatter', data, symbolSize: 10, z: 4,
            itemStyle: { color, borderColor: theme.surface, borderWidth: 2 },
        });
        return {
            ...echartsBase(theme),
            legend: {
                ...echartsLegend(theme), top: 0, left: 0, itemWidth: 10, itemHeight: 10,
                data: [solventName, 'vacuum'],
            },
            grid: { left: 52, right: 12, top: 34, bottom: 64 },
            tooltip: {
                ...echartsBase(theme).tooltip,
                trigger: 'item',
                formatter: (p: { seriesName: string; value: number[] }) => {
                    const f = faces[p.value[0]];
                    return `<b>${millerLabel(f.hkl)}</b> d = ${f.d.toFixed(2)} Å<br/>${p.seriesName.replace(' (other cuts)', '')}, cut at t = ${p.value[2].toFixed(3)}<br/>γ = ${p.value[1].toFixed(3)} J/m²`;
                },
            },
            xAxis: {
                ...echartsAxis(theme), type: 'category', data: cats,
                axisLabel: { ...echartsAxis(theme).axisLabel, rotate: 55, interval: 0 },
                splitLine: { show: true, lineStyle: { color: theme.grid } },
            },
            yAxis: {
                ...echartsAxis(theme), type: 'value', name: 'γ (J/m²)', nameLocation: 'middle', nameGap: 38, scale: true,
                min: extents?.gamma[0], max: extents?.gamma[1],
            },
            series: [
                others(`${solventName} (other cuts)`, theme.series[0], all('solv')),
                others('vacuum (other cuts)', theme.series[1], all('vac')),
                chosen(solventName, theme.series[0], best('solv')),
                chosen('vacuum', theme.series[1], best('vac')),
            ],
        };
    }, [result, theme, solventName, extents]);
    return <Chart option={option} height={340} />;
}

/* Equilibrium shapes ----------------------------------------------------- */

function familyColors(theme: VizTheme, faces: CGFace[], areas: number[][]) {
    // Colour follows the face, not its rank in any one shape: order by the
    // largest area fraction it reaches anywhere, first eight get a hue, the rest grey.
    const frac = faces.map((_, i) => Math.max(...areas.map((a) => a[i] ?? 0)));
    const order = faces.map((_, i) => i).filter((i) => frac[i] > 0.005).sort((a, b) => frac[b] - frac[a]);
    const colors = faces.map(() => theme.axis);
    order.slice(0, theme.series.length).forEach((f, k) => {
        colors[f] = theme.series[k];
    });
    return { colors, shown: order };
}

export interface WulffSet {
    vac: WulffShape3D;
    solv: Record<string, WulffShape3D>;
    /** Area fraction of each face, keyed by 'vacuum' or solvent. */
    fractions: Record<string, number[]>;
    /** One colour per face, shared by every shape so it follows the face. */
    colors: string[];
    /** Faces with a hue, largest first. */
    shown: number[];
}

const fractionsOf = (s: WulffShape3D, n: number) =>
    Array.from({ length: n }, (_, i) => (s.familyArea[i] ?? 0) / s.totalArea);

/** Wulff shapes for vacuum and every solvent computed so far (all share one set of faces). */
export function useWulffSet(results: Record<string, CGResult>): WulffSet | null {
    const theme = useVizTheme();
    const shapes = useMemo(() => {
        const solvents = Object.keys(results);
        if (!solvents.length) return null;
        const first = results[solvents[0]];
        const vac = wulff3D(wulffPlanes(first, 'vac'), 10);
        const solv: Record<string, WulffShape3D> = {};
        for (const s of solvents) solv[s] = wulff3D(wulffPlanes(results[s], 'solv'), 10);
        const n = first.faces.length;
        const fractions: Record<string, number[]> = { vacuum: fractionsOf(vac, n) };
        for (const s of solvents) fractions[s] = fractionsOf(solv[s], n);
        return { vac, solv, fractions, faces: first.faces };
    }, [results]);
    return useMemo(() => {
        if (!shapes) return null;
        const { colors, shown } = familyColors(theme, shapes.faces, Object.values(shapes.fractions));
        return { vac: shapes.vac, solv: shapes.solv, fractions: shapes.fractions, colors, shown: shown.slice(0, theme.series.length) };
    }, [shapes, theme]);
}

export function WulffShapes({ result, data }: { result: CGResult; data: WulffSet }) {
    const theme = useVizTheme();
    const [ref, size] = useContainerSize();
    const gap = 12;
    const narrow = size.width < 560;
    const w = narrow ? size.width : Math.floor((size.width - gap) / 2);
    const h = Math.max(260, Math.min(440, Math.round(w * 0.9)));
    const panels = [
        { key: 'vac', label: 'in vacuum', shape: data.vac },
        { key: 'solv', label: `in ${solventLabel(result.solvent)}`, shape: data.solv[result.solvent] },
    ];
    return (
        <div>
            <div ref={ref} className={styles.wulffRow} style={{ gap }}>
                {w > 0 &&
                    panels.map((p) => (
                        <figure key={p.key} className={styles.wulffPanel}>
                            <figcaption className={styles.wulffLabel}>{p.label}</figcaption>
                            <Suspense fallback={<div style={{ height: h }} />}>
                                <Wulff3D
                                    width={w}
                                    height={h}
                                    shape={p.shape}
                                    colors={data.colors}
                                    edgeColor={theme.text}
                                    background={theme.surfaceSubtle}
                                    showEdges
                                />
                            </Suspense>
                        </figure>
                    ))}
            </div>
            <ul className={styles.faceLegend}>
                {data.shown.map((i) => (
                    <li key={i}>
                        <span className={styles.swatch} style={{ background: data.colors[i] }} />
                        {millerLabel(result.faces[i].hkl)}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function FacetTable({ result, data }: { result: CGResult; data: WulffSet }) {
    const name = solventLabel(result.solvent);
    const frac = data.fractions[result.solvent];
    return (
        <div className={styles.tableScroll}>
            <table className={styles.facetTable}>
                <thead>
                    <tr>
                        <th>face</th>
                        <th>d (Å)</th>
                        <th>γ vacuum (J/m²)</th>
                        <th>γ {name} (J/m²)</th>
                        <th>area, vacuum</th>
                        <th>area, {name}</th>
                    </tr>
                </thead>
                <tbody>
                    {data.shown.map((i) => {
                        const f = result.faces[i];
                        return (
                            <tr key={i}>
                                <td>
                                    <span className={styles.swatch} style={{ background: data.colors[i] }} />
                                    {millerLabel(f.hkl)}
                                </td>
                                <td>{f.d.toFixed(2)}</td>
                                <td>{bestCut(f, 'vac')?.gammaVac.toFixed(3) ?? '–'}</td>
                                <td>{bestCut(f, 'solv')?.gammaSolv.toFixed(3) ?? '–'}</td>
                                <td>{pct(data.fractions.vacuum[i])}</td>
                                <td>{pct(frac?.[i] ?? 0)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

/** One row per solvent; click a row to show that solvent. */
export function SolventTable({
    results,
    order,
    data,
    selected,
    onSelect,
}: {
    results: Record<string, CGResult>;
    order: string[];
    data: WulffSet;
    selected: string;
    onSelect: (solvent: string) => void;
}) {
    const signed = (x: number, dp: number) => x.toFixed(dp).replace('-', '−');
    return (
        <div className={styles.tableScroll}>
            <table className={styles.facetTable}>
                <thead>
                    <tr>
                        <th>solvent</th>
                        <th>ΔG solv (kJ/mol)</th>
                        <th>ΔG sol (kJ/mol)</th>
                        <th>log S₀</th>
                        <th>largest faces</th>
                    </tr>
                </thead>
                <tbody>
                    {order.map((s) => {
                        const r = results[s];
                        const frac = data.fractions[s];
                        const top = frac
                            .map((f, i) => [f, i] as const)
                            .sort((a, b) => b[0] - a[0])
                            .slice(0, 2);
                        return (
                            <tr
                                key={s}
                                className={clsx(styles.clickRow, s === selected && styles.selectedRow)}
                                onClick={() => onSelect(s)}
                                aria-selected={s === selected}
                            >
                                <td>{solventLabel(s)}</td>
                                <td>{signed(r.totals.solvation, 1)}</td>
                                <td>{signed(r.totals.dGsol, 1)}</td>
                                <td>{signed(r.totals.logS, 2)}</td>
                                <td>
                                    {top.map(([f, i]) => (
                                        <span key={i} className={styles.topFace}>
                                            <span className={styles.swatch} style={{ background: data.colors[i] }} />
                                            {millerLabel(r.faces[i].hkl)} {pct(f)}
                                        </span>
                                    ))}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export const solventLabel = (s: string) =>
    s === 'ethylethanoate' ? 'ethyl acetate' : s === 'dimethylsulfoxide' ? 'DMSO' : s;

const pct = (x: number) => (x > 0.0005 ? `${(100 * x).toFixed(1)}%` : '–');

/* Finite particles -------------------------------------------------------- */

export function FiniteFigure({ result, extents }: { result: CGResult; extents?: Extents }) {
    const theme = useVizTheme();
    const fit = useMemo(() => fitExcess(result.samples), [result]);
    const option = useMemo(() => {
        const s = result.samples;
        const line = (name: string, color: string, values: number[], width = 2) => ({
            name, type: 'line', data: s.map((x, i) => [x.n, values[i]]), symbol: 'circle', symbolSize: 7,
            lineStyle: { color, width }, itemStyle: { color, borderColor: theme.surface, borderWidth: 1.5 },
        });
        const nMin = s[0]?.n ?? 100;
        const nMax = s[s.length - 1]?.n ?? 1e5;
        const curve: number[][] = [];
        if (fit) {
            for (let k = 0; k <= 60; k++) {
                const n = nMin * (nMax / nMin) ** (k / 60);
                curve.push([n, fit.a * n ** (-1 / 3) + fit.b * n ** (-2 / 3) + fit.c / n]);
            }
        }
        return {
            ...echartsBase(theme),
            legend: { ...echartsLegend(theme), top: 0, left: 0, itemWidth: 14, itemHeight: 8 },
            grid: { left: 52, right: 16, top: 34, bottom: 44 },
            tooltip: {
                ...echartsBase(theme).tooltip, trigger: 'axis',
                valueFormatter: (v: number) => `${v.toFixed(2)} kJ/mol`,
            },
            xAxis: {
                ...echartsAxis(theme), type: 'log', name: 'molecules in the particle, N', nameLocation: 'middle', nameGap: 28,
                min: nMin * 0.8, max: nMax * 1.25,
                axisLabel: { ...echartsAxis(theme).axisLabel, showMinLabel: false, showMaxLabel: false, formatter: (v: number) => (v >= 1000 ? `${v / 1000}k` : String(v)) },
            },
            yAxis: {
                ...echartsAxis(theme), type: 'value', name: 'kJ/mol per molecule', nameLocation: 'middle', nameGap: 38,
                min: extents?.finite[0], max: extents?.finite[1],
            },
            series: [
                line('excess', theme.text, s.map((x) => x.excess / x.n), 2.5),
                line('surface', theme.series[0], s.map((x) => x.surface / x.n)),
                line('edge', theme.series[1], s.map((x) => x.edge / x.n)),
                line('corner', theme.series[2], s.map((x) => x.corner / x.n)),
                ...(fit
                    ? [{
                        name: 'fit', type: 'line', data: curve, showSymbol: false, smooth: false,
                        lineStyle: { color: theme.muted, width: 1.25, type: 'dashed' }, itemStyle: { color: theme.muted },
                        tooltip: { show: false },
                    }]
                    : []),
            ],
        };
    }, [result, theme, fit, extents]);
    return (
        <div>
            <Chart option={option} height={320} />
            {fit && (
                <p className={styles.fitReadout}>
                    a = {fmt(fit.a, 0)}, b = {fmt(fit.b, 0)}, c = {fmt(fit.c, 0)} kJ/mol
                </p>
            )}
        </div>
    );
}
