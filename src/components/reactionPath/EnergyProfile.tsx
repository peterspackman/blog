import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { echartsAxis, echartsBase, echartsLegend, useVizTheme } from '../shared/viz';
import { useEChart } from '../shared/viz/useEChart';
import { energyAt, type ConformerPath, type PathCursor, type Progress } from './path';
import styles from './ReactionPath.module.css';

type LabelPosition = 'top' | 'bottom' | 'left' | 'right';

export interface ProfileCurve {
    key: string;
    /** Legend entry; curves without one stay out of the legend. */
    name?: string;
    path: ConformerPath;
    /** Maps the path onto the shared x. */
    progress: Progress;
    color: string;
    /** Short label per stationary point, in path order. */
    labels: string[];
    /** Where each stationary point's label sits; above transition states and below minima by default. */
    labelPosition?: (point: number) => LabelPosition;
}

export interface EnergyProfileProps {
    curves: ProfileCurve[];
    /** In the shared x. */
    cursor: PathCursor;
    xName: string;
    /** Tick labels on the x axis (off for a unitless progress). */
    xTicks?: boolean;
    /** Scrubbing started (the page stops playback). */
    onScrubStart: () => void;
    ariaLabel: string;
}

/** Pixels within which a click lands on a stationary point rather than between images. */
const SNAP_PX = 14;

/**
 * Energy along one or more paths: the NEB images as small dots, the
 * stationary points labelled, and a marker per curve at the cursor. Click or
 * drag anywhere to move along the paths.
 */
