import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useVizTheme, withAlpha, VizCanvasFit, VizPanel, VizPanelSection, VizPlotHeader, VizWorkbench } from './shared/viz';
import { CollapsibleSection, ControlGroup, ControlHint, SegmentedControl, SliderWithInput, ToggleSwitch, VizButton } from './shared/controls';

// Import modular systems
import { BoundaryCondition, BoundaryType, createBoundaryCondition, type Bounds } from './md/BoundaryConditions';
import { PotentialManager, createDefaultPotentials, LennardJonesPotential, CoulombPotential } from './md/Potentials';
import { Thermostat, ThermostatType, createThermostat } from './md/Thermostats';
import { AnalyticsEngine } from './md/Analytics';
import { NeighborList, createNeighborList } from './md/NeighborList';
import { VectorField, createVectorField, applyFieldPreset, FieldPreset, FieldShape } from './md/VectorField';
import { ElectricField, createElectricField, ElectricFieldPreset } from './md/ElectricField';

// Import refactored modules
import { SimulationScenario, SCENARIOS } from './md/scenarios';
import { ARGON, BOLTZMANN_CONSTANT } from './md/constants';
import SimulationControls from './md/SimulationControls';
import AnalyticsPlot from './md/AnalyticsPlot';
import { useSimulation } from './md/useSimulation';
import { useCanvasRenderer } from './md/useCanvasRenderer';
import { usePointerHandlers } from './md/usePointerHandlers';

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

const SCENARIO_OPTIONS = (Object.keys(SCENARIOS) as SimulationScenario[]).map((key) => ({
    value: key,
    label: SCENARIOS[key].name,
    title: SCENARIOS[key].description,
}));

