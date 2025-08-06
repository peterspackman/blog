import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as echarts from 'echarts';
import 'echarts-gl';
import styles from './ElasticTensor.module.css';

interface ElasticProperties {
  bulkModulus: { voigt: number; reuss: number; hill: number };
  shearModulus: { voigt: number; reuss: number; hill: number };
  youngsModulus: { voigt: number; reuss: number; hill: number };
  poissonRatio: { voigt: number; reuss: number; hill: number };
  linearCompressibility: { voigt: number; reuss: number; hill: number };
}

interface DirectionalData {
  angle: number;
  angleRad: number;
  value: number;
  valueMin?: number;
  valueMax?: number;
  x?: number;
  y?: number;
}

interface AnalysisResult {
  properties: ElasticProperties;
  eigenvalues: number[] | null;
  eigenvalueError?: string;
  isPositiveDefinite: boolean;
  extrema: {
    shearModulus: { min: number; max: number; anisotropy: number };
    youngsModulus: { min: number; max: number; anisotropy: number };
    poissonRatio: { min: number; max: number; anisotropy: number };
    linearCompressibility: { min: number; max: number; anisotropy: number };
  };
  stiffnessMatrix: number[][];
  complianceMatrix: number[][];
}

interface SurfaceData {
  surfaceData: number[][];
  minValue: number;
  maxValue: number;
  property: string;
  numU: number;
  numV: number;
}

