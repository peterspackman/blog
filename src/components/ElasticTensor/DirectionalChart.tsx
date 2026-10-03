import React, { useMemo } from 'react';
import { echartsAxis, echartsBase, useVizTheme } from '../shared/viz';
import {
  DirectionalData,
  TensorDataset,
  getPropertyTitle,
  getPropertyUnit,
  hasMinMax,
  saveImageToolbox,
  tensorColor,
} from './CommonFunctions';
import { useEChart } from '../shared/viz/useEChart';

/** The same plane cut as PolarChart, unrolled: value against angle. */
const DirectionalChart: React.FC<{
  property: string;
  multiTensorData: TensorDataset<DirectionalData[]>[];
  showShading?: boolean;
  showGridLines?: boolean;
}> = ({ property, multiTensorData, showShading = true, showGridLines = true }) => {
  const theme = useVizTheme();

  const option = useMemo(() => {
    if (multiTensorData.length === 0) return null;
    const unit = getPropertyUnit(property);
    const minMax = hasMinMax(property);

    const allValues = multiTensorData.flatMap((ds) =>
      ds.data.flatMap((d) => (minMax ? [d.value, d.valueMin ?? 0] : [d.value])),
    );

    const series: object[] = [];
    for (const ds of multiTensorData) {
      const color = tensorColor(theme, ds.colorIndex);
      const line = { type: 'line', smooth: true, symbol: 'none', animation: false, itemStyle: { color } };
      series.push({
        ...line,
        name: minMax ? `${ds.name} (max)` : ds.name,
        data: ds.data.map((d) => [d.angle, d.value]),
        lineStyle: { width: 2, color },
        ...(showShading ? { areaStyle: { color, opacity: 0.15 } } : {}),
      });
      if (minMax) {
        series.push({
          ...line,
          name: `${ds.name} (min)`,
          data: ds.data.map((d) => [d.angle, d.valueMin ?? 0]),
          lineStyle: { width: 2, color, type: 'dashed' },
        });
      }
    }

    const ax = echartsAxis(theme);
    const base = echartsBase(theme);
    return {
      ...base,
      animation: false,
      toolbox: saveImageToolbox(theme),
      grid: { left: 52, right: 16, top: 16, bottom: 44 },
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        formatter: (params: { seriesName: string; data: number[]; color: string }[]) =>
          `${params[0].data[0].toFixed(0)}°<br/>` +
          params
            .map((p) => `<span style="color:${p.color}">●</span> ${p.seriesName}: ${p.data[1].toFixed(3)} ${unit}`)
            .join('<br/>'),
      },
      xAxis: {
        ...ax,
        type: 'value',
        name: 'Angle (°)',
        nameLocation: 'center',
        nameGap: 26,
        min: 0,
        max: 360,
        interval: 90,
        splitLine: { ...ax.splitLine, show: showGridLines },
      },
      yAxis: {
        ...ax,
        type: 'value',
        name: unit ? `${getPropertyTitle(property)} (${unit})` : getPropertyTitle(property),
        nameLocation: 'center',
        nameGap: 38,
        min: Math.min(0, ...allValues),
        splitLine: { ...ax.splitLine, show: showGridLines },
      },
      series,
    };
  }, [theme, property, multiTensorData, showShading, showGridLines]);

  const [ref] = useEChart(option);
  return <div ref={ref} style={{ width: '100%', aspectRatio: '4 / 3' }} />;
};

export { DirectionalChart };
export default DirectionalChart;
