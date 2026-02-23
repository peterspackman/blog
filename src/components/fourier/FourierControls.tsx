import React from 'react';
import {
    SliderWithInput,
    CollapsibleSection,
    type ControlTheme,
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
    theme: ControlTheme;
}

const INPUT_MODES: { value: InputMode; label: string }[] = [
    { value: 'pattern', label: 'Pattern' },
    { value: 'draw', label: 'Draw' },
    { value: 'upload', label: 'Upload' },
];

const PATTERN_TYPES: { value: PatternType; label: string }[] = [
    { value: 'rectangle', label: 'Rectangle' },
    { value: 'doubleSlit', label: 'Double Slit' },
    { value: 'circle', label: 'Circle' },
    { value: 'grating', label: 'Grating' },
    { value: 'gaussian', label: 'Gaussian' },
    { value: 'pointSources', label: 'Point Sources' },
    { value: 'rhombus', label: 'Rhombus' },
    { value: 'packedShapes', label: 'Packed Shapes' },
];

const DISPLAY_MODES: { value: DisplayMode; label: string }[] = [
    { value: 'magnitude', label: '|F|' },
    { value: 'phase', label: 'Phase' },
    { value: 'real', label: 'Re' },
    { value: 'imaginary', label: 'Im' },
];

const COLORMAPS: { value: ColormapType; label: string }[] = [
    { value: 'viridis', label: 'Viridis' },
    { value: 'inferno', label: 'Inferno' },
    { value: 'magma', label: 'Magma' },
];

const selectStyle = (theme: ControlTheme): React.CSSProperties => ({
    width: '100%',
    padding: '0.3rem 0.4rem',
    fontSize: '0.8rem',
    border: `1px solid ${theme.border}`,
    borderRadius: '3px',
    backgroundColor: theme.inputBg,
    color: theme.text,
    marginBottom: '0.6rem',
});

const buttonGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: '2px',
    marginBottom: '0.6rem',
};

const buttonStyle = (active: boolean, theme: ControlTheme): React.CSSProperties => ({
    flex: 1,
    padding: '0.3rem 0.4rem',
    fontSize: '0.7rem',
    fontWeight: 500,
    border: 'none',
    borderRadius: '3px',
    backgroundColor: active ? (theme.accent || '#2563eb') : (theme.inputBg),
    color: active ? '#fff' : theme.text,
    cursor: 'pointer',
});

