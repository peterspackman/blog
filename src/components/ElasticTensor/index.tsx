import React, { useState, useEffect, useRef } from 'react';
import 'echarts-gl';
import styles from './ElasticTensor.module.css';
import { 
  AnalysisResult, 
  DirectionalData, 
  SurfaceData, 
  ElasticProperties,
  getPropertyTitle,
  getPropertyUnit,
  calculateDirectionalDifferences,
  getDifferenceColor,
  getDifferenceSign,
  copyTableToClipboard,
  TENSOR_COLORS,
  getTensorColor
} from './CommonFunctions';
import { DirectionalChart } from './DirectionalChart';
import { PolarChart } from './PolarChart';
import { SurfaceChart } from './SurfaceChart';
import { DualMatrixChart } from './DualMatrixChart';


export const ElasticTensor: React.FC = () => {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [tensorInput, setTensorInput] = useState<string>('');
  const [tensorData, setTensorData] = useState<number[][] | null>(null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<string>('youngs');
  const [selectedPlane, setSelectedPlane] = useState<string>('xy');
  const [directionalData, setDirectionalData] = useState<{ [key: string]: DirectionalData[] }>({});
  const [surfaceData, setSurfaceData] = useState<SurfaceData | null>(null);
  const [show3D, setShow3D] = useState<boolean>(false);
  const [use3DScatter, setUse3DScatter] = useState<boolean>(true);
  const [comparisonMode, setComparisonMode] = useState<boolean>(false);
  const [referenceTensorInput, setReferenceTensorInput] = useState<string>('');
  const [referenceTensorData, setReferenceTensorData] = useState<number[][] | null>(null);
  const referenceTensorRef = useRef<number[][] | null>(null);
  const [referenceAnalysisResults, setReferenceAnalysisResults] = useState<AnalysisResult | null>(null);
  const [referenceDirectionalData, setReferenceDirectionalData] = useState<{ [key: string]: DirectionalData[] }>({});
  const [referenceSurfaceData, setReferenceSurfaceData] = useState<SurfaceData | null>(null);
  const [analysisCount, setAnalysisCount] = useState<number>(0);
  const [isProcessingReference, setIsProcessingReference] = useState<boolean>(false);
  const processingRefRef = useRef<boolean>(false);
  const [showDifference, setShowDifference] = useState<boolean>(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string>('');
  const [logs, setLogs] = useState<Array<{ message: string; level: string; timestamp: Date }>>([]);
  const [tensorName, setTensorName] = useState<string>('');
  const [referenceTensorName, setReferenceTensorName] = useState<string>('');
  const [savedTensors, setSavedTensors] = useState<Array<{ name: string; data: string; timestamp: Date }>>([]);
  const [showLoadDropdown, setShowLoadDropdown] = useState<boolean>(false);
  const [showReferenceLoadDropdown, setShowReferenceLoadDropdown] = useState<boolean>(false);

  // Initialize worker on mount and load saved tensors
  useEffect(() => {
    initializeWorker();
    loadSavedTensors();
    return () => {
      if (worker) {
        worker.terminate();
      }
    };
  }, []);

  const initializeWorker = async () => {
    try {
      const newWorker = new Worker(
        new URL('./elastic-worker.js', import.meta.url),
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

      case 'analysisResult':
        if (data.success) {
          if (processingRefRef.current) {
            // This is the reference tensor result
            setReferenceAnalysisResults(data.data);
            setIsProcessingReference(false);
            processingRefRef.current = false;

            // Now that we have both tensors analyzed, generate directional data for both
            setTimeout(() => generateDirectionalDataForBoth(), 100);
            setIsCalculating(false);
          } else {
            // This is the test tensor result
            setAnalysisResults(data.data);

            // If not in comparison mode, generate data immediately
            if (!comparisonMode) {
              setTimeout(() => generateDirectionalDataForBoth(), 100);
              setIsCalculating(false);
            }
            // If in comparison mode, wait for reference analysis to complete
          }
        } else {
          setError('Analysis failed: ' + data.error);
          setIsCalculating(false);
        }
        break;

      case 'directionalDataResult':
        if (data.success) {
          if (data.isReference) {
            setReferenceDirectionalData(prev => ({
              ...prev,
              [data.plane]: data.data
            }));
          } else {
            setDirectionalData(prev => ({
              ...prev,
              [data.plane]: data.data
            }));
          }
        } else {
          setError('Directional data generation failed: ' + data.error);
        }
        break;

      case '3DSurfaceResult':
        if (data.success) {
          if (data.isReference) {
            setReferenceSurfaceData(data.data);
          } else {
            setSurfaceData(data.data);
          }
        } else {
          setError('3D surface generation failed: ' + data.error);
        }
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
        return 'warning';
      case 4:
      default:
        return 'error';
    }
  };

  const addLog = (message: string, level: string) => {
    setLogs(prev => [...prev, { message, level, timestamp: new Date() }]);
  };

  // localStorage functions
  const loadSavedTensors = () => {
    try {
      const saved = localStorage.getItem('elasticTensors');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Convert timestamp strings back to Date objects
        const tensors = parsed.map((t: any) => ({
          ...t,
          timestamp: new Date(t.timestamp)
        }));
        setSavedTensors(tensors);
      }
    } catch (error) {
      console.error('Failed to load saved tensors:', error);
    }
  };

  const saveTensor = (name: string, data: string) => {
    if (!name.trim() || !data.trim()) return;

    try {
      const newTensor = {
        name: name.trim(),
        data: data.trim(),
        timestamp: new Date()
      };

      const updatedTensors = [newTensor, ...savedTensors.filter(t => t.name !== name.trim())];
      setSavedTensors(updatedTensors);
      localStorage.setItem('elasticTensors', JSON.stringify(updatedTensors));
      addLog(`Saved tensor: ${name}`, 'info');
    } catch (error) {
      console.error('Failed to save tensor:', error);
      setError('Failed to save tensor to localStorage');
    }
  };

  const deleteTensor = (name: string) => {
    try {
      const updatedTensors = savedTensors.filter(t => t.name !== name);
      setSavedTensors(updatedTensors);
      localStorage.setItem('elasticTensors', JSON.stringify(updatedTensors));
      addLog(`Deleted tensor: ${name}`, 'info');
    } catch (error) {
      console.error('Failed to delete tensor:', error);
    }
  };

  const loadTensor = (name: string, isReference: boolean = false) => {
    const tensor = savedTensors.find(t => t.name === name);
    if (tensor) {
      if (isReference) {
        setReferenceTensorInput(tensor.data);
        setReferenceTensorName(name);
      } else {
        setTensorInput(tensor.data);
        setTensorName(name);
      }
      addLog(`Loaded tensor: ${name}`, 'info');
    }
  };

  // Helper functions to get display names
  const getTestTensorName = () => tensorName.trim() || 'Test Tensor';
  const getReferenceTensorName = () => referenceTensorName.trim() || 'Reference Tensor';
  const getDifferenceName = () => {
    const testName = getTestTensorName();
    const refName = getReferenceTensorName();
    if (testName === 'Test Tensor' || refName === 'Reference Tensor') {
      return 'Difference (Test - Reference)';
    }
    return `Difference (${testName} - ${refName})`;
  };

  const generateDirectionalDataForBoth = () => {
    if (!worker || !isWorkerReady) return;

    // Generate for test tensor
    if (tensorData) {
      ['xy', 'xz', 'yz'].forEach(plane => {
        worker.postMessage({
          type: 'generateDirectionalData',
          data: {
            tensorData,
            property: selectedProperty,
            plane: plane,
            numPoints: 180,
            isReference: false
          }
        });
      });

      worker.postMessage({
        type: 'generate3DSurfaceData',
        data: {
          tensorData,
          property: selectedProperty,
          isReference: false
        }
      });
    }

    // Generate for reference tensor if in comparison mode
    if (comparisonMode && referenceTensorRef.current) {
      ['xy', 'xz', 'yz'].forEach(plane => {
        worker.postMessage({
          type: 'generateDirectionalData',
          data: {
            tensorData: referenceTensorRef.current,
            property: selectedProperty,
            plane: plane,
            numPoints: 180,
            isReference: true
          }
        });
      });

      worker.postMessage({
        type: 'generate3DSurfaceData',
        data: {
          tensorData: referenceTensorRef.current,
          property: selectedProperty,
          isReference: true
        }
      });
    }
  };

  const parseTensorInput = (input: string): number[][] => {
    const lines = input.trim().split('\n').filter(line => line.trim());
    if (lines.length !== 6) {
      throw new Error('Elastic tensor must have exactly 6 rows');
    }

    const matrix: number[][] = [];

    for (let i = 0; i < lines.length; i++) {
      const values = lines[i].trim().split(/\s+/).map(parseFloat);

      if (values.some(isNaN)) {
        throw new Error('All values must be valid numbers');
      }

      matrix.push(values);
    }

    const isUpperTriangular = matrix.every((row, i) => row.length === 6 - i);
    const isFullMatrix = matrix.every(row => row.length === 6);

    if (!isUpperTriangular && !isFullMatrix) {
      throw new Error('Matrix must be either full 6x6 or upper triangular format');
    }

    if (isUpperTriangular) {
      const fullMatrix = Array(6).fill(0).map(() => Array(6).fill(0));

      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < matrix[i].length; j++) {
          const value = matrix[i][j];
          const colIndex = i + j;
          fullMatrix[i][colIndex] = value;
          fullMatrix[colIndex][i] = value;
        }
      }

      return fullMatrix;
    }

    return matrix;
  };

  const analyzeTensor = () => {
    if (!isWorkerReady) {
      setError('Worker not ready. Please wait for initialization.');
      return;
    }

    try {
      setError('');
      setLogs([]);
      const matrix1 = parseTensorInput(tensorInput);
      setTensorData(matrix1);
      setIsCalculating(true);

      if (comparisonMode && referenceTensorInput.trim()) {
        // Parse reference tensor for comparison
        const referenceMatrix = parseTensorInput(referenceTensorInput);
        setReferenceTensorData(referenceMatrix);
        referenceTensorRef.current = referenceMatrix;

        // First analyze the test tensor
        worker?.postMessage({
          type: 'analyzeTensor',
          data: {
            tensorData: matrix1
          }
        });

        // Then analyze the reference tensor after a delay
        setTimeout(() => {
          setIsProcessingReference(true);
          processingRefRef.current = true;
          worker?.postMessage({
            type: 'analyzeTensor',
            data: {
              tensorData: referenceMatrix
            }
          });
        }, 100);
      } else {
        // Single tensor analysis
        setReferenceTensorData(null);
        setReferenceAnalysisResults(null);
        referenceTensorRef.current = null;

        worker?.postMessage({
          type: 'analyzeTensor',
          data: {
            tensorData: matrix1
          }
        });
      }
    } catch (err) {
      setError((err as Error).message);
      setTensorData(null);
      setAnalysisResults(null);
      setReferenceTensorData(null);
      setReferenceAnalysisResults(null);
    }
  };

  // Reset difference view when comparison mode changes
  useEffect(() => {
    setShowDifference(false); // Start with overlay mode when comparison mode is enabled
  }, [comparisonMode]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Don't close if clicking on the button or dropdown itself
      if (!target.closest('.loadDropdownContainer')) {
        setShowLoadDropdown(false);
        setShowReferenceLoadDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Update directional data when property changes
  useEffect(() => {
    if (tensorData && isWorkerReady) {
      // Clear existing data and regenerate for all planes
      setDirectionalData({});
      setReferenceDirectionalData({});
      setSurfaceData(null);
      setReferenceSurfaceData(null);

      // Generate for both tensors
      generateDirectionalDataForBoth();
    }
  }, [selectedProperty, tensorData, isWorkerReady, comparisonMode]);

  const loadExampleTensor = (example: string) => {
    if (example === 'silicon') {
      const data = `166  64  64   0   0   0
 64 166  64   0   0   0
 64  64 166   0   0   0
  0   0   0  80   0   0
  0   0   0   0  80   0
  0   0   0   0   0  80`;
      setTensorInput(data);
      setTensorName('Silicon');
    } else if (example === 'quartz') {
      const data = `48.137 11.411 12.783  0.000 -3.654  0.000
11.411 34.968 14.749  0.000 -0.094  0.000
12.783 14.749 26.015  0.000 -4.528  0.000
 0.000  0.000  0.000 14.545  0.000  0.006
-3.654 -0.094 -4.528  0.000 10.771  0.000
 0.000  0.000  0.000  0.006  0.000 11.947`;
      setTensorInput(data);
      setTensorName('Quartz');
    }
  };

  const loadExampleReferenceTensor = (example: string) => {
    if (example === 'silicon') {
      const data = `166  64  64   0   0   0
 64 166  64   0   0   0
 64  64 166   0   0   0
  0   0   0  80   0   0
  0   0   0   0  80   0
  0   0   0   0   0  80`;
      setReferenceTensorInput(data);
      setReferenceTensorName('Silicon');
    } else if (example === 'quartz') {
      const data = `48.137 11.411 12.783  0.000 -3.654  0.000
11.411 34.968 14.749  0.000 -0.094  0.000
12.783 14.749 26.015  0.000 -4.528  0.000
 0.000  0.000  0.000 14.545  0.000  0.006
-3.654 -0.094 -4.528  0.000 10.771  0.000
 0.000  0.000  0.000  0.006  0.000 11.947`;
      setReferenceTensorInput(data);
      setReferenceTensorName('Quartz');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.mainGrid}>
        {/* Left Column - Input */}
        <div className={styles.inputColumn}>
          <div className={styles.inputSection}>
            <div className={styles.header}>
              <h3>{comparisonMode ? 'Primary Tensor Input' : 'Elastic Tensor Input'}</h3>
              <div className={styles.workerStatus}>
                <span className={`${styles.statusIndicator} ${isWorkerReady ? styles.ready : styles.loading}`}>
                  {isWorkerReady ? '●' : '○'}
                </span>
                {isWorkerReady ? 'Ready' : 'Loading...'}
              </div>
            </div>

            <div className={styles.modeToggle}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={comparisonMode}
                  onChange={(e) => setComparisonMode(e.target.checked)}
                  className={styles.checkbox}
                />
                Comparison Mode
              </label>
            </div>

            <input
              type="text"
              value={tensorName}
              onChange={(e) => setTensorName(e.target.value)}
              placeholder="Tensor name (e.g., 'Silicon_modified')"
              className={styles.tensorNameInput}
            />

            <div className={styles.tensorActions}>
              <div style={{ position: 'relative', flex: 1 }} className="loadDropdownContainer">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowLoadDropdown(!showLoadDropdown);
                  }}
                  className={styles.loadButton}
                  style={{ width: '100%' }}
                >
                  Load Tensor ({savedTensors.length + 2}) ▼
                </button>
                {showLoadDropdown && (
                  <div className={styles.loadDropdown}>
                    {/* Example tensors section */}
                    <div style={{ borderBottom: '1px solid var(--ifm-color-emphasis-300)', paddingBottom: '0.25rem', marginBottom: '0.25rem' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--ifm-color-emphasis-600)', padding: '0.15rem 0.5rem', fontWeight: '600' }}>Example Tensors</div>
                      <div
                        className={styles.loadDropdownItem}
                        onClick={() => {
                          loadExampleTensor('silicon');
                          setShowLoadDropdown(false);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className={styles.tensorInfo}>
                          <div>Silicon</div>
                          <div className={styles.tensorTimestamp}>Cubic crystal example</div>
                        </div>
                      </div>
                      <div
                        className={styles.loadDropdownItem}
                        onClick={() => {
                          loadExampleTensor('quartz');
                          setShowLoadDropdown(false);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className={styles.tensorInfo}>
                          <div>Quartz</div>
                          <div className={styles.tensorTimestamp}>Trigonal crystal example</div>
                        </div>
                      </div>
                    </div>
                    {/* Saved tensors section */}
                    {savedTensors.length > 0 && (
                      <>
                        <div style={{ fontSize: '0.7rem', color: 'var(--ifm-color-emphasis-600)', padding: '0.15rem 0.5rem', fontWeight: '600' }}>Saved Tensors</div>
                        {savedTensors.map((tensor) => (
                          <div
                            key={tensor.name}
                            className={styles.loadDropdownItem}
                            onClick={() => {
                              loadTensor(tensor.name, false);
                              setShowLoadDropdown(false);
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className={styles.tensorInfo}>
                              <div>{tensor.name}</div>
                              <div className={styles.tensorTimestamp}>
                                {tensor.timestamp.toLocaleDateString()} {tensor.timestamp.toLocaleTimeString()}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteTensor(tensor.name);
                              }}
                              className={styles.deleteButton}
                              title="Delete tensor"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => saveTensor(tensorName, tensorInput)}
                disabled={!tensorName.trim() || !tensorInput.trim()}
                className={styles.saveButton}
                style={{ flex: 1 }}
              >
                Save Tensor
              </button>
            </div>

            <textarea
              value={tensorInput}
              onChange={(e) => setTensorInput(e.target.value)}
              placeholder="6x6 elastic stiffness matrix (GPa)..."
              rows={6}
              className={styles.tensorInput}
            />

            {comparisonMode && (
              <>
                <div className={styles.header} style={{ marginTop: '1rem' }}>
                  <h3>Comparison Tensor Input</h3>
                </div>

                <input
                  type="text"
                  value={referenceTensorName}
                  onChange={(e) => setReferenceTensorName(e.target.value)}
                  placeholder="Reference tensor name"
                  className={styles.tensorNameInput}
                />

                <div className={styles.tensorActions}>
                  <div style={{ position: 'relative', flex: 1 }} className="loadDropdownContainer">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowReferenceLoadDropdown(!showReferenceLoadDropdown);
                      }}
                      className={styles.loadButton}
                      style={{ width: '100%' }}
                    >
                      Load Tensor ({savedTensors.length + 2}) ▼
                    </button>
                    {showReferenceLoadDropdown && (
                      <div className={styles.loadDropdown}>
                        {/* Example tensors section */}
                        <div style={{ borderBottom: '1px solid var(--ifm-color-emphasis-300)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--ifm-color-emphasis-600)', padding: '0.25rem 0.5rem' }}>Example Tensors</div>
                          <div
                            className={styles.loadDropdownItem}
                            onClick={() => {
                              loadExampleReferenceTensor('silicon');
                              setShowReferenceLoadDropdown(false);
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className={styles.tensorInfo}>
                              <div>Silicon</div>
                              <div className={styles.tensorTimestamp}>Cubic crystal example</div>
                            </div>
                          </div>
                          <div
                            className={styles.loadDropdownItem}
                            onClick={() => {
                              loadExampleReferenceTensor('quartz');
                              setShowReferenceLoadDropdown(false);
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className={styles.tensorInfo}>
                              <div>Quartz</div>
                              <div className={styles.tensorTimestamp}>Trigonal crystal example</div>
                            </div>
                          </div>
                        </div>
                        {/* Saved tensors section */}
                        {savedTensors.length > 0 && (
                          <>
                            <div style={{ fontSize: '0.7rem', color: 'var(--ifm-color-emphasis-600)', padding: '0.15rem 0.5rem', fontWeight: '600' }}>Saved Tensors</div>
                            {savedTensors.map((tensor) => (
                              <div
                                key={tensor.name}
                                className={styles.loadDropdownItem}
                                onClick={() => {
                                  loadTensor(tensor.name, true);
                                  setShowReferenceLoadDropdown(false);
                                }}
                                style={{ cursor: 'pointer' }}
                              >
                                <div className={styles.tensorInfo}>
                                  <div>{tensor.name}</div>
                                  <div className={styles.tensorTimestamp}>
                                    {tensor.timestamp.toLocaleDateString()} {tensor.timestamp.toLocaleTimeString()}
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteTensor(tensor.name);
                                  }}
                                  className={styles.deleteButton}
                                  title="Delete tensor"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => saveTensor(referenceTensorName, referenceTensorInput)}
                    disabled={!referenceTensorName.trim() || !referenceTensorInput.trim()}
                    className={styles.saveButton}
                    style={{ flex: 1 }}
                  >
                    Save Tensor
                  </button>
                </div>

                <textarea
                  value={referenceTensorInput}
                  onChange={(e) => setReferenceTensorInput(e.target.value)}
                  placeholder="6x6 reference elastic stiffness matrix for comparison (GPa)..."
                  rows={6}
                  className={styles.tensorInput}
                />
              </>
            )}

            <button
              onClick={analyzeTensor}
              disabled={!isWorkerReady || isCalculating}
              className={styles.analyzeButton}
            >
              {isCalculating ? 'Analyzing...' : 'Analyze'}
            </button>

            {error && <div className={styles.errorMessage}>{error}</div>}

            {logs.length > 0 && (
              <div className={styles.logOutput}>
                <div className={styles.logEntries}>
                  {logs.slice(-3).map((log, index) => (
                    <div key={index} className={`${styles.logEntry} ${styles[log.level]}`}>
                      <span className={styles.message}>{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Results */}
        <div className={styles.resultsColumn}>
          {analysisResults && (
            <>
              {/* Positive Definiteness Error */}
              {analysisResults.eigenvalues && !analysisResults.isPositiveDefinite && (
                <div className={styles.errorBanner} style={{
                  backgroundColor: '#f8d7da',
                  border: '1px solid #f5c6cb',
                  borderLeft: '4px solid #dc3545',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc3545" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <div>
                    <strong style={{ color: '#721c24' }}>Error: Tensor Not Positive Definite</strong>
                    <div style={{ fontSize: '0.9em', color: '#721c24', marginTop: '4px' }}>
                      This elastic tensor has {analysisResults.eigenvalues.filter(val => val <= 0).length} non-positive eigenvalue(s),
                      indicating this is not a stable minimum. The calculated properties and visualizations are not physically meaningful.
                    </div>
                  </div>
                </div>
              )}

              {/* Eigenvalue Error Warning */}
              {analysisResults.eigenvalueError && (
                <div className={styles.warningBanner} style={{
                  backgroundColor: '#f8d7da',
                  border: '1px solid #f5c6cb',
                  borderLeft: '4px solid #dc3545',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc3545" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <div>
                    <strong style={{ color: '#721c24' }}>Error: Cannot Calculate Eigenvalues</strong>
                    <div style={{ fontSize: '0.9em', color: '#721c24', marginTop: '4px' }}>
                      {analysisResults.eigenvalueError}
                    </div>
                  </div>
                </div>
              )}

              {/* Tables Section */}
              <div className={styles.tablesGrid}>
                <div className={styles.tableCell}>
                  <h3>
                    {comparisonMode && referenceAnalysisResults ? 'Comparison - Average Properties' : 'Average Properties'}
                    {comparisonMode && !referenceAnalysisResults && ' (Processing Reference...)'}
                    {comparisonMode && referenceAnalysisResults && ' ✓'}
                    {comparisonMode && referenceAnalysisResults && (
                      <span style={{ fontSize: '0.7em', marginLeft: '1rem', color: 'var(--ifm-color-emphasis-600)' }}>
                        Ref Data: {Object.keys(referenceDirectionalData).join(', ') || 'None'}
                      </span>
                    )}
                    <button
                      onClick={() => copyTableToClipboard('averages', analysisResults)}
                      className={styles.copyButton}
                      title="Copy table to clipboard"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="m5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                  </h3>
                  <table className={styles.propertiesTable}>
                    <thead>
                      <tr>
                        <th>Averaging scheme</th>
                        <th>Bulk modulus (GPa)</th>
                        <th>Young's modulus (GPa)</th>
                        <th>Shear modulus (GPa)</th>
                        <th>Poisson's ratio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonMode && referenceAnalysisResults ? (
                        <>
                          <tr>
                            <td>Voigt</td>
                            <td>
                              <div>
                                <span className={styles.testTensorText}>{analysisResults.properties.bulkModulus.voigt.toFixed(3)}</span>
                                <span className={styles.referenceTensorText}>
                                  ({referenceAnalysisResults.properties.bulkModulus.voigt.toFixed(3)})
                                </span>
                              </div>
                              <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.bulkModulus.voigt - referenceAnalysisResults.properties.bulkModulus.voigt) }}>
                                {getDifferenceSign(analysisResults.properties.bulkModulus.voigt - referenceAnalysisResults.properties.bulkModulus.voigt)}{Math.abs(analysisResults.properties.bulkModulus.voigt - referenceAnalysisResults.properties.bulkModulus.voigt).toFixed(3)}
                              </div>
                            </td>
                            <td>
                              <div>
                                <span className={styles.testTensorText}>{analysisResults.properties.youngsModulus.voigt.toFixed(3)}</span>
                                <span className={styles.referenceTensorText}>
                                  ({referenceAnalysisResults.properties.youngsModulus.voigt.toFixed(3)})
                                </span>
                              </div>
                              <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.youngsModulus.voigt - referenceAnalysisResults.properties.youngsModulus.voigt) }}>
                                ({getDifferenceSign(analysisResults.properties.youngsModulus.voigt - referenceAnalysisResults.properties.youngsModulus.voigt)}{Math.abs(analysisResults.properties.youngsModulus.voigt - referenceAnalysisResults.properties.youngsModulus.voigt).toFixed(3)})
                              </div>
                            </td>
                            <td>
                              <div>
                                <span className={styles.testTensorText}>{analysisResults.properties.shearModulus.voigt.toFixed(3)}</span>
                                <span className={styles.referenceTensorText}>
                                  ({referenceAnalysisResults.properties.shearModulus.voigt.toFixed(3)})
                                </span>
                              </div>
                              <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.shearModulus.voigt - referenceAnalysisResults.properties.shearModulus.voigt) }}>
                                ({getDifferenceSign(analysisResults.properties.shearModulus.voigt - referenceAnalysisResults.properties.shearModulus.voigt)}{Math.abs(analysisResults.properties.shearModulus.voigt - referenceAnalysisResults.properties.shearModulus.voigt).toFixed(3)})
                              </div>
                            </td>
                            <td>
                              <div>
                                <span className={styles.testTensorText}>{analysisResults.properties.poissonRatio.voigt.toFixed(5)}</span>
                                <span className={styles.referenceTensorText}>
                                  ({referenceAnalysisResults.properties.poissonRatio.voigt.toFixed(5)})
                                </span>
                              </div>
                              <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.poissonRatio.voigt - referenceAnalysisResults.properties.poissonRatio.voigt) }}>
                                ({getDifferenceSign(analysisResults.properties.poissonRatio.voigt - referenceAnalysisResults.properties.poissonRatio.voigt)}{Math.abs(analysisResults.properties.poissonRatio.voigt - referenceAnalysisResults.properties.poissonRatio.voigt).toFixed(5)})
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td>Reuss</td>
                            <td>
                              <div>
                                <span className={styles.testTensorText}>{analysisResults.properties.bulkModulus.reuss.toFixed(3)}</span>
                                <span className={styles.referenceTensorText}>
                                  ({referenceAnalysisResults.properties.bulkModulus.reuss.toFixed(3)})
                                </span>
                              </div>
                              <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.bulkModulus.reuss - referenceAnalysisResults.properties.bulkModulus.reuss) }}>
                                ({getDifferenceSign(analysisResults.properties.bulkModulus.reuss - referenceAnalysisResults.properties.bulkModulus.reuss)}{Math.abs(analysisResults.properties.bulkModulus.reuss - referenceAnalysisResults.properties.bulkModulus.reuss).toFixed(3)})
                              </div>
                            </td>
                            <td>
                              <div>
                                <span className={styles.testTensorText}>{analysisResults.properties.youngsModulus.reuss.toFixed(3)}</span>
                                <span className={styles.referenceTensorText}>
                                  ({referenceAnalysisResults.properties.youngsModulus.reuss.toFixed(3)})
                                </span>
                              </div>
                              <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.youngsModulus.reuss - referenceAnalysisResults.properties.youngsModulus.reuss) }}>
                                ({getDifferenceSign(analysisResults.properties.youngsModulus.reuss - referenceAnalysisResults.properties.youngsModulus.reuss)}{Math.abs(analysisResults.properties.youngsModulus.reuss - referenceAnalysisResults.properties.youngsModulus.reuss).toFixed(3)})
                              </div>
                            </td>
                            <td>
                              <div>
                                <span className={styles.testTensorText}>{analysisResults.properties.shearModulus.reuss.toFixed(3)}</span>
                                <span className={styles.referenceTensorText}>
                                  ({referenceAnalysisResults.properties.shearModulus.reuss.toFixed(3)})
                                </span>
                              </div>
                              <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.shearModulus.reuss - referenceAnalysisResults.properties.shearModulus.reuss) }}>
                                ({getDifferenceSign(analysisResults.properties.shearModulus.reuss - referenceAnalysisResults.properties.shearModulus.reuss)}{Math.abs(analysisResults.properties.shearModulus.reuss - referenceAnalysisResults.properties.shearModulus.reuss).toFixed(3)})
                              </div>
                            </td>
                            <td>
                              <div>
                                <span className={styles.testTensorText}>{analysisResults.properties.poissonRatio.reuss.toFixed(5)}</span>
                                <span className={styles.referenceTensorText}>
                                  ({referenceAnalysisResults.properties.poissonRatio.reuss.toFixed(5)})
                                </span>
                              </div>
                              <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.poissonRatio.reuss - referenceAnalysisResults.properties.poissonRatio.reuss) }}>
                                ({getDifferenceSign(analysisResults.properties.poissonRatio.reuss - referenceAnalysisResults.properties.poissonRatio.reuss)}{Math.abs(analysisResults.properties.poissonRatio.reuss - referenceAnalysisResults.properties.poissonRatio.reuss).toFixed(5)})
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td>Hill</td>
                            <td>
                              <div>
                                <span className={styles.testTensorText}>{analysisResults.properties.bulkModulus.hill.toFixed(3)}</span>
                                <span className={styles.referenceTensorText}>
                                  ({referenceAnalysisResults.properties.bulkModulus.hill.toFixed(3)})
                                </span>
                              </div>
                              <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.bulkModulus.hill - referenceAnalysisResults.properties.bulkModulus.hill) }}>
                                ({getDifferenceSign(analysisResults.properties.bulkModulus.hill - referenceAnalysisResults.properties.bulkModulus.hill)}{Math.abs(analysisResults.properties.bulkModulus.hill - referenceAnalysisResults.properties.bulkModulus.hill).toFixed(3)})
                              </div>
                            </td>
                            <td>
                              <div>
                                <span className={styles.testTensorText}>{analysisResults.properties.youngsModulus.hill.toFixed(3)}</span>
                                <span className={styles.referenceTensorText}>
                                  ({referenceAnalysisResults.properties.youngsModulus.hill.toFixed(3)})
                                </span>
                              </div>
                              <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.youngsModulus.hill - referenceAnalysisResults.properties.youngsModulus.hill) }}>
                                ({getDifferenceSign(analysisResults.properties.youngsModulus.hill - referenceAnalysisResults.properties.youngsModulus.hill)}{Math.abs(analysisResults.properties.youngsModulus.hill - referenceAnalysisResults.properties.youngsModulus.hill).toFixed(3)})
                              </div>
                            </td>
                            <td>
                              <div>
                                <span className={styles.testTensorText}>{analysisResults.properties.shearModulus.hill.toFixed(3)}</span>
                                <span className={styles.referenceTensorText}>
                                  ({referenceAnalysisResults.properties.shearModulus.hill.toFixed(3)})
                                </span>
                              </div>
                              <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.shearModulus.hill - referenceAnalysisResults.properties.shearModulus.hill) }}>
                                ({getDifferenceSign(analysisResults.properties.shearModulus.hill - referenceAnalysisResults.properties.shearModulus.hill)}{Math.abs(analysisResults.properties.shearModulus.hill - referenceAnalysisResults.properties.shearModulus.hill).toFixed(3)})
                              </div>
                            </td>
                            <td>
                              <div>
                                <span className={styles.testTensorText}>{analysisResults.properties.poissonRatio.hill.toFixed(5)}</span>
                                <span className={styles.referenceTensorText}>
                                  ({referenceAnalysisResults.properties.poissonRatio.hill.toFixed(5)})
                                </span>
                              </div>
                              <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.properties.poissonRatio.hill - referenceAnalysisResults.properties.poissonRatio.hill) }}>
                                ({getDifferenceSign(analysisResults.properties.poissonRatio.hill - referenceAnalysisResults.properties.poissonRatio.hill)}{Math.abs(analysisResults.properties.poissonRatio.hill - referenceAnalysisResults.properties.poissonRatio.hill).toFixed(5)})
                              </div>
                            </td>
                          </tr>
                        </>
                      ) : (
                        <>
                          <tr>
                            <td>Voigt</td>
                            <td><em>K</em><sub>V</sub> = {analysisResults.properties.bulkModulus.voigt.toFixed(3)}</td>
                            <td><em>E</em><sub>V</sub> = {analysisResults.properties.youngsModulus.voigt.toFixed(3)}</td>
                            <td><em>G</em><sub>V</sub> = {analysisResults.properties.shearModulus.voigt.toFixed(3)}</td>
                            <td><em>ν</em><sub>V</sub> = {analysisResults.properties.poissonRatio.voigt.toFixed(5)}</td>
                          </tr>
                          <tr>
                            <td>Reuss</td>
                            <td><em>K</em><sub>R</sub> = {analysisResults.properties.bulkModulus.reuss.toFixed(3)}</td>
                            <td><em>E</em><sub>R</sub> = {analysisResults.properties.youngsModulus.reuss.toFixed(3)}</td>
                            <td><em>G</em><sub>R</sub> = {analysisResults.properties.shearModulus.reuss.toFixed(3)}</td>
                            <td><em>ν</em><sub>R</sub> = {analysisResults.properties.poissonRatio.reuss.toFixed(5)}</td>
                          </tr>
                          <tr>
                            <td>Hill</td>
                            <td><em>K</em><sub>H</sub> = {analysisResults.properties.bulkModulus.hill.toFixed(3)}</td>
                            <td><em>E</em><sub>H</sub> = {analysisResults.properties.youngsModulus.hill.toFixed(3)}</td>
                            <td><em>G</em><sub>H</sub> = {analysisResults.properties.shearModulus.hill.toFixed(3)}</td>
                            <td><em>ν</em><sub>H</sub> = {analysisResults.properties.poissonRatio.hill.toFixed(5)}</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className={`${styles.tableCell} ${styles.eigenvaluesCell}`}>
                  <h3>
                    Eigenvalues of the stiffness matrix
                    <button
                      onClick={() => copyTableToClipboard('eigenvalues', analysisResults)}
                      className={styles.copyButton}
                      title="Copy table to clipboard"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="m5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                  </h3>
                  <table className={styles.propertiesTable}>
                    <thead>
                      {comparisonMode && referenceAnalysisResults ? (
                        <tr>
                          <th></th>
                          <th>Values (GPa)</th>
                          <th>Difference</th>
                        </tr>
                      ) : (
                        <tr>
                          <th></th>
                          <th>Value (GPa)</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {comparisonMode && referenceAnalysisResults ? (
                        analysisResults.eigenvalues.map((val, i) => (
                          <tr key={i}>
                            <td>λ<sub>{i + 1}</sub></td>
                            <td>
                              <span className={styles.testTensorText}>{val.toFixed(3)}</span>
                              {referenceAnalysisResults.eigenvalues[i] && (
                                <span className={styles.referenceTensorText}>
                                  ({referenceAnalysisResults.eigenvalues[i].toFixed(3)})
                                </span>
                              )}
                            </td>
                            <td style={{ color: referenceAnalysisResults.eigenvalues[i] ? getDifferenceColor(val - referenceAnalysisResults.eigenvalues[i]) : 'inherit' }}>
                              {referenceAnalysisResults.eigenvalues[i] ?
                                `${getDifferenceSign(val - referenceAnalysisResults.eigenvalues[i])}${Math.abs(val - referenceAnalysisResults.eigenvalues[i]).toFixed(3)}` :
                                'N/A'
                              }
                            </td>
                          </tr>
                        ))
                      ) : (
                        analysisResults.eigenvalues.map((val, i) => (
                          <tr key={i}>
                            <td>λ<sub>{i + 1}</sub></td>
                            <td>{val.toFixed(3)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className={styles.tableCell}>
                  <h3>
                    Variations of the elastic moduli
                    <button
                      onClick={() => copyTableToClipboard('variations', analysisResults)}
                      className={styles.copyButton}
                      title="Copy table to clipboard"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="m5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                  </h3>
                  <table className={styles.propertiesTable}>
                    <thead>
                      <tr>
                        <th></th>
                        <th colSpan="2">Young's modulus (GPa)</th>
                        <th colSpan="2">Linear compressibility (TPa<sup>−1</sup>)</th>
                        <th colSpan="2">Shear modulus (GPa)</th>
                        <th colSpan="2">Poisson's ratio</th>
                      </tr>
                      <tr>
                        <th></th>
                        <th><em>E</em><sub>min</sub></th>
                        <th><em>E</em><sub>max</sub></th>
                        <th>β<sub>min</sub></th>
                        <th>β<sub>max</sub></th>
                        <th><em>G</em><sub>min</sub></th>
                        <th><em>G</em><sub>max</sub></th>
                        <th>ν<sub>min</sub></th>
                        <th>ν<sub>max</sub></th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonMode && referenceAnalysisResults ? (
                        <>
                          <tr>
                            <td>Value</td>
                            <td>
                              <div>
                                <span className={styles.testTensorText}>{analysisResults.extrema.youngsModulus.min.toFixed(3)}</span>
                                <span className={styles.referenceTensorText}>({referenceAnalysisResults.extrema.youngsModulus.min.toFixed(3)})</span>
                              </div>
                              <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.youngsModulus.min - referenceAnalysisResults.extrema.youngsModulus.min) }}>
                                {getDifferenceSign(analysisResults.extrema.youngsModulus.min - referenceAnalysisResults.extrema.youngsModulus.min)}{Math.abs(analysisResults.extrema.youngsModulus.min - referenceAnalysisResults.extrema.youngsModulus.min).toFixed(3)}
                              </div>
                            </td>
                            <td>
                              <div>
                                <span className={styles.testTensorText}>{analysisResults.extrema.youngsModulus.max.toFixed(3)}</span>
                                <span className={styles.referenceTensorText}>({referenceAnalysisResults.extrema.youngsModulus.max.toFixed(3)})</span>
                              </div>
                              <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.youngsModulus.max - referenceAnalysisResults.extrema.youngsModulus.max) }}>
                                {getDifferenceSign(analysisResults.extrema.youngsModulus.max - referenceAnalysisResults.extrema.youngsModulus.max)}{Math.abs(analysisResults.extrema.youngsModulus.max - referenceAnalysisResults.extrema.youngsModulus.max).toFixed(3)}
                              </div>
                            </td>
                            <td>
                              <div>
                                <span className={styles.testTensorText}>{analysisResults.extrema.linearCompressibility.min.toFixed(3)}</span>
                                <span className={styles.referenceTensorText}>({referenceAnalysisResults.extrema.linearCompressibility.min.toFixed(3)})</span>
                              </div>
                              <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.linearCompressibility.min - referenceAnalysisResults.extrema.linearCompressibility.min) }}>
                                {getDifferenceSign(analysisResults.extrema.linearCompressibility.min - referenceAnalysisResults.extrema.linearCompressibility.min)}{Math.abs(analysisResults.extrema.linearCompressibility.min - referenceAnalysisResults.extrema.linearCompressibility.min).toFixed(3)}
                              </div>
                            </td>
                            <td>
                              <div>
                                <span className={styles.testTensorText}>{analysisResults.extrema.linearCompressibility.max.toFixed(3)}</span>
                                <span className={styles.referenceTensorText}>({referenceAnalysisResults.extrema.linearCompressibility.max.toFixed(3)})</span>
                              </div>
                              <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.linearCompressibility.max - referenceAnalysisResults.extrema.linearCompressibility.max) }}>
                                {getDifferenceSign(analysisResults.extrema.linearCompressibility.max - referenceAnalysisResults.extrema.linearCompressibility.max)}{Math.abs(analysisResults.extrema.linearCompressibility.max - referenceAnalysisResults.extrema.linearCompressibility.max).toFixed(3)}
                              </div>
                            </td>
                            <td>
                              <div>
                                <span className={styles.testTensorText}>{analysisResults.extrema.shearModulus.min.toFixed(3)}</span>
                                <span className={styles.referenceTensorText}>({referenceAnalysisResults.extrema.shearModulus.min.toFixed(3)})</span>
                              </div>
                              <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.shearModulus.min - referenceAnalysisResults.extrema.shearModulus.min) }}>
                                {getDifferenceSign(analysisResults.extrema.shearModulus.min - referenceAnalysisResults.extrema.shearModulus.min)}{Math.abs(analysisResults.extrema.shearModulus.min - referenceAnalysisResults.extrema.shearModulus.min).toFixed(3)}
                              </div>
                            </td>
                            <td>
                              <div>
                                <span className={styles.testTensorText}>{analysisResults.extrema.shearModulus.max.toFixed(3)}</span>
                                <span className={styles.referenceTensorText}>({referenceAnalysisResults.extrema.shearModulus.max.toFixed(3)})</span>
                              </div>
                              <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.shearModulus.max - referenceAnalysisResults.extrema.shearModulus.max) }}>
                                {getDifferenceSign(analysisResults.extrema.shearModulus.max - referenceAnalysisResults.extrema.shearModulus.max)}{Math.abs(analysisResults.extrema.shearModulus.max - referenceAnalysisResults.extrema.shearModulus.max).toFixed(3)}
                              </div>
                            </td>
                            <td>
                              <div>
                                <span className={styles.testTensorText}>{analysisResults.extrema.poissonRatio.min.toFixed(5)}</span>
                                <span className={styles.referenceTensorText}>({referenceAnalysisResults.extrema.poissonRatio.min.toFixed(5)})</span>
                              </div>
                              <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.poissonRatio.min - referenceAnalysisResults.extrema.poissonRatio.min) }}>
                                {getDifferenceSign(analysisResults.extrema.poissonRatio.min - referenceAnalysisResults.extrema.poissonRatio.min)}{Math.abs(analysisResults.extrema.poissonRatio.min - referenceAnalysisResults.extrema.poissonRatio.min).toFixed(5)}
                              </div>
                            </td>
                            <td>
                              <div>
                                <span className={styles.testTensorText}>{analysisResults.extrema.poissonRatio.max.toFixed(5)}</span>
                                <span className={styles.referenceTensorText}>({referenceAnalysisResults.extrema.poissonRatio.max.toFixed(5)})</span>
                              </div>
                              <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.poissonRatio.max - referenceAnalysisResults.extrema.poissonRatio.max) }}>
                                {getDifferenceSign(analysisResults.extrema.poissonRatio.max - referenceAnalysisResults.extrema.poissonRatio.max)}{Math.abs(analysisResults.extrema.poissonRatio.max - referenceAnalysisResults.extrema.poissonRatio.max).toFixed(5)}
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td>Anisotropy</td>
                            <td colSpan="2">
                              <div>
                                <span className={styles.testTensorText}>{analysisResults.extrema.youngsModulus.anisotropy.toFixed(2)}</span>
                                <span className={styles.referenceTensorText}>({referenceAnalysisResults.extrema.youngsModulus.anisotropy.toFixed(2)})</span>
                              </div>
                              <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.youngsModulus.anisotropy - referenceAnalysisResults.extrema.youngsModulus.anisotropy) }}>
                                {getDifferenceSign(analysisResults.extrema.youngsModulus.anisotropy - referenceAnalysisResults.extrema.youngsModulus.anisotropy)}{Math.abs(analysisResults.extrema.youngsModulus.anisotropy - referenceAnalysisResults.extrema.youngsModulus.anisotropy).toFixed(2)}
                              </div>
                            </td>
                            <td colSpan="2">
                              <div>
                                <span className={styles.testTensorText}>{analysisResults.extrema.linearCompressibility.anisotropy.toFixed(4)}</span>
                                <span className={styles.referenceTensorText}>({referenceAnalysisResults.extrema.linearCompressibility.anisotropy.toFixed(4)})</span>
                              </div>
                              <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.linearCompressibility.anisotropy - referenceAnalysisResults.extrema.linearCompressibility.anisotropy) }}>
                                {getDifferenceSign(analysisResults.extrema.linearCompressibility.anisotropy - referenceAnalysisResults.extrema.linearCompressibility.anisotropy)}{Math.abs(analysisResults.extrema.linearCompressibility.anisotropy - referenceAnalysisResults.extrema.linearCompressibility.anisotropy).toFixed(4)}
                              </div>
                            </td>
                            <td colSpan="2">
                              <div>
                                <span className={styles.testTensorText}>{analysisResults.extrema.shearModulus.anisotropy.toFixed(2)}</span>
                                <span className={styles.referenceTensorText}>({referenceAnalysisResults.extrema.shearModulus.anisotropy.toFixed(2)})</span>
                              </div>
                              <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.shearModulus.anisotropy - referenceAnalysisResults.extrema.shearModulus.anisotropy) }}>
                                {getDifferenceSign(analysisResults.extrema.shearModulus.anisotropy - referenceAnalysisResults.extrema.shearModulus.anisotropy)}{Math.abs(analysisResults.extrema.shearModulus.anisotropy - referenceAnalysisResults.extrema.shearModulus.anisotropy).toFixed(2)}
                              </div>
                            </td>
                            <td colSpan="2">
                              <div>
                                <span className={styles.testTensorText}>{isFinite(analysisResults.extrema.poissonRatio.anisotropy) ? analysisResults.extrema.poissonRatio.anisotropy.toFixed(2) : '∞'}</span>
                                <span className={styles.referenceTensorText}>({isFinite(referenceAnalysisResults.extrema.poissonRatio.anisotropy) ? referenceAnalysisResults.extrema.poissonRatio.anisotropy.toFixed(2) : '∞'})</span>
                              </div>
                              {isFinite(analysisResults.extrema.poissonRatio.anisotropy) && isFinite(referenceAnalysisResults.extrema.poissonRatio.anisotropy) && (
                                <div style={{ fontSize: '0.8em', color: getDifferenceColor(analysisResults.extrema.poissonRatio.anisotropy - referenceAnalysisResults.extrema.poissonRatio.anisotropy) }}>
                                  {getDifferenceSign(analysisResults.extrema.poissonRatio.anisotropy - referenceAnalysisResults.extrema.poissonRatio.anisotropy)}{Math.abs(analysisResults.extrema.poissonRatio.anisotropy - referenceAnalysisResults.extrema.poissonRatio.anisotropy).toFixed(2)}
                                </div>
                              )}
                            </td>
                          </tr>
                        </>
                      ) : (
                        <>
                          <tr>
                            <td>Value</td>
                            <td>{analysisResults.extrema.youngsModulus.min.toFixed(3)}</td>
                            <td>{analysisResults.extrema.youngsModulus.max.toFixed(3)}</td>
                            <td>{analysisResults.extrema.linearCompressibility.min.toFixed(3)}</td>
                            <td>{analysisResults.extrema.linearCompressibility.max.toFixed(3)}</td>
                            <td>{analysisResults.extrema.shearModulus.min.toFixed(3)}</td>
                            <td>{analysisResults.extrema.shearModulus.max.toFixed(3)}</td>
                            <td>{analysisResults.extrema.poissonRatio.min.toFixed(5)}</td>
                            <td>{analysisResults.extrema.poissonRatio.max.toFixed(5)}</td>
                          </tr>
                          <tr>
                            <td>Anisotropy</td>
                            <td colSpan="2">{analysisResults.extrema.youngsModulus.anisotropy.toFixed(2)}</td>
                            <td colSpan="2">{analysisResults.extrema.linearCompressibility.anisotropy.toFixed(4)}</td>
                            <td colSpan="2">{analysisResults.extrema.shearModulus.anisotropy.toFixed(2)}</td>
                            <td colSpan="2">{isFinite(analysisResults.extrema.poissonRatio.anisotropy) ? analysisResults.extrema.poissonRatio.anisotropy.toFixed(2) : '∞'}</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Charts Section */}
              <div className={styles.chartsSection}>
                <div className={styles.chartControls}>
                  <select
                    value={selectedProperty}
                    onChange={(e) => setSelectedProperty(e.target.value)}
                    className={styles.propertySelect}
                  >
                    <option value="youngs">Young's Modulus</option>
                    <option value="linear_compressibility">Linear Compressibility</option>
                    <option value="shear">Shear Modulus</option>
                    <option value="poisson">Poisson's Ratio</option>
                    <option value="matrix">Tensor Matrices</option>
                  </select>

                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={show3D}
                      onChange={(e) => setShow3D(e.target.checked)}
                      className={styles.checkbox}
                    />
                    Show 3D View
                  </label>


                  {show3D && (
                    <div className={styles.radioGroup}>
                      <label className={styles.radioLabel}>
                        <input
                          type="radio"
                          name="3dMode"
                          checked={use3DScatter}
                          onChange={() => setUse3DScatter(true)}
                          className={styles.radio}
                        />
                        Scatter
                      </label>
                      <label className={styles.radioLabel}>
                        <input
                          type="radio"
                          name="3dMode"
                          checked={!use3DScatter}
                          onChange={() => setUse3DScatter(false)}
                          className={styles.radio}
                        />
                        Surface
                      </label>
                    </div>
                  )}

                  {comparisonMode && referenceDirectionalData && Object.keys(referenceDirectionalData).length > 0 && (
                    <div className={styles.radioGroup}>
                      <label className={styles.radioLabel}>
                        <input
                          type="radio"
                          name="comparisonView"
                          checked={!showDifference}
                          onChange={() => setShowDifference(false)}
                          className={styles.radio}
                        />
                        Overlay
                      </label>
                      <label className={styles.radioLabel}>
                        <input
                          type="radio"
                          name="comparisonView"
                          checked={showDifference}
                          onChange={() => setShowDifference(true)}
                          className={styles.radio}
                        />
                        Difference
                      </label>
                    </div>
                  )}
                </div>

                {selectedProperty === 'matrix' ? (
                  <>
                    {/* Matrix Heatmaps */}
                    <div className={styles.sectionTitle}>Stiffness & Compliance Matrices</div>
                    <div className={styles.surfaceChartContainer}>
                      {analysisResults && (
                        <DualMatrixChart
                          stiffnessMatrix={analysisResults.stiffnessMatrix}
                          complianceMatrix={analysisResults.complianceMatrix}
                          referenceStiffness={comparisonMode && referenceAnalysisResults ? referenceAnalysisResults.stiffnessMatrix : undefined}
                          referenceCompliance={comparisonMode && referenceAnalysisResults ? referenceAnalysisResults.complianceMatrix : undefined}
                          comparisonMode={comparisonMode}
                          showDifference={showDifference}
                          testTensorName={getTestTensorName()}
                          referenceTensorName={getReferenceTensorName()}
                        />
                      )}
                    </div>
                  </>
                ) : show3D && selectedProperty !== 'matrix' ? (
                  <>
                    {analysisResults.isPositiveDefinite ? (
                      <>
                        {/* 3D Surface chart */}
                        <div className={styles.sectionTitle}>3D Property Surface</div>
                        <div className={styles.surfaceChartContainer}>
                          {surfaceData && (
                            <SurfaceChart
                              data={surfaceData}
                              property={selectedProperty}
                              useScatter={use3DScatter}
                              referenceData={comparisonMode ? referenceSurfaceData : undefined}
                              comparisonMode={comparisonMode}
                              showDifference={showDifference}
                              testTensorName={getTestTensorName()}
                              referenceTensorName={getReferenceTensorName()}
                            />
                          )}
                        </div>
                      </>
                    ) : (
                      <div style={{
                        padding: '40px 20px',
                        textAlign: 'center',
                        color: 'var(--ifm-color-emphasis-600)',
                        fontStyle: 'italic'
                      }}>
                        3D visualization disabled: Tensor is not positive definite
                      </div>
                    )}
                  </>
                ) : selectedProperty !== 'matrix' ? (
                  <>
                    {/* Three polar charts for all planes */}
                    <div className={styles.sectionTitle}>Property Surface Plots</div>
                    <div className={styles.polarChartsGrid}>
                      {['xy', 'xz', 'yz'].map(plane => (
                        <div key={plane} className={styles.chartContainer}>
                          <div className={styles.chartLabel}>{plane.toUpperCase()} Plane</div>
                          {directionalData[plane] && (
                            <PolarChart
                              data={directionalData[plane]}
                              property={selectedProperty}
                              plane={plane}
                              referenceData={comparisonMode ? referenceDirectionalData[plane] : undefined}
                              comparisonMode={comparisonMode}
                              testTensorName={getTestTensorName()}
                              referenceTensorName={getReferenceTensorName()}
                              showDifference={showDifference}
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Directional charts below */}
                    <div className={styles.sectionTitle}>Angular Variation</div>
                    <div className={styles.directionalChartsGrid}>
                      {['xy', 'xz', 'yz'].map(plane => (
                        <div key={plane} className={styles.chartContainer}>
                          <div className={styles.chartLabel}>{plane.toUpperCase()} Plane</div>
                          {directionalData[plane] && (
                            <DirectionalChart
                              data={directionalData[plane]}
                              property={selectedProperty}
                              referenceData={comparisonMode ? referenceDirectionalData[plane] : undefined}
                              comparisonMode={comparisonMode}
                              showDifference={showDifference}
                              testTensorName={getTestTensorName()}
                              referenceTensorName={getReferenceTensorName()}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
