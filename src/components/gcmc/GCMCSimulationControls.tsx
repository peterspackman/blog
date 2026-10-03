import React, { useState } from 'react';
import {
    SliderWithInput,
    CollapsibleSection,
    ToggleSwitch,
    SegmentedControl,
    Select,
    ControlGroup,
    ControlHint,
} from '../shared/controls';
import { TypePair } from '../shared/sim';
import { ExternalPotentialType } from './ExternalPotentials';
import { InitLayout } from './GCMCParticleData';
import { BOLTZMANN_CONSTANT } from '../md/constants';

type InputMode = 'pressure' | 'concentration' | 'chemical-potential';

const PLANCK_H = 4.135667696e-3;
const AMU_CONV = 1.03642698e-4;
const EVA3_TO_KPA = 1.602e11 / 1000;
const R_GAS = 8.314;       // J/(mol·K)
const EV_TO_KJMOL = 96.485;

export interface BoxOption<K extends string> {
    value: K;
    label: string;
    title: string;
}

interface GCMCSimulationControlsProps<K extends string = string> {
    /** Custom scenario exposes the external-potential picker. */
    isCustom: boolean;
    boxSize: K;
    setBoxSize: (size: K) => void;
    boxOptions: BoxOption<K>[];
    // Thermodynamic state
    temperature: number;
    setTemperature: (t: number) => void;
    pressures: number[];
    setPressures: (p: number[]) => void;
    thermoInputMode: 'pressure' | 'concentration' | 'chemical-potential';
    setThermoInputMode: (m: 'pressure' | 'concentration' | 'chemical-potential') => void;

    // MC parameters
    initLayout: InitLayout;
    setInitLayout: (l: InitLayout) => void;
    maxDisplacement: number;
    setMaxDisplacement: (d: number) => void;
    stepsPerFrame: number;
    setStepsPerFrame: (n: number) => void;
    moveWeights: { displacement: number; insertion: number; deletion: number };
    setMoveWeights: (w: { displacement: number; insertion: number; deletion: number }) => void;

    // Interaction parameters
    epsilonMatrix: number[][];
    sigmaMatrix: number[][];
    updateInteractionParameter: (paramType: string, i: number, j: number, value: number) => void;
    numTypes: number;
    typeLabels: string[];
    typeColors: string[];
    cutoffRadius: number;
    setCutoffRadius: (r: number) => void;
    masses: number[];
    charges: number[];
    setCharges: (c: number[]) => void;
    chargeScale: number;
    setChargeScale: (s: number) => void;

    // Visualization
    visualScale: number;
    setVisualScale: (s: number) => void;
    showExternalPotential: boolean;
    setShowExternalPotential: (show: boolean) => void;
    showTrialMoves: boolean;
    setShowTrialMoves: (show: boolean) => void;
    externalPotentialType: ExternalPotentialType;
    setExternalPotentialType: (t: ExternalPotentialType) => void;

    // Type ratio (for binary)
    typeRatio: number;
    setTypeRatio: (r: number) => void;
    densityWindow: number;
    setDensityWindow: (w: number) => void;
}

const INPUT_MODES: { value: InputMode; label: string; title: string }[] = [
    { value: 'pressure', label: 'P', title: 'Pressure (kPa)' },
    { value: 'concentration', label: 'c', title: 'Concentration (mol/L)' },
    { value: 'chemical-potential', label: 'μ', title: 'Chemical potential (kJ/mol)' },
];

const INIT_LAYOUTS: { value: InitLayout; label: string }[] = [
    { value: 'empty', label: 'Empty (start from vacuum)' },
    { value: 'random', label: 'Random' },
    { value: 'square-lattice', label: 'Square lattice' },
    { value: 'hex-lattice', label: 'Hexagonal lattice' },
    { value: 'ions-left', label: 'Neutral fluid + ions (left)' },
];

const EXTERNAL_POTENTIALS: { value: ExternalPotentialType; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'cylindrical-pore', label: 'Cylindrical pore' },
    { value: 'slit-pore', label: 'Slit pore' },
    { value: 'zeolite', label: 'Zeolite' },
    { value: 'charged-surface', label: 'Charged surface' },
    { value: 'potential-gradient', label: 'Potential gradient' },
];

const pairLabel: React.CSSProperties = { fontSize: 'var(--viz-font-sm)', fontWeight: 600, margin: '0.25rem 0 -0.125rem' };

const weightInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.25rem',
    font: 'inherit',
    fontFamily: 'var(--ifm-font-family-monospace)',
    fontSize: 'var(--viz-font-xs)',
    textAlign: 'center',
    color: 'var(--viz-text)',
    background: 'var(--viz-surface-subtle)',
    border: '1px solid var(--viz-border)',
    borderRadius: 'var(--viz-radius-sm)',
};

function GCMCSimulationControls<K extends string>({
    isCustom,
    boxSize, setBoxSize, boxOptions,
    temperature, setTemperature,
    pressures, setPressures,
    thermoInputMode, setThermoInputMode,
    initLayout, setInitLayout,
    maxDisplacement, setMaxDisplacement,
    stepsPerFrame, setStepsPerFrame,
    moveWeights, setMoveWeights,
    epsilonMatrix, sigmaMatrix, updateInteractionParameter,
    numTypes, typeLabels, typeColors,
    cutoffRadius, setCutoffRadius,
    masses,
    charges, setCharges,
    chargeScale, setChargeScale,
    visualScale, setVisualScale,
    showExternalPotential, setShowExternalPotential,
    showTrialMoves, setShowTrialMoves,
    externalPotentialType, setExternalPotentialType,
    typeRatio, setTypeRatio,
    densityWindow, setDensityWindow,
}: GCMCSimulationControlsProps<K>) {
    const [useCombiningRules, setUseCombiningRules] = useState(true);
    const inputMode = thermoInputMode;
    const setInputMode = setThermoInputMode;

    // Conversions: pressure (kPa) is the stored value
    // Concentration: c (mol/L) = P (Pa) / (R * T) = P (kPa) * 1000 / (R * T)
    const pressureToConc = (P_kPa: number): number => (P_kPa * 1000) / (R_GAS * temperature);
    const concToPressure = (c_molL: number): number => (c_molL * R_GAS * temperature) / 1000;

    // Chemical potential: mu (eV) from P via ideal gas
    const pressureToMuEv = (P_kPa: number, typeIdx: number): number => {
        const kBT = BOLTZMANN_CONSTANT * temperature;
        const m = (masses[typeIdx] ?? masses[0]) * AMU_CONV;
        const lambda2 = (PLANCK_H * PLANCK_H) / (2 * Math.PI * m * kBT);
        const sigma = sigmaMatrix[typeIdx]?.[typeIdx] ?? sigmaMatrix[0][0];
        const z = (P_kPa / EVA3_TO_KPA) * sigma / kBT;
        if (z <= 0) return -1;
        return kBT * Math.log(z * lambda2);
    };
    const muEvToPressure = (mu_eV: number, typeIdx: number): number => {
        const kBT = BOLTZMANN_CONSTANT * temperature;
        const m = (masses[typeIdx] ?? masses[0]) * AMU_CONV;
        const lambda2 = (PLANCK_H * PLANCK_H) / (2 * Math.PI * m * kBT);
        const sigma = sigmaMatrix[typeIdx]?.[typeIdx] ?? sigmaMatrix[0][0];
        const z = Math.exp(mu_eV / kBT) / lambda2;
        return (z / sigma) * kBT * EVA3_TO_KPA;
    };

    const updatePressure = (index: number, P_kPa: number) => {
        const newP = [...pressures];
        newP[index] = Math.max(0.001, P_kPa);
        setPressures(newP);
    };

    const updateEpsilon = (i: number, j: number, val: number) => {
        updateInteractionParameter('epsilon', i, j, val);
        if (i === j && useCombiningRules && numTypes > 1) {
            const eps0 = i === 0 ? val : epsilonMatrix[0][0];
            const eps1 = i === 1 ? val : epsilonMatrix[1][1];
            const crossEps = Math.sqrt(eps0 * eps1);
            updateInteractionParameter('epsilon', 0, 1, crossEps);
            updateInteractionParameter('epsilon', 1, 0, crossEps);
        }
    };

    const updateSigma = (i: number, j: number, val: number) => {
        updateInteractionParameter('sigma', i, j, val);
        if (i === j && useCombiningRules && numTypes > 1) {
            const sig0 = i === 0 ? val : sigmaMatrix[0][0];
            const sig1 = i === 1 ? val : sigmaMatrix[1][1];
            const crossSig = (sig0 + sig1) / 2;
            updateInteractionParameter('sigma', 0, 1, crossSig);
            updateInteractionParameter('sigma', 1, 0, crossSig);
        }
    };

    // Normalize move weights for display
    const totalWeight = moveWeights.displacement + moveWeights.insertion + moveWeights.deletion;

    const typeLabel = (i: number) => (numTypes > 1 ? ` (${typeLabels[i]})` : '');
    const charged = charges.some((q) => q !== 0);
    // Without insertions/deletions the particle number is fixed and the
    // reservoir pressure has no effect.
    const exchanges = moveWeights.insertion + moveWeights.deletion > 0;

    return (
        <>
            <ControlGroup label="Conditions">
                <SliderWithInput
                    label="Temperature"
                    value={temperature}
                    onChange={setTemperature}
                    min={10} max={500} step={5} decimals={0} unit="K"
                />
                {exchanges ? (
                    <>
                        <SegmentedControl aria-label="Reservoir variable" value={inputMode} onChange={setInputMode} options={INPUT_MODES} />
                        {pressures.map((P, i) =>
                            inputMode === 'concentration' ? (
                                <SliderWithInput
                                    key={`conc-${i}`}
                                    label={`Concentration${typeLabel(i)}`}
                                    value={pressureToConc(P)}
                                    onChange={(v) => updatePressure(i, concToPressure(v))}
                                    min={0.001} max={10} step={0.01} decimals={3} unit="mol/L"
                                />
                            ) : inputMode === 'chemical-potential' ? (
                                <SliderWithInput
                                    key={`mu-${i}`}
                                    label={`μ${typeLabel(i)}`}
                                    value={pressureToMuEv(P, i) * EV_TO_KJMOL}
                                    onChange={(v) => updatePressure(i, muEvToPressure(v / EV_TO_KJMOL, i))}
                                    min={-60} max={0} step={0.5} decimals={1} unit="kJ/mol"
                                />
                            ) : (
                                <SliderWithInput
                                    key={`prs-${i}`}
                                    label={`Pressure${typeLabel(i)}`}
                                    value={P}
                                    onChange={(v) => updatePressure(i, v)}
                                    min={1} max={10000} step={50} decimals={0} unit="kPa"
                                />
                            ),
                        )}
                        {numTypes > 1 && (
                            <SliderWithInput
                                label={<>Initial fraction <TypePair colors={[typeColors[0]]} /> {typeLabels[0]}</>}
                                value={typeRatio}
                                onChange={setTypeRatio}
                                min={0} max={1} step={0.1} decimals={1}
                            />
                        )}
                    </>
                ) : (
                    <ControlHint>Fixed number of particles: this scenario only displaces them.</ControlHint>
                )}
                <SegmentedControl<K> aria-label="Box size" value={boxSize} onChange={setBoxSize} options={boxOptions} />
            </ControlGroup>

            {(isCustom || externalPotentialType !== 'none') && (
                <ControlGroup label="External potential">
                    {isCustom && (
                        <Select
                            aria-label="External potential"
                            value={externalPotentialType}
                            onChange={setExternalPotentialType}
                            options={EXTERNAL_POTENTIALS}
                        />
                    )}
                    {externalPotentialType !== 'none' && (
                        <ToggleSwitch label="Show potential" checked={showExternalPotential} onChange={setShowExternalPotential} />
                    )}
                    {charged &&
                        !isCustom &&
                        charges.slice(0, numTypes).map((q, i) => (
                            <SliderWithInput
                                key={i}
                                label={<>Charge <TypePair colors={[typeColors[i]]} /> {typeLabels[i]}</>}
                                value={q}
                                onChange={(v) => setCharges(charges.map((c, j) => (j === i ? v : c)))}
                                min={-2} max={2} step={0.5} decimals={1} unit="e"
                            />
                        ))}
                    {charged && (chargeScale > 0 || isCustom) && (
                        <SliderWithInput
                            label="Ion–ion strength (1/ε)"
                            value={chargeScale}
                            onChange={setChargeScale}
                            min={0} max={0.1} step={0.001} decimals={3}
                        />
                    )}
                </ControlGroup>
            )}

            <CollapsibleSection title="Interactions">
                {Array.from({ length: Math.min(numTypes, 3) }, (_, i) => (
                    <React.Fragment key={i}>
                        <p style={pairLabel}>
                            <TypePair colors={[typeColors[i]]} /> {typeLabels[i]}
                        </p>
                        <SliderWithInput
                            label="ε (well depth)"
                            value={epsilonMatrix[i]?.[i] ?? 0.01}
                            onChange={(v) => updateEpsilon(i, i, v)}
                            min={0.001} max={0.1} step={0.001} decimals={4} unit="eV"
                        />
                        <SliderWithInput
                            label="σ (size)"
                            value={sigmaMatrix[i]?.[i] ?? 3.4}
                            onChange={(v) => updateSigma(i, i, v)}
                            min={1} max={8} step={0.1} decimals={1} unit="Å"
                        />
                        {isCustom && (
                            <SliderWithInput
                                label="Charge"
                                value={charges[i] ?? 0}
                                onChange={(v) => setCharges(charges.map((c, j) => (j === i ? v : c)))}
                                min={-2} max={2} step={0.5} decimals={1} unit="e"
                            />
                        )}
                    </React.Fragment>
                ))}

                {numTypes > 1 && (
                    <>
                        <p style={pairLabel}>
                            <TypePair colors={[typeColors[0], typeColors[1]]} /> {typeLabels[0]}–{typeLabels[1]}
                        </p>
                        <ToggleSwitch label="Combining rules" checked={useCombiningRules} onChange={setUseCombiningRules} />
                        {useCombiningRules ? (
                            <ControlHint>Cross terms follow ε = √(ε₁ε₂) and σ = (σ₁ + σ₂)/2.</ControlHint>
                        ) : (
                            <>
                                <SliderWithInput
                                    label="ε (cross)"
                                    value={epsilonMatrix[0][1]}
                                    onChange={(v) => {
                                        updateInteractionParameter('epsilon', 0, 1, v);
                                        updateInteractionParameter('epsilon', 1, 0, v);
                                    }}
                                    min={0.001} max={0.1} step={0.001} decimals={4} unit="eV"
                                />
                                <SliderWithInput
                                    label="σ (cross)"
                                    value={sigmaMatrix[0][1]}
                                    onChange={(v) => {
                                        updateInteractionParameter('sigma', 0, 1, v);
                                        updateInteractionParameter('sigma', 1, 0, v);
                                    }}
                                    min={1} max={8} step={0.1} decimals={1} unit="Å"
                                />
                            </>
                        )}
                    </>
                )}

                <SliderWithInput
                    label="Cutoff"
                    value={cutoffRadius}
                    onChange={setCutoffRadius}
                    min={3} max={20} step={0.5} decimals={1} unit="Å"
                />
            </CollapsibleSection>

            <CollapsibleSection title="Monte Carlo moves">
                <Select label="Start from" value={initLayout} onChange={setInitLayout} options={INIT_LAYOUTS} />
                <SliderWithInput
                    label="Max displacement"
                    value={maxDisplacement}
                    onChange={setMaxDisplacement}
                    min={0.1} max={5.0} step={0.1} decimals={1} unit="Å"
                />
                <SliderWithInput
                    label="Steps per frame"
                    value={stepsPerFrame}
                    onChange={(v) => setStepsPerFrame(Math.round(v))}
                    min={1} max={500} step={10} decimals={0}
                />
                <div style={{ display: 'grid', gap: '0.25rem' }}>
                    <span style={{ fontSize: 'var(--viz-font-sm)' }}>Move mix (%)</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.375rem' }}>
                        {(['displacement', 'insertion', 'deletion'] as const).map((key) => (
                            <label key={key} style={{ display: 'grid', gap: '0.125rem', fontSize: 'var(--viz-font-xs)', color: 'var(--viz-muted)' }}>
                                <input
                                    type="number"
                                    value={((moveWeights[key] / totalWeight) * 100).toFixed(0)}
                                    onChange={(e) => {
                                        const pct = parseFloat(e.target.value) || 0;
                                        setMoveWeights({ ...moveWeights, [key]: pct / 100 });
                                    }}
                                    min={0}
                                    max={100}
                                    style={weightInputStyle}
                                />
                                {key === 'displacement' ? 'Displace' : key === 'insertion' ? 'Insert' : 'Delete'}
                            </label>
                        ))}
                    </div>
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Display">
                <SliderWithInput
                    label="Particle size"
                    value={visualScale}
                    onChange={setVisualScale}
                    min={1} max={10} step={0.5} decimals={1}
                />
                <ToggleSwitch label="Trial moves" checked={showTrialMoves} onChange={setShowTrialMoves} />
                <SliderWithInput
                    label="Profile window"
                    value={densityWindow}
                    onChange={(v) => setDensityWindow(Math.round(v))}
                    min={50} max={5000} step={50} decimals={0} unit="samples"
                />
            </CollapsibleSection>
        </>
    );
}

// Memoised: the page re-renders every frame as particle counts sync, but
// these props only change when a setting does.
export default React.memo(GCMCSimulationControls) as typeof GCMCSimulationControls;
