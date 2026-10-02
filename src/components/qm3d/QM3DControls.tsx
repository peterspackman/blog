import React from 'react';
import { SliderWithInput, SegmentedControl, Select, VizButton, ControlGroup, ControlHint } from '../shared/controls';
import type { ColorMapType, RenderStyle } from './physics';

export interface QM3DControlsProps {
    colorMapType: ColorMapType;
    onColorMapChange: (type: ColorMapType) => void;
    renderStyle: RenderStyle;
    onRenderStyleChange: (style: RenderStyle) => void;
    densityScale: number;
    onDensityScaleChange: (scale: number) => void;
    opacityPower: number;
    onOpacityPowerChange: (power: number) => void;
    threshold: number;
    onThresholdChange: (threshold: number) => void;
    isAnimating: boolean;
    onIsAnimatingChange: (animating: boolean) => void;
    speed: number;
    onSpeedChange: (speed: number) => void;
    onResetTime: () => void;
}

const COLOR_MAPS: { value: ColorMapType; label: string }[] = [
    { value: 'viridis', label: 'Viridis' },
    { value: 'plasma', label: 'Plasma' },
    { value: 'coolwarm', label: 'Cool–warm (diverging)' },
];

const RENDER_STYLES: { value: RenderStyle; label: string; title: string }[] = [
    { value: 'colorful', label: 'Emissive', title: 'Glowing cloud coloured by the colour map' },
    { value: 'absorption', label: 'Absorption', title: 'Dark cloud on a white background, like ink' },
];

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
    onResetTime,
}) => (
    <>
        <ControlGroup label="Rendering">
            <SegmentedControl aria-label="Render style" value={renderStyle} onChange={onRenderStyleChange} options={RENDER_STYLES} />
            {renderStyle === 'colorful' && (
                <Select label="Colour map" value={colorMapType} onChange={onColorMapChange} options={COLOR_MAPS} />
            )}
            <SliderWithInput label="Density" value={densityScale} onChange={onDensityScaleChange} min={0.5} max={10} step={0.5} decimals={1} />
            <SliderWithInput label="Sharpness" value={opacityPower} onChange={onOpacityPowerChange} min={0.2} max={3} step={0.1} decimals={1} />
            <SliderWithInput label="Threshold" value={threshold} onChange={onThresholdChange} min={0} max={0.5} step={0.01} decimals={2} />
        </ControlGroup>

        <ControlGroup label="Time">
            <div style={{ display: 'flex', gap: '0.375rem' }}>
                <VizButton variant="primary" style={{ flex: 1 }} onClick={() => onIsAnimatingChange(!isAnimating)}>
                    {isAnimating ? 'Pause' : 'Play'}
                </VizButton>
                <VizButton variant="secondary" onClick={onResetTime}>
                    Reset t
                </VizButton>
            </div>
            <SliderWithInput label="Speed" value={speed} onChange={onSpeedChange} min={0.1} max={3} step={0.1} decimals={1} unit="×" />
        </ControlGroup>

        <ControlHint>Drag to rotate, scroll or pinch to zoom.</ControlHint>
    </>
);

export default QM3DControls;
