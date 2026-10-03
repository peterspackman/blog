import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useVizTheme, withAlpha, VizCanvasFit, VizPanel, VizPanelSection, VizPlotHeader, VizWorkbench } from './shared/viz';
import { ControlGroup, SegmentedControl, VizButton } from './shared/controls';
import simStyles from './shared/sim/SimPlot.module.css';

import { GCMCScenario, GCMC_SCENARIOS, GCMCScenarioConfig } from './gcmc/scenarios';
import { ExternalPotentialType, createExternalPotential, ExternalPotential } from './gcmc/ExternalPotentials';
import { BOLTZMANN_CONSTANT } from './md/constants';

const PLANCK_H = 4.135667696e-3;
const AMU_CONV = 1.03642698e-4;
const EVA3_TO_KPA = 1.602e11 / 1000;

function pressureToMu(P_kPa: number, T: number, mass_amu: number, sigma: number): number {
    const kBT = BOLTZMANN_CONSTANT * T;
    const m = mass_amu * AMU_CONV;
    const lambda2 = (PLANCK_H * PLANCK_H) / (2 * Math.PI * m * kBT);
    const z = (P_kPa / EVA3_TO_KPA) * sigma / kBT;
    if (z <= 0) return -1;
    return kBT * Math.log(z * lambda2);
}
import { GCMCAnalyticsEngine } from './gcmc/GCMCAnalytics';
import { useGCMCSimulation } from './gcmc/useGCMCSimulation';
import { useGCMCCanvasRenderer } from './gcmc/useGCMCCanvasRenderer';
import GCMCSimulationControls from './gcmc/GCMCSimulationControls';
import GCMCAnalyticsPlot from './gcmc/GCMCAnalyticsPlot';

/** Simulation box sizes in canvas pixels (5 px per Å). The canvas is
 *  displayed scaled to fit, so the box size is independent of the window. */
const BOX_SIZES = {
    small: { width: 600, height: 360, label: 'Small', title: '120 × 72 Å' },
    medium: { width: 800, height: 480, label: 'Medium', title: '160 × 96 Å' },
    large: { width: 1000, height: 600, label: 'Large', title: '200 × 120 Å' },
} as const;
type BoxSize = keyof typeof BOX_SIZES;
const BOX_OPTIONS = (Object.keys(BOX_SIZES) as BoxSize[]).map((k) => ({
    value: k,
    label: BOX_SIZES[k].label,
    title: BOX_SIZES[k].title,
}));

const SCENARIO_OPTIONS = (Object.keys(GCMC_SCENARIOS) as GCMCScenario[]).map((key) => ({
    value: key,
    label: GCMC_SCENARIOS[key].name,
    title: GCMC_SCENARIOS[key].description,
}));

