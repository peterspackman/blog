import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import 'echarts-gl';
import { SurfaceData, getPropertyTitle, getPropertyUnit, getComputedTensorColors, getComputedTensorColor } from './CommonFunctions';

interface MultiSurfaceDataset {
  data: SurfaceData;
  tensorId: string;
  name: string;
  colorIndex: number;
}

const SurfaceChart: React.FC<{
  data?: SurfaceData | null;
  multiSurfaceData?: MultiSurfaceDataset[];
  property: string;
  useScatter?: boolean;
}> = ({ data, multiSurfaceData, property, useScatter = true }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    // Use multi-tensor data if available, otherwise fall back to legacy data
    const datasetsToUse = multiSurfaceData && multiSurfaceData.length > 0 
      ? multiSurfaceData 
      : (data ? [{ data, tensorId: 'legacy', name: 'Tensor', colorIndex: 0 }] : []);
    
    if (datasetsToUse.length === 0) return;

    const chart = echarts.init(chartRef.current);

    // Calculate overall data range across all datasets for consistent scaling
    let allFlatData: number[] = [];
    datasetsToUse.forEach(dataset => {
      allFlatData = [...allFlatData, ...dataset.data.surfaceData.flat()];
    });
    allFlatData.sort((a, b) => a - b);
    const colorMin = Math.min(...allFlatData);
    const colorMax = Math.max(...allFlatData);

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
          const value = params.value[3] || params.value[2];
          return `${getPropertyTitle(property)}: ${value.toFixed(3)} ${getPropertyUnit(property)}`;
        }
      },
      visualMap: datasetsToUse.map((dataset, index) => ({
        show: false,
        seriesIndex: index,
        dimension: 3,
        min: colorMin,
        max: colorMax,
        inRange: {
          color: [getComputedTensorColor(dataset.colorIndex), getComputedTensorColor(dataset.colorIndex)]
        }
      })),
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
        show: datasetsToUse.length > 1,
        data: datasetsToUse.map(dataset => ({
          name: dataset.name,
          itemStyle: {
            color: getComputedTensorColor(dataset.colorIndex)
          }
        })),
        textStyle: {
          color: 'var(--ifm-color-emphasis-800)'
        }
      },
      series: datasetsToUse.map((dataset, index) => {
        const tensorColor = getComputedTensorColor(dataset.colorIndex);
        console.log(`Tensor ${dataset.name} (index ${dataset.colorIndex}): color = ${tensorColor}`);
        const surfaceData = dataset.data;
        
        // Generate 3D scatter points from surface data
        const scatterPoints = [];
        for (let i = 0; i < surfaceData.numU; i++) {
          for (let j = 0; j < surfaceData.numV; j++) {
            const u = (i / (surfaceData.numU - 1)) * 2 * Math.PI;
            const v = (j / (surfaceData.numV - 1)) * Math.PI;
            const value = surfaceData.surfaceData[i] && surfaceData.surfaceData[i][j] ? surfaceData.surfaceData[i][j] : 0;

            // Convert spherical to Cartesian coordinates using the property value as radius
            const x = value * Math.sin(v) * Math.cos(u);
            const y = value * Math.sin(v) * Math.sin(u);
            const z = value * Math.cos(v);

            scatterPoints.push([x, y, z, value]);
          }
        }

        if (useScatter) {
          return {
            name: dataset.name,
            type: 'scatter3D',
            data: scatterPoints,
            symbolSize: 2.5,
            itemStyle: {
              opacity: 0.8
            }
          };
        } else {
          // Create parametric surface using parametricEquation (like the original code)
          return {
            name: dataset.name,
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
              color: tensorColor
            },
            parametricEquation: {
              u: {
                min: 0,
                max: 2 * Math.PI,
                step: (2 * Math.PI) / (surfaceData.numU - 1)
              },
              v: {
                min: 0,
                max: Math.PI,
                step: Math.PI / (surfaceData.numV - 1)
              },
              x: function(u: number, v: number) {
                const i = Math.round((u / (2 * Math.PI)) * (surfaceData.numU - 1));
                const j = Math.round((v / Math.PI) * (surfaceData.numV - 1));
                const value = surfaceData.surfaceData[i] && surfaceData.surfaceData[i][j] ? surfaceData.surfaceData[i][j] : 0;
                return value * Math.sin(v) * Math.cos(u);
              },
              y: function(u: number, v: number) {
                const i = Math.round((u / (2 * Math.PI)) * (surfaceData.numU - 1));
                const j = Math.round((v / Math.PI) * (surfaceData.numV - 1));
                const value = surfaceData.surfaceData[i] && surfaceData.surfaceData[i][j] ? surfaceData.surfaceData[i][j] : 0;
                return value * Math.sin(v) * Math.sin(u);
              },
              z: function(u: number, v: number) {
                const i = Math.round((u / (2 * Math.PI)) * (surfaceData.numU - 1));
                const j = Math.round((v / Math.PI) * (surfaceData.numV - 1));
                const value = surfaceData.surfaceData[i] && surfaceData.surfaceData[i][j] ? surfaceData.surfaceData[i][j] : 0;
                return value * Math.cos(v);
              }
            }
          };
        }
      })
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [data, multiSurfaceData, property, useScatter]);

  return <div ref={chartRef} style={{ width: '100%', height: '100%', minHeight: '400px' }} />;
};

export { SurfaceChart };
export default SurfaceChart;