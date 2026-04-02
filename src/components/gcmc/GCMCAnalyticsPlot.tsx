import React, { useRef, useEffect, useState } from 'react';
import { GCMCAnalyticsEngine } from './GCMCAnalytics';

interface GCMCAnalyticsPlotProps {
    analytics: GCMCAnalyticsEngine | null;
    width?: number;
    isDark?: boolean;
    typeLabels?: string[];
    typeColors?: string[];
    numTypes?: number;
}

type MetricType = 'particle_count' | 'energy' | 'acceptance_rates' | 'pn_histogram' | 'rdf' | 'density_x' | 'density_y' | 'density_r';

const GCMCAnalyticsPlot: React.FC<GCMCAnalyticsPlotProps> = ({
    analytics,
    width: containerWidth,
    isDark = false,
    typeLabels = ['Type 0'],
    typeColors = ['rgba(128, 128, 255, 0.8)'],
    numTypes = 1,
}) => {
    const plotCanvasRef = useRef<HTMLCanvasElement>(null);
    const [selectedMetric, setSelectedMetric] = useState<MetricType>('particle_count');
    const rafRef = useRef<number>(0);
    const lastDrawRef = useRef(0);

    const getPlotColor = (rgba: string): string => {
        const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) return `rgb(${match[1]}, ${match[2]}, ${match[3]})`;
        return rgba;
    };

    // Gaussian kernel smooth for density profiles
    const smooth = (data: number[], radius: number = 2): number[] => {
        if (data.length < 3 || radius < 1) return data;
        const out = new Array(data.length);
        const r = Math.floor(radius);
        // Build kernel weights
        const sigma = radius / 2;
        const weights: number[] = [];
        for (let k = -r; k <= r; k++) weights.push(Math.exp(-0.5 * (k / sigma) ** 2));
        const wsum = weights.reduce((a, b) => a + b, 0);
        for (let i = 0; i < data.length; i++) {
            let val = 0, w = 0;
            for (let k = -r; k <= r; k++) {
                const j = i + k;
                if (j >= 0 && j < data.length) {
                    const wk = weights[k + r];
                    val += data[j] * wk;
                    w += wk;
                }
            }
            out[i] = val / w;
        }
        return out;
    };

    useEffect(() => {
        const theme = {
            background: isDark ? '#1a1a1a' : '#ffffff',
            text: isDark ? '#e0e0e0' : '#374151',
            textMuted: isDark ? '#888' : '#6b7280',
            axis: isDark ? '#666' : '#666666',
            grid: isDark ? '#333' : '#e5e7eb',
            lineBlue: '#3b82f6',
            lineGreen: '#10b981',
            lineRed: '#ef4444',
            lineOrange: '#f97316',
            linePurple: '#8b5cf6',
        };

        const renderPlot = (now: number) => {
            rafRef.current = requestAnimationFrame(renderPlot);

            // Throttle to ~5 fps for the plot
            if (now - lastDrawRef.current < 200) return;
            lastDrawRef.current = now;

            const canvas = plotCanvasRef.current;
            if (!canvas || !analytics) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const dpr = window.devicePixelRatio || 1;
            const displayWidth = canvas.clientWidth;
            const displayHeight = canvas.clientHeight;
            if (displayWidth === 0 || displayHeight === 0) return;

            canvas.width = displayWidth * dpr;
            canvas.height = displayHeight * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const width = displayWidth;
            const height = displayHeight;
            const padding = { top: 45, right: 20, bottom: 35, left: 55 };
            const plotWidth = width - padding.left - padding.right;
            const plotHeight = height - padding.top - padding.bottom;

            ctx.fillStyle = theme.background;
            ctx.fillRect(0, 0, width, height);

            const snapshots = analytics.getSnapshots();

            const drawAxes = () => {
                ctx.strokeStyle = theme.axis;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(padding.left, padding.top);
                ctx.lineTo(padding.left, height - padding.bottom);
                ctx.lineTo(width - padding.right, height - padding.bottom);
                ctx.stroke();
            };

            const drawGrid = (numYTicks: number) => {
                ctx.strokeStyle = theme.grid;
                ctx.lineWidth = 0.5;
                for (let i = 0; i <= numYTicks; i++) {
                    const y = padding.top + (i / numYTicks) * plotHeight;
                    ctx.beginPath();
                    ctx.moveTo(padding.left, y);
                    ctx.lineTo(width - padding.right, y);
                    ctx.stroke();
                }
            };

            const drawYTicks = (minVal: number, maxVal: number, numTicks: number, decimals: number = 1) => {
                ctx.font = '10px Arial';
                ctx.textAlign = 'right';
                ctx.fillStyle = theme.textMuted;
                const range = maxVal - minVal || 1;
                for (let i = 0; i <= numTicks; i++) {
                    const value = maxVal - (i / numTicks) * range;
                    const y = padding.top + (i / numTicks) * plotHeight;
                    ctx.fillText(value.toFixed(decimals), padding.left - 5, y + 3);
                }
            };

            const drawTitle = (title: string) => {
                ctx.font = '13px Arial';
                ctx.textAlign = 'center';
                ctx.fillStyle = theme.text;
                ctx.fillText(title, width / 2, 20);
            };

            const drawXLabel = (label: string) => {
                ctx.font = '11px Arial';
                ctx.fillStyle = theme.textMuted;
                ctx.textAlign = 'center';
                ctx.fillText(label, width / 2, height - 5);
            };

            const drawCurve = (values: number[], minVal: number, maxVal: number, color: string, lw: number = 1.5) => {
                if (values.length < 2) return;
                const range = maxVal - minVal || 1;
                ctx.strokeStyle = color;
                ctx.lineWidth = lw;
                ctx.beginPath();
                for (let i = 0; i < values.length; i++) {
                    const x = padding.left + (i / (values.length - 1)) * plotWidth;
                    const y = height - padding.bottom - ((values[i] - minVal) / range) * plotHeight;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            };

            if (selectedMetric === 'particle_count') {
                const recent = snapshots.slice(-1000);
                if (recent.length < 2) { drawTitle('Particle Count <N>'); drawAxes(); return; }

                const counts = recent.map(s => s.particleCount);
                const minN = 0;
                const maxN = Math.max(...counts, 1);

                drawAxes(); drawGrid(4); drawYTicks(minN, maxN, 4, 0);
                drawCurve(counts, minN, maxN, isDark ? '#e0e0e0' : '#1f2937', 2);

                // Per-type
                if (numTypes > 1) {
                    for (let t = 0; t < Math.min(numTypes, 2); t++) {
                        const tc = recent.map(s => s.particleCountsByType[t] ?? 0);
                        drawCurve(tc, minN, maxN, getPlotColor(typeColors[t]));
                    }
                }

                // Running average
                const w = Math.min(200, Math.floor(counts.length / 2));
                if (w > 5) {
                    ctx.setLineDash([4, 4]);
                    const avg: number[] = [];
                    let sum = 0;
                    for (let i = 0; i < counts.length; i++) {
                        sum += counts[i];
                        if (i >= w) sum -= counts[i - w];
                        if (i >= w - 1) avg.push(sum / w);
                    }
                    // Offset to align with end of data
                    const offset = counts.length - avg.length;
                    ctx.strokeStyle = theme.lineGreen;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    const range = maxN - minN || 1;
                    for (let i = 0; i < avg.length; i++) {
                        const x = padding.left + ((i + offset) / (counts.length - 1)) * plotWidth;
                        const y = height - padding.bottom - ((avg[i] - minN) / range) * plotHeight;
                        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                drawTitle('Particle Count <N>'); drawXLabel('MC Steps');

            } else if (selectedMetric === 'energy') {
                const recent = snapshots.slice(-1000);
                if (recent.length < 2) { drawTitle('Total Energy'); drawAxes(); return; }

                const energies = recent.map(s => s.totalEnergy);
                const minE = Math.min(0, ...energies);
                const maxE = Math.max(0, ...energies);

                drawAxes(); drawGrid(4); drawYTicks(minE, maxE, 4, 2);
                drawCurve(energies, minE, maxE, theme.lineBlue);
                drawTitle('Total Energy (eV)'); drawXLabel('MC Steps');

            } else if (selectedMetric === 'acceptance_rates') {
                const recent = snapshots.slice(-500);
                if (recent.length < 2) { drawTitle('Acceptance Rates'); drawAxes(); return; }

                drawAxes(); drawGrid(4); drawYTicks(0, 1, 4, 2);

                const types = [
                    { key: 'displacement' as const, color: theme.lineBlue, label: 'Disp' },
                    { key: 'insertion' as const, color: theme.lineGreen, label: 'Ins' },
                    { key: 'deletion' as const, color: theme.lineRed, label: 'Del' },
                ];

                types.forEach(({ key, color }) => {
                    const values = recent.map(s => s.acceptanceRates[key] ?? 0);
                    drawCurve(values, 0, 1, color);
                });

                // Legend
                const legendX = width - padding.right - 55;
                ctx.font = '10px Arial';
                types.forEach(({ color, label }, i) => {
                    const y = padding.top + 5 + i * 14;
                    ctx.strokeStyle = color; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(legendX, y); ctx.lineTo(legendX + 14, y); ctx.stroke();
                    ctx.fillStyle = theme.text; ctx.textAlign = 'left';
                    ctx.fillText(label, legendX + 18, y + 3);
                });

                drawTitle('Acceptance Rates'); drawXLabel('MC Steps');

            } else if (selectedMetric === 'pn_histogram') {
                const hist = analytics.getParticleCountHistogram();
                if (hist.n.length === 0) { drawTitle('P(N) Distribution'); drawAxes(); return; }

                const minN = Math.min(...hist.n);
                const maxN = Math.max(...hist.n);
                const maxP = Math.max(...hist.probability);
                const nRange = maxN - minN || 1;

                drawAxes(); drawGrid(4); drawYTicks(0, maxP, 4, 3);

                const barWidth = Math.max(2, plotWidth / (nRange + 2));
                ctx.fillStyle = theme.lineBlue + '88';
                ctx.strokeStyle = theme.lineBlue;
                ctx.lineWidth = 1;
                for (let i = 0; i < hist.n.length; i++) {
                    const x = padding.left + ((hist.n[i] - minN) / (nRange + 1)) * plotWidth;
                    const barH = (hist.probability[i] / (maxP || 1)) * plotHeight;
                    const y = height - padding.bottom - barH;
                    ctx.fillRect(x, y, barWidth, barH);
                    ctx.strokeRect(x, y, barWidth, barH);
                }

                ctx.font = '10px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = theme.textMuted;
                const tickStep = Math.max(1, Math.floor(nRange / 8));
                for (let n = minN; n <= maxN; n += tickStep) {
                    const x = padding.left + ((n - minN) / (nRange + 1)) * plotWidth + barWidth / 2;
                    ctx.fillText(n.toString(), x, height - padding.bottom + 15);
                }

                drawTitle('P(N) Distribution'); drawXLabel('Particle Count N');

            } else if (selectedMetric === 'density_x' || selectedMetric === 'density_y' || selectedMetric === 'density_r') {
                const dp = selectedMetric === 'density_x' ? analytics.getDensityProfileX()
                    : selectedMetric === 'density_y' ? analytics.getDensityProfileY()
                    : analytics.getRadialProfile();
                const axisLabel = selectedMetric === 'density_x' ? 'x' : selectedMetric === 'density_y' ? 'y' : 'r';
                if (dp.sampleCount === 0 || dp.y.length === 0 || dp.y[0] === 0) { drawTitle(`Density \u03C1(${axisLabel})`); drawAxes(); return; }

                // Smooth density data with Gaussian kernel
                const smoothedRho = smooth(dp.rho);
                const smoothedByType = dp.rhoByType.map(arr => smooth(arr));

                const maxRhoRaw = Math.max(...smoothedRho);
                const maxRho = maxRhoRaw > 0 ? maxRhoRaw : 0.001;
                const maxPos = dp.y[dp.y.length - 1] + dp.binWidth / 2;

                drawAxes(); drawGrid(4);
                drawYTicks(0, maxRho, 4, 4);

                // Position axis ticks
                ctx.font = '10px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = theme.textMuted;
                const tickSpacing = Math.ceil(maxPos / 6);
                for (let p = 0; p <= maxPos; p += tickSpacing) {
                    const x = padding.left + (p / maxPos) * plotWidth;
                    ctx.beginPath(); ctx.strokeStyle = theme.axis;
                    ctx.moveTo(x, height - padding.bottom); ctx.lineTo(x, height - padding.bottom + 4); ctx.stroke();
                    ctx.fillText(p.toFixed(0), x, height - padding.bottom + 15);
                }

                // Per-type density as filled area (smoothed)
                for (let t = 0; t < Math.min(numTypes, smoothedByType.length); t++) {
                    const vals = smoothedByType[t];
                    const color = getPlotColor(typeColors[t] ?? typeColors[0]);
                    ctx.fillStyle = color.replace('rgb', 'rgba').replace(')', ', 0.25)');
                    ctx.beginPath();
                    ctx.moveTo(padding.left, height - padding.bottom);
                    for (let i = 0; i < dp.y.length; i++) {
                        const x = padding.left + (dp.y[i] / maxPos) * plotWidth;
                        const y = height - padding.bottom - (vals[i] / maxRho) * plotHeight;
                        ctx.lineTo(x, y);
                    }
                    ctx.lineTo(padding.left + ((dp.y[dp.y.length - 1]) / maxPos) * plotWidth, height - padding.bottom);
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    for (let i = 0; i < dp.y.length; i++) {
                        const x = padding.left + (dp.y[i] / maxPos) * plotWidth;
                        const y = height - padding.bottom - (vals[i] / maxRho) * plotHeight;
                        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                }

                // Total density line on top (smoothed)
                ctx.strokeStyle = isDark ? '#e0e0e0' : '#1f2937';
                ctx.lineWidth = 2;
                ctx.beginPath();
                for (let i = 0; i < dp.y.length; i++) {
                    const x = padding.left + (dp.y[i] / maxPos) * plotWidth;
                    const y = height - padding.bottom - (smoothedRho[i] / maxRho) * plotHeight;
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.stroke();

                drawTitle(`Density Profile ρ(${axisLabel})`); drawXLabel(`${axisLabel} (Å)`);

            } else if (selectedMetric === 'rdf') {
                const rdf = analytics.getRDF();
                if (!rdf.r || rdf.r.length === 0 || rdf.sampleCount === 0) { drawTitle('Radial Distribution g(r)'); drawAxes(); return; }

                const maxGr = Math.max(...rdf.gr, 1);
                const maxR = rdf.maxRadius;

                drawAxes(); drawGrid(4); drawYTicks(0, maxGr, 4, 1);

                // X-axis ticks
                ctx.font = '10px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = theme.textMuted;
                const tickSpacing = maxR <= 5 ? 1 : Math.ceil(maxR / 5);
                for (let r = 0; r <= maxR; r += tickSpacing) {
                    const x = padding.left + (r / maxR) * plotWidth;
                    ctx.beginPath(); ctx.strokeStyle = theme.axis;
                    ctx.moveTo(x, height - padding.bottom); ctx.lineTo(x, height - padding.bottom + 4); ctx.stroke();
                    ctx.fillText(r.toFixed(0), x, height - padding.bottom + 15);
                }

                // g(r) = 1 reference
                if (maxGr > 1) {
                    ctx.strokeStyle = theme.grid; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
                    const y1 = height - padding.bottom - (1 / maxGr) * plotHeight;
                    ctx.beginPath(); ctx.moveTo(padding.left, y1); ctx.lineTo(width - padding.right, y1); ctx.stroke();
                    ctx.setLineDash([]);
                }

                // Main g(r)
                ctx.strokeStyle = isDark ? '#e0e0e0' : '#1f2937'; ctx.lineWidth = 2;
                ctx.beginPath();
                for (let i = 0; i < rdf.r.length; i++) {
                    const x = padding.left + (rdf.r[i] / maxR) * plotWidth;
                    const y = height - padding.bottom - (rdf.gr[i] / maxGr) * plotHeight;
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.stroke();

                // Partial g(r)
                const partialColors = [theme.lineOrange, theme.lineBlue, theme.linePurple];
                Object.keys(rdf.gr_partial).sort().forEach((key, ki) => {
                    const values = rdf.gr_partial[key];
                    ctx.strokeStyle = partialColors[ki % partialColors.length]; ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    for (let i = 0; i < rdf.r.length; i++) {
                        const x = padding.left + (rdf.r[i] / maxR) * plotWidth;
                        const y = height - padding.bottom - ((values[i] ?? 0) / maxGr) * plotHeight;
                        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                });

                drawTitle('Radial Distribution g(r)'); drawXLabel('r (Å)');
            }
        };

        rafRef.current = requestAnimationFrame(renderPlot);
        return () => cancelAnimationFrame(rafRef.current);
    }, [analytics, isDark, selectedMetric, typeLabels, typeColors, numTypes]);

    const metrics: { key: MetricType; label: string }[] = [
        { key: 'particle_count', label: '<N>' },
        { key: 'energy', label: 'Energy' },
        { key: 'acceptance_rates', label: 'Acc. Rates' },
        { key: 'density_x', label: 'ρ(x)' },
        { key: 'density_y', label: 'ρ(y)' },
        { key: 'density_r', label: 'ρ(r)' },
        { key: 'pn_histogram', label: 'P(N)' },
        { key: 'rdf', label: 'g(r)' },
    ];

    return (
        <div style={{
            width: containerWidth ? `${containerWidth}px` : '100%',
            margin: '0.5rem auto 0',
        }}>
            <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                {metrics.map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setSelectedMetric(key)}
                        style={{
                            padding: '0.2rem 0.5rem',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '0.7rem',
                            fontWeight: selectedMetric === key ? 600 : 400,
                            cursor: 'pointer',
                            backgroundColor: selectedMetric === key
                                ? (isDark ? '#60a5fa' : '#2563eb')
                                : (isDark ? '#2d2d2d' : '#f5f5f5'),
                            color: selectedMetric === key ? '#fff' : (isDark ? '#888' : '#666'),
                            transition: 'all 0.15s ease',
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <canvas
                ref={plotCanvasRef}
                style={{
                    width: '100%',
                    height: '200px',
                    borderRadius: '8px',
                }}
            />
        </div>
    );
};

export default GCMCAnalyticsPlot;
