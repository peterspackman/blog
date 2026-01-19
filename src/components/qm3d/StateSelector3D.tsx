import React, { useState } from 'react';
import {
    type QuantumState3D,
    MAX_QUANTUM_NUMBER,
    calcEnergy,
    statesEqual,
} from './physics';
import type { ControlTheme } from '../shared/controls';

const PHASOR_COLOR = '#3b82f6'; // Blue

export interface StateSelector3DProps {
    activeStates: QuantumState3D[];
    tau: number;
    onToggleState: (nx: number, ny: number, nz: number) => void;
    theme: ControlTheme;
}

export const StateSelector3D: React.FC<StateSelector3DProps> = ({
    activeStates,
    tau,
    onToggleState,
    theme,
}) => {
    const [selectedNz, setSelectedNz] = useState(1);

    const cellSize = 36;
    const fontSize = 11;
    const labelSize = 14;

    // Check if a state is active
    const isActive = (nx: number, ny: number, nz: number) =>
        activeStates.some((s) => s.nx === nx && s.ny === ny && s.nz === nz);

    // Generate grid for current nz - ny from MAX to 1 so (1,1) is bottom-left
    const rows = [];
    for (let ny = MAX_QUANTUM_NUMBER; ny >= 1; ny--) {
        const cells = [];
        for (let nx = 1; nx <= MAX_QUANTUM_NUMBER; nx++) {
            const active = isActive(nx, ny, selectedNz);
            const energy = calcEnergy(nx, ny, selectedNz);

            // Phase for conic gradient
            const phase = energy * tau;
            const phaseDegrees = ((phase * 180) / Math.PI) % 360;

            let background: string;
            if (active) {
                background = `conic-gradient(from -90deg, ${PHASOR_COLOR} ${phaseDegrees}deg, ${PHASOR_COLOR}20 ${phaseDegrees}deg)`;
            } else {
                background = 'transparent';
            }

            cells.push(
                <div
                    key={`${nx}-${ny}-${selectedNz}`}
                    onClick={() => onToggleState(nx, ny, selectedNz)}
                    title={`(${nx},${ny},${selectedNz}) E=${energy}`}
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
            <div
                key={ny}
                style={{ display: 'flex', gap: '3px', alignItems: 'center' }}
            >
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
                Quantum States (n<sub>x</sub>, n<sub>y</sub>, n<sub>z</sub>)
            </div>

            {/* nz tabs */}
            <div
                style={{
                    display: 'flex',
                    gap: '4px',
                    marginBottom: '8px',
                }}
            >
                <span
                    style={{
                        fontSize: '0.75rem',
                        color: theme.textMuted,
                        fontWeight: 600,
                        alignSelf: 'center',
                        marginRight: '4px',
                    }}
                >
                    n<sub>z</sub>=
                </span>
                {Array.from({ length: MAX_QUANTUM_NUMBER }, (_, i) => i + 1).map(
                    (nz) => {
                        const isSelected = nz === selectedNz;
                        // Count active states in this layer
                        const activeCount = activeStates.filter(
                            (s) => s.nz === nz
                        ).length;

                        return (
                            <button
                                key={nz}
                                onClick={() => setSelectedNz(nz)}
                                style={{
                                    padding: '4px 12px',
                                    border: `1px solid ${isSelected ? theme.accent : theme.border}`,
                                    borderRadius: '4px',
                                    backgroundColor: isSelected
                                        ? theme.accent
                                        : 'transparent',
                                    color: isSelected ? '#fff' : theme.text,
                                    fontSize: '0.8rem',
                                    fontWeight: isSelected ? 600 : 400,
                                    cursor: 'pointer',
                                    position: 'relative',
                                }}
                            >
                                {nz}
                                {activeCount > 0 && (
                                    <span
                                        style={{
                                            position: 'absolute',
                                            top: '-4px',
                                            right: '-4px',
                                            width: '14px',
                                            height: '14px',
                                            borderRadius: '50%',
                                            backgroundColor: PHASOR_COLOR,
                                            color: '#fff',
                                            fontSize: '9px',
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        {activeCount}
                                    </span>
                                )}
                            </button>
                        );
                    }
                )}
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
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                    }}
                >
                    {rows}

                    {/* X-axis numbers + nx label */}
                    <div
                        style={{
                            display: 'flex',
                            gap: '3px',
                            marginTop: '2px',
                            alignItems: 'center',
                        }}
                    >
                        {/* Spacer for Y-axis label column */}
                        <div style={{ width: labelSize }} />
                        {Array.from(
                            { length: MAX_QUANTUM_NUMBER },
                            (_, i) => (
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
                            )
                        )}
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
                Select n<sub>z</sub> layer, then click cells to toggle states.
            </p>
        </div>
    );
};

export default StateSelector3D;
