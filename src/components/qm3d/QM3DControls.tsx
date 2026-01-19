import React from 'react';
import Button from '../Button';
import {
    SliderWithInput,
    CollapsibleSection,
    type ControlTheme,
} from '../shared/controls';
import type { ColorMapType, RenderStyle } from './physics';

export interface QM3DControlsProps {
    // Color map
    colorMapType: ColorMapType;
    onColorMapChange: (type: ColorMapType) => void;

    // Render style
    renderStyle: RenderStyle;
    onRenderStyleChange: (style: RenderStyle) => void;

    // Visualization options
    densityScale: number;
    onDensityScaleChange: (scale: number) => void;
    opacityPower: number;
    onOpacityPowerChange: (power: number) => void;
    threshold: number;
    onThresholdChange: (threshold: number) => void;

    // Animation
    isAnimating: boolean;
    onIsAnimatingChange: (animating: boolean) => void;
    speed: number;
    onSpeedChange: (speed: number) => void;

    // Theme
    theme: ControlTheme;
}

export const QM3DControls: React.FC<QM3DControlsProps> = ({
    colorMapType,
    onColorMapChange,
    renderStyle,
    onRenderStyleChange,
    densityScale,
    onDensityScaleChange,
    opacityPower,
    onOpacityPowerChange,
    threshold,
    onThresholdChange,
    isAnimating,
    onIsAnimatingChange,
    speed,
    onSpeedChange,
    theme,
}) => {
    const colorMaps: { type: ColorMapType; label: string }[] = [
        { type: 'viridis', label: 'Viridis' },
        { type: 'plasma', label: 'Plasma' },
        { type: 'coolwarm', label: 'Cool-Warm' },
    ];

    const renderStyles: { style: RenderStyle; label: string }[] = [
        { style: 'colorful', label: 'Colorful' },
        { style: 'absorption', label: 'Absorption' },
    ];

    return (
        <div
            style={{
                backgroundColor: theme.surface || theme.inputBg,
                padding: '1rem',
                borderRadius: '8px',
                border: `1px solid ${theme.border}`,
                color: theme.text,
            }}
        >
            {/* Play/Pause button */}
            <div style={{ marginBottom: '1rem' }}>
                <Button
                    onClick={() => onIsAnimatingChange(!isAnimating)}
                    variant={isAnimating ? 'danger' : 'success'}
                    size="sm"
                    style={{ width: '100%' }}
                >
                    {isAnimating ? 'Pause' : 'Play'}
                </Button>
            </div>

            {/* Animation speed */}
            <CollapsibleSection
                title="Animation"
                defaultExpanded={true}
                theme={theme}
            >
                <SliderWithInput
                    label="Speed"
                    value={speed}
                    onChange={onSpeedChange}
                    min={0.1}
                    max={3}
                    step={0.1}
                    decimals={1}
                    unit="x"
                    theme={theme}
                />
            </CollapsibleSection>

            {/* Visualization options */}
            <CollapsibleSection
                title="Rendering"
                defaultExpanded={true}
                theme={theme}
            >
                {/* Render style selector */}
                <div style={{ marginBottom: '0.5rem' }}>
                    <div
                        style={{
                            fontSize: '0.75rem',
                            color: theme.textMuted,
                            marginBottom: '0.3rem',
                        }}
                    >
                        Style
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            border: `1px solid ${theme.border}`,
                        }}
                    >
                        {renderStyles.map(({ style, label }) => {
                            const isActive = renderStyle === style;
                            return (
                                <button
                                    key={style}
                                    onClick={() => onRenderStyleChange(style)}
                                    style={{
                                        flex: 1,
                                        padding: '0.4rem 0.3rem',
                                        border: 'none',
                                        backgroundColor: isActive
                                            ? (theme.accent || '#2563eb')
                                            : 'transparent',
                                        color: isActive ? '#fff' : theme.text,
                                        fontSize: '0.75rem',
                                        fontWeight: isActive ? 600 : 400,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <SliderWithInput
                    label="Density"
                    value={densityScale}
                    onChange={onDensityScaleChange}
                    min={0.5}
                    max={10}
                    step={0.5}
                    decimals={1}
                    unit="x"
                    theme={theme}
                />

                <SliderWithInput
                    label="Sharpness"
                    value={opacityPower}
                    onChange={onOpacityPowerChange}
                    min={0.2}
                    max={3}
                    step={0.1}
                    decimals={1}
                    unit=""
                    theme={theme}
                />

                <SliderWithInput
                    label="Threshold"
                    value={threshold}
                    onChange={onThresholdChange}
                    min={0}
                    max={0.5}
                    step={0.01}
                    decimals={2}
                    unit=""
                    theme={theme}
                />

                {/* Color map selector */}
                <div style={{ marginTop: '0.5rem' }}>
                    <div
                        style={{
                            fontSize: '0.75rem',
                            color: theme.textMuted,
                            marginBottom: '0.3rem',
                        }}
                    >
                        Color map
                    </div>
                    <select
                        value={colorMapType}
                        onChange={(e) =>
                            onColorMapChange(e.target.value as ColorMapType)
                        }
                        style={{
                            width: '100%',
                            padding: '0.4rem',
                            fontSize: '0.8rem',
                            border: `1px solid ${theme.border}`,
                            borderRadius: '4px',
                            backgroundColor: theme.inputBg,
                            color: theme.text,
                            cursor: 'pointer',
                        }}
                    >
                        {colorMaps.map(({ type, label }) => (
                            <option key={type} value={type}>
                                {label}
                            </option>
                        ))}
                    </select>
                </div>
            </CollapsibleSection>

            {/* Camera controls hint */}
            <div
                style={{
                    marginTop: '1rem',
                    padding: '0.5rem',
                    backgroundColor: theme.inputBg,
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    color: theme.textMuted,
                }}
            >
                <strong>Camera:</strong>
                <br />
                Drag to rotate, scroll to zoom
            </div>
        </div>
    );
};

export default QM3DControls;
