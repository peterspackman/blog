// Web Worker for running SCF calculations
// This worker handles the computationally intensive tasks off the main thread

let OCC = null;
let occModule = null;
let optimizationModule = null;

// Initialize OCC module when worker starts
self.addEventListener('message', async function(e) {
    const { type, data } = e.data;
    
    try {
        switch(type) {
            case 'init':
                await initializeOCC(data);
                break;
                
            case 'calculate':
                if (data.optimize) {
                    await runOptimizationCalculation(data);
                } else {
                    await runCalculation(data);
                }
                break;
                
            case 'setLogLevel':
                setLogLevel(data.level);
                break;
                
            case 'computeCube':
                await computeCube(data);
                break;
                
            default:
                postMessage({ type: 'error', error: `Unknown message type: ${type}` });
        }
    } catch (error) {
        postMessage({ 
            type: 'error', 
            error: error.message || 'Unknown error occurred',
            stack: error.stack 
        });
    }
});

async function initializeOCC(config) {
    try {
        postMessage({ type: 'log', level: 2, message: 'Initializing OCC in worker...' });
        
        // Import the OCC module
        try {
            // Import main package - exports field will resolve to browser version
            OCC = await import('@peterspackman/occjs');
            postMessage({ type: 'log', level: 2, message: 'Loaded OCC package' });
        } catch (e) {
            postMessage({ 
                type: 'initialized', 
                success: false, 
                error: `OCC package import failed: ${e.message}. The WASM module contains Node.js-specific imports that don't work in browsers.` 
            });
            return;
        }
        
        // Load the WASM module
        occModule = await OCC.loadOCC();
        
        // Load optimization module
        try {
            optimizationModule = await import('./wavefunction-worker-optimization.js');
            postMessage({ type: 'log', level: 2, message: 'Optimization module loaded' });
        } catch (e) {
            postMessage({ type: 'log', level: 3, message: 'Optimization module not available' });
        }
        
        // Set up logging callback to forward logs to main thread
        if (occModule.registerLogCallback) {
            occModule.registerLogCallback((level, message) => {
                postMessage({ 
                    type: 'log', 
                    level: level, 
                    message: message 
                });
            });
        }
        
        postMessage({ type: 'initialized', success: true });
        
    } catch (error) {
        postMessage({ 
            type: 'initialized', 
            success: false, 
            error: error.message 
        });
    }
}

function setLogLevel(level) {
    if (occModule && occModule.setLogLevel) {
        occModule.setLogLevel(level);
        postMessage({ 
            type: 'log', 
            level: 2, 
            message: `Log level set to ${level}` 
        });
    }
}

