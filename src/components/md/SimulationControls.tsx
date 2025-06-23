import React, { useState } from 'react';
import { BoundaryType } from './BoundaryConditions';
import { ThermostatType } from './Thermostats';

interface SimulationControlsProps {
    running: boolean;
    setRunning: (running: boolean) => void;
    initializeParticles: () => void;
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
    epsilonScale: number;
    setEpsilonScale: (scale: number) => void;
    sigmaScale: number;
    setSigmaScale: (scale: number) => void;
    setBaseParticleRadius: (radius: number) => void;
    chargeScale: number;
    setChargeScale: (scale: number) => void;
    visualScale: number;
    setVisualScale: (scale: number) => void;
    // Advanced controls
    charges: number[];
    setCharges: (charges: number[]) => void;
    typeColors: string[];
    setTypeColors: (colors: string[]) => void;
    epsilonMatrix: number[][];
    sigmaMatrix: number[][];
    updateInteractionParameter: (paramType: string, type1: number, type2: number, value: number) => void;
    numTypes: number;
}

const SimulationControls: React.FC<SimulationControlsProps> = ({
    running, setRunning, initializeParticles,
    numParticles, setNumParticles,
    temperature, setTemperature,
    timeStep, setTimeStep,
    stepsPerFrame, setStepsPerFrame,
    orangeRatio, setOrangeRatio,
    boundaryType, setBoundaryType,
    thermostatType, setThermostatType,
    epsilonScale, setEpsilonScale,
    sigmaScale, setSigmaScale, setBaseParticleRadius,
    chargeScale, setChargeScale,
    visualScale, setVisualScale,
    charges, setCharges,
    typeColors, setTypeColors,
    epsilonMatrix, sigmaMatrix, updateInteractionParameter,
    numTypes
}) => {
    const [showAdvanced, setShowAdvanced] = useState(false);

    const controlStyle = {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '0.25rem',
        marginBottom: '0.75rem'
    };

    const labelStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.875rem',
        fontWeight: '500' as const
    };

    const valueStyle = {
        fontFamily: 'monospace',
        backgroundColor: '#e9ecef',
        padding: '0.125rem 0.25rem',
        borderRadius: '3px',
        fontSize: '0.875rem',
        minWidth: '3rem',
        textAlign: 'center' as const
    };

    const sliderStyle = {
        appearance: 'none' as const,
        width: '100%',
        height: '6px',
        borderRadius: '3px',
        background: '#d1d5db',
        outline: 'none'
    };

    const sectionStyle = {
        marginBottom: '1.5rem'
    };

    const sectionTitleStyle = {
        fontSize: '0.875rem',
        fontWeight: '600' as const,
        margin: '0 0 1rem 0',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
        color: '#374151'
    };

    return (
        <div style={{
            backgroundColor: '#f8f9fa',
            padding: '1.5rem',
            borderRadius: '8px',
            border: '1px solid #e9ecef',
            height: 'fit-content'
        }}>
            {/* Playback Controls */}
            <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: '600' }}>
                    Simulation Controls
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <button
                        onClick={() => setRunning(!running)}
                        style={{
                            padding: '0.5rem 1rem',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            backgroundColor: running ? '#ffba00' : '#00a86b',
                            color: running ? '#000' : '#fff'
                        }}
                    >
                        {running ? 'Pause' : 'Start'}
                    </button>
                    <button
                        onClick={initializeParticles}
                        style={{
                            padding: '0.5rem 1rem',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            backgroundColor: '#fa383e',
                            color: '#fff'
                        }}
                    >
                        Reset
                    </button>
                </div>
            </div>

            {/* System Parameters */}
            <div style={sectionStyle}>
                <h4 style={sectionTitleStyle}>System Parameters</h4>
                
                <div style={controlStyle}>
                    <div style={labelStyle}>
                        <span>Particles:</span>
                        <span style={valueStyle}>{numParticles}</span>
                    </div>
                    <input
                        type="range"
                        min="10"
                        max="200"
                        step="10"
                        value={numParticles}
                        onChange={(e) => setNumParticles(parseInt(e.target.value))}
                        style={sliderStyle}
                    />
                </div>

                <div style={controlStyle}>
                    <div style={labelStyle}>
                        <span>Temperature:</span>
                        <span style={valueStyle}>{temperature.toFixed(2)}</span>
                    </div>
                    <input
                        type="range"
                        min="0.0"
                        max="5"
                        step="0.1"
                        value={temperature}
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        style={sliderStyle}
                    />
                </div>

                <div style={controlStyle}>
                    <div style={labelStyle}>
                        <span>Orange/Blue Ratio:</span>
                        <span style={valueStyle}>{Math.round(orangeRatio * 100)}%/{Math.round((1-orangeRatio) * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0.1"
                        max="0.9"
                        step="0.1"
                        value={orangeRatio}
                        onChange={(e) => setOrangeRatio(parseFloat(e.target.value))}
                        style={sliderStyle}
                    />
                </div>

                <div style={controlStyle}>
                    <div style={labelStyle}>
                        <span>Boundary Type:</span>
                    </div>
                    <select
                        value={boundaryType}
                        onChange={(e) => setBoundaryType(e.target.value as BoundaryType)}
                        style={{
                            padding: '0.375rem 0.75rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            backgroundColor: '#ffffff',
                            fontSize: '0.875rem'
                        }}
                    >
                        <option value={BoundaryType.REFLECTIVE}>Reflective</option>
                        <option value={BoundaryType.PERIODIC}>Periodic</option>
                        <option value={BoundaryType.ABSORBING}>Absorbing</option>
                        <option value={BoundaryType.ELASTIC}>Elastic</option>
                    </select>
                </div>

                <div style={controlStyle}>
                    <div style={labelStyle}>
                        <span>Thermostat:</span>
                    </div>
                    <select
                        value={thermostatType}
                        onChange={(e) => setThermostatType(e.target.value as ThermostatType)}
                        style={{
                            padding: '0.375rem 0.75rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            backgroundColor: '#ffffff',
                            fontSize: '0.875rem'
                        }}
                    >
                        <option value={ThermostatType.VELOCITY_RESCALING}>Velocity Rescaling</option>
                        <option value={ThermostatType.BERENDSEN}>Berendsen</option>
                        <option value={ThermostatType.LANGEVIN}>Langevin</option>
                        <option value={ThermostatType.NOSE_HOOVER}>Nosé-Hoover</option>
                    </select>
                </div>
            </div>

            {/* Simulation Settings */}
            <div style={sectionStyle}>
                <h4 style={sectionTitleStyle}>Simulation Settings</h4>
                
                <div style={controlStyle}>
                    <div style={labelStyle}>
                        <span>Time step:</span>
                        <span style={valueStyle}>{timeStep}</span>
                    </div>
                    <input
                        type="range"
                        min="0.005"
                        max="0.1"
                        step="0.005"
                        value={timeStep}
                        onChange={(e) => setTimeStep(parseFloat(e.target.value))}
                        style={sliderStyle}
                    />
                </div>

                <div style={controlStyle}>
                    <div style={labelStyle}>
                        <span>Steps per frame:</span>
                        <span style={valueStyle}>{stepsPerFrame}</span>
                    </div>
                    <input
                        type="range"
                        min="10"
                        max="100"
                        step="10"
                        value={stepsPerFrame}
                        onChange={(e) => setStepsPerFrame(parseInt(e.target.value))}
                        style={sliderStyle}
                    />
                </div>
            </div>

            {/* Force Field Parameters */}
            <div style={sectionStyle}>
                <h4 style={sectionTitleStyle}>Force Field Parameters</h4>
                
                <div style={controlStyle}>
                    <div style={labelStyle}>
                        <span>Epsilon Scale (ε):</span>
                        <span style={valueStyle}>{epsilonScale.toFixed(2)}</span>
                    </div>
                    <input
                        type="range"
                        min="0.1"
                        max="2"
                        step="0.1"
                        value={epsilonScale}
                        onChange={(e) => setEpsilonScale(parseFloat(e.target.value))}
                        style={sliderStyle}
                    />
                </div>

                <div style={controlStyle}>
                    <div style={labelStyle}>
                        <span>Sigma Scale (σ):</span>
                        <span style={valueStyle}>{sigmaScale.toFixed(2)}</span>
                    </div>
                    <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={sigmaScale}
                        onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            setSigmaScale(value);
                            setBaseParticleRadius(1.5 * value);
                        }}
                        style={sliderStyle}
                    />
                </div>

                <div style={controlStyle}>
                    <div style={labelStyle}>
                        <span>Charge Scale (q):</span>
                        <span style={valueStyle}>{chargeScale.toFixed(2)}</span>
                    </div>
                    <input
                        type="range"
                        min="0.0"
                        max="5"
                        step="0.2"
                        value={chargeScale}
                        onChange={(e) => setChargeScale(parseFloat(e.target.value))}
                        style={sliderStyle}
                    />
                </div>

                <div style={controlStyle}>
                    <div style={labelStyle}>
                        <span>Circle Size:</span>
                        <span style={valueStyle}>{visualScale.toFixed(1)}</span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="15"
                        step="0.5"
                        value={visualScale}
                        onChange={(e) => setVisualScale(parseFloat(e.target.value))}
                        style={sliderStyle}
                    />
                </div>
            </div>

            {/* Advanced Controls */}
            <div>
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        backgroundColor: '#f8f9fa',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}
                >
                    <span>Advanced Parameters</span>
                    <span style={{ 
                        transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)', 
                        transition: 'transform 0.2s' 
                    }}>▼</span>
                </button>
                
                {showAdvanced && (
                    <div style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        backgroundColor: '#ffffff'
                    }}>
                        {/* Particle Types */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h5 style={{ fontSize: '0.875rem', fontWeight: '600', margin: '0 0 0.75rem 0' }}>
                                Particle Types
                            </h5>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                {/* Charges */}
                                <div>
                                    <h6 style={{ fontSize: '0.75rem', margin: '0 0 0.5rem 0', color: '#6b7280' }}>
                                        Charges
                                    </h6>
                                    {charges.map((charge, i) => (
                                        <div key={`charge-${i}`} style={{ marginBottom: '0.5rem' }}>
                                            <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                                                {i === 0 ? 'Orange' : 'Blue'}: {charge.toFixed(1)}
                                            </label>
                                            <input
                                                type="range"
                                                min="-3"
                                                max="3"
                                                step="0.5"
                                                value={charge}
                                                onChange={(e) => {
                                                    const newCharges = [...charges];
                                                    newCharges[i] = parseFloat(e.target.value);
                                                    setCharges(newCharges);
                                                }}
                                                style={{
                                                    width: '100%',
                                                    appearance: 'none',
                                                    height: '4px',
                                                    borderRadius: '2px',
                                                    background: '#d1d5db'
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                                
                                {/* Colors */}
                                <div>
                                    <h6 style={{ fontSize: '0.75rem', margin: '0 0 0.5rem 0', color: '#6b7280' }}>
                                        Colors
                                    </h6>
                                    {typeColors.map((color, i) => (
                                        <div key={`color-${i}`} style={{ marginBottom: '0.5rem' }}>
                                            <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                                                Type {i}:
                                            </label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{
                                                    width: '20px',
                                                    height: '20px',
                                                    backgroundColor: color,
                                                    border: '1px solid #ccc',
                                                    borderRadius: '3px'
                                                }} />
                                                <select
                                                    value={color}
                                                    onChange={(e) => {
                                                        const newColors = [...typeColors];
                                                        newColors[i] = e.target.value;
                                                        setTypeColors(newColors);
                                                    }}
                                                    style={{
                                                        flex: 1,
                                                        padding: '0.25rem',
                                                        border: '1px solid #d1d5db',
                                                        borderRadius: '4px',
                                                        fontSize: '0.75rem'
                                                    }}
                                                >
                                                    <option value="rgba(255, 165, 0, 0.8)">Orange</option>
                                                    <option value="rgba(0, 0, 255, 0.8)">Blue</option>
                                                    <option value="rgba(255, 0, 0, 0.8)">Red</option>
                                                    <option value="rgba(0, 128, 0, 0.8)">Green</option>
                                                    <option value="rgba(128, 0, 128, 0.8)">Purple</option>
                                                    <option value="rgba(0, 0, 0, 0.8)">Black</option>
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        {/* Interaction Matrix */}
                        <div>
                            <h5 style={{ fontSize: '0.875rem', fontWeight: '600', margin: '0 0 0.75rem 0' }}>
                                Pair Interactions
                            </h5>
                            
                            <div style={{ fontSize: '0.75rem', overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f3f4f6' }}>
                                            <th style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.7rem' }}>Pair</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.7rem' }}>ε</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.7rem' }}>σ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.from({ length: numTypes }).map((_, i) =>
                                            Array.from({ length: i + 1 }).map((_, j) => (
                                                <tr key={`interaction-${i}-${j}`} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                    <td style={{ padding: '0.5rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                            <div style={{ width: '12px', height: '12px', backgroundColor: typeColors[i], borderRadius: '2px' }}></div>
                                                            <div style={{ width: '12px', height: '12px', backgroundColor: typeColors[j], borderRadius: '2px' }}></div>
                                                            <span style={{ fontSize: '0.7rem' }}>{i}-{j}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '0.5rem' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <input
                                                                type="range"
                                                                min="0.1"
                                                                max="2.0"
                                                                step="0.1"
                                                                value={epsilonMatrix[i][j]}
                                                                onChange={(e) => updateInteractionParameter('epsilon', i, j, parseFloat(e.target.value))}
                                                                style={{
                                                                    width: '60px',
                                                                    appearance: 'none',
                                                                    height: '3px',
                                                                    borderRadius: '2px',
                                                                    background: '#d1d5db'
                                                                }}
                                                            />
                                                            <span style={{ fontSize: '0.65rem', marginTop: '0.25rem' }}>{epsilonMatrix[i][j].toFixed(1)}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '0.5rem' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <input
                                                                type="range"
                                                                min="1.0"
                                                                max="5.0"
                                                                step="0.2"
                                                                value={sigmaMatrix[i][j]}
                                                                onChange={(e) => updateInteractionParameter('sigma', i, j, parseFloat(e.target.value))}
                                                                style={{
                                                                    width: '60px',
                                                                    appearance: 'none',
                                                                    height: '3px',
                                                                    borderRadius: '2px',
                                                                    background: '#d1d5db'
                                                                }}
                                                            />
                                                            <span style={{ fontSize: '0.65rem', marginTop: '0.25rem' }}>{sigmaMatrix[i][j].toFixed(1)}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SimulationControls;