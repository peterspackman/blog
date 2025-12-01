import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useColorMode } from '@docusaurus/theme-common';

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
import SimulationToolbar from './md/SimulationToolbar';
import AnalyticsPlot from './md/AnalyticsPlot';
import { SimplifiedFieldControls } from './md/FieldControls';
import { useSimulation } from './md/useSimulation';
import { useCanvasRenderer } from './md/useCanvasRenderer';
import { usePointerHandlers } from './md/usePointerHandlers';

const MolecularDynamics = () => {
    // Dark mode support
    const { colorMode } = useColorMode();
    const isDark = colorMode === 'dark';

    // Theme-aware colors
    const theme = {
        background: isDark ? '#1e1e1e' : '#ffffff',
        surface: isDark ? '#2d2d2d' : '#f8f9fa',
        border: isDark ? '#444' : '#ccc',
        text: isDark ? '#e0e0e0' : '#333',
        textMuted: isDark ? '#888' : '#666',
        canvasBg: isDark ? '#1a1a1a' : '#ffffff',
    };

    // Resizable canvas (must be first)
    const [canvasWidth, setCanvasWidth] = useState(800);
    const [canvasHeight, setCanvasHeight] = useState(600);
    
    // Canvas and UI refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const animationFrameId = useRef<number>(0);
    
    // Canvas dimensions (use resizable values)
    const [width, setWidth] = useState(800);
    const [height, setHeight] = useState(600);
    
    // Initialize canvas size to match container
    useEffect(() => {
        if (containerRef.current) {
            const containerRect = containerRef.current.getBoundingClientRect();
            const initialWidth = Math.max(400, containerRect.width - 10); // Full container width minus padding
            const initialHeight = Math.max(300, Math.min(600, initialWidth * 0.6)); // Maintain reasonable aspect ratio
            
            setCanvasWidth(initialWidth);
            setCanvasHeight(initialHeight);
        }
    }, []);

    // Update canvas size when resizable dimensions change
    useEffect(() => {
        setWidth(canvasWidth);
        setHeight(canvasHeight);
    }, [canvasWidth, canvasHeight]);

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
    const [typeColors, setTypeColors] = useState(['rgba(255, 165, 0, 0.8)', 'rgba(0, 100, 255, 0.8)']);
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

    // Responsive layout
    const [isMobile, setIsMobile] = useState(false);
    const [showControls, setShowControls] = useState(true);

    // Detect mobile viewport
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) setShowControls(false);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    
    // Boundary and thermostat types
    const [boundaryType, setBoundaryType] = useState<BoundaryType>(BoundaryType.PERIODIC);
    const [thermostatType, setThermostatType] = useState<ThermostatType>(ThermostatType.LANGEVIN);
    
    // Particle type ratio (orange vs blue)
    const [orangeRatio, setOrangeRatio] = useState(0.5); // 50% orange, 50% blue
    
    // These are now handled by the sub-components
    
    // Resize handle
    const [isResizing, setIsResizing] = useState(false);
    const resizeStartPos = useRef({ x: 0, y: 0 });
    const resizeStartSize = useRef({ width: 0, height: 0 });
    
    const handleResizeStart = (e: React.MouseEvent) => {
        setIsResizing(true);
        resizeStartPos.current = { x: e.clientX, y: e.clientY };
        resizeStartSize.current = { width: canvasWidth, height: canvasHeight };
        e.preventDefault();
    };
    
    const handleResizeMove = (e: MouseEvent) => {
        if (!isResizing) return;
        
        const deltaX = e.clientX - resizeStartPos.current.x;
        const deltaY = e.clientY - resizeStartPos.current.y;
        
        const newWidth = Math.max(400, Math.min(1200, resizeStartSize.current.width + deltaX));
        const newHeight = Math.max(300, Math.min(800, resizeStartSize.current.height + deltaY));
        
        setCanvasWidth(newWidth);
        setCanvasHeight(newHeight);
    };
    
    const handleResizeEnd = () => {
        setIsResizing(false);
    };
    
    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleResizeMove);
            document.addEventListener('mouseup', handleResizeEnd);
            return () => {
                document.removeEventListener('mousemove', handleResizeMove);
                document.removeEventListener('mouseup', handleResizeEnd);
            };
        }
    }, [isResizing]);

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

        // Apply particle type labels and colors
        setTypeLabels(config.particleTypes.map(t => t.label));
        setTypeColors(config.particleTypes.map(t => t.color));

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

    // Add a method to update interaction parameters for different type pairs
    const updateInteractionParameter = (paramType, type1, type2, value) => {
        // This provides an API to modify individual interaction parameters
        if (paramType === 'epsilon') {
            const newMatrix = [...epsilonMatrix];
            newMatrix[type1][type2] = value;
            newMatrix[type2][type1] = value; // Ensure symmetry
            setEpsilonMatrix(newMatrix);
        } else if (paramType === 'sigma') {
            const newMatrix = [...sigmaMatrix];
            newMatrix[type1][type2] = value;
            newMatrix[type2][type1] = value; // Ensure symmetry
            setSigmaMatrix(newMatrix);
        }
    };

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

    // Animated energy minimization
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
                setMinimizing(false);
            } else {
                requestAnimationFrame(animateStep);
            }
        };

        requestAnimationFrame(animateStep);
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

    return (
        <div style={{
            width: '100%',
            maxWidth: '1400px',
            margin: '0 auto',
            minHeight: '100vh',
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 300px',
            gap: '1rem',
            padding: '1rem',
            boxSizing: 'border-box'
        }}>
            {/* Main content: Toolbar + Canvas + Plot */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ width: '100%', maxWidth: `${canvasWidth + 20}px` }}>
                    {/* Unified toolbar */}
                    <SimulationToolbar
                        running={running}
                        setRunning={setRunning}
                        onReset={initializeParticles}
                        minimizing={minimizing}
                        onMinimize={runMinimization}
                        scenario={scenario}
                        onScenarioChange={applyScenario}
                        time={analytics ? analytics.getCurrentTime() * 0.01018 : 0}
                        stepCount={stepCount}
                        isDrawMode={fieldPreset === 'draw'}
                        setIsDrawMode={(mode) => setFieldPreset(mode ? 'draw' : 'none')}
                        brushRadius={brushRadius}
                        setBrushRadius={setBrushRadius}
                        fieldStrength={fieldStrength}
                        setFieldStrength={setFieldStrength}
                        showField={showField}
                        setShowField={setShowField}
                        fieldChargeMode={fieldChargeMode}
                        setFieldChargeMode={setFieldChargeMode}
                        onClearField={() => {
                            if (vectorFieldRef.current) {
                                vectorFieldRef.current.clear();
                                updateFieldVisualization();
                            }
                        }}
                        isDark={isDark}
                    />

                    {/* Canvas container with floating controls */}
                    <div ref={containerRef} style={{
                        width: `${canvasWidth + 10}px`,
                        height: `${canvasHeight + 10}px`,
                        backgroundColor: theme.canvasBg,
                        position: 'relative',
                        padding: '5px',
                        margin: '0.5rem auto 0',
                        borderRadius: '8px',
                        border: `1px solid ${theme.border}`,
                    }}>
                        <canvas
                            ref={canvasRef}
                            style={{
                                display: 'block',
                                width: `${width}px`,
                                height: `${height}px`,
                                backgroundColor: theme.canvasBg,
                                borderRadius: '4px',
                                touchAction: 'none'
                            }}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                            onContextMenu={handleContextMenu}
                        />

                        {/* Floating field controls inside canvas (only for preset scenarios) */}
                        {scenario !== 'custom' && (
                            <SimplifiedFieldControls
                                fieldPreset={fieldPreset}
                                fieldStrength={fieldStrength}
                                setFieldStrength={setFieldStrength}
                                eFieldPreset={eFieldPreset}
                                eFieldStrength={eFieldStrength}
                                setEFieldStrength={setEFieldStrength}
                                showField={showField}
                                setShowField={setShowField}
                                showEField={showEField}
                                setShowEField={setShowEField}
                                onFieldStrengthChange={(newStrength) => {
                                    if (vectorFieldRef.current) {
                                        applyFieldPreset(vectorFieldRef.current, fieldPreset, {
                                            strength: newStrength,
                                            width: 15,
                                            shape: fieldShape,
                                        });
                                        updateFieldVisualization();
                                    }
                                }}
                                onEFieldStrengthChange={(newStrength) => {
                                    if (electricFieldRef.current) {
                                        electricFieldRef.current.applyPreset(eFieldPreset, newStrength);
                                    }
                                }}
                                isDark={isDark}
                            />
                        )}

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
                </div>
                
                {/* Analytics Plot */}
                <AnalyticsPlot
                    analytics={analytics}
                    particleData={particleData}
                    width={canvasWidth + 10}
                    isDark={isDark}
                    typeLabels={typeLabels}
                    typeColors={typeColors}
                />
            </div>
            
            {/* Controls - collapsible on mobile */}
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
                        fontSize: '0.9rem'
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
                        overflowY: 'auto'
                    } : {})
                }}>
                    <SimulationControls
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
                        typeColors={typeColors}
                        setTypeColors={setTypeColors}
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
                        isDark={isDark}
                    />
                </div>
            )}
        </div>
    );
};

export default MolecularDynamics;
