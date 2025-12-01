import React, { useRef, useEffect, useState } from 'react';
import { AnalyticsEngine } from './Analytics';

interface AnalyticsPlotProps {
    analytics: AnalyticsEngine | null;
    particleData: any;
    width?: number;
    isDark?: boolean;
    typeLabels?: string[];
    typeColors?: string[];
}

const AnalyticsPlot: React.FC<AnalyticsPlotProps> = ({
    analytics,
    particleData,
    width: containerWidth,
    isDark = false,
    typeLabels = ['Type 0', 'Type 1'],
    typeColors = ['rgba(255, 165, 0, 0.8)', 'rgba(0, 0, 255, 0.8)']
}) => {
    // Convert rgba to solid colors for plot lines
    const getPlotColor = (rgba: string): string => {
        // Extract RGB values and return as solid color
        const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
            return `rgb(${match[1]}, ${match[2]}, ${match[3]})`;
        }
        return rgba;
    };

    const color0 = getPlotColor(typeColors[0]); // Type 0 (e.g., orange)
    const color1 = getPlotColor(typeColors[1]); // Type 1 (e.g., blue)
    const plotCanvasRef = useRef<HTMLCanvasElement>(null);
    const [selectedMetric, setSelectedMetric] = useState<string>('temperature');
    const [useLogScale, setUseLogScale] = useState<boolean>(false);

    // Track which series are visible (for combined views)
    const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({
        // g(r) series
        '0-0': true,
        '0-1': true,
        '1-1': true,
        'total': true,
        // Energy series
        'kinetic': true,
        'potential': true,
        'totalEnergy': true,
    });

    const toggleSeries = (key: string) => {
        setVisibleSeries(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Store legend hit areas for click detection
    const energyLegendAreas = useRef<Array<{ key: string; x: number; y: number; width: number; height: number }>>([]);
    const grLegendAreas = useRef<Array<{ key: string; x: number; y: number; width: number; height: number }>>([]);

    // Theme colors
    const theme = {
        background: isDark ? '#1a1a1a' : '#ffffff',
        surface: isDark ? '#2d2d2d' : '#f8f9fa',
        border: isDark ? '#444' : '#e9ecef',
        text: isDark ? '#e0e0e0' : '#374151',
        textMuted: isDark ? '#888' : '#6b7280',
        axis: isDark ? '#666' : '#666666',
        grid: isDark ? '#333' : '#e5e7eb',
        // Data colors
        lineBlue: '#3b82f6',
        lineOrange: '#f97316',
        lineBlack: isDark ? '#e0e0e0' : '#1f2937',
        lineRed: '#dc2626',
    };

    // Render analytics plot
    const renderAnalyticsPlot = () => {
        const canvas = plotCanvasRef.current;
        if (!canvas || !analytics) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set up high-DPI rendering for crisp text
        const devicePixelRatio = window.devicePixelRatio || 1;
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;

        if (displayWidth === 0 || displayHeight === 0) return;

        // Set the internal size to device pixel ratio
        canvas.width = displayWidth * devicePixelRatio;
        canvas.height = displayHeight * devicePixelRatio;

        // Scale the context to match device pixel ratio
        ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

        const width = displayWidth;
        const height = displayHeight;
        const padding = { top: 45, right: 20, bottom: 35, left: 50 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;

        // Clear canvas
        ctx.fillStyle = theme.background;
        ctx.fillRect(0, 0, width, height);

        // Check if this is a combined view
        const isCombinedRDF = selectedMetric === 'gr_combined';
        const isCombinedEnergy = selectedMetric === 'energy_combined';
        const isRDF = selectedMetric.startsWith('gr_');

        if (isCombinedEnergy) {
            // Draw all three energy curves on the same axes
            const totalE = analytics.getCollectiveVariable('totalEnergy');
            const kineticE = analytics.getCollectiveVariable('kineticEnergy');
            const potentialE = analytics.getCollectiveVariable('potentialEnergy');

            if (!totalE || totalE.values.length < 2) return;

            const numPoints = 1000;
            const totalValues = totalE.values.slice(-numPoints);
            const kineticValues = kineticE?.values.slice(-numPoints) || [];
            const potentialValues = potentialE?.values.slice(-numPoints) || [];

            // Find global min/max for y-axis scaling
            const allValues = [...totalValues, ...kineticValues, ...potentialValues];
            let minValue = Math.min(...allValues);
            let maxValue = Math.max(...allValues);
            const valueRange = maxValue - minValue || 1;

            // Draw axes
            ctx.strokeStyle = theme.axis;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padding.left, padding.top);
            ctx.lineTo(padding.left, height - padding.bottom);
            ctx.lineTo(width - padding.right, height - padding.bottom);
            ctx.stroke();

            // Draw horizontal grid lines
            ctx.strokeStyle = theme.grid;
            ctx.lineWidth = 0.5;
            const numYTicks = 4;
            for (let i = 0; i <= numYTicks; i++) {
                const y = padding.top + (i / numYTicks) * plotHeight;
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(width - padding.right, y);
                ctx.stroke();
            }

            // Y-axis ticks
            ctx.font = '10px Arial';
            ctx.textAlign = 'right';
            ctx.fillStyle = theme.textMuted;
            for (let i = 0; i <= numYTicks; i++) {
                const value = maxValue - (i / numYTicks) * valueRange;
                const y = padding.top + (i / numYTicks) * plotHeight;
                ctx.fillText(value.toFixed(1), padding.left - 5, y + 3);
            }

            // Energy curves
            const energyCurves = [
                { key: 'kinetic', values: kineticValues, color: '#ef4444', label: 'Kinetic' },      // Red
                { key: 'potential', values: potentialValues, color: '#3b82f6', label: 'Potential' },  // Blue
                { key: 'totalEnergy', values: totalValues, color: isDark ? '#e0e0e0' : '#1f2937', label: 'Total' }, // Black
            ];

            energyCurves.forEach(({ key, values, color, label }) => {
                if (!values || values.length === 0 || !visibleSeries[key]) return;

                ctx.strokeStyle = color;
                ctx.lineWidth = label === 'Total' ? 2.5 : 1.5;
                ctx.beginPath();
                for (let i = 0; i < values.length; i++) {
                    const x = padding.left + (i / (values.length - 1)) * plotWidth;
                    const y = height - padding.bottom - ((values[i] - minValue) / valueRange) * plotHeight;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            });

            // Store legend hit areas for click detection
            const legendX = width - padding.right - 70;
            const legendY = padding.top + 5;
            ctx.font = '10px Arial';
            energyLegendAreas.current = energyCurves.map(({ key, color, label }, i) => {
                const y = legendY + i * 14;
                const isVisible = visibleSeries[key];

                // Draw line (dimmed if not visible)
                ctx.strokeStyle = isVisible ? color : (isDark ? '#555' : '#ccc');
                ctx.lineWidth = label === 'Total' ? 2.5 : 1.5;
                ctx.beginPath();
                ctx.moveTo(legendX, y);
                ctx.lineTo(legendX + 14, y);
                ctx.stroke();

                // Draw label (dimmed if not visible)
                ctx.fillStyle = isVisible ? theme.text : theme.textMuted;
                ctx.textAlign = 'left';
                ctx.fillText(label, legendX + 18, y + 3);

                return { key, x: legendX, y: y - 7, width: 60, height: 14 };
            });

            // Title
            ctx.font = '13px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = theme.text;
            ctx.fillText('Energy', width / 2, 20);

            // X-axis label
            ctx.font = '11px Arial';
            ctx.fillStyle = theme.textMuted;
            ctx.fillText('Time Steps', width / 2, height - 5);

        } else if (isCombinedRDF) {
            // Draw all three g(r) curves on the same axes
            const rdf = analytics.getRadialDistributionFunction();
            if (!rdf.r || rdf.r.length === 0) return;

            const times = rdf.r;
            const maxR = rdf.maxRadius;

            // Find global max for y-axis scaling
            const allValues = [
                ...(rdf.gr_partial['0-0'] || []),
                ...(rdf.gr_partial['0-1'] || []),
                ...(rdf.gr_partial['1-1'] || []),
                ...(rdf.gr || []),
            ];
            let maxValue = Math.max(...allValues, 1);
            let minValue = 0;
            const valueRange = maxValue - minValue || 1;

            // Draw axes
            ctx.strokeStyle = theme.axis;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padding.left, padding.top);
            ctx.lineTo(padding.left, height - padding.bottom);
            ctx.lineTo(width - padding.right, height - padding.bottom);
            ctx.stroke();

            // Draw horizontal grid lines
            ctx.strokeStyle = theme.grid;
            ctx.lineWidth = 0.5;
            const numYTicks = 4;
            for (let i = 0; i <= numYTicks; i++) {
                const y = padding.top + (i / numYTicks) * plotHeight;
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(width - padding.right, y);
                ctx.stroke();
            }

            // X-axis ticks
            ctx.strokeStyle = theme.axis;
            ctx.lineWidth = 1;
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = theme.textMuted;

            const tickSpacing = maxR <= 5 ? 1 : Math.ceil(maxR / 5);
            for (let r = 0; r <= maxR; r += tickSpacing) {
                const x = padding.left + (r / maxR) * plotWidth;
                ctx.beginPath();
                ctx.moveTo(x, height - padding.bottom);
                ctx.lineTo(x, height - padding.bottom + 4);
                ctx.stroke();
                ctx.fillText(r.toFixed(0), x, height - padding.bottom + 15);
            }

            // Y-axis ticks
            ctx.textAlign = 'right';
            for (let i = 0; i <= numYTicks; i++) {
                const value = maxValue - (i / numYTicks) * valueRange;
                const y = padding.top + (i / numYTicks) * plotHeight;
                ctx.fillText(value.toFixed(1), padding.left - 8, y + 3);
            }

            // Draw each g(r) curve using actual particle colors
            // Mix colors for cross-term (0-1)
            const mixedColor = isDark ? '#a855f7' : '#8b5cf6'; // Purple for mixed
            const totalColor = isDark ? '#e0e0e0' : '#1f2937'; // Black/white for total
            // Use particle type labels for legend
            const label0 = typeLabels[0] || 'Type 0';
            const label1 = typeLabels[1] || 'Type 1';
            const curves = [
                { key: '0-0', color: color0, label: `${label0}-${label0}` },
                { key: '0-1', color: mixedColor, label: `${label0}-${label1}` },
                { key: '1-1', color: color1, label: `${label1}-${label1}` },
                { key: 'total', color: totalColor, label: 'Total', data: rdf.gr },
            ];

            curves.forEach((curve) => {
                if (!visibleSeries[curve.key]) return;
                const values = curve.data || rdf.gr_partial[curve.key];
                if (!values || values.length === 0) return;

                ctx.strokeStyle = curve.color;
                ctx.lineWidth = curve.key === 'total' ? 2.5 : 1.5;
                ctx.beginPath();
                for (let i = 0; i < values.length; i++) {
                    const x = padding.left + (times[i] / maxR) * plotWidth;
                    const y = height - padding.bottom - ((values[i] - minValue) / valueRange) * plotHeight;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            });

            // Draw legend with hit areas for click detection
            const legendX = width - padding.right - 70;
            const legendY = padding.top + 5;
            ctx.font = '10px Arial';
            grLegendAreas.current = curves.map(({ key, color, label }, i) => {
                const y = legendY + i * 14;
                const isVisible = visibleSeries[key];

                // Draw line (dimmed if not visible)
                ctx.strokeStyle = isVisible ? color : (isDark ? '#555' : '#ccc');
                ctx.lineWidth = label === 'Total' ? 2.5 : 1.5;
                ctx.beginPath();
                ctx.moveTo(legendX, y);
                ctx.lineTo(legendX + 14, y);
                ctx.stroke();

                // Draw label (dimmed if not visible)
                ctx.fillStyle = isVisible ? theme.text : theme.textMuted;
                ctx.textAlign = 'left';
                ctx.fillText(label, legendX + 18, y + 3);

                return { key, x: legendX, y: y - 7, width: 60, height: 14 };
            });

            // Title
            ctx.font = '13px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = theme.text;
            ctx.fillText('Radial Distribution Functions g(r)', width / 2, 20);

            // X-axis label
            ctx.font = '11px Arial';
            ctx.fillStyle = theme.textMuted;
            ctx.fillText('Distance r (Å)', width / 2, height - 5);

        } else if (isRDF) {
            // Single g(r) plot
            const rdf = analytics.getRadialDistributionFunction();
            let values: number[];
            let times: number[];

            if (selectedMetric === 'gr_total') {
                values = rdf.gr;
                times = rdf.r;
            } else {
                const pairKey = selectedMetric.replace('gr_', '');
                values = rdf.gr_partial[pairKey] || [];
                times = rdf.r;
            }

            if (values.length === 0) return;

            const maxR = rdf.maxRadius;
            let minValue = 0;
            let maxValue = Math.max(...values, 1);
            const valueRange = maxValue - minValue || 1;

            // Draw axes
            ctx.strokeStyle = theme.axis;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padding.left, padding.top);
            ctx.lineTo(padding.left, height - padding.bottom);
            ctx.lineTo(width - padding.right, height - padding.bottom);
            ctx.stroke();

            // X-axis ticks
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = theme.textMuted;

            const tickSpacing = maxR <= 5 ? 1 : Math.ceil(maxR / 5);
            for (let r = 0; r <= maxR; r += tickSpacing) {
                const x = padding.left + (r / maxR) * plotWidth;
                ctx.beginPath();
                ctx.moveTo(x, height - padding.bottom);
                ctx.lineTo(x, height - padding.bottom + 4);
                ctx.stroke();
                ctx.fillText(r.toFixed(0), x, height - padding.bottom + 15);
            }

            // Draw data line
            ctx.strokeStyle = theme.lineBlue;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < values.length; i++) {
                const x = padding.left + (times[i] / maxR) * plotWidth;
                const y = height - padding.bottom - ((values[i] - minValue) / valueRange) * plotHeight;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // Title
            const typeMap: Record<string, string> = {
                'gr_total': 'Total',
                'gr_0-0': 'Orange-Orange',
                'gr_0-1': 'Orange-Blue',
                'gr_1-1': 'Blue-Blue'
            };
            ctx.font = '13px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = theme.text;
            ctx.fillText(`g(r) - ${typeMap[selectedMetric] || 'Total'}`, width / 2, 20);

            // X-axis label
            ctx.font = '11px Arial';
            ctx.fillStyle = theme.textMuted;
            ctx.fillText('Distance r (Å)', width / 2, height - 5);

        } else {
            // Time series plot
            const cv = analytics.getCollectiveVariable(selectedMetric);
            if (!cv || cv.values.length < 2) return;

            let values = cv.values.slice(-1000);
            const times = cv.times.slice(-1000);

            // Calculate moving average
            const windowSize = Math.min(10, values.length);
            const movingAvg: number[] = [];
            for (let i = 0; i < values.length; i++) {
                const start = Math.max(0, i - windowSize + 1);
                const window = values.slice(start, i + 1);
                const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
                movingAvg.push(avg);
            }

            let minValue = Math.min(...values);
            let maxValue = Math.max(...values);

            // Apply log scale if enabled
            if (useLogScale && minValue > 0) {
                values = values.map(v => Math.log10(Math.max(v, 0.001)));
                minValue = Math.min(...values);
                maxValue = Math.max(...values);
            }

            const valueRange = maxValue - minValue || 1;

            // Draw axes
            ctx.strokeStyle = theme.axis;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padding.left, padding.top);
            ctx.lineTo(padding.left, height - padding.bottom);
            ctx.lineTo(width - padding.right, height - padding.bottom);
            ctx.stroke();

            // Draw horizontal grid lines
            ctx.strokeStyle = theme.grid;
            ctx.lineWidth = 0.5;
            for (let i = 0; i <= 4; i++) {
                const y = padding.top + (i / 4) * plotHeight;
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(width - padding.right, y);
                ctx.stroke();
            }

            // Y-axis labels
            ctx.font = '10px Arial';
            ctx.textAlign = 'right';
            ctx.fillStyle = theme.textMuted;
            ctx.fillText(maxValue.toFixed(2), padding.left - 5, padding.top + 3);
            ctx.fillText(minValue.toFixed(2), padding.left - 5, height - padding.bottom + 3);

            // Draw data line
            ctx.strokeStyle = theme.lineBlue;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let i = 0; i < values.length; i++) {
                const x = padding.left + (i / (values.length - 1)) * plotWidth;
                const y = height - padding.bottom - ((values[i] - minValue) / valueRange) * plotHeight;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // Draw moving average
            if (!useLogScale) {
                ctx.strokeStyle = theme.lineRed;
                ctx.lineWidth = 2;
                ctx.beginPath();
                for (let i = 0; i < movingAvg.length; i++) {
                    const x = padding.left + (i / (movingAvg.length - 1)) * plotWidth;
                    const y = height - padding.bottom - ((movingAvg[i] - minValue) / valueRange) * plotHeight;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }

            // Title
            const title = useLogScale ? `log₁₀(${cv.name}) (${cv.unit})` : `${cv.name} (${cv.unit})`;
            ctx.font = '13px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = theme.text;
            ctx.fillText(title, width / 2, 20);

            // X-axis label
            ctx.font = '11px Arial';
            ctx.fillStyle = theme.textMuted;
            ctx.fillText('Time Steps', width / 2, height - 5);
        }
    };

    // Handle canvas clicks for legend interaction
    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = plotCanvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check which legend areas to use based on current metric
        const legendAreas = selectedMetric === 'energy_combined'
            ? energyLegendAreas.current
            : selectedMetric === 'gr_combined'
                ? grLegendAreas.current
                : [];

        for (const area of legendAreas) {
            if (x >= area.x && x <= area.x + area.width &&
                y >= area.y && y <= area.y + area.height) {
                toggleSeries(area.key);
                return;
            }
        }
    };

    // Update plot periodically
    useEffect(() => {
        const interval = setInterval(renderAnalyticsPlot, 100);
        return () => clearInterval(interval);
    }, [analytics, selectedMetric, useLogScale, isDark, containerWidth, color0, color1, visibleSeries]);

    const selectStyle = {
        padding: '0.25rem 0.5rem',
        border: `1px solid ${theme.border}`,
        borderRadius: '4px',
        backgroundColor: isDark ? '#3d3d3d' : 'rgba(255,255,255,0.95)',
        color: theme.text,
        fontSize: '0.75rem',
        cursor: 'pointer',
    };

    const badgeStyle = {
        padding: '0.25rem 0.5rem',
        backgroundColor: isDark ? 'rgba(45,45,45,0.95)' : 'rgba(255,255,255,0.95)',
        borderRadius: '4px',
        border: `1px solid ${theme.border}`,
        fontSize: '0.75rem',
        color: theme.text,
    };

    return (
        <div style={{
            position: 'relative',
            backgroundColor: theme.surface,
            padding: '0.75rem',
            borderRadius: '8px',
            border: `1px solid ${theme.border}`,
            height: '280px',
            width: containerWidth ? `${containerWidth}px` : '100%',
            maxWidth: containerWidth ? `${containerWidth}px` : '100%',
            boxSizing: 'border-box',
        }}>
            {/* Overlay controls at the top */}
            <div style={{
                position: 'absolute',
                top: '0.75rem',
                left: '0.75rem',
                right: '0.75rem',
                zIndex: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '0.5rem',
                pointerEvents: 'none',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', pointerEvents: 'auto' }}>
                    <select
                        value={selectedMetric}
                        onChange={(e) => setSelectedMetric(e.target.value)}
                        style={selectStyle}
                    >
                        <option value="temperature">Temperature</option>
                        <option value="pressure">Pressure</option>
                        <option value="energy_combined">Energy</option>
                        <option value="gr_combined">g(r)</option>
                    </select>
                    {!selectedMetric.startsWith('gr_') && (
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.75rem',
                            color: theme.text,
                        }}>
                            <input
                                type="checkbox"
                                checked={useLogScale}
                                onChange={(e) => setUseLogScale(e.target.checked)}
                            />
                            Log
                        </label>
                    )}
                </div>

                {/* Metrics overlay */}
                <div style={{ display: 'flex', gap: '0.4rem', pointerEvents: 'auto' }}>
                    <div style={badgeStyle}>
                        <span style={{ color: theme.textMuted }}>N: </span>
                        <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>
                            {particleData ? particleData.count : 0}
                        </span>
                    </div>
                    <div style={badgeStyle}>
                        <span style={{ color: theme.textMuted }}>T: </span>
                        <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>
                            {analytics?.getLatestSnapshot()?.temperature?.toFixed(2) || '0.00'}
                        </span>
                    </div>
                    <div style={badgeStyle}>
                        <span style={{ color: theme.textMuted }}>E: </span>
                        <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>
                            {analytics?.getLatestSnapshot()?.totalEnergy?.toFixed(1) || '0.0'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Full-size canvas */}
            <canvas
                ref={plotCanvasRef}
                onClick={handleCanvasClick}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    borderRadius: '8px',
                    cursor: (selectedMetric === 'energy_combined' || selectedMetric === 'gr_combined') ? 'pointer' : 'default',
                }}
            />
        </div>
    );
};

export default AnalyticsPlot;
