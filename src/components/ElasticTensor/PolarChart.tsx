import React, { useMemo } from 'react';
import { echartsAxis, echartsBase, useVizTheme } from '../shared/viz';
import {
  DirectionalData,
  TensorDataset,
  getPropertyUnit,
  hasMinMax,
  planeAxes,
  saveImageToolbox,
  tensorColor,
} from './CommonFunctions';
import { useEChart } from '../shared/viz/useEChart';

/** Smallest 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10^n at or above x, so the axis ends on a round number. */
function niceCeil(x: number): number {
  const pow = 10 ** Math.floor(Math.log10(x));
  const m = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((f) => f * pow >= x) ?? 10;
  return m * pow;
}

/** Polar cut of a property through one plane: radius = value in that direction. */
const PolarChart: React.FC<{
  property: string;
  plane: string;
  multiTensorData: TensorDataset<DirectionalData[]>[];
  showShading?: boolean;
  showGridLines?: boolean;
}> = ({ property, plane, multiTensorData, showShading = true, showGridLines = true }) => {
  const theme = useVizTheme();

  const option = useMemo(() => {
    if (multiTensorData.length === 0) return null;
    const axes = planeAxes(plane);
    const unit = getPropertyUnit(property);
    const toXY = (r: number, d: DirectionalData) => [r * Math.cos(d.angleRad), r * Math.sin(d.angleRad)];

    const maxVal = Math.max(
      ...multiTensorData.flatMap((ds) => ds.data.map((d) => Math.abs(d.value))),
      1e-9,
    );
    const lim = niceCeil(maxVal * 1.05);

    const series: object[] = [];
    for (const ds of multiTensorData) {
      const color = tensorColor(theme, ds.colorIndex);
      const line = {
        type: 'line',
        smooth: false,
        // Small markers so the item tooltip has something to hover.
        symbol: 'circle',
        symbolSize: 3,
        animation: false,
        connectNulls: true,
        itemStyle: { color },
      };
      // Prefer the worker's x/y when given (single-valued properties only).
      const outer = ds.data.map((d) =>
        !hasMinMax(property) && d.x !== undefined && d.y !== undefined ? [d.x, d.y] : toXY(d.value, d),
      );
      series.push({
        ...line,
        name: hasMinMax(property) ? `${ds.name} (max)` : ds.name,
        data: outer,
        lineStyle: { width: 2, color },
        ...(showShading ? { areaStyle: { opacity: 0.18, color } } : {}),
      });
      if (hasMinMax(property) && ds.data.some((d) => d.valueMin !== undefined && d.valueMin !== d.value)) {
        series.push({
          ...line,
          name: `${ds.name} (min)`,
          data: ds.data.map((d) => toXY(d.valueMin ?? d.value, d)),
          lineStyle: { width: 2, color, type: 'dashed' },
        });
      }
    }

    const axis = (name: string) => ({
      ...echartsAxis(theme),
      type: 'value',
      name,
      nameLocation: 'center',
      nameGap: 26,
      min: -lim,
      max: lim,
      axisLabel: { ...echartsAxis(theme).axisLabel, formatter: (v: number) => String(+v.toPrecision(3)) },
      splitLine: { ...echartsAxis(theme).splitLine, show: showGridLines },
    });

    const base = echartsBase(theme);
    return {
      ...base,
      animation: false,
      toolbox: saveImageToolbox(theme),
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        formatter: (p: { seriesName: string; data: number[] }) => {
          const [x, y] = p.data;
          const r = Math.hypot(x, y);
          const angle = (Math.atan2(y, x) * 180) / Math.PI;
          return `${p.seriesName}<br/>${r.toFixed(3)} ${unit} at ${angle.toFixed(1)}° from ${axes.x}`;
        },
      },
      // Equal margins horizontally and vertically keep the square plot round.
      grid: { left: 52, right: 16, top: 16, bottom: 52 },
      xAxis: axis(axes.x),
      yAxis: { ...axis(axes.y), nameGap: 36 },
      series,
    };
  }, [theme, property, plane, multiTensorData, showShading, showGridLines]);

  const [ref] = useEChart(option);
  return <div ref={ref} style={{ width: '100%', aspectRatio: '1 / 1' }} />;
};

export { PolarChart };
export default PolarChart;
