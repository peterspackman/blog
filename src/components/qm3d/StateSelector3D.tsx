import React, { useState } from 'react';
import { type QuantumState3D, MAX_QUANTUM_NUMBER, calcEnergy } from './physics';
import { PhasorCell, PhasorGrid, PhasorMatrix } from '../shared/quantum';
import { ControlGroup, SegmentedControl } from '../shared/controls';

export interface StateSelector3DProps {
    activeStates: QuantumState3D[];
    tau: number;
    onToggleState: (nx: number, ny: number, nz: number) => void;
    onSelectOnly: (nx: number, ny: number, nz: number) => void;
    color: string;
}

const NUMBERS = Array.from({ length: MAX_QUANTUM_NUMBER }, (_, i) => i + 1);

/** One (nx, ny) layer of phasors at a time, chosen by nz. */
export const StateSelector3D: React.FC<StateSelector3DProps> = ({ activeStates, tau, onToggleState, onSelectOnly, color }) => {
    const [nz, setNz] = useState(1);
    return (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
            <ControlGroup label={<>Layer <span style={{ textTransform: 'none' }}>(n<sub>z</sub>)</span></>}>
                <SegmentedControl<number>
                    aria-label="nz layer"
                    value={nz}
                    onChange={setNz}
                    options={NUMBERS.map((n) => ({
                        value: n,
                        // A dot marks layers that hold active states.
                        label: activeStates.some((s) => s.nz === n) ? `${n}•` : String(n),
                    }))}
                />
            </ControlGroup>
            <PhasorGrid
                layout={
                    <PhasorMatrix
                        rows={[...NUMBERS].reverse()}
                        cols={NUMBERS}
                        rowTitle={<>n<sub>y</sub></>}
                        colTitle={<>n<sub>x</sub></>}
                        renderCell={(ny, nx) => {
                            const energy = calcEnergy(nx, ny, nz);
                            return (
                                <PhasorCell
                                    phase={energy * tau}
                                    active={activeStates.some((s) => s.nx === nx && s.ny === ny && s.nz === nz)}
                                    color={color}
                                    title={`State (${nx}, ${ny}, ${nz}), E = ${energy}`}
                                    onToggle={() => onToggleState(nx, ny, nz)}
                                    onSelectOnly={() => onSelectOnly(nx, ny, nz)}
                                />
                            );
                        }}
                    />
                }
            >
                {null}
            </PhasorGrid>
        </div>
    );
};

export default StateSelector3D;
