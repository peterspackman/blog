import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import type { Reflection } from './physics';
import { formatHKL } from './physics';
import type { ControlTheme } from '../shared/controls';

export interface PowderPatternProps {
    width: number;
    height: number;
    reflections: Reflection[];
    wavelength: number;
    peakWidth: number; // Gaussian broadening (degrees)
    showLabels: boolean;
    twoThetaRange: [number, number];
    selectedReflection: [number, number, number] | null;
    onSelectReflection?: (hkl: [number, number, number] | null) => void;
    theme: ControlTheme;
}

/**
 * Generate a Gaussian-broadened powder pattern
 */
function generateBroadenedPattern(
    reflections: Reflection[],
    peakWidth: number,
    twoThetaRange: [number, number],
    numPoints: number = 500
): [number, number][] {
    const [min, max] = twoThetaRange;
    const step = (max - min) / numPoints;
    const points: [number, number][] = [];

    for (let i = 0; i <= numPoints; i++) {
        const twoTheta = min + i * step;
        let intensity = 0;

        // Sum Gaussian contributions from each reflection
        for (const r of reflections) {
            if (r.twoTheta >= min && r.twoTheta <= max) {
                const delta = twoTheta - r.twoTheta;
                const sigma = peakWidth / 2.355; // FWHM to sigma
                intensity += r.intensity * Math.exp(-(delta * delta) / (2 * sigma * sigma));
            }
        }

        points.push([twoTheta, intensity]);
    }

    return points;
}

export const PowderPattern: React.FC<PowderPatternProps> = ({
    width,
    height,
    reflections,
    wavelength,
    peakWidth,
    showLabels,
    twoThetaRange,
    selectedReflection,
    onSelectReflection,
    theme,
}) => {
    const chartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chartRef.current) return;

        const chart = echarts.init(chartRef.current);

        const isDark = theme.text.startsWith('#e') || theme.text.startsWith('#f');

        // Generate broadened pattern
        const patternData = generateBroadenedPattern(
            reflections,
            peakWidth,
            twoThetaRange
        );

        // Get max intensity for scaling
        const maxIntensity = Math.max(
            ...reflections.map((r) => r.intensity),
            ...patternData.map((p) => p[1]),
            1
        );

        // Create series
        const series: echarts.SeriesOption[] = [];

        // Main pattern curve
        series.push({
            name: 'Pattern',
            type: 'line',
            data: patternData,
            smooth: false,
            lineStyle: {
                width: 1.5,
                color: isDark ? '#6b9eff' : '#2563eb',
            },
            areaStyle: {
                color: isDark ? 'rgba(107, 158, 255, 0.2)' : 'rgba(37, 99, 235, 0.15)',
            },
            symbol: 'none',
            animation: false,
        });

        // Peak markers (vertical lines at reflection positions)
        const peakMarkers = reflections
            .filter((r) => r.twoTheta >= twoThetaRange[0] && r.twoTheta <= twoThetaRange[1])
            .map((r) => ({
                xAxis: r.twoTheta,
                lineStyle: {
                    color: selectedReflection &&
                        r.h === selectedReflection[0] &&
                        r.k === selectedReflection[1] &&
                        r.l === selectedReflection[2]
                        ? (isDark ? '#fbbf24' : '#d97706')
                        : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'),
                    width: selectedReflection &&
                        r.h === selectedReflection[0] &&
                        r.k === selectedReflection[1] &&
                        r.l === selectedReflection[2]
                        ? 2
                        : 1,
                    type: 'solid' as const,
                },
                label: {
                    show: showLabels && r.intensity > 5, // Only label significant peaks
                    formatter: formatHKL(r.h, r.k, r.l),
                    position: 'end' as const,
                    color: theme.textMuted,
                    fontSize: 9,
                    rotate: 90,
                    offset: [0, -5],
                },
            }));

        // Add dummy series for markLine
        series.push({
            name: 'Peaks',
            type: 'line',
            data: [],
            markLine: {
                silent: false,
                symbol: 'none',
                data: peakMarkers,
                animation: false,
            },
        });

        // Scatter points for clickable peaks
        const peakPoints = reflections
            .filter((r) => r.twoTheta >= twoThetaRange[0] && r.twoTheta <= twoThetaRange[1])
            .map((r) => ({
                value: [r.twoTheta, r.intensity],
                itemStyle: {
                    color: selectedReflection &&
                        r.h === selectedReflection[0] &&
                        r.k === selectedReflection[1] &&
                        r.l === selectedReflection[2]
                        ? (isDark ? '#fbbf24' : '#d97706')
                        : (isDark ? '#6b9eff' : '#2563eb'),
                },
                data: { h: r.h, k: r.k, l: r.l },
            }));

        series.push({
            name: 'Peak positions',
            type: 'scatter',
            data: peakPoints,
            symbolSize: 8,
            animation: false,
        });

        const option: echarts.EChartsOption = {
            animation: false,
            grid: {
                left: 50,
                right: 20,
                top: 30,
                bottom: 45,
            },
            title: {
                text: `Powder Pattern (λ = ${wavelength.toFixed(4)} Å)`,
                left: 'center',
                top: 5,
                textStyle: {
                    color: theme.text,
                    fontSize: 12,
                    fontWeight: 'bold',
                },
            },
            tooltip: {
                trigger: 'item',
                formatter: (params: any) => {
                    if (params.componentType === 'markLine') {
                        return '';
                    }
                    if (params.seriesName === 'Peak positions') {
                        const twoTheta = params.value[0];
                        const intensity = params.value[1];
                        // Find matching reflection
                        const r = reflections.find(
                            (ref) => Math.abs(ref.twoTheta - twoTheta) < 0.01
                        );
                        if (r) {
                            return `
                                <strong>${formatHKL(r.h, r.k, r.l)}</strong><br/>
                                2θ = ${r.twoTheta.toFixed(2)}°<br/>
                                d = ${r.dSpacing.toFixed(3)} Å<br/>
                                I = ${r.intensity.toFixed(1)}
                            `;
                        }
                    }
                    return `2θ = ${params.value[0].toFixed(2)}°<br/>I = ${params.value[1].toFixed(1)}`;
                },
            },
            xAxis: {
                type: 'value',
                name: '2θ (degrees)',
                nameLocation: 'middle',
                nameGap: 30,
                min: twoThetaRange[0],
                max: twoThetaRange[1],
                axisLabel: {
                    color: theme.textMuted,
                    fontSize: 10,
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
                name: 'Intensity',
                nameLocation: 'middle',
                nameGap: 35,
                min: 0,
                max: maxIntensity * 1.1,
                axisLabel: {
                    color: theme.textMuted,
                    fontSize: 10,
                    formatter: (value: number) => value.toFixed(0),
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

        // Handle click events
        chart.on('click', (params: any) => {
            if (params.seriesName === 'Peak positions' && onSelectReflection) {
                const twoTheta = params.value[0];
                const r = reflections.find(
                    (ref) => Math.abs(ref.twoTheta - twoTheta) < 0.01
                );
                if (r) {
                    onSelectReflection([r.h, r.k, r.l]);
                }
            }
        });

        const handleResize = () => chart.resize();
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.off('click');
            chart.dispose();
        };
    }, [
        width,
        height,
        reflections,
        wavelength,
        peakWidth,
        showLabels,
        twoThetaRange,
        selectedReflection,
        onSelectReflection,
        theme,
    ]);

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

export default PowderPattern;
