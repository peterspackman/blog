import React from 'react';
import {
    getEnergyRatio,
    MAX_STATES,
    type PotentialConfig,
} from './physics';
import type { ControlTheme } from '../shared/controls';

// Single color for all phasors
const PHASOR_COLOR = '#3b82f6'; // Blue

export interface PhasorDiagramProps {
    activeStates: number[];
    tau: number;
    potentialConfig: PotentialConfig;
    onToggleState: (n: number) => void;
    theme: ControlTheme;
}

export const PhasorDiagram: React.FC<PhasorDiagramProps> = ({
    activeStates,
    tau,
    potentialConfig,
    onToggleState,
    theme,
}) => {
    const cellSize = 36;
    const fontSize = 11;

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '12px',
                backgroundColor: theme.surface || theme.inputBg,
                borderRadius: '6px',
                border: `1px solid ${theme.border}`,
            }}
        >
            {/* Title */}
            <div
                style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: theme.text,
                    marginBottom: '4px',
                }}
            >
                Quantum States
            </div>

            {/* Horizontal row of state cells */}
            <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                {Array.from({ length: MAX_STATES }, (_, n) => {
                    const isActive = activeStates.includes(n);
                    const energyRatio = getEnergyRatio(n, potentialConfig);

                    // Phase for conic gradient - clock-like fill (clockwise)
                    const phase = energyRatio * tau;
                    // Normalize to [0, 360) degrees
                    const phaseDegrees = ((phase * 180 / Math.PI) % 360);

                    // Background based on state
                    let background: string;
                    if (isActive) {
                        // Clock-like fill from top (-90deg)
                        background = `conic-gradient(from -90deg, ${PHASOR_COLOR} ${phaseDegrees}deg, ${PHASOR_COLOR}20 ${phaseDegrees}deg)`;
                    } else {
                        // Inactive - transparent
                        background = 'transparent';
                    }

                    return (
                        <div
                            key={n}
                            onClick={() => onToggleState(n)}
                            title={`n=${n}, E ratio=${energyRatio.toFixed(2)}`}
                            role="button"
                            tabIndex={0}
                            style={{
                                width: cellSize,
                                height: cellSize,
                                border: `1px solid ${theme.border}`,
                                borderRadius: '4px',
                                background,
                                cursor: 'pointer',
                                fontSize,
                                color: theme.text,
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontFamily: 'system-ui, sans-serif',
                                userSelect: 'none',
                            }}
                        />
                    );
                })}
            </div>

            {/* State labels below */}
            <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                {Array.from({ length: MAX_STATES }, (_, n) => (
                    <div
                        key={n}
                        style={{
                            width: cellSize,
                            fontSize: fontSize,
                            color: theme.textMuted,
                            textAlign: 'center',
                        }}
                    >
                        {n}
                    </div>
                ))}
            </div>

            {/* Axis label */}
            <div
                style={{
                    fontSize: '0.75rem',
                    color: theme.textMuted,
                    fontWeight: 600,
                    textAlign: 'right',
                    marginTop: '2px',
                }}
            >
                n →
            </div>

            <p
                style={{
                    fontSize: '0.65rem',
                    color: theme.textMuted,
                    marginTop: '6px',
                    marginBottom: 0,
                    textAlign: 'center',
                }}
            >
                Click to toggle states. Fill shows phase evolution.
            </p>
        </div>
    );
};

export default PhasorDiagram;
