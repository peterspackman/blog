import React, { useState, useEffect, useRef } from 'react';
import styles from './WavefunctionCalculator.module.css';
import FileUploader from './FileUploader';
import CalculationSettings from './CalculationSettings';
import CubeSettings, { CubeGeometrySettings } from './CubeSettings';
import ResultsDisplay from './ResultsDisplay';
import LogOutput from './LogOutput';
import MatrixDisplay from './MatrixDisplay';
import MoleculeViewer from './MoleculeViewer';
import OrbitalItem from './OrbitalItem';
import TrajectoryViewer from '@site/src/components/TrajectoryViewer';
import { NormalModeTrajectory } from './NormalModeTrajectory';

interface CalculationResult {
  energy: number;
  energyInEV: number;
  elapsedMs: number;
  converged: boolean;
  properties?: {
    homo?: number;
    lumo?: number;
    gap?: number;
    alphaHOMO?: number;
    alphaLUMO?: number;
    betaHOMO?: number;
    betaLUMO?: number;
    isUnrestricted?: boolean;
  };
  wavefunctionData?: {
    fchk?: string;
    owfJson?: string;
    numBasisFunctions: number;
    numAtoms: number;
  };
  matrices?: {
    overlap?: MatrixData;
    kinetic?: MatrixData;
    nuclear?: MatrixData;
    fock?: MatrixData;
    density?: MatrixData;
    coefficients?: MatrixData;
  };
  orbitalEnergies?: number[] | {
    alpha: number[];
    beta: number[];
    isUnrestricted: true;
  };
  orbitalOccupations?: number[] | {
    alpha: number[];
    beta: number[];
    isUnrestricted: true;
  };
  optimization?: {
    trajectory: {
      energies: number[];
      gradientNorms: number[];
      geometries: string[];
      converged: boolean;
      steps: number;
      finalEnergy: number;
      finalMolecule: any;
    };
    finalXYZ: string;
    steps: number;
    energies: number[];
    gradientNorms: number[];
  };
  frequencies?: {
    frequencies: number[];
    nModes: number;
    nAtoms: number;
    summary: string;
    normalModes?: number[][];
  };
}

interface MatrixData {
  rows: number;
  cols: number;
  data: number[][];
}

interface SCFSettings {
  method: string;
  basisSet: string;
  charge: number;
  multiplicity: number;
  optimize: boolean;
  computeFrequencies: boolean;
  maxIterations: number;
  energyTolerance: number;
  threads: number;
  logLevel: number;
}

