import React, { useEffect, useMemo, useState } from 'react';
import type * as echarts from 'echarts';
import { echartsAxis, echartsBase, useVizTheme, withAlpha } from '../../shared/viz';
import { SliderWithInput } from '../../shared/controls';
import styles from '../LammpsInterface.module.css';
import { useEChart } from '../../shared/viz/useEChart';

interface HistogramChartProps {
  data: string | null;
  filename: string;
  isLoading?: boolean;
}

interface TimestepData {
  timestep: number;
  bins: number[];
  counts: number[];
}

interface HistogramData {
  timesteps: TimestepData[];
  title: string;
}

// Parse LAMMPS ave/histo output format with multiple timesteps
// Format:
// # Histogrammed data for fix <name>
// # TimeStep Number-of-bins Total-counts Missing-counts Min-value Max-value
// # Bin Coord Count Count/Total
// <timestep> <nbins> <total> <missing> <min> <max>
// 1 <coord> <count> <fraction>
// 2 <coord> <count> <fraction>
// ... (repeats for each timestep)
const parseHistogramData = (content: string, filename: string): HistogramData | null => {
  const lines = content.trim().split('\n');
  const timesteps: TimestepData[] = [];

  let headerLine = '';
  let currentTimestep: TimestepData | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Capture header for title
    if (trimmed.startsWith('#')) {
      if (trimmed.includes('fix')) {
        headerLine = trimmed;
      }
      continue;
    }

    const parts = trimmed.split(/\s+/);

    // The timestep line has 6 values: timestep, nbins, total, missing, min, max
    if (parts.length === 6) {
      // Save previous timestep if exists
      if (currentTimestep && currentTimestep.bins.length > 0) {
        timesteps.push(currentTimestep);
      }
      // Start new timestep
      currentTimestep = {
        timestep: parseInt(parts[0], 10),
        bins: [],
        counts: [],
      };
      continue;
    }

    // Data rows have 4 values: bin#, coord, count, fraction
    // Or 3 values in some formats: bin#, coord, count
    if (currentTimestep && (parts.length === 4 || parts.length === 3)) {
      const coord = parseFloat(parts[1]);
      const count = parseFloat(parts[2]);

      if (!isNaN(coord) && !isNaN(count)) {
        currentTimestep.bins.push(coord);
        currentTimestep.counts.push(count);
      }
    }
  }

  // Don't forget the last timestep
  if (currentTimestep && currentTimestep.bins.length > 0) {
    timesteps.push(currentTimestep);
  }

  if (timesteps.length === 0) {
    return null;
  }

  // Generate title from filename or header
  let title = filename.replace(/\.dat$/, '').replace(/_/g, ' ');
  if (headerLine.includes('fix')) {
    const match = headerLine.match(/fix\s+(\w+)/);
    if (match) {
      title = match[1].replace(/_/g, ' ');
    }
  }

  return { timesteps, title };
};

export const HistogramChart: React.FC<HistogramChartProps> = ({
  data,
  filename,
  isLoading = false
}) => {
  const theme = useVizTheme();
  const [chartRef, chart] = useEChart();
  const [selectedTimestepIndex, setSelectedTimestepIndex] = useState<number>(-1); // -1 means latest

  const histogramData = useMemo(() => {
    if (!data) return null;
    return parseHistogramData(data, filename);
  }, [data, filename]);

  const numTimesteps = histogramData?.timesteps.length ?? 0;
  const displayIndex = selectedTimestepIndex < 0
    ? numTimesteps - 1
    : Math.min(selectedTimestepIndex, numTimesteps - 1);
  const currentData = numTimesteps > 0 ? histogramData!.timesteps[displayIndex] : null;

  useEffect(() => {
    if (!chart) return;
    if (!currentData || !histogramData) {
      chart.clear();
      return;
    }
    const base = echartsBase(theme);
    const axis = echartsAxis(theme);

    const option: echarts.EChartsOption = {
      ...base,
      animation: false,
      legend: { show: false },
      title: {
        ...base.title,
        text: `${histogramData.title} · step ${currentData.timestep}`,
        left: 'center',
        top: 4,
      },
      grid: { left: 12, right: 20, top: 36, bottom: 32, containLabel: true },
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: withAlpha(theme.text, 0.06) } },
        formatter: (params: any) => {
          const p = params[0];
          return `${p.name}°: ${p.value.toFixed(0)} counts`;
        },
      },
      xAxis: {
        ...axis,
        type: 'category',
        data: currentData.bins.map(b => b.toFixed(1)),
        name: 'Angle (°)',
        nameLocation: 'middle',
        nameGap: 26,
        splitLine: { show: false },
        axisLabel: { ...axis.axisLabel, interval: Math.floor(currentData.bins.length / 10) },
      },
      yAxis: {
        ...axis,
        type: 'value',
        name: 'Count',
        nameLocation: 'middle',
        nameGap: 40,
      },
      series: [{
        type: 'bar',
        data: currentData.counts,
        itemStyle: { color: theme.series[0], borderRadius: [2, 2, 0, 0] },
        barWidth: '90%',
      }],
    };

    chart.setOption(option, true);
  }, [chart, theme, histogramData, currentData]);

  const empty = isLoading
    ? 'Loading histogram data…'
    : !currentData
      ? 'No histogram data in this file.'
      : null;

  return (
    <div className={styles.chartPane}>
      {numTimesteps > 1 && (
        <div className={styles.chartToolbar}>
          <SliderWithInput
            label="Output frame"
            value={displayIndex + 1}
            onChange={(v) => setSelectedTimestepIndex(Math.round(v) - 1)}
            min={1}
            max={numTimesteps}
            step={1}
            decimals={0}
          />
        </div>
      )}
      <div className={styles.chartCanvas}>
        <div ref={chartRef} className={styles.chartFill} />
        {empty && <div className={styles.chartEmpty}>{empty}</div>}
      </div>
    </div>
  );
};
