import React, { useState, useEffect, useRef } from 'react';
import Button from './Button';
import MathFormula from './MathFormula';
import styles from './QMVisualization.module.css';

// Main simulation component
const MolecularDynamics = () => {
    // Canvas settings
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [width, setWidth] = useState(600);
    const [height, setHeight] = useState(400);

    // Simulation parameters
    const [temperature, setTemperature] = useState(0.3);
    const [numParticles, setNumParticles] = useState(100);
    const [timeStep, setTimeStep] = useState(0.015);
    const [running, setRunning] = useState(false);
    const [draggingParticle, setDraggingParticle] = useState(null);
    const [stepsPerFrame, setStepsPerFrame] = useState(30);

    // Unit conversion: angstroms to pixels (for visualization)
    const [visualScale, setVisualScale] = useState(5.0); // pixels per angstrom

    // Particle size in angstroms (actual particle radius)
    const [baseParticleRadius, setBaseParticleRadius] = useState(1.5); // in angstroms

    // Particle data using typed arrays
    const [particleData, setParticleData] = useState(null);
    const [blueCount, setBlueCount] = useState(0);

    // Type definitions and parameters
    const [numTypes, setNumTypes] = useState(2); // Start with 2 types: blue and orange
    const [typeColors, setTypeColors] = useState(['rgba(255, 165, 0, 0.8)', 'rgba(0, 0, 255, 0.8)']);

    // Potential parameters - now arrays/matrices for different types
    const [epsilonMatrix, setEpsilonMatrix] = useState([[1.0, 0.8], [0.8, 1.0]]); // kJ/mol
    const [sigmaMatrix, setSigmaMatrix] = useState([[3.5, 3.2], [3.2, 3.0]]); // angstroms
    const [charges, setCharges] = useState([1.0, -1.0]); // elementary charge units

    // Global epsilon and sigma scaling factors (for UI control)
    const [epsilonScale, setEpsilonScale] = useState(1.0);
    const [sigmaScale, setSigmaScale] = useState(1.0);
    const [chargeScale, setChargeScale] = useState(1.0);

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

    // Potentials and forces - updated to use proper mixing rules
    const calculateLennardJones = (r, type1, type2) => {
        // Get epsilon and sigma for this type pair, applying the scale factor
        const eps = epsilonMatrix[type1][type2] * epsilonScale;
        const sig = sigmaMatrix[type1][type2] * sigmaScale;

        if (r < 0.001) return { potential: 1000, force: 1000 }; // Avoid division by zero

        // LJ calculation with sigma, r in angstroms, epsilon in kJ/mol
        const sigOverR = sig / r;
        const sigOverR6 = Math.pow(sigOverR, 6);

        const potential = 4 * eps * (Math.pow(sigOverR6, 2) - sigOverR6);
        const force = 24 * eps * (sigOverR6 - 2 * Math.pow(sigOverR6, 2)) / r;

        return { potential, force };
    };

    const calculateCoulomb = (r, q1, q2) => {
        // Coulomb's constant in units compatible with our system
        // Using simplified units where charges are scaled
        const k = 138.935; // (kJ/mol)·Å/e² - Coulomb constant

        if (r < 0.001) return { potential: 1000, force: 1000 }; // Avoid division by zero

        // q1 and q2 are charges in elementary charge units, scaled by chargeScale
        const scaledQ1 = q1 * chargeScale;
        const scaledQ2 = q2 * chargeScale;

        const potential = k * scaledQ1 * scaledQ2 / r;
        const force = -k * scaledQ1 * scaledQ2 / (r * r);

        return { potential, force };
    };

    // Initialize particles
    useEffect(() => {
        initializeParticles();
    }, [numParticles, numTypes]);

    const initializeParticles = () => {
        // Create new typed arrays for particles
        const newParticleData = createParticleArrays(numParticles);

        // Calculate appropriate grid size based on available space
        const effectiveWidth = width / visualScale;  // convert to angstroms
        const effectiveHeight = height / visualScale;

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

        // Distribute particles of different types
        for (let i = 0; i < numParticles; i++) {
            const row = Math.floor(i / gridCols);
            const col = i % gridCols;

            // Positions in angstroms (not screen pixels)
            const xPos = baseParticleRadius * 2 + col * spacingX + (Math.random() - 0.5) * (spacingX * 0.3);
            const yPos = baseParticleRadius * 2 + row * spacingY + (Math.random() - 0.5) * (spacingY * 0.3);

            // Assign random velocities (Maxwell-Boltzmann)
            const angle = Math.random() * 2 * Math.PI;
            const speed = Math.sqrt(-2 * Math.log(Math.random())) * Math.sqrt(temperature);

            // Assign types, currently just 2 types with roughly equal distribution
            const typeIdx = Math.floor(Math.random() * numTypes);
            newParticleData.typeCounts[typeIdx]++;

            // Store in typed arrays - interleaved x,y for better memory access
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
            newParticleData.masses[i] = 1.0; // Could vary by type if needed
        }

        setBlueCount(newParticleData.typeCounts[1]); // For display purposes
        setParticleData(newParticleData);
    };

    // Calculate forces between particles - optimized with typed arrays
    const calculateForces = () => {
        if (!particleData) return;

        // Reset accelerations
        particleData.accelerations.fill(0);

        const positions = particleData.positions;
        const accelerations = particleData.accelerations;
        const types = particleData.types;
        const masses = particleData.masses;
        const count = particleData.count;

        // Calculate pairwise forces with spatial optimization
        // Set a cutoff radius for LJ in angstroms
        const cutoffRadius = 10.0; // angstroms

        // Stronger force scaling for more visible interactions
        const forceScale = 0.5; // Reduced because now we're using proper units

        for (let i = 0; i < count; i++) {
            const idxI = i * 2;
            const typeI = types[i];
            const massI = masses[i];
            const chargeI = charges[typeI];

            for (let j = i + 1; j < count; j++) {
                const idxJ = j * 2;
                const typeJ = types[j];
                const massJ = masses[j];
                const chargeJ = charges[typeJ];

                // Calculate distance
                const dx = positions[idxJ] - positions[idxI];
                const dy = positions[idxJ + 1] - positions[idxI + 1];
                const rSquared = dx * dx + dy * dy;

                // Skip if too close to avoid numerical issues
                if (rSquared < 0.001) continue;

                const r = Math.sqrt(rSquared);

                // Calculate forces from both potentials
                let totalForce = 0;

                // Apply Coulomb force
                totalForce += calculateCoulomb(r, chargeI, chargeJ).force;

                // Apply LJ force if within cutoff
                if (r < cutoffRadius) {
                    totalForce += calculateLennardJones(r, typeI, typeJ).force;
                }

                // Scale and limit the force for stability
                totalForce = forceScale * Math.min(Math.max(totalForce, -50), 50);

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

        // Apply boundary conditions (reflective) with proper unit conversions
        applyBoundaryConditions();

        // Apply temperature control occasionally (velocity scaling)
        if (Math.random() < 0.1) {
            controlTemperature();
        }
    };

    // Apply boundary conditions in angstrom space
    const applyBoundaryConditions = () => {
        if (!particleData) return;

        const positions = particleData.positions;
        const velocities = particleData.velocities;

        // Boundaries in angstroms
        const xMin = baseParticleRadius;
        const xMax = width / visualScale - baseParticleRadius;
        const yMin = baseParticleRadius;
        const yMax = height / visualScale - baseParticleRadius;

        // Apply to all particles
        for (let i = 0; i < particleData.count; i++) {
            const idx = i * 2;

            // X boundaries
            if (positions[idx] < xMin) {
                positions[idx] = 2 * xMin - positions[idx];
                velocities[idx] = -velocities[idx] * 0.95; // Slight damping
            } else if (positions[idx] > xMax) {
                positions[idx] = 2 * xMax - positions[idx];
                velocities[idx] = -velocities[idx] * 0.95;
            }

            // Y boundaries
            if (positions[idx + 1] < yMin) {
                positions[idx + 1] = 2 * yMin - positions[idx + 1];
                velocities[idx + 1] = -velocities[idx + 1] * 0.95;
            } else if (positions[idx + 1] > yMax) {
                positions[idx + 1] = 2 * yMax - positions[idx + 1];
                velocities[idx + 1] = -velocities[idx + 1] * 0.95;
            }
        }
    };

    // Temperature control using velocity scaling (optimized)
    const controlTemperature = () => {
        if (!particleData || particleData.count === 0) return;

        const velocities = particleData.velocities;
        const masses = particleData.masses;
        const count = particleData.count;

        let totalKE = 0;

        // Calculate total kinetic energy
        for (let i = 0; i < count; i++) {
            const idx = i * 2;
            const vx = velocities[idx];
            const vy = velocities[idx + 1];
            const v2 = vx * vx + vy * vy;
            totalKE += 0.5 * masses[i] * v2;
        }

        // Calculate current temperature (KE per particle)
        const currentTemp = totalKE / count;

        // Scale velocities
        if (currentTemp > 0.001) { // Avoid division by very small numbers
            const scaleFactor = Math.sqrt(temperature / currentTemp);

            for (let i = 0; i < count; i++) {
                const idx = i * 2;
                velocities[idx] *= scaleFactor;
                velocities[idx + 1] *= scaleFactor;
            }
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
            const particleScreenX = positions[idx] * visualScale;
            const particleScreenY = positions[idx + 1] * visualScale;

            // Use bounding box check from the CENTER of the particle
            const dx = Math.abs(particleScreenX - screenX);
            const dy = Math.abs(particleScreenY - screenY);

            // Selection radius in screen pixels
            const selectionSize = baseParticleRadius * visualScale * 1.2;

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
        const simX = screenX / visualScale;
        const simY = screenY / visualScale;

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
            const visualRadius = baseParticleRadius * visualScale; // Convert to pixels

            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 0.5;

            for (let i = 0; i < particleData.count; i++) {
                const idx = i * 2;
                const typeIdx = types[i];

                // Convert position from angstroms to pixels
                const screenX = positions[idx] * visualScale;
                const screenY = positions[idx + 1] * visualScale;

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
    }, [particleData, running, baseParticleRadius, width, height, timeStep, epsilonScale, sigmaScale, chargeScale, temperature, stepsPerFrame, visualScale, typeColors, charges, epsilonMatrix]);

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
        <div className={styles.container}>
            <div ref={containerRef} className={styles.visualizationRow}>
                <div className={styles.mainVisualizationColumn}>
                    <canvas
                        ref={canvasRef}
                        width={width}
                        height={height}
                        className={styles.canvas}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    />
                </div>
            </div>

            <div className={styles.controlsSection}>
                <h3 className={styles.infoTitle}>Simulation Controls</h3>

                <div className={styles.rangeContainer}>
                    <label className={styles.rangeLabel}>No. of Particles:</label>
                    <input
                        type="range"
                        min="10"
                        max="200"
                        step="10"
                        value={numParticles}
                        onChange={(e) => setNumParticles(parseInt(e.target.value))}
                        className={styles.rangeInput}
                    />
                    <span className={styles.rangeValue}>{numParticles}</span>
                </div>
                <div className={styles.rangeContainer}>
                    <label className={styles.rangeLabel}>Temperature:</label>
                    <input
                        type="range"
                        min="0.0"
                        max="5"
                        step="0.1"
                        value={temperature}
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        className={styles.rangeInput}
                    />
                    <span className={styles.rangeValue}>{temperature.toFixed(2)}</span>
                </div>

                <div className={styles.rangeContainer}>
                    <label className={styles.rangeLabel}>Time step:</label>
                    <input
                        type="range"
                        min="0.005"
                        max="0.1"
                        step="0.005"
                        value={timeStep}
                        onChange={(e) => setTimeStep(parseFloat(e.target.value))}
                        className={styles.rangeInput}
                    />
                    <span className={styles.rangeValue}>{timeStep}</span>
                </div>

                <div className={styles.rangeContainer}>
                    <label className={styles.rangeLabel}>Steps per frame:</label>
                    <input
                        type="range"
                        min="10"
                        max="100"
                        step="10"
                        value={stepsPerFrame}
                        onChange={(e) => setStepsPerFrame(parseInt(e.target.value))}
                        className={styles.rangeInput}
                    />
                    <span className={styles.rangeValue}>{stepsPerFrame}</span>
                </div>



                <div className={styles.rangeContainer}>
                    <label className={styles.rangeLabel}>Epsilon Scale (ε):</label>
                    <input
                        type="range"
                        min="0.1"
                        max="2"
                        step="0.1"
                        value={epsilonScale}
                        onChange={(e) => setEpsilonScale(parseFloat(e.target.value))}
                        className={styles.rangeInput}
                    />
                    <span className={styles.rangeValue}>{epsilonScale.toFixed(2)}</span>
                </div>

                <div className={styles.rangeContainer}>
                    <label className={styles.rangeLabel}>Sigma Scale (σ):</label>
                    <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={sigmaScale}
                        onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            setSigmaScale(value);
                            // Update visual particle size based on sigma
                            setBaseParticleRadius(1.5 * value);
                        }}
                        className={styles.rangeInput}
                    />
                    <span className={styles.rangeValue}>{sigmaScale.toFixed(2)}</span>
                </div>

                <div className={styles.rangeContainer}>
                    <label className={styles.rangeLabel}>Charge Scale (q):</label>
                    <input
                        type="range"
                        min="0.0"
                        max="5"
                        step="0.2"
                        value={chargeScale}
                        onChange={(e) => setChargeScale(parseFloat(e.target.value))}
                        className={styles.rangeInput}
                    />
                    <span className={styles.rangeValue}>{chargeScale.toFixed(2)}</span>
                </div>

                <div className={styles.rangeContainer}>
                    <label className={styles.rangeLabel}>Visual Scale:</label>
                    <input
                        type="range"
                        min="1"
                        max="10"
                        step="0.5"
                        value={visualScale}
                        onChange={(e) => setVisualScale(parseFloat(e.target.value))}
                        className={styles.rangeInput}
                    />
                    <span className={styles.rangeValue}>{visualScale.toFixed(1)}</span>
                </div>

                <div className={styles.controlsRow}>
                    <Button
                        onClick={() => setRunning(!running)}
                        variant={running ? "danger" : "success"}
                    >
                        {running ? 'Pause' : 'Start'}
                    </Button>
                    <Button
                        onClick={initializeParticles}
                        variant="info"
                    >
                        Reset
                    </Button>
                </div>
            </div>

            <div>
                <h3 className={styles.explanationTitle}>Instructions & Information</h3>
                <div className={styles.explanationText}>
                    <p>Particle types: {particleData ? particleData.typeCounts.map((count, i) =>
                        `${count} ${i === 0 ? 'orange' : 'blue'}`).join(', ') : ''}</p>

                    <ul>
                        <li>Click and drag particles to move them manually</li>
                        <li>Adjust temperature to control average particle velocities</li>
                        <li>Modify potential parameters to see different behaviors:
                            <ul>
                                <li>Epsilon (ε): controls the strength of LJ interaction</li>
                                <li>Sigma (σ): controls the equilibrium distance between particles</li>
                                <li>Charge (q): controls the strength of electrostatic interaction</li>
                            </ul>
                        </li>
                        <li>Visual Scale: adjusts the visualization size (angstroms to pixels)</li>
                        <li>Like charges repel, unlike charges attract</li>
                        <li>All particles experience both Lennard-Jones and Coulomb forces</li>
                    </ul>

                    <h4>Type Interactions:</h4>
                    <p>
                        Each type of particle has its own set of interaction parameters.
                        Orange-orange, blue-blue, and orange-blue interactions all use different
                        parameters for more realistic simulations.
                    </p>
                </div>
            </div>

            <div className={styles.controlsSection}>
                <h3 className={styles.infoTitle}>Advanced Type Parameters</h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                        <h4 style={{ marginTop: '5px' }}>Type Charges:</h4>
                        {charges.map((charge, i) => (
                            <div key={`charge-${i}`} className={styles.rangeContainer}>
                                <label className={styles.rangeLabel}>
                                    Type {i} ({i === 0 ? 'Orange' : 'Blue'})
                                </label>
                                <input
                                    type="range"
                                    min="-3"
                                    max="3"
                                    step="0.5"
                                    value={charge}
                                    onChange={(e) => {
                                        const newCharges = [...charges];
                                        newCharges[i] = parseFloat(e.target.value);
                                        setCharges(newCharges);
                                    }}
                                    className={styles.rangeInput}
                                />
                                <span className={styles.rangeValue}>{charge.toFixed(1)}</span>
                            </div>
                        ))}
                    </div>

                    <div>
                        <h4 style={{ marginTop: '5px' }}>Type Colors:</h4>
                        {typeColors.map((color, i) => (
                            <div key={`color-${i}`} className={styles.rangeContainer}>
                                <label className={styles.rangeLabel}>
                                    Type {i} Color:
                                </label>
                                <div
                                    style={{
                                        width: '30px',
                                        height: '20px',
                                        backgroundColor: color,
                                        border: '1px solid #000',
                                        marginRight: '10px'
                                    }}
                                />
                                <select
                                    value={color}
                                    onChange={(e) => {
                                        const newColors = [...typeColors];
                                        newColors[i] = e.target.value;
                                        setTypeColors(newColors);
                                    }}
                                    style={{ flex: 1 }}
                                >
                                    <option value="rgba(255, 165, 0, 0.8)">Orange</option>
                                    <option value="rgba(0, 0, 255, 0.8)">Blue</option>
                                    <option value="rgba(255, 0, 0, 0.8)">Red</option>
                                    <option value="rgba(0, 128, 0, 0.8)">Green</option>
                                    <option value="rgba(128, 0, 128, 0.8)">Purple</option>
                                    <option value="rgba(0, 0, 0, 0.8)">Black</option>
                                </select>
                            </div>
                        ))}
                    </div>
                </div>

                <h4 style={{ marginTop: '15px' }}>Interaction Parameters:</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                    <thead>
                        <tr>
                            <th style={{ padding: '5px', textAlign: 'left' }}>Interaction</th>
                            <th style={{ padding: '5px', textAlign: 'left' }}>Epsilon (ε)</th>
                            <th style={{ padding: '5px', textAlign: 'left' }}>Sigma (σ)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: numTypes }).map((_, i) =>
                            Array.from({ length: i + 1 }).map((_, j) => (
                                <tr key={`interaction-${i}-${j}`}>
                                    <td style={{ padding: '5px' }}>
                                        Type {i} - Type {j}
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                            <div style={{ width: '15px', height: '15px', backgroundColor: typeColors[i] }}></div>
                                            <div style={{ width: '15px', height: '15px', backgroundColor: typeColors[j] }}></div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '5px' }}>
                                        <input
                                            type="range"
                                            min="0.1"
                                            max="2.0"
                                            step="0.1"
                                            value={epsilonMatrix[i][j]}
                                            onChange={(e) => updateInteractionParameter('epsilon', i, j, parseFloat(e.target.value))}
                                            style={{ width: '100%' }}
                                        />
                                        <span>{epsilonMatrix[i][j].toFixed(1)}</span>
                                    </td>
                                    <td style={{ padding: '5px' }}>
                                        <input
                                            type="range"
                                            min="1.0"
                                            max="5.0"
                                            step="0.2"
                                            value={sigmaMatrix[i][j]}
                                            onChange={(e) => updateInteractionParameter('sigma', i, j, parseFloat(e.target.value))}
                                            style={{ width: '100%' }}
                                        />
                                        <span>{sigmaMatrix[i][j].toFixed(1)}</span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MolecularDynamics;
