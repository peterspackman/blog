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
  eigenvalues: number[];
  extrema: {
    shearModulus: { min: number; max: number; anisotropy: number };
    youngsModulus: { min: number; max: number; anisotropy: number };
    poissonRatio: { min: number; max: number; anisotropy: number };
    linearCompressibility: { min: number; max: number; anisotropy: number };
  };
}

interface SurfaceData {
  surfaceData: number[][];
  minValue: number;
  maxValue: number;
  property: string;
  numU: number;
  numV: number;
}

const DirectionalChart: React.FC<{
  data: DirectionalData[];
  property: string;
}> = ({ data, property }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;
    
    const chart = echarts.init(chartRef.current);
    
    const hasMinMax = property === 'shear' || property === 'poisson';
    const series = [];
    
    // Get value range for color mapping
    const values = data.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    
    if (hasMinMax) {
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
        text: `${getPropertyTitle(property)} vs Angle`,
        left: 'center',
        textStyle: { 
          fontSize: 14,
          color: 'var(--ifm-color-emphasis-800)'
        }
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
        show: hasMinMax,
        top: 30
      },
      xAxis: {
        type: 'value',
        name: 'Angle (degrees)',
        min: 0,
        max: 360,
        axisLabel: { formatter: '{value}°' },
      },
      yAxis: {
        type: 'value',
        name: `${getPropertyTitle(property)} (${getPropertyUnit(property)})`,
        scale: true,
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
  }, [data, property]);
  
  return <div ref={chartRef} style={{ width: '100%', height: '100%', aspectRatio: '1/1' }} />;
};

const PolarChart: React.FC<{
  data: DirectionalData[];
  property: string;
  plane: string;
}> = ({ data, property, plane }) => {
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
    
    // Find the range for proper scaling
    const allValues = polarCoords.flat();
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
        text: `${getPropertyTitle(property)} Surface (${plane.toUpperCase()} plane)`,
        left: 'center',
        textStyle: { 
          fontSize: 14,
          color: 'var(--ifm-color-emphasis-800)'
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
      xAxis: {
        type: 'value',
        name: axisLabels.x,
        nameLocation: 'center',
        nameGap: 25,
        min: -maxVal * 1.1,
        max: maxVal * 1.1,
        axisLabel: {
          fontSize: 10,
          formatter: (value: number) => value.toFixed(0)
        }
      },
      yAxis: {
        type: 'value',
        name: axisLabels.y,
        nameLocation: 'center',
        nameGap: 25,
        min: -maxVal * 1.1,
        max: maxVal * 1.1,
        axisLabel: {
          fontSize: 10,
          formatter: (value: number) => value.toFixed(0)
        }
      },
      series: (() => {
        const hasMinMax = property === 'shear' || property === 'poisson';
        
        if (hasMinMax) {
          // For shear and Poisson, show both min and max curves
          const maxCoords = data.map(d => {
            if (d.x !== undefined && d.y !== undefined) {
              return [d.x, d.y];
            }
            const angleRad = d.angleRad;
            const radius = d.value; // This is the max value
            let x, y;
            if (plane === 'xy') {
              x = radius * Math.cos(angleRad);
              y = radius * Math.sin(angleRad);
            } else if (plane === 'xz') {
              x = radius * Math.cos(angleRad);
              y = radius * Math.sin(angleRad);
            } else {
              x = radius * Math.cos(angleRad);
              y = radius * Math.sin(angleRad);
            }
            return [x, y];
          });
          
          const minCoords = data.map(d => {
            const angleRad = d.angleRad;
            const radius = d.valueMin || 0; // Use minimum value
            let x, y;
            if (plane === 'xy') {
              x = radius * Math.cos(angleRad);
              y = radius * Math.sin(angleRad);
            } else if (plane === 'xz') {
              x = radius * Math.cos(angleRad);
              y = radius * Math.sin(angleRad);
            } else {
              x = radius * Math.cos(angleRad);
              y = radius * Math.sin(angleRad);
            }
            return [x, y];
          });
          
          return [
            {
              name: 'Maximum',
              type: 'line',
              data: maxCoords,
              smooth: false,
              lineStyle: { 
                width: 2,
                color: '#ff6600'
              },
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
              lineStyle: { 
                width: 2,
                color: '#0066cc'
              },
              areaStyle: { opacity: 0.3, color: '#0066cc' },
              symbol: 'none',
              animation: false,
              connectNulls: true
            }
          ];
        } else {
          // For other properties, show single curve
          return [{
            type: 'line',
            data: polarCoords,
            smooth: false,
            lineStyle: { 
              width: 2,
              color: '#0066cc'
            },
            areaStyle: { opacity: 0.3, color: '#0066cc' },
            symbol: 'none',
            animation: false,
            connectNulls: true
          }];
        }
      })(),
      legend: {
        show: property === 'shear' || property === 'poisson',
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
  }, [data, property, plane]);
  
  return <div ref={chartRef} style={{ width: '100%', height: '100%', aspectRatio: '1/1' }} />;
};

