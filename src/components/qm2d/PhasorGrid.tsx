import React from 'react';
import { type QuantumState2D, MAX_QUANTUM_NUMBER, calcEnergy } from './physics';
import { PhasorCell, PhasorGrid as PhasorGridShell, PhasorMatrix } from '../shared/quantum';

export interface PhasorGridProps {
    activeStates: QuantumState2D[];
    tau: number;
    onToggleState: (nx: number, ny: number) => void;
    onSelectOnly: (nx: number, ny: number) => void;
    color: string;
}

const NUMBERS = Array.from({ length: MAX_QUANTUM_NUMBER }, (_, i) => i + 1);

/** (nx, ny) grid of phasors; (1,1) bottom-left. */
export const PhasorGrid: React.FC<PhasorGridProps> = ({ activeStates, tau, onToggleState, onSelectOnly, color }) => (
    <PhasorGridShell
        layout={
            <PhasorMatrix
                rows={[...NUMBERS].reverse()}
                cols={NUMBERS}
                rowTitle={<>n<sub>y</sub></>}
                colTitle={<>n<sub>x</sub></>}
                renderCell={(ny, nx) => {
                    const energy = calcEnergy(nx, ny);
                    return (
                        <PhasorCell
                            phase={energy * tau}
                            active={activeStates.some((s) => s.nx === nx && s.ny === ny)}
                            color={color}
                            title={`State (${nx}, ${ny}), E = ${energy}`}
                            onToggle={() => onToggleState(nx, ny)}
                            onSelectOnly={() => onSelectOnly(nx, ny)}
                        />
                    );
                }}
            />
        }
    >
        {null}
    </PhasorGridShell>
);

export default PhasorGrid;
