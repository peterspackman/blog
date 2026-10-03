import React from 'react';
import {
    SliderWithInput,
    CollapsibleSection,
    SegmentedControl,
    Select,
    ToggleSwitch,
    ControlGroup,
    ControlHint,
} from '../shared/controls';
import type { InputMode, PatternType, DisplayMode, ColormapType, PackShape, PackPacking } from './types';
import { GROUP_LIST } from './symmetry';

export interface FourierControlsProps {
    inputMode: InputMode;
    onInputModeChange: (mode: InputMode) => void;
    patternType: PatternType;
    onPatternTypeChange: (type: PatternType) => void;
    displayMode: DisplayMode;
    onDisplayModeChange: (mode: DisplayMode) => void;
    colormap: ColormapType;
    onColormapChange: (cmap: ColormapType) => void;
    gamma: number;
    onGammaChange: (g: number) => void;
    resolution: number;
    onResolutionChange: (n: number) => void;
    // Pattern params
    rectWidth: number;
    onRectWidthChange: (v: number) => void;
    rectHeight: number;
    onRectHeightChange: (v: number) => void;
    slitWidth: number;
    onSlitWidthChange: (v: number) => void;
    slitSeparation: number;
    onSlitSeparationChange: (v: number) => void;
    circleRadius: number;
    onCircleRadiusChange: (v: number) => void;
    gratingFrequency: number;
    onGratingFrequencyChange: (v: number) => void;
    gratingAngle: number;
    onGratingAngleChange: (v: number) => void;
    sigmaX: number;
    onSigmaXChange: (v: number) => void;
    sigmaY: number;
    onSigmaYChange: (v: number) => void;
    pointCount: number;
    onPointCountChange: (v: number) => void;
    pointSpacing: number;
    onPointSpacingChange: (v: number) => void;
    // Rhombus params
    rhombusWidth: number;
    onRhombusWidthChange: (v: number) => void;
    rhombusHeight: number;
    onRhombusHeightChange: (v: number) => void;
    // Packed shapes params
    packShape: PackShape;
    onPackShapeChange: (v: PackShape) => void;
    packPacking: PackPacking;
    onPackPackingChange: (v: PackPacking) => void;
    packElementSize: number;
    onPackElementSizeChange: (v: number) => void;
    packSpacing: number;
    onPackSpacingChange: (v: number) => void;
    packEnvelopeRadius: number;
    onPackEnvelopeRadiusChange: (v: number) => void;
    // Draw mode params
    wallpaperGroup: string;
    onWallpaperGroupChange: (g: string) => void;
    tiles: number;
    onTilesChange: (t: number) => void;
    symmetryEnabled: boolean;
    onSymmetryEnabledChange: (v: boolean) => void;
    brushRadius: number;
    onBrushRadiusChange: (r: number) => void;
    cellAngle: number;
    onCellAngleChange: (a: number) => void;
    cellRatio: number;
    onCellRatioChange: (r: number) => void;
}

const INPUT_MODES: { value: InputMode; label: string }[] = [
    { value: 'pattern', label: 'Pattern' },
    { value: 'draw', label: 'Draw' },
    { value: 'upload', label: 'Upload' },
];

export const PATTERN_TYPES: { value: PatternType; label: string }[] = [
    { value: 'rectangle', label: 'Rectangle' },
    { value: 'doubleSlit', label: 'Double slit' },
    { value: 'circle', label: 'Circle' },
    { value: 'grating', label: 'Grating' },
    { value: 'gaussian', label: 'Gaussian' },
    { value: 'pointSources', label: 'Point sources' },
    { value: 'rhombus', label: 'Rhombus' },
    { value: 'packedShapes', label: 'Packed shapes' },
];

const DISPLAY_MODES: { value: DisplayMode; label: string; title: string }[] = [
    { value: 'magnitude', label: '|F|', title: 'Magnitude (log scale)' },
    { value: 'phase', label: 'Phase', title: 'Phase arg F' },
    { value: 'real', label: 'Re', title: 'Real part' },
    { value: 'imaginary', label: 'Im', title: 'Imaginary part' },
];

