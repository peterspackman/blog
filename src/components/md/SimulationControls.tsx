import React, { useState } from 'react';
import { BoundaryType } from './BoundaryConditions';
import { ThermostatType } from './Thermostats';
import { SliderWithInput } from '../shared/controls';

// 1 internal time unit = sqrt(amu·Å²/eV) ≈ 10.18 fs
const TIME_UNIT_TO_FS = 10.1805;

interface SimulationControlsProps {
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
    // Advanced controls
    charges: number[];
    setCharges: (charges: number[]) => void;
    typeLabels: string[];
    setTypeLabels: (labels: string[]) => void;
    typeColors: string[];
    setTypeColors: (colors: string[]) => void;
    epsilonMatrix: number[][];
    sigmaMatrix: number[][];
    updateInteractionParameter: (paramType: string, type1: number, type2: number, value: number) => void;
    numTypes: number;
    // Debug visualization
    showCells?: boolean;
    setShowCells?: (show: boolean) => void;
    showInteractions?: boolean;
    setShowInteractions?: (show: boolean) => void;
    showCutoffRadius?: boolean;
    setShowCutoffRadius?: (show: boolean) => void;
    cutoffRadius?: number;
    setCutoffRadius?: (radius: number) => void;
    // Theme
    isDark?: boolean;
}

