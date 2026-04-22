import React from 'react';
import Button from '../Button';
import LegendItem from '../LegendItem';
import {
    SliderWithInput,
    CollapsibleSection,
    ToggleSwitch,
    type ControlTheme,
} from '../shared/controls';
import { type PotentialType, type PotentialParams } from './physics';
import type { DisplayOptions } from './WavefunctionCanvas';

export interface QMControlsProps {
    // Potential
    potentialType: PotentialType;
    onPotentialTypeChange: (type: PotentialType) => void;
    potentialParams: PotentialParams;
    onPotentialParamChange: <K extends keyof PotentialParams>(
        key: K,
        value: PotentialParams[K]
    ) => void;

    // Display options
    displayOptions: DisplayOptions;
    onDisplayOptionChange: <K extends keyof DisplayOptions>(
        key: K,
        value: boolean
    ) => void;

    // Animation
    isAnimating: boolean;
    onIsAnimatingChange: (animating: boolean) => void;
    speed: number;
    onSpeedChange: (speed: number) => void;

    // Theme
    theme: ControlTheme;
}

const POTENTIALS: { type: PotentialType; short: string; label: string }[] = [
    { type: 'harmonic', short: 'Harmonic', label: 'Harmonic Oscillator' },
    { type: 'infinite_well', short: 'Box', label: 'Particle in a Box' },
    { type: 'double_well', short: 'Double Well', label: 'Double Well' },
    { type: 'morse', short: 'Morse', label: 'Morse Potential' },
    { type: 'lattice', short: 'Lattice', label: 'Chain of Wells (MO → band)' },
];

