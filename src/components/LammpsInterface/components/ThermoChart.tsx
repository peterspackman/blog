import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import type * as echarts from 'echarts';
import { echartsAxis, echartsBase, useVizTheme } from '../../shared/viz';
import { Legend } from '../../shared/controls';
import styles from '../LammpsInterface.module.css';
import { useEChart } from '../../shared/viz/useEChart';

interface ThermoData {
  step: number[];
  columns: string[]; // original header names (excluding Step)
  series: Record<string, number[]>; // column name -> values
  runBoundaries: number[]; // step values where a "Loop" ended (between runs)
}

interface ThermoChartProps {
  output: Array<{ text: string; isError: boolean }>;
  isRunning: boolean;
}

// Columns to skip plotting (not useful as time series)
const SKIP_COLUMNS = new Set(['cpu', 'cpuleft', 'time']);

// Default columns to enable when first detected
const DEFAULT_ENABLED = [
  'temp', 'poteng', 'pe', 'toteng', 'etotal', 'kineng', 'ke',
  'press', 'volume', 'vol',
];

// Each selected column gets its own stacked panel (own y scale, shared steps).
const MAX_SELECTED = 4;
const DEFAULT_SELECTED = 3;

// Parse thermo output from LAMMPS console output
const parseThermoOutput = (output: Array<{ text: string; isError: boolean }>): ThermoData => {
  const data: ThermoData = {
    step: [],
    columns: [],
    series: {},
    runBoundaries: [],
  };

  let headerFound = false;
  let headers: string[] = [];
  let stepIndex = 0;

  for (const line of output) {
    if (line.isError) continue;
    const text = line.text.trim();

    // Check for header line (must contain "Step" as a column)
    const words = text.split(/\s+/);
    if (words.length >= 2 && words.some(w => w === 'Step')) {
      headerFound = true;
      const newStepIndex = words.indexOf('Step');
      const newColumns = words.filter((_, i) => i !== newStepIndex);

      // Only reset data if the columns changed (e.g. different thermo_style).
      // When columns match, keep appending so multiple runs are stitched together.
      const columnsChanged = newColumns.join(',') !== data.columns.join(',');
      headers = words;
      stepIndex = newStepIndex;
      if (columnsChanged) {
        data.columns = newColumns;
        data.series = {};
        data.step = [];
        for (const col of data.columns) {
          data.series[col] = [];
        }
      }
      continue;
    }

    // Stop collecting data when we hit "Loop time of ..."
    if (headerFound && text.startsWith('Loop')) {
      headerFound = false;
      // Record the last step as a run boundary
      if (data.step.length > 0) {
        data.runBoundaries.push(data.step[data.step.length - 1]);
      }
      continue;
    }

    // Parse data lines
    if (headerFound) {
      const parts = text.split(/\s+/);
      if (parts.length === headers.length && /^-?\d+$/.test(parts[stepIndex])) {
        const step = parseInt(parts[stepIndex]);
        if (!isNaN(step)) {
          data.step.push(step);
          for (let i = 0; i < headers.length; i++) {
            if (i === stepIndex) continue;
            const col = headers[i];
            const val = parseFloat(parts[i]);
            data.series[col].push(isNaN(val) ? 0 : val);
          }
        }
      }
    }
  }

  return data;
};

