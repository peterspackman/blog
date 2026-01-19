import React, { useRef, useEffect } from 'react';
import type { MOCoefficients } from './physics';
import { calculateMOCoefficients, countNodes, getBondingCharacter } from './physics';
import type { ControlTheme } from '../shared/controls';

export interface OrbitalDisplayProps {
    width: number;
    height: number;
    N: number;
    selectedK: number | null;
    showAtomLabels: boolean;
    showCoefficients: boolean;
    theme: ControlTheme;
}

export const OrbitalDisplay: React.FC<OrbitalDisplayProps> = ({
    width,
    height,
    N,
    selectedK,
    showAtomLabels,
    showCoefficients,
    theme,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const isDark = theme.text.startsWith('#e') || theme.text.startsWith('#f');
        const bgColor = theme.surface || theme.inputBg;
        const textColor = theme.text;
        const mutedColor = theme.textMuted;

        // Clear canvas
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);

        // Layout
        const margin = { left: 30, right: 30, top: 40, bottom: 50 };
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;

        // Calculate atom positions
        const atomRadius = Math.min(10, plotWidth / (N * 3));
        const atomSpacing = plotWidth / (N + 1);
        const centerY = margin.top + plotHeight / 2;

        // Draw chain backbone line
        ctx.strokeStyle = isDark ? '#555' : '#ccc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(margin.left, centerY);
        ctx.lineTo(width - margin.right, centerY);
        ctx.stroke();

        // Draw atoms
        for (let j = 1; j <= N; j++) {
            const x = margin.left + j * atomSpacing;

            // Draw atom circle
            ctx.fillStyle = isDark ? '#666' : '#999';
            ctx.beginPath();
            ctx.arc(x, centerY, atomRadius, 0, 2 * Math.PI);
            ctx.fill();

            // Draw atom label
            if (showAtomLabels && N <= 20) {
                ctx.fillStyle = mutedColor;
                ctx.font = '10px "Segoe UI", system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`${j}`, x, centerY + atomRadius + 14);
            }
        }

        // If no orbital selected, show placeholder
        if (selectedK === null) {
            ctx.fillStyle = mutedColor;
            ctx.font = '14px "Segoe UI", system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Select an orbital to view its shape', width / 2, margin.top + 10);
            return;
        }

        // Calculate MO coefficients
        const mo = calculateMOCoefficients(selectedK, N);
        const maxCoef = Math.max(...mo.coefficients.map(Math.abs));
        const maxLobeHeight = plotHeight * 0.35;

        // Draw p-orbital lobes
        for (let j = 0; j < N; j++) {
            const x = margin.left + (j + 1) * atomSpacing;
            const coef = mo.coefficients[j];
            const normalizedCoef = coef / maxCoef;
            const lobeHeight = Math.abs(normalizedCoef) * maxLobeHeight;
            const lobeWidth = atomRadius * 1.5;

            if (Math.abs(coef) < 0.001) continue;

            const isPositive = coef > 0;

            // Colors for lobes
            const positiveColor = isDark ? '#6b9eff' : '#3b82f6'; // Blue
            const negativeColor = isDark ? '#ff7b7b' : '#ef4444'; // Red

            // Upper lobe
            const upperColor = isPositive ? positiveColor : negativeColor;
            ctx.fillStyle = upperColor;
            ctx.beginPath();
            ctx.ellipse(
                x,
                centerY - atomRadius - lobeHeight / 2,
                lobeWidth,
                lobeHeight / 2,
                0,
                0,
                2 * Math.PI
            );
            ctx.fill();

            // Lower lobe (opposite color)
            const lowerColor = isPositive ? negativeColor : positiveColor;
            ctx.fillStyle = lowerColor;
            ctx.beginPath();
            ctx.ellipse(
                x,
                centerY + atomRadius + lobeHeight / 2,
                lobeWidth,
                lobeHeight / 2,
                0,
                0,
                2 * Math.PI
            );
            ctx.fill();

            // Draw coefficient value
            if (showCoefficients && N <= 15) {
                ctx.fillStyle = textColor;
                ctx.font = '9px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(
                    coef.toFixed(2),
                    x,
                    centerY - atomRadius - lobeHeight - 5
                );
            }
        }

        // Draw title with orbital info
        ctx.fillStyle = textColor;
        ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';

        const nodes = countNodes(selectedK);
        const character = getBondingCharacter(selectedK, N);
        const characterLabel =
            character === 'bonding'
                ? '(bonding)'
                : character === 'antibonding'
                  ? '(antibonding)'
                  : '(nonbonding)';

        ctx.fillText(
            `MO k = ${selectedK}: ${nodes} node${nodes !== 1 ? 's' : ''} ${characterLabel}`,
            width / 2,
            20
        );

        // Legend
        const legendY = height - 18;
        const legendSpacing = 80;
        const legendX = width / 2 - legendSpacing;

        ctx.font = '10px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'left';

        // Positive
        ctx.fillStyle = isDark ? '#6b9eff' : '#3b82f6';
        ctx.beginPath();
        ctx.arc(legendX, legendY, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = mutedColor;
        ctx.fillText('Positive', legendX + 10, legendY + 4);

        // Negative
        ctx.fillStyle = isDark ? '#ff7b7b' : '#ef4444';
        ctx.beginPath();
        ctx.arc(legendX + legendSpacing, legendY, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = mutedColor;
        ctx.fillText('Negative', legendX + legendSpacing + 10, legendY + 4);
    }, [width, height, N, selectedK, showAtomLabels, showCoefficients, theme]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{
                borderRadius: '4px',
                border: `1px solid ${theme.border}`,
            }}
        />
    );
};

export default OrbitalDisplay;
