import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { TENSOR_COLORS, getTensorColor, getMatrixTextColor, getComputedTensorColors } from './CommonFunctions';

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
    
    // Get computed CSS values for colors
    const colors = getComputedTensorColors();
    
    // Calculate font sizes based on container dimensions
    const containerRect = chartRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width || 400;
    const containerHeight = containerRect.height || 400;
    const minDimension = Math.min(containerWidth, containerHeight);
    
    // Base font sizes that scale with container size
    const baseFontSize = Math.max(10, Math.min(20, minDimension / 25));
    const labelFontSize = baseFontSize;
    const axisLabelFontSize = Math.max(10, baseFontSize * 0.8);
    const richTextFontSize = Math.max(8, baseFontSize * 0.7);
    const richTextSmallFontSize = Math.max(7, baseFontSize * 0.6);

    // Prepare data for heatmap
    const heatmapData = [];
    const overlayData = [];
    const flatData = [];

    if (comparisonMode && referenceData && showDifference) {
      // Difference mode
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
          const diffValue = data[i][j] - referenceData[i][j];
          const testValue = data[i][j];
          const refValue = referenceData[i][j];
          
          // Only show non-zero elements (considering small floating point errors)
          if (Math.abs(diffValue) > 1e-10 || Math.abs(testValue) > 1e-10 || Math.abs(refValue) > 1e-10) {
            heatmapData.push([j, 5 - i, diffValue, testValue, refValue]); // Use raw difference for coloring
            flatData.push(diffValue);
          }
        }
      }
    } else if (comparisonMode && referenceData) {
      // Overlay mode (show both test and reference in split cells) - no normalization needed
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
          const testValue = data[i][j];
          const refValue = referenceData[i][j];
          
          // Only show non-zero elements
          if (Math.abs(testValue) > 1e-10 || Math.abs(refValue) > 1e-10) {
            heatmapData.push([j, 5 - i, testValue, refValue]); // Store both values
            flatData.push(testValue);
            flatData.push(refValue);
          }
        }
      }
    } else {
      // Single tensor mode
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
          const value = data[i][j];
          // Only show non-zero elements
          if (Math.abs(value) > 1e-10) {
            heatmapData.push([j, 5 - i, value]);
            flatData.push(value);
          }
        }
      }
    }

    const minValue = Math.min(...flatData);
    const maxValue = Math.max(...flatData);
    const isDifference = comparisonMode && referenceData && showDifference;
    
    // For difference mode, use symmetric scale around zero
    const maxAbsValue = isDifference ? Math.max(Math.abs(minValue), Math.abs(maxValue)) : 0;
    
    // Debug: Log the computed colors for difference mode
    if (isDifference && process.env.NODE_ENV === 'development') {
      console.log('Difference mode colors:', {
        negative: colors.diffNegativeColor,
        zero: colors.diffZeroColor,
        positive: colors.diffPositiveColor,
        minValue,
        maxValue,
        maxAbsValue,
        sampleData: heatmapData.slice(0, 3) // Show first 3 data points
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
            backgroundColor: '#ffffff',
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
            const diffValue = params.data[2];   // Difference value
            const testValue = params.data[3];   // Test value
            const refValue = params.data[4];    // Reference value  
            const diffPercent = refValue !== 0 ? ((testValue - refValue) / Math.abs(refValue) * 100) : 0;
            return `${element}<br/>` +
                   `${testTensorName}: ${testValue.toFixed(3)} GPa<br/>` +
                   `${referenceTensorName}: ${refValue.toFixed(3)} GPa<br/>` +
                   `Difference: ${diffValue >= 0 ? '+' : ''}${diffValue.toFixed(3)} GPa<br/>` +
                   `Change: ${diffPercent >= 0 ? '+' : ''}${diffPercent.toFixed(1)}%`;
          } else if (comparisonMode && referenceData) {
            const testValue = params.data[2];  // Test value
            const refValue = params.data[3];   // Reference value
            const diffValue = testValue - refValue;
            const diffPercent = refValue !== 0 ? ((testValue - refValue) / Math.abs(refValue) * 100) : 0;
            return `${element}<br/>` +
                   `${testTensorName}: ${testValue.toFixed(3)} GPa<br/>` +
                   `${referenceTensorName}: ${refValue.toFixed(3)} GPa<br/>` +
                   `Difference: ${diffValue >= 0 ? '+' : ''}${diffValue.toFixed(3)} GPa<br/>` +
                   `Change: ${diffPercent >= 0 ? '+' : ''}${diffPercent.toFixed(1)}%`;
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
          fontSize: axisLabelFontSize,
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
          fontSize: axisLabelFontSize,
          color: 'var(--ifm-color-emphasis-800)'
        },
        splitLine: { show: false }
      },
      visualMap: {
        min: isDifference ? -maxAbsValue : minValue,
        max: isDifference ? maxAbsValue : maxValue,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '5%',
        splitNumber: isDifference ? 4 : 3,
        inRange: isDifference ? {
          color: [
            colors.diffNegativeColor,    // negative -> blue
            colors.diffPositiveColor     // positive -> red
          ]
        } : {
          color: comparisonMode && referenceData && !showDifference ? [
            colors.singleLowColor,
            colors.singleMidColor,
            colors.singleHighColor
          ] : [
            colors.singleLowColor,
            colors.singleMidColor,
            colors.singleHighColor
          ]
        },
        text: isDifference ? [`${referenceTensorName} Higher`, `${testTensorName} Higher`] : ['Low', 'High'],
        textStyle: {
          color: 'var(--ifm-color-emphasis-800)',
          fontSize: Math.max(8, axisLabelFontSize * 0.8)
        }
      },
      series: [{
        name: 'Tensor Values',
        type: 'heatmap',
        data: heatmapData,
        label: {
          show: true,
          formatter: (params: any) => {
            const dataPoint = params.data;
            
            if (isDifference) {
              const diffValue = dataPoint[2]; // Difference value
              const sign = diffValue >= 0 ? '+' : '';
              return Math.abs(diffValue) >= 100 ? `${sign}${diffValue.toFixed(0)}` : `${sign}${diffValue.toFixed(2)}`;
            } else if (comparisonMode && referenceData && dataPoint.length >= 4) {
              // Overlay mode - show both values in split format
              const testValue = dataPoint[2];  // Test value
              const refValue = dataPoint[3];   // Reference value
              const testStr = Math.abs(testValue) >= 100 ? testValue.toFixed(0) : testValue.toFixed(2);
              const refStr = Math.abs(refValue) >= 100 ? refValue.toFixed(0) : refValue.toFixed(2);
              return `{test|${testStr}}\n{ref|${refStr}}`;
            } else {
              const value = dataPoint[2];
              return Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(2);
            }
          },
          color: isDifference ? '#000000' : TENSOR_COLORS.TEXT.DIFFERENCE_LIGHT,
          fontSize: isDifference ? labelFontSize * 0.85 : comparisonMode && referenceData && !showDifference ? richTextFontSize : labelFontSize,
          lineHeight: comparisonMode && referenceData && !showDifference ? richTextFontSize * 1.2 : labelFontSize * 1.1,
          rich: comparisonMode && referenceData && !showDifference ? {
            test: {
              color: colors.testColor,
              fontWeight: 'bold',
              fontSize: richTextFontSize
            },
            ref: {
              color: colors.referenceColor,
              fontWeight: 'normal',
              fontSize: richTextSmallFontSize
            }
          } : undefined
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

    const handleResize = () => {
      chart.resize();
    };
    
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [data, referenceData, comparisonMode, showDifference, testTensorName, referenceTensorName]);

  return <div ref={chartRef} style={{ width: '100%', height: '100%', minHeight: '350px', aspectRatio: '1/1' }} />;
};

export { TensorMatrixChart };
export default TensorMatrixChart;
