// Optimization support for wavefunction worker
// This module adds geometry optimization and frequency calculation capabilities

async function runOptimization(params, OCC, occModule) {
    const startTime = performance.now();
    const trajectory = {
        energies: [],
        gradientNorms: [],
        geometries: [],
        converged: false,
        steps: 0,
        finalEnergy: null,
        finalMolecule: null
    };
    
    try {
        postMessage({ 
            type: 'progress', 
            stage: 'optimization_start',
            message: 'Starting geometry optimization...' 
        });
        
        // Create initial molecule from XYZ data
        const initialMolecule = await OCC.moleculeFromXYZ(params.xyzData);
        
        // Set up convergence criteria
        const criteria = new occModule.ConvergenceCriteria();
        criteria.gradientMax = params.optGradientMax || 1e-4;
        criteria.gradientRms = params.optGradientRms || 1e-5;
        criteria.stepMax = params.optStepMax || 1e-3;
        criteria.stepRms = params.optStepRms || 1e-4;
        
        postMessage({ 
            type: 'log', 
            level: 2, 
            message: `Optimization criteria: gradMax=${criteria.gradientMax}, gradRms=${criteria.gradientRms}` 
        });
        
        // Create optimizer
        const optimizer = new occModule.BernyOptimizer(initialMolecule, criteria);
        
        const maxSteps = params.optMaxSteps || 25;
        let converged = false;
        
        for (let step = 0; step < maxSteps; step++) {
            postMessage({ 
                type: 'progress', 
                stage: 'optimization_step',
                message: `Optimization step ${step + 1}/${maxSteps}...`,
                step: step + 1,
                maxSteps: maxSteps
            });
            
            // Get current geometry
            const currentMol = optimizer.getNextGeometry();
            
            // Store XYZ for trajectory
            const xyzString = occModule.moleculeToXYZ(currentMol);
            trajectory.geometries.push(xyzString);
            
            // Create basis and method for current geometry
            const basis = occModule.AOBasis.load(currentMol.atoms(), params.basisSet);
            
            let method, scf, energy, gradient;
            
            if (params.method === 'hf') {
                const hf = new occModule.HartreeFock(basis);
                scf = new occModule.HartreeFockSCF(hf);
                scf.setChargeMultiplicity(params.charge || 0, params.multiplicity || 1);
                energy = await scf.run();
                const wfn = scf.wavefunction();
                gradient = hf.computeGradient(wfn.molecularOrbitals);
                method = hf;
            } else if (params.method.startsWith('dft-')) {
                const functional = params.method.substring(4);
                const dft = new occModule.DFT(functional, basis);
                scf = dft.scf(occModule.SpinorbitalKind.Restricted);
                scf.setChargeMultiplicity(params.charge || 0, params.multiplicity || 1);
                energy = await scf.run();
                const wfn = scf.wavefunction();
                gradient = dft.computeGradient(wfn.molecularOrbitals);
                method = dft;
            }
            
            // Store progress
            trajectory.energies.push(energy);
            
            // Calculate gradient norm manually if squaredNorm() doesn't exist
            let gradNorm = 0;
            try {
                gradNorm = Math.sqrt(gradient.squaredNorm());
            } catch (e) {
                // Alternative: calculate norm manually
                let sum = 0;
                const rows = gradient.rows();
                const cols = gradient.cols();
                for (let i = 0; i < rows; i++) {
                    for (let j = 0; j < cols; j++) {
                        const val = gradient.get(i, j);
                        sum += val * val;
                    }
                }
                gradNorm = Math.sqrt(sum);
            }
            trajectory.gradientNorms.push(gradNorm);
            
            postMessage({ 
                type: 'log', 
                level: 2, 
                message: `Step ${step + 1}: E = ${energy.toFixed(8)} Ha, |grad| = ${gradNorm.toFixed(6)}` 
            });
            
            // Update optimizer
            optimizer.update(energy, gradient);
            
            // Check convergence
            if (optimizer.step()) {
                converged = true;
                trajectory.converged = true;
                trajectory.steps = step + 1;
                postMessage({ 
                    type: 'log', 
                    level: 2, 
                    message: `Optimization converged in ${step + 1} steps!` 
                });
                break;
            }
        }
        
        // Get final results
        trajectory.finalMolecule = optimizer.getNextGeometry();
        trajectory.finalEnergy = optimizer.currentEnergy();
        
        const finalXYZ = occModule.moleculeToXYZ(trajectory.finalMolecule);
        
        // Compute final wavefunction for orbital visualization
        let finalWavefunctionData = null;
        try {
            postMessage({ 
                type: 'log', 
                level: 2, 
                message: 'Computing final wavefunction for optimized geometry...' 
            });
            
            finalWavefunctionData = await computeFinalWavefunction(
                trajectory.finalMolecule, 
                params, 
                OCC, 
                occModule
            );
        } catch (error) {
            postMessage({ 
                type: 'log', 
                level: 3, 
                message: `Warning: Could not compute final wavefunction: ${error.message}` 
            });
        }
        
        // Run frequency calculation if requested
        let frequencies = null;
        if (params.computeFrequencies && converged) {
            frequencies = await computeFrequencies(
                trajectory.finalMolecule, 
                params, 
                OCC, 
                occModule
            );
        }
        
        const endTime = performance.now();
        
        return {
            success: true,
            optimization: trajectory,
            finalXYZ: finalXYZ,
            finalWavefunctionData: finalWavefunctionData,
            frequencies: frequencies,
            elapsedMs: endTime - startTime
        };
        
    } catch (error) {
        postMessage({ 
            type: 'log', 
            level: 4, 
            message: `Optimization error: ${error.message}` 
        });
        throw error;
    }
}

