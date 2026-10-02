import React from 'react';
import { energyRatio, MAX_STATES, type StateSet } from './physics';
import { PhasorCell, PhasorGrid } from '../shared/quantum';
import type { VizTheme } from '../shared/viz';
import { stateColor } from './WavefunctionCanvas';

export interface PhasorDiagramProps {
    activeStates: number[];
    tau: number;
    stateSet: StateSet;
    onToggleState: (n: number) => void;
    onSelectOnly: (n: number) => void;
    theme: VizTheme;
}

export const PhasorDiagram: React.FC<PhasorDiagramProps> = ({
    activeStates,
    tau,
    stateSet,
    onToggleState,
    onSelectOnly,
    theme,
}) => {
    const numStates = Math.min(MAX_STATES, stateSet.numStates);
    return (
        <PhasorGrid>
            {Array.from({ length: numStates }, (_, n) => {
                const ratio = energyRatio(stateSet, n);
                return (
                    <PhasorCell
                        key={n}
                        phase={ratio * tau}
                        active={activeStates.includes(n)}
                        color={stateColor(theme, n)}
                        label={n}
                        title={`State n = ${n}, E/E₀ = ${ratio.toFixed(2)}, E = ${stateSet.energy(n).toFixed(3)}`}
                        onToggle={() => onToggleState(n)}
                        onSelectOnly={() => onSelectOnly(n)}
                    />
                );
            })}
        </PhasorGrid>
    );
};

export default PhasorDiagram;