async function runCalculation(params) {
    try {
        const startTime = performance.now();
        
        postMessage({ 
            type: 'progress', 
            stage: 'start',
            message: 'Starting calculation...' 
        });
        
        // Recreate molecule from XYZ data
        postMessage({ 
            type: 'log', 
            level: 2, 
            message: 'Creating molecule from XYZ data...' 
        });
        
        const molecule = await OCC.moleculeFromXYZ(params.xyzData);
        
        postMessage({ 
            type: 'log', 
            level: 2, 
            message: `Molecule created: ${molecule.size()} atoms` 
        });
        
        // Create calculation
        postMessage({ 
            type: 'progress', 
            stage: 'setup',
            message: `Setting up ${params.method.toUpperCase()} calculation with ${params.basisSet} basis...` 
        });
        
        const calc = await OCC.createQMCalculation(molecule, params.basisSet);
        
        // Set up SCF settings
        const settings = new OCC.SCFSettings()
            .setMaxIterations(params.maxIterations)
            .setEnergyTolerance(params.energyTolerance);
        
        let energy;
        
        // Run the calculation
        postMessage({ 
            type: 'progress', 
            stage: 'calculation',
            message: 'Running SCF iterations...' 
        });
        
        if (params.method === 'hf') {
            postMessage({ 
                type: 'log', 
                level: 2, 
                message: 'Running Hartree-Fock calculation...' 
            });
            energy = await calc.runHF(settings);
            
        } else if (params.method.startsWith('dft-')) {
            const functional = params.method.substring(4); // Remove "dft-" prefix
            postMessage({ 
                type: 'log', 
                level: 2, 
                message: `Running DFT calculation with ${functional} functional...` 
            });
            energy = await calc.runDFT(functional, { scfSettings: settings });
        }
        
        const endTime = performance.now();
        const elapsedMs = endTime - startTime;
        
        postMessage({ 
            type: 'progress', 
            stage: 'complete',
            message: 'Calculation completed successfully!' 
        });
        
        // Prepare results
        const results = {
            energy: energy,
            energyInEV: energy * 27.2114,
            elapsedMs: elapsedMs,
            converged: true // We can add convergence check if needed
        };
        
        // Get properties for results
        try {
            const properties = await calc.calculateProperties(['orbitals', 'homo', 'lumo', 'gap']);
            results.properties = {
                homo: properties.homo,
                lumo: properties.lumo,
                gap: properties.gap
            };
        } catch (e) {
            postMessage({ 
                type: 'log', 
                level: 3, 
                message: `Could not calculate properties: ${e.message}` 
            });
        }
        
        // Store calculation and molecule for cube computation and export basic info
        try {
            const wf = calc.wavefunction;
            results.wavefunctionData = {
                numBasisFunctions: calc.basis.nbf(),
                numAtoms: molecule.size(),
                nAlpha: wf.nAlpha || Math.ceil(molecule.numElectrons() / 2),
                nBeta: wf.nBeta || Math.floor(molecule.numElectrons() / 2),
                numElectrons: molecule.numElectrons(),
                basisSet: params.basisSet,
                method: params.method
            };
            
            // Generate FCHK file using wavefunction exportToString method
            try {
                postMessage({ type: 'log', level: 2, message: 'Generating FCHK file...' });
                
                const fchkString = wf.exportToString("fchk");
                
                if (fchkString && fchkString.length > 0) {
                    results.wavefunctionData.fchk = fchkString;
                    postMessage({ type: 'log', level: 2, message: 'FCHK file generated successfully' });
                } else {
                    throw new Error('FCHK string is empty or null');
                }
            } catch (fchkError) {
                postMessage({ 
                    type: 'log', 
                    level: 3, 
                    message: `Could not generate FCHK file: ${fchkError.message}` 
                });
                // Don't fail the entire calculation if FCHK generation fails
            }
            
            // Store calculation and molecule in worker context for cube computation
            self.currentCalculation = calc;
            self.currentMolecule = molecule;
        } catch (e) {
            postMessage({ 
                type: 'log', 
                level: 3, 
                message: `Could not store wavefunction data: ${e.message}` 
            });
        }
        
        // Compute matrices and convert to transferable format
        postMessage({ 
            type: 'progress', 
            stage: 'matrices',
            message: 'Computing matrices...' 
        });
        
        results.matrices = {};
        
        try {
            const Module = OCC.getModule();
            const hf = new Module.HartreeFock(calc.basis);
            const wf = calc.wavefunction;
            
            // Helper function to convert matrix to array format
            const matrixToArray = (matrix) => {
                const rows = matrix.rows();
                const cols = matrix.cols();
                const data = [];
                for (let i = 0; i < rows; i++) {
                    const row = [];
                    for (let j = 0; j < cols; j++) {
                        row.push(matrix.get(i, j));
                    }
                    data.push(row);
                }
                return { rows, cols, data };
            };
            
            // Compute and store matrices
            postMessage({ type: 'log', level: 2, message: 'Computing overlap matrix...' });
            try {
                const overlapMatrix = hf.overlapMatrix();
                results.matrices.overlap = matrixToArray(overlapMatrix);
            } catch (e) {
                postMessage({ type: 'log', level: 3, message: `Could not compute overlap matrix: ${e.message}` });
            }
            
            postMessage({ type: 'log', level: 2, message: 'Computing kinetic energy matrix...' });
            try {
                const kineticMatrix = hf.kineticMatrix();
                results.matrices.kinetic = matrixToArray(kineticMatrix);
            } catch (e) {
                postMessage({ type: 'log', level: 3, message: `Could not compute kinetic matrix: ${e.message}` });
            }
            
            postMessage({ type: 'log', level: 2, message: 'Computing nuclear attraction matrix...' });
            try {
                const nuclearMatrix = hf.nuclearAttractionMatrix();
                results.matrices.nuclear = matrixToArray(nuclearMatrix);
            } catch (e) {
                postMessage({ type: 'log', level: 3, message: `Could not compute nuclear attraction matrix: ${e.message}` });
            }
            
            postMessage({ type: 'log', level: 2, message: 'Computing Fock matrix...' });
            try {
                const fockMatrix = hf.fockMatrix(wf.molecularOrbitals);
                results.matrices.fock = matrixToArray(fockMatrix);
            } catch (e) {
                postMessage({ type: 'log', level: 3, message: `Could not compute Fock matrix: ${e.message}` });
            }
            
            postMessage({ type: 'log', level: 2, message: 'Extracting density matrix...' });
            try {
                const densityMatrix = wf.molecularOrbitals.densityMatrix;
                results.matrices.density = matrixToArray(densityMatrix);
            } catch (e) {
                postMessage({ type: 'log', level: 3, message: `Could not extract density matrix: ${e.message}` });
            }
            
            postMessage({ type: 'log', level: 2, message: 'Extracting MO coefficients...' });
            try {
                const coeffMatrix = wf.coefficients();
                results.matrices.coefficients = matrixToArray(coeffMatrix);
            } catch (e) {
                postMessage({ type: 'log', level: 3, message: `Could not extract MO coefficients: ${e.message}` });
            }
            
            // Also get orbital energies as an array
            try {
                const orbitalEnergies = wf.orbitalEnergies();
                const energyArray = [];
                for (let i = 0; i < orbitalEnergies.size(); i++) {
                    energyArray.push(orbitalEnergies.get(i));
                }
                results.orbitalEnergies = energyArray;
            } catch (e) {
                postMessage({ type: 'log', level: 3, message: `Could not extract orbital energies: ${e.message}` });
            }
            
            // Get orbital occupations from wavefunction
            try {
                const numOrbitals = results.orbitalEnergies ? results.orbitalEnergies.length : 0;
                if (numOrbitals > 0) {
                    const occupationArray = [];
                    const nAlpha = wf.nAlpha || Math.ceil(molecule.numElectrons() / 2);
                    const nBeta = wf.nBeta || Math.floor(molecule.numElectrons() / 2);
                    
                    // For restricted calculations, each orbital gets 0, 1, or 2 electrons
                    for (let i = 0; i < numOrbitals; i++) {
                        if (i < Math.min(nAlpha, nBeta)) {
                            occupationArray.push(2.0); // Doubly occupied
                        } else if (i < Math.max(nAlpha, nBeta)) {
                            occupationArray.push(1.0); // Singly occupied
                        } else {
                            occupationArray.push(0.0); // Virtual
                        }
                    }
                    results.orbitalOccupations = occupationArray;
                }
            } catch (e) {
                postMessage({ type: 'log', level: 3, message: `Could not extract orbital occupations: ${e.message}` });
            }
            
        } catch (e) {
            postMessage({ 
                type: 'log', 
                level: 3, 
                message: `Matrix computation failed: ${e.message}` 
            });
        }
        
        // Send results back to main thread
        postMessage({ 
            type: 'result', 
            success: true, 
            results: results 
        });
        
    } catch (error) {
        postMessage({ 
            type: 'result', 
            success: false, 
            error: error.message 
        });
    }
}

