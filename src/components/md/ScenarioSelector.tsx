import React from 'react';
import { SimulationScenario, ScenarioConfig, SCENARIOS } from './scenarios';

interface ScenarioSelectorProps {
    scenario: SimulationScenario;
    onScenarioChange: (scenario: SimulationScenario) => void;
    isDark: boolean;
}

const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({
    scenario,
    onScenarioChange,
    isDark
}) => {
    const theme = {
        surface: isDark ? '#2d2d2d' : '#f8f9fa',
        border: isDark ? '#444' : '#ccc',
        text: isDark ? '#e0e0e0' : '#333',
        textMuted: isDark ? '#888' : '#666',
        selectBg: isDark ? '#3d3d3d' : '#fff',
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0.6rem',
            backgroundColor: theme.surface,
            borderRadius: '6px',
            border: `1px solid ${theme.border}`,
        }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Scenario:</label>
            <select
                value={scenario}
                onChange={(e) => onScenarioChange(e.target.value as SimulationScenario)}
                style={{
                    padding: '0.3rem 0.5rem',
                    borderRadius: '4px',
                    border: `1px solid ${theme.border}`,
                    backgroundColor: theme.selectBg,
                    color: theme.text,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                }}
            >
                {Object.entries(SCENARIOS).map(([key, config]) => (
                    <option key={key} value={key}>{config.name}</option>
                ))}
            </select>
            {scenario !== 'custom' && (
                <span style={{
                    fontSize: '0.75rem',
                    color: theme.textMuted,
                    maxWidth: '200px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}>
                    {SCENARIOS[scenario].description}
                </span>
            )}
        </div>
    );
};

export default ScenarioSelector;
