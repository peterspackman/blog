// Web Worker for running SCF calculations
// This worker handles the computationally intensive tasks off the main thread

let OCC = null;
let occModule = null;

// Initialize OCC module when worker starts
self.addEventListener('message', async function(e) {
    const { type, data } = e.data;
    
    try {
        switch(type) {
            case 'init':
                await initializeOCC(data);
                break;
                
            case 'calculate':
                await runCalculation(data);
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

        const wavefunction = self.currentCalculation.wavefunction;
        let cubeString;

        switch (params.cubeType) {
            case 'molecular_orbital':
                // Try the simple approach first, fall back to volume calculator if needed
                try {
                    cubeString = occModule.generateMOCube(
                        wavefunction,
                        params.orbitalIndex,
                        params.gridSteps || 40,
                        params.gridSteps || 40,
                        params.gridSteps || 40
                    );
                } catch (simpleError) {
                    postMessage({ 
                        type: 'log', 
                        level: 3, 
                        message: `Simple MO cube generation failed, trying volume calculator: ${simpleError.message}` 
                    });
                    
                    // Fall back to volume calculator
                    const moCalculator = new occModule.VolumeCalculator();
                    moCalculator.setWavefunction(wavefunction);

                    const moParams = new occModule.VolumeGenerationParameters();
                    moParams.property = occModule.VolumePropertyKind.MolecularOrbital;
                    moParams.orbitalIndex = params.orbitalIndex;
                    moParams.setSteps(params.gridSteps || 40, params.gridSteps || 40, params.gridSteps || 40);
                    
                    // Set buffer around molecule if specified
                    if (params.gridBuffer) {
                        moParams.setBuffer(params.gridBuffer);
                    }

                    const moVolume = moCalculator.computeVolume(moParams);
                    cubeString = moCalculator.volumeAsCubeString(moVolume);

                    // Clean up
                    moVolume.delete();
                    moParams.delete();
                    moCalculator.delete();
                }
                break;

            case 'electron_density':
                cubeString = occModule.generateElectronDensityCube(
                    wavefunction,
                    params.gridSteps || 40,
                    params.gridSteps || 40,
                    params.gridSteps || 40
                );
                break;

            case 'electric_potential':
                // Use volume calculator for ESP (this is the standard way for ESP)
                try {
                    const espCalculator = new occModule.VolumeCalculator();
                    espCalculator.setWavefunction(wavefunction);

                    const espParams = new occModule.VolumeGenerationParameters();
                    espParams.property = occModule.VolumePropertyKind.ElectricPotential;
                    espParams.setSteps(params.gridSteps || 40, params.gridSteps || 40, params.gridSteps || 40);
                    
                    if (params.gridBuffer) {
                        espParams.setBuffer(params.gridBuffer);
                    }

                    const espVolume = espCalculator.computeVolume(espParams);
                    cubeString = espCalculator.volumeAsCubeString(espVolume);

                    // Clean up
                    espVolume.delete();
                    espParams.delete();
                    espCalculator.delete();
                } catch (espError) {
                    postMessage({ 
                        type: 'log', 
                        level: 3, 
                        message: `ESP calculation failed: ${espError.message}` 
                    });
                    throw espError;
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
        postMessage({ 
            type: 'cubeResult', 
            success: true, 
            cubeData: cubeString,
            cubeType: params.cubeType,
            orbitalIndex: params.orbitalIndex,
            gridSteps: params.gridSteps,
            gridBuffer: params.gridBuffer,
            elapsedMs: elapsedMs
        });

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