import React, { useRef, useEffect, useState } from 'react';
import { AnalyticsEngine } from './Analytics';

interface AnalyticsPlotProps {
    analytics: AnalyticsEngine | null;
    particleData: any;
}

const AnalyticsPlot: React.FC<AnalyticsPlotProps> = ({ analytics, particleData }) => {
    const plotCanvasRef = useRef<HTMLCanvasElement>(null);
    const [selectedMetric, setSelectedMetric] = useState<string>('temperature');
    const [useLogScale, setUseLogScale] = useState<boolean>(false);

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
        
        // Set the internal size to device pixel ratio
        canvas.width = displayWidth * devicePixelRatio;
        canvas.height = displayHeight * devicePixelRatio;
        
        // Scale the context to match device pixel ratio
        ctx.scale(devicePixelRatio, devicePixelRatio);
        
        // Set display size back to original
        canvas.style.width = displayWidth + 'px';
        canvas.style.height = displayHeight + 'px';

        const width = displayWidth;
        const height = displayHeight;
        const padding = 40;
        const plotWidth = width - 2 * padding;
        const plotHeight = height - 2 * padding;

        // Clear canvas with white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Get data - handle both time series and g(r) data
        let values: number[];
        let times: number[];
        let isRDF = false;
        
        if (selectedMetric.startsWith('gr_')) {
            // Handle g(r) data
            isRDF = true;
            const rdf = analytics.getRadialDistributionFunction();
            
            if (selectedMetric === 'gr_total') {
                values = rdf.gr;
                times = rdf.r;
            } else {
                // Partial g(r) - extract type pair (e.g., "0-0", "0-1", "1-1")
                const pairKey = selectedMetric.replace('gr_', '');
                values = rdf.gr_partial[pairKey] || [];
                times = rdf.r;
            }
            
            if (values.length === 0) return;
        } else {
            // Handle regular time series data
            const cv = analytics.getCollectiveVariable(selectedMetric);
            if (!cv || cv.values.length < 2) return;
            
            values = cv.values.slice(-1000); // Last 1000 points
            times = cv.times.slice(-1000);
        }
        
        // Calculate moving average for time series (skip for g(r))
        let movingAvg: number[] = [];
        
        if (!isRDF) {
            const windowSize = Math.min(10, values.length);
            for (let i = 0; i < values.length; i++) {
                const start = Math.max(0, i - windowSize + 1);
                const window = values.slice(start, i + 1);
                const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
                movingAvg.push(avg);
            }
        }

        // Find data range
        let minValue = Math.min(...values);
        let maxValue = Math.max(...values);
        
        // Apply log scale if enabled
        let processedValues = values;
        let processedMovingAvg = movingAvg;
        
        if (useLogScale && minValue > 0) {
            processedValues = values.map(v => Math.log10(Math.max(v, 0.001)));
            processedMovingAvg = movingAvg.map(v => Math.log10(Math.max(v, 0.001)));
            minValue = Math.min(...processedValues);
            maxValue = Math.max(...processedValues);
        }
        
        const valueRange = maxValue - minValue || 1;

        // Draw axes
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();

        // Add tick marks for g(r) plots
        if (isRDF) {
            const rdf = analytics.getRadialDistributionFunction();
            const maxR = rdf.maxRadius;
            const tickSpacing = maxR <= 5 ? 1 : Math.ceil(maxR / 10); // Adaptive tick spacing
            
            ctx.strokeStyle = '#666666';
            ctx.lineWidth = 1;
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#6b7280';
            
            for (let r = 0; r <= maxR; r += tickSpacing) {
                const x = padding + (r / maxR) * plotWidth;
                
                // Draw tick mark
                ctx.beginPath();
                ctx.moveTo(x, height - padding);
                ctx.lineTo(x, height - padding + 5);
                ctx.stroke();
                
                // Draw tick label
                ctx.fillText(r.toFixed(1), x, height - padding + 17);
            }
        }

        // Draw data line
        ctx.strokeStyle = '#2563eb'; // Simple blue color
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < processedValues.length; i++) {
            const x = padding + (i / (processedValues.length - 1)) * plotWidth;
            const y = height - padding - ((processedValues[i] - minValue) / valueRange) * plotHeight;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Draw moving average line for time series data only
        if (!isRDF && processedMovingAvg.length > 1) {
            ctx.strokeStyle = '#dc2626'; // Red for moving average
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < processedMovingAvg.length; i++) {
                const x = padding + (i / (processedMovingAvg.length - 1)) * plotWidth;
                const y = height - padding - ((processedMovingAvg[i] - minValue) / valueRange) * plotHeight;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // Add crisp text labels directly to canvas
        // Determine title and axis labels
        let title: string;
        let xAxisLabel: string;
        
        if (selectedMetric.startsWith('gr_')) {
            if (selectedMetric === 'gr_total') {
                title = 'g(r) - Total';
            } else {
                const pairKey = selectedMetric.replace('gr_', '');
                const typeMap = { '0-0': 'Orange-Orange', '0-1': 'Orange-Blue', '1-1': 'Blue-Blue' };
                title = `g(r) - ${typeMap[pairKey as keyof typeof typeMap] || pairKey}`;
            }
            xAxisLabel = 'Distance (Å)';
        } else {
            const cv = analytics.getCollectiveVariable(selectedMetric);
            title = useLogScale ? `log₁₀(${cv?.name}) (${cv?.unit})` : `${cv?.name} (${cv?.unit})`;
            xAxisLabel = 'Time Steps';
        }
        
        // Set up crisp text rendering
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#374151';
        
        // Plot title
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(title, width / 2, 25);
        
        // Y-axis labels
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#6b7280';
        const maxLabel = useLogScale && minValue > 0 ? (Math.pow(10, maxValue)).toFixed(2) : maxValue.toFixed(2);
        const minLabel = useLogScale && minValue > 0 ? (Math.pow(10, minValue)).toFixed(2) : minValue.toFixed(2);
        
        ctx.fillText(maxLabel, padding - 10, padding + 10);
        ctx.fillText(minLabel, padding - 10, height - padding - 10);
        
        // X-axis label
        ctx.textAlign = 'center';
        ctx.fillText(xAxisLabel, width / 2, height - 10);
    };

    // Update plot periodically
    useEffect(() => {
        const interval = setInterval(renderAnalyticsPlot, 100);
        return () => clearInterval(interval);
    }, [analytics, selectedMetric, useLogScale]);

    return (
        <div style={{
            position: 'relative',
            backgroundColor: '#f8f9fa',
            padding: '1rem',
            borderRadius: '8px',
            border: '1px solid #e9ecef',
            height: '300px'
        }}>
            {/* Overlay controls at the top */}
            <div style={{
                position: 'absolute',
                top: '1rem',
                left: '1rem',
                right: '1rem',
                zIndex: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <select 
                            value={selectedMetric} 
                            onChange={(e) => setSelectedMetric(e.target.value)}
                            style={{
                                padding: '0.25rem 0.5rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(255,255,255,0.9)',
                                fontSize: '0.75rem'
                            }}
                        >
                            <option value="temperature">Temperature</option>
                            <option value="pressure">Pressure</option>
                            <option value="totalEnergy">Total Energy</option>
                            <option value="kineticEnergy">Kinetic Energy</option>
                            <option value="potentialEnergy">Potential Energy</option>
                            <option value="gr_total">g(r) - Total</option>
                            <option value="gr_0-0">g(r) - Orange-Orange</option>
                            <option value="gr_0-1">g(r) - Orange-Blue</option>
                            <option value="gr_1-1">g(r) - Blue-Blue</option>
                        </select>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                            <input
                                type="checkbox"
                                checked={useLogScale}
                                onChange={(e) => setUseLogScale(e.target.checked)}
                            />
                            Log
                        </label>
                    </div>
                </div>
                
                {/* Metrics overlay */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        borderRadius: '4px',
                        border: '1px solid rgba(233,236,239,0.8)',
                        fontSize: '0.75rem'
                    }}>
                        <span style={{ color: '#6b7280' }}>Particles: </span>
                        <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>
                            {particleData ? `${particleData.typeCounts[0]}/${particleData.typeCounts[1]}` : '0/0'}
                        </span>
                    </div>
                    <div style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        borderRadius: '4px',
                        border: '1px solid rgba(233,236,239,0.8)',
                        fontSize: '0.75rem'
                    }}>
                        <span style={{ color: '#6b7280' }}>T: </span>
                        <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>
                            {analytics?.getLatestSnapshot()?.temperature?.toFixed(2) || '0.00'}
                        </span>
                    </div>
                    <div style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        borderRadius: '4px',
                        border: '1px solid rgba(233,236,239,0.8)',
                        fontSize: '0.75rem'
                    }}>
                        <span style={{ color: '#6b7280' }}>E: </span>
                        <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>
                            {analytics?.getLatestSnapshot()?.totalEnergy?.toFixed(1) || '0.0'}
                        </span>
                    </div>
                </div>
            </div>
            
            {/* Full-size canvas */}
            <canvas 
                ref={plotCanvasRef} 
                width={800} 
                height={250}
                style={{ 
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%', 
                    height: '100%',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff'
                }}
            />
        </div>
    );
};

export default AnalyticsPlot;