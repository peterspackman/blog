import React, { useRef, useEffect } from 'react';
import type { DisplayMode, ColorMapType } from './physics';
import { setupHiDPICanvas, type VizTheme } from '../shared/viz';

// Color map definitions
const COLOR_MAPS: Record<ColorMapType, number[][]> = {
    viridis: [
        [68, 1, 84],
        [72, 40, 120],
        [62, 74, 137],
        [49, 104, 142],
        [38, 130, 142],
        [31, 158, 137],
        [53, 183, 121],
        [109, 205, 89],
        [180, 222, 44],
        [253, 231, 37],
    ],
    plasma: [
        [13, 8, 135],
        [75, 3, 161],
        [125, 3, 168],
        [168, 34, 150],
        [203, 70, 121],
        [229, 107, 93],
        [248, 148, 65],
        [253, 195, 40],
        [240, 249, 33],
    ],
    coolwarm: [
        [59, 76, 192],
        [98, 130, 234],
        [141, 176, 254],
        [184, 208, 249],
        [221, 221, 221],
        [245, 196, 173],
        [244, 154, 123],
        [222, 96, 77],
        [180, 4, 38],
    ],
};

function interpolateColor(colorMap: number[][], value: number): string {
    const clampedValue = Math.max(0, Math.min(1, value));
    const pos = clampedValue * (colorMap.length - 1);
    const index = Math.floor(pos);
    const fraction = pos - index;

    if (index >= colorMap.length - 1) {
        const [r, g, b] = colorMap[colorMap.length - 1];
        return `rgb(${r}, ${g}, ${b})`;
    }

    const [r1, g1, b1] = colorMap[index];
    const [r2, g2, b2] = colorMap[index + 1];

    const r = Math.round(r1 + fraction * (r2 - r1));
    const g = Math.round(g1 + fraction * (g2 - g1));
    const b = Math.round(b1 + fraction * (b2 - b1));

    return `rgb(${r}, ${g}, ${b})`;
}

export interface ColorScaleProps {
    width: number;
    height?: number;
    colorMapType: ColorMapType;
    displayMode: DisplayMode;
    theme: VizTheme;
}

export const ColorScale: React.FC<ColorScaleProps> = ({
    width,
    height = 24,
    colorMapType,
    displayMode,
    theme,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const ctx = setupHiDPICanvas(canvasRef.current, width, height);
        if (!ctx) return;

        const colorMap = COLOR_MAPS[colorMapType];

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw gradient
        for (let i = 0; i < width; i++) {
            const value = i / width;
            ctx.fillStyle = interpolateColor(colorMap, value);
            ctx.fillRect(i, 0, 1, height);
        }

        // Draw zero marker for real/imaginary parts
        if (displayMode === 'real' || displayMode === 'imaginary') {
            ctx.strokeStyle = theme.page;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(width / 2, 0);
            ctx.lineTo(width / 2, height);
            ctx.stroke();
        }
    }, [width, height, colorMapType, displayMode, theme]);

    const labelStyle: React.CSSProperties = {
        fontSize: 'var(--viz-font-xs)',
        fontFamily: 'var(--ifm-font-family-monospace)',
        color: 'var(--viz-muted)',
    };

    return (
        <div style={{ width }}>
            <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 'var(--viz-radius-sm)' }} />
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '4px',
                }}
            >
                {displayMode === 'probability' ? (
                    <>
                        <span style={labelStyle}>0</span>
                        <span style={{ ...labelStyle, fontFamily: 'inherit' }}>|ψ|²</span>
                        <span style={labelStyle}>max</span>
                    </>
                ) : (
                    <>
                        <span style={labelStyle}>−max</span>
                        <span style={labelStyle}>0</span>
                        <span style={labelStyle}>+max</span>
                    </>
                )}
            </div>
        </div>
    );
};

export default ColorScale;
