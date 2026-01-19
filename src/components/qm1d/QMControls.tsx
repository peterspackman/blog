import React from 'react';
import Button from '../Button';
import LegendItem from '../LegendItem';
import {
    SliderWithInput,
    CollapsibleSection,
    type ControlTheme,
} from '../shared/controls';
import { type PotentialType } from './physics';
import type { DisplayOptions } from './WavefunctionCanvas';

export interface QMControlsProps {
    // Potential
    potentialType: PotentialType;
    onPotentialTypeChange: (type: PotentialType) => void;

    // Display options
    displayOptions: DisplayOptions;
    onDisplayOptionChange: <K extends keyof DisplayOptions>(key: K, value: boolean) => void;

    // Animation
    isAnimating: boolean;
    onIsAnimatingChange: (animating: boolean) => void;
    speed: number;
    onSpeedChange: (speed: number) => void;

    // Theme
    theme: ControlTheme;
}

export const QMControls: React.FC<QMControlsProps> = (props) => {
    const {
        potentialType,
        onPotentialTypeChange,
        displayOptions,
        onDisplayOptionChange,
        isAnimating,
        onIsAnimatingChange,
        speed,
        onSpeedChange,
        theme,
    } = props;
    const potentials: { type: PotentialType; label: string }[] = [
        { type: 'harmonic', label: 'Harmonic Oscillator' },
        { type: 'infinite_well', label: 'Particle in a Box' },
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
            {/* Potential type tabs */}
            <div
                style={{
                    display: 'flex',
                    marginBottom: '1rem',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    border: `1px solid ${theme.border}`,
                }}
            >
                {potentials.map(({ type, label }) => {
                    const isActive = potentialType === type;
                    return (
                        <button
                            key={type}
                            onClick={() => onPotentialTypeChange(type)}
                            style={{
                                flex: 1,
                                padding: '0.6rem 0.5rem',
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

            {/* Animation Speed */}
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

            {/* Visibility toggles */}
            <CollapsibleSection title="Show / Hide" defaultExpanded={true} theme={theme}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <LegendItem
                        color="rgba(0, 72, 186, 0.9)"
                        text="Real part"
                        active={displayOptions.showReal}
                        onClick={() => onDisplayOptionChange('showReal', !displayOptions.showReal)}
                    />
                    <LegendItem
                        color="rgba(220, 20, 60, 0.9)"
                        text="Imaginary part"
                        active={displayOptions.showImaginary}
                        onClick={() =>
                            onDisplayOptionChange('showImaginary', !displayOptions.showImaginary)
                        }
                    />
                    <LegendItem
                        color="rgba(34, 139, 34, 0.9)"
                        text="Probability |ψ|²"
                        active={displayOptions.showProbability}
                        onClick={() =>
                            onDisplayOptionChange('showProbability', !displayOptions.showProbability)
                        }
                    />
                    <LegendItem
                        color="rgba(0, 0, 0, 0.5)"
                        text="Potential V(x)"
                        active={displayOptions.showPotential}
                        onClick={() =>
                            onDisplayOptionChange('showPotential', !displayOptions.showPotential)
                        }
                    />
                    <LegendItem
                        color="rgba(128, 128, 128, 0.5)"
                        text="Individual states"
                        active={displayOptions.showIndividualStates}
                        onClick={() =>
                            onDisplayOptionChange(
                                'showIndividualStates',
                                !displayOptions.showIndividualStates
                            )
                        }
                    />
                </div>
            </CollapsibleSection>

        </div>
    );
};

export default QMControls;
