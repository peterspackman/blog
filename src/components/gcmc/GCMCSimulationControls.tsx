import React, { useState } from 'react';
import { SliderWithInput } from '../shared/controls';
import { ExternalPotentialType } from './ExternalPotentials';
import { InitLayout } from './GCMCParticleData';
import { BOLTZMANN_CONSTANT } from '../md/constants';

type InputMode = 'pressure' | 'concentration' | 'chemical-potential';

const PLANCK_H = 4.135667696e-3;
const AMU_CONV = 1.03642698e-4;
const EVA3_TO_KPA = 1.602e11 / 1000;
const R_GAS = 8.314;       // J/(mol·K)
const EV_TO_KJMOL = 96.485;

interface GCMCSimulationControlsProps {
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

    isDark?: boolean;
}

const GCMCSimulationControls: React.FC<GCMCSimulationControlsProps> = ({
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
    isDark = false,
}) => {
    const [useCombiningRules, setUseCombiningRules] = useState(true);
    const inputMode = thermoInputMode;
    const setInputMode = setThermoInputMode;

    const theme = {
        background: isDark ? '#2d2d2d' : '#f8f9fa',
        surface: isDark ? '#3d3d3d' : '#ffffff',
        border: isDark ? '#555' : '#e0e0e0',
        text: isDark ? '#e0e0e0' : '#333',
        textMuted: isDark ? '#999' : '#666',
        accent: isDark ? '#6b9eff' : '#2563eb',
        inputBg: isDark ? '#4a4a4a' : '#f3f4f6',
    };

    const sectionStyle: React.CSSProperties = {
        marginBottom: '1rem',
        paddingBottom: '1rem',
        borderBottom: `1px solid ${theme.border}`,
    };

    const sectionTitleStyle: React.CSSProperties = {
        fontSize: '0.7rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: theme.textMuted,
        marginBottom: '0.5rem',
    };

    const selectStyle: React.CSSProperties = {
        width: '100%',
        padding: '0.35rem 0.5rem',
        fontSize: '0.8rem',
        border: `1px solid ${theme.border}`,
        borderRadius: '4px',
        backgroundColor: theme.surface,
        color: theme.text,
        cursor: 'pointer',
    };

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

    return (
        <div style={{
            backgroundColor: theme.background,
            padding: '1rem',
            borderRadius: '8px',
            border: `1px solid ${theme.border}`,
            color: theme.text,
            fontSize: '0.85rem',
        }}>
            {/* Thermodynamic State */}
            <div style={sectionStyle}>
                <div style={sectionTitleStyle}>Thermodynamic State</div>
                <SliderWithInput
                    label="Temperature"
                    value={temperature}
                    onChange={setTemperature}
                    min={10} max={500} step={5} decimals={0} unit="K"
                    theme={theme}
                />
                {/* Input mode toggle */}
                <div style={{ display: 'flex', gap: '0.2rem', marginBottom: '0.4rem' }}>
                    {(['pressure', 'concentration', 'chemical-potential'] as InputMode[]).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setInputMode(mode)}
                            style={{
                                padding: '0.2rem 0.4rem',
                                border: 'none',
                                borderRadius: '10px',
                                fontSize: '0.65rem',
                                fontWeight: inputMode === mode ? 600 : 400,
                                cursor: 'pointer',
                                backgroundColor: inputMode === mode ? theme.accent : theme.surface,
                                color: inputMode === mode ? '#fff' : theme.textMuted,
                            }}
                        >
                            {mode === 'pressure' ? 'P (kPa)' : mode === 'concentration' ? 'c (mol/L)' : 'μ (kJ/mol)'}
                        </button>
                    ))}
                </div>

                {pressures.map((P, i) => {
                    if (inputMode === 'concentration') {
                        return (
                            <SliderWithInput
                                key={`conc-${i}`}
                                label={numTypes > 1 ? `c (${typeLabels[i]})` : 'Concentration'}
                                value={pressureToConc(P)}
                                onChange={(v) => updatePressure(i, concToPressure(v))}
                                min={0.001} max={10} step={0.01} decimals={3} unit="mol/L"
                                theme={theme}
                            />
                        );
                    } else if (inputMode === 'chemical-potential') {
                        return (
                            <SliderWithInput
                                key={`mu-${i}`}
                                label={numTypes > 1 ? `μ (${typeLabels[i]})` : 'Chemical potential'}
                                value={pressureToMuEv(P, i) * EV_TO_KJMOL}
                                onChange={(v) => updatePressure(i, muEvToPressure(v / EV_TO_KJMOL, i))}
                                min={-60} max={0} step={0.5} decimals={1} unit="kJ/mol"
                                theme={theme}
                            />
                        );
                    } else {
                        return (
                            <SliderWithInput
                                key={`prs-${i}`}
                                label={numTypes > 1 ? `P (${typeLabels[i]})` : 'Pressure'}
                                value={P}
                                onChange={(v) => updatePressure(i, v)}
                                min={1} max={10000} step={50} decimals={0} unit="kPa"
                                theme={theme}
                            />
                        );
                    }
                })}
            </div>

            {/* MC Parameters */}
            <div style={sectionStyle}>
                <div style={sectionTitleStyle}>Monte Carlo Parameters</div>
                <div style={{ marginBottom: '0.4rem' }}>
                    <div style={{ fontSize: '0.75rem', color: theme.textMuted, marginBottom: '0.2rem' }}>Initial config</div>
                    <select
                        value={initLayout}
                        onChange={(e) => setInitLayout(e.target.value as InitLayout)}
                        style={selectStyle}
                    >
                        <option value="empty">Empty (start from vacuum)</option>
                        <option value="random">Random</option>
                        <option value="square-lattice">Square lattice</option>
                        <option value="hex-lattice">Hexagonal lattice</option>
                        <option value="ions-left">Neutral fluid + ions (left)</option>
                    </select>
                </div>
                <SliderWithInput
                    label="Max displacement"
                    value={maxDisplacement}
                    onChange={setMaxDisplacement}
                    min={0.1} max={5.0} step={0.1} decimals={1} unit="Å"
                    theme={theme}
                />
                <SliderWithInput
                    label="Steps per frame"
                    value={stepsPerFrame}
                    onChange={(v) => setStepsPerFrame(Math.round(v))}
                    min={1} max={500} step={10} decimals={0}
                    theme={theme}
                />
                {numTypes > 1 && (
                    <SliderWithInput
                        label="Type ratio"
                        value={typeRatio}
                        onChange={setTypeRatio}
                        min={0} max={1} step={0.1} decimals={1}
                        theme={theme}
                    />
                )}

                {/* Move weights */}
                <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', color: theme.textMuted, marginBottom: '0.25rem' }}>
                        Move weights (disp / ins / del)
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        {(['displacement', 'insertion', 'deletion'] as const).map((key) => (
                            <input
                                key={key}
                                type="number"
                                value={(moveWeights[key] / totalWeight * 100).toFixed(0)}
                                onChange={(e) => {
                                    const pct = parseFloat(e.target.value) || 0;
                                    const newWeights = { ...moveWeights, [key]: pct / 100 };
                                    setMoveWeights(newWeights);
                                }}
                                style={{
                                    width: '45px',
                                    padding: '0.2rem',
                                    fontSize: '0.75rem',
                                    border: `1px solid ${theme.border}`,
                                    borderRadius: '3px',
                                    backgroundColor: theme.inputBg,
                                    color: theme.text,
                                    textAlign: 'center',
                                }}
                                min={0}
                                max={100}
                                title={key}
                            />
                        ))}
                        <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>%</span>
                    </div>
                </div>
            </div>

            {/* Interactions */}
            <div style={sectionStyle}>
                <div style={sectionTitleStyle}>Interactions</div>
                {Array.from({ length: Math.min(numTypes, 3) }, (_, i) => (
                    <div key={i} style={{ marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                            <div style={{ width: '10px', height: '10px', backgroundColor: typeColors[i], borderRadius: '2px' }} />
                            <span style={{ fontSize: '0.75rem', color: theme.textMuted }}>{typeLabels[i]}</span>
                        </div>
                        <SliderWithInput
                            label="ε (well depth)"
                            value={epsilonMatrix[i]?.[i] ?? 0.01}
                            onChange={(v) => updateEpsilon(i, i, v)}
                            min={0.001} max={0.1} step={0.001} decimals={4} unit="eV"
                            theme={theme}
                        />
                        <SliderWithInput
                            label="σ (size)"
                            value={sigmaMatrix[i]?.[i] ?? 3.4}
                            onChange={(v) => updateSigma(i, i, v)}
                            min={1} max={8} step={0.1} decimals={1} unit="Å"
                            theme={theme}
                        />
                        <SliderWithInput
                            label="Charge"
                            value={charges[i] ?? 0}
                            onChange={(v) => {
                                const newCharges = [...charges];
                                newCharges[i] = v;
                                setCharges(newCharges);
                            }}
                            min={-2} max={2} step={0.5} decimals={1} unit="e"
                            theme={theme}
                        />
                    </div>
                ))}

                {numTypes > 1 && (
                    <div style={{ marginTop: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <div style={{ width: '10px', height: '10px', backgroundColor: typeColors[0], borderRadius: '2px' }} />
                                <span style={{ fontSize: '0.75rem', color: theme.textMuted }}>-</span>
                                <div style={{ width: '10px', height: '10px', backgroundColor: typeColors[1], borderRadius: '2px' }} />
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', cursor: 'pointer', marginLeft: 'auto' }}>
                                <input
                                    type="checkbox"
                                    checked={useCombiningRules}
                                    onChange={(e) => setUseCombiningRules(e.target.checked)}
                                    style={{ margin: 0 }}
                                />
                                Combining rules
                            </label>
                        </div>
                        {!useCombiningRules && (
                            <>
                                <SliderWithInput
                                    label="ε (cross)"
                                    value={epsilonMatrix[0][1]}
                                    onChange={(v) => {
                                        updateInteractionParameter('epsilon', 0, 1, v);
                                        updateInteractionParameter('epsilon', 1, 0, v);
                                    }}
                                    min={0.001} max={0.1} step={0.001} decimals={4} unit="eV"
                                    theme={theme}
                                />
                                <SliderWithInput
                                    label="σ (cross)"
                                    value={sigmaMatrix[0][1]}
                                    onChange={(v) => {
                                        updateInteractionParameter('sigma', 0, 1, v);
                                        updateInteractionParameter('sigma', 1, 0, v);
                                    }}
                                    min={1} max={8} step={0.1} decimals={1} unit="Å"
                                    theme={theme}
                                />
                            </>
                        )}
                    </div>
                )}

                <SliderWithInput
                    label="Cutoff radius"
                    value={cutoffRadius}
                    onChange={setCutoffRadius}
                    min={3} max={20} step={0.5} decimals={1} unit="Å"
                    theme={theme}
                />
                <SliderWithInput
                    label="Charge scaling (1/ε)"
                    value={chargeScale}
                    onChange={setChargeScale}
                    min={0} max={0.1} step={0.001} decimals={3}
                    theme={theme}
                />
            </div>

            {/* External Potential */}
            <div style={sectionStyle}>
                <div style={sectionTitleStyle}>External Potential</div>
                <select
                    value={externalPotentialType}
                    onChange={(e) => setExternalPotentialType(e.target.value as ExternalPotentialType)}
                    style={selectStyle}
                >
                    <option value="none">None</option>
                    <option value="cylindrical-pore">Cylindrical Pore</option>
                    <option value="slit-pore">Slit Pore</option>
                    <option value="zeolite">Zeolite</option>
                    <option value="charged-surface">Charged Surface</option>
                    <option value="potential-gradient">Potential Gradient</option>
                </select>
            </div>

            {/* Visualization */}
            <div style={{ marginBottom: '0.5rem' }}>
                <div style={sectionTitleStyle}>Visualization</div>
                <SliderWithInput
                    label="Particle scale"
                    value={visualScale}
                    onChange={setVisualScale}
                    min={1} max={10} step={0.5} decimals={1}
                    theme={theme}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', marginTop: '0.4rem' }}>
                    <input
                        type="checkbox"
                        checked={showTrialMoves}
                        onChange={(e) => setShowTrialMoves(e.target.checked)}
                        style={{ margin: 0 }}
                    />
                    Show trial moves
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    <input
                        type="checkbox"
                        checked={showExternalPotential}
                        onChange={(e) => setShowExternalPotential(e.target.checked)}
                        style={{ margin: 0 }}
                    />
                    Show external potential
                </label>
                <SliderWithInput
                    label="Profile window"
                    value={densityWindow}
                    onChange={(v) => setDensityWindow(Math.round(v))}
                    min={50} max={5000} step={50} decimals={0} unit="samples"
                    theme={theme}
                />
            </div>
        </div>
    );
};

export default GCMCSimulationControls;
