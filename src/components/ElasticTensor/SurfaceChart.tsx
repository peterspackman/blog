import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import 'echarts-gl';
import { SurfaceData, getPropertyTitle, getPropertyUnit, getComputedTensorColors } from './CommonFunctions';

const SurfaceChart: React.FC<{
  data: SurfaceData | null;
  property: string;
  useScatter?: boolean;
  referenceData?: SurfaceData | null;
  comparisonMode?: boolean;
  showDifference?: boolean;
  testTensorName?: string;
  referenceTensorName?: string;
}> = ({ data, property, useScatter = true, referenceData, comparisonMode = false, showDifference = false, testTensorName = 'Test Tensor', referenceTensorName = 'Reference Tensor' }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || !data) return;

    const chart = echarts.init(chartRef.current);
    const colors = getComputedTensorColors();

    // Calculate percentile-based color range for better contrast
    const flatData = data.surfaceData.flat().sort((a, b) => a - b);
    const p5 = flatData[Math.floor(flatData.length * 0.05)];
    const p95 = flatData[Math.floor(flatData.length * 0.95)];
    const colorMin = p5;
    const colorMax = p95;

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
          if (comparisonMode && referenceData && showDifference) {
            const diffValue = params.value[3];
            return `Difference: ${diffValue >= 0 ? '+' : ''}${diffValue.toFixed(3)} ${getPropertyUnit(property)}`;
          } else {
            const value = params.value[2];
            return `${getPropertyTitle(property)}: ${value.toFixed(3)} ${getPropertyUnit(property)}`;
          }
        }
      },
      visualMap: (() => {
        if (comparisonMode && referenceData && !showDifference) {
          // Overlay mode - no visual map, use solid colors
          return undefined;
        } else if (comparisonMode && referenceData && showDifference) {
          // Difference mode - calculate difference range and use diverging colors
          const diffData = [];
          for (let i = 0; i < data.numU && i < referenceData.numU; i++) {
            for (let j = 0; j < data.numV && j < referenceData.numV; j++) {
              const testValue = data.surfaceData[i] && data.surfaceData[i][j] ? data.surfaceData[i][j] : 0;
              const refValue = referenceData.surfaceData[i] && referenceData.surfaceData[i][j] ? referenceData.surfaceData[i][j] : 0;
              diffData.push(testValue - refValue);
            }
          }
          const maxAbsDiff = Math.max(...diffData.map(Math.abs));

          return {
            show: false,
            dimension: 3,
            min: -maxAbsDiff,
            max: maxAbsDiff,
            calculable: true,
            realtime: false,
            inRange: {
              color: [
                colors.referenceColor,  // Blue (negative differences - reference is higher)
                colors.diffZeroColor,   // White (no difference)
                colors.testColor        // Orange (positive differences - test is higher)
              ]
            }
          };
        } else {
          // Single tensor mode - use gradient
          return {
            show: false,
            dimension: 3,
            min: colorMin,
            max: colorMax,
            calculable: true,
            realtime: false,
            inRange: {
              color: [
                colors.referenceColor,  // Blue (low values)
                colors.testColor        // Orange (high values)
              ]
            }
          };
        }
      })(),
      xAxis3D: {
        type: 'value',
        name: 'X',
        nameTextStyle: {
          color: 'var(--ifm-color-emphasis-800)'
        }
      },
      yAxis3D: {
        type: 'value',
        name: 'Y',
        nameTextStyle: {
          color: 'var(--ifm-color-emphasis-800)'
        }
      },
      zAxis3D: {
        type: 'value',
        name: 'Z',
        nameTextStyle: {
          color: 'var(--ifm-color-emphasis-800)'
        }
      },
      grid3D: {
        viewControl: {
          projection: 'perspective'
        }
      },
      legend: {
        show: comparisonMode && referenceData,
        data: (() => {
          if (comparisonMode && referenceData && showDifference) {
            return [`Difference (${testTensorName} - ${referenceTensorName})`];
          } else if (comparisonMode && referenceData) {
            return [testTensorName, referenceTensorName];
          } else {
            return [];
          }
        })(),
        textStyle: {
          color: 'var(--ifm-color-emphasis-800)'
        }
      },
      series: (() => {
        const series = [];

        if (comparisonMode && referenceData && showDifference) {
          // Difference mode - show single series with differences
          if (useScatter) {
            series.push({
              name: `Difference (${testTensorName} - ${referenceTensorName})`,
              type: 'scatter3D',
              data: (() => {
                const scatterPoints = [];
                for (let i = 0; i < data.numU && i < referenceData.numU; i++) {
                  for (let j = 0; j < data.numV && j < referenceData.numV; j++) {
                    const u = (i / (data.numU - 1)) * 2 * Math.PI;
                    const v = (j / (data.numV - 1)) * Math.PI;
                    const testValue = data.surfaceData[i] && data.surfaceData[i][j] ? data.surfaceData[i][j] : 0;
                    const refValue = referenceData.surfaceData[i] && referenceData.surfaceData[i][j] ? referenceData.surfaceData[i][j] : 0;
                    const diffValue = testValue - refValue;

                    // Convert spherical to Cartesian coordinates using the difference value as radius
                    const x = diffValue * Math.sin(v) * Math.cos(u);
                    const y = diffValue * Math.sin(v) * Math.sin(u);
                    const z = diffValue * Math.cos(v);

                    scatterPoints.push([x, y, z, diffValue]); // [x, y, z, differenceValue]
                  }
                }
                return scatterPoints;
              })(),
              symbolSize: 2.5,
              itemStyle: {
                opacity: 0.9
              }
            });
          } else {
            // Difference surface
            series.push({
              name: `Difference (${testTensorName} - ${referenceTensorName})`,
              type: 'surface',
              parametric: true,
              itemStyle: {
                opacity: 0.8
              },
              parametricEquation: {
                u: {
                  min: 0,
                  max: 2 * Math.PI,
                  step: (2 * Math.PI) / (data.numU - 1)
                },
                v: {
                  min: 0,
                  max: Math.PI,
                  step: Math.PI / (data.numV - 1)
                },
                x: (u: number, v: number) => {
                  const i = Math.round((u / (2 * Math.PI)) * (data.numU - 1));
                  const j = Math.round((v / Math.PI) * (data.numV - 1));
                  const testValue = data.surfaceData[i] && data.surfaceData[i][j] ? data.surfaceData[i][j] : 0;
                  const refValue = referenceData.surfaceData[i] && referenceData.surfaceData[i][j] ? referenceData.surfaceData[i][j] : 0;
                  const diffValue = testValue - refValue;
                  return diffValue * Math.sin(v) * Math.cos(u);
                },
                y: (u: number, v: number) => {
                  const i = Math.round((u / (2 * Math.PI)) * (data.numU - 1));
                  const j = Math.round((v / Math.PI) * (data.numV - 1));
                  const testValue = data.surfaceData[i] && data.surfaceData[i][j] ? data.surfaceData[i][j] : 0;
                  const refValue = referenceData.surfaceData[i] && referenceData.surfaceData[i][j] ? referenceData.surfaceData[i][j] : 0;
                  const diffValue = testValue - refValue;
                  return diffValue * Math.sin(v) * Math.sin(u);
                },
                z: (u: number, v: number) => {
                  const i = Math.round((u / (2 * Math.PI)) * (data.numU - 1));
                  const j = Math.round((v / Math.PI) * (data.numV - 1));
                  const testValue = data.surfaceData[i] && data.surfaceData[i][j] ? data.surfaceData[i][j] : 0;
                  const refValue = referenceData.surfaceData[i] && referenceData.surfaceData[i][j] ? referenceData.surfaceData[i][j] : 0;
                  const diffValue = testValue - refValue;
                  return diffValue * Math.cos(v);
                }
              },
              data: (() => {
                const surfacePoints = [];
                for (let i = 0; i < data.numU; i++) {
                  const row = [];
                  for (let j = 0; j < data.numV; j++) {
                    const testValue = data.surfaceData[i] && data.surfaceData[i][j] ? data.surfaceData[i][j] : 0;
                    const refValue = referenceData.surfaceData[i] && referenceData.surfaceData[i][j] ? referenceData.surfaceData[i][j] : 0;
                    row.push(testValue - refValue); // Store difference for coloring
                  }
                  surfacePoints.push(row);
                }
                return surfacePoints;
              })()
            });
          }
        } else if (useScatter) {
          // Test tensor scatter
          series.push({
            name: comparisonMode && referenceData ? testTensorName : 'Data',
            type: 'scatter3D',
            data: (() => {
              const scatterPoints = [];
              for (let i = 0; i < data.numU; i++) {
                for (let j = 0; j < data.numV; j++) {
                  const u = (i / (data.numU - 1)) * 2 * Math.PI;
                  const v = (j / (data.numV - 1)) * Math.PI;
                  const value = data.surfaceData[i] && data.surfaceData[i][j] ? data.surfaceData[i][j] : 0;

                  // Convert spherical to Cartesian coordinates using property value as radius
                  const x = value * Math.sin(v) * Math.cos(u);
                  const y = value * Math.sin(v) * Math.sin(u);
                  const z = value * Math.cos(v);

                  scatterPoints.push([x, y, z, value]); // [x, y, z, colorValue]
                }
              }
              return scatterPoints;
            })(),
            symbolSize: 2.5,
            itemStyle: {
              opacity: 0.9,
              color: comparisonMode && referenceData ? colors.testColor : undefined
            }
          });

          // Reference tensor scatter
          if (comparisonMode && referenceData) {
            series.push({
              name: referenceTensorName,
              type: 'scatter3D',
              data: (() => {
                const scatterPoints = [];
                for (let i = 0; i < referenceData.numU; i++) {
                  for (let j = 0; j < referenceData.numV; j++) {
                    const u = (i / (referenceData.numU - 1)) * 2 * Math.PI;
                    const v = (j / (referenceData.numV - 1)) * Math.PI;
                    const value = referenceData.surfaceData[i] && referenceData.surfaceData[i][j] ? referenceData.surfaceData[i][j] : 0;

                    // Convert spherical to Cartesian coordinates using property value as radius
                    const x = value * Math.sin(v) * Math.cos(u);
                    const y = value * Math.sin(v) * Math.sin(u);
                    const z = value * Math.cos(v);

                    scatterPoints.push([x, y, z, value]); // [x, y, z, colorValue]
                  }
                }
                return scatterPoints;
              })(),
              symbolSize: 2.5,
              itemStyle: {
                opacity: 0.7,
                color: colors.referenceColor
              }
            });
          }
        } else {
          // Surface mode - show test tensor surface
          series.push({
            type: 'surface',
            parametric: true,
            shading: 'lambert',
            wireframe: {
              show: true,
              lineStyle: {
                color: 'rgba(0,0,0,0.1)',
                width: 0.5
              }
            },
            itemStyle: {
              opacity: 0.8,
              color: comparisonMode && referenceData ? colors.testColor : undefined
            },
            parametricEquation: {
              u: {
                min: 0,
                max: 2 * Math.PI,
                step: (2 * Math.PI) / (data.numU - 1)
              },
              v: {
                min: 0,
                max: Math.PI,
                step: Math.PI / (data.numV - 1)
              },
              x: function(u: number, v: number) {
                const i = Math.round((u / (2 * Math.PI)) * (data.numU - 1));
                const j = Math.round((v / Math.PI) * (data.numV - 1));
                const value = data.surfaceData[i] && data.surfaceData[i][j] ? data.surfaceData[i][j] : 0;
                return value * Math.sin(v) * Math.cos(u);
              },
              y: function(u: number, v: number) {
                const i = Math.round((u / (2 * Math.PI)) * (data.numU - 1));
                const j = Math.round((v / Math.PI) * (data.numV - 1));
                const value = data.surfaceData[i] && data.surfaceData[i][j] ? data.surfaceData[i][j] : 0;
                return value * Math.sin(v) * Math.sin(u);
              },
              z: function(u: number, v: number) {
                const i = Math.round((u / (2 * Math.PI)) * (data.numU - 1));
                const j = Math.round((v / Math.PI) * (data.numV - 1));
                const value = data.surfaceData[i] && data.surfaceData[i][j] ? data.surfaceData[i][j] : 0;
                return value * Math.cos(v);
              }
            }
          });

          // Add reference tensor surface in comparison mode
          if (comparisonMode && referenceData) {
            series.push({
              type: 'surface',
              parametric: true,
              shading: 'lambert',
              wireframe: {
                show: true,
                lineStyle: {
                  color: 'rgba(0,0,0,0.1)',
                  width: 0.5
                }
              },
              itemStyle: {
                opacity: 0.6,
                color: colors.referenceColor
              },
              parametricEquation: {
                u: {
                  min: 0,
                  max: 2 * Math.PI,
                  step: (2 * Math.PI) / (referenceData.numU - 1)
                },
                v: {
                  min: 0,
                  max: Math.PI,
                  step: Math.PI / (referenceData.numV - 1)
                },
                x: function(u: number, v: number) {
                  const i = Math.round((u / (2 * Math.PI)) * (referenceData.numU - 1));
                  const j = Math.round((v / Math.PI) * (referenceData.numV - 1));
                  const value = referenceData.surfaceData[i] && referenceData.surfaceData[i][j] ? referenceData.surfaceData[i][j] : 0;
                  return value * Math.sin(v) * Math.cos(u);
                },
                y: function(u: number, v: number) {
                  const i = Math.round((u / (2 * Math.PI)) * (referenceData.numU - 1));
                  const j = Math.round((v / Math.PI) * (referenceData.numV - 1));
                  const value = referenceData.surfaceData[i] && referenceData.surfaceData[i][j] ? referenceData.surfaceData[i][j] : 0;
                  return value * Math.sin(v) * Math.sin(u);
                },
                z: function(u: number, v: number) {
                  const i = Math.round((u / (2 * Math.PI)) * (referenceData.numU - 1));
                  const j = Math.round((v / Math.PI) * (referenceData.numV - 1));
                  const value = referenceData.surfaceData[i] && referenceData.surfaceData[i][j] ? referenceData.surfaceData[i][j] : 0;
                  return value * Math.cos(v);
                }
              }
            });
          }
        }

        return series;
      })()
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [data, property, useScatter, referenceData, comparisonMode, showDifference, testTensorName, referenceTensorName]);

  return <div ref={chartRef} style={{ width: '100%', height: '100%', minHeight: '400px' }} />;
};

export { SurfaceChart };
export default SurfaceChart;

