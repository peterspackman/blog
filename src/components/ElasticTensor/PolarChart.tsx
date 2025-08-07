import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { DirectionalData, getPropertyTitle, getPropertyUnit, calculateDirectionalDifferences, getComputedTensorColors } from './CommonFunctions';

const PolarChart: React.FC<{
  data: DirectionalData[];
  property: string;
  plane: string;
  referenceData?: DirectionalData[];
  comparisonMode?: boolean;
  showDifference?: boolean;
  testTensorName?: string;
  referenceTensorName?: string;
}> = ({ data, property, plane, referenceData, comparisonMode = false, showDifference = false, testTensorName = 'Test Tensor', referenceTensorName = 'Reference Tensor' }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;
    
    const colors = getComputedTensorColors();


    const chart = echarts.init(chartRef.current);

    // Convert directional data to actual polar coordinates
    // Use pre-calculated coordinates if available (from WASM method), otherwise calculate
    const polarCoords = data.map(d => {
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

    // Find the range for proper scaling - include reference data if available
    let allValues = polarCoords.flat();

    if (comparisonMode && referenceData && referenceData.length > 0) {
      const refCoords = referenceData.map(d => {
        if (d.x !== undefined && d.y !== undefined) {
          return [d.x, d.y];
        }
        const angleRad = d.angleRad;
        const radius = d.value;
        return [radius * Math.cos(angleRad), radius * Math.sin(angleRad)];
      });
      allValues = [...allValues, ...refCoords.flat()];
    }

    const maxVal = Math.max(...allValues.map(v => Math.abs(v)));

    // Get value range for color mapping
    const values = data.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

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

        if (comparisonMode && referenceData) {
          if (showDifference) {
            // Difference mode: show test - reference
            const differenceData = calculateDirectionalDifferences(data, referenceData);
            const diffCoords = differenceData.map(d => {
              const angleRad = d.angleRad;
              // For difference plots, we show the actual difference value as radius
              // This means negative differences will show as smaller radii or inverted direction
              const radius = d.value; // Keep the actual difference value
              const x = radius * Math.cos(angleRad);
              const y = radius * Math.sin(angleRad);

              return [x, y];
            });

            series.push({
              name: `Difference (${testTensorName} - ${referenceTensorName})`,
              type: 'line',
              data: diffCoords,
              smooth: false,
              lineStyle: { width: 3, color: colors.differenceColor, type: 'solid' }, // Thicker purple line for differences
              areaStyle: { opacity: 0.4, color: colors.differenceColor },
              symbol: 'circle',
              symbolSize: 4,
              itemStyle: { color: colors.differenceColor },
              animation: false,
              connectNulls: true,
              emphasis: {
                lineStyle: { width: 4 },
                itemStyle: { borderWidth: 2, borderColor: '#ffffff' }
              }
            });
          } else {
            // Comparison mode: show test tensor vs reference tensor with min/max support
            if (hasMinMax) {
              // Test tensor max and min
              const testMaxCoords = data.map(d => {
                const angleRad = d.angleRad;
                const radius = d.value;
                return [radius * Math.cos(angleRad), radius * Math.sin(angleRad)];
              });

              const testMinCoords = data.map(d => {
                const angleRad = d.angleRad;
                const radius = d.valueMin || 0;
                return [radius * Math.cos(angleRad), radius * Math.sin(angleRad)];
              });

              // Reference tensor max and min
              const refMaxCoords = referenceData.map(d => {
                const angleRad = d.angleRad;
                const radius = d.value;
                return [radius * Math.cos(angleRad), radius * Math.sin(angleRad)];
              });

              const refMinCoords = referenceData.map(d => {
                const angleRad = d.angleRad;
                const radius = d.valueMin || 0;
                return [radius * Math.cos(angleRad), radius * Math.sin(angleRad)];
              });

              series.push(
                {
                  name: `${testTensorName} Max`,
                  type: 'line',
                  data: testMaxCoords,
                  smooth: false,
                  lineStyle: { width: 2, color: colors.testColor },
                  areaStyle: { opacity: 0.2, color: colors.testColor },
                  symbol: 'none',
                  animation: false,
                  connectNulls: true
                },
                {
                  name: `${testTensorName} Min`,
                  type: 'line',
                  data: testMinCoords,
                  smooth: false,
                  lineStyle: { width: 2, color: '#ff9944' },
                  areaStyle: { opacity: 0.2, color: '#ff9944' },
                  symbol: 'none',
                  animation: false,
                  connectNulls: true
                },
                {
                  name: `${referenceTensorName} Max`,
                  type: 'line',
                  data: refMaxCoords,
                  smooth: false,
                  lineStyle: { width: 2, color: colors.referenceColor, type: 'dashed' },
                  areaStyle: { opacity: 0.1, color: colors.referenceColor },
                  symbol: 'none',
                  animation: false,
                  connectNulls: true
                },
                {
                  name: `${referenceTensorName} Min`,
                  type: 'line',
                  data: refMinCoords,
                  smooth: false,
                  lineStyle: { width: 2, color: '#4499cc', type: 'dashed' },
                  areaStyle: { opacity: 0.1, color: '#4499cc' },
                  symbol: 'none',
                  animation: false,
                  connectNulls: true
                }
              );
            } else {
              // Regular comparison for properties without min/max
              const testCoords = data.map(d => {
                if (d.x !== undefined && d.y !== undefined) {
                  return [d.x, d.y];
                }
                const angleRad = d.angleRad;
                const radius = d.value;
                return [radius * Math.cos(angleRad), radius * Math.sin(angleRad)];
              });

              const refCoords = referenceData.map(d => {
                if (d.x !== undefined && d.y !== undefined) {
                  return [d.x, d.y];
                }
                const angleRad = d.angleRad;
                const radius = d.value;
                return [radius * Math.cos(angleRad), radius * Math.sin(angleRad)];
              });

              series.push(
                {
                  name: testTensorName,
                  type: 'line',
                  data: testCoords,
                  smooth: false,
                  lineStyle: { width: 2, color: colors.testColor },
                  areaStyle: { opacity: 0.2, color: colors.testColor },
                  symbol: 'none',
                  animation: false,
                  connectNulls: true
                },
                {
                  name: referenceTensorName,
                  type: 'line',
                  data: refCoords,
                  smooth: false,
                  lineStyle: { width: 2, color: colors.referenceColor, type: 'dashed' },
                  areaStyle: { opacity: 0.1, color: colors.referenceColor },
                  symbol: 'none',
                  animation: false,
                  connectNulls: true
                }
              );
            }
          }
        } else if (hasMinMax) {
          // Normal mode: show min/max for shear and Poisson
          const maxCoords = data.map(d => {
            if (d.x !== undefined && d.y !== undefined) {
              return [d.x, d.y];
            }
            const angleRad = d.angleRad;
            const radius = d.value;
            return [radius * Math.cos(angleRad), radius * Math.sin(angleRad)];
          });

          const minCoords = data.map(d => {
            const angleRad = d.angleRad;
            const radius = d.valueMin || 0;
            return [radius * Math.cos(angleRad), radius * Math.sin(angleRad)];
          });

          series.push(
            {
              name: 'Maximum',
              type: 'line',
              data: maxCoords,
              smooth: false,
              lineStyle: { width: 2, color: colors.testColor },
              areaStyle: { opacity: 0.3, color: colors.testColor },
              symbol: 'none',
              animation: false,
              connectNulls: true
            },
            {
              name: 'Minimum',
              type: 'line',
              data: minCoords,
              smooth: false,
              lineStyle: { width: 2, color: colors.referenceColor },
              areaStyle: { opacity: 0.3, color: colors.referenceColor },
              symbol: 'none',
              animation: false,
              connectNulls: true
            }
          );
        } else {
          // Normal mode: single curve
          series.push({
            type: 'line',
            data: polarCoords,
            smooth: false,
            lineStyle: { width: 2, color: colors.referenceColor },
            areaStyle: { opacity: 0.3, color: colors.referenceColor },
            symbol: 'none',
            animation: false,
            connectNulls: true
          });
        }

        return series;
      })(),
      legend: {
        show: (property === 'shear' || property === 'poisson') || (comparisonMode && referenceData),
        top: 30,
        textStyle: {
          color: 'var(--ifm-color-emphasis-800)',
          fontSize: 12
        },
        data: (() => {
          if (comparisonMode && referenceData) {
            if (showDifference) {
              return [{ name: `Difference (${testTensorName} - ${referenceTensorName})`, itemStyle: { color: colors.differenceColor } }];
            } else if (property === 'shear' || property === 'poisson') {
              return [
                { name: `${testTensorName} Max`, itemStyle: { color: colors.testColor } },
                { name: `${testTensorName} Min`, itemStyle: { color: '#ff9944' } },
                { name: `${referenceTensorName} Max`, itemStyle: { color: colors.referenceColor } },
                { name: `${referenceTensorName} Min`, itemStyle: { color: '#4499cc' } }
              ];
            } else {
              return [
                { name: testTensorName, itemStyle: { color: colors.testColor } },
                { name: referenceTensorName, itemStyle: { color: colors.referenceColor } }
              ];
            }
          } else if (property === 'shear' || property === 'poisson') {
            return [
              { name: 'Maximum', itemStyle: { color: colors.testColor } },
              { name: 'Minimum', itemStyle: { color: colors.referenceColor } }
            ];
          } else {
            return [];
          }
        })()
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
  }, [data, property, plane, referenceData, comparisonMode, showDifference, testTensorName, referenceTensorName]);

  return <div ref={chartRef} style={{ width: '100%', height: '100%', aspectRatio: '1/1' }} />;
};

export { PolarChart };
export default PolarChart;