async function computeFinalWavefunction(molecule, params, OCC, occModule) {
    try {
        // Set up calculation at optimized geometry
        const basis = occModule.AOBasis.load(molecule.atoms(), params.basisSet);
        
        let method, scf, wfn;
        
        if (params.method === 'hf') {
            const hf = new occModule.HartreeFock(basis);
            scf = new occModule.HartreeFockSCF(hf);
            scf.setChargeMultiplicity(params.charge || 0, params.multiplicity || 1);
            const energy = await scf.run();
            wfn = scf.wavefunction();
            method = hf;
        } else if (params.method.startsWith('dft-')) {
            const functional = params.method.substring(4);
            const dft = new occModule.DFT(functional, basis);
            scf = dft.scf(occModule.SpinorbitalKind.Restricted);
            scf.setChargeMultiplicity(params.charge || 0, params.multiplicity || 1);
            const energy = await scf.run();
            wfn = scf.wavefunction();
            method = dft;
        }
        
        // Prepare wavefunction data similar to regular calculation
        const wavefunctionData = {
            numBasisFunctions: basis.nbf(),
            numAtoms: molecule.size(),
            nAlpha: wfn.nAlpha || Math.ceil(molecule.numElectrons() / 2),
            nBeta: wfn.nBeta || Math.floor(molecule.numElectrons() / 2),
            numElectrons: molecule.numElectrons(),
            basisSet: params.basisSet,
            method: params.method
        };
        
        // Get orbital energies and occupations using the same method as regular calculation
        let orbitalEnergies = [];
        let orbitalOccupations = [];
        
        try {
            // Extract orbital energies using the same approach as regular calculation
            const energies = wfn.orbitalEnergies();
            for (let i = 0; i < energies.size(); i++) {
                orbitalEnergies.push(energies.get(i));
            }
            
            // Compute orbital occupations using the same logic as regular calculation
            const numOrbitals = orbitalEnergies.length;
            if (numOrbitals > 0) {
                const nAlpha = wfn.nAlpha || Math.ceil(molecule.numElectrons() / 2);
                const nBeta = wfn.nBeta || Math.floor(molecule.numElectrons() / 2);
                
                // For restricted calculations, each orbital gets 0, 1, or 2 electrons
                for (let i = 0; i < numOrbitals; i++) {
                    if (i < Math.min(nAlpha, nBeta)) {
                        orbitalOccupations.push(2.0); // Doubly occupied
                    } else if (i < Math.max(nAlpha, nBeta)) {
                        orbitalOccupations.push(1.0); // Singly occupied
                    } else {
                        orbitalOccupations.push(0.0); // Virtual
                    }
                }
            }
        } catch (error) {
            postMessage({ 
                type: 'log', 
                level: 3, 
                message: `Could not extract orbital data: ${error.message}` 
            });
        }
        
        // Generate FCHK file for cube generation
        try {
            const fchkString = wfn.exportToString("fchk");
            if (fchkString && fchkString.length > 0) {
                wavefunctionData.fchk = fchkString;
            }
        } catch (fchkError) {
            postMessage({ 
                type: 'log', 
                level: 3, 
                message: `Could not generate FCHK file for optimized geometry: ${fchkError.message}` 
            });
        }
        
        // Calculate properties (HOMO, LUMO, gap)
        let properties = null;
        try {
            if (orbitalEnergies.length > 0 && orbitalOccupations.length > 0) {
                // Find HOMO and LUMO
                let homoIndex = -1;
                let lumoIndex = -1;
                
                for (let i = 0; i < orbitalOccupations.length; i++) {
                    if (orbitalOccupations[i] > 0) {
                        homoIndex = i; // Last occupied orbital
                    } else if (lumoIndex === -1 && orbitalOccupations[i] === 0) {
                        lumoIndex = i; // First unoccupied orbital
                        break;
                    }
                }
                
                if (homoIndex >= 0) {
                    const homoEnergy = orbitalEnergies[homoIndex];
                    properties = { homo: homoEnergy };
                    
                    if (lumoIndex >= 0) {
                        const lumoEnergy = orbitalEnergies[lumoIndex];
                        properties.lumo = lumoEnergy;
                        properties.gap = lumoEnergy - homoEnergy;
                    }
                }
            }
        } catch (error) {
            postMessage({ 
                type: 'log', 
                level: 3, 
                message: `Could not calculate molecular properties: ${error.message}` 
            });
        }
        
        // Compute matrices using the same approach as regular calculation
        let matrices = {};
        try {
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
            
            // Compute matrices using the same approach as regular calculation
            try {
                const overlapMatrix = method.overlapMatrix();
                matrices.overlap = matrixToArray(overlapMatrix);
            } catch (e) {
                postMessage({ type: 'log', level: 3, message: `Could not compute overlap matrix: ${e.message}` });
            }
            
            try {
                const kineticMatrix = method.kineticMatrix();
                matrices.kinetic = matrixToArray(kineticMatrix);
            } catch (e) {
                postMessage({ type: 'log', level: 3, message: `Could not compute kinetic matrix: ${e.message}` });
            }
            
            try {
                const nuclearMatrix = method.nuclearAttractionMatrix();
                matrices.nuclear = matrixToArray(nuclearMatrix);
            } catch (e) {
                postMessage({ type: 'log', level: 3, message: `Could not compute nuclear attraction matrix: ${e.message}` });
            }
            
            try {
                const fockMatrix = method.fockMatrix(wfn.molecularOrbitals);
                matrices.fock = matrixToArray(fockMatrix);
            } catch (e) {
                postMessage({ type: 'log', level: 3, message: `Could not compute Fock matrix: ${e.message}` });
            }
            
            try {
                const densityMatrix = wfn.molecularOrbitals.densityMatrix;
                matrices.density = matrixToArray(densityMatrix);
            } catch (e) {
                postMessage({ type: 'log', level: 3, message: `Could not compute density matrix: ${e.message}` });
            }
            
            try {
                const coefficients = wfn.coefficients();
                matrices.coefficients = matrixToArray(coefficients);
            } catch (e) {
                postMessage({ type: 'log', level: 3, message: `Could not extract MO coefficients: ${e.message}` });
            }
            
        } catch (error) {
            postMessage({ 
                type: 'log', 
                level: 3, 
                message: `Matrix computation failed: ${error.message}` 
            });
        }
        
        return {
            wavefunctionData: wavefunctionData,
            orbitalEnergies: orbitalEnergies,
            orbitalOccupations: orbitalOccupations,
            properties: properties,
            matrices: matrices,
            molecule: molecule,
            basis: basis,
            wavefunction: wfn,
            method: method
        };
        
    } catch (error) {
        postMessage({ 
            type: 'log', 
            level: 4, 
            message: `Final wavefunction calculation error: ${error.message}` 
        });
        throw error;
    }
}

