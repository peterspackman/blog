import React, { useState, useCallback } from 'react';
import Admonition from '@theme/Admonition';
import { useContainerSize, useVizTheme, VizExplanation, VizPanel, VizPanelSection, VizPanelSplit, VizPlotHeader, VizWorkbench } from './shared/viz';
import { ControlGroup } from './shared/controls';
import { useAnimationClock, WithTau } from './shared/quantum';
import { Wavefunction2DCanvas } from './qm2d/Wavefunction2DCanvas';
import { ColorScale } from './qm2d/ColorScale';
import { PhasorGrid } from './qm2d/PhasorGrid';
import { QM2DControls } from './qm2d/QM2DControls';
import {
    type QuantumState2D,
    type DisplayMode,
    type ColorMapType,
    MAX_ACTIVE_STATES,
    calcEnergy,
} from './qm2d/physics';
import MathFormula from './MathFormula';

/** τ per second at speed 1 (the old loop added 0.008 per frame at ~60 fps). */
const TAU_RATE = 0.48;

const QM2DVisualization: React.FC<{ title: string }> = ({ title }) => {
    const theme = useVizTheme();

    const [activeStates, setActiveStates] = useState<QuantumState2D[]>([{ nx: 1, ny: 1 }]);
    const [isAnimating, setIsAnimating] = useState(true);
    const [speed, setSpeed] = useState(0.2);
    const [displayMode, setDisplayMode] = useState<DisplayMode>('probability');
    const [colorMapType, setColorMapType] = useState<ColorMapType>('viridis');
    const [showContours, setShowContours] = useState(false);

    const clock = useAnimationClock(isAnimating, TAU_RATE * speed);
    const resetTau = clock.reset;

    const [stageRef, stageSize] = useContainerSize();
    // Fit the square to the viewport height too, so the whole panel is visible.
    const viewportCap = typeof window !== 'undefined' ? window.innerHeight - 340 : 620;
    const canvasSize = Math.max(240, Math.min(620, stageSize.width, viewportCap));

    const toggleState = useCallback((nx: number, ny: number) => {
        setActiveStates((prev) => {
            const i = prev.findIndex((s) => s.nx === nx && s.ny === ny);
            if (i >= 0) return prev.length > 1 ? prev.filter((_, j) => j !== i) : prev;
            return prev.length < MAX_ACTIVE_STATES ? [...prev, { nx, ny }] : prev;
        });
    }, []);

    return (
        <>
            <VizWorkbench
                sidebar={
                    <VizPanel stack>
                        <QM2DControls
                            displayMode={displayMode}
                            onDisplayModeChange={setDisplayMode}
                            colorMapType={colorMapType}
                            onColorMapChange={setColorMapType}
                            showContours={showContours}
                            onShowContoursChange={setShowContours}
                            isAnimating={isAnimating}
                            onIsAnimatingChange={setIsAnimating}
                            speed={speed}
                            onSpeedChange={setSpeed}
                            onResetTime={resetTau}
                        />
                    </VizPanel>
                }
            >
                <VizPanel flush>
                    <VizPanelSplit>
                        <VizPanelSection>
                            <VizPlotHeader
                                title={title}
                                readout={<WithTau clock={clock}>{(tau) => `τ = ${tau.toFixed(2)}`}</WithTau>}
                            />
                            <div ref={stageRef} style={{ display: 'grid', justifyItems: 'center', gap: '0.5rem' }}>
                                {canvasSize > 0 && (
                                    <>
                                        <WithTau clock={clock}>
                                            {(tau) => (
                                                <Wavefunction2DCanvas
                                                    width={canvasSize}
                                                    height={canvasSize}
                                                    activeStates={activeStates}
                                                    tau={tau}
                                                    displayMode={displayMode}
                                                    colorMapType={colorMapType}
                                                    showContours={showContours}
                                                />
                                            )}
                                        </WithTau>
                                        <ColorScale width={canvasSize} height={14} colorMapType={colorMapType} displayMode={displayMode} theme={theme} />
                                    </>
                                )}
                            </div>
                        </VizPanelSection>
                        <VizPanelSection>
                            <ControlGroup label={`States in superposition · ${activeStates.length} / ${MAX_ACTIVE_STATES}`}>
                                <WithTau clock={clock}>
                                    {(tau) => (
                                        <PhasorGrid
                                            activeStates={activeStates}
                                            tau={tau}
                                            onToggleState={toggleState}
                                            onSelectOnly={(nx, ny) => setActiveStates([{ nx, ny }])}
                                            color={theme.accent}
                                        />
                                    )}
                                </WithTau>
                            </ControlGroup>
                        </VizPanelSection>
                    </VizPanelSplit>
                </VizPanel>
            </VizWorkbench>

            <VizExplanation
                aside={
                    <>
                <Admonition type="tip" title="Try this">
                    Add several states with different quantum numbers to see interference, then compare with a degenerate
                    pair whose pattern does not move.
                </Admonition>
                <h3>Active states</h3>
                <table>
                    <thead>
                        <tr>
                            <th>State</th>
                            <th>E (units of π²ħ²/2mL²)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {activeStates.map((s) => (
                            <tr key={`${s.nx}-${s.ny}`}>
                                <td>
                                    ({s.nx}, {s.ny})
                                </td>
                                <td className="tabular-nums">{calcEnergy(s.nx, s.ny)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                    </>
                }
            >
                <h2>About the 2D particle in a box</h2>
                <p>
                    A quantum particle confined to a square box with infinite walls. Its eigenstates are labelled by two
                    quantum numbers (n<sub>x</sub>, n<sub>y</sub>), the number of half-wavelengths along each axis.
                </p>
                <p>
                    The energy of each state is{' '}
                    <MathFormula math="E = \frac{\pi^2 \hbar^2}{2 m L^2} (n_x^2 + n_y^2)" inline />, so higher quantum
                    numbers have higher energies. Each state evolves with a phase factor{' '}
                    <MathFormula math="e^{-i E t / \hbar}" inline />, rotating faster the higher its energy.
                </p>
                <h3>What to look for</h3>
                <ul>
                    <li>Probability densities show nodal lines set by the quantum numbers.</li>
                    <li>Superpositions create interference patterns that evolve in time.</li>
                    <li>States with different energies evolve at different rates, giving complex dynamics.</li>
                    <li>Degenerate pairs such as (1,2) and (2,1) share an energy, so their superposition is stationary.</li>
                </ul>
            </VizExplanation>
        </>
    );
};

export default QM2DVisualization;
