import React, { useState } from 'react';
import { BoundaryType } from './BoundaryConditions';
import { ThermostatType } from './Thermostats';
import {
    SliderWithInput,
    CollapsibleSection,
    ToggleSwitch,
    Select,
    SegmentedControl,
    ControlGroup,
    ControlHint,
} from '../shared/controls';
import { SlotPicker, TypePair } from '../shared/sim';
import type { VizTheme } from '../shared/viz';

// 1 internal time unit = sqrt(amu·Å²/eV) ≈ 10.18 fs
const TIME_UNIT_TO_FS = 10.1805;

export interface BoxOption<K extends string> {
    value: K;
    label: string;
    title: string;
}

interface SimulationControlsProps<K extends string> {
    theme: VizTheme;
    boxSize: K;
    setBoxSize: (size: K) => void;
    boxOptions: BoxOption<K>[];
    numParticles: number;
    setNumParticles: (num: number) => void;
    temperature: number;
    setTemperature: (temp: number) => void;
    timeStep: number;
    setTimeStep: (step: number) => void;
    stepsPerFrame: number;
    setStepsPerFrame: (steps: number) => void;
    orangeRatio: number;
    setOrangeRatio: (ratio: number) => void;
    boundaryType: BoundaryType;
    setBoundaryType: (type: BoundaryType) => void;
    thermostatType: ThermostatType;
    setThermostatType: (type: ThermostatType) => void;
    chargeScale: number;
    setChargeScale: (scale: number) => void;
    visualScale: number;
    setVisualScale: (scale: number) => void;
    charges: number[];
    setCharges: (charges: number[]) => void;
    typeLabels: string[];
    setTypeLabels: (labels: string[]) => void;
    /** Resolved colours, one per type. */
    typeColors: string[];
    typeColorSlots: number[];
    setTypeColorSlots: (slots: number[]) => void;
    epsilonMatrix: number[][];
    sigmaMatrix: number[][];
    updateInteractionParameter: (paramType: string, type1: number, type2: number, value: number) => void;
    numTypes: number;
    showCells: boolean;
    setShowCells: (show: boolean) => void;
    showInteractions: boolean;
    setShowInteractions: (show: boolean) => void;
    showCutoffRadius: boolean;
    setShowCutoffRadius: (show: boolean) => void;
    cutoffRadius: number;
    setCutoffRadius: (radius: number) => void;
}

const BOUNDARIES = [
    { value: BoundaryType.PERIODIC, label: 'Periodic', title: 'Particles leaving one side re-enter on the other' },
    { value: BoundaryType.REFLECTIVE, label: 'Walls', title: 'Particles bounce off the box edges' },
    { value: BoundaryType.ELASTIC, label: 'Soft walls', title: 'Elastic walls that push back gradually' },
];

const THERMOSTATS = [
    { value: ThermostatType.NONE, label: 'None (constant energy)' },
    { value: ThermostatType.LANGEVIN, label: 'Langevin' },
    { value: ThermostatType.BERENDSEN, label: 'Berendsen' },
    { value: ThermostatType.VELOCITY_RESCALING, label: 'Velocity rescaling' },
    { value: ThermostatType.NOSE_HOOVER, label: 'Nosé–Hoover' },
];

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.25rem 0.375rem',
    font: 'inherit',
    fontSize: 'var(--viz-font-sm)',
    color: 'var(--viz-text)',
    background: 'var(--viz-surface-subtle)',
    border: '1px solid var(--viz-border)',
    borderRadius: 'var(--viz-radius-sm)',
};

const pairLabel: React.CSSProperties = { fontSize: 'var(--viz-font-sm)', fontWeight: 600, margin: '0.25rem 0 -0.125rem' };

