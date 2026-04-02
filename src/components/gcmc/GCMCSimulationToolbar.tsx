import React from 'react';
import { GCMCScenario, GCMC_SCENARIOS } from './scenarios';

interface GCMCSimulationToolbarProps {
    running: boolean;
    setRunning: (running: boolean) => void;
    onReset: () => void;
    scenario: GCMCScenario;
    onScenarioChange: (scenario: GCMCScenario) => void;
    stepCount: number;
    particleCount: number;
    acceptanceRates: Record<string, number>;
    isDark: boolean;
}

const GCMCSimulationToolbar: React.FC<GCMCSimulationToolbarProps> = ({
    running,
    setRunning,
    onReset,
    scenario,
    onScenarioChange,
    stepCount,
    particleCount,
    acceptanceRates,
    isDark,
}) => {
    const theme = {
        bg: isDark ? '#1e1e1e' : '#ffffff',
        surface: isDark ? '#2d2d2d' : '#f5f5f5',
        border: isDark ? '#3d3d3d' : '#e0e0e0',
        text: isDark ? '#e0e0e0' : '#333',
        textMuted: isDark ? '#888' : '#666',
        accent: isDark ? '#60a5fa' : '#2563eb',
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

    const scenarioKeys = Object.keys(GCMC_SCENARIOS) as GCMCScenario[];

    return (
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
            </div>

            {/* Divider */}
            <div style={{ width: '1px', height: '24px', backgroundColor: theme.border }} />

            {/* Scenario pills */}
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                {scenarioKeys.map((key) => {
                    const isActive = scenario === key;
                    const config = GCMC_SCENARIOS[key];
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

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Status */}
            <div style={{
                display: 'flex',
                gap: '0.75rem',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: theme.textMuted,
                flexWrap: 'wrap',
            }}>
                <span>N = {particleCount}</span>
                <span>{stepCount.toLocaleString()} steps</span>
                <span title="Displacement / Insertion / Deletion acceptance rates">
                    Acc: {(acceptanceRates.displacement * 100).toFixed(0)}%
                    / {(acceptanceRates.insertion * 100).toFixed(0)}%
                    / {(acceptanceRates.deletion * 100).toFixed(0)}%
                </span>
            </div>
        </div>
    );
};

export default GCMCSimulationToolbar;