const SimulationControls: React.FC<SimulationControlsProps> = ({
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
    typeColors, setTypeColors,
    epsilonMatrix, sigmaMatrix, updateInteractionParameter,
    numTypes,
    showCells, setShowCells,
    showInteractions, setShowInteractions,
    showCutoffRadius, setShowCutoffRadius,
    cutoffRadius, setCutoffRadius,
    isDark = false
}) => {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showTiming, setShowTiming] = useState(false);
    const [useCombiningRules, setUseCombiningRules] = useState(true);

    // Theme colors
    const theme = {
        background: isDark ? '#2d2d2d' : '#f8f9fa',
        surface: isDark ? '#3d3d3d' : '#ffffff',
        border: isDark ? '#555' : '#e0e0e0',
        text: isDark ? '#e0e0e0' : '#333',
        textMuted: isDark ? '#999' : '#666',
        accent: isDark ? '#6b9eff' : '#2563eb',
        inputBg: isDark ? '#4a4a4a' : '#f3f4f6',
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

    // Helper to update epsilon with combining rules
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

    // Helper to update sigma with combining rules
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

    return (
        <div style={{
            backgroundColor: theme.background,
            padding: '1rem',
            borderRadius: '8px',
            border: `1px solid ${theme.border}`,
            color: theme.text,
            fontSize: '0.85rem',
        }}>
            {/* System */}
            <div style={sectionStyle}>
                <div style={sectionTitleStyle}>System</div>
                <SliderWithInput
                    label="Particles"
                    value={numParticles}
                    onChange={(v) => setNumParticles(Math.round(v))}
                    min={2} max={500} step={1} decimals={0}
                    theme={theme}
                />
                <SliderWithInput
                    label="Temperature"
                    value={temperature}
                    onChange={setTemperature}
                    min={1} max={3000} step={10} decimals={0} unit="K"
                    theme={theme}
                />
                <SliderWithInput
                    label="Type ratio"
                    value={orangeRatio}
                    onChange={setOrangeRatio}
                    min={0} max={1} step={0.1} decimals={1}
                    theme={theme}
                />
                <div style={{ marginTop: '0.25rem' }}>
                    <select value={boundaryType} onChange={(e) => setBoundaryType(e.target.value as BoundaryType)} style={selectStyle}>
                        <option value={BoundaryType.PERIODIC}>Periodic boundaries</option>
                        <option value={BoundaryType.REFLECTIVE}>Reflective walls</option>
                        <option value={BoundaryType.ELASTIC}>Elastic walls</option>
                    </select>
                </div>
            </div>

            {/* Interactions */}
            <div style={sectionStyle}>
                <div style={sectionTitleStyle}>Interactions</div>

                {/* Per-type LJ parameters */}
                {[0, 1].slice(0, numTypes).map((i) => (
                    <div key={i} style={{ marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                            <div style={{ width: '10px', height: '10px', backgroundColor: typeColors[i], borderRadius: '2px' }} />
                            <span style={{ fontSize: '0.75rem', color: theme.textMuted }}>-</span>
                            <div style={{ width: '10px', height: '10px', backgroundColor: typeColors[i], borderRadius: '2px' }} />
                        </div>
                        <SliderWithInput
                            label="ε (well depth)"
                            value={epsilonMatrix[i][i]}
                            onChange={(v) => updateEpsilon(i, i, v)}
                            min={0.001} max={2} step={0.01} decimals={3} unit="eV"
                            theme={theme}
                        />
                        <SliderWithInput
                            label="σ (size)"
                            value={sigmaMatrix[i][i]}
                            onChange={(v) => updateSigma(i, i, v)}
                            min={1} max={8} step={0.1} decimals={1} unit="Å"
                            theme={theme}
                        />
                    </div>
                ))}

                {/* Cross interaction */}
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
                                    onChange={(e) => {
                                        const checked = e.target.checked;
                                        setUseCombiningRules(checked);
                                        if (checked) {
                                            const crossEps = Math.sqrt(epsilonMatrix[0][0] * epsilonMatrix[1][1]);
                                            const crossSig = (sigmaMatrix[0][0] + sigmaMatrix[1][1]) / 2;
                                            updateInteractionParameter('epsilon', 0, 1, crossEps);
                                            updateInteractionParameter('epsilon', 1, 0, crossEps);
                                            updateInteractionParameter('sigma', 0, 1, crossSig);
                                            updateInteractionParameter('sigma', 1, 0, crossSig);
                                        }
                                    }}
                                    style={{ margin: 0 }}
                                />
                                <span style={{ color: theme.textMuted }}>auto</span>
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
                                    min={0.001} max={2} step={0.01} decimals={3} unit="eV"
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

                {/* Coulomb */}
                <div style={{ marginTop: '0.5rem' }}>
                    <SliderWithInput
                        label="Coulomb strength"
                        value={chargeScale}
                        onChange={setChargeScale}
                        min={0} max={5} step={0.1} decimals={1} unit="×"
                        theme={theme}
                    />
                </div>
            </div>

            {/* Visual */}
            <div style={{ marginBottom: '0.75rem' }}>
                <SliderWithInput
                    label="Circle size"
                    value={visualScale}
                    onChange={setVisualScale}
                    min={1} max={15} step={0.5} decimals={1}
                    theme={theme}
                />
            </div>

            {/* Timing (collapsible) */}
            <div style={{ marginBottom: '0.75rem' }}>
                <button
                    onClick={() => setShowTiming(!showTiming)}
                    style={{
                        width: '100%',
                        padding: '0.4rem',
                        border: `1px solid ${theme.border}`,
                        borderRadius: '4px',
                        backgroundColor: theme.surface,
                        color: theme.textMuted,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <span>Timing</span>
                    <span style={{ transform: showTiming ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                </button>
                {showTiming && (
                    <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: theme.surface, borderRadius: '4px' }}>
                        <SliderWithInput
                            label="Time step"
                            value={timeStep * TIME_UNIT_TO_FS}
                            onChange={(v) => setTimeStep(v / TIME_UNIT_TO_FS)}
                            min={0.1} max={10} step={0.1} decimals={1} unit="fs"
                            theme={theme}
                        />
                        <SliderWithInput
                            label="Steps/frame"
                            value={stepsPerFrame}
                            onChange={(v) => setStepsPerFrame(Math.round(v))}
                            min={1} max={100} step={1} decimals={0}
                            theme={theme}
                        />
                        <div style={{ fontSize: '0.65rem', color: theme.textMuted, marginTop: '0.25rem' }}>
                            {(timeStep * TIME_UNIT_TO_FS * stepsPerFrame).toFixed(0)} fs/frame
                        </div>
                    </div>
                )}
            </div>

            {/* Advanced (collapsible) */}
            <div>
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    style={{
                        width: '100%',
                        padding: '0.4rem',
                        border: `1px solid ${theme.border}`,
                        borderRadius: '4px',
                        backgroundColor: theme.surface,
                        color: theme.textMuted,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <span>Advanced</span>
                    <span style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                </button>

                {showAdvanced && (
                    <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: theme.surface, borderRadius: '4px' }}>
                        {/* Thermostat */}
                        <div style={{ marginBottom: '0.75rem' }}>
                            <div style={{ ...sectionTitleStyle, marginBottom: '0.25rem' }}>Thermostat</div>
                            <select value={thermostatType} onChange={(e) => setThermostatType(e.target.value as ThermostatType)} style={selectStyle}>
                                <option value={ThermostatType.NONE}>None (NVE)</option>
                                <option value={ThermostatType.LANGEVIN}>Langevin</option>
                                <option value={ThermostatType.BERENDSEN}>Berendsen</option>
                                <option value={ThermostatType.VELOCITY_RESCALING}>Velocity rescaling</option>
                                <option value={ThermostatType.NOSE_HOOVER}>Nosé-Hoover</option>
                            </select>
                        </div>

                        {/* Particle Types */}
                        <div style={{ marginBottom: '0.75rem' }}>
                            <div style={{ ...sectionTitleStyle, marginBottom: '0.5rem' }}>Particle Types</div>
                            {typeLabels.map((label, i) => (
                                <div key={i} style={{
                                    display: 'grid',
                                    gridTemplateColumns: '60px 50px 1fr',
                                    gap: '0.5rem',
                                    alignItems: 'center',
                                    marginBottom: '0.5rem',
                                }}>
                                    {/* Label input */}
                                    <input
                                        type="text"
                                        value={label}
                                        onChange={(e) => {
                                            const newLabels = [...typeLabels];
                                            newLabels[i] = e.target.value;
                                            setTypeLabels(newLabels);
                                        }}
                                        style={{
                                            padding: '0.2rem 0.3rem',
                                            fontSize: '0.75rem',
                                            border: `1px solid ${theme.border}`,
                                            borderRadius: '3px',
                                            backgroundColor: theme.inputBg,
                                            color: theme.text,
                                        }}
                                        placeholder="Label"
                                    />
                                    {/* Charge input */}
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={charges[i]}
                                        onChange={(e) => {
                                            const newCharges = [...charges];
                                            newCharges[i] = parseFloat(e.target.value) || 0;
                                            setCharges(newCharges);
                                        }}
                                        style={{
                                            padding: '0.2rem 0.3rem',
                                            fontSize: '0.75rem',
                                            border: `1px solid ${theme.border}`,
                                            borderRadius: '3px',
                                            backgroundColor: theme.inputBg,
                                            color: theme.text,
                                        }}
                                        title="Charge (e)"
                                    />
                                    {/* Color select */}
                                    <select
                                        value={typeColors[i]}
                                        onChange={(e) => {
                                            const newColors = [...typeColors];
                                            newColors[i] = e.target.value;
                                            setTypeColors(newColors);
                                        }}
                                        style={{
                                            ...selectStyle,
                                            fontSize: '0.7rem',
                                            padding: '0.25rem',
                                        }}
                                    >
                                        <option value="rgba(255, 165, 0, 0.8)">Orange</option>
                                        <option value="rgba(0, 100, 255, 0.8)">Blue</option>
                                        <option value="rgba(255, 50, 50, 0.8)">Red</option>
                                        <option value="rgba(50, 180, 50, 0.8)">Green</option>
                                        <option value="rgba(160, 50, 200, 0.8)">Purple</option>
                                        <option value="rgba(100, 100, 100, 0.8)">Gray</option>
                                        <option value="rgba(128, 128, 255, 0.8)">Light Blue</option>
                                    </select>
                                </div>
                            ))}
                            <div style={{ fontSize: '0.65rem', color: theme.textMuted, marginTop: '0.25rem' }}>
                                Label, Charge (e), Color
                            </div>
                        </div>

                        {/* Debug Visualization */}
                        {setShowCells && setShowInteractions && setShowCutoffRadius && setCutoffRadius && (
                            <div style={{ marginBottom: '0.5rem' }}>
                                <div style={{ ...sectionTitleStyle, marginBottom: '0.5rem' }}>Debug Visualization</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={showCells}
                                            onChange={(e) => setShowCells(e.target.checked)}
                                        />
                                        Show cells
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={showInteractions}
                                            onChange={(e) => setShowInteractions(e.target.checked)}
                                        />
                                        Show interactions
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={showCutoffRadius}
                                            onChange={(e) => setShowCutoffRadius(e.target.checked)}
                                        />
                                        Show cutoff radius
                                    </label>
                                    <SliderWithInput
                                        label="Cutoff radius"
                                        value={cutoffRadius ?? 12}
                                        onChange={setCutoffRadius}
                                        min={6} max={12} step={0.5} decimals={1} unit="Å"
                                        theme={theme}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SimulationControls;
