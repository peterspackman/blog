import React, { useState, useCallback, useMemo } from 'react';
import { useContainerSize, useVizTheme, VizPanel, VizPanelSection, VizPlotHeader, VizWorkbench } from './shared/viz';
import { ControlGroup } from './shared/controls';
import { useAnimationClock, WithTau } from './shared/quantum';
import { WavefunctionCanvas, type DisplayOptions } from './qm1d/WavefunctionCanvas';
import { PhasorDiagram } from './qm1d/PhasorDiagram';
import { QMControls } from './qm1d/QMControls';
import { QMExplanation } from './qm1d/QMExplanation';
import {
    buildStateSet,
    defaultDomain,
    defaultParams,
    formatTime,
    type PotentialType,
    type PotentialConfig,
    type PotentialParams,
} from './qm1d/physics';

/** τ per second at speed 1 (the old loop added 0.05 per frame at ~60 fps). */
const TAU_RATE = 3;

const QMVisualization1D: React.FC<{ title: string }> = ({ title }) => {
    const theme = useVizTheme();

    const [activeStates, setActiveStates] = useState<number[]>([0]);
    const [isAnimating, setIsAnimating] = useState(true);
    const [speed, setSpeed] = useState(0.2);
    const [potentialType, setPotentialType] = useState<PotentialType>('harmonic');
    const [potentialParams, setPotentialParams] = useState<PotentialParams>(defaultParams('harmonic'));
    const [displayOptions, setDisplayOptions] = useState<DisplayOptions>({
        showReal: false,
        showImaginary: false,
        showProbability: true,
        showPotential: true,
        showIndividualStates: false,
        showEnergyLevels: true,
        autoRescale: false,
    });

    const clock = useAnimationClock(isAnimating, TAU_RATE * speed);
    const resetTau = clock.reset;

    const [plotRef, plotSize] = useContainerSize();
    const canvasWidth = plotSize.width;
    // Leave room below the plot for the states strip on a typical laptop screen.
    const viewportCap = typeof window !== 'undefined' ? window.innerHeight - 420 : 460;
    const canvasHeight = Math.round(Math.max(260, Math.min(460, canvasWidth * 0.45, viewportCap)));

    // Diagonalise only when the potential changes.
    const stateSet = useMemo(() => {
        const domain = defaultDomain(potentialType, potentialParams);
        const config: PotentialConfig = { type: potentialType, xMin: domain.xMin, xMax: domain.xMax, ...potentialParams };
        return buildStateSet(config);
    }, [potentialType, potentialParams]);

    const toggleState = useCallback((n: number) => {
        setActiveStates((prev) => {
            if (prev.includes(n)) return prev.length > 1 ? prev.filter((s) => s !== n) : prev;
            return [...prev, n].sort((a, b) => a - b);
        });
    }, []);

    const handlePotentialTypeChange = useCallback(
        (type: PotentialType) => {
            setPotentialType(type);
            setPotentialParams(defaultParams(type));
            // Different potentials have different numbers of bound states and
            // different energy orderings, so reset to just the ground state.
            setActiveStates([0]);
            resetTau();
        },
        [resetTau],
    );

    const handlePotentialParamChange = useCallback(
        <K extends keyof PotentialParams>(key: K, value: PotentialParams[K]) => {
            setPotentialParams((prev) => ({ ...prev, [key]: value }));
        },
        [],
    );

    const handleDisplayOptionChange = useCallback(<K extends keyof DisplayOptions>(key: K, value: boolean) => {
        setDisplayOptions((prev) => ({ ...prev, [key]: value }));
    }, []);

    return (
        <>
            <VizWorkbench
                sidebar={
                    <VizPanel stack>
                        <QMControls
                            potentialType={potentialType}
                            onPotentialTypeChange={handlePotentialTypeChange}
                            potentialParams={potentialParams}
                            onPotentialParamChange={handlePotentialParamChange}
                            displayOptions={displayOptions}
                            onDisplayOptionChange={handleDisplayOptionChange}
                            isAnimating={isAnimating}
                            onIsAnimatingChange={setIsAnimating}
                            speed={speed}
                            onSpeedChange={setSpeed}
                            onResetTime={resetTau}
                            theme={theme}
                        />
                    </VizPanel>
                }
            >
                <VizPanel flush>
                    <VizPanelSection>
                        <VizPlotHeader title={title} readout={<WithTau clock={clock}>{(tau) => `t = ${formatTime(tau)}`}</WithTau>} />
                        <div ref={plotRef} style={{ minHeight: canvasHeight }}>
                        {canvasWidth > 0 && (
                            <WithTau clock={clock}>
                                {(tau) => (
                                    <WavefunctionCanvas
                                        width={canvasWidth}
                                        height={canvasHeight}
                                        activeStates={activeStates}
                                        tau={tau}
                                        stateSet={stateSet}
                                        displayOptions={displayOptions}
                                        theme={theme}
                                    />
                                )}
                            </WithTau>
                        )}
                        </div>
                    </VizPanelSection>
                    <VizPanelSection>
                        <ControlGroup label={`States in superposition · ${activeStates.length}`}>
                            <WithTau clock={clock}>
                                {(tau) => (
                                    <PhasorDiagram
                                        activeStates={activeStates}
                                        tau={tau}
                                        stateSet={stateSet}
                                        onToggleState={toggleState}
                                        onSelectOnly={(n) => setActiveStates([n])}
                                        theme={theme}
                                    />
                                )}
                            </WithTau>
                        </ControlGroup>
                    </VizPanelSection>
                </VizPanel>
            </VizWorkbench>

            <QMExplanation potentialType={potentialType} activeStates={activeStates} />
        </>
    );
};

export default QMVisualization1D;