const DirectionalChart = React.forwardRef<HTMLDivElement, {
  data: DirectionalData[];
  property: string;
  referenceData?: DirectionalData[];
  comparisonMode?: boolean;
  showDifference?: boolean;
  testTensorName?: string;
  referenceTensorName?: string;
}>((props, ref) => {
  const { data, property, referenceData, comparisonMode = false, showDifference = false, testTensorName = 'Test Tensor', referenceTensorName = 'Reference Tensor' } = props;
  const chartRef = useRef<HTMLDivElement>(null);
  
  const saveChart = () => {
    if (chartRef.current) {
      const chartInstance = echarts.getInstanceByDom(chartRef.current);
      if (chartInstance) {
        const url = chartInstance.getDataURL({
          type: 'png',
          pixelRatio: 2,
          backgroundColor: '#fff'
        });
        const link = document.createElement('a');
        link.download = `${getPropertyTitle(property)}_directional_${testTensorName.replace(/\s+/g, '_')}.png`;
        link.href = url;
        link.click();
      }
    }
  };
  
  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;
    
    const chart = echarts.init(chartRef.current);
    
    const hasMinMax = property === 'shear' || property === 'poisson';
    const series = [];
    
    // Get value range for color mapping
    let values = data.map(d => d.value);
    if (comparisonMode && referenceData) {
      values = [...values, ...referenceData.map(d => d.value)];
    }
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    
    if (comparisonMode && referenceData) {
      if (showDifference) {
        // Show difference
        const differenceData = calculateDirectionalDifferences(data, referenceData);
        series.push({
          name: `Difference (${testTensorName} - ${referenceTensorName})`,
          type: 'line',
          data: differenceData.map(d => [d.angle, d.value]),
          smooth: true,
          lineStyle: { width: 3, color: '#cc0066' },
          areaStyle: { color: '#cc0066', opacity: 0.4 },
          itemStyle: { color: '#cc0066' },
          symbol: 'none',
          animation: false
        });
      } else {
        // Show overlay with min/max support
        if (hasMinMax) {
          // Test tensor max and min
          series.push(
            {
              name: `${testTensorName} Max`,
              type: 'line',
              data: data.map(d => [d.angle, d.value]),
              smooth: true,
              lineStyle: { width: 2, color: '#ff6600' },
              areaStyle: { color: '#ff6600', opacity: 0.2 },
              itemStyle: { color: '#ff6600' },
              symbol: 'none',
              animation: false
            },
            {
              name: `${testTensorName} Min`,
              type: 'line',
              data: data.map(d => [d.angle, d.valueMin || 0]),
              smooth: true,
              lineStyle: { width: 2, color: '#ff9944' },
              areaStyle: { color: '#ff9944', opacity: 0.2 },
              itemStyle: { color: '#ff9944' },
              symbol: 'none',
              animation: false
            },
            // Reference tensor max and min
            {
              name: `${referenceTensorName} Max`,
              type: 'line',
              data: referenceData.map(d => [d.angle, d.value]),
              smooth: true,
              lineStyle: { width: 2, color: '#0066cc', type: 'dashed' },
              areaStyle: { color: '#0066cc', opacity: 0.1 },
              itemStyle: { color: '#0066cc' },
              symbol: 'none',
              animation: false
            },
            {
              name: `${referenceTensorName} Min`,
              type: 'line',
              data: referenceData.map(d => [d.angle, d.valueMin || 0]),
              smooth: true,
              lineStyle: { width: 2, color: '#4499cc', type: 'dashed' },
              areaStyle: { color: '#4499cc', opacity: 0.1 },
              itemStyle: { color: '#4499cc' },
              symbol: 'none',
              animation: false
            }
          );
        } else {
          // Regular comparison for properties without min/max
          series.push(
            {
              name: testTensorName,
              type: 'line',
              data: data.map(d => [d.angle, d.value]),
              smooth: true,
              lineStyle: { width: 2, color: '#ff6600' },
              areaStyle: { color: '#ff6600', opacity: 0.2 },
              itemStyle: { color: '#ff6600' },
              symbol: 'none',
              animation: false
            },
            {
              name: referenceTensorName,
              type: 'line',
              data: referenceData.map(d => [d.angle, d.value]),
              smooth: true,
              lineStyle: { width: 2, color: '#0066cc', type: 'dashed' },
              areaStyle: { color: '#0066cc', opacity: 0.1 },
              itemStyle: { color: '#0066cc' },
              symbol: 'none',
              animation: false
            }
          );
        }
      }
    } else if (hasMinMax) {
      const minValues = data.map(d => d.valueMin || 0);
      const allValues = [...values, ...minValues];
      const globalMin = Math.min(...allValues);
      const globalMax = Math.max(...allValues);
      
      series.push({
        name: 'Maximum',
        type: 'line',
        data: data.map(d => [d.angle, d.value]),
        smooth: true,
        lineStyle: { width: 2, color: '#ff6600' },
        areaStyle: { color: '#ff6600', opacity: 0.3 },
        itemStyle: { color: '#ff6600' },
        symbol: 'none',
        animation: false
      });
      
      series.push({
        name: 'Minimum',
        type: 'line',
        data: data.map(d => [d.angle, d.valueMin || 0]),
        smooth: true,
        lineStyle: { width: 2, color: '#0066cc' },
        areaStyle: { color: '#0066cc', opacity: 0.3 },
        itemStyle: { color: '#0066cc' },
        symbol: 'none',
        animation: false
      });
    } else {
      series.push({
        name: 'Value',
        type: 'line',
        data: data.map(d => [d.angle, d.value]),
        smooth: true,
        lineStyle: { width: 2, color: '#0066cc' },
        areaStyle: { color: '#0066cc', opacity: 0.3 },
        itemStyle: { color: '#0066cc' },
        symbol: 'none',
        animation: false
      });
    }
    
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
            backgroundColor: '#fff',
            pixelRatio: 2
          }
        }
      },
      grid: {
        left: 80,
        right: 40,
        top: 70,
        bottom: 70,
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
        show: true,
        top: 10,
        textStyle: {
          color: 'var(--ifm-color-emphasis-800)',
          fontSize: 12
        },
        data: (() => {
          if (comparisonMode && referenceData) {
            if (showDifference) {
              return [{ name: `Difference (${testTensorName} - ${referenceTensorName})`, itemStyle: { color: '#cc0066' } }];
            } else if (hasMinMax) {
              return [
                { name: `${testTensorName} Max`, itemStyle: { color: '#ff6600' } },
                { name: `${testTensorName} Min`, itemStyle: { color: '#ff9944' } },
                { name: `${referenceTensorName} Max`, itemStyle: { color: '#0066cc' } },
                { name: `${referenceTensorName} Min`, itemStyle: { color: '#4499cc' } }
              ];
            } else {
              return [
                { name: testTensorName, itemStyle: { color: '#ff6600' } },
                { name: referenceTensorName, itemStyle: { color: '#0066cc' } }
              ];
            }
          } else if (hasMinMax) {
            return [
              { name: 'Maximum', itemStyle: { color: '#ff6600' } },
              { name: 'Minimum', itemStyle: { color: '#0066cc' } }
            ];
          } else {
            return [{ name: 'Value', itemStyle: { color: '#0066cc' } }];
          }
        })()
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
        }
      },
      yAxis: {
        type: 'value',
        name: `${getPropertyTitle(property)} (${getPropertyUnit(property)})`,
        nameLocation: 'center',
        nameGap: 60,
        nameRotate: 90,
        scale: true,
        axisLabel: {
          margin: 15
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
  }, [data, property, referenceData, comparisonMode, showDifference, testTensorName, referenceTensorName]);
  
  return <div ref={chartRef} style={{ width: '100%', height: '100%', aspectRatio: '1/1' }} />;
});

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
            backgroundColor: '#fff',
            pixelRatio: 2
          }
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const [x, y] = params.data;
          const radius = Math.sqrt(x*x + y*y);
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
              lineStyle: { width: 3, color: '#cc0066', type: 'solid' }, // Thicker purple line for differences
              areaStyle: { opacity: 0.4, color: '#cc0066' },
              symbol: 'circle',
              symbolSize: 4,
              itemStyle: { color: '#cc0066' },
              animation: false,
              connectNulls: true,
              emphasis: {
                lineStyle: { width: 4 },
                itemStyle: { borderWidth: 2, borderColor: '#fff' }
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
                  lineStyle: { width: 2, color: '#ff6600' },
                  areaStyle: { opacity: 0.2, color: '#ff6600' },
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
                  lineStyle: { width: 2, color: '#0066cc', type: 'dashed' },
                  areaStyle: { opacity: 0.1, color: '#0066cc' },
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
                  lineStyle: { width: 2, color: '#ff6600' },
                  areaStyle: { opacity: 0.2, color: '#ff6600' },
                  symbol: 'none',
                  animation: false,
                  connectNulls: true
                },
                {
                  name: referenceTensorName,
                  type: 'line',
                  data: refCoords,
                  smooth: false,
                  lineStyle: { width: 2, color: '#0066cc', type: 'dashed' },
                  areaStyle: { opacity: 0.1, color: '#0066cc' },
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
              lineStyle: { width: 2, color: '#ff6600' },
              areaStyle: { opacity: 0.3, color: '#ff6600' },
              symbol: 'none',
              animation: false,
              connectNulls: true
            },
            {
              name: 'Minimum',
              type: 'line', 
              data: minCoords,
              smooth: false,
              lineStyle: { width: 2, color: '#0066cc' },
              areaStyle: { opacity: 0.3, color: '#0066cc' },
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
            lineStyle: { width: 2, color: '#0066cc' },
            areaStyle: { opacity: 0.3, color: '#0066cc' },
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
              return [{ name: `Difference (${testTensorName} - ${referenceTensorName})`, itemStyle: { color: '#cc0066' } }];
            } else if (property === 'shear' || property === 'poisson') {
              return [
                { name: `${testTensorName} Max`, itemStyle: { color: '#ff6600' } },
                { name: `${testTensorName} Min`, itemStyle: { color: '#ff9944' } },
                { name: `${referenceTensorName} Max`, itemStyle: { color: '#0066cc' } },
                { name: `${referenceTensorName} Min`, itemStyle: { color: '#4499cc' } }
              ];
            } else {
              return [
                { name: testTensorName, itemStyle: { color: '#ff6600' } },
                { name: referenceTensorName, itemStyle: { color: '#0066cc' } }
              ];
            }
          } else if (property === 'shear' || property === 'poisson') {
            return [
              { name: 'Maximum', itemStyle: { color: '#ff6600' } },
              { name: 'Minimum', itemStyle: { color: '#0066cc' } }
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
          const radius = Math.sqrt(x*x + y*y);
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
            backgroundColor: '#fff',
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
                '#0066cc',  // Blue (negative differences - reference is higher)
                '#ffffff',  // White (no difference)
                '#ff6600'   // Orange (positive differences - test is higher)
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
                '#0066cc',  // Blue (low values)
                '#ff6600'   // Orange (high values)
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
              color: comparisonMode && referenceData ? '#ff6600' : undefined
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
                color: '#0066cc'
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
              color: comparisonMode && referenceData ? '#ff6600' : undefined
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
              x: function (u: number, v: number) {
                const i = Math.round((u / (2 * Math.PI)) * (data.numU - 1));
                const j = Math.round((v / Math.PI) * (data.numV - 1));
                const value = data.surfaceData[i] && data.surfaceData[i][j] ? data.surfaceData[i][j] : 0;
                return value * Math.sin(v) * Math.cos(u);
              },
              y: function (u: number, v: number) {
                const i = Math.round((u / (2 * Math.PI)) * (data.numU - 1));
                const j = Math.round((v / Math.PI) * (data.numV - 1));
                const value = data.surfaceData[i] && data.surfaceData[i][j] ? data.surfaceData[i][j] : 0;
                return value * Math.sin(v) * Math.sin(u);
              },
              z: function (u: number, v: number) {
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
                color: '#0066cc'
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
                x: function (u: number, v: number) {
                  const i = Math.round((u / (2 * Math.PI)) * (referenceData.numU - 1));
                  const j = Math.round((v / Math.PI) * (referenceData.numV - 1));
                  const value = referenceData.surfaceData[i] && referenceData.surfaceData[i][j] ? referenceData.surfaceData[i][j] : 0;
                  return value * Math.sin(v) * Math.cos(u);
                },
                y: function (u: number, v: number) {
                  const i = Math.round((u / (2 * Math.PI)) * (referenceData.numU - 1));
                  const j = Math.round((v / Math.PI) * (referenceData.numV - 1));
                  const value = referenceData.surfaceData[i] && referenceData.surfaceData[i][j] ? referenceData.surfaceData[i][j] : 0;
                  return value * Math.sin(v) * Math.sin(u);
                },
                z: function (u: number, v: number) {
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

const TensorMatrixChart: React.FC<{
  data: number[][];
  referenceData?: number[][];
  comparisonMode?: boolean;
  showDifference?: boolean;
  testTensorName?: string;
  referenceTensorName?: string;
}> = ({ data, referenceData, comparisonMode = false, showDifference = false, testTensorName = 'Test Tensor', referenceTensorName = 'Reference Tensor' }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || !data) return;

    const chart = echarts.init(chartRef.current);
    
    // Prepare data for heatmap
    const heatmapData = [];
    const flatData = [];
    
    if (comparisonMode && referenceData && showDifference) {
      // Difference mode
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
          const diffValue = data[i][j] - referenceData[i][j];
          heatmapData.push([j, 5-i, diffValue]); // Flip y-axis for proper matrix display
          flatData.push(diffValue);
        }
      }
    } else {
      // Single tensor or overlay mode (show test tensor)
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
          heatmapData.push([j, 5-i, data[i][j]]); // Flip y-axis for proper matrix display  
          flatData.push(data[i][j]);
        }
      }
    }

    const minValue = Math.min(...flatData);
    const maxValue = Math.max(...flatData);
    const isDifference = comparisonMode && referenceData && showDifference;
    
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
            backgroundColor: '#fff',
            pixelRatio: 2
          }
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const [col, row, value] = params.data;
          const realRow = 5 - row; // Convert back from flipped coordinates
          const element = `C${realRow + 1}${col + 1}`;
          if (isDifference) {
            return `${element}: ${value >= 0 ? '+' : ''}${value.toFixed(3)} GPa<br/>Difference`;
          } else {
            return `${element}: ${value.toFixed(3)} GPa`;
          }
        }
      },
      grid: {
        height: '60%',
        width: '60%',
        left: 'center',
        top: 60,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: ['C₁₁', 'C₁₂', 'C₁₃', 'C₁₄', 'C₁₅', 'C₁₆'],
        position: 'top',
        axisLine: { show: true },
        axisTick: { show: false },
        axisLabel: {
          fontSize: 12,
          color: 'var(--ifm-color-emphasis-800)'
        },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'category', 
        data: ['C₆₁', 'C₅₁', 'C₄₁', 'C₃₁', 'C₂₁', 'C₁₁'],
        axisLine: { show: true },
        axisTick: { show: false },
        axisLabel: {
          fontSize: 12,
          color: 'var(--ifm-color-emphasis-800)'
        },
        splitLine: { show: false }
      },
      visualMap: {
        min: -Math.max(Math.abs(minValue), Math.abs(maxValue)),
        max: Math.max(Math.abs(minValue), Math.abs(maxValue)),
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '5%',
        inRange: {
          color: [
            '#0066cc',  // Blue (negative values)
            '#ffffff',  // White (zero)
            '#ff6600'   // Orange (positive values)
          ]
        },
        text: isDifference ? ['Ref Higher', 'Test Higher'] : ['Negative', 'Positive'],
        textStyle: {
          color: 'var(--ifm-color-emphasis-800)'
        }
      },
      series: [{
        name: 'Tensor Values',
        type: 'heatmap',
        data: heatmapData,
        label: {
          show: true,
          formatter: (params: any) => {
            const value = params.data[2];
            return Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(2);
          },
          color: '#000000',
          fontSize: 14
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [data, referenceData, comparisonMode, showDifference, testTensorName, referenceTensorName]);

  return <div ref={chartRef} style={{ width: '100%', height: '100%', minHeight: '350px', aspectRatio: '1/1' }} />;
};

const DualMatrixChart: React.FC<{
  stiffnessMatrix: number[][];
  complianceMatrix: number[][];
  referenceStiffness?: number[][];
  referenceCompliance?: number[][];
  comparisonMode?: boolean;
  showDifference?: boolean;
  testTensorName?: string;
  referenceTensorName?: string;
}> = ({ stiffnessMatrix, complianceMatrix, referenceStiffness, referenceCompliance, comparisonMode = false, showDifference = false, testTensorName = 'Test Tensor', referenceTensorName = 'Reference Tensor' }) => {
  
  const copyMatrixToClipboard = (matrix: number[][], matrixName: string) => {
    let text = `${matrixName}\n`;
    text += matrix.map(row => 
      row.map(val => val.toFixed(3).padStart(10)).join('')
    ).join('\n');
    navigator.clipboard.writeText(text);
  };

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '1fr 1fr', 
      gap: '1rem', 
      width: '100%',
      minHeight: '450px',
      height: 'auto'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          marginBottom: '0.5rem',
          flex: 'none'
        }}>
          <h4 style={{ 
            color: 'var(--ifm-color-emphasis-800)',
            fontSize: '1rem',
            fontWeight: '600',
            margin: 0
          }}>
            Stiffness Matrix (C) - GPa
          </h4>
          <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem' }}>
            <button 
              onClick={() => copyMatrixToClipboard(stiffnessMatrix, `Stiffness Matrix (C) - GPa - ${testTensorName}`)}
              className={styles.copyButton}
              title="Copy stiffness matrix to clipboard"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="m5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button 
              onClick={() => {
                const container = document.querySelector('.stiffness-matrix-chart') as HTMLDivElement;
                if (container) {
                  const chartInstance = echarts.getInstanceByDom(container);
                  if (chartInstance) {
                    const url = chartInstance.getDataURL({
                      type: 'png',
                      pixelRatio: 2,
                      backgroundColor: '#fff'
                    });
                    const link = document.createElement('a');
                    link.download = `Stiffness_Matrix_${testTensorName.replace(/\s+/g, '_')}.png`;
                    link.href = url;
                    link.click();
                  }
                }
              }}
              className={styles.copyButton}
              title="Save stiffness matrix as PNG"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17,21 17,13 7,13 7,21"/>
                <polyline points="7,3 7,8 15,8"/>
              </svg>
            </button>
          </div>
        </div>
        <div style={{ flex: '1', minHeight: '400px' }}>
          <div className="stiffness-matrix-chart">
            <TensorMatrixChart
              data={stiffnessMatrix}
              referenceData={referenceStiffness}
              comparisonMode={comparisonMode}
              showDifference={showDifference}
              testTensorName={testTensorName}
              referenceTensorName={referenceTensorName}
            />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          marginBottom: '0.5rem',
          flex: 'none'
        }}>
          <h4 style={{ 
            color: 'var(--ifm-color-emphasis-800)',
            fontSize: '1rem',
            fontWeight: '600',
            margin: 0
          }}>
            Compliance Matrix (S) - GPa⁻¹
          </h4>
          <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem' }}>
            <button 
              onClick={() => copyMatrixToClipboard(complianceMatrix, `Compliance Matrix (S) - GPa⁻¹ - ${testTensorName}`)}
              className={styles.copyButton}
              title="Copy compliance matrix to clipboard"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="m5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button 
              onClick={() => {
                const container = document.querySelector('.compliance-matrix-chart') as HTMLDivElement;
                if (container) {
                  const chartInstance = echarts.getInstanceByDom(container);
                  if (chartInstance) {
                    const url = chartInstance.getDataURL({
                      type: 'png',
                      pixelRatio: 2,
                      backgroundColor: '#fff'
                    });
                    const link = document.createElement('a');
                    link.download = `Compliance_Matrix_${testTensorName.replace(/\s+/g, '_')}.png`;
                    link.href = url;
                    link.click();
                  }
                }
              }}
              className={styles.copyButton}
              title="Save compliance matrix as PNG"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17,21 17,13 7,13 7,21"/>
                <polyline points="7,3 7,8 15,8"/>
              </svg>
            </button>
          </div>
        </div>
        <div style={{ flex: '1', minHeight: '400px' }}>
          <div className="compliance-matrix-chart">
            <TensorMatrixChart
              data={complianceMatrix}
              referenceData={referenceCompliance}
              comparisonMode={comparisonMode}
              showDifference={showDifference}
              testTensorName={testTensorName}
              referenceTensorName={referenceTensorName}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

