import React, { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import styles from '../LammpsInterface.module.css';

interface ThermoData {
  step: number[];
  temp: number[];
  pe: number[];
  ke: number[];
  etotal: number[];
  press: number[];
  vol: number[];
}

interface ThermoChartProps {
  output: Array<{ text: string; isError: boolean }>;
  isRunning: boolean;
}

// Parse thermo output from LAMMPS console output
const parseThermoOutput = (output: Array<{ text: string; isError: boolean }>): ThermoData => {
  const data: ThermoData = {
    step: [],
    temp: [],
    pe: [],
    ke: [],
    etotal: [],
    press: [],
    vol: [],
  };

  // Look for thermo header line and data lines
  let headerFound = false;
  let columnMap: Record<string, number> = {};

  for (const line of output) {
    if (line.isError) continue;
    const text = line.text.trim();

    // Check for header line (contains "Step" and "Temp")
    if (text.includes('Step') && (text.includes('Temp') || text.includes('TotEng'))) {
      headerFound = true;
      const headers = text.split(/\s+/);
      headers.forEach((h, i) => {
        const lower = h.toLowerCase();
        if (lower === 'step') columnMap.step = i;
        else if (lower === 'temp') columnMap.temp = i;
        else if (lower === 'poteng' || lower === 'pe') columnMap.pe = i;
        else if (lower === 'kineng' || lower === 'ke') columnMap.ke = i;
        else if (lower === 'toteng' || lower === 'etotal') columnMap.etotal = i;
        else if (lower === 'press') columnMap.press = i;
        else if (lower === 'volume' || lower === 'vol') columnMap.vol = i;
      });
      continue;
    }

    // Parse data lines (all numbers)
    if (headerFound) {
      const parts = text.split(/\s+/);
      // Check if this looks like a data line (starts with a number)
      if (parts.length >= 2 && /^-?\d+$/.test(parts[0])) {
        const step = parseInt(parts[columnMap.step ?? 0]);
        if (!isNaN(step)) {
          data.step.push(step);
          if (columnMap.temp !== undefined) data.temp.push(parseFloat(parts[columnMap.temp]) || 0);
          if (columnMap.pe !== undefined) data.pe.push(parseFloat(parts[columnMap.pe]) || 0);
          if (columnMap.ke !== undefined) data.ke.push(parseFloat(parts[columnMap.ke]) || 0);
          if (columnMap.etotal !== undefined) data.etotal.push(parseFloat(parts[columnMap.etotal]) || 0);
          if (columnMap.press !== undefined) data.press.push(parseFloat(parts[columnMap.press]) || 0);
          if (columnMap.vol !== undefined) data.vol.push(parseFloat(parts[columnMap.vol]) || 0);
        }
      }
    }
  }

  return data;
};

export const ThermoChart: React.FC<ThermoChartProps> = ({ output, isRunning }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const thermoData = useMemo(() => parseThermoOutput(output), [output]);
  const hasData = thermoData.step.length > 0;

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
    if (!chartInstance.current || !hasData) return;

    // Determine which series to show based on available data
    const series: any[] = [];
    const yAxisConfigs: any[] = [];
    let yAxisIndex = 0;

    // Temperature (left axis)
    if (thermoData.temp.length > 0) {
      yAxisConfigs.push({
        type: 'value',
        name: 'Temp (K)',
        position: 'left',
        axisLine: { lineStyle: { color: '#ee6666' } },
        axisLabel: { formatter: '{value}' },
      });
      series.push({
        name: 'Temperature',
        type: 'line',
        yAxisIndex: yAxisIndex++,
        data: thermoData.temp,
        smooth: true,
        symbol: 'none',
        itemStyle: { color: '#ee6666' },
        lineStyle: { color: '#ee6666', width: 2 },
      });
    }

    // Energy (right axis)
    if (thermoData.etotal.length > 0 || thermoData.pe.length > 0) {
      yAxisConfigs.push({
        type: 'value',
        name: 'Energy (eV)',
        position: 'right',
        axisLine: { lineStyle: { color: '#5470c6' } },
        axisLabel: { formatter: '{value}' },
      });

      if (thermoData.etotal.length > 0) {
        series.push({
          name: 'Total Energy',
          type: 'line',
          yAxisIndex: yAxisIndex,
          data: thermoData.etotal,
          smooth: true,
          symbol: 'none',
          itemStyle: { color: '#5470c6' },
          lineStyle: { color: '#5470c6', width: 2 },
        });
      }
      if (thermoData.pe.length > 0) {
        series.push({
          name: 'Potential Energy',
          type: 'line',
          yAxisIndex: yAxisIndex,
          data: thermoData.pe,
          smooth: true,
          symbol: 'none',
          itemStyle: { color: '#91cc75' },
          lineStyle: { color: '#91cc75', width: 1.5, type: 'dashed' },
        });
      }
      if (thermoData.ke.length > 0) {
        series.push({
          name: 'Kinetic Energy',
          type: 'line',
          yAxisIndex: yAxisIndex,
          data: thermoData.ke,
          smooth: true,
          symbol: 'none',
          itemStyle: { color: '#fac858' },
          lineStyle: { color: '#fac858', width: 1.5, type: 'dashed' },
        });
      }
    }

    const option: echarts.EChartsOption = {
      animation: false,
      grid: {
        left: '12%',
        right: '12%',
        top: '15%',
        bottom: '15%',
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      legend: {
        data: series.map(s => s.name),
        top: 0,
        textStyle: { fontSize: 10 },
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
            if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
            return value;
          },
        },
      },
      yAxis: yAxisConfigs,
      series,
    };

    chartInstance.current.setOption(option, true);
  }, [thermoData, hasData]);

  if (!hasData) {
    return (
      <div className={styles.thermoChartEmpty}>
        <span>{isRunning ? 'Waiting for thermo data...' : 'No thermo data'}</span>
      </div>
    );
  }

  return (
    <div className={styles.thermoChart}>
      <div ref={chartRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
};