const WavefunctionCalculator: React.FC = () => {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [currentXYZData, setCurrentXYZData] = useState<string>('');
  const [moleculeInfo, setMoleculeInfo] = useState<{ name: string; formula: string; numAtoms: number } | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [results, setResults] = useState<CalculationResult | null>(null);
  const [logs, setLogs] = useState<Array<{ message: string; level: string; timestamp: Date }>>([]);
  const [activeTab, setActiveTab] = useState<'output' | 'results' | 'structure' | 'properties' | 'optimization'>('structure');
  const [error, setError] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
  const [cubeResults, setCubeResults] = useState<Map<string, string>>(new Map());
  const [cubeGridInfo, setCubeGridInfo] = useState<any>(null);
  const [isXYZValid, setIsXYZValid] = useState<boolean>(true);
  const [wavefunctionData, setWavefunctionData] = useState<Uint8Array | null>(null);
  
  // Collapsible sections state
  const [isInputExpanded, setIsInputExpanded] = useState(true);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(true);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Calculation settings
  const [settings, setSettings] = useState<SCFSettings>({
    method: 'hf',
    basisSet: '3-21g',
    charge: 0,
    multiplicity: 1,
    optimize: false,
    computeFrequencies: false,
    maxIterations: 100,
    energyTolerance: 1e-8,
    threads: 1,
    logLevel: 2
  });

  // Helper to update settings
  const updateSettings = (updates: Partial<SCFSettings>) => {
    setSettings(prev => {
      const newSettings = { ...prev, ...updates };
      // Auto-disable frequencies if optimization is turned off
      if ('optimize' in updates && !updates.optimize) {
        newSettings.computeFrequencies = false;
      }
      return newSettings;
    });
  };
  
  // Cube settings
  const [cubeSettings, setCubeSettings] = useState<CubeGeometrySettings>({
    gridSteps: 50,
    useAdaptive: true,
    bufferDistance: 2.0,
    threshold: 1e-5,
    customOrigin: false,
    origin: [0, 0, 0],
    customDirections: false,
    directionA: [0, 0, 0],
    directionB: [0, 0, 0],
    directionC: [0, 0, 0]
  });
  const [showCubeSettings, setShowCubeSettings] = useState(false);

  const updateCubeSettings = (updates: Partial<CubeGeometrySettings>) => {
    setCubeSettings(prev => ({ ...prev, ...updates }));
  };

  // Trajectory viewing state
  const [trajectoryMode, setTrajectoryMode] = useState<'optimization' | 'normal_mode'>('optimization');
  const [selectedNormalMode, setSelectedNormalMode] = useState<number | null>(null);
  const [hideLowModes, setHideLowModes] = useState<boolean>(true);
  const [isTrajectoryControlsExpanded, setIsTrajectoryControlsExpanded] = useState<boolean>(true);
  const [precomputedTrajectories, setPrecomputedTrajectories] = useState<Map<number, string>>(new Map());

  // Initialize worker on mount
  useEffect(() => {
    initializeWorker();
    return () => {
      if (worker) {
        worker.terminate();
      }
    };
  }, []);

  const initializeWorker = async () => {
    try {
      const newWorker = new Worker(
        new URL('./ready-worker.js', import.meta.url),
        { type: 'module' }
      );

      newWorker.onmessage = handleWorkerMessage;
      newWorker.onerror = (error) => {
        console.error('Worker error:', error);
        setError('Worker error: ' + error.message);
        setIsWorkerReady(false);
      };

      setWorker(newWorker);

      // Signal ready state
      newWorker.postMessage({
        type: 'init',
        data: {}
      });
    } catch (error) {
      console.error('Failed to initialize worker:', error);
      setError('Failed to initialize Web Worker: ' + error.message);
    }
  };

  const handleWorkerMessage = (e: MessageEvent) => {
    const { type, ...data } = e.data;

    switch (type) {
      case 'initialized':
        if (data.success) {
          setIsWorkerReady(true);
          addLog('Worker initialized successfully', 'info');
        } else {
          setIsWorkerReady(false);
          setError('Worker initialization failed: ' + data.error);
        }
        break;

      case 'log':
        addLog(data.message, mapLogLevel(data.level));
        break;

      case 'progress':
        addLog(data.message, 'info');
        if (data.stage === 'complete') {
          setIsCalculating(false);
        }
        break;

      case 'result':
        handleCalculationResult(data);
        break;
      
      case 'optimization_progress':
        addLog(data.message, 'info');
        break;

      case 'cubeResult':
        handleCubeResult(data);
        break;

      case 'error':
        console.error('Worker error:', data.error);
        setError('Calculation error: ' + data.error);
        setIsCalculating(false);
        break;
    }
  };

  const mapLogLevel = (level: number): string => {
    switch (level) {
      case 0:
      case 1:
        return 'debug';
      case 2:
        return 'info';
      case 3:
        return 'warn';
      case 4:
      case 5:
        return 'error';
      default:
        return 'info';
    }
  };

  const addLog = (message: string, level: string) => {
    setLogs(prev => [...prev, { message, level, timestamp: new Date() }]);
  };

  const handleFileLoad = (xyzContent: string) => {
    setCurrentXYZData(xyzContent);
    
    // Clear cube cache when loading a new molecule
    setCubeResults(new Map());
    
    // Clear any existing calculation results
    setResults(null);
    
    // Clear any previous errors when loading new content
    setError('');
    
    // Switch to structure tab when XYZ file is modified
    setActiveTab('structure');
    setValidationError('');
    
    try {
      // Parse XYZ to get basic info
      const lines = xyzContent.trim().split('\n');
      const numAtoms = parseInt(lines[0]);
      const moleculeName = lines[1] || 'Loaded Molecule';
      
      // Count atoms by element
      const elementCounts = new Map<string, number>();
      for (let i = 2; i < 2 + numAtoms; i++) {
        const parts = lines[i].trim().split(/\s+/);
        const element = parts[0];
        elementCounts.set(element, (elementCounts.get(element) || 0) + 1);
      }
      
      // Create formula
      const formula = Array.from(elementCounts.entries())
        .map(([elem, count]) => count > 1 ? `${elem}${count}` : elem)
        .join('');
      
      setMoleculeInfo({ name: moleculeName, formula, numAtoms });
      addLog(`Molecule loaded: ${formula} (${numAtoms} atoms) - cleared orbital cache`, 'info');
    } catch (error) {
      console.error('Error parsing XYZ:', error);
      // Don't set error here, as validation will handle it
    }
  };
  
  const handleValidationChange = (isValid: boolean, error?: string) => {
    setIsXYZValid(isValid);
    if (!isValid && error) {
      setValidationError(error);
    } else {
      setValidationError('');
    }
  };

  const handleCalculationResult = (data: any) => {
    setIsCalculating(false);
    
    if (data.success) {
      setResults(data.results);
      setActiveTab('results');
      addLog('Calculation completed successfully!', 'info');
      
      // Pre-compute normal mode trajectories if frequencies were calculated
      if (data.results.frequencies?.frequencies && data.results.optimization?.finalXYZ) {
        addLog(`Found frequency data: ${data.results.frequencies.frequencies.length} frequencies, normalModes: ${data.results.frequencies.normalModes ? 'available' : 'missing'}`, 'info');
        precomputeNormalModeTrajectories(data.results);
      } else {
        addLog('No frequency data or optimized geometry available for trajectory pre-computation', 'info');
      }
    } else {
      setError('Calculation failed: ' + data.error);
    }
  };

  const handleCubeResult = (data: any) => {
    if (data.success) {
      let key: string;
      if (data.cubeType === 'molecular_orbital') {
        // Include spin in key for unrestricted calculations
        key = data.spin
          ? `${data.cubeType}_${data.orbitalIndex}_${data.spin}_${data.gridSteps || 40}`
          : `${data.cubeType}_${data.orbitalIndex}_${data.gridSteps || 40}`;
      } else {
        key = data.cubeType;
      }

      setCubeResults(prev => new Map(prev.set(key, data.cubeData)));

      // Store grid info if available
      if (data.gridInfo) {
        setCubeGridInfo(data.gridInfo);
      }

      const spinLabel = data.spin ? ` (${data.spin})` : '';
      addLog(`Cube computation completed: ${data.cubeType}${data.orbitalIndex !== undefined ? ` (orbital ${data.orbitalIndex}${spinLabel})` : ''} [${data.gridSteps || 40} steps]`, 'info');
    } else {
      setError(`Cube computation failed: ${data.error}`);
      addLog(`Cube computation failed: ${data.error}`, 'error');
    }
  };

  const runCalculation = () => {
    if (!currentXYZData) {
      setError('Please load a molecule first.');
      return;
    }

    if (!isXYZValid) {
      // Don't show modal for validation errors, they're already shown inline
      return;
    }

    // Clear previous results and trajectories
    setResults(null);
    setLogs([]);
    setActiveTab('output');
    setIsCalculating(true);
    setPrecomputedTrajectories(new Map()); // Clear trajectory cache

    addLog('Starting calculation via CLI...', 'info');

    // Create CLI worker for this calculation
    const cliWorker = new Worker('/occ-cli-worker.js');

    let outputBuffer = '';
    let hasExited = false;

    cliWorker.onmessage = (e) => {
      const { type, text, code, files, stdout } = e.data;

      switch (type) {
        case 'ready':
          addLog('CLI worker ready, executing command...', 'info');
          break;

        case 'output':
          outputBuffer += text + '\n';
          addLog(text, 'info');
          break;

        case 'error':
          outputBuffer += text + '\n';
          addLog(text, 'error');
          break;

        case 'exit':
          if (hasExited) return; // Prevent duplicate processing
          hasExited = true;

          if (code !== 0) {
            setError(`Calculation failed with exit code ${code}`);
            setIsCalculating(false);
            cliWorker.terminate();
            return;
          }

          addLog('Calculation completed, parsing results...', 'info');

          try {
            // Parse energy from stdout
            const energyMatch = stdout.match(/total\s+([-\d.]+)/);
            if (!energyMatch) {
              throw new Error('Could not parse energy from output');
            }

            const energy = parseFloat(energyMatch[1]);

            // Parse convergence info
            const convergedMatch = stdout.match(/converged after ([\d.]+) seconds/);
            const converged = convergedMatch !== null;
            const convergenceTime = convergedMatch ? parseFloat(convergedMatch[1]) * 1000 : 0;

            // Find the .owf.json file
            const owfPath = Object.keys(files).find(path => path.endsWith('.owf.json'));
            if (!owfPath) {
              throw new Error('No .owf.json file found in output');
            }

            const owfData = files[owfPath];
            addLog(`Found wavefunction file: ${owfPath} (${owfData.length} bytes)`, 'info');

            // Store the wavefunction file for cube generation
            setWavefunctionData(owfData);

            // Parse the wavefunction JSON to extract orbital energies and other data
            const owfText = new TextDecoder().decode(owfData);
            addLog('Parsing wavefunction JSON...', 'info');

            let owfJson;
            try {
              owfJson = JSON.parse(owfText);
              addLog(`Parsed owf.json keys: ${Object.keys(owfJson).join(', ')}`, 'info');
            } catch (parseError) {
              addLog(`Failed to parse owf.json: ${parseError.message}`, 'error');
              throw parseError;
            }

            // Create results object
            const calculationResults: CalculationResult = {
              energy: energy,
              energyInEV: energy * 27.2114,
              elapsedMs: convergenceTime,
              converged: converged
            };

            // Extract orbital energies and occupations from owf.json
            // Note: The key is "molecular orbitals" not "mo"
            const mo = owfJson['molecular orbitals'];
            addLog(`Molecular orbitals object: ${mo ? 'found' : 'missing'}`, 'info');
            if (mo) {
              addLog(`MO keys: ${Object.keys(mo).join(', ')}`, 'info');
            }

            // Check if this is an unrestricted calculation
            const isUnrestricted = mo && mo['spinorbital kind'] === 'unrestricted';
            addLog(`Calculation type: ${isUnrestricted ? 'unrestricted' : 'restricted'}`, 'info');

            // For unrestricted, orbitals are stacked (top half = alpha, bottom half = beta)
            if (isUnrestricted) {
              const orbitalEnergies = mo['orbital energies'];

              if (orbitalEnergies && Array.isArray(orbitalEnergies)) {
                const totalOrbitals = orbitalEnergies.length;
                const halfPoint = totalOrbitals / 2;

                // Split into alpha (first half) and beta (second half)
                // Convert to primitive numbers since they come as Number objects
                const alphaEnergies = orbitalEnergies.slice(0, halfPoint).map(e => Number(e));
                const betaEnergies = orbitalEnergies.slice(halfPoint).map(e => Number(e));

                calculationResults.orbitalEnergies = {
                  alpha: alphaEnergies,
                  beta: betaEnergies,
                  isUnrestricted: true
                };
                addLog(`Found ${alphaEnergies.length} alpha and ${betaEnergies.length} beta orbital energies (stacked format)`, 'info');
              } else {
                addLog('No orbital energies found for unrestricted calculation', 'warn');
              }
            } else {
              // Restricted calculation
              const orbitalEnergies = mo ? mo['orbital energies'] : null;
              if (orbitalEnergies) {
                calculationResults.orbitalEnergies = orbitalEnergies;
                addLog(`Found ${orbitalEnergies.length} orbital energies`, 'info');
              } else {
                addLog(`No energies found in MO object`, 'warn');
              }
            }

            // Set up orbital occupations and HOMO/LUMO
            if (mo) {
              const nAlpha = mo['alpha electrons'] || 0;
              const nBeta = mo['beta electrons'] || 0;

              if (isUnrestricted && calculationResults.orbitalEnergies?.isUnrestricted) {
                // Unrestricted: separate alpha and beta occupations
                const alphaEnergies = calculationResults.orbitalEnergies.alpha;
                const betaEnergies = calculationResults.orbitalEnergies.beta;

                calculationResults.orbitalOccupations = {
                  alpha: alphaEnergies.map((_, i) => i < nAlpha ? 1.0 : 0.0),
                  beta: betaEnergies.map((_, i) => i < nBeta ? 1.0 : 0.0),
                  isUnrestricted: true
                };

                addLog(`Set alpha/beta occupations: ${nAlpha} alpha, ${nBeta} beta electrons`, 'info');

                // HOMO/LUMO for unrestricted
                const alphaHOMO = nAlpha > 0 && nAlpha <= alphaEnergies.length ? alphaEnergies[nAlpha - 1] : null;
                const alphaLUMO = nAlpha < alphaEnergies.length ? alphaEnergies[nAlpha] : null;
                const betaHOMO = nBeta > 0 && nBeta <= betaEnergies.length ? betaEnergies[nBeta - 1] : null;
                const betaLUMO = nBeta < betaEnergies.length ? betaEnergies[nBeta] : null;

                calculationResults.properties = {
                  alphaHOMO: (alphaHOMO !== null && alphaHOMO !== undefined) ? alphaHOMO * 27.2114 : undefined,
                  alphaLUMO: (alphaLUMO !== null && alphaLUMO !== undefined) ? alphaLUMO * 27.2114 : undefined,
                  betaHOMO: (betaHOMO !== null && betaHOMO !== undefined) ? betaHOMO * 27.2114 : undefined,
                  betaLUMO: (betaLUMO !== null && betaLUMO !== undefined) ? betaLUMO * 27.2114 : undefined,
                  isUnrestricted: true
                };

                if (alphaHOMO !== null && alphaHOMO !== undefined) addLog(`Alpha HOMO: ${alphaHOMO.toFixed(6)} Ha (${(alphaHOMO * 27.2114).toFixed(4)} eV)`, 'info');
                if (alphaLUMO !== null && alphaLUMO !== undefined) addLog(`Alpha LUMO: ${alphaLUMO.toFixed(6)} Ha (${(alphaLUMO * 27.2114).toFixed(4)} eV)`, 'info');
                if (betaHOMO !== null && betaHOMO !== undefined) addLog(`Beta HOMO: ${betaHOMO.toFixed(6)} Ha (${(betaHOMO * 27.2114).toFixed(4)} eV)`, 'info');
                if (betaLUMO !== null && betaLUMO !== undefined) addLog(`Beta LUMO: ${betaLUMO.toFixed(6)} Ha (${(betaLUMO * 27.2114).toFixed(4)} eV)`, 'info');

              } else if (calculationResults.orbitalEnergies && Array.isArray(calculationResults.orbitalEnergies)) {
                // Restricted: combined occupations
                const orbitalEnergies = calculationResults.orbitalEnergies;
                const occupationArray = [];
                for (let i = 0; i < orbitalEnergies.length; i++) {
                  if (i < Math.min(nAlpha, nBeta)) {
                    occupationArray.push(2.0); // Doubly occupied
                  } else if (i < Math.max(nAlpha, nBeta)) {
                    occupationArray.push(1.0); // Singly occupied
                  } else {
                    occupationArray.push(0.0); // Virtual
                  }
                }
                calculationResults.orbitalOccupations = occupationArray;
                addLog(`Set orbital occupations based on ${nAlpha} alpha and ${nBeta} beta electrons`, 'info');

                // HOMO/LUMO for restricted
                if (orbitalEnergies.length > 0) {
                  const homoIndex = Math.max(nAlpha, nBeta) - 1;
                  const lumoIndex = homoIndex + 1;

                  if (homoIndex >= 0 && homoIndex < orbitalEnergies.length) {
                    const homo = parseFloat(orbitalEnergies[homoIndex]);
                    const lumo = lumoIndex < orbitalEnergies.length ? parseFloat(orbitalEnergies[lumoIndex]) : null;

                    if (!isNaN(homo)) {
                      calculationResults.properties = {
                        homo: homo * 27.2114,
                        lumo: (lumo && !isNaN(lumo)) ? lumo * 27.2114 : undefined,
                        gap: (lumo && !isNaN(lumo)) ? (lumo - homo) * 27.2114 : undefined
                      };

                      addLog(`HOMO: ${homo.toFixed(6)} Ha (${(homo * 27.2114).toFixed(4)} eV)`, 'info');
                      if (lumo && !isNaN(lumo)) {
                        addLog(`LUMO: ${lumo.toFixed(6)} Ha (${(lumo * 27.2114).toFixed(4)} eV)`, 'info');
                        addLog(`Gap: ${((lumo - homo) * 27.2114).toFixed(4)} eV`, 'info');
                      }
                    }
                  }
                }
              }
            }

            // Store wavefunction metadata and full JSON for download
            if (owfJson.atoms && mo) {
              const basisFunctions = owfJson['basis functions'] || [];
              calculationResults.wavefunctionData = {
                numBasisFunctions: basisFunctions.length || 0,
                numAtoms: owfJson.atoms.length || 0,
                nAlpha: mo['alpha electrons'] || 0,
                nBeta: mo['beta electrons'] || 0,
                owfJson: owfText  // Store the full JSON for download
              };
              addLog('Stored wavefunction metadata', 'info');
            } else {
              addLog(`Warning: Missing atoms or mo in owf.json. Has atoms: ${!!owfJson.atoms}, Has mo: ${!!mo}`, 'warn');
            }

            // Extract matrices from OWF JSON if available
            try {
              calculationResults.matrices = {};

              // Helper function to wrap 2D array in matrix format
              const arrayToMatrix = (matrixData: number[][]) => {
                const rows = matrixData.length;
                const cols = matrixData[0]?.length || 0;
                return { rows, cols, data: matrixData };
              };

              // Calculate number of basis functions from orbital energies length
              const nbf = mo['orbital energies']?.length || 0;
              addLog(`Number of basis functions: ${nbf}`, 'info');

              // Extract kinetic energy matrix (top-level in owfJson)
              if (owfJson['kinetic energy matrix']) {
                const kineticMatrix = owfJson['kinetic energy matrix'];
                if (Array.isArray(kineticMatrix) && kineticMatrix.length > 0 && Array.isArray(kineticMatrix[0])) {
                  calculationResults.matrices.kinetic = arrayToMatrix(kineticMatrix);
                  addLog(`Extracted kinetic energy matrix (${kineticMatrix.length}×${kineticMatrix[0].length})`, 'info');
                }
              }

              // Extract nuclear attraction matrix (top-level in owfJson)
              if (owfJson['nuclear attraction matrix']) {
                const nuclearMatrix = owfJson['nuclear attraction matrix'];
                if (Array.isArray(nuclearMatrix) && nuclearMatrix.length > 0 && Array.isArray(nuclearMatrix[0])) {
                  calculationResults.matrices.nuclear = arrayToMatrix(nuclearMatrix);
                  addLog(`Extracted nuclear attraction matrix (${nuclearMatrix.length}×${nuclearMatrix[0].length})`, 'info');
                }
              }

              // Extract overlap matrix (check multiple possible locations)
              let overlapMatrix = null;
              if (owfJson['overlap matrix']) {
                overlapMatrix = owfJson['overlap matrix'];
              } else if (owfJson['orbital basis']?.['overlap matrix']) {
                overlapMatrix = owfJson['orbital basis']['overlap matrix'];
              } else if (mo['overlap matrix']) {
                overlapMatrix = mo['overlap matrix'];
              }

              if (overlapMatrix && Array.isArray(overlapMatrix) && overlapMatrix.length > 0 && Array.isArray(overlapMatrix[0])) {
                calculationResults.matrices.overlap = arrayToMatrix(overlapMatrix);
                addLog(`Extracted overlap matrix (${overlapMatrix.length}×${overlapMatrix[0].length})`, 'info');
              } else {
                addLog('Overlap matrix not found in OWF JSON', 'warn');
              }

              // Extract density matrix (in molecular orbitals)
              if (mo['density matrix']) {
                const densityMatrix = mo['density matrix'];
                if (Array.isArray(densityMatrix) && densityMatrix.length > 0 && Array.isArray(densityMatrix[0])) {
                  calculationResults.matrices.density = arrayToMatrix(densityMatrix);
                  addLog(`Extracted density matrix (${densityMatrix.length}×${densityMatrix[0].length})`, 'info');
                }
              }

              // Extract MO coefficients (in molecular orbitals as "orbital coefficients")
              if (mo['orbital coefficients']) {
                const coeffMatrix = mo['orbital coefficients'];
                if (Array.isArray(coeffMatrix) && coeffMatrix.length > 0 && Array.isArray(coeffMatrix[0])) {
                  calculationResults.matrices.coefficients = arrayToMatrix(coeffMatrix);
                  addLog(`Extracted MO coefficients matrix (${coeffMatrix.length}×${coeffMatrix[0].length})`, 'info');
                }
              }

              const numMatrices = Object.keys(calculationResults.matrices).length;
              if (numMatrices > 0) {
                addLog(`Extracted ${numMatrices} matrices from wavefunction data`, 'info');
              } else {
                addLog('No matrices found in wavefunction data', 'warn');
              }
            } catch (matrixError) {
              addLog(`Warning: Failed to extract matrices: ${matrixError.message}`, 'warn');
            }

            // Find and store the FCHK file if present
            const fchkPath = Object.keys(files).find(path => path.endsWith('.owf.fchk') || path.endsWith('.fchk'));
            if (fchkPath) {
              const fchkData = files[fchkPath];
              const fchkText = new TextDecoder().decode(fchkData);
              addLog(`Found FCHK file: ${fchkPath} (${fchkData.length} bytes)`, 'info');

              // Add FCHK to wavefunction data
              if (calculationResults.wavefunctionData) {
                calculationResults.wavefunctionData.fchk = fchkText;
              }
            } else {
              addLog('Warning: No FCHK file found in output', 'warn');
            }

            // Parse optimization trajectory if present
            const trjPath = Object.keys(files).find(path => path.endsWith('_trj.xyz'));
            const optPath = Object.keys(files).find(path => path.endsWith('_opt.xyz'));

            if (trjPath && optPath) {
              addLog(`Found optimization files: ${trjPath}, ${optPath}`, 'info');

              try {
                const trjData = new TextDecoder().decode(files[trjPath]);
                const optData = new TextDecoder().decode(files[optPath]);

                // Parse trajectory XYZ file (contains all steps)
                const trjFrames = trjData.trim().split(/\n(?=\d+\n)/); // Split on lines that start with a number
                const geometries: string[] = [];
                const energies: number[] = [];
                const gradientNorms: number[] = [];

                for (const frame of trjFrames) {
                  if (!frame.trim()) continue;

                  geometries.push(frame.trim());

                  // Try to extract energy from comment line
                  const lines = frame.trim().split('\n');
                  if (lines.length >= 2) {
                    const commentLine = lines[1];
                    // Look for energy in comment (format may vary)
                    const energyMatch = commentLine.match(/energy[=:\s]+([-\d.]+)/i);
                    if (energyMatch) {
                      energies.push(parseFloat(energyMatch[1]));
                    }
                    // Look for gradient norm
                    const gradMatch = commentLine.match(/grad(?:ient)?[=:\s]+([-\d.]+)/i);
                    if (gradMatch) {
                      gradientNorms.push(parseFloat(gradMatch[1]));
                    }
                  }
                }

                calculationResults.optimization = {
                  trajectory: {
                    energies: energies.length > 0 ? energies : [energy], // Fallback to final energy
                    gradientNorms: gradientNorms,
                    geometries: geometries,
                    converged: converged,
                    steps: geometries.length,
                    finalEnergy: energy,
                    finalMolecule: null
                  },
                  finalXYZ: optData,
                  steps: geometries.length,
                  energies: energies.length > 0 ? energies : [energy],
                  gradientNorms: gradientNorms
                };

                addLog(`Parsed optimization trajectory: ${geometries.length} steps`, 'info');
              } catch (parseError) {
                addLog(`Warning: Failed to parse optimization files: ${parseError.message}`, 'warn');
              }
            }

            // Parse frequency data if present
            const freqPath = Object.keys(files).find(path => path.endsWith('_freq.json'));

            if (freqPath) {
              addLog(`Found frequency file: ${freqPath}`, 'info');

              try {
                const freqData = new TextDecoder().decode(files[freqPath]);
                const freqJson = JSON.parse(freqData);

                addLog(`Frequency JSON keys: ${Object.keys(freqJson).join(', ')}`, 'info');

                // Extract frequency data - frequencies are stored as [[f1], [f2], ...]
                const frequenciesRaw = freqJson.frequencies_cm || freqJson.sorted_frequencies_cm || [];
                const normalModesRaw = freqJson.normal_modes || [];
                const nAtoms = freqJson.n_atoms || owfJson.atoms?.length || 0;
                const nModes = freqJson.n_modes || frequenciesRaw.length;

                // Flatten frequencies from [[f1], [f2], ...] to [f1, f2, ...]
                const frequencies = frequenciesRaw.map((f: number | number[]) =>
                  Array.isArray(f) ? f[0] : f
                );

                // Normal modes matrix: Each column is one mode, serialized as array of rows
                // normalModesRaw is [ [row0...], [row1...], ... ]
                // where each row has nModes elements, and row i contains displacement i for all modes
                // We need to transpose: extract columns to get individual modes
                const normalModes: number[][] = [];
                if (Array.isArray(normalModesRaw) && normalModesRaw.length > 0 && nModes > 0) {
                  // Verify it's a 2D array (array of arrays)
                  if (Array.isArray(normalModesRaw[0])) {
                    const nRows = normalModesRaw.length; // Should be 3*nAtoms
                    const nCols = normalModesRaw[0].length; // Should be nModes

                    addLog(`Normal modes matrix: ${nRows} rows × ${nCols} cols`, 'info');

                    // Extract each column (mode)
                    for (let modeIdx = 0; modeIdx < nCols; modeIdx++) {
                      const mode: number[] = [];
                      for (let rowIdx = 0; rowIdx < nRows; rowIdx++) {
                        mode.push(normalModesRaw[rowIdx][modeIdx]);
                      }
                      normalModes.push(mode);
                    }
                  } else {
                    addLog('Warning: normal_modes is not a 2D array', 'warn');
                  }
                }

                if (frequencies.length > 0) {
                  calculationResults.frequencies = {
                    frequencies: frequencies,
                    nModes: nModes,
                    nAtoms: nAtoms,
                    summary: `${frequencies.length} vibrational modes`,
                    normalModes: normalModes
                  };

                  addLog(`Parsed ${frequencies.length} vibrational frequencies`, 'info');

                  // Log first few frequencies
                  const freqPreview = frequencies.slice(0, 5).map((f: number) =>
                    f < 0 ? `${Math.abs(f).toFixed(1)}i` : f.toFixed(1)
                  ).join(', ');
                  addLog(`First frequencies: ${freqPreview} cm⁻¹`, 'info');

                  if (normalModes.length > 0) {
                    addLog(`Parsed ${normalModes.length} normal modes (${normalModes[0].length} elements each)`, 'info');
                  } else {
                    addLog('Warning: No normal mode data found', 'warn');
                  }
                } else {
                  addLog('Warning: No frequencies found in frequency JSON', 'warn');
                }
              } catch (parseError) {
                addLog(`Warning: Failed to parse frequency file: ${parseError.message}`, 'warn');
              }
            }

            setResults(calculationResults);
            setActiveTab('results');
            addLog(`Energy: ${energy.toFixed(8)} Ha (${(energy * 27.2114).toFixed(4)} eV)`, 'info');
            addLog('Calculation completed successfully!', 'info')

          } catch (error) {
            setError(`Failed to parse results: ${error.message}`);
            addLog(`Error: ${error.message}`, 'error');
          }

          setIsCalculating(false);
          cliWorker.terminate();
          break;
      }
    };

    cliWorker.onerror = (error) => {
      setError(`CLI worker error: ${error.message}`);
      setIsCalculating(false);
      cliWorker.terminate();
    };

    // Build command arguments
    const workerData: any = {
      xyzData: currentXYZData,
      method: settings.method,
      basis: settings.basisSet,
      charge: settings.charge,
      multiplicity: settings.multiplicity,
      threads: settings.threads
    };

    // Add optimization flags if needed
    if (settings.optimize) {
      workerData.optMaxIterations = 50;
      addLog('Optimization enabled (max 50 steps)', 'info');
    }

    // Add frequency flag if needed
    if (settings.computeFrequencies && settings.optimize) {
      workerData.computeFrequencies = true;
      addLog('Frequency calculation enabled', 'info');
    }

    let cmdPreview = `occ scf input.xyz ${settings.method} ${settings.basisSet}`;
    if (settings.charge !== 0) cmdPreview += ` --charge ${settings.charge}`;
    if (settings.multiplicity !== 1) cmdPreview += ` --multiplicity ${settings.multiplicity}`;
    if (settings.optimize) cmdPreview += ` --opt-max-iterations 50`;
    if (settings.computeFrequencies && settings.optimize) cmdPreview += ` --frequencies`;
    cmdPreview += ` --threads=${settings.threads}`;
    cmdPreview += ` -o json -o fchk`;

    addLog(`Running: ${cmdPreview}`, 'info');

    cliWorker.postMessage(workerData);
  };

  const cancelCalculation = () => {
    if (worker && isCalculating) {
      worker.terminate();
      addLog('Calculation cancelled. Restarting worker...', 'warn');
      initializeWorker();
      setIsCalculating(false);
    }
  };

  const requestCubeComputation = (cubeType: string, orbitalIndex?: number, gridStepsOverride?: number, spin?: 'alpha' | 'beta') => {
    if (!wavefunctionData) {
      setError('No wavefunction data available for cube computation.');
      return;
    }

    addLog(`Requesting ${cubeType} cube via CLI...`, 'info');

    // Create CLI worker for cube generation
    const cliWorker = new Worker('/occ-cli-worker.js');

    let hasExited = false;

    cliWorker.onmessage = (e) => {
      const { type, text, code, cubeData, gridInfo, property, orbital, spin } = e.data;

      switch (type) {
        case 'output':
          addLog(`[CUBE] ${text}`, 'info');
          break;

        case 'error':
          addLog(`[CUBE ERROR] ${text}`, 'error');
          break;

        case 'exit':
          if (hasExited) return;
          hasExited = true;

          if (code !== 0 || !cubeData) {
            setError(`Cube generation failed with exit code ${code}`);
            addLog('Cube generation failed', 'error');
            cliWorker.terminate();
            return;
          }

          // Store the cube result
          const actualGridSteps = gridStepsOverride || cubeSettings.gridSteps;
          let key: string;
          if (orbitalIndex !== undefined) {
            key = spin
              ? `molecular_orbital_${orbitalIndex}_${spin}_${actualGridSteps}`
              : `molecular_orbital_${orbitalIndex}_${actualGridSteps}`;
          } else {
            key = cubeType;
          }

          setCubeResults(prev => new Map(prev.set(key, cubeData)));

          // Store grid info if available
          if (gridInfo) {
            setCubeGridInfo(gridInfo);
            addLog(`Grid info: ${gridInfo.nx}×${gridInfo.ny}×${gridInfo.nz} points`, 'info');
          }

          const spinLabel = spin ? ` (${spin})` : '';
          addLog(`Cube computation completed: ${property}${orbital !== undefined ? ` (orbital ${orbital}${spinLabel})` : ''}`, 'info');

          cliWorker.terminate();
          break;
      }
    };

    cliWorker.onerror = (error) => {
      setError(`Cube worker error: ${error.message}`);
      cliWorker.terminate();
    };

    // Map cubeType to property name
    let property = 'density';
    let orbital = null;
    let spinChannel = spin || null; // 'alpha', 'beta', or null for default

    if (cubeType === 'molecular_orbital' && orbitalIndex !== undefined) {
      property = 'density';
      // CLI uses 1-based indexing, so add 1 to our 0-based index
      orbital = (orbitalIndex + 1).toString();
    } else if (cubeType === 'electron_density') {
      property = 'density';
    } else if (cubeType === 'electric_potential') {
      property = 'esp';
    }

    // Build worker data with cube settings
    const gridSteps = gridStepsOverride || cubeSettings.gridSteps;
    const workerData: any = {
      command: 'cube',
      owfData: wavefunctionData,
      property: property,
      orbital: orbital,
      spin: spinChannel,
      gridSteps: gridSteps
    };

    // Add adaptive bounds if enabled
    if (cubeSettings.useAdaptive) {
      workerData.adaptive = true;
      workerData.bufferDistance = cubeSettings.bufferDistance;
      workerData.threshold = cubeSettings.threshold;
    }

    // Add custom origin if specified
    if (cubeSettings.customOrigin) {
      workerData.origin = cubeSettings.origin;
    }

    // Add custom directions if specified
    if (cubeSettings.customDirections) {
      workerData.directionA = cubeSettings.directionA;
      workerData.directionB = cubeSettings.directionB;
      workerData.directionC = cubeSettings.directionC;
    }

    // Build command preview for logging
    let cmdPreview = `occ cube input.owf.json ${property}`;
    if (spinChannel) cmdPreview += ` ${spinChannel}`;
    if (orbital) cmdPreview += ` --orbital ${orbital}`;
    cmdPreview += ` -n ${gridSteps}`;
    if (cubeSettings.useAdaptive) cmdPreview += ` --adaptive --buffer ${cubeSettings.bufferDistance} --threshold ${cubeSettings.threshold}`;
    if (cubeSettings.customOrigin) cmdPreview += ` --origin ${cubeSettings.origin.join(' ')}`;
    if (cubeSettings.customDirections) {
      cmdPreview += ` --da ${cubeSettings.directionA.join(' ')}`;
      cmdPreview += ` --db ${cubeSettings.directionB.join(' ')}`;
      cmdPreview += ` --dc ${cubeSettings.directionC.join(' ')}`;
    }

    addLog(`Running: ${cmdPreview}`, 'info');

    cliWorker.postMessage(workerData);
  };

  // Convert optimization trajectory to XYZ format for TrajectoryViewer
  const convertTrajectoryToXYZ = (trajectory: any): string => {
    if (!trajectory || !trajectory.geometries || !trajectory.energies) {
      return '';
    }

    const xyzFrames: string[] = [];
    
    trajectory.geometries.forEach((geometry: string, index: number) => {
      const energy = trajectory.energies[index];
      const lines = geometry.trim().split('\n');
      
      if (lines.length >= 2) {
        const numAtoms = lines[0];
        const comment = `Step ${index} Energy=${energy.toFixed(9)}`;
        const atomLines = lines.slice(2).join('\n');
        
        xyzFrames.push(`${numAtoms}\n${comment}\n${atomLines}`);
      }
    });
    
    return xyzFrames.join('\n');
  };

  // Get the appropriate XYZ data for structure display
  const getStructureXYZ = (): string => {
    // If optimization was performed and completed, use the final optimized geometry
    if (results?.optimization?.finalXYZ) {
      return results.optimization.finalXYZ;
    }
    // Otherwise, use the original input geometry
    return currentXYZData;
  };

  // Pre-compute all normal mode trajectories to avoid delays when clicking
  const precomputeNormalModeTrajectories = (calculationResults: any) => {
    if (!calculationResults.frequencies?.frequencies || !calculationResults.optimization?.finalXYZ) {
      return;
    }

    addLog('Pre-computing normal mode trajectories...', 'info');
    
    const trajectories = NormalModeTrajectory.precomputeAllTrajectories(
      calculationResults.optimization.finalXYZ,
      calculationResults.frequencies.frequencies,
      calculationResults.frequencies.normalModes || []
    );
    
    setPrecomputedTrajectories(trajectories);
    addLog(`Pre-computed ${trajectories.size} normal mode trajectories`, 'info');
  };

  // Generate normal mode trajectory by sampling along the normal mode vector
  const generateNormalModeTrajectory = (modeIndex: number): string => {
    // First check if we have a pre-computed trajectory
    const precomputed = precomputedTrajectories.get(modeIndex);
    if (precomputed) {
      return precomputed;
    }
    // Fallback to real-time generation using utility class
    if (!results?.optimization?.finalXYZ || !results?.frequencies?.frequencies) {
      return '';
    }

    const normalMode = results.frequencies.normalModes?.[modeIndex];
    const frequency = results.frequencies.frequencies[modeIndex];
    
    if (!normalMode || normalMode.length === 0) {
      return NormalModeTrajectory.createPlaceholderTrajectory(
        results.optimization.finalXYZ, 
        frequency, 
        modeIndex
      );
    }

    return NormalModeTrajectory.generateTrajectory(
      results.optimization.finalXYZ,
      normalMode,
      frequency,
      modeIndex
    );
  };

  // Get trajectory data based on current mode
  const getCurrentTrajectoryData = (): string => {
    if (trajectoryMode === 'normal_mode' && selectedNormalMode !== null) {
      return generateNormalModeTrajectory(selectedNormalMode);
    } else if (trajectoryMode === 'optimization' && results?.optimization?.trajectory) {
      return convertTrajectoryToXYZ(results.optimization.trajectory);
    }
    return '';
  };


  // Get trajectory name based on current mode
  const getCurrentTrajectoryName = (): string => {
    if (trajectoryMode === 'normal_mode' && selectedNormalMode !== null && results?.frequencies?.frequencies) {
      const freq = results.frequencies.frequencies[selectedNormalMode];
      return `Mode ${selectedNormalMode + 1}: ${Math.abs(freq).toFixed(2)} cm⁻¹`;
    } else if (trajectoryMode === 'optimization') {
      return `${moleculeInfo?.formula || 'Molecule'} Optimization`;
    }
    return 'Trajectory';
  };

  // Filter frequencies based on hideLowModes setting
  const getFilteredFrequencies = () => {
    if (!results?.frequencies?.frequencies) return [];
    
    return results.frequencies.frequencies
      .map((freq, index) => ({ freq, index }))
      .filter(({ freq }) => !hideLowModes || Math.abs(freq) >= 50);
  };

  return (
    <div className={styles.container}>
      <div className={styles.layout}>
        <div className={styles.sidebar}>
          <div className={`${styles.status} ${isWorkerReady ? styles.statusReady : styles.statusLoading}`}>
            {isWorkerReady ? '✓ Ready' : '⏳ Loading...'}
          </div>

          <div className={styles.scrollableContent}>
            <div className={styles.collapsibleSection}>
            <button 
              className={styles.sectionHeader}
              onClick={() => setIsInputExpanded(!isInputExpanded)}
            >
              <span className={styles.sectionTitle}>Molecule Input</span>
              <span className={`${styles.chevron} ${isInputExpanded ? styles.chevronExpanded : ''}`}>
                ▼
              </span>
            </button>
            {isInputExpanded && (
              <div className={styles.sectionContent}>
                <FileUploader 
              onFileLoad={handleFileLoad} 
              onValidationChange={handleValidationChange}
            />
                {moleculeInfo && (
                  <div className={styles.moleculeInfo}>
                    <div><strong>{moleculeInfo.formula}</strong> ({moleculeInfo.numAtoms} atoms)</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {currentXYZData && (
            <div className={styles.collapsibleSection}>
              <button 
                className={styles.sectionHeader}
                onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
              >
                <span className={styles.sectionTitle}>Calculation Settings</span>
                <span className={`${styles.chevron} ${isSettingsExpanded ? styles.chevronExpanded : ''}`}>
                  ▼
                </span>
              </button>
              {isSettingsExpanded && (
                <div className={styles.sectionContent}>
                  <CalculationSettings
                    settings={settings}
                    updateSettings={updateSettings}
                    showAdvancedSettings={showAdvancedSettings}
                    setShowAdvancedSettings={setShowAdvancedSettings}
                  />
                </div>
              )}
            </div>
          )}
          </div>

          {currentXYZData && (
            <div className={styles.stickyButtons}>
              <button
                className={`${styles.button} ${styles.buttonPrimary}`}
                onClick={runCalculation}
                disabled={isCalculating || !isWorkerReady || !isXYZValid}
              >
                {isCalculating ? 'Calculating...' : 'Run Calculation'}
              </button>
              {isCalculating && (
                <button
                  className={`${styles.button} ${styles.buttonDanger}`}
                  onClick={cancelCalculation}
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>

        <div className={styles.content}>
          {currentXYZData && (
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${activeTab === 'output' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('output')}
              >
                Output
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'results' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('results')}
              >
                Results
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'structure' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('structure')}
              >
                Structure
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'properties' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('properties')}
              >
                Properties
              </button>
              {results?.optimization && (
                <button
                  className={`${styles.tab} ${activeTab === 'optimization' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('optimization')}
                >
                  Optimization
                </button>
              )}
            </div>
          )}

          <div className={styles.tabContent}>
            {activeTab === 'output' && <LogOutput logs={logs} />}
            {activeTab === 'results' && <ResultsDisplay results={results} />}
            {activeTab === 'structure' && (
              <div className={styles.structureTab}>
                {currentXYZData ? (
                  <MoleculeViewer
                    xyzData={getStructureXYZ()}
                    moleculeName={`${moleculeInfo?.name || 'Molecule'}${results?.optimization ? ' (Optimized)' : ''}`}
                    wavefunctionResults={results}
                    cubeResults={cubeResults}
                    cubeGridInfo={cubeGridInfo}
                    cubeSettings={cubeSettings}
                    onRequestCubeComputation={requestCubeComputation}
                    onOpenCubeSettings={() => setShowCubeSettings(true)}
                  />
                ) : (
                  <div className={styles.noStructure}>
                    <h3>No Structure Loaded</h3>
                    <p>Load a molecule to see its 3D structure visualization.</p>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'properties' && results && (
              <div className={styles.propertiesTab}>
                {results.orbitalEnergies && (
                  <div className={styles.orbitalsCard}>
                    <h4>Orbital Energies</h4>

                    {results.orbitalEnergies.isUnrestricted ? (
                      // Unrestricted: Show alpha and beta separately
                      <>
                        <h5 style={{ marginTop: '1rem', color: '#3b82f6' }}>Alpha Orbitals (↑)</h5>
                        <div className={styles.orbitalGrid}>
                          {results.orbitalEnergies.alpha.slice(0, 10).map((energy, i) => {
                            const occupation = results.orbitalOccupations?.alpha?.[i] ?? 0;
                            const orbital = {
                              index: i,
                              energy: energy * 27.2114,
                              occupation,
                              isOccupied: occupation > 0,
                              spin: 'alpha'
                            };

                            return (
                              <OrbitalItem
                                key={`alpha-${i}`}
                                orbital={orbital}
                              />
                            );
                          })}
                        </div>
                        {results.orbitalEnergies.alpha.length > 10 && (
                          <div className={styles.moreOrbitals}>
                            ... and {results.orbitalEnergies.alpha.length - 10} more alpha orbitals
                          </div>
                        )}

                        <h5 style={{ marginTop: '1.5rem', color: '#f97316' }}>Beta Orbitals (↓)</h5>
                        <div className={styles.orbitalGrid}>
                          {results.orbitalEnergies.beta.slice(0, 10).map((energy, i) => {
                            const occupation = results.orbitalOccupations?.beta?.[i] ?? 0;
                            const orbital = {
                              index: i,
                              energy: energy * 27.2114,
                              occupation,
                              isOccupied: occupation > 0,
                              spin: 'beta'
                            };

                            return (
                              <OrbitalItem
                                key={`beta-${i}`}
                                orbital={orbital}
                              />
                            );
                          })}
                        </div>
                        {results.orbitalEnergies.beta.length > 10 && (
                          <div className={styles.moreOrbitals}>
                            ... and {results.orbitalEnergies.beta.length - 10} more beta orbitals
                          </div>
                        )}
                      </>
                    ) : (
                      // Restricted: Show combined orbitals
                      <>
                        <div className={styles.orbitalGrid}>
                          {results.orbitalEnergies.slice(0, 20).map((energy, i) => {
                            const occupation = results.orbitalOccupations?.[i] ?? 0;
                            const orbital = {
                              index: i,
                              energy: energy * 27.2114,
                              occupation,
                              isOccupied: occupation > 0
                            };

                            return (
                              <OrbitalItem
                                key={i}
                                orbital={orbital}
                              />
                            );
                          })}
                        </div>
                        {results.orbitalEnergies.length > 20 && (
                          <div className={styles.moreOrbitals}>
                            ... and {results.orbitalEnergies.length - 20} more orbitals
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {results.matrices && Object.keys(results.matrices).length > 0 ? (
                  <div className={styles.matricesSection}>
                    {Object.entries(results.matrices).map(([name, matrix]) => 
                      matrix ? (
                        <MatrixDisplay
                          key={name}
                          matrix={matrix}
                          title={`${name.charAt(0).toUpperCase()}${name.slice(1)} Matrix`}
                          precision={6}
                          maxDisplaySize={6}
                        />
                      ) : null
                    )}
                  </div>
                ) : (
                  <div className={styles.noMatrices}>
                    <p>No matrix data available. Matrices are generated during SCF calculations and may depend on the calculation method and settings.</p>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'optimization' && results?.optimization && (
              <div className={styles.optimizationTab}>
                <div className={styles.optimizationHeader}>
                  <div className={styles.optimizationSummary}>
                    <h4>Optimization Summary</h4>
                    <div className={styles.summaryGrid}>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Converged:</span>
                        <span className={`${styles.summaryValue} ${results.optimization.trajectory.converged ? styles.converged : styles.notConverged}`}>
                          {results.optimization.trajectory.converged ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Steps:</span>
                        <span className={styles.summaryValue}>{results.optimization.steps}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Final Energy:</span>
                        <span className={styles.summaryValue}>{results.energy.toFixed(8)} Ha</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Final Energy:</span>
                        <span className={styles.summaryValue}>{results.energyInEV.toFixed(4)} eV</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.optimizationLayout}>
                  {/* Left side - Trajectory Viewer */}
                  <div className={styles.trajectoryViewerSection}>
                    <div className={styles.trajectoryViewerContainer}>
                      <TrajectoryViewer
                        trajectoryData={getCurrentTrajectoryData()}
                        moleculeName={getCurrentTrajectoryName()}
                        autoPlay={trajectoryMode === 'normal_mode'}
                        initialSpeed={trajectoryMode === 'normal_mode' ? 60 : 20}
                      />
                    </div>
                  </div>

                  {/* Right side - Controls */}
                  <div className={styles.trajectoryControlsPanel}>
                    <div className={styles.trajectoryControlsHeader}>
                      <h4>Trajectory Controls</h4>
                    </div>

                    {/* Mode Selection */}
                    <div className={styles.trajectoryModeSection}>
                      <button
                        onClick={() => {
                          setTrajectoryMode('optimization');
                          setSelectedNormalMode(null);
                        }}
                        className={`${styles.modeButton} ${trajectoryMode === 'optimization' ? styles.active : ''}`}
                      >
                        Optimization Path
                      </button>
                    </div>

                    {/* Frequencies Section */}
                    {results.frequencies && results.frequencies.frequencies.length > 0 && (
                      <div className={styles.frequenciesControlSection}>
                        <div className={styles.frequenciesSectionHeader}>
                          <h5>Normal Modes</h5>
                          <div className={styles.frequencySettings}>
                            <label className={styles.checkboxLabel}>
                              <input
                                type="checkbox"
                                checked={hideLowModes}
                                onChange={(e) => {
                                  setHideLowModes(e.target.checked);
                                  // Reset selection if currently selected mode is being hidden
                                  if (e.target.checked && selectedNormalMode !== null && results.frequencies.frequencies[selectedNormalMode] && Math.abs(results.frequencies.frequencies[selectedNormalMode]) < 50) {
                                    setSelectedNormalMode(null);
                                    setTrajectoryMode('optimization');
                                  }
                                }}
                                className={styles.checkbox}
                              />
                              Hide low modes (&lt; 50 cm⁻¹)
                            </label>
                          </div>
                        </div>
                        
                        <div className={styles.modesList}>
                          {getFilteredFrequencies().map(({ freq, index }) => {
                            const isSelected = trajectoryMode === 'normal_mode' && selectedNormalMode === index;
                            return (
                              <div 
                                key={index} 
                                className={`${styles.modeItem} ${isSelected ? styles.modeSelected : ''}`}
                                onClick={() => {
                                  setTrajectoryMode('normal_mode');
                                  setSelectedNormalMode(index);
                                }}
                                style={{ cursor: 'pointer' }}
                                title={`Click to visualize mode ${index + 1}`}
                              >
                                <div className={styles.modeInfo}>
                                  <div className={styles.modeNumber}>Mode {index + 1}</div>
                                  <div className={styles.modeValue}>
                                    {freq < 0 ? `${Math.abs(freq).toFixed(1)}i` : freq.toFixed(1)} cm⁻¹
                                  </div>
                                  {freq < 0 && <div className={styles.imaginaryBadge}>imag</div>}
                                </div>
                                {isSelected && (
                                  <div className={styles.modeSelectedIndicator}>
                                    ▶ Playing
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        
                        <div className={styles.frequencySummary}>
                          Showing {getFilteredFrequencies().length} of {results.frequencies.frequencies.length} modes
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && !validationError && (
        <div className={styles.errorModal}>
          <div className={styles.errorContent}>
            <h3>Error</h3>
            <p>{error}</p>
            <button onClick={() => setError('')}>Close</button>
          </div>
        </div>
      )}

      <CubeSettings
        settings={cubeSettings}
        updateSettings={updateCubeSettings}
        show={showCubeSettings}
        onClose={() => setShowCubeSettings(false)}
      />
    </div>
  );
};

export default WavefunctionCalculator;