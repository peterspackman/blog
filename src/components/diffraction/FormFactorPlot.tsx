import React, { useMemo, useRef, useEffect } from 'react';
import type { ControlTheme } from '../shared/controls';

interface FormFactorPlotProps {
    width: number;
    height: number;
    elements: string[];
    theme: ControlTheme;
}

// Cromer-Mann coefficients: [a1, b1, a2, b2, a3, b3, a4, b4, c]
// f(s) = Σᵢ aᵢ·exp(-bᵢ·s²) + c, where s = sin(θ)/λ
const FORM_FACTOR_COEFFS: Record<string, number[]> = {
    H: [0.489918, 20.6593, 0.262003, 7.74039, 0.196767, 49.5519, 0.049879, 2.20159, 0.001305],
    C: [2.31, 20.8439, 1.02, 10.2075, 1.5886, 0.5687, 0.865, 51.6512, 0.2156],
    N: [12.2126, 0.0057, 3.1322, 9.8933, 2.0125, 28.9975, 1.1663, 0.5826, -11.529],
    O: [3.0485, 13.2771, 2.2868, 5.7011, 1.5463, 0.3239, 0.867, 32.9089, 0.2508],
    Na: [4.7626, 3.285, 3.1736, 8.8422, 1.2674, 0.3136, 1.1128, 129.424, 0.676],
    Mg: [5.4204, 2.8275, 2.1735, 79.2611, 1.2269, 0.3808, 2.3073, 7.1937, 0.8584],
    Al: [6.4202, 3.0387, 1.9002, 0.7426, 1.5936, 31.5472, 1.9646, 85.0886, 1.1151],
    Si: [6.2915, 2.4386, 3.0353, 32.3337, 1.9891, 0.6785, 1.541, 81.6937, 1.1407],
    P: [6.4345, 1.9067, 4.1791, 27.157, 1.78, 0.526, 1.4908, 68.1645, 1.1149],
    S: [6.9053, 1.4679, 5.2034, 22.2151, 1.4379, 0.2536, 1.5863, 56.172, 0.8669],
    Cl: [11.4604, 0.0104, 7.1964, 1.1662, 6.2556, 18.5194, 1.6455, 47.7784, -9.5574],
    K: [8.2186, 12.7949, 7.4398, 0.7748, 1.0519, 213.187, 0.8659, 41.6841, 1.4228],
    Ca: [8.6266, 10.4421, 7.3873, 0.6599, 1.5899, 85.7484, 1.0211, 178.437, 1.3751],
    Ti: [9.7595, 7.8508, 7.3558, 0.5, 1.6991, 35.6338, 1.9021, 116.105, 1.2807],
    Fe: [11.7695, 4.7611, 7.3573, 0.3072, 3.5222, 15.3535, 2.3045, 76.8805, 1.0369],
    Cu: [13.338, 3.5828, 7.1676, 0.247, 5.6158, 11.3966, 1.6735, 64.8126, 1.191],
    Zn: [14.0743, 3.2655, 7.0318, 0.2333, 5.1652, 10.3163, 2.41, 58.7097, 1.3041],
    Br: [17.1789, 2.1723, 5.2358, 16.5796, 5.6377, 0.2609, 3.9851, 41.4328, 2.9557],
    Cs: [20.3892, 3.569, 19.1062, 0.3107, 10.662, 24.3879, 1.4953, 213.904, 3.3352],
    Ba: [20.1807, 3.21, 19.1136, 0.2855, 10.9054, 20.0558, 0.7763, 51.746, 3.029],
    I: [20.1472, 4.347, 18.9949, 0.3814, 7.5138, 27.766, 2.2735, 66.8776, 4.0712],
};

// Element colors for plotting
const ELEMENT_COLORS: Record<string, string> = {
    H: '#ffffff',
    C: '#909090',
    N: '#3050f8',
    O: '#ff0d0d',
    Na: '#ab5cf2',
    Mg: '#8aff00',
    Al: '#bfa6a6',
    Si: '#f0c8a0',
    P: '#ff8000',
    S: '#ffff30',
    Cl: '#1ff01f',
    K: '#8f40d4',
    Ca: '#3dff00',
    Ti: '#bfc2c7',
    Fe: '#e06633',
    Cu: '#c88033',
    Zn: '#7d80b0',
    Br: '#a62929',
    Cs: '#57178f',
    Ba: '#00c900',
    I: '#940094',
};

function calculateFormFactor(element: string, s: number): number {
    const coeffs = FORM_FACTOR_COEFFS[element];
    if (!coeffs) return 0;

    const s2 = s * s;
    let f = coeffs[8]; // c term
    for (let i = 0; i < 4; i++) {
        const a = coeffs[2 * i];
        const b = coeffs[2 * i + 1];
        f += a * Math.exp(-b * s2);
    }
    return f;
}