const GrandCanonicalMC: React.FC<{ title: string }> = ({ title }) => {
    const theme = useVizTheme();
    const isDark = theme.isDark;

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [boxSize, setBoxSize] = useState<BoxSize>('medium');
    const { width, height } = BOX_SIZES[boxSize];

    // Coordinate scale: pixels per Angstrom
    const coordinateScale = 5.0;
    const [visualScale, setVisualScale] = useState(5.0);

    // Simulation box in Angstroms
    const boxWidth = width / coordinateScale;
    const boxHeight = height / coordinateScale;

    // Scenario
    const [scenario, setScenario] = useState<GCMCScenario>('lj-fluid');

    // Simulation parameters (initialized from scenario)
    const getScenarioConfig = (s: GCMCScenario): GCMCScenarioConfig => GCMC_SCENARIOS[s];
    const initConfig = getScenarioConfig(scenario);

    const [temperature, setTemperatureRaw] = useState(initConfig.temperature);
    const [pressures, setPressures] = useState(initConfig.pressures);
    // Track which input mode the user is in so we can hold the right variable constant
    const [thermoInputMode, setThermoInputMode] = useState<'pressure' | 'concentration' | 'chemical-potential'>('pressure');

    // When T changes: if in concentration mode, adjust P to hold c constant.
    // c = P*1000/(R*T), so P_new = c * R * T_new / 1000 = P_old * T_new / T_old
    const setTemperature = useCallback((newT: number) => {
        if (thermoInputMode === 'concentration' && temperature > 0 && newT > 0) {
            const ratio = newT / temperature;
            setPressures(prev => prev.map(p => p * ratio));
        }
        setTemperatureRaw(newT);
    }, [thermoInputMode, temperature]);
    const [initLayout, setInitLayout] = useState(initConfig.initLayout);
    const [maxDisplacement, setMaxDisplacement] = useState(initConfig.maxDisplacement);
    const [stepsPerFrame, setStepsPerFrame] = useState(100);
    const [moveWeights, setMoveWeights] = useState(initConfig.moveWeights);
    const [running, setRunning] = useState(false);
    const [cutoffRadius, setCutoffRadius] = useState(initConfig.cutoffRadius);
    const [typeRatio, setTypeRatio] = useState(initConfig.typeRatio);

    // Particle types
    const [typeLabels, setTypeLabels] = useState(initConfig.particleTypes.map(t => t.label));
    // Palette slots per type; colours follow the theme.
    const [typeColorSlots, setTypeColorSlots] = useState(initConfig.particleTypes.map(t => t.colorSlot));
    const plotColors = useMemo(() => typeColorSlots.map((slot) => theme.series[slot]), [typeColorSlots, theme]);
    const typeColors = useMemo(() => plotColors.map((c) => withAlpha(c, 0.9)), [plotColors]);
    const numTypes = initConfig.particleTypes.length;

    // Interaction parameters
    const [epsilonMatrix, setEpsilonMatrix] = useState(initConfig.epsilonMatrix);
    const [sigmaMatrix, setSigmaMatrix] = useState(initConfig.sigmaMatrix);
    const [masses, setMasses] = useState(initConfig.masses);
    const [charges, setCharges] = useState(initConfig.charges);
    const [chargeScale, setChargeScale] = useState(initConfig.chargeScale);

    // Derive mu from P + T (recomputed whenever either changes)
    const chemicalPotentials = useMemo(() =>
        pressures.map((P, i) => pressureToMu(
            P, temperature,
            masses[i] ?? masses[0],
            sigmaMatrix[i]?.[i] ?? sigmaMatrix[0][0]
        )),
        [pressures, temperature, masses, sigmaMatrix]
    );

    // External potential
    const [externalPotentialType, setExternalPotentialType] = useState<ExternalPotentialType>(initConfig.externalPotential);
    const [externalPotential, setExternalPotential] = useState<ExternalPotential | null>(null);

    // Visualization
    const [showTrialMoves, setShowTrialMoves] = useState(true);
    const [showExternalPotential, setShowExternalPotential] = useState(true);
    const [densityWindow, setDensityWindow] = useState(500);



    // Analytics
    const [analytics] = useState(() => new GCMCAnalyticsEngine());
    const handleSetDensityWindow = useCallback((w: number) => {
        setDensityWindow(w);
        analytics.setDensityWindow(w);
    }, [analytics]);

    // Create external potential when type changes
    useEffect(() => {
        const config = GCMC_SCENARIOS[scenario];
        const ext = createExternalPotential(externalPotentialType, boxWidth, boxHeight, config.externalPotentialParams, charges);
        setExternalPotential(ext);
    }, [externalPotentialType, boxWidth, boxHeight, scenario, charges]);

    // Interaction parameter updater
    const updateInteractionParameter = useCallback((paramType: string, i: number, j: number, value: number) => {
        if (paramType === 'epsilon') {
            setEpsilonMatrix(prev => {
                const next = prev.map(row => [...row]);
                next[i][j] = value;
                return next;
            });
        } else if (paramType === 'sigma') {
            setSigmaMatrix(prev => {
                const next = prev.map(row => [...row]);
                next[i][j] = value;
                return next;
            });
        }
    }, []);

    // Simulation hook
    const {
        particleData,
        particleDataRef,
        initializeParticles,
        mcStep,
        recordAnalytics,
        syncState,
        stepCount,
        lastTrialRef,
        mcEngineRef,
    } = useGCMCSimulation({
        initLayout,
        numTypes,
        temperature,
        chemicalPotentials,
        maxDisplacement,
        boxWidth,
        boxHeight,
        moveWeights,
        epsilonMatrix,
        sigmaMatrix,
        masses,
        charges,
        chargeScale,
        cutoffRadius,
        externalPotential,
        analytics,
        typeRatio,
    });

    // Initialize on mount and scenario change
    useEffect(() => {
        initializeParticles();
    }, [initializeParticles]);

    // Scenario change handler
    const handleScenarioChange = useCallback((newScenario: GCMCScenario) => {
        setRunning(false);
        setScenario(newScenario);

        const config = getScenarioConfig(newScenario);
        setTemperature(config.temperature);
        setPressures(config.pressures);
        setInitLayout(config.initLayout);
        setMaxDisplacement(config.maxDisplacement);
        setMoveWeights(config.moveWeights);
        setCutoffRadius(config.cutoffRadius);
        setTypeRatio(config.typeRatio);
        setTypeLabels(config.particleTypes.map(t => t.label));
        setTypeColorSlots(config.particleTypes.map(t => t.colorSlot));
        setEpsilonMatrix(config.epsilonMatrix);
        setSigmaMatrix(config.sigmaMatrix);
        setMasses(config.masses);
        setCharges(config.charges);
        setChargeScale(config.chargeScale);
        setExternalPotentialType(config.externalPotential);
    }, []);

    // Reset handler
    const handleReset = useCallback(() => {
        setRunning(false);
        initializeParticles();
    }, [initializeParticles]);

    // Simulation step callback for renderer
    const frameCountRef = useRef(0);
    const onSimulationStep = useCallback(() => {
        mcStep();
        frameCountRef.current++;

        // Record analytics every 5 steps
        if (frameCountRef.current % 5 === 0) {
            recordAnalytics();
        }
        // Sync React state periodically
        if (frameCountRef.current % stepsPerFrame === 0) {
            syncState();
        }
    }, [mcStep, recordAnalytics, syncState, stepsPerFrame]);

    // Canvas renderer
    useGCMCCanvasRenderer({
        canvasRef,
        particleDataRef,
        width,
        height,
        running,
        isDark,
        theme,
        coordinateScale,
        visualScale,
        sigmaMatrix,
        typeColors,
        stepsPerFrame,
        onSimulationStep,
        showTrialMoves,
        showExternalPotential,
        externalPotential,
        lastTrialRef,
        boxWidth,
        boxHeight,
    });

    // Get acceptance rates for toolbar display
    const acceptanceRates = mcEngineRef.current?.getAcceptanceRates() ?? {
        displacement: 0,
        insertion: 0,
        deletion: 0,
    };

    const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

    const sidebar = (
        <VizPanel stack>
            <ControlGroup label="Scenario" hint={GCMC_SCENARIOS[scenario].description}>
                <SegmentedControl aria-label="Scenario" columns={2} value={scenario} onChange={handleScenarioChange} options={SCENARIO_OPTIONS} />
            </ControlGroup>
            <GCMCSimulationControls<BoxSize>
                isCustom={scenario === 'custom'}
                boxSize={boxSize}
                setBoxSize={setBoxSize}
                boxOptions={BOX_OPTIONS}
                temperature={temperature}
                setTemperature={setTemperature}
                pressures={pressures}
                setPressures={setPressures}
                thermoInputMode={thermoInputMode}
                setThermoInputMode={setThermoInputMode}
                initLayout={initLayout}
                setInitLayout={setInitLayout}
                maxDisplacement={maxDisplacement}
                setMaxDisplacement={setMaxDisplacement}
                stepsPerFrame={stepsPerFrame}
                setStepsPerFrame={setStepsPerFrame}
                moveWeights={moveWeights}
                setMoveWeights={setMoveWeights}
                epsilonMatrix={epsilonMatrix}
                sigmaMatrix={sigmaMatrix}
                updateInteractionParameter={updateInteractionParameter}
                numTypes={numTypes}
                typeLabels={typeLabels}
                typeColors={plotColors}
                cutoffRadius={cutoffRadius}
                setCutoffRadius={setCutoffRadius}
                masses={masses}
                charges={charges}
                setCharges={setCharges}
                chargeScale={chargeScale}
                setChargeScale={setChargeScale}
                visualScale={visualScale}
                setVisualScale={setVisualScale}
                showExternalPotential={showExternalPotential}
                setShowExternalPotential={setShowExternalPotential}
                showTrialMoves={showTrialMoves}
                setShowTrialMoves={setShowTrialMoves}
                externalPotentialType={externalPotentialType}
                setExternalPotentialType={setExternalPotentialType}
                typeRatio={typeRatio}
                setTypeRatio={setTypeRatio}
                densityWindow={densityWindow}
                setDensityWindow={handleSetDensityWindow}
            />
        </VizPanel>
    );

    return (
        <VizWorkbench sidebar={sidebar}>
            <VizPanel flush>
                <VizPanelSection style={{ display: 'grid', gap: '0.75rem' }}>
                    <VizPlotHeader
                        title={title}
                        readout={`N = ${particleData?.count ?? 0} · ${stepCount.toLocaleString()} steps`}
                    />
                    <div style={{ display: 'flex', gap: '0.375rem 1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                            <VizButton variant="primary" style={{ minWidth: '5.5rem' }} onClick={() => setRunning(!running)}>
                                {running ? 'Pause' : 'Run'}
                            </VizButton>
                            <VizButton variant="secondary" onClick={handleReset}>
                                Reset
                            </VizButton>
                        </div>
                        <div className={simStyles.stats} title="Acceptance rates of each move type">
                            <span>Accepted:</span>
                            <span>displace <b>{pct(acceptanceRates.displacement)}</b></span>
                            <span>insert <b>{pct(acceptanceRates.insertion)}</b></span>
                            <span>delete <b>{pct(acceptanceRates.deletion)}</b></span>
                        </div>
                    </div>
                    <VizCanvasFit width={width} height={height} reserve={330}>
                        <canvas
                            ref={canvasRef}
                            aria-label="Grand canonical Monte Carlo simulation"
                            style={{ display: 'block', width: '100%', height: '100%', borderRadius: 'var(--viz-radius)' }}
                        />
                    </VizCanvasFit>
                </VizPanelSection>
                <VizPanelSection>
                    <GCMCAnalyticsPlot
                        analytics={analytics}
                        theme={theme}
                        typeLabels={typeLabels}
                        typeColors={plotColors}
                        numTypes={numTypes}
                    />
                </VizPanelSection>
            </VizPanel>
        </VizWorkbench>
    );
};

export default GrandCanonicalMC;
