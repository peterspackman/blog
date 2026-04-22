import React from 'react';
import { energyRatio, MAX_STATES, type StateSet } from './physics';
import type { ControlTheme } from '../shared/controls';

const PHASOR_COLOR = '#3b82f6';

export interface PhasorDiagramProps {
    activeStates: number[];
    tau: number;
    stateSet: StateSet;
    onToggleState: (n: number) => void;
    onSelectOnly: (n: number) => void;
    theme: ControlTheme;
}

export const PhasorDiagram: React.FC<PhasorDiagramProps> = ({
    activeStates,
    tau,
    stateSet,
    onToggleState,
    onSelectOnly,
    theme,
}) => {
    const cellSize = 36;
    const fontSize = 11;
    const numStates = Math.min(MAX_STATES, stateSet.numStates);

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

            {/* Phasor cells + labels are rendered as one flexing grid of
                stacked (phasor, label) pairs so that when the row wraps on
                narrow widths the labels follow the phasors they describe. */}
            <div
                style={{
                    display: 'flex',
                    gap: '3px',
                    flexWrap: 'wrap',
                    rowGap: '6px',
                }}
            >
                {Array.from({ length: numStates }, (_, n) => {
                    const isActive = activeStates.includes(n);
                    const ratio = energyRatio(stateSet, n);
                    const phase = ratio * tau;
                    const phaseDegrees = ((phase * 180) / Math.PI) % 360;

                    const background = isActive
                        ? `conic-gradient(from -90deg, ${PHASOR_COLOR} ${phaseDegrees}deg, ${PHASOR_COLOR}20 ${phaseDegrees}deg)`
                        : 'transparent';

                    return (
                        <div
                            key={n}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '2px',
                            }}
                        >
                            <div
                                onClick={() => onToggleState(n)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    onSelectOnly(n);
                                }}
                                title={`n=${n}  E/E₀=${ratio.toFixed(2)}  E=${stateSet.energy(n).toFixed(3)}\nLeft-click: toggle · Right-click: show only`}
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
                            <div
                                style={{
                                    width: cellSize,
                                    fontSize,
                                    color: theme.textMuted,
                                    textAlign: 'center',
                                    lineHeight: 1,
                                }}
                            >
                                {n}
                            </div>
                        </div>
                    );
                })}
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
                Left-click: toggle · Right-click: show only. Fill shows phase evolution.
            </p>
        </div>
    );
};

export default PhasorDiagram;