export const FormFactorPlot: React.FC<FormFactorPlotProps> = ({
    width,
    height,
    elements,
    theme,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Get unique elements
    const uniqueElements = useMemo(() => {
        return [...new Set(elements)].filter(e => FORM_FACTOR_COEFFS[e]);
    }, [elements]);

    // Calculate form factor data
    const plotData = useMemo(() => {
        const sMax = 1.5; // sin(θ)/λ max
        const numPoints = 100;
        const data: { element: string; points: { s: number; f: number }[] }[] = [];

        for (const element of uniqueElements) {
            const points: { s: number; f: number }[] = [];
            for (let i = 0; i <= numPoints; i++) {
                const s = (i / numPoints) * sMax;
                const f = calculateFormFactor(element, s);
                points.push({ s, f });
            }
            data.push({ element, points });
        }

        return data;
    }, [uniqueElements]);

    // Find max f for scaling
    const fMax = useMemo(() => {
        let max = 0;
        for (const { points } of plotData) {
            for (const { f } of points) {
                max = Math.max(max, f);
            }
        }
        return Math.ceil(max / 5) * 5; // Round up to nearest 5
    }, [plotData]);

    // Draw the plot
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        const padding = { top: 20, right: 15, bottom: 35, left: 40 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;

        // Clear
        ctx.fillStyle = theme.surface || theme.background;
        ctx.fillRect(0, 0, width, height);

        // Draw grid
        ctx.strokeStyle = theme.border;
        ctx.lineWidth = 0.5;

        // Vertical grid lines
        const sMax = 1.5;
        for (let s = 0; s <= sMax; s += 0.5) {
            const x = padding.left + (s / sMax) * plotWidth;
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + plotHeight);
            ctx.stroke();
        }

        // Horizontal grid lines
        const fStep = fMax > 20 ? 10 : 5;
        for (let f = 0; f <= fMax; f += fStep) {
            const y = padding.top + plotHeight - (f / fMax) * plotHeight;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + plotWidth, y);
            ctx.stroke();
        }

        // Draw axes
        ctx.strokeStyle = theme.text;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, padding.top + plotHeight);
        ctx.lineTo(padding.left + plotWidth, padding.top + plotHeight);
        ctx.stroke();

        // Draw axis labels
        ctx.fillStyle = theme.textMuted;
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';

        // X-axis labels
        for (let s = 0; s <= sMax; s += 0.5) {
            const x = padding.left + (s / sMax) * plotWidth;
            ctx.fillText(s.toFixed(1), x, height - 8);
        }

        // X-axis title
        ctx.fillText('sin(θ)/λ (Å⁻¹)', padding.left + plotWidth / 2, height - 2);

        // Y-axis labels
        ctx.textAlign = 'right';
        for (let f = 0; f <= fMax; f += fStep) {
            const y = padding.top + plotHeight - (f / fMax) * plotHeight;
            ctx.fillText(f.toString(), padding.left - 5, y + 3);
        }

        // Y-axis title
        ctx.save();
        ctx.translate(10, padding.top + plotHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText('f (electrons)', 0, 0);
        ctx.restore();

        // Draw form factor curves
        ctx.lineWidth = 2;
        for (const { element, points } of plotData) {
            ctx.strokeStyle = ELEMENT_COLORS[element] || theme.accent;
            ctx.beginPath();

            for (let i = 0; i < points.length; i++) {
                const { s, f } = points[i];
                const x = padding.left + (s / sMax) * plotWidth;
                const y = padding.top + plotHeight - (f / fMax) * plotHeight;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }

        // Draw legend
        const legendX = padding.left + plotWidth - 50;
        let legendY = padding.top + 10;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';

        for (const { element } of plotData) {
            // Line sample
            ctx.strokeStyle = ELEMENT_COLORS[element] || theme.accent;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(legendX, legendY);
            ctx.lineTo(legendX + 15, legendY);
            ctx.stroke();

            // Label
            ctx.fillStyle = theme.text;
            ctx.fillText(element, legendX + 20, legendY + 3);

            legendY += 14;
        }

        // Title
        ctx.fillStyle = theme.text;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Atomic Form Factors', padding.left, 12);

    }, [width, height, plotData, fMax, theme]);

    return (
        <div
            style={{
                borderRadius: '4px',
                border: `1px solid ${theme.border}`,
                overflow: 'hidden',
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    width,
                    height,
                    display: 'block',
                }}
            />
        </div>
    );
};

// Info component showing the formula
export const FormFactorInfo: React.FC<{ theme: ControlTheme }> = ({ theme }) => {
    return (
        <div
            style={{
                padding: '0.5rem',
                backgroundColor: theme.inputBg,
                borderRadius: '4px',
                fontSize: '0.7rem',
                color: theme.textMuted,
                marginTop: '0.5rem',
            }}
        >
            <div style={{ fontWeight: 'bold', marginBottom: '0.25rem', color: theme.text }}>
                Cromer-Mann Form Factors
            </div>
            <div style={{ fontFamily: 'serif', fontStyle: 'italic' }}>
                f(s) = Σ aᵢ·exp(-bᵢ·s²) + c
            </div>
            <div style={{ marginTop: '0.25rem' }}>
                where s = sin(θ)/λ
            </div>
            <div style={{ marginTop: '0.25rem', fontSize: '0.65rem' }}>
                Data from International Tables for Crystallography
            </div>
        </div>
    );
};

export default FormFactorPlot;
