import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useColorMode } from '@docusaurus/theme-common';

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
import GCMCSimulationToolbar from './gcmc/GCMCSimulationToolbar';
import GCMCSimulationControls from './gcmc/GCMCSimulationControls';
import GCMCAnalyticsPlot from './gcmc/GCMCAnalyticsPlot';

const GrandCanonicalMC = () => {
    const { colorMode } = useColorMode();
    const isDark = colorMode === 'dark';

    const theme = {
        background: isDark ? '#1e1e1e' : '#ffffff',
        surface: isDark ? '#2d2d2d' : '#f8f9fa',
        border: isDark ? '#444' : '#ccc',
        text: isDark ? '#e0e0e0' : '#333',
        textMuted: isDark ? '#888' : '#666',
        canvasBg: isDark ? '#1a1a1a' : '#ffffff',
    };

    // Canvas sizing
    const [canvasWidth, setCanvasWidth] = useState(800);
    const [canvasHeight, setCanvasHeight] = useState(600);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(800);
    const [height, setHeight] = useState(600);

    useEffect(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const w = Math.max(400, rect.width - 10);
            const h = Math.max(300, Math.min(600, w * 0.6));
            setCanvasWidth(w);
            setCanvasHeight(h);
        }
    }, []);

    useEffect(() => {
        setWidth(canvasWidth);
        setHeight(canvasHeight);
    }, [canvasWidth, canvasHeight]);

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
    const setTemperature = (newT: number) => {
        if (thermoInputMode === 'concentration' && temperature > 0 && newT > 0) {
            const ratio = newT / temperature;
            setPressures(prev => prev.map(p => p * ratio));
        }
        setTemperatureRaw(newT);
    };
    const [initLayout, setInitLayout] = useState(initConfig.initLayout);
    const [maxDisplacement, setMaxDisplacement] = useState(initConfig.maxDisplacement);
    const [stepsPerFrame, setStepsPerFrame] = useState(100);
    const [moveWeights, setMoveWeights] = useState(initConfig.moveWeights);
    const [running, setRunning] = useState(false);
    const [cutoffRadius, setCutoffRadius] = useState(initConfig.cutoffRadius);
    const [typeRatio, setTypeRatio] = useState(initConfig.typeRatio);

    // Particle types
    const [typeLabels, setTypeLabels] = useState(initConfig.particleTypes.map(t => t.label));
    const [typeColors, setTypeColors] = useState(initConfig.particleTypes.map(t => t.color));
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

    const handleSetDensityWindow = (w: number) => {
        setDensityWindow(w);
        analytics.setDensityWindow(w);
    };

    // Mobile
    const [isMobile, setIsMobile] = useState(false);
    const [showControls, setShowControls] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Analytics
    const [analytics] = useState(() => new GCMCAnalyticsEngine());

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
        setTypeColors(config.particleTypes.map(t => t.color));
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

    // Resize handle
    const [isResizing, setIsResizing] = useState(false);
    const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
        resizeStartRef.current = { x: e.clientX, y: e.clientY, w: canvasWidth, h: canvasHeight };
    }, [canvasWidth, canvasHeight]);

    useEffect(() => {
        if (!isResizing) return;
        const handleMouseMove = (e: MouseEvent) => {
            const dx = e.clientX - resizeStartRef.current.x;
            const dy = e.clientY - resizeStartRef.current.y;
            setCanvasWidth(Math.max(400, resizeStartRef.current.w + dx));
            setCanvasHeight(Math.max(200, resizeStartRef.current.h + dy));
        };
        const handleMouseUp = () => setIsResizing(false);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 300px',
            gap: '1rem',
            padding: '1rem',
            maxWidth: '1400px',
            margin: '0 auto',
        }}>
            {/* Main area */}
            <div style={{ minWidth: 0 }}>
                <GCMCSimulationToolbar
                    running={running}
                    setRunning={setRunning}
                    onReset={handleReset}
                    scenario={scenario}
                    onScenarioChange={handleScenarioChange}
                    stepCount={stepCount}
                    particleCount={particleData?.count ?? 0}
                    acceptanceRates={acceptanceRates}
                    isDark={isDark}
                />

                {/* Canvas container */}
                <div ref={containerRef} style={{
                    width: `${canvasWidth}px`,
                    height: `${canvasHeight}px`,
                    position: 'relative',
                    margin: '0.5rem auto 0',
                    borderRadius: '4px',
                    overflow: 'hidden',
                }}>
                    <canvas
                        ref={canvasRef}
                        style={{
                            display: 'block',
                            width: `${width}px`,
                            height: `${height}px`,
                            touchAction: 'none',
                        }}
                    />
                    {/* Resize handle */}
                    <div
                        onMouseDown={handleResizeStart}
                        style={{
                            position: 'absolute',
                            bottom: '2px',
                            right: '2px',
                            width: '12px',
                            height: '12px',
                            cursor: 'se-resize',
                            opacity: 0.3,
                            pointerEvents: 'auto',
                            backgroundImage: `linear-gradient(135deg, transparent 50%, ${isDark ? '#888' : '#999'} 50%)`,
                        }}
                        title="Drag to resize"
                    />
                </div>

                {/* Analytics */}
                <GCMCAnalyticsPlot
                    analytics={analytics}
                    width={canvasWidth}
                    isDark={isDark}
                    typeLabels={typeLabels}
                    typeColors={typeColors}
                    numTypes={numTypes}
                />
            </div>

            {/* Controls sidebar */}
            {isMobile && (
                <button
                    onClick={() => setShowControls(!showControls)}
                    style={{
                        position: 'fixed',
                        bottom: '1rem',
                        right: '1rem',
                        zIndex: 1000,
                        padding: '0.75rem 1rem',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        fontSize: '0.9rem',
                    }}
                >
                    {showControls ? 'Close' : 'Controls'}
                </button>
            )}

            {(showControls || !isMobile) && (
                <div style={{
                    ...(isMobile ? {
                        position: 'fixed',
                        top: 0,
                        right: 0,
                        bottom: 0,
                        width: '300px',
                        maxWidth: '85vw',
                        zIndex: 999,
                        backgroundColor: theme.background,
                        boxShadow: isDark ? '-4px 0 16px rgba(0,0,0,0.4)' : '-4px 0 16px rgba(0,0,0,0.15)',
                        overflowY: 'auto',
                    } : {}),
                }}>
                    <GCMCSimulationControls
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
                        typeColors={typeColors}
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
                        isDark={isDark}
                    />
                </div>
            )}
        </div>
    );
};

export default GrandCanonicalMC;
