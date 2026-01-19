import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import type { EnergyLevel, HuckelParams } from './physics';
import { calculateDOSSmoothed } from './physics';
import type { ControlTheme } from '../shared/controls';

export interface DOSPlotProps {
    width: number;
    height: number;
    energyLevels: EnergyLevel[];
    params: HuckelParams;
    energyRange: { min: number; max: number };
    showSmoothed: boolean;
    sigma: number;
    theme: ControlTheme;
}

export const DOSPlot: React.FC<DOSPlotProps> = ({
    width,
    height,
    energyLevels,
    params,
    energyRange,
    showSmoothed,
    sigma,
    theme,
}) => {
    const chartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chartRef.current) return;

        const chart = echarts.init(chartRef.current);

        // Calculate smoothed DOS data
        const dosSmoothed = showSmoothed
            ? calculateDOSSmoothed(energyLevels, 100, sigma, energyRange)
            : [];

        // Get max density for scaling
        const maxSmoothedDensity = showSmoothed
            ? Math.max(...dosSmoothed.map((d) => d.density), 1)
            : 1;
        const maxDensity = maxSmoothedDensity * 1.15;

        const isDark = theme.text.startsWith('#e') || theme.text.startsWith('#f');

        // Create series
        const series: echarts.SeriesOption[] = [];

        // Discrete energy level ticks (horizontal lines at each energy)
        // Using markLine on a dummy scatter series
        const tickLength = maxDensity * 0.25; // Length of tick marks
        series.push({
            name: 'Energy levels',
            type: 'scatter',
            data: energyLevels.map((level) => [tickLength / 2, level.energy]),
            symbol: 'rect',
            symbolSize: [tickLength * 8, 2], // Wide horizontal rectangles
            itemStyle: {
                color: isDark ? 'rgba(100, 150, 255, 0.8)' : 'rgba(59, 130, 246, 0.7)',
            },
            animation: false,
        });

        // Smoothed DOS curve
        if (showSmoothed && dosSmoothed.length > 0) {
            series.push({
                name: 'DOS (broadened)',
                type: 'line',
                data: dosSmoothed.map((d) => [d.density, d.energy]),
                smooth: true,
                lineStyle: {
                    width: 2.5,
                    color: isDark ? '#ff7b7b' : '#dc2626',
                },
                areaStyle: {
                    color: isDark ? 'rgba(255, 123, 123, 0.15)' : 'rgba(220, 38, 38, 0.1)',
                },
                itemStyle: {
                    color: isDark ? '#ff7b7b' : '#dc2626',
                },
                symbol: 'none',
                animation: false,
            });
        }

        const option: echarts.EChartsOption = {
            animation: false,
            grid: {
                left: 10,
                right: 10,
                top: 30,
                bottom: 40,
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross',
                },
                formatter: (params: any) => {
                    if (!params || params.length === 0) return '';
                    const energy = params[0].data[1];
                    let result = `E = ${energy.toFixed(2)} eV<br/>`;
                    params.forEach((param: any) => {
                        result += `${param.seriesName}: ${param.data[0].toFixed(2)}<br/>`;
                    });
                    return result;
                },
            },
            xAxis: {
                type: 'value',
                name: 'DOS',
                nameLocation: 'middle',
                nameGap: 25,
                min: 0,
                max: maxDensity,
                axisLabel: {
                    color: theme.textMuted,
                    fontSize: 10,
                    formatter: (value: number) => value.toFixed(1),
                },
                axisLine: {
                    lineStyle: {
                        color: theme.textMuted,
                    },
                },
                splitLine: {
                    show: true,
                    lineStyle: {
                        color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    },
                },
                nameTextStyle: {
                    color: theme.text,
                    fontSize: 11,
                },
            },
            yAxis: {
                type: 'value',
                name: 'Energy (eV)',
                nameLocation: 'middle',
                nameGap: 0,
                nameRotate: 90,
                min: energyRange.min,
                max: energyRange.max,
                axisLabel: {
                    show: false, // Hide labels since EnergyLevels shows them
                },
                axisLine: {
                    lineStyle: {
                        color: theme.textMuted,
                    },
                },
                splitLine: {
                    show: true,
                    lineStyle: {
                        color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    },
                },
                nameTextStyle: {
                    color: theme.text,
                    fontSize: 11,
                },
            },
            series,
        };

        chart.setOption(option);

        const handleResize = () => chart.resize();
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.dispose();
        };
    }, [width, height, energyLevels, params, energyRange, showSmoothed, sigma, theme]);

    const isDark = theme.text.startsWith('#e') || theme.text.startsWith('#f');

    return (
        <div
            ref={chartRef}
            style={{
                width,
                height,
                borderRadius: '4px',
                border: `1px solid ${theme.border}`,
                backgroundColor: theme.surface || theme.inputBg,
            }}
        />
    );
};

export default DOSPlot;