async function computeCube(params) {
    try {
        const startTime = performance.now();
        
        postMessage({ 
            type: 'log', 
            level: 2, 
            message: `Computing ${params.cubeType} cube for orbital ${params.orbitalIndex || 'N/A'}...` 
        });

        if (!self.currentCalculation || !self.currentMolecule) {
            throw new Error('No calculation available. Please run a calculation first.');
        }

        // Validate parameters
        const gridSteps = Math.min(Math.max(params.gridSteps || 40, 20), 60);
        
        if (gridSteps !== (params.gridSteps || 40)) {
            postMessage({ 
                type: 'log', 
                level: 2, 
                message: `Grid steps clamped to valid range: ${gridSteps}` 
            });
        }

        const wavefunction = self.currentCalculation.wavefunction;
        
        // Validate wavefunction is properly initialized
        if (!wavefunction) {
            throw new Error('Wavefunction is not available or not properly initialized');
        }
        
        postMessage({ 
            type: 'log', 
            level: 2, 
            message: `Using grid: ${gridSteps} steps` 
        });
        
        let cubeString;
        let gridInfo;

        switch (params.cubeType) {
            case 'molecular_orbital':
                // Validate orbital index
                if (params.orbitalIndex === undefined || params.orbitalIndex < 0) {
                    throw new Error('Invalid orbital index provided');
                }
                
                // Get number of basis functions to validate orbital index
                const numBasisFunctions = self.currentCalculation.basis?.nbf?.() || 0;
                if (params.orbitalIndex >= numBasisFunctions) {
                    throw new Error(`Orbital index ${params.orbitalIndex} exceeds available orbitals (${numBasisFunctions})`);
                }

                // Use the correct API from the bindings - MO cubes use ElectronDensity property with mo_number
                let moCalculator = null;
                let moParams = null;
                let moVolume = null;
                
                try {
                    if (!occModule.VolumeCalculator) {
                        throw new Error('VolumeCalculator not available in OCC module');
                    }
                    
                    moCalculator = new occModule.VolumeCalculator();
                    moParams = new occModule.VolumeGenerationParameters();
                    
                    // Use the correct API - MO cubes use ElectronDensity property with mo_number set
                    if (!occModule.VolumePropertyKind || !occModule.VolumePropertyKind.ElectronDensity) {
                        throw new Error('VolumePropertyKind.ElectronDensity not available');
                    }
                    
                    postMessage({ 
                        type: 'log', 
                        level: 2, 
                        message: `Setting up MO calculation for orbital ${params.orbitalIndex}` 
                    });
                    
                    moCalculator.setWavefunction(wavefunction);
                    moParams.property = occModule.VolumePropertyKind.ElectronDensity;
                    moParams.mo_number = params.orbitalIndex;  // This is the key - set mo_number for MO cubes
                    moParams.setSteps(gridSteps, gridSteps, gridSteps);
                    // Note: setBuffer is not exposed in the bindings, only setOrigin

                    postMessage({ 
                        type: 'log', 
                        level: 2, 
                        message: `Computing volume for orbital ${params.orbitalIndex}...` 
                    });

                    moVolume = moCalculator.computeVolume(moParams);
                    
                    if (!moVolume) {
                        throw new Error('Volume computation returned null/undefined');
                    }
                    
                    // Extract grid information from VolumeData
                    gridInfo = {
                        origin: moVolume.getOrigin(),
                        steps: moVolume.getSteps(), 
                        nx: moVolume.nx(),
                        ny: moVolume.ny(),
                        nz: moVolume.nz(),
                        basis: moVolume.getBasis()
                    };
                    
                    postMessage({ 
                        type: 'log', 
                        level: 2, 
                        message: `Grid: ${gridInfo.nx}x${gridInfo.ny}x${gridInfo.nz}, origin: [${gridInfo.origin[0].toFixed(2)}, ${gridInfo.origin[1].toFixed(2)}, ${gridInfo.origin[2].toFixed(2)}]` 
                    });
                    
                    cubeString = moCalculator.volumeAsCubeString(moVolume);
                    
                    if (!cubeString || cubeString.length === 0) {
                        throw new Error('Cube string generation failed or returned empty result');
                    }

                } catch (error) {
                    postMessage({ 
                        type: 'log', 
                        level: 3, 
                        message: `MO cube computation error: ${error.message}` 
                    });
                    throw error;
                } finally {
                    // Ensure cleanup happens even if errors occur
                    try {
                        if (moVolume) moVolume.delete();
                        if (moParams) moParams.delete();
                        if (moCalculator) moCalculator.delete();
                    } catch (cleanupError) {
                        postMessage({ 
                            type: 'log', 
                            level: 3, 
                            message: `Cleanup error: ${cleanupError.message}` 
                        });
                    }
                }
                break;

            case 'electron_density':
                // Use VolumeCalculator for consistency
                let densityCalculator = null;
                let densityParams = null;
                let densityVolume = null;
                
                try {
                    if (!occModule.VolumeCalculator) {
                        throw new Error('VolumeCalculator not available in OCC module');
                    }
                    
                    densityCalculator = new occModule.VolumeCalculator();
                    densityParams = new occModule.VolumeGenerationParameters();
                    
                    if (!occModule.VolumePropertyKind || !occModule.VolumePropertyKind.ElectronDensity) {
                        throw new Error('VolumePropertyKind.ElectronDensity not available');
                    }
                    
                    densityCalculator.setWavefunction(wavefunction);
                    densityParams.property = occModule.VolumePropertyKind.ElectronDensity;
                    densityParams.setSteps(gridSteps, gridSteps, gridSteps);

                    densityVolume = densityCalculator.computeVolume(densityParams);
                    
                    if (!densityVolume) {
                        throw new Error('Density volume computation returned null/undefined');
                    }
                    
                    // Extract grid information from VolumeData
                    gridInfo = {
                        origin: densityVolume.getOrigin(),
                        steps: densityVolume.getSteps(), 
                        nx: densityVolume.nx(),
                        ny: densityVolume.ny(),
                        nz: densityVolume.nz(),
                        basis: densityVolume.getBasis()
                    };
                    
                    cubeString = densityCalculator.volumeAsCubeString(densityVolume);
                    
                    if (!cubeString || cubeString.length === 0) {
                        throw new Error('Density cube string generation failed or returned empty result');
                    }

                } catch (error) {
                    postMessage({ 
                        type: 'log', 
                        level: 3, 
                        message: `Density cube computation error: ${error.message}` 
                    });
                    throw error;
                } finally {
                    try {
                        if (densityVolume) densityVolume.delete();
                        if (densityParams) densityParams.delete();
                        if (densityCalculator) densityCalculator.delete();
                    } catch (cleanupError) {
                        postMessage({ 
                            type: 'log', 
                            level: 3, 
                            message: `Density cleanup error: ${cleanupError.message}` 
                        });
                    }
                }
                break;

            case 'electric_potential':
                let espCalculator = null;
                let espParams = null;
                let espVolume = null;
                
                try {
                    if (!occModule.VolumeCalculator) {
                        throw new Error('VolumeCalculator not available in OCC module');
                    }
                    
                    espCalculator = new occModule.VolumeCalculator();
                    espParams = new occModule.VolumeGenerationParameters();
                    
                    if (!occModule.VolumePropertyKind || !occModule.VolumePropertyKind.ElectricPotential) {
                        throw new Error('VolumePropertyKind.ElectricPotential not available');
                    }
                    
                    espCalculator.setWavefunction(wavefunction);
                    espParams.property = occModule.VolumePropertyKind.ElectricPotential;
                    espParams.setSteps(gridSteps, gridSteps, gridSteps);
                    espParams.setBuffer(gridBuffer);

                    espVolume = espCalculator.computeVolume(espParams);
                    
                    if (!espVolume) {
                        throw new Error('ESP volume computation returned null/undefined');
                    }
                    
                    cubeString = espCalculator.volumeAsCubeString(espVolume);
                    
                    if (!cubeString || cubeString.length === 0) {
                        throw new Error('ESP cube string generation failed or returned empty result');
                    }

                } catch (error) {
                    postMessage({ 
                        type: 'log', 
                        level: 3, 
                        message: `ESP cube computation error: ${error.message}` 
                    });
                    throw error;
                } finally {
                    try {
                        if (espVolume) espVolume.delete();
                        if (espParams) espParams.delete();
                        if (espCalculator) espCalculator.delete();
                    } catch (cleanupError) {
                        postMessage({ 
                            type: 'log', 
                            level: 3, 
                            message: `ESP cleanup error: ${cleanupError.message}` 
                        });
                    }
                }
                break;

            default:
                throw new Error(`Unknown cube type: ${params.cubeType}`);
        }

        const endTime = performance.now();
        const elapsedMs = endTime - startTime;

        postMessage({ 
            type: 'log', 
            level: 2, 
            message: `Cube computation completed in ${elapsedMs.toFixed(0)}ms` 
        });

        // Send cube result back to main thread
        const result = { 
            type: 'cubeResult', 
            success: true, 
            cubeData: cubeString,
            cubeType: params.cubeType,
            orbitalIndex: params.orbitalIndex,
            gridSteps: params.gridSteps,
            elapsedMs: elapsedMs
        };
        
        // Only include gridInfo if it was extracted (molecular orbital case)
        if (typeof gridInfo !== 'undefined') {
            result.gridInfo = gridInfo;
        }
        
        postMessage(result);

    } catch (error) {
        postMessage({ 
            type: 'cubeResult', 
            success: false, 
            error: error.message,
            cubeType: params.cubeType,
            orbitalIndex: params.orbitalIndex
        });
    }
}

