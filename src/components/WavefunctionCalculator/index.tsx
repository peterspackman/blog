import React, { useState, useEffect, useRef } from 'react';
import styles from './WavefunctionCalculator.module.css';
import FileUploader from './FileUploader';
import CalculationSettings from './CalculationSettings';
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
  };
  wavefunctionData?: {
    fchk?: string;
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
  orbitalEnergies?: number[];
  orbitalOccupations?: number[];
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
  
  // Collapsible sections state
  const [isInputExpanded, setIsInputExpanded] = useState(true);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(true);

  // Calculation settings
  const [method, setMethod] = useState('hf');
  const [basisSet, setBasisSet] = useState('3-21g');
  const [maxIterations, setMaxIterations] = useState(100);
  const [energyTolerance, setEnergyTolerance] = useState(1e-8);
  const [logLevel, setLogLevel] = useState(2);
  const [optimize, setOptimize] = useState(false);
  const [computeFrequencies, setComputeFrequencies] = useState(false);
  const [charge, setCharge] = useState(0);
  const [threads, setThreads] = useState(4);
  
  // Handle optimization toggle - turn off frequencies when optimization is disabled
  const handleOptimizeChange = (enabled: boolean) => {
    setOptimize(enabled);
    if (!enabled) {
      setComputeFrequencies(false);
    }
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
        new URL('./wavefunction-worker.js', import.meta.url),
        { type: 'module' }
      );

      newWorker.onmessage = handleWorkerMessage;
      newWorker.onerror = (error) => {
        console.error('Worker error:', error);
        setError('Worker error: ' + error.message);
        setIsWorkerReady(false);
      };

      setWorker(newWorker);

      // Initialize OCC in worker
      newWorker.postMessage({
        type: 'init',
        data: {}
      });
      
      // Send warmup request after initialization
      setTimeout(() => {
        if (newWorker) {
          newWorker.postMessage({
            type: 'warmup',
            data: {}
          });
        }
      }, 100);
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
      const key = data.cubeType === 'molecular_orbital' 
        ? `${data.cubeType}_${data.orbitalIndex}_${data.gridSteps || 40}` 
        : data.cubeType;
      
      setCubeResults(prev => new Map(prev.set(key, data.cubeData)));
      
      // Store grid info if available
      if (data.gridInfo) {
        setCubeGridInfo(data.gridInfo);
      }
      
      addLog(`Cube computation completed: ${data.cubeType}${data.orbitalIndex !== undefined ? ` (orbital ${data.orbitalIndex})` : ''} [${data.gridSteps || 40} steps]`, 'info');
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

    if (!worker || !isWorkerReady) {
      setError('Web Worker not ready.');
      return;
    }

    // Clear previous results and trajectories
    setResults(null);
    setLogs([]);
    setActiveTab('output');
    setIsCalculating(true);
    setPrecomputedTrajectories(new Map()); // Clear trajectory cache

    // Set log level
    worker.postMessage({
      type: 'setLogLevel',
      data: { level: logLevel }
    });

    // Send calculation request
    const params = {
      xyzData: currentXYZData,
      method,
      basisSet,
      maxIterations,
      energyTolerance,
      optimize,
      computeFrequencies,
      charge,
      threads
    };

    addLog('Starting calculation...', 'info');
    worker.postMessage({
      type: 'calculate',
      data: params
    });
  };

  const cancelCalculation = () => {
    if (worker && isCalculating) {
      worker.terminate();
      addLog('Calculation cancelled. Restarting worker...', 'warn');
      initializeWorker();
      setIsCalculating(false);
    }
  };

  const requestCubeComputation = (cubeType: string, orbitalIndex?: number, gridSteps?: number) => {
    if (!worker || !isWorkerReady) {
      setError('Web Worker not ready for cube computation.');
      return;
    }

    if (!results || !results.wavefunctionData) {
      setError('No wavefunction data available for cube computation.');
      return;
    }

    addLog(`Requesting ${cubeType} cube computation...`, 'info');
    
    worker.postMessage({
      type: 'computeCube',
      data: {
        cubeType,
        orbitalIndex,
        gridSteps: gridSteps || 40
      }
    });
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
                    method={method}
                    setMethod={setMethod}
                    basisSet={basisSet}
                    setBasisSet={setBasisSet}
                    maxIterations={maxIterations}
                    setMaxIterations={setMaxIterations}
                    energyTolerance={energyTolerance}
                    setEnergyTolerance={setEnergyTolerance}
                    logLevel={logLevel}
                    setLogLevel={setLogLevel}
                    optimize={optimize}
                    setOptimize={handleOptimizeChange}
                    computeFrequencies={computeFrequencies}
                    setComputeFrequencies={setComputeFrequencies}
                    charge={charge}
                    setCharge={setCharge}
                    threads={threads}
                    setThreads={setThreads}
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
                    onRequestCubeComputation={requestCubeComputation}
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
                {results.orbitalEnergies && results.orbitalEnergies.length > 0 && (
                  <div className={styles.orbitalsCard}>
                    <h4>Orbital Energies</h4>
                    <div className={styles.orbitalGrid}>
                      {results.orbitalEnergies.slice(0, 20).map((energy, i) => {
                        const occupation = results.orbitalOccupations?.[i] ?? 0;
                        const isOccupied = occupation > 0;
                        const orbital = {
                          index: i,
                          energy: energy * 27.2114, // Convert to eV for the component
                          occupation,
                          isOccupied
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
    </div>
  );
};

export default WavefunctionCalculator;