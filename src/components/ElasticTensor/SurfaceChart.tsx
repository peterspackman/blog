import React, { useMemo } from 'react';
import 'echarts-gl';
import { echartsBase, useVizTheme } from '../shared/viz';
import {
  SurfaceData,
  TensorDataset,
  getPropertyTitle,
  getPropertyUnit,
  saveImageToolbox,
  tensorColor,
} from './CommonFunctions';
import { useEChart } from '../shared/viz/useEChart';

/** Value on the (u, v) grid nearest to the angles, or 0 outside it. */
function sample(s: SurfaceData, u: number, v: number): number {
  const i = Math.round((u / (2 * Math.PI)) * (s.numU - 1));
  const j = Math.round((v / Math.PI) * (s.numV - 1));
  return s.surfaceData[i]?.[j] ?? 0;
}

/** Directional surface r(θ, φ) = property value, as points or a shaded mesh. */
const SurfaceChart: React.FC<{
  multiSurfaceData: TensorDataset<SurfaceData>[];
  property: string;
  useScatter?: boolean;
}> = ({ multiSurfaceData, property, useScatter = true }) => {
  const theme = useVizTheme();

  const option = useMemo(() => {
    if (multiSurfaceData.length === 0) return null;
    const unit = getPropertyUnit(property);
    const axis3D = (name: string) => ({
      type: 'value',
      name,
      nameTextStyle: { color: theme.muted, fontFamily: theme.fontSans },
      axisLine: { lineStyle: { color: theme.axis } },
      axisTick: { lineStyle: { color: theme.axis } },
      axisLabel: { textStyle: { color: theme.muted, fontFamily: theme.fontMono, fontSize: 10 } },
      splitLine: { lineStyle: { color: theme.grid } },
    });

    const series = multiSurfaceData.map(({ data: s, name, colorIndex }) => {
      const color = tensorColor(theme, colorIndex);
      if (useScatter) {
        const points: number[][] = [];
        for (let i = 0; i < s.numU; i++) {
          for (let j = 0; j < s.numV; j++) {
            const u = (i / (s.numU - 1)) * 2 * Math.PI;
            const v = (j / (s.numV - 1)) * Math.PI;
            const r = s.surfaceData[i]?.[j] ?? 0;
            points.push([r * Math.sin(v) * Math.cos(u), r * Math.sin(v) * Math.sin(u), r * Math.cos(v), r]);
          }
        }
        return { name, type: 'scatter3D', data: points, symbolSize: 2.5, itemStyle: { color, opacity: 0.8 } };
      }
      return {
        name,
        type: 'surface',
        parametric: true,
        shading: 'lambert',
        wireframe: { show: true, lineStyle: { color: theme.grid, width: 0.5 } },
        itemStyle: { color, opacity: 0.85 },
        parametricEquation: {
          u: { min: 0, max: 2 * Math.PI, step: (2 * Math.PI) / (s.numU - 1) },
          v: { min: 0, max: Math.PI, step: Math.PI / (s.numV - 1) },
          x: (u: number, v: number) => sample(s, u, v) * Math.sin(v) * Math.cos(u),
          y: (u: number, v: number) => sample(s, u, v) * Math.sin(v) * Math.sin(u),
          z: (u: number, v: number) => sample(s, u, v) * Math.cos(v),
        },
      };
    });

    const base = echartsBase(theme);
    return {
      ...base,
      animation: false,
      toolbox: saveImageToolbox(theme),
      tooltip: {
        ...base.tooltip,
        formatter: (p: { seriesName: string; value: number[] }) => {
          const [x, y, z, r] = p.value;
          const value = r ?? Math.hypot(x, y, z);
          return `${p.seriesName}<br/>${getPropertyTitle(property)}: ${value.toFixed(3)} ${unit}`;
        },
      },
      xAxis3D: axis3D('X'),
      yAxis3D: axis3D('Y'),
      zAxis3D: axis3D('Z'),
      grid3D: {
        axisPointer: { lineStyle: { color: theme.accent } },
        viewControl: { projection: 'perspective' },
        light: { main: { intensity: 1.1 }, ambient: { intensity: 0.4 } },
      },
      series,
    };
  }, [theme, multiSurfaceData, property, useScatter]);

  const [ref] = useEChart(option);
  return <div ref={ref} style={{ width: '100%', height: 'min(70vh, 560px)', minHeight: 360 }} />;
};

export { SurfaceChart };
export default SurfaceChart;
