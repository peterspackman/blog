import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { DirectionalData, getPropertyTitle, getPropertyUnit, calculateDirectionalDifferences, getComputedTensorColors, getComputedTensorColor } from './CommonFunctions';

interface MultiTensorDataset {
  data: DirectionalData[];
  tensorId: string;
  name: string;
  colorIndex: number;
}

const PolarChart: React.FC<{
  property: string;
  plane: string;
  multiTensorData?: MultiTensorDataset[];
}> = ({ property, plane, multiTensorData }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    if (!multiTensorData || multiTensorData.length === 0) return;
    
    const colors = getComputedTensorColors();

    const chart = echarts.init(chartRef.current);

    // Process all datasets and find overall ranges
    const processedDatasets = multiTensorData.map(dataset => {
      const polarCoords = dataset.data.map(d => {
        // If WASM method provided x, y coordinates, use them
        if (d.x !== undefined && d.y !== undefined) {
          return [d.x, d.y];
        }

        // Otherwise, calculate from angle and value
        const angleRad = d.angleRad;
        const radius = d.value;

        // Convert to Cartesian coordinates for plotting
        let x, y;
        if (plane === 'xy') {
          x = radius * Math.cos(angleRad);
          y = radius * Math.sin(angleRad);
        } else if (plane === 'xz') {
          x = radius * Math.cos(angleRad);
          y = radius * Math.sin(angleRad); // Using same mapping for visualization
        } else { // yz plane
          x = radius * Math.cos(angleRad);
          y = radius * Math.sin(angleRad);
        }

        return [x, y];
      });
      
      return { ...dataset, polarCoords };
    });

    // Find the range for proper scaling across all datasets
    const allValues = processedDatasets.flatMap(dataset => dataset.polarCoords.flat());
    const maxVal = Math.max(...allValues.map(v => Math.abs(v)));

    // Get value range for color mapping across all datasets
    const allDataValues = processedDatasets.flatMap(dataset => dataset.data.map(d => d.value));
    const minValue = Math.min(...allDataValues);
    const maxValue = Math.max(...allDataValues);

    // Get axis labels based on plane
    const getAxisLabels = (plane: string) => {
      switch (plane) {
        case 'xy': return { x: 'X', y: 'Y' };
        case 'xz': return { x: 'X', y: 'Z' };
        case 'yz': return { x: 'Y', y: 'Z' };
        default: return { x: 'X', y: 'Y' };
      }
    };

    const axisLabels = getAxisLabels(plane);

    const option = {
      animation: false,
      title: {
        show: false
      },
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
            pixelRatio: 2
          }
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const [x, y] = params.data;
          const radius = Math.sqrt(x * x + y * y);
          const angle = Math.atan2(y, x) * 180 / Math.PI;
          return `${axisLabels.x}: ${x.toFixed(2)}<br/>${axisLabels.y}: ${y.toFixed(2)}<br/>Value: ${radius.toFixed(3)} ${getPropertyUnit(property)}<br/>Angle: ${angle.toFixed(1)}°`;
        }
      },
      grid: {
        left: 80,
        right: 40,
        top: 70,
        bottom: 70,
        borderWidth: 0
      },
      xAxis: {
        type: 'value',
        name: axisLabels.x,
        nameLocation: 'center',
        nameGap: 35,
        min: -maxVal * 1.1,
        max: maxVal * 1.1,
        axisLabel: {
          fontSize: 10,
          formatter: (value: number) => value.toFixed(0),
          margin: 15
        }
      },
      yAxis: {
        type: 'value',
        name: axisLabels.y,
        nameLocation: 'center',
        nameGap: 35,
        min: -maxVal * 1.1,
        max: maxVal * 1.1,
        axisLabel: {
          fontSize: 10,
          formatter: (value: number) => value.toFixed(0),
          margin: 15
        }
      },
      series: (() => {
        const hasMinMax = property === 'shear' || property === 'poisson';
        const series = [];

        // Create a series for each tensor dataset
        processedDatasets.forEach((dataset, index) => {
          const color = getComputedTensorColor(dataset.colorIndex);
          
          if (hasMinMax) {
            // Properties with min/max (shear, poisson) - show both min and max values
            const maxCoords = dataset.data.map(d => {
              const angleRad = d.angleRad;
              const radius = d.value; // This is max value for these properties
              return [radius * Math.cos(angleRad), radius * Math.sin(angleRad)];
            });
            
            const minCoords = dataset.data.map(d => {
              const angleRad = d.angleRad;
              const radius = d.valueMin || d.value; // Use min value if available
              return [radius * Math.cos(angleRad), radius * Math.sin(angleRad)];
            });

            // Max value series
            series.push({
              name: `${dataset.name} (Max)`,
              type: 'line',
              data: maxCoords,
              smooth: false,
              lineStyle: { width: 2, color: color, type: 'solid' },
              areaStyle: { opacity: 0.3, color: color },
              symbol: 'circle',
              symbolSize: 3,
              itemStyle: { color: color },
              animation: false,
              connectNulls: true
            });

            // Min value series (if different from max)
            if (dataset.data.some(d => d.valueMin !== undefined && d.valueMin !== d.value)) {
              series.push({
                name: `${dataset.name} (Min)`,
                type: 'line',
                data: minCoords,
                smooth: false,
                lineStyle: { width: 2, color: color, type: 'dashed' },
                symbol: 'circle',
                symbolSize: 2,
                itemStyle: { color: color },
                animation: false,
                connectNulls: true
              });
            }
          } else {
            // Single value properties (youngs, linear_compressibility)
            series.push({
              name: dataset.name,
              type: 'line',
              data: dataset.polarCoords,
              smooth: false,
              lineStyle: { width: 2, color: color, type: 'solid' },
              areaStyle: { opacity: 0.3, color: color },
              symbol: 'circle',
              symbolSize: 3,
              itemStyle: { color: color },
              animation: false,
              connectNulls: true
            });
          }
        });

        return series;
      })(),
      legend: {
        show: multiTensorData.length > 1,
        top: 30,
        textStyle: {
          color: 'var(--ifm-color-emphasis-800)',
          fontSize: 12
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const [x, y] = params.data;
          const radius = Math.sqrt(x * x + y * y);
          const angle = Math.atan2(y, x) * 180 / Math.PI;
          return `${axisLabels.x}: ${x.toFixed(2)}<br/>${axisLabels.y}: ${y.toFixed(2)}<br/>Value: ${radius.toFixed(3)} ${getPropertyUnit(property)}<br/>Angle: ${angle.toFixed(1)}°`;
        }
      },
      grid: {
        left: '10%',
        right: '10%',
        top: '15%',
        bottom: '15%'
      }
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [property, plane, multiTensorData]);

  return <div ref={chartRef} style={{ width: '100%', height: '100%', aspectRatio: '1/1' }} />;
};

export { PolarChart };
export default PolarChart;

