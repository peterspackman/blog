import React, { useState, useEffect, useRef } from 'react';

// Main Crystal Lattice Component
const CrystalLatticeOptimizer = () => {
    // Refs for canvas and container
    const canvasRef = useRef(null);
    const energyCanvasRef = useRef(null);
    const containerRef = useRef(null);

    // Canvas dimensions
    const [width, setWidth] = useState(600);
    const [height, setHeight] = useState(600);
    const [energyChartHeight, setEnergyChartHeight] = useState(150);

    // Cell parameters
    const [cellVectorA, setCellVectorA] = useState({ x: 10, y: 0 });
    const [cellVectorB, setCellVectorB] = useState({ x: 0, y: 10 });
    const [showPeriodic, setShowPeriodic] = useState(true);
    const [periodicRange, setPeriodicRange] = useState(1); // How many cells to display in each direction

    // Optimization parameters
    const [optimizing, setOptimizing] = useState(false);
    const [optimizationStep, setOptimizationStep] = useState(0);
    const [maxOptimizationSteps, setMaxOptimizationSteps] = useState(1000);
    const [optimizeCell, setOptimizeCell] = useState(true);
    const [energyThreshold, setEnergyThreshold] = useState(1e-4);
    const [energyHistory, setEnergyHistory] = useState([]);

    // Interaction parameters
    const [atomTypes, setAtomTypes] = useState([
        { name: 'Type A', color: 'rgba(255, 100, 0, 0.8)', charge: 1.0, mass: 1.0 },
        { name: 'Type B', color: 'rgba(0, 0, 255, 0.8)', charge: -1.0, mass: 1.0 }
    ]);
    const [epsilonMatrix, setEpsilonMatrix] = useState([[1.0, 0.8], [0.8, 1.0]]);
    const [sigmaMatrix, setSigmaMatrix] = useState([[3.0, 3.0], [3.0, 3.0]]);
    const [epsilonScale, setEpsilonScale] = useState(1.0);
    const [sigmaScale, setSigmaScale] = useState(1.0);
    const [chargeScale, setChargeScale] = useState(1.0);

    // Wolf method parameters
    const [wolfAlpha, setWolfAlpha] = useState(0.2); // Damping parameter
    const [wolfCutoff, setWolfCutoff] = useState(10); // Cutoff radius

    // Atoms data
    const [atoms, setAtoms] = useState([]);
    const [selectedAtom, setSelectedAtom] = useState(null);
    const [nextTypeIndex, setNextTypeIndex] = useState(0);
    const [draggingAtom, setDraggingAtom] = useState(null);
    const [atomRadius, setAtomRadius] = useState(0.8);

    // UI controls
    const [viewScale, setViewScale] = useState(20); // Pixels per angstrom
    const [viewOffsetX, setViewOffsetX] = useState(width / 2);
    const [viewOffsetY, setViewOffsetY] = useState(height / 2);
    const [panningView, setPanningView] = useState(false);
    const [lastPanPosition, setLastPanPosition] = useState(null);
    const [selectedTool, setSelectedTool] = useState('add'); // 'add', 'move', 'delete'

    // Initialize canvas on start
    useEffect(() => {
        updateCanvasSize();
        window.addEventListener('resize', updateCanvasSize);
        return () => window.removeEventListener('resize', updateCanvasSize);
    }, []);

    // Update canvas size based on container
    const updateCanvasSize = () => {
        if (containerRef.current) {
            const containerWidth = containerRef.current.clientWidth;
            setWidth(Math.min(containerWidth, 800));
            setViewOffsetX(Math.min(containerWidth, 800) / 2);
            setViewOffsetY(300);
        }
    };

    // Normalize Canvas for DPI
    useEffect(() => {
        const normalizeCanvas = (canvas, canvasHeight) => {
            if (!canvas) return;

            const ctx = canvas.getContext('2d', { alpha: false });
            canvas.style.width = `${width}px`;
            canvas.style.height = `${canvasHeight}px`;
            canvas.width = width;
            canvas.height = canvasHeight;
        };

        normalizeCanvas(canvasRef.current, height);
        normalizeCanvas(energyCanvasRef.current, energyChartHeight);
    }, [width, height, energyChartHeight]);

    // Utility function to calculate cell determinant (area)
    const calculateCellArea = () => {
        return Math.abs(cellVectorA.x * cellVectorB.y - cellVectorA.y * cellVectorB.x);
    };

    // Convert real-space coordinates to cell-relative coordinates
    const realToCell = (x, y) => {
        const det = calculateCellArea();
        const invDet = 1 / det;

        const u = invDet * (cellVectorB.y * x - cellVectorB.x * y);
        const v = invDet * (-cellVectorA.y * x + cellVectorA.x * y);

        return { u, v };
    };

    // Convert cell-relative coordinates to real-space coordinates
    const cellToReal = (u, v) => {
        const x = cellVectorA.x * u + cellVectorB.x * v;
        const y = cellVectorA.y * u + cellVectorB.y * v;

        return { x, y };
    };

    // Wrap coordinates to stay within the unit cell (0 to 1)
    const wrapToCellCoords = (u, v) => {
        return {
            u: u - Math.floor(u),
            v: v - Math.floor(v)
        };
    };

    // Calculate Lennard-Jones interaction
    const calculateLennardJones = (r, type1, type2) => {
        const eps = epsilonMatrix[type1][type2] * epsilonScale;
        const sig = sigmaMatrix[type1][type2] * sigmaScale;

        if (r < 0.001) return { potential: 1000, force: 1000 };

        const sigR = sig / r;
        const sigR6 = Math.pow(sigR, 6);
        const sigR12 = sigR6 * sigR6;

        const potential = 4 * eps * (sigR12 - sigR6);
        const force = 24 * eps * (sigR6 - 2 * sigR12) / r;

        return { potential, force };
    };

    // Calculate Wolf-method electrostatics for periodic boundary conditions
    const calculateWolfElectrostatics = (r, q1, q2) => {
        if (r < 0.001) return { potential: 1000, force: 1000 };

        // Coulomb constant in compatible units
        const k = 138.935; // (kJ/mol)·Å/e²

        // Wolf-method damping
        const alpha = wolfAlpha;
        const rCut = wolfCutoff;

        // Apply charge scaling
        const scaledQ1 = q1 * chargeScale;
        const scaledQ2 = q2 * chargeScale;

        // Calculate Wolf method terms
        const erfcAlphaR = Math.exp(-alpha * alpha * r * r); // Approximation of erfc(alpha*r)
        const erfcAlphaRCut = Math.exp(-alpha * alpha * rCut * rCut); // Approximation of erfc(alpha*rCut)

        // Wolf-method potential calculation
        const directTerm = erfcAlphaR / r;
        const cutoffTerm = erfcAlphaRCut / rCut;
        const potential = k * scaledQ1 * scaledQ2 * (directTerm - cutoffTerm);

        // Wolf-method force calculation (negative gradient of potential)
        const forceFactor = k * scaledQ1 * scaledQ2;
        const forceTerm1 = erfcAlphaR / (r * r);
        const forceTerm2 = 2 * alpha / Math.sqrt(Math.PI) * Math.exp(-alpha * alpha * r * r) / r;
        const force = -forceFactor * (forceTerm1 + forceTerm2);

        return { potential, force };
    };

    // Calculate total forces and energy for the system
    const calculateForcesAndEnergy = () => {
        // Clone atoms to modify forces
        const newAtoms = atoms.map(atom => ({
            ...atom,
            fx: 0,
            fy: 0
        }));

        let totalEnergy = 0;

        // For each atom in the primary cell
        for (let i = 0; i < newAtoms.length; i++) {
            const atom1 = newAtoms[i];
            const { x: x1, y: y1 } = cellToReal(atom1.u, atom1.v);

            // Loop through all atoms (including self for periodic images)
            for (let j = 0; j < newAtoms.length; j++) {
                if (i === j) continue; // Skip self-interaction within primary cell

                const atom2 = newAtoms[j];
                const { x: x2, y: y2 } = cellToReal(atom2.u, atom2.v);

                // Check all periodic images within cutoff
                for (let ii = -periodicRange; ii <= periodicRange; ii++) {
                    for (let jj = -periodicRange; jj <= periodicRange; jj++) {
                        // Skip primary cell self-interaction
                        if (i === j && ii === 0 && jj === 0) continue;

                        // Calculate periodic image position
                        const imgX = x2 + ii * cellVectorA.x + jj * cellVectorB.x;
                        const imgY = y2 + ii * cellVectorA.y + jj * cellVectorB.y;

                        // Calculate distance
                        const dx = imgX - x1;
                        const dy = imgY - y1;
                        const r = Math.sqrt(dx * dx + dy * dy);

                        if (r < wolfCutoff && r > 0.001) {
                            // Calculate LJ interaction
                            const ljResult = calculateLennardJones(r, atom1.type, atom2.type);

                            // Calculate electrostatic interaction
                            const chargeResult = calculateWolfElectrostatics(
                                r,
                                atomTypes[atom1.type].charge,
                                atomTypes[atom2.type].charge
                            );

                            // Sum up interaction energy (divide by 2 for periodic images to avoid double counting)
                            totalEnergy += (ljResult.potential + chargeResult.potential) / 2;

                            // Calculate force components
                            const totalForce = ljResult.force + chargeResult.force;
                            const forceScaleFactor = 0.5; // Scale down forces for stability
                            const forceMagnitude = Math.min(Math.abs(totalForce * forceScaleFactor), 50);
                            const forceSign = Math.sign(totalForce);
                            const fx = forceMagnitude * forceSign * dx / r;
                            const fy = forceMagnitude * forceSign * dy / r;

                            // Apply forces only to the primary atom
                            newAtoms[i].fx += fx;
                            newAtoms[i].fy += fy;
                        }
                    }
                }
            }
        }

        return { updatedAtoms: newAtoms, totalEnergy };
    };

    // Convert real-space forces to cell-relative forces
    const convertForcesToCell = (atoms) => {
        return atoms.map(atom => {
            // Convert real-space force to cell-relative force
            const det = calculateCellArea();
            const invDet = 1 / det;

            const fu = invDet * (cellVectorB.y * atom.fx - cellVectorB.x * atom.fy);
            const fv = invDet * (-cellVectorA.y * atom.fx + cellVectorA.x * atom.fy);

            return {
                ...atom,
                fu,
                fv
            };
        });
    };

    // Optimization using gradient descent with adaptive step size
    const optimizeStep = () => {
        if (atoms.length === 0) return 0;

        // Get current forces and energy
        const { updatedAtoms, totalEnergy } = calculateForcesAndEnergy();

        // Convert to cell-relative forces
        const atomsWithCellForces = convertForcesToCell(updatedAtoms);

        // Use a simple steepest descent algorithm with adaptive step size
        const stepSize = 0.01;
        const maxDisplacement = 0.05; // Limit max displacement for stability

        // Update positions along the force direction (gradient descent)
        const newAtoms = atomsWithCellForces.map(atom => {
            // Calculate displacement magnitude (limit to max displacement)
            const forceMag = Math.sqrt(atom.fu * atom.fu + atom.fv * atom.fv);
            const displacement = Math.min(forceMag * stepSize, maxDisplacement);

            // Calculate displacement in cell coordinates
            let du = 0, dv = 0;
            if (forceMag > 0.0001) {
                du = atom.fu / forceMag * displacement;
                dv = atom.fv / forceMag * displacement;
            }

            // Update position
            const newU = atom.u + du;
            const newV = atom.v + dv;

            // Apply periodic boundary conditions
            const { u, v } = wrapToCellCoords(newU, newV);

            return {
                ...atom,
                u,
                v
            };
        });

        // Update energy history
        setEnergyHistory(prev => {
            const newHistory = [...prev, { step: prev.length, energy: totalEnergy }];
            if (newHistory.length > 200) return newHistory.slice(-200);
            return newHistory;
        });

        setAtoms(newAtoms);
        return totalEnergy;
    };

    // Optimize cell vectors
    const optimizeCellVectors = () => {
        if (!optimizeCell || atoms.length < 2) return;

        // Current cell vectors
        const cellA = { ...cellVectorA };
        const cellB = { ...cellVectorB };

        // Calculate stress tensor components
        let stress_xx = 0, stress_xy = 0, stress_yy = 0;

        // Virial contribution to stress
        for (let i = 0; i < atoms.length; i++) {
            const atom1 = atoms[i];
            const { x: x1, y: y1 } = cellToReal(atom1.u, atom1.v);

            for (let j = 0; j < atoms.length; j++) {
                if (i === j) continue;

                const atom2 = atoms[j];
                const { x: x2, y: y2 } = cellToReal(atom2.u, atom2.v);

                // Check all periodic images within cutoff
                for (let ii = -periodicRange; ii <= periodicRange; ii++) {
                    for (let jj = -periodicRange; jj <= periodicRange; jj++) {
                        if (i === j && ii === 0 && jj === 0) continue;

                        // Calculate periodic image position
                        const imgX = x2 + ii * cellVectorA.x + jj * cellVectorB.x;
                        const imgY = y2 + ii * cellVectorA.y + jj * cellVectorB.y;

                        // Calculate distance
                        const dx = imgX - x1;
                        const dy = imgY - y1;
                        const r = Math.sqrt(dx * dx + dy * dy);

                        if (r < wolfCutoff && r > 0.001) {
                            // Calculate LJ interaction
                            const ljResult = calculateLennardJones(r, atom1.type, atom2.type);

                            // Calculate electrostatic interaction
                            const chargeResult = calculateWolfElectrostatics(
                                r,
                                atomTypes[atom1.type].charge,
                                atomTypes[atom2.type].charge
                            );

                            // Sum forces
                            const totalForce = ljResult.force + chargeResult.force;

                            // Virial contribution (f_ij⊗r_ij)
                            stress_xx += dx * dx * totalForce / r;
                            stress_xy += dx * dy * totalForce / r;
                            stress_yy += dy * dy * totalForce / r;
                        }
                    }
                }
            }
        }

        // Scale stress by cell area
        const area = calculateCellArea();
        const areaScale = 1 / area;
        stress_xx *= areaScale;
        stress_xy *= areaScale;
        stress_yy *= areaScale;

        // Apply small adjustment to cell vectors based on stress
        const cellStepSize = 0.005;

        // Update cell vectors to reduce stress
        const newCellA = {
            x: cellA.x - cellStepSize * stress_xx * cellA.x - cellStepSize * stress_xy * cellA.y,
            y: cellA.y - cellStepSize * stress_xy * cellA.x - cellStepSize * stress_yy * cellA.y
        };

        const newCellB = {
            x: cellB.x - cellStepSize * stress_xx * cellB.x - cellStepSize * stress_xy * cellB.y,
            y: cellB.y - cellStepSize * stress_xy * cellB.x - cellStepSize * stress_yy * cellB.y
        };

        // Ensure cell vectors don't get too small or too large
        const minLength = 3.0;
        const maxLength = 20.0;
        const lenA = Math.sqrt(newCellA.x * newCellA.x + newCellA.y * newCellA.y);
        const lenB = Math.sqrt(newCellB.x * newCellB.x + newCellB.y * newCellB.y);

        if (lenA < minLength || lenB < minLength || lenA > maxLength || lenB > maxLength) {
            return; // Skip update if outside bounds
        }

        // Update cell vectors
        setCellVectorA(newCellA);
        setCellVectorB(newCellB);
    };

    // Run the complete optimization process
    const runOptimization = async () => {
        if (atoms.length === 0) return;

        setOptimizing(true);
        setOptimizationStep(0);
        setEnergyHistory([]);

        let step = 0;
        let prevEnergy = Infinity;
        let converged = false;

        while (step < maxOptimizationSteps && !converged) {
            // Optimize atom positions
            const energy = optimizeStep();

            // Every few steps, optimize cell vectors if enabled
            if (step % 5 === 0 && optimizeCell) {
                optimizeCellVectors();
            }

            // Check convergence
            if (Math.abs(energy - prevEnergy) < energyThreshold) {
                converged = true;
            }

            prevEnergy = energy;
            step++;

            setOptimizationStep(step);

            // Allow UI to update between steps
            await new Promise(resolve => setTimeout(resolve, 0));

            // If user cancelled optimization
            if (!optimizing) break;
        }

        setOptimizing(false);
    };

    // Draw the lattice on canvas
    const drawLattice = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);

        // Draw background
        ctx.fillStyle = "#f8f8f8";
        ctx.fillRect(0, 0, width, height);

        // Draw the unit cell and periodic images
        drawCells(ctx);

        // Draw atoms
        drawAtoms(ctx);
    };

    // Draw unit cell and periodic images
    const drawCells = (ctx) => {
        // Draw the periodic images first (more transparent)
        if (showPeriodic) {
            for (let i = -periodicRange; i <= periodicRange; i++) {
                for (let j = -periodicRange; j <= periodicRange; j++) {
                    if (i === 0 && j === 0) continue; // Skip primary cell

                    const offsetX = i * cellVectorA.x + j * cellVectorB.x;
                    const offsetY = i * cellVectorA.y + j * cellVectorB.y;

                    // Draw cell with transparency
                    ctx.strokeStyle = 'rgba(180, 180, 180, 0.5)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();

                    // Cell vertices
                    const x0 = viewOffsetX;
                    const y0 = viewOffsetY;

                    // Draw cell outline
                    ctx.moveTo(
                        x0 + offsetX * viewScale,
                        y0 + offsetY * viewScale
                    );
                    ctx.lineTo(
                        x0 + (offsetX + cellVectorA.x) * viewScale,
                        y0 + (offsetY + cellVectorA.y) * viewScale
                    );
                    ctx.lineTo(
                        x0 + (offsetX + cellVectorA.x + cellVectorB.x) * viewScale,
                        y0 + (offsetY + cellVectorA.y + cellVectorB.y) * viewScale
                    );
                    ctx.lineTo(
                        x0 + (offsetX + cellVectorB.x) * viewScale,
                        y0 + (offsetY + cellVectorB.y) * viewScale
                    );
                    ctx.closePath();
                    ctx.stroke();
                }
            }
        }

        // Draw the primary unit cell (solid)
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();

        // Cell vertices in screen coordinates
        const x0 = viewOffsetX;
        const y0 = viewOffsetY;

        // Draw cell outline
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + cellVectorA.x * viewScale, y0 + cellVectorA.y * viewScale);
        ctx.lineTo(
            x0 + (cellVectorA.x + cellVectorB.x) * viewScale,
            y0 + (cellVectorA.y + cellVectorB.y) * viewScale
        );
        ctx.lineTo(x0 + cellVectorB.x * viewScale, y0 + cellVectorB.y * viewScale);
        ctx.closePath();
        ctx.stroke();

        // Label the cell vectors
        ctx.fillStyle = '#000000';
        ctx.font = '14px Arial';

        // Label for a vector
        const aLabelX = x0 + cellVectorA.x * viewScale / 2;
        const aLabelY = y0 + cellVectorA.y * viewScale / 2;
        ctx.fillText('a', aLabelX, aLabelY - 5);

        // Label for b vector
        const bLabelX = x0 + cellVectorB.x * viewScale / 2;
        const bLabelY = y0 + cellVectorB.y * viewScale / 2;
        ctx.fillText('b', bLabelX - 10, bLabelY);

        // Draw small arrows for the cell vectors
        const drawArrow = (fromX, fromY, toX, toY, color) => {
            const headLength = 10;
            const angle = Math.atan2(toY - fromY, toX - fromX);

            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            ctx.lineTo(toX, toY);
            ctx.stroke();

            // Draw arrowhead
            ctx.beginPath();
            ctx.moveTo(toX, toY);
            ctx.lineTo(
                toX - headLength * Math.cos(angle - Math.PI / 6),
                toY - headLength * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
                toX - headLength * Math.cos(angle + Math.PI / 6),
                toY - headLength * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
        };

        drawArrow(
            x0, y0,
            x0 + cellVectorA.x * viewScale,
            y0 + cellVectorA.y * viewScale,
            '#ff0000'
        );

        drawArrow(
            x0, y0,
            x0 + cellVectorB.x * viewScale,
            y0 + cellVectorB.y * viewScale,
            '#0000ff'
        );
    };

    // Draw atoms in the lattice
    const drawAtoms = (ctx) => {
        // Draw periodic images first (more transparent)
        if (showPeriodic) {
            for (let i = -periodicRange; i <= periodicRange; i++) {
                for (let j = -periodicRange; j <= periodicRange; j++) {
                    if (i === 0 && j === 0) continue; // Skip primary cell

                    const offsetX = i * cellVectorA.x + j * cellVectorB.x;
                    const offsetY = i * cellVectorA.y + j * cellVectorB.y;

                    // Draw each atom in this periodic image
                    for (const atom of atoms) {
                        const realPos = cellToReal(atom.u, atom.v);

                        const screenX = viewOffsetX + (realPos.x + offsetX) * viewScale;
                        const screenY = viewOffsetY + (realPos.y + offsetY) * viewScale;

                        // Draw atom with transparency
                        const atomColor = atomTypes[atom.type].color;
                        const transparentColor = atomColor.replace('0.8', '0.3');

                        ctx.beginPath();
                        ctx.arc(screenX, screenY, atomRadius * viewScale, 0, 2 * Math.PI);
                        ctx.fillStyle = transparentColor;
                        ctx.fill();
                    }
                }
            }
        }

        // Draw atoms in the primary cell
        for (const atom of atoms) {
            const realPos = cellToReal(atom.u, atom.v);

            const screenX = viewOffsetX + realPos.x * viewScale;
            const screenY = viewOffsetY + realPos.y * viewScale;

            // Draw atom
            ctx.beginPath();
            ctx.arc(screenX, screenY, atomRadius * viewScale, 0, 2 * Math.PI);

            // Fill with atom type color
            ctx.fillStyle = atomTypes[atom.type].color;
            ctx.fill();

            // Draw outline, thicker if selected
            ctx.lineWidth = atom === selectedAtom ? 3 : 1;
            ctx.strokeStyle = atom === selectedAtom ? '#ff0000' : '#000000';
            ctx.stroke();

            // Show atom charge as text
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const charge = atomTypes[atom.type].charge > 0
                ? '+' + atomTypes[atom.type].charge
                : atomTypes[atom.type].charge;

            ctx.fillText(charge, screenX, screenY);
        }

        // Draw energy value on canvas
        if (energyHistory.length > 0) {
            const lastEnergy = energyHistory[energyHistory.length - 1].energy;

            ctx.fillStyle = '#000000';
            ctx.font = '14px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';

            ctx.fillText(`Energy: ${lastEnergy.toFixed(4)} kJ/mol`, 10, 10);

            if (optimizing) {
                ctx.fillText(`Step: ${optimizationStep}`, 10, 30);
            }
        }
    };

    // Draw energy plot on canvas
    const drawEnergyPlot = () => {
        const canvas = energyCanvasRef.current;
        if (!canvas || energyHistory.length < 2) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, energyChartHeight);

        // Draw background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, energyChartHeight);

        // Draw axes
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, 10);
        ctx.lineTo(40, energyChartHeight - 20);
        ctx.lineTo(width - 10, energyChartHeight - 20);
        ctx.stroke();

        // Find min and max values
        const energies = energyHistory.map(point => point.energy);
        let minEnergy = Math.min(...energies);
        let maxEnergy = Math.max(...energies);

        // Add some padding
        const range = maxEnergy - minEnergy;
        minEnergy -= range * 0.1;
        maxEnergy += range * 0.1;

        // Ensure we have a non-zero range
        if (Math.abs(maxEnergy - minEnergy) < 0.001) {
            minEnergy -= 0.5;
            maxEnergy += 0.5;
        }

        // Calculate scales
        const xScale = (width - 50) / Math.max(1, energyHistory.length - 1);
        const yScale = (energyChartHeight - 30) / (maxEnergy - minEnergy);

        // Draw labels
        ctx.fillStyle = '#000000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        // Y-axis labels
        ctx.fillText(maxEnergy.toFixed(2), 35, 10);
        ctx.fillText(minEnergy.toFixed(2), 35, energyChartHeight - 20);

        // X-axis label
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Optimization Step', width / 2, energyChartHeight - 15);

        // Plot energy curve
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.beginPath();

        for (let i = 0; i < energyHistory.length; i++) {
            const x = 40 + i * xScale;
            const y = energyChartHeight - 20 - (energyHistory[i].energy - minEnergy) * yScale;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();
    };

    // Handle mouse click to add atoms
    const handleCanvasClick = (e) => {
        if (optimizing) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;

        // Get click position in canvas coordinates
        const canvasX = (e.clientX - rect.left) * scaleX;
        const canvasY = (e.clientY - rect.top) * scaleY;

        // Convert to simulation coordinates
        const simX = (canvasX - viewOffsetX) / viewScale;
        const simY = (canvasY - viewOffsetY) / viewScale;

        // For add mode, add a new atom at the click position
        if (selectedTool === 'add') {
            // Convert real space coordinates to cell-relative coordinates
            const { u, v } = realToCell(simX, simY);

            // Wrap to unit cell
            const { u: wrappedU, v: wrappedV } = wrapToCellCoords(u, v);

            // Add new atom to the list
            const newAtom = {
                id: Date.now(), // Unique ID
                type: nextTypeIndex,
                u: wrappedU,
                v: wrappedV
            };

            setAtoms([...atoms, newAtom]);

            // Cycle through atom types
            setNextTypeIndex((nextTypeIndex + 1) % atomTypes.length);
        }

        // For select/move mode, select the clicked atom
        else if (selectedTool === 'move') {
            let closestAtom = null;
            let minDistance = atomRadius * viewScale * 2; // Selection radius

            // Find the closest atom to the click position
            for (const atom of atoms) {
                // Convert cell-relative to real-space coordinates
                const { x, y } = cellToReal(atom.u, atom.v);

                // Calculate distance to click
                const dx = x - simX;
                const dy = y - simY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < minDistance) {
                    minDistance = distance;
                    closestAtom = atom;
                }
            }

            setSelectedAtom(closestAtom);
            if (closestAtom) {
                setDraggingAtom(closestAtom.id);
            }
        }

        // For delete mode, remove the closest atom
        else if (selectedTool === 'delete') {
            let closestIndex = -1;
            let minDistance = atomRadius * viewScale * 2; // Selection radius

            // Find the closest atom to the click position
            for (let i = 0; i < atoms.length; i++) {
                const atom = atoms[i];

                // Convert cell-relative to real-space coordinates
                const { x, y } = cellToReal(atom.u, atom.v);

                // Calculate distance to click
                const dx = x - simX;
                const dy = y - simY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < minDistance) {
                    minDistance = distance;
                    closestIndex = i;
                }
            }

            if (closestIndex >= 0) {
                const newAtoms = [...atoms];
                newAtoms.splice(closestIndex, 1);
                setAtoms(newAtoms);
                setSelectedAtom(null);
            }
        }
    };

    // Handle mouse down for panning the view
    const handleMouseDown = (e) => {
        if (e.button === 1 || (e.button === 0 && e.altKey)) { // Middle button or Alt+Left button
            setPanningView(true);
            setLastPanPosition({ x: e.clientX, y: e.clientY });
            e.preventDefault();
        } else {
            handleCanvasClick(e);
        }
    };

    // Handle mouse move for panning and dragging atoms
    const handleMouseMove = (e) => {
        if (!canvasRef.current) return;

        // Handle panning the view
        if (panningView && lastPanPosition) {
            const dx = e.clientX - lastPanPosition.x;
            const dy = e.clientY - lastPanPosition.y;

            setViewOffsetX(prev => prev + dx);
            setViewOffsetY(prev => prev + dy);
            setLastPanPosition({ x: e.clientX, y: e.clientY });
            return;
        }

        // Handle dragging atoms
        if (draggingAtom !== null) {
            const rect = canvasRef.current.getBoundingClientRect();
            const scaleX = canvasRef.current.width / rect.width;
            const scaleY = canvasRef.current.height / rect.height;

            // Convert mouse coordinates to simulation coordinates
            const canvasX = (e.clientX - rect.left) * scaleX;
            const canvasY = (e.clientY - rect.top) * scaleY;
            const simX = (canvasX - viewOffsetX) / viewScale;
            const simY = (canvasY - viewOffsetY) / viewScale;

            // Convert to cell-relative coordinates
            const { u, v } = realToCell(simX, simY);

            // Update atom position
            const newAtoms = atoms.map(atom => {
                if (atom.id === draggingAtom) {
                    // Wrap to unit cell
                    const { u: wrappedU, v: wrappedV } = wrapToCellCoords(u, v);
                    return { ...atom, u: wrappedU, v: wrappedV };
                }
                return atom;
            });

            setAtoms(newAtoms);
        }
    };

    // Handle mouse up to end dragging
    const handleMouseUp = () => {
        setPanningView(false);
        setDraggingAtom(null);
    };

    // Handle mouse wheel to zoom
    const handleWheel = (e) => {
        e.preventDefault();

        // Get the mouse position relative to canvas
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate the position in simulation space before zoom
        const simX = (mouseX - viewOffsetX) / viewScale;
        const simY = (mouseY - viewOffsetY) / viewScale;

        // Update scale factor
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(5, Math.min(50, viewScale * zoomFactor));

        // Update the offset to zoom centered on mouse position
        const newOffsetX = mouseX - simX * newScale;
        const newOffsetY = mouseY - simY * newScale;

        setViewScale(newScale);
        setViewOffsetX(newOffsetX);
        setViewOffsetY(newOffsetY);
    };

    // Update interaction parameter (epsilon, sigma) for a pair of atom types
    const updateInteractionParameter = (paramType, type1, type2, value) => {
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

    // Add a preset crystal structure
    const addPresetStructure = (preset) => {
        // Clear existing atoms
        setAtoms([]);

        switch (preset) {
            case 'square':
                // Setup a square lattice
                setCellVectorA({ x: 5, y: 0 });
                setCellVectorB({ x: 0, y: 5 });

                // Add atoms at specific positions
                setAtoms([
                    { id: 1, type: 0, u: 0.0, v: 0.0 },
                    { id: 2, type: 1, u: 0.5, v: 0.5 }
                ]);
                break;

            case 'hexagonal':
                // Setup a hexagonal lattice
                setCellVectorA({ x: 5, y: 0 });
                setCellVectorB({ x: 2.5, y: 4.33 }); // 60° angle

                // Add atoms at specific positions
                setAtoms([
                    { id: 1, type: 0, u: 0.0, v: 0.0 },
                    { id: 2, type: 1, u: 1 / 3, v: 1 / 3 },
                    { id: 3, type: 1, u: 2 / 3, v: 2 / 3 }
                ]);
                break;

            case 'rocksalt':
                // Setup a 2D rocksalt structure
                setCellVectorA({ x: 5, y: 0 });
                setCellVectorB({ x: 0, y: 5 });

                // Add atoms in alternating positions
                setAtoms([
                    { id: 1, type: 0, u: 0.0, v: 0.0 },
                    { id: 2, type: 1, u: 0.5, v: 0.0 },
                    { id: 3, type: 1, u: 0.0, v: 0.5 },
                    { id: 4, type: 0, u: 0.5, v: 0.5 }
                ]);
                break;

            case 'random':
                // Setup random lattice with 8 atoms
                const numRandomAtoms = 8;
                const newAtoms = [];

                for (let i = 0; i < numRandomAtoms; i++) {
                    newAtoms.push({
                        id: i + 1,
                        type: i % 2, // Alternate types
                        u: Math.random(),
                        v: Math.random()
                    });
                }

                setAtoms(newAtoms);
                break;
        }
    };

    // Update atom type properties (charge, color)
    const updateAtomType = (typeIndex, property, value) => {
        const newTypes = [...atomTypes];
        newTypes[typeIndex] = { ...newTypes[typeIndex], [property]: value };
        setAtomTypes(newTypes);
    };

    // Reset the view to center the unit cell
    const resetView = () => {
        setViewScale(20);
        setViewOffsetX(width / 2);
        setViewOffsetY(height / 2);
    };

    // Draw the lattice and energy chart on canvas
    useEffect(() => {
        drawLattice();
        drawEnergyPlot();
    }, [
        atoms,
        selectedAtom,
        cellVectorA,
        cellVectorB,
        viewScale,
        viewOffsetX,
        viewOffsetY,
        showPeriodic,
        periodicRange,
        atomTypes,
        energyHistory,
        optimizationStep,
        optimizing
    ]);

    // Render the component
    return (
        <div ref={containerRef} style={{ width: '100%', fontFamily: 'Arial, sans-serif' }}>
            <h2 style={{ textAlign: 'center' }}>2D Crystal Lattice Optimizer</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Main canvas for the crystal lattice */}
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    style={{ border: '1px solid #ccc', cursor: 'crosshair' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                />

                {/* Energy plot canvas */}
                <canvas
                    ref={energyCanvasRef}
                    width={width}
                    height={energyChartHeight}
                    style={{ border: '1px solid #ccc' }}
                />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginTop: '20px' }}>
                {/* Left column: Tools and cell controls */}
                <div style={{ flex: '1', minWidth: '300px' }}>
                    <div style={{
                        padding: '10px',
                        border: '1px solid #ccc',
                        borderRadius: '5px',
                        marginBottom: '10px'
                    }}>
                        <h3 style={{ margin: '0 0 10px 0' }}>Tools</h3>

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                            <button
                                style={{
                                    padding: '8px 12px',
                                    backgroundColor: selectedTool === 'add' ? '#4CAF50' : '#f0f0f0',
                                    color: selectedTool === 'add' ? 'white' : 'black',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setSelectedTool('add')}
                            >
                                Add Atom
                            </button>

                            <button
                                style={{
                                    padding: '8px 12px',
                                    backgroundColor: selectedTool === 'move' ? '#2196F3' : '#f0f0f0',
                                    color: selectedTool === 'move' ? 'white' : 'black',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setSelectedTool('move')}
                            >
                                Move Atom
                            </button>

                            <button
                                style={{
                                    padding: '8px 12px',
                                    backgroundColor: selectedTool === 'delete' ? '#f44336' : '#f0f0f0',
                                    color: selectedTool === 'delete' ? 'white' : 'black',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setSelectedTool('delete')}
                            >
                                Delete Atom
                            </button>
                        </div>

                        <div style={{ marginBottom: '10px' }}>
                            <button
                                style={{
                                    padding: '8px 12px',
                                    backgroundColor: '#f0f0f0',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    marginRight: '10px'
                                }}
                                onClick={resetView}
                            >
                                Reset View
                            </button>

                            <button
                                style={{
                                    padding: '8px 12px',
                                    backgroundColor: '#f0f0f0',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setAtoms([])}
                            >
                                Clear All Atoms
                            </button>
                        </div>

                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                                <input
                                    type="checkbox"
                                    checked={showPeriodic}
                                    onChange={(e) => setShowPeriodic(e.target.checked)}
                                    style={{ marginRight: '5px' }}
                                />
                                Show Periodic Images
                            </label>

                            {showPeriodic && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <label>Range:</label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="3"
                                        step="1"
                                        value={periodicRange}
                                        onChange={(e) => setPeriodicRange(parseInt(e.target.value))}
                                        style={{ flex: 1 }}
                                    />
                                    <span>{periodicRange}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{
                        padding: '10px',
                        border: '1px solid #ccc',
                        borderRadius: '5px',
                        marginBottom: '10px'
                    }}>
                        <h3 style={{ margin: '0 0 10px 0' }}>Unit Cell</h3>

                        <div style={{ marginBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                <label style={{ width: '80px' }}>Vector A:</label>
                                <input
                                    type="number"
                                    value={cellVectorA.x.toFixed(2)}
                                    onChange={(e) => setCellVectorA({ ...cellVectorA, x: parseFloat(e.target.value) })}
                                    style={{ width: '70px' }}
                                />
                                <input
                                    type="number"
                                    value={cellVectorA.y.toFixed(2)}
                                    onChange={(e) => setCellVectorA({ ...cellVectorA, y: parseFloat(e.target.value) })}
                                    style={{ width: '70px' }}
                                />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <label style={{ width: '80px' }}>Vector B:</label>
                                <input
                                    type="number"
                                    value={cellVectorB.x.toFixed(2)}
                                    onChange={(e) => setCellVectorB({ ...cellVectorB, x: parseFloat(e.target.value) })}
                                    style={{ width: '70px' }}
                                />
                                <input
                                    type="number"
                                    value={cellVectorB.y.toFixed(2)}
                                    onChange={(e) => setCellVectorB({ ...cellVectorB, y: parseFloat(e.target.value) })}
                                    style={{ width: '70px' }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Preset Structures:</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                <button
                                    style={{
                                        padding: '5px 10px',
                                        backgroundColor: '#f0f0f0',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => addPresetStructure('square')}
                                >
                                    Square
                                </button>

                                <button
                                    style={{
                                        padding: '5px 10px',
                                        backgroundColor: '#f0f0f0',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => addPresetStructure('hexagonal')}
                                >
                                    Hexagonal
                                </button>

                                <button
                                    style={{
                                        padding: '5px 10px',
                                        backgroundColor: '#f0f0f0',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => addPresetStructure('rocksalt')}
                                >
                                    Rocksalt
                                </button>

                                <button
                                    style={{
                                        padding: '5px 10px',
                                        backgroundColor: '#f0f0f0',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => addPresetStructure('random')}
                                >
                                    Random
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right column: Optimization and interactions */}
                <div style={{ flex: '1', minWidth: '300px' }}>
                    <div style={{
                        padding: '10px',
                        border: '1px solid #ccc',
                        borderRadius: '5px',
                        marginBottom: '10px'
                    }}>
                        <h3 style={{ margin: '0 0 10px 0' }}>Optimization</h3>

                        <div style={{ marginBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                <label style={{ width: '160px' }}>Max Steps:</label>
                                <input
                                    type="number"
                                    min="100"
                                    max="10000"
                                    step="100"
                                    value={maxOptimizationSteps}
                                    onChange={(e) => setMaxOptimizationSteps(parseInt(e.target.value))}
                                    style={{ width: '80px' }}
                                />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                <label style={{ width: '160px' }}>Energy Threshold:</label>
                                <input
                                    type="number"
                                    min="0.0001"
                                    max="0.01"
                                    step="0.0001"
                                    value={energyThreshold}
                                    onChange={(e) => setEnergyThreshold(parseFloat(e.target.value))}
                                    style={{ width: '80px' }}
                                />
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                                <input
                                    type="checkbox"
                                    checked={optimizeCell}
                                    onChange={(e) => setOptimizeCell(e.target.checked)}
                                    style={{ marginRight: '5px' }}
                                />
                                Optimize Cell Vectors
                            </label>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                style={{
                                    padding: '8px 12px',
                                    backgroundColor: optimizing ? '#f44336' : '#4CAF50',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    flex: 1
                                }}
                                onClick={() => {
                                    if (optimizing) {
                                        setOptimizing(false);
                                    } else {
                                        runOptimization();
                                    }
                                }}
                            >
                                {optimizing ? 'Stop Optimization' : 'Start Optimization'}
                            </button>

                            <button
                                style={{
                                    padding: '8px 12px',
                                    backgroundColor: '#2196F3',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                                onClick={() => {
                                    // Run a single optimization step
                                    optimizeStep();
                                    if (optimizeCell && optimizationStep % 5 === 0) {
                                        optimizeCellVectors();
                                    }
                                    setOptimizationStep(prev => prev + 1);
                                }}
                                disabled={optimizing}
                            >
                                Single Step
                            </button>
                        </div>

                        {optimizing && (
                            <div style={{ marginTop: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                                    <span style={{ marginRight: '10px' }}>Step: {optimizationStep}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{
                        padding: '10px',
                        border: '1px solid #ccc',
                        borderRadius: '5px'
                    }}>
                        <h3 style={{ margin: '0 0 10px 0' }}>Interaction Parameters</h3>

                        <div style={{ marginBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                <label style={{ width: '160px' }}>Epsilon Scale (LJ):</label>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="2"
                                    step="0.1"
                                    value={epsilonScale}
                                    onChange={(e) => setEpsilonScale(parseFloat(e.target.value))}
                                    style={{ flex: 1 }}
                                />
                                <span>{epsilonScale.toFixed(1)}</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                <label style={{ width: '160px' }}>Sigma Scale (LJ):</label>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="2"
                                    step="0.1"
                                    value={sigmaScale}
                                    onChange={(e) => setSigmaScale(parseFloat(e.target.value))}
                                    style={{ flex: 1 }}
                                />
                                <span>{sigmaScale.toFixed(1)}</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                <label style={{ width: '160px' }}>Charge Scale:</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="5"
                                    step="0.1"
                                    value={chargeScale}
                                    onChange={(e) => setChargeScale(parseFloat(e.target.value))}
                                    style={{ flex: 1 }}
                                />
                                <span>{chargeScale.toFixed(1)}</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                <label style={{ width: '160px' }}>Wolf Alpha:</label>
                                <input
                                    type="range"
                                    min="0.05"
                                    max="0.5"
                                    step="0.05"
                                    value={wolfAlpha}
                                    onChange={(e) => setWolfAlpha(parseFloat(e.target.value))}
                                    style={{ flex: 1 }}
                                />
                                <span>{wolfAlpha.toFixed(2)}</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <label style={{ width: '160px' }}>Wolf Cutoff:</label>
                                <input
                                    type="range"
                                    min="5"
                                    max="20"
                                    step="1"
                                    value={wolfCutoff}
                                    onChange={(e) => setWolfCutoff(parseFloat(e.target.value))}
                                    style={{ flex: 1 }}
                                />
                                <span>{wolfCutoff.toFixed(1)}</span>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>)
};

export default CrystalLatticeOptimizer;
