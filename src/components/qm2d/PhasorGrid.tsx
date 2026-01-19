import React from 'react';
import {
    type QuantumState2D,
    MAX_QUANTUM_NUMBER,
    calcEnergy,
} from './physics';
import type { ControlTheme } from '../shared/controls';

// Single color for all phasors
const PHASOR_COLOR = '#3b82f6'; // Blue

export interface PhasorGridProps {
    activeStates: QuantumState2D[];
    tau: number;
    onToggleState: (nx: number, ny: number) => void;
    theme: ControlTheme;
}

export const PhasorGrid: React.FC<PhasorGridProps> = ({
    activeStates,
    tau,
    onToggleState,
    theme,
}) => {
    // Fixed cell size for compact grid
    const cellSize = 36;
    const fontSize = 11;
    const labelSize = 14;

    // Check if a state is active
    const isActive = (nx: number, ny: number) =>
        activeStates.some((s) => s.nx === nx && s.ny === ny);

    // Generate grid - ny from MAX to 1 so (1,1) is bottom-left
    const rows = [];
    for (let ny = MAX_QUANTUM_NUMBER; ny >= 1; ny--) {
        const cells = [];
        for (let nx = 1; nx <= MAX_QUANTUM_NUMBER; nx++) {
            const active = isActive(nx, ny);
            const energy = calcEnergy(nx, ny);

            // Phase for conic gradient - clock-like fill (clockwise)
            const phase = energy * tau;
            // Normalize to [0, 360) degrees
            const phaseDegrees = ((phase * 180 / Math.PI) % 360);

            // Background based on state - single color for all phasors
            let background: string;
            if (active) {
                // Clock-like fill from top (-90deg)
                background = `conic-gradient(from -90deg, ${PHASOR_COLOR} ${phaseDegrees}deg, ${PHASOR_COLOR}20 ${phaseDegrees}deg)`;
            } else {
                // Inactive - transparent
                background = 'transparent';
            }

            cells.push(
                <div
                    key={`${nx}-${ny}`}
                    onClick={() => onToggleState(nx, ny)}
                    title={`(${nx},${ny}) E=${energy}`}
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
        }
        rows.push(
            <div key={ny} style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                {/* Y-axis label */}
                <div
                    style={{
                        width: labelSize,
                        fontSize: fontSize,
                        color: theme.textMuted,
                        textAlign: 'right',
                        paddingRight: '2px',
                    }}
                >
                    {ny}
                </div>
                {cells}
            </div>
        );
    }

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

            {/* Grid with axis labels */}
            <div style={{ display: 'flex', gap: '3px' }}>
                {/* ny label on the left */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '0.75rem',
                        color: theme.textMuted,
                        fontWeight: 600,
                        paddingRight: '4px',
                        whiteSpace: 'nowrap',
                    }}
                >
                    n<sub>y</sub>
                </div>

                {/* Main grid area with row labels */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {rows}

                    {/* X-axis numbers + nx label */}
                    <div style={{ display: 'flex', gap: '3px', marginTop: '2px', alignItems: 'center' }}>
                        {/* Spacer for Y-axis label column */}
                        <div style={{ width: labelSize }} />
                        {Array.from({ length: MAX_QUANTUM_NUMBER }, (_, i) => (
                            <div
                                key={i + 1}
                                style={{
                                    width: cellSize,
                                    fontSize: fontSize,
                                    color: theme.textMuted,
                                    textAlign: 'center',
                                }}
                            >
                                {i + 1}
                            </div>
                        ))}
                        {/* nx label */}
                        <span
                            style={{
                                fontSize: '0.75rem',
                                color: theme.textMuted,
                                fontWeight: 600,
                                paddingLeft: '4px',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            n<sub>x</sub>
                        </span>
                    </div>
                </div>
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

export default PhasorGrid;