const labelStyle = (theme: ControlTheme): React.CSSProperties => ({
    fontSize: '0.75rem',
    color: theme.textMuted,
    marginBottom: '0.25rem',
    display: 'block',
});

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
    theme,
}) => {
    return (
        <div style={{
            padding: '0.6rem',
            fontSize: '0.85rem',
            color: theme.text,
            backgroundColor: theme.background || theme.surface,
            borderRadius: '6px',
            border: `1px solid ${theme.border}`,
        }}>
            {/* Input Section */}
            <div style={{ marginBottom: '0.75rem' }}>
                <span style={labelStyle(theme)}>Input Mode</span>
                <div style={buttonGroupStyle}>
                    {INPUT_MODES.map(m => (
                        <button
                            key={m.value}
                            style={buttonStyle(inputMode === m.value, theme)}
                            onClick={() => onInputModeChange(m.value)}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>

                {inputMode === 'pattern' && (
                    <>
                        <span style={labelStyle(theme)}>Pattern</span>
                        <select
                            value={patternType}
                            onChange={e => onPatternTypeChange(e.target.value as PatternType)}
                            style={selectStyle(theme)}
                        >
                            {PATTERN_TYPES.map(p => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                        </select>

                        {/* Pattern-specific sliders */}
                        {patternType === 'rectangle' && (
                            <>
                                <SliderWithInput label="Width" value={rectWidth} onChange={onRectWidthChange} min={0.02} max={0.5} step={0.01} theme={theme} />
                                <SliderWithInput label="Height" value={rectHeight} onChange={onRectHeightChange} min={0.02} max={0.5} step={0.01} theme={theme} />
                            </>
                        )}
                        {patternType === 'doubleSlit' && (
                            <>
                                <SliderWithInput label="Slit Width" value={slitWidth} onChange={onSlitWidthChange} min={0.01} max={0.1} step={0.005} decimals={3} theme={theme} />
                                <SliderWithInput label="Separation" value={slitSeparation} onChange={onSlitSeparationChange} min={0.05} max={0.4} step={0.01} theme={theme} />
                            </>
                        )}
                        {patternType === 'circle' && (
                            <SliderWithInput label="Radius" value={circleRadius} onChange={onCircleRadiusChange} min={0.02} max={0.5} step={0.01} theme={theme} />
                        )}
                        {patternType === 'grating' && (
                            <>
                                <SliderWithInput label="Frequency" value={gratingFrequency} onChange={onGratingFrequencyChange} min={2} max={40} step={1} decimals={0} theme={theme} />
                                <SliderWithInput label="Angle" value={gratingAngle} onChange={onGratingAngleChange} min={0} max={180} step={1} decimals={0} unit="deg" theme={theme} />
                            </>
                        )}
                        {patternType === 'gaussian' && (
                            <>
                                <SliderWithInput label="Sigma X" value={sigmaX} onChange={onSigmaXChange} min={0.02} max={0.3} step={0.01} theme={theme} />
                                <SliderWithInput label="Sigma Y" value={sigmaY} onChange={onSigmaYChange} min={0.02} max={0.3} step={0.01} theme={theme} />
                            </>
                        )}
                        {patternType === 'pointSources' && (
                            <>
                                <SliderWithInput label="Count" value={pointCount} onChange={onPointCountChange} min={1} max={8} step={1} decimals={0} theme={theme} />
                                <SliderWithInput label="Spacing" value={pointSpacing} onChange={onPointSpacingChange} min={0.05} max={0.4} step={0.01} theme={theme} />
                            </>
                        )}
                        {patternType === 'rhombus' && (
                            <>
                                <SliderWithInput label="Width" value={rhombusWidth} onChange={onRhombusWidthChange} min={0.05} max={0.8} step={0.01} theme={theme} />
                                <SliderWithInput label="Height" value={rhombusHeight} onChange={onRhombusHeightChange} min={0.05} max={0.8} step={0.01} theme={theme} />
                            </>
                        )}
                        {patternType === 'packedShapes' && (
                            <>
                                <span style={labelStyle(theme)}>Shape</span>
                                <div style={buttonGroupStyle}>
                                    {(['circle', 'square', 'rhombus'] as PackShape[]).map(s => (
                                        <button
                                            key={s}
                                            style={buttonStyle(packShape === s, theme)}
                                            onClick={() => onPackShapeChange(s)}
                                        >
                                            {s[0].toUpperCase() + s.slice(1)}
                                        </button>
                                    ))}
                                </div>
                                <span style={labelStyle(theme)}>Packing</span>
                                <div style={buttonGroupStyle}>
                                    {(['square', 'hex'] as PackPacking[]).map(p => (
                                        <button
                                            key={p}
                                            style={buttonStyle(packPacking === p, theme)}
                                            onClick={() => onPackPackingChange(p)}
                                        >
                                            {p[0].toUpperCase() + p.slice(1)}
                                        </button>
                                    ))}
                                </div>
                                <SliderWithInput label="Element Size" value={packElementSize} onChange={onPackElementSizeChange} min={0.01} max={0.1} step={0.005} decimals={3} theme={theme} />
                                <SliderWithInput label="Spacing" value={packSpacing} onChange={onPackSpacingChange} min={0.03} max={0.2} step={0.005} decimals={3} theme={theme} />
                                <SliderWithInput label="Envelope Radius" value={packEnvelopeRadius} onChange={onPackEnvelopeRadiusChange} min={0.1} max={0.5} step={0.01} theme={theme} />
                            </>
                        )}
                    </>
                )}

                {inputMode === 'draw' && (
                    <>
                        <SliderWithInput
                            label="Tiles"
                            value={tiles}
                            onChange={onTilesChange}
                            min={1}
                            max={12}
                            step={1}
                            decimals={0}
                            theme={theme}
                        />
                        <SliderWithInput
                            label="Brush Size"
                            value={brushRadius}
                            onChange={onBrushRadiusChange}
                            min={1}
                            max={12}
                            step={1}
                            decimals={0}
                            theme={theme}
                        />
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.8rem',
                            color: theme.text,
                            cursor: 'pointer',
                            marginBottom: '0.5rem',
                        }}>
                            <input
                                type="checkbox"
                                checked={symmetryEnabled}
                                onChange={e => onSymmetryEnabledChange(e.target.checked)}
                                style={{ accentColor: theme.accent || '#2563eb' }}
                            />
                            Apply symmetry
                        </label>
                        {symmetryEnabled && (
                            <>
                                <span style={labelStyle(theme)}>Wallpaper Group</span>
                                <select
                                    value={wallpaperGroup}
                                    onChange={e => onWallpaperGroupChange(e.target.value)}
                                    style={selectStyle(theme)}
                                >
                                    {GROUP_LIST.map(g => (
                                        <option key={g} value={g}>{g}</option>
                                    ))}
                                </select>
                            </>
                        )}
                        <SliderWithInput
                            label="Cell Angle"
                            value={cellAngle}
                            onChange={onCellAngleChange}
                            min={45}
                            max={135}
                            step={1}
                            decimals={0}
                            unit="°"
                            theme={theme}
                        />
                        <SliderWithInput
                            label="Cell Ratio"
                            value={cellRatio}
                            onChange={onCellRatioChange}
                            min={0.3}
                            max={3.0}
                            step={0.05}
                            theme={theme}
                        />
                    </>
                )}

                {inputMode === 'upload' && (
                    <p style={{ fontSize: '0.75rem', color: theme.textMuted, margin: '0.25rem 0' }}>
                        Click the left panel to choose an image file.
                    </p>
                )}
            </div>

            {/* Display Section */}
            <div style={{ marginBottom: '0.75rem' }}>
                <span style={labelStyle(theme)}>FT Display</span>
                <div style={buttonGroupStyle}>
                    {DISPLAY_MODES.map(m => (
                        <button
                            key={m.value}
                            style={buttonStyle(displayMode === m.value, theme)}
                            onClick={() => onDisplayModeChange(m.value)}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>

                <span style={labelStyle(theme)}>Colormap</span>
                <div style={buttonGroupStyle}>
                    {COLORMAPS.map(c => (
                        <button
                            key={c.value}
                            style={buttonStyle(colormap === c.value, theme)}
                            onClick={() => onColormapChange(c.value)}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>

                <SliderWithInput
                    label="Gamma"
                    value={gamma}
                    onChange={onGammaChange}
                    min={0.1}
                    max={3.0}
                    step={0.05}
                    theme={theme}
                />
            </div>

            {/* Resolution (collapsed) */}
            <CollapsibleSection title="Resolution" theme={theme}>
                <span style={labelStyle(theme)}>FFT Size</span>
                <div style={buttonGroupStyle}>
                    <button
                        style={buttonStyle(resolution === 256, theme)}
                        onClick={() => onResolutionChange(256)}
                    >
                        256x256
                    </button>
                    <button
                        style={buttonStyle(resolution === 512, theme)}
                        onClick={() => onResolutionChange(512)}
                    >
                        512x512
                    </button>
                </div>
            </CollapsibleSection>
        </div>
    );
};
