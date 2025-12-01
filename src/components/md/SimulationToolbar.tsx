import React from 'react';
import { SimulationScenario, SCENARIOS } from './scenarios';

interface SimulationToolbarProps {
    // Playback
    running: boolean;
    setRunning: (running: boolean) => void;
    onReset: () => void;
    minimizing?: boolean;
    onMinimize?: () => void;

    // Scenario
    scenario: SimulationScenario;
    onScenarioChange: (scenario: SimulationScenario) => void;

    // Status
    time: number;  // in picoseconds
    stepCount: number;

    // Draw mode (optional - only shown for custom scenario)
    isDrawMode?: boolean;
    setIsDrawMode?: (mode: boolean) => void;
    brushRadius?: number;
    setBrushRadius?: (radius: number) => void;
    fieldStrength?: number;
    setFieldStrength?: (strength: number) => void;
    showField?: boolean;
    setShowField?: (show: boolean) => void;
    fieldChargeMode?: boolean;
    setFieldChargeMode?: (mode: boolean) => void;
    onClearField?: () => void;

    // Theme
    isDark: boolean;
}

const SimulationToolbar: React.FC<SimulationToolbarProps> = ({
    running,
    setRunning,
    onReset,
    minimizing = false,
    onMinimize,
    scenario,
    onScenarioChange,
    time,
    stepCount,
    isDrawMode = false,
    setIsDrawMode,
    brushRadius = 20,
    setBrushRadius,
    fieldStrength = 100,
    setFieldStrength,
    showField = true,
    setShowField,
    fieldChargeMode = false,
    setFieldChargeMode,
    onClearField,
    isDark,
}) => {
    const theme = {
        bg: isDark ? '#1e1e1e' : '#ffffff',
        surface: isDark ? '#2d2d2d' : '#f5f5f5',
        border: isDark ? '#3d3d3d' : '#e0e0e0',
        text: isDark ? '#e0e0e0' : '#333',
        textMuted: isDark ? '#888' : '#666',
        accent: isDark ? '#60a5fa' : '#2563eb',
        accentHover: isDark ? '#3b82f6' : '#1d4ed8',
    };

    const buttonBase: React.CSSProperties = {
        padding: '0.4rem 0.7rem',
        border: 'none',
        borderRadius: '6px',
        fontSize: '0.8rem',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.3rem',
        transition: 'all 0.15s ease',
    };

    const scenarioKeys = Object.keys(SCENARIOS) as SimulationScenario[];

    const showDrawControls = scenario === 'custom' && setIsDrawMode;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* Main toolbar row */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.5rem 0.75rem',
                backgroundColor: theme.bg,
                borderRadius: '8px',
                border: `1px solid ${theme.border}`,
                flexWrap: 'wrap',
            }}>
                {/* Playback controls */}
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                        onClick={() => setRunning(!running)}
                        style={{
                            ...buttonBase,
                            backgroundColor: running ? '#f59e0b' : '#10b981',
                            color: '#fff',
                            minWidth: '70px',
                        }}
                    >
                        {running ? 'Pause' : 'Start'}
                    </button>
                    <button
                        onClick={onReset}
                        title="Reset simulation"
                        style={{
                            ...buttonBase,
                            backgroundColor: '#ef4444',
                            color: '#fff',
                        }}
                    >
                        Reset
                    </button>
                    {onMinimize && (
                        <button
                            onClick={onMinimize}
                            disabled={minimizing || running}
                            title="Energy minimization"
                            style={{
                                ...buttonBase,
                                backgroundColor: minimizing ? '#9ca3af' : theme.surface,
                                color: minimizing ? '#fff' : theme.text,
                                border: `1px solid ${theme.border}`,
                                opacity: running ? 0.5 : 1,
                                cursor: (minimizing || running) ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {minimizing ? '...' : 'Opt.'}
                        </button>
                    )}
                </div>

                {/* Divider */}
                <div style={{
                    width: '1px',
                    height: '24px',
                    backgroundColor: theme.border,
                }} />

                {/* Scenario pills */}
                <div style={{
                    display: 'flex',
                    gap: '0.25rem',
                    flexWrap: 'wrap',
                }}>
                    {scenarioKeys.map((key) => {
                        const isActive = scenario === key;
                        const config = SCENARIOS[key];
                        return (
                            <button
                                key={key}
                                onClick={() => onScenarioChange(key)}
                                title={config.description}
                                style={{
                                    padding: '0.3rem 0.6rem',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontSize: '0.75rem',
                                    fontWeight: isActive ? 600 : 400,
                                    cursor: 'pointer',
                                    backgroundColor: isActive ? theme.accent : theme.surface,
                                    color: isActive ? '#fff' : theme.textMuted,
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                {config.name}
                            </button>
                        );
                    })}
                </div>

                {/* Draw button (only in custom mode) */}
                {showDrawControls && (
                    <>
                        <div style={{
                            width: '1px',
                            height: '24px',
                            backgroundColor: theme.border,
                        }} />
                        <button
                            onClick={() => setIsDrawMode!(!isDrawMode)}
                            title="Toggle draw mode (left-click: attract, right-click: repel)"
                            style={{
                                ...buttonBase,
                                backgroundColor: isDrawMode ? theme.accent : theme.surface,
                                color: isDrawMode ? '#fff' : theme.text,
                                border: `1px solid ${theme.border}`,
                            }}
                        >
                            Draw
                        </button>
                    </>
                )}

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Status */}
                <div style={{
                    display: 'flex',
                    gap: '0.75rem',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    color: theme.textMuted,
                }}>
                    <span>{time.toFixed(2)} ps</span>
                    <span>{stepCount.toLocaleString()} steps</span>
                </div>
            </div>

            {/* Draw controls row (shown when draw mode is active) */}
            {showDrawControls && isDrawMode && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.4rem 0.75rem',
                    backgroundColor: theme.bg,
                    borderRadius: '8px',
                    border: `1px solid ${theme.border}`,
                    fontSize: '0.8rem',
                }}>
                    <span style={{ color: theme.textMuted, fontSize: '0.75rem' }}>
                        Left-click: attract | Right-click: repel
                    </span>

                    {/* Size slider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{ color: theme.textMuted, fontSize: '0.75rem' }}>Size</span>
                        <input
                            type="range"
                            min="2"
                            max="30"
                            step="1"
                            value={brushRadius}
                            onChange={(e) => setBrushRadius?.(parseFloat(e.target.value))}
                            style={{ width: '60px', accentColor: theme.accent }}
                        />
                    </div>

                    {/* Strength slider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{ color: theme.textMuted, fontSize: '0.75rem' }}>Strength</span>
                        <input
                            type="range"
                            min="10"
                            max="200"
                            step="10"
                            value={fieldStrength}
                            onChange={(e) => setFieldStrength?.(parseFloat(e.target.value))}
                            style={{ width: '60px', accentColor: theme.accent }}
                        />
                    </div>

                    {/* Show field toggle */}
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        cursor: 'pointer',
                        color: theme.textMuted,
                        fontSize: '0.75rem',
                    }}>
                        <input
                            type="checkbox"
                            checked={showField}
                            onChange={(e) => setShowField?.(e.target.checked)}
                            style={{ margin: 0, accentColor: theme.accent }}
                        />
                        Show
                    </label>

                    {/* Charge mode toggle */}
                    <label
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            cursor: 'pointer',
                            color: theme.textMuted,
                            fontSize: '0.75rem',
                        }}
                        title="Field affects particles based on their type (+/-)"
                    >
                        <input
                            type="checkbox"
                            checked={fieldChargeMode}
                            onChange={(e) => setFieldChargeMode?.(e.target.checked)}
                            style={{ margin: 0, accentColor: theme.accent }}
                        />
                        +/-
                    </label>

                    {/* Clear button */}
                    <button
                        onClick={onClearField}
                        title="Clear all drawn fields"
                        style={{
                            padding: '0.25rem 0.5rem',
                            border: `1px solid ${theme.border}`,
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            backgroundColor: theme.surface,
                            color: theme.textMuted,
                        }}
                    >
                        Clear
                    </button>
                </div>
            )}
        </div>
    );
};

export default SimulationToolbar;
