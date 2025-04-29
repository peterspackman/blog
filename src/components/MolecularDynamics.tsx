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
    const [temperature, setTemperature] = useState(0.3);  // Lower default temperature
    const [numParticles, setNumParticles] = useState(100);
    const [particleRadius, setParticleRadius] = useState(0.5 * Math.pow(2, 1.0 / 6.0) * 20);
    const [timeStep, setTimeStep] = useState(0.015);
    const [running, setRunning] = useState(false);
    const [particles, setParticles] = useState([]);
    const [draggingParticle, setDraggingParticle] = useState(null);
    const [stepsPerFrame, setStepsPerFrame] = useState(30);  // Now adjustable

    // Potential parameters
    const [epsilon, setEpsilon] = useState(1.0);
    const [sigma, setSigma] = useState(20.0);
    const [charge, setCharge] = useState(1.0);
    const [blueCount, setBlueCount] = useState(0);

    // Potentials and forces
    const calculateLennardJones = (r, eps = 1.0, sig = 1.0) => {
        if (r < 0.01) return { potential: 1000, force: 1000 }; // Avoid division by zero
        const term = Math.pow(sig / r, 6);
        const potential = 4 * eps * (Math.pow(term, 2) - term);
        const force = 24 * eps * (term - 2 * Math.pow(term, 2)) / r;
        return { potential, force };
    };

    const calculateCoulomb = (r) => {
        if (r < 0.01) return { potential: 1000, force: 1000 }; // Avoid division by zero
        const potential = - 1.0 / r;
        const force = 1.0 / (r * r);
        return { potential, force };
    };


    // Initialize particles
    useEffect(() => {
        initializeParticles();
    }, [numParticles]);


    const initializeParticles = () => {
        const newParticles = [];

        // Calculate appropriate grid size based on available space and particle size
        const effectiveWidth = width - particleRadius * 4; // Leave margin on sides
        const effectiveHeight = height - particleRadius * 4; // Leave margin on top/bottom

        // Determine grid dimensions based on aspect ratio
        const aspectRatio = effectiveWidth / effectiveHeight;
        let gridCols = Math.ceil(Math.sqrt(numParticles * aspectRatio));
        let gridRows = Math.ceil(numParticles / gridCols);

        // Calculate spacing between particle centers
        const spacingX = effectiveWidth / Math.max(gridCols - 1, 1);
        const spacingY = effectiveHeight / Math.max(gridRows - 1, 1);

        // Minimum spacing should account for particle size
        const minSpacing = particleRadius * 2.5; // Ensure particles don't overlap too much

        let btot = 0;
        // Adjust grid if spacing is too small
        if (spacingX < minSpacing || spacingY < minSpacing) {
            // Recalculate grid with minimum spacing
            gridCols = Math.floor(effectiveWidth / minSpacing);
            gridRows = Math.ceil(numParticles / gridCols);

            // Adjust spacing for the new grid
            const adjustedSpacingX = effectiveWidth / Math.max(gridCols - 1, 1);
            const adjustedSpacingY = effectiveHeight / Math.max(gridRows - 1, 1);

            // Use the adjusted spacing values
            for (let i = 0; i < numParticles; i++) {
                const row = Math.floor(i / gridCols);
                const col = i % gridCols;

                // Assign random velocities (Maxwell-Boltzmann)
                const angle = Math.random() * 2 * Math.PI;
                const speed = Math.sqrt(-2 * Math.log(Math.random())) * Math.sqrt(temperature);
                const blue = Math.random() < 0.5;
                if (blue) btot++;

                newParticles.push({
                    x: particleRadius * 2 + col * adjustedSpacingX + (Math.random() - 0.5) * (adjustedSpacingX * 0.5),
                    y: particleRadius * 2 + row * adjustedSpacingY + (Math.random() - 0.5) * (adjustedSpacingY * 0.5),
                    vx: speed * Math.cos(angle),
                    vy: speed * Math.sin(angle),
                    ax: 0,
                    ay: 0,
                    ax_old: 0,
                    ay_old: 0,
                    mass: 1.0,
                    type: blue,
                    id: i
                });
            }
        } else {
            // Use the normal spacing
            for (let i = 0; i < numParticles; i++) {
                const row = Math.floor(i / gridCols);
                const col = i % gridCols;

                // Assign random velocities (Maxwell-Boltzmann)
                const angle = Math.random() * 2 * Math.PI;
                const speed = Math.sqrt(-2 * Math.log(Math.random())) * Math.sqrt(temperature);

                const blue = Math.random() < 0.5;
                if (blue) btot++;

                newParticles.push({
                    x: particleRadius * 2 + col * spacingX + (Math.random() - 0.5) * (spacingX * 0.5),
                    y: particleRadius * 2 + row * spacingY + (Math.random() - 0.5) * (spacingY * 0.5),
                    vx: speed * Math.cos(angle),
                    vy: speed * Math.sin(angle),
                    ax: 0,
                    ay: 0,
                    ax_old: 0,
                    ay_old: 0,
                    mass: 1.0,
                    type: blue,
                    id: i
                });
            }
        }

        setBlueCount(btot);
        setParticles(newParticles);
    };

    // Calculate forces between particles
    const calculateForces = () => {
        // Reset accelerations
        for (let i = 0; i < particles.length; i++) {
            particles[i].ax = 0;
            particles[i].ay = 0;
        }

        // Calculate pairwise forces with spatial optimization
        // Use a smaller cutoff radius to focus on the stronger interactions
        const cutoffRadius = 2.5 * sigma;

        // Stronger force scaling for more visible interactions
        const forceScale = 2.0;

        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                let sgn = (particles[i].type == particles[j].type) ? -1 : 1;
                // Calculate distance
                const dx = particles[j].x - particles[i].x;
                const dy = particles[j].y - particles[i].y;
                const rSquared = dx * dx + dy * dy;


                const r = Math.sqrt(rSquared);
                if (r < 0.1) continue; // Avoid division by zero

                // Apply force based on the selected potential
                let force = charge * charge * sgn * calculateCoulomb(r).force;
                // Skip if beyond cutoff radius to improve performance
                if (r < cutoffRadius) {
                    force += calculateLennardJones(r, epsilon, sigma).force;
                }

                // Scale the force for more visible interactions
                force = forceScale * Math.min(Math.max(force, -15), 15);

                // Project force onto x and y components - division by r only once
                const invR = 1 / r;
                const fx = force * dx * invR;
                const fy = force * dy * invR;

                // Apply Newton's third law
                particles[i].ax += fx / particles[i].mass;
                particles[i].ay += fy / particles[i].mass;
                particles[j].ax -= fx / particles[j].mass;
                particles[j].ay -= fy / particles[j].mass;
            }
        }
    };

    // Integration using Velocity Verlet algorithm (optimized)
    const velocityVerlet = () => {
        // Update positions - use direct array access instead of forEach for speed
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const halfTimeStepSq = 0.5 * timeStep * timeStep;

            p.x += p.vx * timeStep + p.ax * halfTimeStepSq;
            p.y += p.vy * timeStep + p.ay * halfTimeStepSq;

            // Store old accelerations
            p.ax_old = p.ax;
            p.ay_old = p.ay;
        }

        // Calculate new forces
        calculateForces();

        // Update velocities
        const halfTimeStep = 0.5 * timeStep;
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.vx += (p.ax_old + p.ax) * halfTimeStep;
            p.vy += (p.ay_old + p.ay) * halfTimeStep;
        }

        // Apply boundary conditions (reflective) - avoid redundant calculations
        const xMin = particleRadius;
        const xMax = width - particleRadius;
        const yMin = particleRadius;
        const yMax = height - particleRadius;

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];

            if (p.x < xMin) {
                p.x = 2 * xMin - p.x;
                p.vx = -p.vx * 0.95; // Slight damping for stability
            } else if (p.x > xMax) {
                p.x = 2 * xMax - p.x;
                p.vx = -p.vx * 0.95;
            }

            if (p.y < yMin) {
                p.y = 2 * yMin - p.y;
                p.vy = -p.vy * 0.95;
            } else if (p.y > yMax) {
                p.y = 2 * yMax - p.y;
                p.vy = -p.vy * 0.95;
            }
        }

        // Apply temperature control (velocity scaling) - once every 10 steps for speed
        if (Math.random() < 0.1) { // Only apply temperature control occasionally
            controlTemperature();
        }
    };

    // Temperature control using velocity scaling (optimized)
    const controlTemperature = () => {
        let totalKE = 0;
        const particleCount = particles.length;

        // Exit early if empty
        if (particleCount === 0) return;

        // Calculate total kinetic energy - optimize loop
        for (let i = 0; i < particleCount; i++) {
            const p = particles[i];
            totalKE += 0.5 * p.mass * (p.vx * p.vx + p.vy * p.vy);
        }

        // Calculate current temperature (KE per particle)
        const currentTemp = totalKE / particleCount;

        // Scale velocities - do this more frequently with higher steps per frame
        if (currentTemp > 0) {
            const scaleFactor = Math.sqrt(temperature / currentTemp);

            for (let i = 0; i < particleCount; i++) {
                const p = particles[i];
                p.vx *= scaleFactor;
                p.vy *= scaleFactor;
            }
        }
    };

    // Animation loop with performance optimizations
    useEffect(() => {
        let animationFrameId;
        let lastTime = 0;
        let simulationSteps = 0;

        const render = (timestamp) => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d', { alpha: false });
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, width, height);

            // Update simulation if running - run multiple iterations per frame
            if (running) {
                // Run many simulation steps per render to see stronger interactions
                for (let i = 0; i < stepsPerFrame; i++) {
                    velocityVerlet();
                    simulationSteps++;
                }
            }

            // Draw particles with size reflecting their interaction radius
            ctx.strokeStyle = '#000000';
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];

                // Draw the particle
                ctx.beginPath();
                ctx.arc(p.x, p.y, particleRadius, 0, 2 * Math.PI);
                ctx.fillStyle = p.type ? 'rgba(0, 0, 255, 0.8)' : 'rgba(255, 165, 0, 0.8)';
                ctx.fill();
            }

            animationFrameId = window.requestAnimationFrame(render);
        };

        render();

        return () => {
            window.cancelAnimationFrame(animationFrameId);
        };
    }, [particles, running, particleRadius, width, height, timeStep, epsilon, sigma, charge, temperature, stepsPerFrame]);

    // Handle mouse events for dragging particles
    const handleMouseDown = (e) => {
        if (!canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Find the particle that was clicked
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const dx = p.x - mouseX;
            const dy = p.y - mouseY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= particleRadius) {
                setDraggingParticle(i);
                // Pause simulation while dragging
                break;
            }
        }
    };

    const handleMouseMove = (e) => {
        if (draggingParticle === null || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Update the particle position
        const newParticles = [...particles];
        newParticles[draggingParticle].x = mouseX;
        newParticles[draggingParticle].y = mouseY;
        // Reset velocity and acceleration when dragging
        newParticles[draggingParticle].vx = 0;
        newParticles[draggingParticle].vy = 0;
        newParticles[draggingParticle].ax = 0;
        newParticles[draggingParticle].ay = 0;

        setParticles(newParticles);
    };

    const handleMouseUp = () => {
        setDraggingParticle(null);
    };

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


                <div className={styles.controlsRow}>

                    <label className={styles.rangeLabel}>Epsilon (ε): {epsilon.toFixed(2)}</label>
                    <input
                        type="range"
                        min="0.1"
                        max="2"
                        step="0.1"
                        value={epsilon}
                        onChange={(e) => setEpsilon(parseFloat(e.target.value))}
                        className={styles.rangeInput}
                    />
                </div>
                <div className={styles.controlsRow}>

                    <label className={styles.rangeLabel}>Sigma (σ): {sigma.toFixed(2)}</label>
                    <input
                        type="range"
                        min="2"
                        max="40"
                        step="2"
                        value={sigma}
                        onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            setSigma(v);
                            setParticleRadius(0.5 * Math.pow(2, 1.0 / 6.0) * v);
                        }}
                        className={styles.rangeInput}
                    />
                </div>
                <div className={styles.controlsRow}>

                    <label className={styles.rangeLabel}>Charge (q): {charge.toFixed(2)}</label>
                    <input
                        type="range"
                        min="0.0"
                        max="10"
                        step="0.2"
                        value={charge}
                        onChange={(e) => {
                            setCharge(parseFloat(e.target.value));
                        }}
                        className={styles.rangeInput}
                    />
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
                <h3 className={styles.explanationTitle}>Instructions</h3>
                <p className={styles.explanationText}>
                    {blueCount} blue, {numParticles - blueCount} orange particles
                    <ul>
                        <li>Click and drag particles to move them manually</li>
                        <li>Adjust temperature to control (average) particle velocities</li>
                        <li>Modify potential parameters to see different behaviors</li>
                        <li>Use the Reset button to generate a new configuration</li>
                    </ul>
                </p>
            </div>
        </div>
    );
};

export default MolecularDynamics;
