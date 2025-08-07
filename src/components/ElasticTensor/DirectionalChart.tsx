import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { DirectionalData, getPropertyTitle, getPropertyUnit, calculateDirectionalDifferences, getComputedTensorColors } from './CommonFunctions';

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
    if (!chartRef.current || data.length === 0) return;

    const chart = echarts.init(chartRef.current);
    const colors = getComputedTensorColors();

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
          lineStyle: { width: 3, color: colors.differenceColor },
          areaStyle: { color: colors.differenceColor, opacity: 0.4 },
          itemStyle: { color: colors.differenceColor },
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
              lineStyle: { width: 2, color: colors.testColor },
              areaStyle: { color: colors.testColor, opacity: 0.2 },
              itemStyle: { color: colors.testColor },
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
              lineStyle: { width: 2, color: colors.referenceColor, type: 'dashed' },
              areaStyle: { color: colors.referenceColor, opacity: 0.1 },
              itemStyle: { color: colors.referenceColor },
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
              lineStyle: { width: 2, color: colors.testColor },
              areaStyle: { color: colors.testColor, opacity: 0.2 },
              itemStyle: { color: colors.testColor },
              symbol: 'none',
              animation: false
            },
            {
              name: referenceTensorName,
              type: 'line',
              data: referenceData.map(d => [d.angle, d.value]),
              smooth: true,
              lineStyle: { width: 2, color: colors.referenceColor, type: 'dashed' },
              areaStyle: { color: colors.referenceColor, opacity: 0.1 },
              itemStyle: { color: colors.referenceColor },
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
        lineStyle: { width: 2, color: colors.testColor },
        areaStyle: { color: colors.testColor, opacity: 0.3 },
        itemStyle: { color: colors.testColor },
        symbol: 'none',
        animation: false
      });

      series.push({
        name: 'Minimum',
        type: 'line',
        data: data.map(d => [d.angle, d.valueMin || 0]),
        smooth: true,
        lineStyle: { width: 2, color: colors.referenceColor },
        areaStyle: { color: colors.referenceColor, opacity: 0.3 },
        itemStyle: { color: colors.referenceColor },
        symbol: 'none',
        animation: false
      });
    } else {
      series.push({
        name: 'Value',
        type: 'line',
        data: data.map(d => [d.angle, d.value]),
        smooth: true,
        lineStyle: { width: 2, color: colors.referenceColor },
        areaStyle: { color: colors.referenceColor, opacity: 0.3 },
        itemStyle: { color: colors.referenceColor },
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
            backgroundColor: '#ffffff',
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
              return [{ name: `Difference (${testTensorName} - ${referenceTensorName})`, itemStyle: { color: colors.differenceColor } }];
            } else if (hasMinMax) {
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
          } else if (hasMinMax) {
            return [
              { name: 'Maximum', itemStyle: { color: colors.testColor } },
              { name: 'Minimum', itemStyle: { color: colors.referenceColor } }
            ];
          } else {
            return [{ name: 'Value', itemStyle: { color: colors.referenceColor } }];
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

export { DirectionalChart };
export default DirectionalChart;
