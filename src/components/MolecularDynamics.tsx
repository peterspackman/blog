import React, { useState, useEffect, useRef } from 'react';

// Import modular systems
import { BoundaryCondition, BoundaryType, createBoundaryCondition, type Bounds } from './md/BoundaryConditions';
import { PotentialManager, createDefaultPotentials, LennardJonesPotential, CoulombPotential } from './md/Potentials';
import { Thermostat, ThermostatType, createThermostat, type ParticleSystemData } from './md/Thermostats';
import { Barostat, BarostatType, createBarostat, applyBoxScaling, type SystemBox } from './md/Barostats';
import { AnalyticsEngine } from './md/Analytics';
import SimulationControls from './md/SimulationControls';
import AnalyticsPlot from './md/AnalyticsPlot';

interface ParticleData extends ParticleSystemData {
    oldAccelerations: Float32Array;
    types: Uint8Array;
    typeCounts: number[];
}

const MolecularDynamics = () => {
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

    // Simulation parameters
    const [temperature, setTemperature] = useState(0.3);
    const [numParticles, setNumParticles] = useState(100);
    const [timeStep, setTimeStep] = useState(0.015);
    const [running, setRunning] = useState(false);
    const [draggingParticle, setDraggingParticle] = useState<number | null>(null);
    const [stepsPerFrame, setStepsPerFrame] = useState(30);

    // Fixed coordinate scale for position conversion (angstroms to pixels)
    const coordinateScale = 5.0; // Fixed scale for positions
    // Visual scale only affects circle size
    const [visualScale, setVisualScale] = useState(5.0);
    const [baseParticleRadius, setBaseParticleRadius] = useState(1.5);

    // Particle data using typed arrays
    const [particleData, setParticleData] = useState<ParticleData | null>(null);

    // Type definitions and parameters
    const [numTypes] = useState(2);
    const [typeColors, setTypeColors] = useState(['rgba(255, 165, 0, 0.8)', 'rgba(0, 0, 255, 0.8)']);
    const [epsilonMatrix, setEpsilonMatrix] = useState([[1.0, 0.8], [0.8, 1.0]]);
    const [sigmaMatrix, setSigmaMatrix] = useState([[3.5, 3.2], [3.2, 3.0]]);
    const [charges, setCharges] = useState([1.0, -1.0]);
    const [epsilonScale, setEpsilonScale] = useState(1.0);
    const [sigmaScale, setSigmaScale] = useState(1.0);
    const [chargeScale, setChargeScale] = useState(1.0);

    // Modular system instances
    const [potentialManager, setPotentialManager] = useState<PotentialManager | null>(null);
    const [boundaryCondition, setBoundaryCondition] = useState<BoundaryCondition | null>(null);
    const [thermostat, setThermostat] = useState<Thermostat | null>(null);
    const [analytics, setAnalytics] = useState<AnalyticsEngine | null>(null);
    
    // Boundary and thermostat types
    const [boundaryType, setBoundaryType] = useState<BoundaryType>(BoundaryType.REFLECTIVE);
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

    // Proper 2D quasi-random sequence generator (Halton sequence)
    const generateQuasiRandom = (n: number): number[][] => {
        const points: number[][] = [];
        
        // Halton sequence using bases 2 and 3 for better 2D distribution
        const halton = (index: number, base: number): number => {
            let result = 0;
            let f = 1 / base;
            let i = index;
            while (i > 0) {
                result += f * (i % base);
                i = Math.floor(i / base);
                f = f / base;
            }
            return result;
        };
        
        for (let i = 0; i < n; i++) {
            const x = halton(i + 1, 2); // Base 2 for x-coordinate
            const y = halton(i + 1, 3); // Base 3 for y-coordinate
            points.push([x, y]);
        }
        return points;
    };


    // Add this function to your component
    const normalizeCanvasDPI = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: false });

        // Get the device pixel ratio
        const dpr = window.devicePixelRatio || 1;

        // First, set the display size to match the container's dimensions
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        // Next, normalize the canvas by setting its internal dimensions to match
        // its display size (undoing the automatic DPI scaling)
        canvas.width = width;
        canvas.height = height;
    };

    // Call this function whenever the canvas size changes
    useEffect(() => {
        normalizeCanvasDPI();
    }, [width, height]);

    // You may also want to call it on window resize events
    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                const containerWidth = containerRef.current.clientWidth;
                setWidth(Math.min(containerWidth, 800));
                setHeight(400);
                // The normalizeCanvasDPI will be called when width/height change
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Create the particle data structure
    const createParticleArrays = (count) => {
        return {
            // Main property arrays
            positions: new Float32Array(count * 2),       // x, y pairs
            velocities: new Float32Array(count * 2),      // vx, vy pairs
            accelerations: new Float32Array(count * 2),   // ax, ay pairs
            oldAccelerations: new Float32Array(count * 2),// ax_old, ay_old pairs
            types: new Uint8Array(count),                 // particle type index
            masses: new Float32Array(count),              // mass of each particle

            // Metadata
            count: count,                                // total particle count
            typeCounts: new Array(numTypes).fill(0),    // count per type
        };
    };

    // Initialize modular systems
    useEffect(() => {
        const manager = createDefaultPotentials(epsilonMatrix, sigmaMatrix, charges);
        
        // Update potential parameters when scales change
        const ljPotential = manager.getPotentials()[0] as LennardJonesPotential;
        const coulombPotential = manager.getPotentials()[1] as CoulombPotential;
        
        ljPotential.updateParameters(epsilonMatrix, sigmaMatrix, epsilonScale, sigmaScale);
        coulombPotential.updateCharges(charges, chargeScale);
        
        setPotentialManager(manager);
    }, [epsilonMatrix, sigmaMatrix, charges, epsilonScale, sigmaScale, chargeScale]);

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

    // Initialize analytics
    useEffect(() => {
        const analyticsEngine = new AnalyticsEngine(1.0, 2000, 10.0, 100); // Increased history to 2000 points
        setAnalytics(analyticsEngine);
    }, []);

    // Initialize particles (only reset for fundamental changes)
    useEffect(() => {
        initializeParticles();
    }, [numParticles, numTypes, orangeRatio, width, height, boundaryType, thermostatType]);

    const initializeParticles = () => {
        // Create new typed arrays for particles
        const newParticleData = createParticleArrays(numParticles);

        // Calculate simulation space in angstroms (independent of visual scale)
        const physicsScale = 5.0; // Fixed physics scale: pixels to angstroms
        const effectiveWidth = width / physicsScale;
        const effectiveHeight = height / physicsScale;

        // Determine grid dimensions based on aspect ratio
        const aspectRatio = effectiveWidth / effectiveHeight;
        let gridCols = Math.ceil(Math.sqrt(numParticles * aspectRatio));
        let gridRows = Math.ceil(numParticles / gridCols);

        // Calculate spacing between particle centers in angstroms
        const spacingX = effectiveWidth / Math.max(gridCols - 1, 1);
        const spacingY = effectiveHeight / Math.max(gridRows - 1, 1);

        // Minimum spacing should account for particle size (in angstroms)
        const minSpacing = baseParticleRadius * 4; // Ensure particles don't overlap

        // Adjust grid if spacing is too small
        if (spacingX < minSpacing || spacingY < minSpacing) {
            gridCols = Math.floor(effectiveWidth / minSpacing);
            gridRows = Math.ceil(numParticles / gridCols);
        }

        // Reset type counters
        newParticleData.typeCounts.fill(0);

        // Generate quasi-random positions for better distribution
        const quasiPoints = generateQuasiRandom(numParticles);
        
        // Calculate deterministic particle type distribution
        const numOrange = Math.floor(numParticles * orangeRatio);
        const numBlue = numParticles - numOrange;
        newParticleData.typeCounts[0] = numOrange; // Orange
        newParticleData.typeCounts[1] = numBlue;   // Blue

        // Distribute particles using quasi-random positions
        for (let i = 0; i < numParticles; i++) {
            // Use quasi-random points scaled to simulation bounds
            const margin = baseParticleRadius * 2;
            const xPos = margin + quasiPoints[i][0] * (effectiveWidth - 2 * margin);
            const yPos = margin + quasiPoints[i][1] * (effectiveHeight - 2 * margin);

            // Assign velocities with Maxwell-Boltzmann distribution
            const angle = Math.random() * 2 * Math.PI;
            const speed = Math.sqrt(-2 * Math.log(Math.max(0.001, Math.random()))) * Math.sqrt(temperature);

            // Assign types deterministically: first numOrange particles are orange, rest are blue
            const typeIdx = i < numOrange ? 0 : 1;

            // Store in typed arrays
            const idx = i * 2;
            newParticleData.positions[idx] = xPos;
            newParticleData.positions[idx + 1] = yPos;
            newParticleData.velocities[idx] = speed * Math.cos(angle);
            newParticleData.velocities[idx + 1] = speed * Math.sin(angle);
            newParticleData.accelerations[idx] = 0;
            newParticleData.accelerations[idx + 1] = 0;
            newParticleData.oldAccelerations[idx] = 0;
            newParticleData.oldAccelerations[idx + 1] = 0;
            newParticleData.types[i] = typeIdx;
            newParticleData.masses[i] = 1.0;
        }

        // Reset and update analytics with new particle types
        if (analytics) {
            analytics.reset(); // Clear all previous data
            analytics.setParticleTypes(newParticleData.types);
        }
        setParticleData(newParticleData);
    };

    // Calculate forces between particles using modular potential system
    const calculateForces = () => {
        if (!particleData || !potentialManager) return;

        // Reset accelerations
        particleData.accelerations.fill(0);

        const positions = particleData.positions;
        const accelerations = particleData.accelerations;
        const types = particleData.types;
        const masses = particleData.masses;
        const count = particleData.count;

        // Force scaling for numerical stability
        const forceScale = 0.5;
        let totalPotentialEnergy = 0;
        let totalVirial = 0;

        for (let i = 0; i < count; i++) {
            const idxI = i * 2;
            const typeI = types[i];
            const massI = masses[i];

            for (let j = i + 1; j < count; j++) {
                const idxJ = j * 2;
                const typeJ = types[j];
                const massJ = masses[j];

                // Calculate distance
                const dx = positions[idxJ] - positions[idxI];
                const dy = positions[idxJ + 1] - positions[idxI + 1];
                const rSquared = dx * dx + dy * dy;

                // Skip if too close to avoid numerical issues
                if (rSquared < 0.001) continue;

                const r = Math.sqrt(rSquared);

                // Use potential manager to calculate total force and potential
                const result = potentialManager.calculateTotal(r, typeI, typeJ);
                let totalForce = result.force;
                totalPotentialEnergy += result.potential;

                // Scale and limit the force for stability
                totalForce = forceScale * Math.min(Math.max(totalForce, -50), 50);

                // Calculate virial for pressure calculation
                totalVirial += totalForce * r;

                // Project force onto x and y components
                const invR = 1 / r;
                const fx = totalForce * dx * invR;
                const fy = totalForce * dy * invR;

                // Apply Newton's third law directly to accelerations
                accelerations[idxI] += fx / massI;
                accelerations[idxI + 1] += fy / massI;
                accelerations[idxJ] -= fx / massJ;
                accelerations[idxJ + 1] -= fy / massJ;
            }
        }

        // Update analytics if available
        if (analytics && particleData) {
            const systemVolume = (width / coordinateScale) * (height / coordinateScale);
            analytics.updateTime(timeStep);
            analytics.calculateAndSample(particleData, totalPotentialEnergy, systemVolume, totalVirial);
        }
    };

    // Integration using Velocity Verlet algorithm (optimized for typed arrays)
    const velocityVerlet = () => {
        if (!particleData) return;

        const positions = particleData.positions;
        const velocities = particleData.velocities;
        const accels = particleData.accelerations;
        const oldAccels = particleData.oldAccelerations;
        const count = particleData.count;

        // Precompute constants for efficiency
        const dt = timeStep;
        const dt2Half = 0.5 * dt * dt;
        const dtHalf = 0.5 * dt;

        // Update positions and store old accelerations
        for (let i = 0; i < count; i++) {
            const idx = i * 2;

            // Update positions: r(t+dt) = r(t) + v(t)*dt + 0.5*a(t)*dt²
            positions[idx] += velocities[idx] * dt + accels[idx] * dt2Half;
            positions[idx + 1] += velocities[idx + 1] * dt + accels[idx + 1] * dt2Half;

            // Store old accelerations before calculating new forces
            oldAccels[idx] = accels[idx];
            oldAccels[idx + 1] = accels[idx + 1];
        }

        // Calculate new forces and accelerations
        calculateForces();

        // Update velocities: v(t+dt) = v(t) + 0.5*[a(t) + a(t+dt)]*dt
        for (let i = 0; i < count; i++) {
            const idx = i * 2;
            velocities[idx] += (oldAccels[idx] + accels[idx]) * dtHalf;
            velocities[idx + 1] += (oldAccels[idx + 1] + accels[idx + 1]) * dtHalf;
        }

        // Apply boundary conditions using modular system
        if (boundaryCondition) {
            boundaryCondition.apply(particleData);
        }

        // Apply thermostat occasionally
        if (thermostat && Math.random() < 0.1) {
            thermostat.apply(particleData);
        }
    };



    const handleMouseDown = (e) => {
        if (!canvasRef.current || !particleData) return;

        const rect = canvasRef.current.getBoundingClientRect();
        // Get mouse coordinates in SCREEN pixels
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;

        // Find the particle that was clicked
        const positions = particleData.positions;

        for (let i = 0; i < particleData.count; i++) {
            const idx = i * 2;

            // Convert particle CENTER position to screen coordinates
            const particleScreenX = positions[idx] * coordinateScale;
            const particleScreenY = positions[idx + 1] * coordinateScale;

            // Use bounding box check from the CENTER of the particle
            const dx = Math.abs(particleScreenX - screenX);
            const dy = Math.abs(particleScreenY - screenY);

            // Selection radius in screen pixels
            const selectionSize = baseParticleRadius * visualScale * coordinateScale * 1.2;

            if (dx <= selectionSize && dy <= selectionSize) {
                setDraggingParticle(i);
                break;
            }
        }
    };

    const handleMouseMove = (e) => {
        if (draggingParticle === null || !canvasRef.current || !particleData) return;

        const rect = canvasRef.current.getBoundingClientRect();
        // Get mouse coordinates in screen pixels
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;

        // Convert screen coordinates to simulation coordinates
        const simX = screenX / coordinateScale;
        const simY = screenY / coordinateScale;

        // Update the particle position (center point in simulation coordinates)
        const idx = draggingParticle * 2;
        particleData.positions[idx] = simX;
        particleData.positions[idx + 1] = simY;

        // Reset velocity and acceleration
        particleData.velocities[idx] = 0;
        particleData.velocities[idx + 1] = 0;
        particleData.accelerations[idx] = 0;
        particleData.accelerations[idx + 1] = 0;

        // Force a re-render
        setParticleData({ ...particleData });
    };

    const handleMouseUp = () => {
        setDraggingParticle(null);
    };

    // Update epsilon matrix when the scale changes
    useEffect(() => {
        if (!particleData) return;

        // Update the effective parameters when scales change
        // This is more efficient than regenerating the entire matrix
        // The UI controls the scale factors

    }, [epsilonScale, sigmaScale, chargeScale]);

    // Update canvas size on container resize
    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                const containerWidth = containerRef.current.clientWidth;
                setWidth(Math.min(containerWidth, 800));
                setHeight(400);
            }
        };

        window.addEventListener('resize', updateSize);
        updateSize();

        return () => window.removeEventListener('resize', updateSize);
    }, []);

    // Animation loop with typed array optimizations
    useEffect(() => {
        if (!particleData) return;

        let animationFrameId;

        const render = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d', { alpha: false });
            ctx.strokeStyle = '#000000';
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, width, height);
            ctx.strokeRect(0, 0, width, height);

            // Update simulation if running
            if (running) {
                // Run multiple simulation steps per frame
                for (let i = 0; i < stepsPerFrame; i++) {
                    velocityVerlet();
                }
            }

            // Efficiently draw particles from typed arrays
            const positions = particleData.positions;
            const types = particleData.types;
            const visualRadius = baseParticleRadius * visualScale; // Visual scale only affects circle size

            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 0.5;

            for (let i = 0; i < particleData.count; i++) {
                const idx = i * 2;
                const typeIdx = types[i];

                // Convert position from angstroms to pixels using fixed coordinate scale
                const screenX = positions[idx] * coordinateScale;
                const screenY = positions[idx + 1] * coordinateScale;

                // Draw the particle
                ctx.beginPath();
                ctx.arc(screenX, screenY, visualRadius, 0, 2 * Math.PI);
                ctx.fillStyle = typeColors[typeIdx];
                ctx.fill();
                ctx.stroke();
            }

            animationFrameId = window.requestAnimationFrame(render);
        };

        render();

        return () => {
            window.cancelAnimationFrame(animationFrameId);
        };
    }, [particleData, running, baseParticleRadius, width, height, timeStep, epsilonScale, sigmaScale, chargeScale, stepsPerFrame, visualScale, typeColors, charges, epsilonMatrix]);

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

    return (
        <div style={{ 
            width: '100vw', 
            minHeight: '100vh', 
            display: 'grid',
            gridTemplateColumns: '75% 25%',
            gap: '1rem',
            padding: '1rem',
            boxSizing: 'border-box'
        }}>
            {/* Left side: Canvas + Plot */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                    <h2 style={{ margin: '0 0 1rem 0' }}>Molecular Dynamics Simulation</h2>
                    <div ref={containerRef} style={{ 
                        width: `${canvasWidth + 10}px`,
                        height: `${canvasHeight + 10}px`,
                        border: width === canvasWidth && height === canvasHeight ? 'none' : '1px solid #ccc',
                        backgroundColor: '#f8f9fa',
                        position: 'relative',
                        padding: '5px'
                    }}>
                        <canvas
                            ref={canvasRef}
                            width={width}
                            height={height}
                            style={{ 
                                display: 'block',
                                backgroundColor: '#ffffff'
                            }}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        />
                        {/* Resize handle */}
                        <div
                            onMouseDown={handleResizeStart}
                            style={{
                                position: 'absolute',
                                bottom: '0px',
                                right: '0px',
                                width: '20px',
                                height: '20px',
                                cursor: 'nw-resize',
                                background: 'linear-gradient(-45deg, transparent 40%, #666 40%, #666 60%, transparent 60%)',
                                opacity: 0.7,
                                pointerEvents: 'auto'
                            }}
                        />
                    </div>
                </div>
                
                {/* Analytics Plot */}
                <AnalyticsPlot 
                    analytics={analytics}
                    particleData={particleData}
                />
            </div>
            
            {/* Right side: Controls */}
            <SimulationControls
                running={running}
                setRunning={setRunning}
                initializeParticles={initializeParticles}
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
                epsilonScale={epsilonScale}
                setEpsilonScale={setEpsilonScale}
                sigmaScale={sigmaScale}
                setSigmaScale={setSigmaScale}
                setBaseParticleRadius={setBaseParticleRadius}
                chargeScale={chargeScale}
                setChargeScale={setChargeScale}
                visualScale={visualScale}
                setVisualScale={setVisualScale}
                charges={charges}
                setCharges={setCharges}
                typeColors={typeColors}
                setTypeColors={setTypeColors}
                epsilonMatrix={epsilonMatrix}
                sigmaMatrix={sigmaMatrix}
                updateInteractionParameter={updateInteractionParameter}
                numTypes={numTypes}
            />
        </div>
    );
};

export default MolecularDynamics;
