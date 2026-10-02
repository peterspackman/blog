import React from 'react';
import {
    SliderWithInput,
    CollapsibleSection,
    ToggleSwitch,
    SegmentedControl,
    VizButton,
    ControlGroup,
    Legend,
} from '../shared/controls';
import type { VizTheme } from '../shared/viz';
import { type PotentialType, type PotentialParams } from './physics';
import type { DisplayOptions } from './WavefunctionCanvas';

export interface QMControlsProps {
    potentialType: PotentialType;
    onPotentialTypeChange: (type: PotentialType) => void;
    potentialParams: PotentialParams;
    onPotentialParamChange: <K extends keyof PotentialParams>(key: K, value: PotentialParams[K]) => void;
    displayOptions: DisplayOptions;
    onDisplayOptionChange: <K extends keyof DisplayOptions>(key: K, value: boolean) => void;
    isAnimating: boolean;
    onIsAnimatingChange: (animating: boolean) => void;
    speed: number;
    onSpeedChange: (speed: number) => void;
    onResetTime: () => void;
    theme: VizTheme;
}

const POTENTIALS: { value: PotentialType; label: string; title: string }[] = [
    { value: 'harmonic', label: 'Harmonic', title: 'Harmonic oscillator' },
    { value: 'infinite_well', label: 'Box', title: 'Particle in a box' },
    { value: 'double_well', label: 'Double well', title: 'Double well' },
    { value: 'morse', label: 'Morse', title: 'Morse potential' },
    { value: 'lattice', label: 'Lattice', title: 'Chain of wells (MO → band)' },
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
    onResetTime,
    theme,
}) => {
    const toggle = (key: keyof DisplayOptions) => onDisplayOptionChange(key, !displayOptions[key]);
    const [reColor, imColor, probColor] = theme.series;

    return (
        <>
            <ControlGroup label="Potential">
                <SegmentedControl
                    aria-label="Potential"
                    columns={3}
                    value={potentialType}
                    onChange={onPotentialTypeChange}
                    options={POTENTIALS}
                />
            </ControlGroup>

            {potentialType === 'double_well' && (
                <CollapsibleSection title="Double well" defaultExpanded>
                    <SliderWithInput
                        label="Barrier height"
                        value={potentialParams.doubleWellBarrier ?? 4}
                        onChange={(v) => onPotentialParamChange('doubleWellBarrier', v)}
                        min={0.5}
                        max={15}
                        step={0.1}
                        decimals={1}
                        unit="V₀"
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
                    />
                </CollapsibleSection>
            )}

            {potentialType === 'lattice' && (
                <CollapsibleSection title="Lattice" defaultExpanded>
                    <SliderWithInput
                        label="Number of wells"
                        value={potentialParams.latticeWells ?? 4}
                        onChange={(v) => onPotentialParamChange('latticeWells', Math.round(v))}
                        min={1}
                        max={16}
                        step={1}
                        decimals={0}
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
                    />
                </CollapsibleSection>
            )}

            {potentialType === 'morse' && (
                <CollapsibleSection title="Morse potential" defaultExpanded>
                    <SliderWithInput
                        label="Well depth"
                        value={potentialParams.morseDepth ?? 10}
                        onChange={(v) => onPotentialParamChange('morseDepth', v)}
                        min={2}
                        max={30}
                        step={0.5}
                        decimals={1}
                        unit="D"
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
                    />
                </CollapsibleSection>
            )}

            <ControlGroup label="Time">
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                    <VizButton variant="primary" style={{ flex: 1 }} onClick={() => onIsAnimatingChange(!isAnimating)}>
                        {isAnimating ? 'Pause' : 'Play'}
                    </VizButton>
                    <VizButton variant="secondary" onClick={onResetTime}>
                        Reset t
                    </VizButton>
                </div>
                <SliderWithInput
                    label="Speed"
                    value={speed}
                    onChange={onSpeedChange}
                    min={0.1}
                    max={5}
                    step={0.1}
                    decimals={1}
                    unit="×"
                />
                <ToggleSwitch
                    label="Auto-rescale amplitude"
                    checked={displayOptions.autoRescale}
                    onChange={(v) => onDisplayOptionChange('autoRescale', v)}
                />
            </ControlGroup>

            <ControlGroup label="Show">
                <Legend
                    onToggle={(k) => toggle(k as keyof DisplayOptions)}
                    items={[
                        { key: 'showProbability', label: '|ψ|²', color: probColor, active: displayOptions.showProbability },
                        { key: 'showReal', label: 'Re ψ', color: reColor, shape: 'line', active: displayOptions.showReal },
                        { key: 'showImaginary', label: 'Im ψ', color: imColor, shape: 'line', active: displayOptions.showImaginary },
                        { key: 'showPotential', label: 'V(x)', color: theme.muted, shape: 'line', active: displayOptions.showPotential },
                        { key: 'showEnergyLevels', label: 'Energy levels', color: theme.muted, shape: 'dashed', active: displayOptions.showEnergyLevels },
                        { key: 'showIndividualStates', label: 'Individual states', color: theme.muted, shape: 'line', active: displayOptions.showIndividualStates },
                    ]}
                />
            </ControlGroup>
        </>
    );
};

export default QMControls;