const MolecularDynamics: React.FC<{ title: string }> = ({ title }) => {
    const theme = useVizTheme();
    const isDark = theme.isDark;

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [boxSize, setBoxSize] = useState<BoxSize>('medium');
    const { width, height } = BOX_SIZES[boxSize];

    // Simulation parameters - using physical units (eV, Å, K, amu)
    const [temperature, setTemperature] = useState(1000);  // Kelvin (molten salt)
    const [scenario, setScenario] = useState<SimulationScenario>('custom');
    const [initLayout, setInitLayout] = useState<'random' | 'separated-lr' | 'separated-tb' | 'center-cluster'>('random');
    const [numParticles, setNumParticles] = useState(250);
    const [timeStep, setTimeStep] = useState(0.098);  // ~1 fs (1 internal unit ≈ 10.18 fs)
    const [running, setRunning] = useState(false);
    const [minimizing, setMinimizing] = useState(false);
    const [draggingParticle, setDraggingParticle] = useState<number | null>(null);
    const [stepsPerFrame, setStepsPerFrame] = useState(20);

    // Fixed coordinate scale for position conversion (angstroms to pixels)
    const coordinateScale = 5.0; // Fixed scale for positions: 5 pixels per Å
    // Visual scale only affects circle size
    const [visualScale, setVisualScale] = useState(5.0);
    const [baseParticleRadius, setBaseParticleRadius] = useState(1.7);  // Å - matches sigma/2

    // Particle data using typed arrays (managed by useSimulation hook)
    // const [particleData, setParticleData] = useState<ParticleData | null>(null);

    // Type definitions and parameters - physical units
    const [numTypes] = useState(2);
    const [typeLabels, setTypeLabels] = useState(['Na⁺', 'Cl⁻']);
    // Palette slots per type; colours follow the theme.
    const [typeColorSlots, setTypeColorSlots] = useState([1, 0]);
    const plotColors = useMemo(() => typeColorSlots.map((s) => theme.series[s]), [typeColorSlots, theme]);
    const typeColors = useMemo(() => plotColors.map((c) => withAlpha(c, 0.9)), [plotColors]);
    // LJ parameters: epsilon in eV, sigma in Å (NaCl-like defaults for ionic simulation)
    const [epsilonMatrix, setEpsilonMatrix] = useState([
        [0.1, 0.15],   // eV - Na-Na, Na-Cl (stronger cross-term for stability)
        [0.15, 0.1]    // eV - Cl-Na, Cl-Cl
    ]);
    const [sigmaMatrix, setSigmaMatrix] = useState([
        [2.35, 2.93],  // Å - Na+ size, Na-Cl average
        [2.93, 3.50]   // Å - Cl-Na average, Cl- size
    ]);
    const [charges, setCharges] = useState([1.0, -1.0]);  // elementary charges (Na+, Cl-)
    const [chargeScale, setChargeScale] = useState(1.0);  // Coulomb strength

    // Modular system instances
    const [potentialManager, setPotentialManager] = useState<PotentialManager | null>(null);
    const [boundaryCondition, setBoundaryCondition] = useState<BoundaryCondition | null>(null);
    const [thermostat, setThermostat] = useState<Thermostat | null>(null);
    const [analytics, setAnalytics] = useState<AnalyticsEngine | null>(null);
    const neighborListRef = useRef<NeighborList | null>(null);

    // Cutoff radius for neighbor list (in simulation units)
    const [cutoffRadius, setCutoffRadius] = useState(12.0);

    // Vector field for external forces
    const vectorFieldRef = useRef<VectorField | null>(null);
    const [fieldPreset, setFieldPreset] = useState<FieldPreset>('none');
    const [fieldStrength, setFieldStrength] = useState(100);
    const [fieldShape, setFieldShape] = useState<FieldShape>('harmonic');
    const [showField, setShowField] = useState(true);
    const [brushRadius, setBrushRadius] = useState(20);
    const [fieldChargeMode, setFieldChargeMode] = useState(false);  // If true, field acts like charge (type-dependent)
    const [isDrawing, setIsDrawing] = useState(false);
    const [activeDrawField, setActiveDrawField] = useState<'potential' | 'electric'>('potential');
    const fieldImageRef = useRef<ImageData | null>(null);
    const fieldCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // Electric field (grid-based, affects particles by charge)
    const electricFieldRef = useRef<ElectricField | null>(null);
    const [eFieldPreset, setEFieldPreset] = useState<ElectricFieldPreset>('none');
    const [eFieldStrength, setEFieldStrength] = useState(50);
    const [showEField, setShowEField] = useState(true);

    // Keep refs for use in callbacks that need current values
    const fieldPresetRef = useRef<FieldPreset>(fieldPreset);
    fieldPresetRef.current = fieldPreset;
    const fieldStrengthRef = useRef<number>(fieldStrength);
    fieldStrengthRef.current = fieldStrength;
    const fieldChargeModeRef = useRef<boolean>(fieldChargeMode);
    fieldChargeModeRef.current = fieldChargeMode;
    const eFieldPresetRef = useRef<ElectricFieldPreset>(eFieldPreset);
    eFieldPresetRef.current = eFieldPreset;

    // Debug visualization options
    const [showCells, setShowCells] = useState(false);
    const [showInteractions, setShowInteractions] = useState(false);
    const [showCutoffRadius, setShowCutoffRadius] = useState(false);

    // Boundary and thermostat types
    const [boundaryType, setBoundaryType] = useState<BoundaryType>(BoundaryType.PERIODIC);
    const [thermostatType, setThermostatType] = useState<ThermostatType>(ThermostatType.LANGEVIN);
    
    // Particle type ratio (orange vs blue)
    const [orangeRatio, setOrangeRatio] = useState(0.5); // 50% orange, 50% blue
    
    // Quasi-random generation moved to ParticleData.ts module


    // DPI and canvas setup moved to useCanvasRenderer hook
    // createParticleArrays moved to ParticleData.ts module

    // Initialize modular systems
    useEffect(() => {
        const manager = createDefaultPotentials(epsilonMatrix, sigmaMatrix, charges);

        // Update potential parameters when scales change
        const ljPotential = manager.getPotentials()[0] as LennardJonesPotential;
        const coulombPotential = manager.getPotentials()[1] as CoulombPotential;

        ljPotential.updateParameters(epsilonMatrix, sigmaMatrix, 1.0, 1.0);
        ljPotential.setCutoff(cutoffRadius);
        coulombPotential.updateCharges(charges, chargeScale);
        coulombPotential.setCutoff(cutoffRadius);

        setPotentialManager(manager);
    }, [epsilonMatrix, sigmaMatrix, charges, chargeScale, cutoffRadius]);

    // Initialize boundary conditions
    useEffect(() => {
        if (width && height) {
            const physicsScale = 5.0; // Fixed physics scale
            const bounds: Bounds = {
                xMin: baseParticleRadius,
                xMax: width / physicsScale - baseParticleRadius,
                yMin: baseParticleRadius,
                yMax: height / physicsScale - baseParticleRadius
            };
            const boundary = createBoundaryCondition(boundaryType, bounds);
            setBoundaryCondition(boundary);
        }
    }, [boundaryType, width, height, baseParticleRadius]);

    // Initialize thermostat (only when type changes)
    useEffect(() => {
        const thermo = createThermostat(thermostatType, temperature, timeStep);
        setThermostat(thermo);
    }, [thermostatType, timeStep]);

    // Update thermostat target temperature when temperature changes
    useEffect(() => {
        if (thermostat) {
            thermostat.setTargetTemperature(temperature);
        }
    }, [temperature, thermostat]);

    // Apply a scenario preset - sets all simulation parameters at once
    const applyScenario = useCallback((scenarioKey: SimulationScenario) => {
        const config = SCENARIOS[scenarioKey];

        setScenario(scenarioKey);
        setNumParticles(config.numParticles);
        setTemperature(config.temperature);
        setOrangeRatio(config.orangeRatio);
        setBoundaryType(config.boundaryType);
        setFieldPreset(config.fieldPreset);
        setFieldStrength(config.fieldStrength);
        setEFieldPreset(config.eFieldPreset);
        setEFieldStrength(config.eFieldStrength);
        setInitLayout(config.initLayout);
        setThermostatType(config.thermostat ?? ThermostatType.LANGEVIN);

        // Apply particle type labels and colors
        setTypeLabels(config.particleTypes.map(t => t.label));
        setTypeColorSlots(config.particleTypes.map(t => t.colorSlot));

        // Apply LJ and charge parameters
        setEpsilonMatrix(config.epsilonMatrix);
        setSigmaMatrix(config.sigmaMatrix);
        setCharges(config.charges);
        setChargeScale(config.chargeScale);

        // Apply field presets if vector field exists
        if (vectorFieldRef.current) {
            applyFieldPreset(vectorFieldRef.current, config.fieldPreset, {
                strength: config.fieldStrength,
                width: 15,
                shape: fieldShape,
            });
            updateFieldVisualization();
        }

        // Apply electric field preset
        if (electricFieldRef.current) {
            electricFieldRef.current.applyPreset(config.eFieldPreset, config.eFieldStrength);
        }
    }, [fieldShape]);

    // Initialize analytics
    useEffect(() => {
        const analyticsEngine = new AnalyticsEngine(1.0, 2000, 10.0, 100); // Increased history to 2000 points
        setAnalytics(analyticsEngine);
    }, []);

    // Initialize/update neighbor list when box size or boundary type changes
    // IMPORTANT: Must use same bounds as boundary conditions!
    useEffect(() => {
        if (width && height) {
            const physicsScale = 5.0;
            // Use same bounds as boundary conditions (with particle radius margin)
            const xMin = baseParticleRadius;
            const yMin = baseParticleRadius;
            const boxWidth = width / physicsScale - 2 * baseParticleRadius;
            const boxHeight = height / physicsScale - 2 * baseParticleRadius;
            const isPeriodic = boundaryType === BoundaryType.PERIODIC;

            if (neighborListRef.current) {
                // Update existing neighbor list
                neighborListRef.current.updateBox(boxWidth, boxHeight, xMin, yMin);
                neighborListRef.current.setPeriodicBoundaries(isPeriodic);
                neighborListRef.current.setCutoff(cutoffRadius);
            } else {
                // Create new neighbor list
                neighborListRef.current = createNeighborList(
                    boxWidth,
                    boxHeight,
                    xMin,
                    yMin,
                    1500, // maxAtoms
                    {
                        cutoff: cutoffRadius,
                        skin: 2.0,
                        isPeriodic,
                        maxNeighborsPerAtom: 64,
                        rebuildInterval: 20
                    }
                );
            }
        }
    }, [width, height, boundaryType, cutoffRadius, baseParticleRadius]);

    // Initialize/update vector field when box size changes
    useEffect(() => {
        if (width && height) {
            const physicsScale = 5.0;
            const boxWidth = width / physicsScale;
            const boxHeight = height / physicsScale;

            // Grid resolution: 1 cell per ~2 angstroms (good balance of resolution and performance)
            const gridWidth = Math.max(16, Math.floor(boxWidth / 2));
            const gridHeight = Math.max(16, Math.floor(boxHeight / 2));

            vectorFieldRef.current = createVectorField({
                gridWidth,
                gridHeight,
                boxWidth,
                boxHeight,
                xMin: 0,
                yMin: 0,
            });

            // Apply current preset
            applyFieldPreset(vectorFieldRef.current, fieldPreset, { strength: fieldStrength, width: 15 });

            // Create offscreen canvas for field rendering (always update dimensions)
            if (!fieldCanvasRef.current) {
                fieldCanvasRef.current = document.createElement('canvas');
            }
            // Always update canvas dimensions to match current grid
            fieldCanvasRef.current.width = gridWidth;
            fieldCanvasRef.current.height = gridHeight;

            // Pre-render the field visualization
            fieldImageRef.current = vectorFieldRef.current.renderToImageData('potential', isDark);
            const ctx = fieldCanvasRef.current.getContext('2d');
            if (ctx && fieldImageRef.current) {
                ctx.putImageData(fieldImageRef.current, 0, 0);
            }
        }
    }, [width, height, isDark]);

    // Initialize electric field when box size changes
    useEffect(() => {
        if (width && height) {
            const physicsScale = 5.0;
            const boxWidth = width / physicsScale;
            const boxHeight = height / physicsScale;

            // Coarse grid for electric field (8x8 to 12x12 arrows)
            const eGridWidth = Math.max(6, Math.min(12, Math.floor(boxWidth / 10)));
            const eGridHeight = Math.max(6, Math.min(12, Math.floor(boxHeight / 10)));

            electricFieldRef.current = createElectricField({
                gridWidth: eGridWidth,
                gridHeight: eGridHeight,
                boxWidth,
                boxHeight,
                xMin: 0,
                yMin: 0,
            });

            // Apply current preset
            electricFieldRef.current.applyPreset(eFieldPreset, eFieldStrength);
        }
    }, [width, height]);

    // Update electric field when preset or strength changes
    useEffect(() => {
        if (electricFieldRef.current) {
            electricFieldRef.current.applyPreset(eFieldPreset, eFieldStrength);
        }

        // Auto-enable electrode walls when battery mode is selected
        if (eFieldPreset === 'battery-lr' || eFieldPreset === 'battery-rl') {
            if (fieldPreset !== 'electrode-walls' && fieldPreset !== 'draw') {
                setFieldPreset('electrode-walls');
            }
        }
    }, [eFieldPreset, eFieldStrength]);

    // Update vector field when preset, strength, or shape changes
    useEffect(() => {
        if (vectorFieldRef.current) {
            applyFieldPreset(vectorFieldRef.current, fieldPreset, {
                strength: fieldStrength,
                width: 15,
                shape: fieldShape,
            });
            updateFieldVisualization();
        }
    }, [fieldPreset, fieldStrength, fieldShape]);

    // Field visualization and particle initialization moved to hooks

    // Physics calculations (calculateForces, velocityVerlet) moved to useSimulation hook



    // Pointer handlers moved to usePointerHandlers hook

    // Animation loop moved to useCanvasRenderer hook

    // Set one pair parameter, keeping the matrix symmetric. Functional
    // updates so several calls in one event compose correctly.
    const updateInteractionParameter = useCallback((paramType: string, type1: number, type2: number, value: number) => {
        const update = (m: number[][]) => {
            const next = m.map((row) => [...row]);
            next[type1][type2] = value;
            next[type2][type1] = value;
            return next;
        };
        if (paramType === 'epsilon') setEpsilonMatrix(update);
        else if (paramType === 'sigma') setSigmaMatrix(update);
    }, []);

    // Use the simulation hook for physics and particle management
    const { particleData, setParticleData, initializeParticles, velocityVerlet, minimizeStep, stepCount } = useSimulation({
        numParticles,
        numTypes,
        orangeRatio,
        width,
        height,
        temperature,
        timeStep,
        baseParticleRadius,
        coordinateScale,
        initLayout,
        potentialManager,
        boundaryCondition,
        thermostat,
        neighborListRef,
        vectorFieldRef,
        electricFieldRef,
        fieldPresetRef,
        fieldChargeModeRef,
        eFieldPresetRef,
        analytics,
    });

    // Animated energy minimization (cancelled on unmount)
    const minimizeRafRef = useRef(0);
    useEffect(() => () => cancelAnimationFrame(minimizeRafRef.current), []);
    const runMinimization = useCallback(() => {
        if (minimizing || running) return;
        setMinimizing(true);
        setRunning(false);  // Stop dynamics during minimization

        let steps = 0;
        const maxSteps = 100;

        const animateStep = () => {
            const converged = minimizeStep();
            steps++;

            if (converged || steps >= maxSteps) {
                minimizeRafRef.current = 0;
                setMinimizing(false);
            } else {
                minimizeRafRef.current = requestAnimationFrame(animateStep);
            }
        };

        minimizeRafRef.current = requestAnimationFrame(animateStep);
    }, [minimizing, running, minimizeStep]);

    // Initialize particles when dependencies change
    useEffect(() => {
        initializeParticles();
    }, [numParticles, numTypes, orangeRatio, width, height, boundaryType, thermostatType, initLayout]);

    // Use the canvas renderer hook for rendering and animation
    const { updateFieldVisualization } = useCanvasRenderer({
        canvasRef,
        particleData,
        width,
        height,
        running,
        isDark,
        theme,
        coordinateScale,
        visualScale,
        baseParticleRadius,
        typeColors,
        vectorFieldRef,
        electricFieldRef,
        neighborListRef,
        showField,
        showEField,
        showCells,
        showInteractions,
        showCutoffRadius,
        fieldPreset,
        eFieldPreset,
        cutoffRadius,
        stepsPerFrame,
        onSimulationStep: velocityVerlet,
        isPeriodic: boundaryType === BoundaryType.PERIODIC,
    });

    // Use the pointer handlers hook for mouse/touch interaction
    const { handlePointerDown, handlePointerMove, handlePointerUp, handleContextMenu } = usePointerHandlers({
        canvasRef,
        particleData,
        vectorFieldRef,
        electricFieldRef,
        fieldPreset,
        eFieldPreset,
        fieldStrength,
        eFieldStrength,
        fieldShape,
        brushRadius,
        coordinateScale,
        visualScale,
        baseParticleRadius,
        onVectorFieldUpdate: updateFieldVisualization,
    });

    const hasField = fieldPreset !== 'none' && fieldPreset !== 'draw';
    const hasEField = eFieldPreset !== 'none';
    const reapplyField = (strength: number) => {
        if (vectorFieldRef.current) {
            applyFieldPreset(vectorFieldRef.current, fieldPreset, { strength, width: 15, shape: fieldShape });
            updateFieldVisualization();
        }
    };

    const sidebar = (
        <VizPanel stack>
            <ControlGroup label="Scenario" hint={SCENARIOS[scenario].description}>
                <SegmentedControl aria-label="Scenario" columns={2} value={scenario} onChange={applyScenario} options={SCENARIO_OPTIONS} />
            </ControlGroup>

            {(hasField || hasEField) && (
                <ControlGroup label="External field">
                    {hasField && (
                        <>
                            <SliderWithInput
                                label="Barrier strength"
                                value={fieldStrength}
                                onChange={(v) => {
                                    setFieldStrength(v);
                                    reapplyField(v);
                                }}
                                min={10} max={200} step={10} decimals={0}
                            />
                            <ToggleSwitch label="Show barriers" checked={showField} onChange={setShowField} />
                        </>
                    )}
                    {hasEField && (
                        <>
                            <SliderWithInput
                                label="Electric field"
                                value={eFieldStrength}
                                onChange={(v) => {
                                    setEFieldStrength(v);
                                    electricFieldRef.current?.applyPreset(eFieldPreset, v);
                                }}
                                min={0} max={200} step={5} decimals={0}
                                unit="mV/Å"
                            />
                            <ToggleSwitch label="Show field arrows" checked={showEField} onChange={setShowEField} />
                        </>
                    )}
                </ControlGroup>
            )}

            <SimulationControls<BoxSize>
                theme={theme}
                boxSize={boxSize}
                setBoxSize={setBoxSize}
                boxOptions={BOX_OPTIONS}
                numParticles={numParticles}
                setNumParticles={setNumParticles}
                temperature={temperature}
                setTemperature={setTemperature}
                timeStep={timeStep}
                setTimeStep={setTimeStep}
                stepsPerFrame={stepsPerFrame}
                setStepsPerFrame={setStepsPerFrame}
                orangeRatio={orangeRatio}
                setOrangeRatio={setOrangeRatio}
                boundaryType={boundaryType}
                setBoundaryType={setBoundaryType}
                thermostatType={thermostatType}
                setThermostatType={setThermostatType}
                chargeScale={chargeScale}
                setChargeScale={setChargeScale}
                visualScale={visualScale}
                setVisualScale={setVisualScale}
                charges={charges}
                setCharges={setCharges}
                typeLabels={typeLabels}
                setTypeLabels={setTypeLabels}
                typeColors={plotColors}
                typeColorSlots={typeColorSlots}
                setTypeColorSlots={setTypeColorSlots}
                epsilonMatrix={epsilonMatrix}
                sigmaMatrix={sigmaMatrix}
                updateInteractionParameter={updateInteractionParameter}
                numTypes={numTypes}
                showCells={showCells}
                setShowCells={setShowCells}
                showInteractions={showInteractions}
                setShowInteractions={setShowInteractions}
                showCutoffRadius={showCutoffRadius}
                setShowCutoffRadius={setShowCutoffRadius}
                cutoffRadius={cutoffRadius}
                setCutoffRadius={setCutoffRadius}
            />

            {scenario === 'custom' && (
                <CollapsibleSection title="Draw a potential">
                    <ToggleSwitch
                        label="Draw on the canvas"
                        checked={fieldPreset === 'draw'}
                        onChange={(on) => setFieldPreset(on ? 'draw' : 'none')}
                    />
                    {fieldPreset === 'draw' && (
                        <>
                            <ControlHint>Left-drag to attract, right-drag to repel.</ControlHint>
                            <SliderWithInput label="Brush size" value={brushRadius} onChange={setBrushRadius} min={2} max={30} step={1} decimals={0} />
                            <SliderWithInput label="Strength" value={fieldStrength} onChange={setFieldStrength} min={10} max={200} step={10} decimals={0} />
                            <ToggleSwitch label="Show drawn field" checked={showField} onChange={setShowField} />
                            <ToggleSwitch label="Acts on charge (+/−)" checked={fieldChargeMode} onChange={setFieldChargeMode} />
                            <VizButton
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                    vectorFieldRef.current?.clear();
                                    updateFieldVisualization();
                                }}
                            >
                                Clear drawing
                            </VizButton>
                        </>
                    )}
                </CollapsibleSection>
            )}
        </VizPanel>
    );

    const time = analytics ? analytics.getCurrentTime() * 0.01018 : 0;

    return (
        <VizWorkbench sidebar={sidebar}>
            <VizPanel flush>
                <VizPanelSection style={{ display: 'grid', gap: '0.75rem' }}>
                    <VizPlotHeader
                        title={title}
                        readout={`${time.toFixed(2)} ps · ${stepCount.toLocaleString()} steps`}
                    />
                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                        <VizButton variant="primary" style={{ minWidth: '5.5rem' }} onClick={() => setRunning(!running)}>
                            {running ? 'Pause' : 'Run'}
                        </VizButton>
                        <VizButton variant="secondary" onClick={initializeParticles}>
                            Reset
                        </VizButton>
                        <VizButton
                            variant="secondary"
                            onClick={runMinimization}
                            disabled={minimizing || running}
                            title="Relax the structure to a local energy minimum"
                        >
                            {minimizing ? 'Minimising…' : 'Minimise energy'}
                        </VizButton>
                    </div>
                    <VizCanvasFit width={width} height={height} reserve={330}>
                        <canvas
                            ref={canvasRef}
                            aria-label="Molecular dynamics simulation; drag particles to move them"
                            style={{
                                display: 'block',
                                width: '100%',
                                height: '100%',
                                borderRadius: 'var(--viz-radius)',
                                touchAction: 'none',
                                cursor: fieldPreset === 'draw' ? 'crosshair' : 'grab',
                            }}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                            onContextMenu={handleContextMenu}
                        />
                    </VizCanvasFit>
                </VizPanelSection>
                <VizPanelSection>
                    <AnalyticsPlot
                        analytics={analytics}
                        particleData={particleData}
                        theme={theme}
                        typeLabels={typeLabels}
                        typeColors={plotColors}
                    />
                </VizPanelSection>
            </VizPanel>
        </VizWorkbench>
    );
};

export default MolecularDynamics;