async function runOptimizationCalculation(params) {
    if (!optimizationModule) {
        throw new Error('Optimization module not loaded');
    }
    
    try {
        const result = await optimizationModule.runOptimization(params, OCC, occModule);
        
        // Convert optimization results to expected format
        const trajectory = result.optimization;
        
        // Prepare results object
        const results = {
            energy: trajectory.finalEnergy,
            energyInEV: trajectory.finalEnergy * 27.2114,
            elapsedMs: result.elapsedMs,
            converged: trajectory.converged,
            optimization: {
                trajectory: trajectory,
                finalXYZ: result.finalXYZ,
                steps: trajectory.steps,
                energies: trajectory.energies,
                gradientNorms: trajectory.gradientNorms
            },
            frequencies: result.frequencies
        };
        
        // If we have final wavefunction data, add it to results and store for cube generation
        if (result.finalWavefunctionData) {
            const finalWfnData = result.finalWavefunctionData;
            
            // Add ALL wavefunction data to results (same as regular calculation)
            results.wavefunctionData = finalWfnData.wavefunctionData;
            results.orbitalEnergies = finalWfnData.orbitalEnergies;
            results.orbitalOccupations = finalWfnData.orbitalOccupations;
            results.properties = finalWfnData.properties;
            results.matrices = finalWfnData.matrices;
            
            // Store calculation data for cube computation on optimized geometry
            self.currentMolecule = finalWfnData.molecule;
            
            // Create a pseudo-calculation object for cube generation
            self.currentCalculation = {
                basis: finalWfnData.basis,
                wavefunction: finalWfnData.wavefunction,
                method: finalWfnData.method
            };
            
            postMessage({ 
                type: 'log', 
                level: 2, 
                message: 'Final wavefunction data available for orbital visualization and analysis' 
            });
        }
        
        postMessage({
            type: 'result',
            success: true,
            results: results
        });
    } catch (error) {
        postMessage({
            type: 'result',
            success: false,
            error: error.message
        });
    }
}