function getPropertyTitle(property: string): string {
  const titles = {
    'youngs': "Young's Modulus",
    'linear_compressibility': 'Linear Compressibility',
    'shear': 'Shear Modulus',
    'poisson': "Poisson's Ratio"
  };
  return titles[property] || property;
}

function getPropertyUnit(property: string): string {
  const units = {
    'youngs': 'GPa',
    'linear_compressibility': 'TPa⁻¹',
    'shear': 'GPa',
    'poisson': ''
  };
  return units[property] || '';
}

// Calculate differences between test and reference data
const calculateDirectionalDifferences = (testData: DirectionalData[], referenceData: DirectionalData[]): DirectionalData[] => {
  if (!testData || !referenceData || testData.length !== referenceData.length) {
    return [];
  }
  
  return testData.map((testPoint, i) => {
    const refPoint = referenceData[i];
    return {
      angle: testPoint.angle,
      angleRad: testPoint.angleRad,
      value: testPoint.value - refPoint.value,
      valueMin: (testPoint.valueMin || 0) - (refPoint.valueMin || 0),
      valueMax: (testPoint.valueMax || 0) - (refPoint.valueMax || 0),
      x: testPoint.x !== undefined && refPoint.x !== undefined ? testPoint.x - refPoint.x : undefined,
      y: testPoint.y !== undefined && refPoint.y !== undefined ? testPoint.y - refPoint.y : undefined
    };
  });
};

// Utility functions for displaying differences
const getDifferenceColor = (diff: number): string => {
  if (Math.abs(diff) < 0.001) return 'var(--ifm-color-emphasis-600)'; // Gray for no change
  return diff > 0 ? '#28a745' : '#dc3545'; // Green for positive, red for negative
};

const getDifferenceSign = (diff: number): string => {
  if (Math.abs(diff) < 0.001) return '±';
  return diff > 0 ? '+' : '-';
};

// Copy to clipboard function
const copyTableToClipboard = (tableType: string, data: any) => {
  let text = '';
  
  if (tableType === 'averages') {
    text = `Averaging scheme\tBulk modulus (GPa)\tYoung's modulus (GPa)\tShear modulus (GPa)\tPoisson's ratio\n`;
    text += `Voigt\t${data.properties.bulkModulus.voigt.toFixed(3)}\t${data.properties.youngsModulus.voigt.toFixed(3)}\t${data.properties.shearModulus.voigt.toFixed(3)}\t${data.properties.poissonRatio.voigt.toFixed(5)}\n`;
    text += `Reuss\t${data.properties.bulkModulus.reuss.toFixed(3)}\t${data.properties.youngsModulus.reuss.toFixed(3)}\t${data.properties.shearModulus.reuss.toFixed(3)}\t${data.properties.poissonRatio.reuss.toFixed(5)}\n`;
    text += `Hill\t${data.properties.bulkModulus.hill.toFixed(3)}\t${data.properties.youngsModulus.hill.toFixed(3)}\t${data.properties.shearModulus.hill.toFixed(3)}\t${data.properties.poissonRatio.hill.toFixed(5)}`;
  } else if (tableType === 'eigenvalues') {
    text = `Eigenvalue\tValue (GPa)\n`;
    data.eigenvalues.forEach((val: number, i: number) => {
      text += `λ${i+1}\t${val.toFixed(3)}\n`;
    });
    text = text.trim();
  } else if (tableType === 'variations') {
    text = `Property\tMinimum\tMaximum\tAnisotropy\n`;
    text += `Young's modulus (GPa)\t${data.extrema.youngsModulus.min.toFixed(3)}\t${data.extrema.youngsModulus.max.toFixed(3)}\t${data.extrema.youngsModulus.anisotropy.toFixed(2)}\n`;
    text += `Linear compressibility (TPa⁻¹)\t${data.extrema.linearCompressibility.min.toFixed(3)}\t${data.extrema.linearCompressibility.max.toFixed(3)}\t${data.extrema.linearCompressibility.anisotropy.toFixed(4)}\n`;
    text += `Shear modulus (GPa)\t${data.extrema.shearModulus.min.toFixed(3)}\t${data.extrema.shearModulus.max.toFixed(3)}\t${data.extrema.shearModulus.anisotropy.toFixed(2)}\n`;
    text += `Poisson's ratio\t${data.extrema.poissonRatio.min.toFixed(5)}\t${data.extrema.poissonRatio.max.toFixed(5)}\t${isFinite(data.extrema.poissonRatio.anisotropy) ? data.extrema.poissonRatio.anisotropy.toFixed(2) : '∞'}`;
  }
  
  navigator.clipboard.writeText(text).then(() => {
    console.log('Table copied to clipboard');
  }).catch(err => {
    console.error('Failed to copy table: ', err);
  });
};