export const ThermoChart: React.FC<ThermoChartProps> = ({ output, isRunning }) => {
  const theme = useVizTheme();
  const [chartRef, chart] = useEChart();
  // Selected columns, oldest first; shown as stacked panels in column order.
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const prevColumnsRef = useRef<string>('');

  const thermoData = useMemo(() => parseThermoOutput(output), [output]);
  const hasData = thermoData.step.length > 0;

  // Plottable columns (exclude things like CPU, CPULeft, Time)
  const plottableColumns = useMemo(
    () => thermoData.columns.filter(c => !SKIP_COLUMNS.has(c.toLowerCase())),
    [thermoData.columns],
  );

  // Auto-select default columns when new columns appear
  useEffect(() => {
    const key = plottableColumns.join(',');
    if (key === prevColumnsRef.current) return;
    prevColumnsRef.current = key;

    if (plottableColumns.length === 0) return;

    // Pick the first few defaults that are present in plottable columns
    const defaults: string[] = [];
    for (const col of plottableColumns) {
      if (DEFAULT_ENABLED.includes(col.toLowerCase()) && defaults.length < DEFAULT_SELECTED) {
        defaults.push(col);
      }
    }
    // If nothing matched defaults, pick the first plottable columns
    if (defaults.length === 0) {
      defaults.push(...plottableColumns.slice(0, DEFAULT_SELECTED));
    }
    setSelectedColumns(defaults);
  }, [plottableColumns]);

  const toggleColumn = useCallback((col: string) => {
    setSelectedColumns(prev => {
      if (prev.includes(col)) return prev.filter(c => c !== col);
      // Select, dropping the oldest if already at max
      if (prev.length >= MAX_SELECTED) return [...prev.slice(1), col];
      return [...prev, col];
    });
  }, []);

  // Colour for each column from the site series palette
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    plottableColumns.forEach((col, i) => {
      map[col] = theme.series[i % theme.series.length];
    });
    return map;
  }, [plottableColumns, theme]);

  useEffect(() => {
    if (!chart) return;

    const activeCols = plottableColumns.filter(c => selectedColumns.includes(c));
    if (!hasData || activeCols.length === 0) {
      chart.clear();
      return;
    }

    const axis = echartsAxis(theme);
    const n = activeCols.length;
    // Stacked panels in percent of the chart height: room above each panel for
    // its name, and below the last for the step labels.
    const top = 7;
    const bottom = 12;
    const gap = n > 1 ? 9 : 0;
    const height = (100 - top - bottom - gap * (n - 1)) / n;
    const stepLabels = thermoData.step.map(String);
    const formatStep = (value: string) => {
      const num = parseInt(value);
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
      return value;
    };

    // Vertical markers at run boundaries (between multiple "run" commands)
    const boundaryMarkLine = thermoData.runBoundaries.length > 0 ? {
      silent: true,
      symbol: 'none',
      lineStyle: { type: 'dashed' as const, color: theme.axis, width: 1 },
      label: { show: false },
      data: thermoData.runBoundaries.map(step => ({ xAxis: String(step) })),
    } : undefined;

    const option: echarts.EChartsOption = {
      ...echartsBase(theme),
      animation: false,
      grid: activeCols.map((_, i) => ({
        // Fixed margins so the panels' plot areas line up
        left: 64,
        right: 24,
        top: `${top + i * (height + gap)}%`,
        height: `${height}%`,
      })),
      tooltip: {
        ...echartsBase(theme).tooltip,
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: theme.axis } },
      },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      xAxis: activeCols.map((_, i) => {
        const last = i === n - 1;
        return {
          ...axis,
          type: 'category' as const,
          gridIndex: i,
          data: stepLabels,
          boundaryGap: false,
          splitLine: { show: false },
          axisLabel: { ...axis.axisLabel, show: last, formatter: formatStep },
          ...(last ? { name: 'Step', nameLocation: 'middle' as const, nameGap: 26 } : {}),
        };
      }),
      yAxis: activeCols.map((col, i) => ({
        ...axis,
        type: 'value' as const,
        gridIndex: i,
        scale: true,
        splitNumber: 3,
        name: col,
        nameLocation: 'end' as const,
        nameGap: 8,
        nameTextStyle: { ...axis.nameTextStyle, color: theme.text, fontWeight: 600, align: 'left' as const, padding: [0, 0, 0, -56] },
      })),
      series: activeCols.map((col, i) => ({
        name: col,
        type: 'line' as const,
        xAxisIndex: i,
        yAxisIndex: i,
        data: thermoData.series[col],
        symbol: 'none',
        itemStyle: { color: colorMap[col] },
        lineStyle: { color: colorMap[col], width: 1.75 },
        ...(boundaryMarkLine ? { markLine: boundaryMarkLine } : {}),
      })),
    };

    chart.setOption(option, true);
  }, [chart, theme, thermoData, hasData, selectedColumns, plottableColumns, colorMap]);

  return (
    <div className={styles.chartPane}>
      {hasData && (
        <Legend
          className={styles.chartToolbar}
          items={plottableColumns.map(col => ({
            key: col,
            label: col,
            color: colorMap[col],
            active: selectedColumns.includes(col),
          }))}
          onToggle={toggleColumn}
        />
      )}
      <div className={styles.chartCanvas}>
        <div ref={chartRef} className={styles.chartFill} />
        {!hasData && (
          <div className={styles.chartEmpty}>
            {isRunning ? 'Waiting for thermo data…' : 'Run a simulation to plot its thermo output.'}
          </div>
        )}
      </div>
    </div>
  );
};