const COLORMAPS: { value: ColormapType; label: string }[] = [
    { value: 'viridis', label: 'Viridis' },
    { value: 'inferno', label: 'Inferno' },
    { value: 'magma', label: 'Magma' },
];

const PACK_SHAPES: { value: PackShape; label: string }[] = [
    { value: 'circle', label: 'Circle' },
    { value: 'square', label: 'Square' },
    { value: 'rhombus', label: 'Rhombus' },
];

const PACKINGS: { value: PackPacking; label: string }[] = [
    { value: 'square', label: 'Square' },
    { value: 'hex', label: 'Hexagonal' },
];

const RESOLUTIONS: { value: number; label: string }[] = [
    { value: 256, label: '256²' },
    { value: 512, label: '512²' },
    { value: 1024, label: '1024²' },
];

export const FourierControls: React.FC<FourierControlsProps> = ({
    inputMode,
    onInputModeChange,
    patternType,
    onPatternTypeChange,
    displayMode,
    onDisplayModeChange,
    colormap,
    onColormapChange,
    gamma,
    onGammaChange,
    resolution,
    onResolutionChange,
    rectWidth,
    onRectWidthChange,
    rectHeight,
    onRectHeightChange,
    slitWidth,
    onSlitWidthChange,
    slitSeparation,
    onSlitSeparationChange,
    circleRadius,
    onCircleRadiusChange,
    gratingFrequency,
    onGratingFrequencyChange,
    gratingAngle,
    onGratingAngleChange,
    sigmaX,
    onSigmaXChange,
    sigmaY,
    onSigmaYChange,
    pointCount,
    onPointCountChange,
    pointSpacing,
    onPointSpacingChange,
    rhombusWidth,
    onRhombusWidthChange,
    rhombusHeight,
    onRhombusHeightChange,
    packShape,
    onPackShapeChange,
    packPacking,
    onPackPackingChange,
    packElementSize,
    onPackElementSizeChange,
    packSpacing,
    onPackSpacingChange,
    packEnvelopeRadius,
    onPackEnvelopeRadiusChange,
    wallpaperGroup,
    onWallpaperGroupChange,
    tiles,
    onTilesChange,
    symmetryEnabled,
    onSymmetryEnabledChange,
    brushRadius,
    onBrushRadiusChange,
    cellAngle,
    onCellAngleChange,
    cellRatio,
    onCellRatioChange,
}) => {
    return (
        <>
            <ControlGroup label="Input">
                <SegmentedControl aria-label="Input mode" value={inputMode} onChange={onInputModeChange} options={INPUT_MODES} />

                {inputMode === 'pattern' && (
                    <>
                        <Select aria-label="Pattern" value={patternType} onChange={onPatternTypeChange} options={PATTERN_TYPES} />
                        {patternType === 'rectangle' && (
                            <>
                                <SliderWithInput label="Width" value={rectWidth} onChange={onRectWidthChange} min={0.02} max={0.5} step={0.01} />
                                <SliderWithInput label="Height" value={rectHeight} onChange={onRectHeightChange} min={0.02} max={0.5} step={0.01} />
                            </>
                        )}
                        {patternType === 'doubleSlit' && (
                            <>
                                <SliderWithInput label="Slit width" value={slitWidth} onChange={onSlitWidthChange} min={0.01} max={0.1} step={0.005} decimals={3} />
                                <SliderWithInput label="Separation" value={slitSeparation} onChange={onSlitSeparationChange} min={0.05} max={0.4} step={0.01} />
                            </>
                        )}
                        {patternType === 'circle' && (
                            <SliderWithInput label="Radius" value={circleRadius} onChange={onCircleRadiusChange} min={0.02} max={0.5} step={0.01} />
                        )}
                        {patternType === 'grating' && (
                            <>
                                <SliderWithInput label="Frequency" value={gratingFrequency} onChange={onGratingFrequencyChange} min={2} max={40} step={1} decimals={0} />
                                <SliderWithInput label="Angle" value={gratingAngle} onChange={onGratingAngleChange} min={0} max={180} step={1} decimals={0} unit="°" />
                            </>
                        )}
                        {patternType === 'gaussian' && (
                            <>
                                <SliderWithInput label="σ (x)" value={sigmaX} onChange={onSigmaXChange} min={0.02} max={0.3} step={0.01} />
                                <SliderWithInput label="σ (y)" value={sigmaY} onChange={onSigmaYChange} min={0.02} max={0.3} step={0.01} />
                            </>
                        )}
                        {patternType === 'pointSources' && (
                            <>
                                <SliderWithInput label="Count" value={pointCount} onChange={onPointCountChange} min={1} max={8} step={1} decimals={0} />
                                <SliderWithInput label="Spacing" value={pointSpacing} onChange={onPointSpacingChange} min={0.05} max={0.4} step={0.01} />
                            </>
                        )}
                        {patternType === 'rhombus' && (
                            <>
                                <SliderWithInput label="Width" value={rhombusWidth} onChange={onRhombusWidthChange} min={0.05} max={0.8} step={0.01} />
                                <SliderWithInput label="Height" value={rhombusHeight} onChange={onRhombusHeightChange} min={0.05} max={0.8} step={0.01} />
                            </>
                        )}
                        {patternType === 'packedShapes' && (
                            <>
                                <SegmentedControl aria-label="Element shape" value={packShape} onChange={onPackShapeChange} options={PACK_SHAPES} />
                                <SegmentedControl aria-label="Packing" value={packPacking} onChange={onPackPackingChange} options={PACKINGS} />
                                <SliderWithInput label="Element size" value={packElementSize} onChange={onPackElementSizeChange} min={0.01} max={0.1} step={0.005} decimals={3} />
                                <SliderWithInput label="Spacing" value={packSpacing} onChange={onPackSpacingChange} min={0.03} max={0.2} step={0.005} decimals={3} />
                                <SliderWithInput label="Envelope radius" value={packEnvelopeRadius} onChange={onPackEnvelopeRadiusChange} min={0.1} max={0.5} step={0.01} />
                            </>
                        )}
                    </>
                )}

                {inputMode === 'draw' && (
                    <>
                        <ControlHint>Paint on the input; strokes repeat across the tiled cell.</ControlHint>
                        <SliderWithInput label="Brush size" value={brushRadius} onChange={onBrushRadiusChange} min={1} max={12} step={1} decimals={0} />
                        <SliderWithInput label="Tiles" value={tiles} onChange={onTilesChange} min={1} max={12} step={1} decimals={0} />
                    </>
                )}

                {inputMode === 'upload' && <ControlHint>Click the input panel to choose an image file.</ControlHint>}
            </ControlGroup>

            {inputMode === 'draw' && (
                <ControlGroup label="Symmetry">
                    <ToggleSwitch label="Apply wallpaper symmetry" checked={symmetryEnabled} onChange={onSymmetryEnabledChange} />
                    {symmetryEnabled && (
                        <Select
                            aria-label="Wallpaper group"
                            value={wallpaperGroup}
                            onChange={onWallpaperGroupChange}
                            options={GROUP_LIST.map((g) => ({ value: g, label: g }))}
                        />
                    )}
                    <SliderWithInput label="Cell angle" value={cellAngle} onChange={onCellAngleChange} min={45} max={135} step={1} decimals={0} unit="°" />
                    <SliderWithInput label="Cell ratio" value={cellRatio} onChange={onCellRatioChange} min={0.3} max={3.0} step={0.05} />
                </ControlGroup>
            )}

            <ControlGroup label="Transform display">
                <SegmentedControl aria-label="Quantity" value={displayMode} onChange={onDisplayModeChange} options={DISPLAY_MODES} />
                <SegmentedControl aria-label="Colour map" value={colormap} onChange={onColormapChange} options={COLORMAPS} />
                <SliderWithInput label="Gamma" value={gamma} onChange={onGammaChange} min={0.1} max={3.0} step={0.05} />
            </ControlGroup>

            <CollapsibleSection title="Resolution">
                <SegmentedControl<number> aria-label="FFT size" value={resolution} onChange={onResolutionChange} options={RESOLUTIONS} />
                <ControlHint>Grid size of the FFT. Larger grids resolve finer detail but update more slowly.</ControlHint>
            </CollapsibleSection>
        </>
    );
};