export function EnergyProfile({ curves, cursor, xName, xTicks = true, onScrubStart, ariaLabel }: EnergyProfileProps) {
    const theme = useVizTheme();
    const onScrubStartRef = useRef(onScrubStart);
    onScrubStartRef.current = onScrubStart;

    const xMax = useMemo(() => Math.max(...curves.map((c) => c.progress.fromS(c.path.length))), [curves]);
    // A point is active when the cursor sits on it (Prev/Next and snapping land exactly).
    const tolerance = xMax * 0.004;
    const pointX = (c: ProfileCurve, k: number) => c.progress.fromS(c.path.s[c.path.points[k].frame]);
    const activeX = useSyncExternalStore(
        cursor.subscribe,
        () => {
            const x = cursor.get();
            for (const c of curves) for (let k = 0; k < c.path.points.length; k++) if (Math.abs(pointX(c, k) - x) <= tolerance) return pointX(c, k);
            return null;
        },
        () => null,
    );

    const option = useMemo(() => {
        const all = curves.flatMap((c) => c.path.energies);
        const minE = Math.min(...all), maxE = Math.max(...all);
        const pad = xMax * 0.05;
        const x0 = cursor.get();
        const series = curves.flatMap((c) => {
            const { path, progress } = c;
            const points = path.points.map((p, k) => {
                const active = activeX !== null && Math.abs(pointX(c, k) - activeX) <= tolerance;
                const position = c.labelPosition?.(k) ?? (p.kind === 'ts' || k === 0 || k === path.points.length - 1 ? 'top' : 'bottom');
                return {
                    value: [pointX(c, k), path.energies[p.frame]],
                    symbol: p.kind === 'ts' ? 'diamond' : 'circle',
                    symbolSize: active ? 13 : 10,
                    itemStyle: { color: active ? c.color : theme.surface, borderColor: c.color, borderWidth: 1.5 },
                    label: {
                        show: true,
                        position,
                        distance: 8,
                        formatter: `${c.labels[k]}\n${path.energies[p.frame].toFixed(1)}`,
                        color: active ? theme.text : theme.muted,
                        fontWeight: active ? 600 : 400,
                        fontFamily: theme.fontSans,
                        fontSize: 12,
                        lineHeight: 15,
                        align: position === 'left' ? 'right' : position === 'right' ? 'left' : 'center',
                    },
                };
            });
            const s0 = progress.toS(x0);
            return [
                {
                    id: `${c.key}-path`,
                    name: c.name,
                    type: 'line',
                    data: path.s.map((s, i) => [progress.fromS(s), path.energies[i]]),
                    showSymbol: true,
                    symbol: 'circle',
                    symbolSize: 4,
                    lineStyle: { color: c.color, width: 2 },
                    itemStyle: { color: c.color },
                    silent: true,
                    z: 1,
                },
                { id: `${c.key}-points`, type: 'scatter', data: points, silent: true, z: 3 },
                {
                    id: `${c.key}-cursor`,
                    type: 'scatter',
                    data: [[x0, energyAt(path, s0)]],
                    symbolSize: 9,
                    itemStyle: { color: theme.text },
                    silent: true,
                    z: 4,
                },
            ];
        });
        series.push({
            id: 'cursor-line',
            type: 'line',
            data: [],
            silent: true,
            markLine: {
                silent: true,
                symbol: 'none',
                label: { show: false },
                lineStyle: { color: theme.axis, type: 'dashed', width: 1 },
                data: [{ xAxis: x0 }],
            },
        } as never);
        const named = curves.filter((c) => c.name);
        return {
            ...echartsBase(theme),
            animation: false,
            legend: named.length ? { ...echartsLegend(theme), data: named.map((c) => c.name), top: 0, right: 12 } : undefined,
            grid: { left: 52, right: 20, top: 34, bottom: 44 },
            xAxis: {
                ...echartsAxis(theme),
                type: 'value',
                name: xName,
                nameLocation: 'middle',
                nameGap: xTicks ? 26 : 12,
                // Margin either side for the end points' labels.
                min: -pad,
                max: xMax + pad,
                axisLabel: { ...echartsAxis(theme).axisLabel, show: xTicks, showMinLabel: false, showMaxLabel: false },
                axisTick: { show: xTicks },
                splitLine: { show: false },
            },
            yAxis: {
                ...echartsAxis(theme),
                type: 'value',
                name: 'Energy (kJ/mol)',
                nameLocation: 'middle',
                nameGap: 36,
                // At the plot's left edge, not wherever x = 0 falls.
                axisLine: { ...echartsAxis(theme).axisLine, onZero: false },
                // Room past the lowest and highest points for their labels, without tick labels there.
                min: Math.floor((minE - 10) / 10) * 10,
                max: Math.ceil((maxE + 12) / 10) * 10,
                axisLabel: { ...echartsAxis(theme).axisLabel, formatter: (v: number) => (v < minE - 1 || v > maxE + 1 ? '' : String(v)) },
            },
            series,
        };
        // The cursor markers' later moves are applied below without rebuilding.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [curves, activeX, xMax, xName, xTicks, theme]);

    const [ref, chart] = useEChart(option);

    useEffect(() => {
        if (!chart) return;
        const move = () => {
            const x = cursor.get();
            chart.setOption({
                series: [
                    ...curves.map((c) => ({ id: `${c.key}-cursor`, data: [[x, energyAt(c.path, c.progress.toS(x))]] })),
                    { id: 'cursor-line', markLine: { data: [{ xAxis: x }] } },
                ],
            });
        };
        return cursor.subscribe(move);
    }, [chart, cursor, curves]);

    useEffect(() => {
        if (!chart) return;
        const zr = chart.getZr();
        let dragging = false;
        const toX = (px: number, py: number, snap: boolean) => {
            if (snap) {
                for (const c of curves) {
                    for (let k = 0; k < c.path.points.length; k++) {
                        const x = pointX(c, k);
                        const [qx, qy] = chart.convertToPixel({ gridIndex: 0 }, [x, c.path.energies[c.path.points[k].frame]]);
                        if (Math.hypot(qx - px, qy - py) <= SNAP_PX) return x;
                    }
                }
            }
            const [x] = chart.convertFromPixel({ gridIndex: 0 }, [px, py]);
            return Math.min(xMax, Math.max(0, x));
        };
        const inGrid = (x: number, y: number) => chart.containPixel({ gridIndex: 0 }, [x, y]);
        const down = (e: { offsetX: number; offsetY: number }) => {
            if (!inGrid(e.offsetX, e.offsetY)) return;
            dragging = true;
            onScrubStartRef.current();
            cursor.set(toX(e.offsetX, e.offsetY, true));
        };
        const move = (e: { offsetX: number; offsetY: number }) => {
            zr.setCursorStyle(inGrid(e.offsetX, e.offsetY) ? 'pointer' : 'default');
            if (dragging) cursor.set(toX(e.offsetX, e.offsetY, false));
        };
        const up = () => {
            dragging = false;
        };
        zr.on('mousedown', down);
        zr.on('mousemove', move);
        zr.on('mouseup', up);
        zr.on('globalout', up);
        return () => {
            zr.off('mousedown', down);
            zr.off('mousemove', move);
            zr.off('mouseup', up);
            zr.off('globalout', up);
        };
        // pointX reads only the curves.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chart, cursor, curves, xMax]);

    return <div ref={ref} className={styles.profile} role="img" aria-label={ariaLabel} />;
}
