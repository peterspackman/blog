import React, { useMemo } from 'react';
import type { ScfIteration } from '@peterspackman/ce-calc';
import type { OptimizationTrace } from '@peterspackman/ce-calc/occ/optimize.js';
import { echartsAxis, echartsBase, echartsLegend, useVizTheme } from '../../shared/viz';
import { useEChart } from '../../shared/viz/useEChart';
import styles from '../WavefunctionCalculator.module.css';

interface ConvergencePanelProps {
    scf: ScfIteration[];
    optimization: OptimizationTrace | undefined;
}

/** Smallest value drawn on the log axis, so an exact zero doesn't vanish. */
const LOG_FLOOR = 1e-14;

/**
 * Convergence of the latest SCF on a log axis. The energy itself barely moves
 * on screen, so plot what occ converges on: its convergence measure (the DIIS
 * error max|FDS−SDF|, or max|Δq| for GFN2-xTB's charges) from the first
 * iteration, and |ΔE| from the second, since it needs a previous energy.
 */
function scfOption(theme: ReturnType<typeof useVizTheme>, scf: ScfIteration[]) {
    // ce-calc leaves the time column NaN for GFN2-xTB rows, whose measure is max|Δq|.
    const tightBinding = scf.every((it) => Number.isNaN(it.time));
    const measure = scf.filter((it) => Number.isFinite(it.diisError)).map((it) => [it.iter, Math.max(it.diisError, LOG_FLOOR)]);
    const deltaE = scf.slice(1).map((it, i) => [it.iter, Math.max(Math.abs(it.energy - scf[i].energy), LOG_FLOOR)]);
    const symbols = scf.length < 40;
    return {
        ...echartsBase(theme),
        grid: { left: 56, right: 12, top: 44, bottom: 36 },
        title: { text: 'Latest SCF', left: 0, top: 0, textStyle: { fontSize: 12, color: theme.muted } },
        legend: { ...echartsLegend(theme), top: 18, left: 0, itemWidth: 14, itemHeight: 8, textStyle: { ...echartsLegend(theme).textStyle, fontSize: 11 } },
        tooltip: { trigger: 'axis', valueFormatter: (v: number) => v.toExponential(2) },
        xAxis: { ...echartsAxis(theme), type: 'value', name: 'iteration', nameLocation: 'middle', nameGap: 24, minInterval: 1, min: 1 },
        yAxis: { ...echartsAxis(theme), type: 'log', axisLabel: { ...echartsAxis(theme).axisLabel, formatter: (v: number) => v.toExponential(0) } },
        series: [
            { name: tightBinding ? 'max |Δq|' : 'DIIS error', type: 'line', data: measure, showSymbol: symbols, symbolSize: 4 },
            { name: '|ΔE| (Eh)', type: 'line', data: deltaE, showSymbol: symbols, symbolSize: 4 },
        ],
    };
}

function optOption(theme: ReturnType<typeof useVizTheme>, trace: OptimizationTrace) {
    const e0 = trace.frames[trace.frames.length - 1]?.energy ?? 0;
    const points = trace.frames.map((f, i) => [i, (f.energy - e0) * 2625.4996]);
    return {
        ...echartsBase(theme),
        grid: { left: 56, right: 12, top: 28, bottom: 36 },
        title: { text: 'Optimisation: E − E(final) (kJ/mol)', left: 0, top: 0, textStyle: { fontSize: 12, color: theme.muted } },
        tooltip: { trigger: 'axis', valueFormatter: (v: number) => v.toFixed(3) },
        xAxis: { ...echartsAxis(theme), type: 'value', name: 'step', nameLocation: 'middle', nameGap: 24, minInterval: 1 },
        yAxis: { ...echartsAxis(theme), type: 'value' },
        series: [{ type: 'line', data: points, showSymbol: true, symbolSize: 5, color: theme.series[1] }],
    };
}

export function ConvergencePanel({ scf, optimization }: ConvergencePanelProps) {
    const theme = useVizTheme();
    const scfChart = useMemo(() => (scf.length > 1 ? scfOption(theme, scf) : null), [theme, scf]);
    const optChart = useMemo(() => (optimization && optimization.frames.length > 1 ? optOption(theme, optimization) : null), [theme, optimization]);
    const [scfRef] = useEChart(scfChart);
    const [optRef] = useEChart(optChart);

    return (
        <div className={styles.inspectorBody}>
            {optimization && (
                <p className={styles.meta}>
                    Optimisation {optimization.converged ? 'converged' : 'did not converge'} in {optimization.steps} steps.
                </p>
            )}
            <div className={styles.charts}>
                <div ref={scfRef} className={styles.chart} hidden={!scfChart} />
                {!scfChart && <p className={styles.hint}>SCF iterations appear here as occ reports them.</p>}
                <div ref={optRef} className={styles.chart} hidden={!optChart} />
            </div>
        </div>
    );
}