const SurfaceChart: React.FC<{
  data: SurfaceData | null;
  property: string;
  useScatter?: boolean;
}> = ({ data, property, useScatter = true }) => {
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
        text: `${getPropertyTitle(property)} 3D Surface`,
        left: 'center',
        textStyle: { 
          fontSize: 14,
          color: 'var(--ifm-color-emphasis-800)'
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const value = params.value[2];
          return `${getPropertyTitle(property)}: ${value.toFixed(3)} ${getPropertyUnit(property)}`;
        }
      },
      visualMap: {
        show: true,
        dimension: 3, // Use the 4th dimension (property value) for color
        min: colorMin,
        max: colorMax,
        calculable: true,
        realtime: false,
        inRange: {
          color: [
            '#0066cc',  // Blue (low values)
            '#ff6600'   // Orange (high values)
          ]
        },
        formatter: function (value) {
          return value.toFixed(2) + ' ' + getPropertyUnit(property);
        },
        textStyle: {
          color: 'var(--ifm-color-emphasis-800)'
        }
      },
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
      series: [
        useScatter ? {
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
            opacity: 0.9
          }
        } : {
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
        }
      ]
    };
    
    chart.setOption(option);
    
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [data, property, useScatter]);
  
  return <div ref={chartRef} style={{ width: '100%', height: '100%', minHeight: '400px' }} />;
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
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string>('');
  const [logs, setLogs] = useState<Array<{ message: string; level: string; timestamp: Date }>>([]);

  // Initialize worker on mount
  useEffect(() => {
    initializeWorker();
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
        setIsCalculating(false);
        if (data.success) {
          setAnalysisResults(data.data);
          // Generate directional data for all planes
          if (worker && tensorData) {
            ['xy', 'xz', 'yz'].forEach(plane => {
              worker.postMessage({
                type: 'generateDirectionalData',
                data: {
                  tensorData,
                  property: selectedProperty,
                  plane: plane,
                  numPoints: 180
                }
              });
            });
            
            // Generate 3D surface data
            worker.postMessage({
              type: 'generate3DSurfaceData',
              data: {
                tensorData,
                property: selectedProperty
              }
            });
          }
        } else {
          setError('Analysis failed: ' + data.error);
        }
        break;

      case 'directionalDataResult':
        if (data.success) {
          setDirectionalData(prev => ({
            ...prev,
            [data.plane]: data.data
          }));
        } else {
          setError('Directional data generation failed: ' + data.error);
        }
        break;
        
      case '3DSurfaceResult':
        if (data.success) {
          setSurfaceData(data.data);
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
      const matrix = parseTensorInput(tensorInput);
      setTensorData(matrix);
      setIsCalculating(true);
      
      // Send to worker for analysis
      worker?.postMessage({
        type: 'analyzeTensor',
        data: {
          tensorData: matrix
        }
      });
    } catch (err) {
      setError((err as Error).message);
      setTensorData(null);
      setAnalysisResults(null);
    }
  };

  // Update directional data when property changes
  useEffect(() => {
    if (worker && tensorData && isWorkerReady) {
      // Clear existing data and regenerate for all planes
      setDirectionalData({});
      setSurfaceData(null);
      
      ['xy', 'xz', 'yz'].forEach(plane => {
        worker.postMessage({
          type: 'generateDirectionalData',
          data: {
            tensorData,
            property: selectedProperty,
            plane: plane,
            numPoints: 180
          }
        });
      });
      
      // Generate 3D surface data
      worker.postMessage({
        type: 'generate3DSurfaceData',
        data: {
          tensorData,
          property: selectedProperty
        }
      });
    }
  }, [selectedProperty, tensorData, worker, isWorkerReady]);

  const loadExampleTensor = (example: string) => {
    if (example === 'silicon') {
      setTensorInput(`166  64  64   0   0   0
 64 166  64   0   0   0
 64  64 166   0   0   0
  0   0   0  80   0   0
  0   0   0   0  80   0
  0   0   0   0   0  80`);
    } else if (example === 'quartz') {
      setTensorInput(`48.137 11.411 12.783  0.000 -3.654  0.000
11.411 34.968 14.749  0.000 -0.094  0.000
12.783 14.749 26.015  0.000 -4.528  0.000
 0.000  0.000  0.000 14.545  0.000  0.006
-3.654 -0.094 -4.528  0.000 10.771  0.000
 0.000  0.000  0.000  0.006  0.000 11.947`);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.mainGrid}>
        {/* Left Column - Input */}
        <div className={styles.inputColumn}>
          <div className={styles.inputSection}>
            <div className={styles.header}>
              <h3>Input Matrix</h3>
              <div className={styles.workerStatus}>
                <span className={`${styles.statusIndicator} ${isWorkerReady ? styles.ready : styles.loading}`}>
                  {isWorkerReady ? '●' : '○'}
                </span>
                {isWorkerReady ? 'Ready' : 'Loading...'}
              </div>
            </div>
            
            <div className={styles.exampleButtons}>
              <button onClick={() => loadExampleTensor('silicon')} className={styles.exampleButton}>
                Silicon
              </button>
              <button onClick={() => loadExampleTensor('quartz')} className={styles.exampleButton}>
                Quartz
              </button>
            </div>
            
            <textarea
              value={tensorInput}
              onChange={(e) => setTensorInput(e.target.value)}
              placeholder="6x6 elastic stiffness matrix (GPa)..."
              rows={6}
              className={styles.tensorInput}
            />
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
              {/* Tables Section */}
              <div className={styles.tablesGrid}>
                <div className={styles.tableCell}>
                      <h3>
                        Average Properties
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
                          <tr>
                            <th></th>
                            <th>Value (GPa)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysisResults.eigenvalues.map((val, i) => (
                            <tr key={i}>
                              <td>λ<sub>{i+1}</sub></td>
                              <td>{val.toFixed(3)}</td>
                            </tr>
                          ))}
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
                </div>

                {show3D ? (
                  <>
                    {/* 3D Surface chart */}
                    <div className={styles.sectionTitle}>3D Property Surface</div>
                    <div className={styles.surfaceChartContainer}>
                      {surfaceData && (
                        <SurfaceChart data={surfaceData} property={selectedProperty} useScatter={use3DScatter} />
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Three polar charts for all planes */}
                    <div className={styles.sectionTitle}>Property Surface Plots</div>
                    <div className={styles.polarChartsGrid}>
                      {['xy', 'xz', 'yz'].map(plane => (
                        <div key={plane} className={styles.chartContainer}>
                          <div className={styles.chartLabel}>{plane.toUpperCase()} Plane</div>
                          {directionalData[plane] && (
                            <PolarChart data={directionalData[plane]} property={selectedProperty} plane={plane} />
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
                            <DirectionalChart data={directionalData[plane]} property={selectedProperty} />
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};