import React from 'react';
import Button from '../Button';
import {
    SliderWithInput,
    CollapsibleSection,
    ToggleSwitch,
    type ControlTheme,
} from '../shared/controls';
import {
    type DisplayMode,
    type ColorMapType,
} from './physics';

export interface QM2DControlsProps {
    // Display mode
    displayMode: DisplayMode;
    onDisplayModeChange: (mode: DisplayMode) => void;

    // Color map
    colorMapType: ColorMapType;
    onColorMapChange: (type: ColorMapType) => void;

    // Visualization options
    showContours: boolean;
    onShowContoursChange: (show: boolean) => void;

    // Animation
    isAnimating: boolean;
    onIsAnimatingChange: (animating: boolean) => void;
    speed: number;
    onSpeedChange: (speed: number) => void;

    // Theme
    theme: ControlTheme;
}

export const QM2DControls: React.FC<QM2DControlsProps> = (props) => {
    const {
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
        theme,
    } = props;

    const displayModes: { mode: DisplayMode; label: string }[] = [
        { mode: 'probability', label: '|ψ|²' },
        { mode: 'real', label: 'Re(ψ)' },
        { mode: 'imaginary', label: 'Im(ψ)' },
    ];

    const colorMaps: { type: ColorMapType; label: string }[] = [
        { type: 'viridis', label: 'Viridis' },
        { type: 'plasma', label: 'Plasma' },
        { type: 'coolwarm', label: 'Cool-Warm' },
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
            {/* Display mode tabs */}
            <div style={{ marginBottom: '1rem' }}>
                <div
                    style={{
                        fontSize: '0.7rem',
                        fontWeight: 500,
                        color: theme.textMuted,
                        marginBottom: '0.4rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                    }}
                >
                    Display
                </div>
                <div
                    style={{
                        display: 'flex',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        border: `1px solid ${theme.border}`,
                    }}
                >
                    {displayModes.map(({ mode, label }) => {
                        const isActive = displayMode === mode;
                        return (
                            <button
                                key={mode}
                                onClick={() => onDisplayModeChange(mode)}
                                style={{
                                    flex: 1,
                                    padding: '0.5rem 0.3rem',
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
            <CollapsibleSection title="Animation" defaultExpanded={true} theme={theme}>
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
            <CollapsibleSection title="Options" defaultExpanded={true} theme={theme}>
                <ToggleSwitch
                    label="Contour lines"
                    checked={showContours}
                    onChange={onShowContoursChange}
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
                        onChange={(e) => onColorMapChange(e.target.value as ColorMapType)}
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

        </div>
    );
};

export default QM2DControls;
