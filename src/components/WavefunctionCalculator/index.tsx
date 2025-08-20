import React, { useState, useEffect, useRef } from 'react';
import styles from './WavefunctionCalculator.module.css';
import FileUploader from './FileUploader';
import CalculationSettings from './CalculationSettings';
import ResultsDisplay from './ResultsDisplay';
import LogOutput from './LogOutput';
import MatrixDisplay from './MatrixDisplay';
import MoleculeViewer from './MoleculeViewer';
import OrbitalItem from './OrbitalItem';

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
  const [activeTab, setActiveTab] = useState<'output' | 'results' | 'structure' | 'properties'>('structure');
  const [error, setError] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
  const [cubeResults, setCubeResults] = useState<Map<string, string>>(new Map());
  const [cubeGridInfo, setCubeGridInfo] = useState<any>(null);
  const [isXYZValid, setIsXYZValid] = useState<boolean>(true);
  
  // Collapsible sections state
  const [isInputExpanded, setIsInputExpanded] = useState(true);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(true);

  // Calculation settings
  const [method, setMethod] = useState('dft-wb97x');
  const [basisSet, setBasisSet] = useState('6-31g(d,p)');
  const [maxIterations, setMaxIterations] = useState(100);
  const [energyTolerance, setEnergyTolerance] = useState(1e-8);
  const [logLevel, setLogLevel] = useState(2);

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

    // Clear previous results
    setResults(null);
    setLogs([]);
    setActiveTab('output');
    setIsCalculating(true);

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
      energyTolerance
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

  return (
    <div className={styles.container}>
      <div className={styles.layout}>
        <div className={styles.sidebar}>
          <div className={`${styles.status} ${isWorkerReady ? styles.statusReady : styles.statusLoading}`}>
            {isWorkerReady ? '✓ Ready' : '⏳ Loading...'}
          </div>

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
                  />
                </div>
              )}
            </div>
          )}

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
            </div>
          )}

          <div className={styles.tabContent}>
            {activeTab === 'output' && <LogOutput logs={logs} />}
            {activeTab === 'results' && <ResultsDisplay results={results} />}
            {activeTab === 'structure' && (
              <div className={styles.structureTab}>
                {currentXYZData ? (
                  <MoleculeViewer 
                    xyzData={currentXYZData} 
                    moleculeName={moleculeInfo?.name || 'Molecule'}
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