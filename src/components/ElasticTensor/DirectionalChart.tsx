import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { DirectionalData, getPropertyTitle, getPropertyUnit, calculateDirectionalDifferences, getComputedTensorColors, getComputedTensorColor } from './CommonFunctions';

interface MultiTensorDataset {
  data: DirectionalData[];
  tensorId: string;
  name: string;
  colorIndex: number;
}

const DirectionalChart = React.forwardRef<HTMLDivElement, {
  data?: DirectionalData[];
  multiTensorData?: MultiTensorDataset[];
  property: string;
  referenceData?: DirectionalData[];
  comparisonMode?: boolean;
  showDifference?: boolean;
  testTensorName?: string;
  referenceTensorName?: string;
  showShading?: boolean;
  showLegend?: boolean;
  showGridLines?: boolean;
}>((props, ref) => {
  const { data, multiTensorData, property, referenceData, comparisonMode = false, showDifference = false, testTensorName = 'Test Tensor', referenceTensorName = 'Reference Tensor', showShading = true, showLegend = true, showGridLines = true } = props;
  const chartRef = useRef<HTMLDivElement>(null);

  const saveChart = () => {
    if (chartRef.current) {
      const chartInstance = echarts.getInstanceByDom(chartRef.current);
      if (chartInstance) {
        const url = chartInstance.getDataURL({
          type: 'png',
          pixelRatio: 2,
          backgroundColor: '#ffffff'
        });
        const link = document.createElement('a');
        link.download = `${getPropertyTitle(property)}_directional_${testTensorName.replace(/\s+/g, '_')}.png`;
        link.href = url;
        link.click();
      }
    }
  };

  useEffect(() => {
    if (!chartRef.current) return;
    
    // Handle multi-tensor data
    if (multiTensorData && multiTensorData.length > 0) {
      const chart = echarts.init(chartRef.current);
      const hasMinMax = property === 'shear' || property === 'poisson';
      const series = [];

      // Get all values for range calculation
      let allValues: number[] = [];
      multiTensorData.forEach(dataset => {
        allValues = [...allValues, ...dataset.data.map(d => d.value)];
        if (hasMinMax) {
          allValues = [...allValues, ...dataset.data.map(d => d.valueMin || 0)];
        }
      });

      // Create series for each tensor
      multiTensorData.forEach(dataset => {
        const color = getComputedTensorColor(dataset.colorIndex);
        
        if (hasMinMax) {
          // Add max series
          series.push({
            name: `${dataset.name} Max`,
            type: 'line',
            data: dataset.data.map(d => [d.angle, d.value]),
            smooth: true,
            lineStyle: { width: 2, color: color },
            ...(showShading ? { areaStyle: { color: color, opacity: 0.2 } } : {}),
            itemStyle: { color: color },
            symbol: 'none',
            animation: false
          });
          
          // Add min series with slightly different shade
          series.push({
            name: `${dataset.name} Min`,
            type: 'line',
            data: dataset.data.map(d => [d.angle, d.valueMin || 0]),
            smooth: true,
            lineStyle: { width: 2, color: color, type: 'dashed' },
            ...(showShading ? { areaStyle: { color: color, opacity: 0.1 } } : {}),
            itemStyle: { color: color },
            symbol: 'none',
            animation: false
          });
        } else {
          // Regular series
          series.push({
            name: dataset.name,
            type: 'line',
            data: dataset.data.map(d => [d.angle, d.value]),
            smooth: true,
            lineStyle: { width: 2, color: color },
            ...(showShading ? { areaStyle: { color: color, opacity: 0.2 } } : {}),
            itemStyle: { color: color },
            symbol: 'none',
            animation: false
          });
        }
      });

      const option = {
        animation: false,
        title: { show: false },
        toolbox: {
          show: true,
          orient: 'vertical',
          left: 'right',
          top: 'top',
          feature: {
            saveAsImage: {
              show: true,
              title: 'Save as PNG',
              backgroundColor: '#ffffff',
              pixelRatio: 2,
              excludeComponents: ['toolbox']
            }
          }
        },
        grid: {
          left: 90,
          right: 50,
          top: showLegend && multiTensorData.length > 1 ? 80 : 60,
          bottom: 80,
          borderWidth: 0
        },
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => {
            let result = `Angle: ${params[0].data[0].toFixed(1)}°<br/>`;
            params.forEach((param: any) => {
              result += `${param.seriesName}: ${param.data[1].toFixed(3)} ${getPropertyUnit(property)}<br/>`;
            });
            return result;
          }
        },
        legend: {
          show: showLegend && multiTensorData.length > 1,
          top: 10,
          textStyle: {
            color: 'var(--ifm-color-emphasis-800)',
            fontSize: 12
          }
        },
        xAxis: {
          type: 'value',
          name: 'Angle (degrees)',
          nameLocation: 'center',
          nameGap: 30,
          min: 0,
          max: 360,
          axisLabel: {
            formatter: '{value}°',
            margin: 15
          },
          splitLine: {
            show: showGridLines
          }
        },
        yAxis: {
          type: 'value',
          name: `${getPropertyTitle(property)} (${getPropertyUnit(property)})`,
          nameLocation: 'center',
          nameGap: 60,
          nameRotate: 90,
          min: Math.min(0, Math.min(...allValues)),
          axisLabel: {
            margin: 15
          },
          splitLine: {
            show: showGridLines
          }
        },
        series: series
      };

      chart.setOption(option);

      const handleResize = () => chart.resize();
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        chart.dispose();
      };
    }
  }, [data, multiTensorData, property, referenceData, comparisonMode, showDifference, testTensorName, referenceTensorName, showShading, showLegend, showGridLines]);

  return <div ref={chartRef} style={{ width: '100%', height: '100%', aspectRatio: '1/1' }} />;
});

export { DirectionalChart };
export default DirectionalChart;