async function computeFrequencies(molecule, params, OCC, occModule) {
    try {
        postMessage({ 
            type: 'progress', 
            stage: 'frequencies_start',
            message: 'Computing vibrational frequencies...' 
        });
        
        // Set up calculation at optimized geometry
        const basis = occModule.AOBasis.load(molecule.atoms(), params.basisSet);
        
        let method, scf, wfn, hessEvaluator;
        
        if (params.method === 'hf') {
            const hf = new occModule.HartreeFock(basis);
            scf = new occModule.HartreeFockSCF(hf);
            scf.setChargeMultiplicity(params.charge || 0, params.multiplicity || 1);
            const energy = await scf.run();
            wfn = scf.wavefunction();
            hessEvaluator = hf.hessianEvaluator();
        } else if (params.method.startsWith('dft-')) {
            const functional = params.method.substring(4);
            const dft = new occModule.DFT(functional, basis);
            scf = dft.scf(occModule.SpinorbitalKind.Restricted);
            scf.setChargeMultiplicity(params.charge || 0, params.multiplicity || 1);
            const energy = await scf.run();
            wfn = scf.wavefunction();
            hessEvaluator = dft.hessianEvaluator();
        }
        
        // Configure Hessian evaluator
        hessEvaluator.setStepSize(params.hessianStepSize || 0.005);
        hessEvaluator.setUseAcousticSumRule(true);
        
        postMessage({ 
            type: 'log', 
            level: 2, 
            message: `Computing Hessian with step size ${hessEvaluator.stepSize()} Bohr...` 
        });
        
        // Compute Hessian
        const hessian = hessEvaluator.compute(wfn.molecularOrbitals);
        
        postMessage({ 
            type: 'log', 
            level: 2, 
            message: `Hessian computed: ${hessian.rows()}x${hessian.cols()}` 
        });
        
        // Compute vibrational modes
        const vibModes = occModule.computeVibrationalModesFromMolecule(hessian, molecule, false);
        
        // Extract frequencies
        const freqVector = vibModes.getAllFrequencies();
        const frequencies = [];
        for (let i = 0; i < freqVector.size(); i++) {
            frequencies.push(freqVector.get(i));
        }
        
        // Extract normal mode vectors from the normalModes property
        let normalModes = [];
        try {
            const normalModesMatrix = vibModes.normalModes;
            if (normalModesMatrix) {
                // Convert the normal modes matrix to a JavaScript array
                const rows = normalModesMatrix.rows();
                const cols = normalModesMatrix.cols();
                
                postMessage({ 
                    type: 'log', 
                    level: 2, 
                    message: `Normal modes matrix: ${rows}x${cols}` 
                });
                
                // Each column represents a normal mode
                for (let col = 0; col < cols; col++) {
                    const mode = [];
                    for (let row = 0; row < rows; row++) {
                        mode.push(normalModesMatrix.get(row, col));
                    }
                    normalModes.push(mode);
                }
                
                postMessage({ 
                    type: 'log', 
                    level: 2, 
                    message: `Extracted ${normalModes.length} normal mode vectors` 
                });
            } else {
                postMessage({ 
                    type: 'log', 
                    level: 3, 
                    message: `Normal modes matrix is null or undefined` 
                });
            }
        } catch (error) {
            postMessage({ 
                type: 'log', 
                level: 3, 
                message: `Could not extract normal mode vectors: ${error.message}` 
            });
        }
        
        // Get summary
        const summary = vibModes.summaryString();
        
        postMessage({ 
            type: 'log', 
            level: 2, 
            message: `Found ${frequencies.length} vibrational modes` 
        });
        
        return {
            frequencies: frequencies,
            normalModes: normalModes,
            nModes: vibModes.nModes(),
            nAtoms: vibModes.nAtoms(),
            summary: summary
        };
        
    } catch (error) {
        postMessage({ 
            type: 'log', 
            level: 4, 
            message: `Frequency calculation error: ${error.message}` 
        });
        return null;
    }
}

// Export functions for use in main worker
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runOptimization, computeFrequencies };
}