export const ElasticTensor: React.FC = () => {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [tensorInput, setTensorInput] = useState<string>('');
  const [tensorData, setTensorData] = useState<number[][] | null>(null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<string>('youngs');
  const [selectedPlane, setSelectedPlane] = useState<string>('xy');
  const [directionalData, setDirectionalData] = useState<{ [key: string]: DirectionalData[] }>({});
  const [surfaceData, setSurfaceData] = useState<SurfaceData | null>(null);
  const [show3D, setShow3D] = useState<boolean>(false);
  const [use3DScatter, setUse3DScatter] = useState<boolean>(true);
  const [comparisonMode, setComparisonMode] = useState<boolean>(false);
  const [referenceTensorInput, setReferenceTensorInput] = useState<string>('');
  const [referenceTensorData, setReferenceTensorData] = useState<number[][] | null>(null);
  const referenceTensorRef = useRef<number[][] | null>(null);
  const [referenceAnalysisResults, setReferenceAnalysisResults] = useState<AnalysisResult | null>(null);
  const [referenceDirectionalData, setReferenceDirectionalData] = useState<{ [key: string]: DirectionalData[] }>({});
  const [referenceSurfaceData, setReferenceSurfaceData] = useState<SurfaceData | null>(null);
  const [analysisCount, setAnalysisCount] = useState<number>(0);
  const [isProcessingReference, setIsProcessingReference] = useState<boolean>(false);
  const processingRefRef = useRef<boolean>(false);
  const [showDifference, setShowDifference] = useState<boolean>(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string>('');
  const [logs, setLogs] = useState<Array<{ message: string; level: string; timestamp: Date }>>([]);
  const [tensorName, setTensorName] = useState<string>('');
  const [referenceTensorName, setReferenceTensorName] = useState<string>('');
  const [savedTensors, setSavedTensors] = useState<Array<{ name: string; data: string; timestamp: Date }>>([]);
  const [showLoadDropdown, setShowLoadDropdown] = useState<boolean>(false);
  const [showReferenceLoadDropdown, setShowReferenceLoadDropdown] = useState<boolean>(false);

  // Initialize worker on mount and load saved tensors
  useEffect(() => {
    initializeWorker();
    loadSavedTensors();
    return () => {
      if (worker) {
        worker.terminate();
      }
    };
  }, []);

  const initializeWorker = async () => {
    try {
      const newWorker = new Worker(
        new URL('./elastic-worker.js', import.meta.url),
        { type: 'module' }
      );

      newWorker.onmessage = handleWorkerMessage;
      newWorker.onerror = (error) => {
        console.error('Worker error:', error);
        setError('Worker error: ' + error.message);
        setIsWorkerReady(false);
      };

      setWorker(newWorker);

      // Initialize OCC in worker
      newWorker.postMessage({
        type: 'init',
        data: {}
      });
    } catch (error) {
      console.error('Failed to initialize worker:', error);
      setError('Failed to initialize Web Worker: ' + error.message);
    }
  };

  const handleWorkerMessage = (e: MessageEvent) => {
    const { type, ...data } = e.data;

    switch (type) {
      case 'initialized':
        if (data.success) {
          setIsWorkerReady(true);
          addLog('Worker initialized successfully', 'info');
        } else {
          setIsWorkerReady(false);
          setError('Worker initialization failed: ' + data.error);
        }
        break;

      case 'log':
        addLog(data.message, mapLogLevel(data.level));
        break;

      case 'analysisResult':
        if (data.success) {
          if (processingRefRef.current) {
            // This is the reference tensor result
            setReferenceAnalysisResults(data.data);
            setIsProcessingReference(false);
            processingRefRef.current = false;
            
            // Now that we have both tensors analyzed, generate directional data for both
            setTimeout(() => generateDirectionalDataForBoth(), 100);
            setIsCalculating(false);
          } else {
            // This is the test tensor result
            setAnalysisResults(data.data);
            
            // If not in comparison mode, generate data immediately
            if (!comparisonMode) {
              setTimeout(() => generateDirectionalDataForBoth(), 100);
              setIsCalculating(false);
            }
            // If in comparison mode, wait for reference analysis to complete
          }
        } else {
          setError('Analysis failed: ' + data.error);
          setIsCalculating(false);
        }
        break;

      case 'directionalDataResult':
        if (data.success) {
          if (data.isReference) {
            setReferenceDirectionalData(prev => ({
              ...prev,
              [data.plane]: data.data
            }));
          } else {
            setDirectionalData(prev => ({
              ...prev,
              [data.plane]: data.data
            }));
          }
        } else {
          setError('Directional data generation failed: ' + data.error);
        }
        break;
        
      case '3DSurfaceResult':
        if (data.success) {
          if (data.isReference) {
            setReferenceSurfaceData(data.data);
          } else {
            setSurfaceData(data.data);
          }
        } else {
          setError('3D surface generation failed: ' + data.error);
        }
        break;

      case 'error':
        console.error('Worker error:', data.error);
        setError('Calculation error: ' + data.error);
        setIsCalculating(false);
        break;
    }
  };

  const mapLogLevel = (level: number): string => {
    switch (level) {
      case 0:
      case 1:
        return 'debug';
      case 2:
        return 'info';
      case 3:
        return 'warning';
      case 4:
      default:
        return 'error';
    }
  };

  const addLog = (message: string, level: string) => {
    setLogs(prev => [...prev, { message, level, timestamp: new Date() }]);
  };

  // localStorage functions
  const loadSavedTensors = () => {
    try {
      const saved = localStorage.getItem('elasticTensors');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Convert timestamp strings back to Date objects
        const tensors = parsed.map((t: any) => ({
          ...t,
          timestamp: new Date(t.timestamp)
        }));
        setSavedTensors(tensors);
      }
    } catch (error) {
      console.error('Failed to load saved tensors:', error);
    }
  };

  const saveTensor = (name: string, data: string) => {
    if (!name.trim() || !data.trim()) return;
    
    try {
      const newTensor = {
        name: name.trim(),
        data: data.trim(),
        timestamp: new Date()
      };
      
      const updatedTensors = [newTensor, ...savedTensors.filter(t => t.name !== name.trim())];
      setSavedTensors(updatedTensors);
      localStorage.setItem('elasticTensors', JSON.stringify(updatedTensors));
      addLog(`Saved tensor: ${name}`, 'info');
    } catch (error) {
      console.error('Failed to save tensor:', error);
      setError('Failed to save tensor to localStorage');
    }
  };

  const deleteTensor = (name: string) => {
    try {
      const updatedTensors = savedTensors.filter(t => t.name !== name);
      setSavedTensors(updatedTensors);
      localStorage.setItem('elasticTensors', JSON.stringify(updatedTensors));
      addLog(`Deleted tensor: ${name}`, 'info');
    } catch (error) {
      console.error('Failed to delete tensor:', error);
    }
  };

  const loadTensor = (name: string, isReference: boolean = false) => {
    const tensor = savedTensors.find(t => t.name === name);
    if (tensor) {
      if (isReference) {
        setReferenceTensorInput(tensor.data);
        setReferenceTensorName(name);
      } else {
        setTensorInput(tensor.data);
        setTensorName(name);
      }
      addLog(`Loaded tensor: ${name}`, 'info');
    }
  };

  // Helper functions to get display names
  const getTestTensorName = () => tensorName.trim() || 'Test Tensor';
  const getReferenceTensorName = () => referenceTensorName.trim() || 'Reference Tensor';
  const getDifferenceName = () => {
    const testName = getTestTensorName();
    const refName = getReferenceTensorName();
    if (testName === 'Test Tensor' || refName === 'Reference Tensor') {
      return 'Difference (Test - Reference)';
    }
    return `Difference (${testName} - ${refName})`;
  };

  const generateDirectionalDataForBoth = () => {
    if (!worker || !isWorkerReady) return;

    // Generate for test tensor
    if (tensorData) {
      ['xy', 'xz', 'yz'].forEach(plane => {
        worker.postMessage({
          type: 'generateDirectionalData',
          data: {
            tensorData,
            property: selectedProperty,
            plane: plane,
            numPoints: 180,
            isReference: false
          }
        });
      });

      worker.postMessage({
        type: 'generate3DSurfaceData',
        data: {
          tensorData,
          property: selectedProperty,
          isReference: false
        }
      });
    }

    // Generate for reference tensor if in comparison mode
    if (comparisonMode && referenceTensorRef.current) {
      ['xy', 'xz', 'yz'].forEach(plane => {
        worker.postMessage({
          type: 'generateDirectionalData',
          data: {
            tensorData: referenceTensorRef.current,
            property: selectedProperty,
            plane: plane,
            numPoints: 180,
            isReference: true
          }
        });
      });

      worker.postMessage({
        type: 'generate3DSurfaceData',
        data: {
          tensorData: referenceTensorRef.current,
          property: selectedProperty,
          isReference: true
        }
      });
    }
  };

  const parseTensorInput = (input: string): number[][] => {
    const lines = input.trim().split('\n').filter(line => line.trim());
    if (lines.length !== 6) {
      throw new Error('Elastic tensor must have exactly 6 rows');
    }
    
    const matrix: number[][] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const values = lines[i].trim().split(/\s+/).map(parseFloat);
      
      if (values.some(isNaN)) {
        throw new Error('All values must be valid numbers');
      }
      
      matrix.push(values);
    }
    
    const isUpperTriangular = matrix.every((row, i) => row.length === 6 - i);
    const isFullMatrix = matrix.every(row => row.length === 6);
    
    if (!isUpperTriangular && !isFullMatrix) {
      throw new Error('Matrix must be either full 6x6 or upper triangular format');
    }
    
    if (isUpperTriangular) {
      const fullMatrix = Array(6).fill(0).map(() => Array(6).fill(0));
      
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < matrix[i].length; j++) {
          const value = matrix[i][j];
          const colIndex = i + j;
          fullMatrix[i][colIndex] = value;
          fullMatrix[colIndex][i] = value;
        }
      }
      
      return fullMatrix;
    }
    
    return matrix;
  };

  const analyzeTensor = () => {
    if (!isWorkerReady) {
      setError('Worker not ready. Please wait for initialization.');
      return;
    }

    try {
      setError('');
      setLogs([]);
      const matrix1 = parseTensorInput(tensorInput);
      setTensorData(matrix1);
      setIsCalculating(true);
      
      if (comparisonMode && referenceTensorInput.trim()) {
        // Parse reference tensor for comparison
        const referenceMatrix = parseTensorInput(referenceTensorInput);
        setReferenceTensorData(referenceMatrix);
        referenceTensorRef.current = referenceMatrix;
        
        // First analyze the test tensor
        worker?.postMessage({
          type: 'analyzeTensor',
          data: {
            tensorData: matrix1
          }
        });
        
        // Then analyze the reference tensor after a delay
        setTimeout(() => {
          setIsProcessingReference(true);
          processingRefRef.current = true;
          worker?.postMessage({
            type: 'analyzeTensor',
            data: {
              tensorData: referenceMatrix
            }
          });
        }, 100);
      } else {
        // Single tensor analysis
        setReferenceTensorData(null);
        setReferenceAnalysisResults(null);
        referenceTensorRef.current = null;
        
        worker?.postMessage({
          type: 'analyzeTensor',
          data: {
            tensorData: matrix1
          }
        });
      }
    } catch (err) {
      setError((err as Error).message);
      setTensorData(null);
      setAnalysisResults(null);
      setReferenceTensorData(null);
      setReferenceAnalysisResults(null);
    }
  };

  // Reset difference view when comparison mode changes
  useEffect(() => {
    setShowDifference(false); // Start with overlay mode when comparison mode is enabled
  }, [comparisonMode]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Don't close if clicking on the button or dropdown itself
      if (!target.closest('.loadDropdownContainer')) {
        setShowLoadDropdown(false);
        setShowReferenceLoadDropdown(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Update directional data when property changes
  useEffect(() => {
    if (tensorData && isWorkerReady) {
      // Clear existing data and regenerate for all planes
      setDirectionalData({});
      setReferenceDirectionalData({});
      setSurfaceData(null);
      setReferenceSurfaceData(null);
      
      // Generate for both tensors
      generateDirectionalDataForBoth();
    }
  }, [selectedProperty, tensorData, isWorkerReady, comparisonMode]);

  const loadExampleTensor = (example: string) => {
    if (example === 'silicon') {
      const data = `166  64  64   0   0   0
 64 166  64   0   0   0
 64  64 166   0   0   0
  0   0   0  80   0   0
  0   0   0   0  80   0
  0   0   0   0   0  80`;
      setTensorInput(data);
      setTensorName('Silicon');
    } else if (example === 'quartz') {
      const data = `48.137 11.411 12.783  0.000 -3.654  0.000
11.411 34.968 14.749  0.000 -0.094  0.000
12.783 14.749 26.015  0.000 -4.528  0.000
 0.000  0.000  0.000 14.545  0.000  0.006
-3.654 -0.094 -4.528  0.000 10.771  0.000
 0.000  0.000  0.000  0.006  0.000 11.947`;
      setTensorInput(data);
      setTensorName('Quartz');
    }
  };

  const loadExampleReferenceTensor = (example: string) => {
    if (example === 'silicon') {
      const data = `166  64  64   0   0   0
 64 166  64   0   0   0
 64  64 166   0   0   0
  0   0   0  80   0   0
  0   0   0   0  80   0
  0   0   0   0   0  80`;
      setReferenceTensorInput(data);
      setReferenceTensorName('Silicon');
    } else if (example === 'quartz') {
      const data = `48.137 11.411 12.783  0.000 -3.654  0.000
11.411 34.968 14.749  0.000 -0.094  0.000
12.783 14.749 26.015  0.000 -4.528  0.000
 0.000  0.000  0.000 14.545  0.000  0.006
-3.654 -0.094 -4.528  0.000 10.771  0.000
 0.000  0.000  0.000  0.006  0.000 11.947`;
      setReferenceTensorInput(data);
      setReferenceTensorName('Quartz');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.mainGrid}>
        {/* Left Column - Input */}
        <div className={styles.inputColumn}>
          <div className={styles.inputSection}>
            <div className={styles.header}>
              <h3>{comparisonMode ? 'Primary Tensor Input' : 'Elastic Tensor Input'}</h3>
              <div className={styles.workerStatus}>
                <span className={`${styles.statusIndicator} ${isWorkerReady ? styles.ready : styles.loading}`}>
                  {isWorkerReady ? '●' : '○'}
                </span>
                {isWorkerReady ? 'Ready' : 'Loading...'}
              </div>
            </div>
            
            <div className={styles.modeToggle}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={comparisonMode}
                  onChange={(e) => setComparisonMode(e.target.checked)}
                  className={styles.checkbox}
                />
                Comparison Mode
              </label>
            </div>
            
            <input
              type="text"
              value={tensorName}
              onChange={(e) => setTensorName(e.target.value)}
              placeholder="Tensor name (e.g., 'Silicon_modified')"
              className={styles.tensorNameInput}
            />
            
            <div className={styles.tensorActions}>
              <div style={{ position: 'relative', flex: 1 }} className="loadDropdownContainer">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowLoadDropdown(!showLoadDropdown);
                  }}
                  className={styles.loadButton}
                  style={{ width: '100%' }}
                >
                  Load Tensor ({savedTensors.length + 2}) ▼
                </button>
                {showLoadDropdown && (
                  <div className={styles.loadDropdown}>
                    {/* Example tensors section */}
                    <div style={{ borderBottom: '1px solid var(--ifm-color-emphasis-300)', paddingBottom: '0.25rem', marginBottom: '0.25rem' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--ifm-color-emphasis-600)', padding: '0.15rem 0.5rem', fontWeight: '600' }}>Example Tensors</div>
                      <div 
                        className={styles.loadDropdownItem}
                        onClick={() => {
                          loadExampleTensor('silicon');
                          setShowLoadDropdown(false);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className={styles.tensorInfo}>
                          <div>Silicon</div>
                          <div className={styles.tensorTimestamp}>Cubic crystal example</div>
                        </div>
                      </div>
                      <div 
                        className={styles.loadDropdownItem}
                        onClick={() => {
                          loadExampleTensor('quartz');
                          setShowLoadDropdown(false);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className={styles.tensorInfo}>
                          <div>Quartz</div>
                          <div className={styles.tensorTimestamp}>Trigonal crystal example</div>
                        </div>
                      </div>
                    </div>
                    {/* Saved tensors section */}
                    {savedTensors.length > 0 && (
                      <>
                        <div style={{ fontSize: '0.7rem', color: 'var(--ifm-color-emphasis-600)', padding: '0.15rem 0.5rem', fontWeight: '600' }}>Saved Tensors</div>
                        {savedTensors.map((tensor) => (
                          <div 
                            key={tensor.name} 
                            className={styles.loadDropdownItem}
                            onClick={() => {
                              loadTensor(tensor.name, false);
                              setShowLoadDropdown(false);
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className={styles.tensorInfo}>
                              <div>{tensor.name}</div>
                              <div className={styles.tensorTimestamp}>
                                {tensor.timestamp.toLocaleDateString()} {tensor.timestamp.toLocaleTimeString()}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteTensor(tensor.name);
                              }}
                              className={styles.deleteButton}
                              title="Delete tensor"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                              </svg>
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => saveTensor(tensorName, tensorInput)}
                disabled={!tensorName.trim() || !tensorInput.trim()}
                className={styles.saveButton}
                style={{ flex: 1 }}
              >
                Save Tensor
              </button>
            </div>
            
            <textarea
              value={tensorInput}
              onChange={(e) => setTensorInput(e.target.value)}
              placeholder="6x6 elastic stiffness matrix (GPa)..."
              rows={6}
              className={styles.tensorInput}
            />
            
            {comparisonMode && (
              <>
                <div className={styles.header} style={{ marginTop: '1rem' }}>
                  <h3>Comparison Tensor Input</h3>
                </div>
                
                <input
                  type="text"
                  value={referenceTensorName}
                  onChange={(e) => setReferenceTensorName(e.target.value)}
                  placeholder="Reference tensor name"
                  className={styles.tensorNameInput}
                />
                
                <div className={styles.tensorActions}>
                  <div style={{ position: 'relative', flex: 1 }} className="loadDropdownContainer">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowReferenceLoadDropdown(!showReferenceLoadDropdown);
                      }}
                      className={styles.loadButton}
                      style={{ width: '100%' }}
                    >
                      Load Tensor ({savedTensors.length + 2}) ▼
                    </button>
                    {showReferenceLoadDropdown && (
                      <div className={styles.loadDropdown}>
                        {/* Example tensors section */}
                        <div style={{ borderBottom: '1px solid var(--ifm-color-emphasis-300)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--ifm-color-emphasis-600)', padding: '0.25rem 0.5rem' }}>Example Tensors</div>
                          <div 
                            className={styles.loadDropdownItem}
                            onClick={() => {
                              loadExampleReferenceTensor('silicon');
                              setShowReferenceLoadDropdown(false);
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className={styles.tensorInfo}>
                              <div>Silicon</div>
                              <div className={styles.tensorTimestamp}>Cubic crystal example</div>
                            </div>
                          </div>
                          <div 
                            className={styles.loadDropdownItem}
                            onClick={() => {
                              loadExampleReferenceTensor('quartz');
                              setShowReferenceLoadDropdown(false);
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className={styles.tensorInfo}>
                              <div>Quartz</div>
                              <div className={styles.tensorTimestamp}>Trigonal crystal example</div>
                            </div>
                          </div>
                        </div>
                        {/* Saved tensors section */}
                        {savedTensors.length > 0 && (
                          <>
                            <div style={{ fontSize: '0.7rem', color: 'var(--ifm-color-emphasis-600)', padding: '0.15rem 0.5rem', fontWeight: '600' }}>Saved Tensors</div>
                            {savedTensors.map((tensor) => (
                              <div 
                                key={tensor.name} 
                                className={styles.loadDropdownItem}
                                onClick={() => {
                                  loadTensor(tensor.name, true);
                                  setShowReferenceLoadDropdown(false);
                                }}
                                style={{ cursor: 'pointer' }}
                              >
                                <div className={styles.tensorInfo}>
                                  <div>{tensor.name}</div>
                                  <div className={styles.tensorTimestamp}>
                                    {tensor.timestamp.toLocaleDateString()} {tensor.timestamp.toLocaleTimeString()}
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteTensor(tensor.name);
                                  }}
                                  className={styles.deleteButton}
                                  title="Delete tensor"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                              </svg>
                                </button>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => saveTensor(referenceTensorName, referenceTensorInput)}
                    disabled={!referenceTensorName.trim() || !referenceTensorInput.trim()}
                    className={styles.saveButton}
                    style={{ flex: 1 }}
                  >
                    Save Tensor
                  </button>
                </div>
                
                <textarea
                  value={referenceTensorInput}
                  onChange={(e) => setReferenceTensorInput(e.target.value)}
                  placeholder="6x6 reference elastic stiffness matrix for comparison (GPa)..."
                  rows={6}
                  className={styles.tensorInput}
                />
              </>
            )}
            
            <button 
              onClick={analyzeTensor} 
              disabled={!isWorkerReady || isCalculating}
              className={styles.analyzeButton}
            >
              {isCalculating ? 'Analyzing...' : 'Analyze'}
            </button>
            
            {error && <div className={styles.errorMessage}>{error}</div>}
            
            {logs.length > 0 && (
              <div className={styles.logOutput}>
                <div className={styles.logEntries}>
                  {logs.slice(-3).map((log, index) => (
                    <div key={index} className={`${styles.logEntry} ${styles[log.level]}`}>
                      <span className={styles.message}>{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Results */}
        <div className={styles.resultsColumn}>
          {analysisResults && (
            <>
              {/* Positive Definiteness Error */}
              {analysisResults.eigenvalues && !analysisResults.isPositiveDefinite && (
                <div className={styles.errorBanner} style={{
                  backgroundColor: '#f8d7da',
                  border: '1px solid #f5c6cb',
                  borderLeft: '4px solid #dc3545',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc3545" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  <div>
                    <strong style={{ color: '#721c24' }}>Error: Tensor Not Positive Definite</strong>
                    <div style={{ fontSize: '0.9em', color: '#721c24', marginTop: '4px' }}>
                      This elastic tensor has {analysisResults.eigenvalues.filter(val => val <= 0).length} non-positive eigenvalue(s), 
                      indicating this is not a stable minimum. The calculated properties and visualizations are not physically meaningful.
                    </div>
                  </div>
                </div>
              )}
              
              {/* Eigenvalue Error Warning */}
              {analysisResults.eigenvalueError && (
                <div className={styles.warningBanner} style={{
                  backgroundColor: '#f8d7da',
                  border: '1px solid #f5c6cb',
                  borderLeft: '4px solid #dc3545',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc3545" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  <div>
                    <strong style={{ color: '#721c24' }}>Error: Cannot Calculate Eigenvalues</strong>
                    <div style={{ fontSize: '0.9em', color: '#721c24', marginTop: '4px' }}>
                      {analysisResults.eigenvalueError}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Tables Section */}
              <div className={styles.tablesGrid}>
                <div className={styles.tableCell}>
                      <h3>
                        {comparisonMode && referenceAnalysisResults ? 'Comparison - Average Properties' : 'Average Properties'}
                        {comparisonMode && !referenceAnalysisResults && ' (Processing Reference...)'}
                        {comparisonMode && referenceAnalysisResults && ' ✓'}
                        {comparisonMode && referenceAnalysisResults && (
                          <span style={{ fontSize: '0.7em', marginLeft: '1rem', color: 'var(--ifm-color-emphasis-600)' }}>
                            Ref Data: {Object.keys(referenceDirectionalData).join(', ') || 'None'}
                          </span>
                        )}
                        <button 
                          onClick={() => copyTableToClipboard('averages', analysisResults)}
                          className={styles.copyButton}
                          title="Copy table to clipboard"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="m5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        </button>
                      </h3>
                      <table className={styles.propertiesTable}>
                        <thead>
                          <tr>
                            <th>Averaging scheme</th>
                            <th>Bulk modulus (GPa)</th>
                            <th>Young's modulus (GPa)</th>
                            <th>Shear modulus (GPa)</th>
                            <th>Poisson's ratio</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparisonMode && referenceAnalysisResults ? (
                            <>
                              <tr>
                                <td>Voigt</td>
                                <td>
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{analysisResults.properties.bulkModulus.voigt.toFixed(3)}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>
                                      ({referenceAnalysisResults.properties.bulkModulus.voigt.toFixed(3)})
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.bulkModulus.voigt - referenceAnalysisResults.properties.bulkModulus.voigt) }}>
                                    {getDifferenceSign(analysisResults.properties.bulkModulus.voigt - referenceAnalysisResults.properties.bulkModulus.voigt)}{Math.abs(analysisResults.properties.bulkModulus.voigt - referenceAnalysisResults.properties.bulkModulus.voigt).toFixed(3)}
                                  </div>
                                </td>
                                <td>
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{analysisResults.properties.youngsModulus.voigt.toFixed(3)}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>
                                      ({referenceAnalysisResults.properties.youngsModulus.voigt.toFixed(3)})
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.youngsModulus.voigt - referenceAnalysisResults.properties.youngsModulus.voigt) }}>
                                    ({getDifferenceSign(analysisResults.properties.youngsModulus.voigt - referenceAnalysisResults.properties.youngsModulus.voigt)}{Math.abs(analysisResults.properties.youngsModulus.voigt - referenceAnalysisResults.properties.youngsModulus.voigt).toFixed(3)})
                                  </div>
                                </td>
                                <td>
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{analysisResults.properties.shearModulus.voigt.toFixed(3)}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>
                                      ({referenceAnalysisResults.properties.shearModulus.voigt.toFixed(3)})
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.shearModulus.voigt - referenceAnalysisResults.properties.shearModulus.voigt) }}>
                                    ({getDifferenceSign(analysisResults.properties.shearModulus.voigt - referenceAnalysisResults.properties.shearModulus.voigt)}{Math.abs(analysisResults.properties.shearModulus.voigt - referenceAnalysisResults.properties.shearModulus.voigt).toFixed(3)})
                                  </div>
                                </td>
                                <td>
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{analysisResults.properties.poissonRatio.voigt.toFixed(5)}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>
                                      ({referenceAnalysisResults.properties.poissonRatio.voigt.toFixed(5)})
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.poissonRatio.voigt - referenceAnalysisResults.properties.poissonRatio.voigt) }}>
                                    ({getDifferenceSign(analysisResults.properties.poissonRatio.voigt - referenceAnalysisResults.properties.poissonRatio.voigt)}{Math.abs(analysisResults.properties.poissonRatio.voigt - referenceAnalysisResults.properties.poissonRatio.voigt).toFixed(5)})
                                  </div>
                                </td>
                              </tr>
                              <tr>
                                <td>Reuss</td>
                                <td>
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{analysisResults.properties.bulkModulus.reuss.toFixed(3)}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>
                                      ({referenceAnalysisResults.properties.bulkModulus.reuss.toFixed(3)})
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.bulkModulus.reuss - referenceAnalysisResults.properties.bulkModulus.reuss) }}>
                                    ({getDifferenceSign(analysisResults.properties.bulkModulus.reuss - referenceAnalysisResults.properties.bulkModulus.reuss)}{Math.abs(analysisResults.properties.bulkModulus.reuss - referenceAnalysisResults.properties.bulkModulus.reuss).toFixed(3)})
                                  </div>
                                </td>
                                <td>
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{analysisResults.properties.youngsModulus.reuss.toFixed(3)}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>
                                      ({referenceAnalysisResults.properties.youngsModulus.reuss.toFixed(3)})
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.youngsModulus.reuss - referenceAnalysisResults.properties.youngsModulus.reuss) }}>
                                    ({getDifferenceSign(analysisResults.properties.youngsModulus.reuss - referenceAnalysisResults.properties.youngsModulus.reuss)}{Math.abs(analysisResults.properties.youngsModulus.reuss - referenceAnalysisResults.properties.youngsModulus.reuss).toFixed(3)})
                                  </div>
                                </td>
                                <td>
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{analysisResults.properties.shearModulus.reuss.toFixed(3)}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>
                                      ({referenceAnalysisResults.properties.shearModulus.reuss.toFixed(3)})
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.shearModulus.reuss - referenceAnalysisResults.properties.shearModulus.reuss) }}>
                                    ({getDifferenceSign(analysisResults.properties.shearModulus.reuss - referenceAnalysisResults.properties.shearModulus.reuss)}{Math.abs(analysisResults.properties.shearModulus.reuss - referenceAnalysisResults.properties.shearModulus.reuss).toFixed(3)})
                                  </div>
                                </td>
                                <td>
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{analysisResults.properties.poissonRatio.reuss.toFixed(5)}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>
                                      ({referenceAnalysisResults.properties.poissonRatio.reuss.toFixed(5)})
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.poissonRatio.reuss - referenceAnalysisResults.properties.poissonRatio.reuss) }}>
                                    ({getDifferenceSign(analysisResults.properties.poissonRatio.reuss - referenceAnalysisResults.properties.poissonRatio.reuss)}{Math.abs(analysisResults.properties.poissonRatio.reuss - referenceAnalysisResults.properties.poissonRatio.reuss).toFixed(5)})
                                  </div>
                                </td>
                              </tr>
                              <tr>
                                <td>Hill</td>
                                <td>
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{analysisResults.properties.bulkModulus.hill.toFixed(3)}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>
                                      ({referenceAnalysisResults.properties.bulkModulus.hill.toFixed(3)})
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.bulkModulus.hill - referenceAnalysisResults.properties.bulkModulus.hill) }}>
                                    ({getDifferenceSign(analysisResults.properties.bulkModulus.hill - referenceAnalysisResults.properties.bulkModulus.hill)}{Math.abs(analysisResults.properties.bulkModulus.hill - referenceAnalysisResults.properties.bulkModulus.hill).toFixed(3)})
                                  </div>
                                </td>
                                <td>
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{analysisResults.properties.youngsModulus.hill.toFixed(3)}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>
                                      ({referenceAnalysisResults.properties.youngsModulus.hill.toFixed(3)})
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.youngsModulus.hill - referenceAnalysisResults.properties.youngsModulus.hill) }}>
                                    ({getDifferenceSign(analysisResults.properties.youngsModulus.hill - referenceAnalysisResults.properties.youngsModulus.hill)}{Math.abs(analysisResults.properties.youngsModulus.hill - referenceAnalysisResults.properties.youngsModulus.hill).toFixed(3)})
                                  </div>
                                </td>
                                <td>
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{analysisResults.properties.shearModulus.hill.toFixed(3)}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>
                                      ({referenceAnalysisResults.properties.shearModulus.hill.toFixed(3)})
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.shearModulus.hill - referenceAnalysisResults.properties.shearModulus.hill) }}>
                                    ({getDifferenceSign(analysisResults.properties.shearModulus.hill - referenceAnalysisResults.properties.shearModulus.hill)}{Math.abs(analysisResults.properties.shearModulus.hill - referenceAnalysisResults.properties.shearModulus.hill).toFixed(3)})
                                  </div>
                                </td>
                                <td>
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{analysisResults.properties.poissonRatio.hill.toFixed(5)}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>
                                      ({referenceAnalysisResults.properties.poissonRatio.hill.toFixed(5)})
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.poissonRatio.hill - referenceAnalysisResults.properties.poissonRatio.hill) }}>
                                    ({getDifferenceSign(analysisResults.properties.poissonRatio.hill - referenceAnalysisResults.properties.poissonRatio.hill)}{Math.abs(analysisResults.properties.poissonRatio.hill - referenceAnalysisResults.properties.poissonRatio.hill).toFixed(5)})
                                  </div>
                                </td>
                              </tr>
                            </>
                          ) : (
                            <>
                              <tr>
                                <td>Voigt</td>
                                <td><em>K</em><sub>V</sub> = {analysisResults.properties.bulkModulus.voigt.toFixed(3)}</td>
                                <td><em>E</em><sub>V</sub> = {analysisResults.properties.youngsModulus.voigt.toFixed(3)}</td>
                                <td><em>G</em><sub>V</sub> = {analysisResults.properties.shearModulus.voigt.toFixed(3)}</td>
                                <td><em>ν</em><sub>V</sub> = {analysisResults.properties.poissonRatio.voigt.toFixed(5)}</td>
                              </tr>
                              <tr>
                                <td>Reuss</td>
                                <td><em>K</em><sub>R</sub> = {analysisResults.properties.bulkModulus.reuss.toFixed(3)}</td>
                                <td><em>E</em><sub>R</sub> = {analysisResults.properties.youngsModulus.reuss.toFixed(3)}</td>
                                <td><em>G</em><sub>R</sub> = {analysisResults.properties.shearModulus.reuss.toFixed(3)}</td>
                                <td><em>ν</em><sub>R</sub> = {analysisResults.properties.poissonRatio.reuss.toFixed(5)}</td>
                              </tr>
                              <tr>
                                <td>Hill</td>
                                <td><em>K</em><sub>H</sub> = {analysisResults.properties.bulkModulus.hill.toFixed(3)}</td>
                                <td><em>E</em><sub>H</sub> = {analysisResults.properties.youngsModulus.hill.toFixed(3)}</td>
                                <td><em>G</em><sub>H</sub> = {analysisResults.properties.shearModulus.hill.toFixed(3)}</td>
                                <td><em>ν</em><sub>H</sub> = {analysisResults.properties.poissonRatio.hill.toFixed(5)}</td>
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className={`${styles.tableCell} ${styles.eigenvaluesCell}`}>
                      <h3>
                        Eigenvalues of the stiffness matrix
                        <button 
                          onClick={() => copyTableToClipboard('eigenvalues', analysisResults)}
                          className={styles.copyButton}
                          title="Copy table to clipboard"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="m5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        </button>
                      </h3>
                      <table className={styles.propertiesTable}>
                        <thead>
                          {comparisonMode && referenceAnalysisResults ? (
                            <tr>
                              <th></th>
                              <th>Values (GPa)</th>
                              <th>Difference</th>
                            </tr>
                          ) : (
                            <tr>
                              <th></th>
                              <th>Value (GPa)</th>
                            </tr>
                          )}
                        </thead>
                        <tbody>
                          {comparisonMode && referenceAnalysisResults ? (
                            analysisResults.eigenvalues.map((val, i) => (
                              <tr key={i}>
                                <td>λ<sub>{i+1}</sub></td>
                                <td>
                                  <span style={{ color: '#ff6600', fontWeight: 600 }}>{val.toFixed(3)}</span>
                                  {referenceAnalysisResults.eigenvalues[i] && (
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>
                                      ({referenceAnalysisResults.eigenvalues[i].toFixed(3)})
                                    </span>
                                  )}
                                </td>
                                <td style={{ color: referenceAnalysisResults.eigenvalues[i] ? getDifferenceColor(val - referenceAnalysisResults.eigenvalues[i]) : 'inherit' }}>
                                  {referenceAnalysisResults.eigenvalues[i] ? 
                                    `${getDifferenceSign(val - referenceAnalysisResults.eigenvalues[i])}${Math.abs(val - referenceAnalysisResults.eigenvalues[i]).toFixed(3)}` : 
                                    'N/A'
                                  }
                                </td>
                              </tr>
                            ))
                          ) : (
                            analysisResults.eigenvalues.map((val, i) => (
                              <tr key={i}>
                                <td>λ<sub>{i+1}</sub></td>
                                <td>{val.toFixed(3)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className={styles.tableCell}>
                      <h3>
                        Variations of the elastic moduli
                        <button 
                          onClick={() => copyTableToClipboard('variations', analysisResults)}
                          className={styles.copyButton}
                          title="Copy table to clipboard"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="m5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        </button>
                      </h3>
                      <table className={styles.propertiesTable}>
                        <thead>
                          <tr>
                            <th></th>
                            <th colSpan="2">Young's modulus (GPa)</th>
                            <th colSpan="2">Linear compressibility (TPa<sup>−1</sup>)</th>
                            <th colSpan="2">Shear modulus (GPa)</th>
                            <th colSpan="2">Poisson's ratio</th>
                          </tr>
                          <tr>
                            <th></th>
                            <th><em>E</em><sub>min</sub></th>
                            <th><em>E</em><sub>max</sub></th>
                            <th>β<sub>min</sub></th>
                            <th>β<sub>max</sub></th>
                            <th><em>G</em><sub>min</sub></th>
                            <th><em>G</em><sub>max</sub></th>
                            <th>ν<sub>min</sub></th>
                            <th>ν<sub>max</sub></th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparisonMode && referenceAnalysisResults ? (
                            <>
                              <tr>
                                <td>Value</td>
                                <td>
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{analysisResults.extrema.youngsModulus.min.toFixed(3)}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>({referenceAnalysisResults.extrema.youngsModulus.min.toFixed(3)})</span>
                                  </div>
                                  <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.youngsModulus.min - referenceAnalysisResults.extrema.youngsModulus.min) }}>
                                    {getDifferenceSign(analysisResults.extrema.youngsModulus.min - referenceAnalysisResults.extrema.youngsModulus.min)}{Math.abs(analysisResults.extrema.youngsModulus.min - referenceAnalysisResults.extrema.youngsModulus.min).toFixed(3)}
                                  </div>
                                </td>
                                <td>
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{analysisResults.extrema.youngsModulus.max.toFixed(3)}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>({referenceAnalysisResults.extrema.youngsModulus.max.toFixed(3)})</span>
                                  </div>
                                  <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.youngsModulus.max - referenceAnalysisResults.extrema.youngsModulus.max) }}>
                                    {getDifferenceSign(analysisResults.extrema.youngsModulus.max - referenceAnalysisResults.extrema.youngsModulus.max)}{Math.abs(analysisResults.extrema.youngsModulus.max - referenceAnalysisResults.extrema.youngsModulus.max).toFixed(3)}
                                  </div>
                                </td>
                                <td>
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{analysisResults.extrema.linearCompressibility.min.toFixed(3)}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>({referenceAnalysisResults.extrema.linearCompressibility.min.toFixed(3)})</span>
                                  </div>
                                  <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.linearCompressibility.min - referenceAnalysisResults.extrema.linearCompressibility.min) }}>
                                    {getDifferenceSign(analysisResults.extrema.linearCompressibility.min - referenceAnalysisResults.extrema.linearCompressibility.min)}{Math.abs(analysisResults.extrema.linearCompressibility.min - referenceAnalysisResults.extrema.linearCompressibility.min).toFixed(3)}
                                  </div>
                                </td>
                                <td>
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{analysisResults.extrema.linearCompressibility.max.toFixed(3)}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>({referenceAnalysisResults.extrema.linearCompressibility.max.toFixed(3)})</span>
                                  </div>
                                  <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.linearCompressibility.max - referenceAnalysisResults.extrema.linearCompressibility.max) }}>
                                    {getDifferenceSign(analysisResults.extrema.linearCompressibility.max - referenceAnalysisResults.extrema.linearCompressibility.max)}{Math.abs(analysisResults.extrema.linearCompressibility.max - referenceAnalysisResults.extrema.linearCompressibility.max).toFixed(3)}
                                  </div>
                                </td>
                                <td>
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{analysisResults.extrema.shearModulus.min.toFixed(3)}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>({referenceAnalysisResults.extrema.shearModulus.min.toFixed(3)})</span>
                                  </div>
                                  <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.shearModulus.min - referenceAnalysisResults.extrema.shearModulus.min) }}>
                                    {getDifferenceSign(analysisResults.extrema.shearModulus.min - referenceAnalysisResults.extrema.shearModulus.min)}{Math.abs(analysisResults.extrema.shearModulus.min - referenceAnalysisResults.extrema.shearModulus.min).toFixed(3)}
                                  </div>
                                </td>
                                <td>
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{analysisResults.extrema.shearModulus.max.toFixed(3)}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>({referenceAnalysisResults.extrema.shearModulus.max.toFixed(3)})</span>
                                  </div>
                                  <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.shearModulus.max - referenceAnalysisResults.extrema.shearModulus.max) }}>
                                    {getDifferenceSign(analysisResults.extrema.shearModulus.max - referenceAnalysisResults.extrema.shearModulus.max)}{Math.abs(analysisResults.extrema.shearModulus.max - referenceAnalysisResults.extrema.shearModulus.max).toFixed(3)}
                                  </div>
                                </td>
                                <td>
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{analysisResults.extrema.poissonRatio.min.toFixed(5)}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>({referenceAnalysisResults.extrema.poissonRatio.min.toFixed(5)})</span>
                                  </div>
                                  <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.poissonRatio.min - referenceAnalysisResults.extrema.poissonRatio.min) }}>
                                    {getDifferenceSign(analysisResults.extrema.poissonRatio.min - referenceAnalysisResults.extrema.poissonRatio.min)}{Math.abs(analysisResults.extrema.poissonRatio.min - referenceAnalysisResults.extrema.poissonRatio.min).toFixed(5)}
                                  </div>
                                </td>
                                <td>
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{analysisResults.extrema.poissonRatio.max.toFixed(5)}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>({referenceAnalysisResults.extrema.poissonRatio.max.toFixed(5)})</span>
                                  </div>
                                  <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.poissonRatio.max - referenceAnalysisResults.extrema.poissonRatio.max) }}>
                                    {getDifferenceSign(analysisResults.extrema.poissonRatio.max - referenceAnalysisResults.extrema.poissonRatio.max)}{Math.abs(analysisResults.extrema.poissonRatio.max - referenceAnalysisResults.extrema.poissonRatio.max).toFixed(5)}
                                  </div>
                                </td>
                              </tr>
                              <tr>
                                <td>Anisotropy</td>
                                <td colSpan="2">
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{analysisResults.extrema.youngsModulus.anisotropy.toFixed(2)}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>({referenceAnalysisResults.extrema.youngsModulus.anisotropy.toFixed(2)})</span>
                                  </div>
                                  <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.youngsModulus.anisotropy - referenceAnalysisResults.extrema.youngsModulus.anisotropy) }}>
                                    {getDifferenceSign(analysisResults.extrema.youngsModulus.anisotropy - referenceAnalysisResults.extrema.youngsModulus.anisotropy)}{Math.abs(analysisResults.extrema.youngsModulus.anisotropy - referenceAnalysisResults.extrema.youngsModulus.anisotropy).toFixed(2)}
                                  </div>
                                </td>
                                <td colSpan="2">
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{analysisResults.extrema.linearCompressibility.anisotropy.toFixed(4)}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>({referenceAnalysisResults.extrema.linearCompressibility.anisotropy.toFixed(4)})</span>
                                  </div>
                                  <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.linearCompressibility.anisotropy - referenceAnalysisResults.extrema.linearCompressibility.anisotropy) }}>
                                    {getDifferenceSign(analysisResults.extrema.linearCompressibility.anisotropy - referenceAnalysisResults.extrema.linearCompressibility.anisotropy)}{Math.abs(analysisResults.extrema.linearCompressibility.anisotropy - referenceAnalysisResults.extrema.linearCompressibility.anisotropy).toFixed(4)}
                                  </div>
                                </td>
                                <td colSpan="2">
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{analysisResults.extrema.shearModulus.anisotropy.toFixed(2)}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>({referenceAnalysisResults.extrema.shearModulus.anisotropy.toFixed(2)})</span>
                                  </div>
                                  <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.shearModulus.anisotropy - referenceAnalysisResults.extrema.shearModulus.anisotropy) }}>
                                    {getDifferenceSign(analysisResults.extrema.shearModulus.anisotropy - referenceAnalysisResults.extrema.shearModulus.anisotropy)}{Math.abs(analysisResults.extrema.shearModulus.anisotropy - referenceAnalysisResults.extrema.shearModulus.anisotropy).toFixed(2)}
                                  </div>
                                </td>
                                <td colSpan="2">
                                  <div>
                                    <span style={{ color: '#ff6600', fontWeight: 600 }}>{isFinite(analysisResults.extrema.poissonRatio.anisotropy) ? analysisResults.extrema.poissonRatio.anisotropy.toFixed(2) : '∞'}</span>
                                    <span style={{ color: '#0066cc', marginLeft: '0.25rem' }}>({isFinite(referenceAnalysisResults.extrema.poissonRatio.anisotropy) ? referenceAnalysisResults.extrema.poissonRatio.anisotropy.toFixed(2) : '∞'})</span>
                                  </div>
                                  {isFinite(analysisResults.extrema.poissonRatio.anisotropy) && isFinite(referenceAnalysisResults.extrema.poissonRatio.anisotropy) && (
                                    <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.poissonRatio.anisotropy - referenceAnalysisResults.extrema.poissonRatio.anisotropy) }}>
                                      {getDifferenceSign(analysisResults.extrema.poissonRatio.anisotropy - referenceAnalysisResults.extrema.poissonRatio.anisotropy)}{Math.abs(analysisResults.extrema.poissonRatio.anisotropy - referenceAnalysisResults.extrema.poissonRatio.anisotropy).toFixed(2)}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            </>
                          ) : (
                            <>
                              <tr>
                                <td>Value</td>
                                <td>{analysisResults.extrema.youngsModulus.min.toFixed(3)}</td>
                                <td>{analysisResults.extrema.youngsModulus.max.toFixed(3)}</td>
                                <td>{analysisResults.extrema.linearCompressibility.min.toFixed(3)}</td>
                                <td>{analysisResults.extrema.linearCompressibility.max.toFixed(3)}</td>
                                <td>{analysisResults.extrema.shearModulus.min.toFixed(3)}</td>
                                <td>{analysisResults.extrema.shearModulus.max.toFixed(3)}</td>
                                <td>{analysisResults.extrema.poissonRatio.min.toFixed(5)}</td>
                                <td>{analysisResults.extrema.poissonRatio.max.toFixed(5)}</td>
                              </tr>
                              <tr>
                                <td>Anisotropy</td>
                                <td colSpan="2">{analysisResults.extrema.youngsModulus.anisotropy.toFixed(2)}</td>
                                <td colSpan="2">{analysisResults.extrema.linearCompressibility.anisotropy.toFixed(4)}</td>
                                <td colSpan="2">{analysisResults.extrema.shearModulus.anisotropy.toFixed(2)}</td>
                                <td colSpan="2">{isFinite(analysisResults.extrema.poissonRatio.anisotropy) ? analysisResults.extrema.poissonRatio.anisotropy.toFixed(2) : '∞'}</td>
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>
                </div>

              {/* Charts Section */}
              <div className={styles.chartsSection}>
                <div className={styles.chartControls}>
                  <select 
                    value={selectedProperty} 
                    onChange={(e) => setSelectedProperty(e.target.value)}
                    className={styles.propertySelect}
                  >
                    <option value="youngs">Young's Modulus</option>
                    <option value="linear_compressibility">Linear Compressibility</option>
                    <option value="shear">Shear Modulus</option>
                    <option value="poisson">Poisson's Ratio</option>
                    <option value="matrix">Tensor Matrices</option>
                  </select>
                  
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={show3D}
                      onChange={(e) => setShow3D(e.target.checked)}
                      className={styles.checkbox}
                    />
                    Show 3D View
                  </label>
                  
                  
                  {show3D && (
                    <div className={styles.radioGroup}>
                      <label className={styles.radioLabel}>
                        <input
                          type="radio"
                          name="3dMode"
                          checked={use3DScatter}
                          onChange={() => setUse3DScatter(true)}
                          className={styles.radio}
                        />
                        Scatter
                      </label>
                      <label className={styles.radioLabel}>
                        <input
                          type="radio"
                          name="3dMode"
                          checked={!use3DScatter}
                          onChange={() => setUse3DScatter(false)}
                          className={styles.radio}
                        />
                        Surface
                      </label>
                    </div>
                  )}
                  
                  {comparisonMode && referenceDirectionalData && Object.keys(referenceDirectionalData).length > 0 && (
                    <div className={styles.radioGroup}>
                      <label className={styles.radioLabel}>
                        <input
                          type="radio"
                          name="comparisonView"
                          checked={!showDifference}
                          onChange={() => setShowDifference(false)}
                          className={styles.radio}
                        />
                        Overlay
                      </label>
                      <label className={styles.radioLabel}>
                        <input
                          type="radio"
                          name="comparisonView"
                          checked={showDifference}
                          onChange={() => setShowDifference(true)}
                          className={styles.radio}
                        />
                        Difference
                      </label>
                    </div>
                  )}
                </div>

                {selectedProperty === 'matrix' ? (
                  <>
                    {/* Matrix Heatmaps */}
                    <div className={styles.sectionTitle}>Stiffness & Compliance Matrices</div>
                    <div className={styles.surfaceChartContainer}>
                      {analysisResults && (
                        <DualMatrixChart 
                          stiffnessMatrix={analysisResults.stiffnessMatrix}
                          complianceMatrix={analysisResults.complianceMatrix}
                          referenceStiffness={comparisonMode && referenceAnalysisResults ? referenceAnalysisResults.stiffnessMatrix : undefined}
                          referenceCompliance={comparisonMode && referenceAnalysisResults ? referenceAnalysisResults.complianceMatrix : undefined}
                          comparisonMode={comparisonMode}
                          showDifference={showDifference}
                          testTensorName={getTestTensorName()}
                          referenceTensorName={getReferenceTensorName()}
                        />
                      )}
                    </div>
                  </>
                ) : show3D && selectedProperty !== 'matrix' ? (
                  <>
                    {analysisResults.isPositiveDefinite ? (
                      <>
                        {/* 3D Surface chart */}
                        <div className={styles.sectionTitle}>3D Property Surface</div>
                        <div className={styles.surfaceChartContainer}>
                          {surfaceData && (
                            <SurfaceChart 
                              data={surfaceData} 
                              property={selectedProperty} 
                              useScatter={use3DScatter}
                              referenceData={comparisonMode ? referenceSurfaceData : undefined}
                              comparisonMode={comparisonMode}
                              showDifference={showDifference}
                              testTensorName={getTestTensorName()}
                              referenceTensorName={getReferenceTensorName()}
                            />
                          )}
                        </div>
                      </>
                    ) : (
                      <div style={{
                        padding: '40px 20px',
                        textAlign: 'center',
                        color: 'var(--ifm-color-emphasis-600)',
                        fontStyle: 'italic'
                      }}>
                        3D visualization disabled: Tensor is not positive definite
                      </div>
                    )}
                  </>
                ) : selectedProperty !== 'matrix' ? (
                  <>
                    {/* Three polar charts for all planes */}
                    <div className={styles.sectionTitle}>Property Surface Plots</div>
                    <div className={styles.polarChartsGrid}>
                      {['xy', 'xz', 'yz'].map(plane => (
                        <div key={plane} className={styles.chartContainer}>
                          <div className={styles.chartLabel}>{plane.toUpperCase()} Plane</div>
                          {directionalData[plane] && (
                            <PolarChart 
                              data={directionalData[plane]} 
                              property={selectedProperty} 
                              plane={plane}
                              referenceData={comparisonMode ? referenceDirectionalData[plane] : undefined}
                              comparisonMode={comparisonMode}
                              testTensorName={getTestTensorName()}
                              referenceTensorName={getReferenceTensorName()}
                              showDifference={showDifference}
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Directional charts below */}
                    <div className={styles.sectionTitle}>Angular Variation</div>
                    <div className={styles.directionalChartsGrid}>
                      {['xy', 'xz', 'yz'].map(plane => (
                        <div key={plane} className={styles.chartContainer}>
                          <div className={styles.chartLabel}>{plane.toUpperCase()} Plane</div>
                          {directionalData[plane] && (
                            <DirectionalChart 
                              data={directionalData[plane]} 
                              property={selectedProperty}
                              referenceData={comparisonMode ? referenceDirectionalData[plane] : undefined}
                              comparisonMode={comparisonMode}
                              showDifference={showDifference}
                              testTensorName={getTestTensorName()}
                              referenceTensorName={getReferenceTensorName()}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};