import React, { useRef, useEffect, useCallback } from 'react';
import type { EnergyLevel, HuckelParams, FermiInfo } from './physics';
import { getOrbitalColor, formatEnergy } from './physics';
import type { ControlTheme } from '../shared/controls';

export interface EnergyLevelsProps {
    width: number;
    height: number;
    energyLevels: EnergyLevel[];
    selectedK: number | null;
    onSelectK: (k: number) => void;
    params: HuckelParams;
    energyRange: { min: number; max: number };
    fermiInfo?: FermiInfo;
    electronCount?: number;
    theme: ControlTheme;
}

export const EnergyLevels: React.FC<EnergyLevelsProps> = ({
    width,
    height,
    energyLevels,
    selectedK,
    onSelectK,
    params,
    energyRange,
    fermiInfo,
    electronCount,
    theme,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Margins for axes and labels
    const margin = { top: 20, right: 15, bottom: 30, left: 55 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    // Convert energy to y position
    const energyToY = useCallback(
        (energy: number) => {
            const t = (energy - energyRange.min) / (energyRange.max - energyRange.min);
            return margin.top + plotHeight * (1 - t); // Invert so higher energy is at top
        },
        [energyRange, margin.top, plotHeight]
    );

    // Convert y position to energy (for click detection)
    const yToEnergy = useCallback(
        (y: number) => {
            const t = 1 - (y - margin.top) / plotHeight;
            return energyRange.min + t * (energyRange.max - energyRange.min);
        },
        [energyRange, margin.top, plotHeight]
    );

    // Draw the energy level diagram
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const isDark = theme.text.startsWith('#e') || theme.text.startsWith('#f');
        const bgColor = theme.surface || theme.inputBg;
        const axisColor = theme.textMuted;
        const textColor = theme.text;

        // Clear canvas
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);

        // Draw y-axis
        ctx.strokeStyle = axisColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(margin.left, margin.top);
        ctx.lineTo(margin.left, height - margin.bottom);
        ctx.stroke();

        // Draw y-axis ticks and labels
        const numTicks = 5;
        ctx.fillStyle = textColor;
        ctx.font = '11px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        for (let i = 0; i <= numTicks; i++) {
            const t = i / numTicks;
            const energy = energyRange.min + t * (energyRange.max - energyRange.min);
            const y = energyToY(energy);

            // Tick mark
            ctx.beginPath();
            ctx.moveTo(margin.left - 4, y);
            ctx.lineTo(margin.left, y);
            ctx.stroke();

            // Label
            ctx.fillText(energy.toFixed(1), margin.left - 8, y);
        }

        // Y-axis title
        ctx.save();
        ctx.translate(14, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = textColor;
        ctx.font = '12px "Segoe UI", system-ui, sans-serif';
        ctx.fillText('Energy (eV)', 0, 0);
        ctx.restore();

        // Draw α reference line (typically 0)
        const alphaY = energyToY(params.alpha);
        if (alphaY > margin.top && alphaY < height - margin.bottom) {
            ctx.strokeStyle = isDark ? 'rgba(150,150,150,0.3)' : 'rgba(0,0,0,0.15)';
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(margin.left, alphaY);
            ctx.lineTo(width - margin.right, alphaY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Label for α
            ctx.fillStyle = theme.textMuted;
            ctx.font = '10px "Segoe UI", system-ui, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('α', width - margin.right + 4, alphaY);
        }

        // Draw Fermi level if provided
        if (fermiInfo && electronCount !== undefined && electronCount > 0) {
            const fermiY = energyToY(fermiInfo.fermiEnergy);
            if (fermiY > margin.top && fermiY < height - margin.bottom) {
                ctx.strokeStyle = isDark ? '#22c55e' : '#16a34a'; // Green
                ctx.lineWidth = 2;
                ctx.setLineDash([8, 4]);
                ctx.beginPath();
                ctx.moveTo(margin.left, fermiY);
                ctx.lineTo(width - margin.right, fermiY);
                ctx.stroke();
                ctx.setLineDash([]);

                // Label for Fermi level
                ctx.fillStyle = isDark ? '#22c55e' : '#16a34a';
                ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText('E_F', width - margin.right + 4, fermiY);
            }
        }

        // Draw energy levels as horizontal lines
        const lineWidth = Math.min(plotWidth * 0.75, 180);
        const lineX = margin.left + (plotWidth - lineWidth) / 2;

        // Determine occupied levels (each orbital holds 2 electrons)
        const occupiedLevels = electronCount !== undefined
            ? Math.ceil(electronCount / 2)
            : energyLevels.length;

        energyLevels.forEach((level, index) => {
            const y = energyToY(level.energy);
            const color = getOrbitalColor(level.k, params.N);
            const isSelected = level.k === selectedK;
            const isOccupied = index < occupiedLevels;

            // Draw line - solid for occupied, dashed for unoccupied
            ctx.strokeStyle = color;
            ctx.lineWidth = isSelected ? 4 : 2;
            ctx.lineCap = 'round';

            if (!isOccupied && electronCount !== undefined) {
                ctx.setLineDash([6, 4]);
                ctx.globalAlpha = 0.5;
            } else {
                ctx.setLineDash([]);
                ctx.globalAlpha = 1;
            }

            ctx.beginPath();
            ctx.moveTo(lineX, y);
            ctx.lineTo(lineX + lineWidth, y);
            ctx.stroke();

            ctx.setLineDash([]);
            ctx.globalAlpha = 1;

            // Draw occupation indicators (electrons as small circles)
            if (electronCount !== undefined && isOccupied) {
                const electronRadius = 4;
                const centerX = lineX + lineWidth + 12;

                // Check if this is a partially filled level (last occupied with odd electron count)
                const isPartiallyFilled = index === occupiedLevels - 1 && electronCount % 2 === 1;

                // Draw up to 2 electrons
                ctx.fillStyle = isDark ? '#fbbf24' : '#d97706'; // Amber for electrons

                // First electron (spin up)
                ctx.beginPath();
                ctx.arc(centerX, y - 3, electronRadius, 0, 2 * Math.PI);
                ctx.fill();

                // Second electron (spin down) if not partially filled
                if (!isPartiallyFilled) {
                    ctx.beginPath();
                    ctx.arc(centerX, y + 3, electronRadius, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }

            // Draw selection indicator
            if (isSelected) {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(lineX - 8, y, 4, 0, 2 * Math.PI);
                ctx.fill();
            }
        });

        // Title with band gap info
        ctx.fillStyle = textColor;
        ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';

        let title = `N = ${params.N} atoms`;
        if (params.alternation && params.alternation > 0) {
            title += ` (gap: ${fermiInfo?.bandGap?.toFixed(2) || '?'} eV)`;
        }
        ctx.fillText(title, width / 2, 14);

        // Selected state info
        if (selectedK !== null) {
            const selectedLevel = energyLevels.find((l) => l.k === selectedK);
            if (selectedLevel) {
                ctx.fillStyle = theme.textMuted;
                ctx.font = '10px "Segoe UI", system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(
                    `k=${selectedK}: ${formatEnergy(selectedLevel.energy)}`,
                    width / 2,
                    height - 8
                );
            }
        }
    }, [
        width,
        height,
        energyLevels,
        selectedK,
        params,
        energyRange,
        fermiInfo,
        electronCount,
        theme,
        energyToY,
    ]);

    // Handle click to select orbital
    const handleClick = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;

            // Check if click is in the plot area
            if (
                x < margin.left ||
                x > width - margin.right ||
                y < margin.top ||
                y > height - margin.bottom
            ) {
                return;
            }

            // Find closest energy level
            const clickEnergy = yToEnergy(y);
            let closestLevel: EnergyLevel | null = null;
            let minDist = Infinity;

            for (const level of energyLevels) {
                const dist = Math.abs(level.energy - clickEnergy);
                if (dist < minDist) {
                    minDist = dist;
                    closestLevel = level;
                }
            }

            // Only select if within reasonable distance (0.3 eV)
            if (closestLevel && minDist < 0.3) {
                onSelectK(closestLevel.k);
            }
        },
        [width, height, margin, energyLevels, yToEnergy, onSelectK]
    );

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            onClick={handleClick}
            style={{
                cursor: 'pointer',
                borderRadius: '4px',
                border: `1px solid ${theme.border}`,
            }}
        />
    );
};

export default EnergyLevels;