export const QMControls: React.FC<QMControlsProps> = ({
    potentialType,
    onPotentialTypeChange,
    potentialParams,
    onPotentialParamChange,
    displayOptions,
    onDisplayOptionChange,
    isAnimating,
    onIsAnimatingChange,
    speed,
    onSpeedChange,
    theme,
}) => {
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
            {/* Potential picker — 2-col button grid */}
            <div style={{ marginBottom: '1rem' }}>
                <div
                    style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: theme.textMuted,
                        marginBottom: '0.4rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                    }}
                >
                    Potential
                </div>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '4px',
                    }}
                >
                    {POTENTIALS.map(({ type, short, label }) => {
                        const isActive = potentialType === type;
                        return (
                            <button
                                key={type}
                                onClick={() => onPotentialTypeChange(type)}
                                title={label}
                                style={{
                                    padding: '0.45rem 0.4rem',
                                    border: `1px solid ${theme.border}`,
                                    borderRadius: '5px',
                                    backgroundColor: isActive
                                        ? theme.accent || '#2563eb'
                                        : 'transparent',
                                    color: isActive ? '#fff' : theme.text,
                                    fontSize: '0.72rem',
                                    fontWeight: isActive ? 600 : 400,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                {short}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Potential parameters */}
            {potentialType === 'double_well' && (
                <CollapsibleSection title="Double Well" defaultExpanded theme={theme}>
                    <SliderWithInput
                        label="Barrier height"
                        value={potentialParams.doubleWellBarrier ?? 4}
                        onChange={(v) => onPotentialParamChange('doubleWellBarrier', v)}
                        min={0.5}
                        max={15}
                        step={0.1}
                        decimals={1}
                        unit="V₀"
                        theme={theme}
                    />
                    <SliderWithInput
                        label="Well separation"
                        value={potentialParams.doubleWellSeparation ?? 2}
                        onChange={(v) => onPotentialParamChange('doubleWellSeparation', v)}
                        min={0.8}
                        max={3.5}
                        step={0.1}
                        decimals={1}
                        unit="a"
                        theme={theme}
                    />
                    <SliderWithInput
                        label="Well offset (R−L)"
                        value={potentialParams.doubleWellTilt ?? 0}
                        onChange={(v) => onPotentialParamChange('doubleWellTilt', v)}
                        min={-3}
                        max={3}
                        step={0.05}
                        decimals={2}
                        unit="ΔV"
                        theme={theme}
                    />
                </CollapsibleSection>
            )}

            {potentialType === 'lattice' && (
                <CollapsibleSection title="Lattice" defaultExpanded theme={theme}>
                    <SliderWithInput
                        label="Number of wells"
                        value={potentialParams.latticeWells ?? 4}
                        onChange={(v) =>
                            onPotentialParamChange('latticeWells', Math.round(v))
                        }
                        min={1}
                        max={16}
                        step={1}
                        decimals={0}
                        theme={theme}
                    />
                    <SliderWithInput
                        label="Well depth"
                        value={potentialParams.latticeDepth ?? 12}
                        onChange={(v) => onPotentialParamChange('latticeDepth', v)}
                        min={0}
                        max={30}
                        step={0.5}
                        decimals={1}
                        unit="V"
                        theme={theme}
                    />
                    <SliderWithInput
                        label="Well spacing"
                        value={potentialParams.latticeSpacing ?? 2.2}
                        onChange={(v) => onPotentialParamChange('latticeSpacing', v)}
                        min={0.3}
                        max={10}
                        step={0.1}
                        decimals={2}
                        unit="a"
                        theme={theme}
                    />
                </CollapsibleSection>
            )}

            {potentialType === 'morse' && (
                <CollapsibleSection title="Morse Potential" defaultExpanded theme={theme}>
                    <SliderWithInput
                        label="Well depth"
                        value={potentialParams.morseDepth ?? 10}
                        onChange={(v) => onPotentialParamChange('morseDepth', v)}
                        min={2}
                        max={30}
                        step={0.5}
                        decimals={1}
                        unit="D"
                        theme={theme}
                    />
                    <SliderWithInput
                        label="Range parameter"
                        value={potentialParams.morseAlpha ?? 0.5}
                        onChange={(v) => onPotentialParamChange('morseAlpha', v)}
                        min={0.2}
                        max={1.2}
                        step={0.05}
                        decimals={2}
                        unit="α"
                        theme={theme}
                    />
                </CollapsibleSection>
            )}

            {/* Play/Pause */}
            <div style={{ marginBottom: '1rem', marginTop: '1rem' }}>
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
            <CollapsibleSection title="Animation" defaultExpanded theme={theme}>
                <SliderWithInput
                    label="Speed"
                    value={speed}
                    onChange={onSpeedChange}
                    min={0.1}
                    max={5}
                    step={0.1}
                    decimals={1}
                    unit="x"
                    theme={theme}
                />
                <ToggleSwitch
                    label="Auto-rescale amplitude"
                    checked={displayOptions.autoRescale}
                    onChange={(v) => onDisplayOptionChange('autoRescale', v)}
                    theme={theme}
                />
            </CollapsibleSection>

            {/* Visibility toggles */}
            <CollapsibleSection title="Display" defaultExpanded theme={theme}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <LegendItem
                        color="rgba(0, 72, 186, 0.9)"
                        text="Real part"
                        active={displayOptions.showReal}
                        onClick={() =>
                            onDisplayOptionChange('showReal', !displayOptions.showReal)
                        }
                    />
                    <LegendItem
                        color="rgba(220, 20, 60, 0.9)"
                        text="Imaginary part"
                        active={displayOptions.showImaginary}
                        onClick={() =>
                            onDisplayOptionChange(
                                'showImaginary',
                                !displayOptions.showImaginary
                            )
                        }
                    />
                    <LegendItem
                        color="rgba(34, 139, 34, 0.9)"
                        text="Probability |ψ|²"
                        active={displayOptions.showProbability}
                        onClick={() =>
                            onDisplayOptionChange(
                                'showProbability',
                                !displayOptions.showProbability
                            )
                        }
                    />
                    <LegendItem
                        color="rgba(128, 128, 128, 0.8)"
                        text="Potential V(x)"
                        active={displayOptions.showPotential}
                        onClick={() =>
                            onDisplayOptionChange(
                                'showPotential',
                                !displayOptions.showPotential
                            )
                        }
                    />
                    <LegendItem
                        color="rgba(100, 100, 100, 0.6)"
                        text="Energy levels"
                        active={displayOptions.showEnergyLevels}
                        onClick={() =>
                            onDisplayOptionChange(
                                'showEnergyLevels',
                                !displayOptions.showEnergyLevels
                            )
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