function SimulationControls<K extends string>({
    theme,
    boxSize, setBoxSize, boxOptions,
    numParticles, setNumParticles,
    temperature, setTemperature,
    timeStep, setTimeStep,
    stepsPerFrame, setStepsPerFrame,
    orangeRatio, setOrangeRatio,
    boundaryType, setBoundaryType,
    thermostatType, setThermostatType,
    chargeScale, setChargeScale,
    visualScale, setVisualScale,
    charges, setCharges,
    typeLabels, setTypeLabels,
    typeColors, typeColorSlots, setTypeColorSlots,
    epsilonMatrix, sigmaMatrix, updateInteractionParameter,
    numTypes,
    showCells, setShowCells,
    showInteractions, setShowInteractions,
    showCutoffRadius, setShowCutoffRadius,
    cutoffRadius, setCutoffRadius,
}: SimulationControlsProps<K>) {
    const [useCombiningRules, setUseCombiningRules] = useState(true);

    // A scenario like Argon uses two identical types; treat it as one species
    // so the panel doesn't offer a meaningless mixture or cross terms.
    const distinctTypes =
        numTypes > 1 &&
        (typeLabels[0] !== typeLabels[1] ||
            charges[0] !== charges[1] ||
            epsilonMatrix[0][0] !== epsilonMatrix[1][1] ||
            sigmaMatrix[0][0] !== sigmaMatrix[1][1] ||
            epsilonMatrix[0][1] !== epsilonMatrix[0][0]);
    const charged = charges.some((q) => q !== 0);
    const shownTypes = distinctTypes ? numTypes : 1;

    // Lorentz–Berthelot: ε_ij = √(ε_i ε_j), σ_ij = (σ_i + σ_j)/2
    const applyCombiningRules = (eps: number[][], sig: number[][]) => {
        updateInteractionParameter('epsilon', 0, 1, Math.sqrt(eps[0][0] * eps[1][1]));
        updateInteractionParameter('sigma', 0, 1, (sig[0][0] + sig[1][1]) / 2);
    };

    const setPairParam = (param: 'epsilon' | 'sigma', i: number, val: number) => {
        if (!distinctTypes) {
            // One species: keep every entry equal.
            for (const [a, b] of [[0, 0], [1, 1], [0, 1]]) updateInteractionParameter(param, a, b, val);
            return;
        }
        updateInteractionParameter(param, i, i, val);
        if (useCombiningRules) {
            const eps = epsilonMatrix.map((row) => [...row]);
            const sig = sigmaMatrix.map((row) => [...row]);
            (param === 'epsilon' ? eps : sig)[i][i] = val;
            applyCombiningRules(eps, sig);
        }
    };

    return (
        <>
            <ControlGroup label="Conditions">
                <SliderWithInput
                    label="Temperature"
                    value={temperature}
                    onChange={setTemperature}
                    min={1} max={3000} step={10} decimals={0} unit="K"
                />
                <SliderWithInput
                    label="Particles"
                    value={numParticles}
                    onChange={(v) => setNumParticles(Math.round(v))}
                    min={2} max={500} step={1} decimals={0}
                />
                {distinctTypes && (
                    <SliderWithInput
                        label={<>Fraction <TypePair colors={[typeColors[0]]} /> {typeLabels[0]}</>}
                        value={orangeRatio}
                        onChange={setOrangeRatio}
                        min={0} max={1} step={0.1} decimals={1}
                    />
                )}
                <SegmentedControl aria-label="Boundaries" value={boundaryType} onChange={setBoundaryType} options={BOUNDARIES} />
                <SegmentedControl<K> aria-label="Box size" value={boxSize} onChange={setBoxSize} options={boxOptions} />
            </ControlGroup>

            <CollapsibleSection title="Interactions">
                {Array.from({ length: shownTypes }, (_, i) => (
                    <React.Fragment key={i}>
                        <p style={pairLabel}>
                            <TypePair colors={[typeColors[i], typeColors[i]]} /> {typeLabels[i]}–{typeLabels[i]}
                        </p>
                        <SliderWithInput
                            label="ε (well depth)"
                            value={epsilonMatrix[i][i]}
                            onChange={(v) => setPairParam('epsilon', i, v)}
                            min={0.001} max={2} step={0.001} decimals={3} unit="eV"
                        />
                        <SliderWithInput
                            label="σ (size)"
                            value={sigmaMatrix[i][i]}
                            onChange={(v) => setPairParam('sigma', i, v)}
                            min={1} max={8} step={0.1} decimals={1} unit="Å"
                        />
                    </React.Fragment>
                ))}

                {distinctTypes && (
                    <>
                        <p style={pairLabel}>
                            <TypePair colors={[typeColors[0], typeColors[1]]} /> {typeLabels[0]}–{typeLabels[1]}
                        </p>
                        <ToggleSwitch
                            label="Combining rules"
                            checked={useCombiningRules}
                            onChange={(checked) => {
                                setUseCombiningRules(checked);
                                if (checked) applyCombiningRules(epsilonMatrix, sigmaMatrix);
                            }}
                        />
                        {useCombiningRules ? (
                            <ControlHint>
                                ε = √(ε₁ε₂) = {epsilonMatrix[0][1].toFixed(3)} eV · σ = (σ₁ + σ₂)/2 ={' '}
                                {sigmaMatrix[0][1].toFixed(2)} Å
                            </ControlHint>
                        ) : (
                            <>
                                <SliderWithInput
                                    label="ε (cross)"
                                    value={epsilonMatrix[0][1]}
                                    onChange={(v) => updateInteractionParameter('epsilon', 0, 1, v)}
                                    min={0.001} max={2} step={0.001} decimals={3} unit="eV"
                                />
                                <SliderWithInput
                                    label="σ (cross)"
                                    value={sigmaMatrix[0][1]}
                                    onChange={(v) => updateInteractionParameter('sigma', 0, 1, v)}
                                    min={1} max={8} step={0.1} decimals={1} unit="Å"
                                />
                            </>
                        )}
                    </>
                )}

                {charged && (
                    <SliderWithInput
                        label="Coulomb strength"
                        value={chargeScale}
                        onChange={setChargeScale}
                        min={0} max={5} step={0.1} decimals={1} unit="×"
                    />
                )}
                <SliderWithInput
                    label="Cutoff"
                    value={cutoffRadius}
                    onChange={setCutoffRadius}
                    min={6} max={12} step={0.5} decimals={1} unit="Å"
                />
            </CollapsibleSection>

            <CollapsibleSection title="Integration">
                <Select label="Thermostat" value={thermostatType} onChange={setThermostatType} options={THERMOSTATS} />
                <SliderWithInput
                    label="Time step"
                    value={timeStep * TIME_UNIT_TO_FS}
                    onChange={(v) => setTimeStep(v / TIME_UNIT_TO_FS)}
                    min={0.1} max={10} step={0.1} decimals={1} unit="fs"
                />
                <SliderWithInput
                    label="Steps per frame"
                    value={stepsPerFrame}
                    onChange={(v) => setStepsPerFrame(Math.round(v))}
                    min={1} max={100} step={1} decimals={0}
                />
                <ControlHint>{(timeStep * TIME_UNIT_TO_FS * stepsPerFrame).toFixed(0)} fs simulated per frame</ControlHint>
            </CollapsibleSection>

            <CollapsibleSection title="Particle types">
                {typeLabels.slice(0, shownTypes).map((label, i) => (
                    <div key={i} style={{ display: 'grid', gap: '0.375rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 4.5rem', gap: '0.375rem' }}>
                            <input
                                type="text"
                                aria-label={`Type ${i + 1} label`}
                                value={label}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setTypeLabels(typeLabels.map((l, j) => (j === i || !distinctTypes ? v : l)));
                                }}
                                style={inputStyle}
                            />
                            <input
                                type="number"
                                aria-label={`Type ${i + 1} charge (e)`}
                                title="Charge (e)"
                                step="0.5"
                                value={charges[i]}
                                onChange={(e) => {
                                    const q = parseFloat(e.target.value) || 0;
                                    setCharges(charges.map((c, j) => (j === i || !distinctTypes ? q : c)));
                                }}
                                style={{ ...inputStyle, fontFamily: 'var(--ifm-font-family-monospace)' }}
                            />
                        </div>
                        <SlotPicker
                            theme={theme}
                            label={`${label} colour`}
                            value={typeColorSlots[i]}
                            onChange={(slot) =>
                                setTypeColorSlots(typeColorSlots.map((s, j) => (j === i || !distinctTypes ? slot : s)))
                            }
                        />
                    </div>
                ))}
                <ControlHint>Label, charge (e) and colour.</ControlHint>
            </CollapsibleSection>

            <CollapsibleSection title="Display">
                <SliderWithInput
                    label="Particle size"
                    value={visualScale}
                    onChange={setVisualScale}
                    min={1} max={15} step={0.5} decimals={1}
                />
                <ToggleSwitch label="Neighbour-list cells" checked={showCells} onChange={setShowCells} />
                <ToggleSwitch label="Interacting pairs" checked={showInteractions} onChange={setShowInteractions} />
                <ToggleSwitch label="Cutoff radius" checked={showCutoffRadius} onChange={setShowCutoffRadius} />
            </CollapsibleSection>
        </>
    );
}

// Memoised: the page re-renders as the step counter updates, but these
// props only change when a setting does.
export default React.memo(SimulationControls) as typeof SimulationControls;
