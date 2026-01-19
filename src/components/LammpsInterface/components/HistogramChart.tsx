import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as echarts from 'echarts';
import styles from '../LammpsInterface.module.css';

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
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [selectedTimestepIndex, setSelectedTimestepIndex] = useState<number>(-1); // -1 means latest

  const histogramData = useMemo(() => {
    if (!data) {
      return null;
    }
    return parseHistogramData(data, filename);
  }, [data, filename]);

  // Get the current timestep data to display
  const currentData = useMemo(() => {
    if (!histogramData || histogramData.timesteps.length === 0) return null;
    const index = selectedTimestepIndex < 0
      ? histogramData.timesteps.length - 1
      : Math.min(selectedTimestepIndex, histogramData.timesteps.length - 1);
    return histogramData.timesteps[index];
  }, [histogramData, selectedTimestepIndex]);


  // Initialize chart
  useEffect(() => {
    if (!chartRef.current) return;

    chartInstance.current = echarts.init(chartRef.current);

    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
    };
  }, []);

  // Update chart when data changes
  useEffect(() => {
    if (!chartInstance.current || !currentData || !histogramData) return;

    const option: echarts.EChartsOption = {
      animation: false,
      title: {
        text: `${histogramData.title} (step ${currentData.timestep})`,
        left: 'center',
        top: 5,
        textStyle: { fontSize: 12 },
      },
      grid: {
        left: '12%',
        right: '5%',
        top: '18%',
        bottom: '15%',
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const p = params[0];
          return `${p.name}°: ${p.value.toFixed(0)} counts`;
        },
      },
      xAxis: {
        type: 'category',
        data: currentData.bins.map(b => b.toFixed(1)),
        name: 'Angle (°)',
        nameLocation: 'middle',
        nameGap: 25,
        axisLabel: {
          interval: Math.floor(currentData.bins.length / 10),
          rotate: 0,
          fontSize: 10,
        },
      },
      yAxis: {
        type: 'value',
        name: 'Count',
        nameLocation: 'middle',
        nameGap: 40,
      },
      series: [{
        type: 'bar',
        data: currentData.counts,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#5470c6' },
            { offset: 1, color: '#91cc75' },
          ]),
        },
        barWidth: '90%',
      }],
    };

    chartInstance.current.setOption(option, true);
  }, [histogramData, currentData]);

  if (isLoading) {
    return (
      <div className={styles.histogramChartEmpty}>
        <span>Loading histogram data...</span>
      </div>
    );
  }

  if (!data || !histogramData || histogramData.timesteps.length === 0) {
    return (
      <div className={styles.histogramChartEmpty}>
        <span>No histogram data available</span>
      </div>
    );
  }

  const numTimesteps = histogramData.timesteps.length;
  const displayIndex = selectedTimestepIndex < 0 ? numTimesteps - 1 : selectedTimestepIndex;

  return (
    <div className={styles.histogramChart}>
      {/* Timestep slider */}
      {numTimesteps > 1 && (
        <div className={styles.histogramSlider}>
          <input
            type="range"
            min={0}
            max={numTimesteps - 1}
            value={displayIndex}
            onChange={(e) => setSelectedTimestepIndex(parseInt(e.target.value, 10))}
            style={{ flex: 1 }}
          />
          <span className={styles.histogramTimestep}>
            {displayIndex + 1} / {numTimesteps}
          </span>
        </div>
      )}
      <div ref={chartRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  );
};
