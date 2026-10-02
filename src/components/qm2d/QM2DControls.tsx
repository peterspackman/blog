import React from 'react';
import {
    SliderWithInput,
    ToggleSwitch,
    SegmentedControl,
    Select,
    VizButton,
    ControlGroup,
} from '../shared/controls';
import { type DisplayMode, type ColorMapType } from './physics';

export interface QM2DControlsProps {
    displayMode: DisplayMode;
    onDisplayModeChange: (mode: DisplayMode) => void;
    colorMapType: ColorMapType;
    onColorMapChange: (type: ColorMapType) => void;
    showContours: boolean;
    onShowContoursChange: (show: boolean) => void;
    isAnimating: boolean;
    onIsAnimatingChange: (animating: boolean) => void;
    speed: number;
    onSpeedChange: (speed: number) => void;
    onResetTime: () => void;
}

const DISPLAY_MODES: { value: DisplayMode; label: string }[] = [
    { value: 'probability', label: '|ψ|²' },
    { value: 'real', label: 'Re ψ' },
    { value: 'imaginary', label: 'Im ψ' },
];

const COLOR_MAPS: { value: ColorMapType; label: string }[] = [
    { value: 'viridis', label: 'Viridis' },
    { value: 'plasma', label: 'Plasma' },
    { value: 'coolwarm', label: 'Cool–warm (diverging)' },
];

export const QM2DControls: React.FC<QM2DControlsProps> = ({
    displayMode,
    onDisplayModeChange,
    colorMapType,
    onColorMapChange,
    showContours,
    onShowContoursChange,
    isAnimating,
    onIsAnimatingChange,
    speed,
    onSpeedChange,
    onResetTime,
}) => (
    <>
        <ControlGroup label="Show">
            <SegmentedControl aria-label="Quantity" value={displayMode} onChange={onDisplayModeChange} options={DISPLAY_MODES} />
            <Select label="Colour map" value={colorMapType} onChange={onColorMapChange} options={COLOR_MAPS} />
            <ToggleSwitch label="Contour lines" checked={showContours} onChange={onShowContoursChange} />
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
    </>
);

export default QM2DControls;
