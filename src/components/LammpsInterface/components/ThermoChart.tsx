import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import * as echarts from 'echarts';
import styles from '../LammpsInterface.module.css';

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

const COLORS = [
  '#ee6666', '#5470c6', '#91cc75', '#fac858', '#73c0de',
  '#ea7ccc', '#3ba272', '#fc8452', '#9a60b4', '#5c7bd9',
];

// Columns to skip plotting (not useful as time series)
const SKIP_COLUMNS = new Set(['cpu', 'cpuleft', 'time']);

// Default columns to enable when first detected
const DEFAULT_ENABLED = [
  'temp', 'poteng', 'pe', 'toteng', 'etotal', 'kineng', 'ke',
  'press', 'volume', 'vol',
];

const MAX_SELECTED = 2;

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
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  // Ordered array of selected columns (max 2). First = left axis, second = right axis.
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

    // Pick the first 2 defaults that are present in plottable columns
    const defaults: string[] = [];
    for (const col of plottableColumns) {
      if (DEFAULT_ENABLED.includes(col.toLowerCase()) && defaults.length < MAX_SELECTED) {
        defaults.push(col);
      }
    }
    // If nothing matched defaults, pick first two plottable columns
    if (defaults.length === 0) {
      defaults.push(...plottableColumns.slice(0, MAX_SELECTED));
    }
    setSelectedColumns(defaults);
  }, [plottableColumns]);

  const toggleColumn = useCallback((col: string) => {
    setSelectedColumns(prev => {
      if (prev.includes(col)) {
        // Deselect
        return prev.filter(c => c !== col);
      }
      // Select — enforce FIFO if already at max
      if (prev.length >= MAX_SELECTED) {
        return [...prev.slice(1), col];
      }
      return [...prev, col];
    });
  }, []);

  // Color assignment for each column
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    plottableColumns.forEach((col, i) => {
      map[col] = COLORS[i % COLORS.length];
    });
    return map;
  }, [plottableColumns]);

  // Initialize chart
  useEffect(() => {
    if (!chartRef.current) return;
    chartInstance.current = echarts.init(chartRef.current);
    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
    };
  }, []);

  // Update chart
  useEffect(() => {
    if (!chartInstance.current || !hasData) return;

    const activeCols = plottableColumns.filter(c => selectedColumns.includes(c));
    if (activeCols.length === 0) {
      chartInstance.current.clear();
      return;
    }

    const useDual = activeCols.length === 2;

    const yAxisConfigs: any[] = [{
      type: 'value',
      position: 'left',
      axisLine: { show: true, lineStyle: { color: colorMap[activeCols[0]] } },
      axisLabel: { formatter: '{value}' },
    }];

    if (useDual) {
      yAxisConfigs.push({
        type: 'value',
        position: 'right',
        axisLine: { show: true, lineStyle: { color: colorMap[activeCols[1]] } },
        axisLabel: { formatter: '{value}' },
      });
    }

    // Vertical markers at run boundaries (between multiple "run" commands)
    const boundaryMarkLine = thermoData.runBoundaries.length > 0 ? {
      silent: true,
      symbol: 'none',
      lineStyle: {
        type: 'dashed' as const,
        color: 'var(--ifm-color-emphasis-400)',
        width: 1,
      },
      label: { show: false },
      data: thermoData.runBoundaries.map(step => ({
        xAxis: String(step),
      })),
    } : undefined;

    const series = activeCols.map((col, idx) => ({
      name: col,
      type: 'line',
      yAxisIndex: useDual ? idx : 0,
      data: thermoData.series[col],
      smooth: true,
      symbol: 'none',
      itemStyle: { color: colorMap[col] },
      lineStyle: { color: colorMap[col], width: 2 },
      // Attach boundary markers to the first series only
      ...(idx === 0 && boundaryMarkLine ? { markLine: boundaryMarkLine } : {}),
    }));

    const option: echarts.EChartsOption = {
      animation: false,
      grid: {
        left: '12%',
        right: useDual ? '12%' : '5%',
        top: '10%',
        bottom: '15%',
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      xAxis: {
        type: 'category',
        data: thermoData.step.map(String),
        name: 'Step',
        nameLocation: 'middle',
        nameGap: 25,
        axisLabel: {
          formatter: (value: string) => {
            const num = parseInt(value);
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
            return value;
          },
        },
      },
      yAxis: yAxisConfigs,
      series: series as any[],
    };

    chartInstance.current.setOption(option, true);
  }, [thermoData, hasData, selectedColumns, plottableColumns, colorMap]);

  if (!hasData) {
    return (
      <div className={styles.thermoChartEmpty}>
        <span>{isRunning ? 'Waiting for thermo data...' : 'No thermo data'}</span>
      </div>
    );
  }

  return (
    <div className={styles.thermoChart}>
      <div className={styles.thermoColumnSelector}>
        {plottableColumns.map(col => {
          const active = selectedColumns.includes(col);
          return (
            <button
              key={col}
              className={`${styles.thermoColumnChip} ${active ? styles.thermoColumnChipActive : ''}`}
              onClick={() => toggleColumn(col)}
              title={active ? 'Click to deselect' : 'Click to select (max 2)'}
            >
              <span
                className={styles.thermoColumnDot}
                style={{ background: active ? colorMap[col] : 'var(--ifm-color-emphasis-400)' }}
              />
              {col}
            </button>
          );
        })}
      </div>
      <div ref={chartRef} style={{ flex: 1, width: '100%', minHeight: 0 }} />
    </div>
  );
};
