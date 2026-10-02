import React, { useState, useCallback } from 'react';
import Admonition from '@theme/Admonition';
import BrowserOnly from '@docusaurus/BrowserOnly';
import { useContainerSize, useVizTheme, VizExplanation, VizPanel, VizPanelSection, VizPanelSplit, VizPlotHeader, VizWorkbench } from './shared/viz';
import { ControlGroup } from './shared/controls';
import { useAnimationClock, WithTau } from './shared/quantum';
import { QM3DScene } from './qm3d/QM3DScene';
import { StateSelector3D } from './qm3d/StateSelector3D';
import { QM3DControls } from './qm3d/QM3DControls';
import {
    type QuantumState3D,
    type ColorMapType,
    type RenderStyle,
    MAX_ACTIVE_STATES,
    calcStateEnergy,
} from './qm3d/physics';
import MathFormula from './MathFormula';

/** τ per second at speed 1 (the old loop added 0.008 per frame at ~60 fps). */
const TAU_RATE = 0.48;

const QM3DVisualizationInner: React.FC<{ title: string }> = ({ title }) => {
    const theme = useVizTheme();

    const [activeStates, setActiveStates] = useState<QuantumState3D[]>([{ nx: 1, ny: 1, nz: 1 }]);
    const [isAnimating, setIsAnimating] = useState(true);
    const [speed, setSpeed] = useState(0.2);
    const [colorMapType, setColorMapType] = useState<ColorMapType>('viridis');
    const [renderStyle, setRenderStyle] = useState<RenderStyle>('colorful');
    const [densityScale, setDensityScale] = useState(4.5);
    const [opacityPower, setOpacityPower] = useState(0.3); // <1 = fuzzy, >1 = sharp
    const [threshold, setThreshold] = useState(0); // minimum density to render

    const clock = useAnimationClock(isAnimating, TAU_RATE * speed);
    const resetTau = clock.reset;

    const [stageRef, stageSize] = useContainerSize();
    // Fit the square to the viewport height too, so the whole panel is visible.
    const viewportCap = typeof window !== 'undefined' ? window.innerHeight - 340 : 620;
    const canvasSize = Math.max(240, Math.min(620, stageSize.width, viewportCap));

    const toggleState = useCallback((nx: number, ny: number, nz: number) => {
        setActiveStates((prev) => {
            const i = prev.findIndex((s) => s.nx === nx && s.ny === ny && s.nz === nz);
            if (i >= 0) return prev.length > 1 ? prev.filter((_, j) => j !== i) : prev;
            return prev.length < MAX_ACTIVE_STATES ? [...prev, { nx, ny, nz }] : prev;
        });
    }, []);

    return (
        <>
            <VizWorkbench
                sidebar={
                    <VizPanel stack>
                        <QM3DControls
                            colorMapType={colorMapType}
                            onColorMapChange={setColorMapType}
                            renderStyle={renderStyle}
                            onRenderStyleChange={setRenderStyle}
                            densityScale={densityScale}
                            onDensityScaleChange={setDensityScale}
                            opacityPower={opacityPower}
                            onOpacityPowerChange={setOpacityPower}
                            threshold={threshold}
                            onThresholdChange={setThreshold}
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
                            <div ref={stageRef} style={{ display: 'grid', justifyItems: 'center' }}>
                                {canvasSize > 0 && (
                                    <WithTau clock={clock}>
                                        {(tau) => (
                                            <QM3DScene
                                                activeStates={activeStates}
                                                tau={tau}
                                                densityScale={densityScale}
                                                opacityPower={opacityPower}
                                                threshold={threshold}
                                                colorMapType={colorMapType}
                                                renderStyle={renderStyle}
                                                width={canvasSize}
                                                height={canvasSize}
                                                background={theme.surface}
                                                edgeColor={theme.axis}
                                            />
                                        )}
                                    </WithTau>
                                )}
                            </div>
                        </VizPanelSection>
                        <VizPanelSection>
                            <ControlGroup label={`States in superposition · ${activeStates.length} / ${MAX_ACTIVE_STATES}`}>
                                <WithTau clock={clock}>
                                    {(tau) => (
                                        <StateSelector3D
                                            activeStates={activeStates}
                                            tau={tau}
                                            onToggleState={toggleState}
                                            onSelectOnly={(nx, ny, nz) => setActiveStates([{ nx, ny, nz }])}
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
                    Combine the degenerate states (2,1,1), (1,2,1) and (1,1,2) and compare the shapes different
                    combinations make at the same energy.
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
                            <tr key={`${s.nx}-${s.ny}-${s.nz}`}>
                                <td>
                                    ({s.nx}, {s.ny}, {s.nz})
                                </td>
                                <td className="tabular-nums">{calcStateEnergy(s)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                    </>
                }
            >
                <h2>About the 3D particle in a box</h2>
                <p>
                    A quantum particle confined to a cubic box with infinite walls. Its eigenstates are labelled by three
                    quantum numbers (n<sub>x</sub>, n<sub>y</sub>, n<sub>z</sub>), the number of half-wavelengths along
                    each axis.
                </p>
                <p>
                    The energy of each state is{' '}
                    <MathFormula math="E = \frac{\pi^2 \hbar^2}{2 m L^2} (n_x^2 + n_y^2 + n_z^2)" inline />. States with
                    the same n<sub>x</sub>² + n<sub>y</sub>² + n<sub>z</sub>² are degenerate. Each state evolves with a
                    phase <MathFormula math="e^{-i E t / \hbar}" inline />, rotating faster the higher its energy.
                </p>
                <h3>What to look for</h3>
                <ul>
                    <li>|ψ|² is drawn as a semi-transparent cloud by ray marching through the box.</li>
                    <li>Superpositions create 3D interference patterns that evolve in time.</li>
                    <li>Combinations of degenerate states stay still: they share one phase rate.</li>
                </ul>
            </VizExplanation>
        </>
    );
};

const QM3DVisualization: React.FC<{ title: string }> = ({ title }) => (
    <BrowserOnly fallback={<div style={{ minHeight: 560 }} />}>{() => <QM3DVisualizationInner title={title} />}</BrowserOnly>
);

export default QM3DVisualization;
