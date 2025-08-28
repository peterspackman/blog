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
import { applyRotationToTensor, COMMON_AXES, RotationParams } from './TensorRotation';
import { AddTensorModal } from './AddTensorModal';


export const ElasticTensor: React.FC = () => {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  // Array-based tensor state management
  interface TensorInfo {
    id: string;
    name: string;
    input: string;
    data: number[][] | null;
    isSelected: boolean;
  }
  
  const [selectedTensors, setSelectedTensors] = useState<TensorInfo[]>([]);
  const [tensorAnalysisResults, setTensorAnalysisResults] = useState<{ [id: string]: any }>({});
  const [primaryTensorId, setPrimaryTensorId] = useState<string>('');
  const [comparisonTensorId, setComparisonTensorId] = useState<string | null>(null);
  
  // UI state
  const [selectedProperty, setSelectedProperty] = useState<string>('youngs');
  const [selectedPlane, setSelectedPlane] = useState<string>('xy');
  const [show3D, setShow3D] = useState<boolean>(false);
  const [use3DScatter, setUse3DScatter] = useState<boolean>(true);
  const [comparisonMode, setComparisonMode] = useState<boolean>(false);
  const [showDifference, setShowDifference] = useState<boolean>(false);
  
  // Helper functions for tensor management
  const addTensor = () => {
    const newId = `tensor-${Date.now()}`;
    setSelectedTensors(prev => [
      ...prev,
      { id: newId, name: '', input: '', data: null, isSelected: false }
    ]);
    return newId;
  };
  
  const removeTensor = (id: string) => {
    setSelectedTensors(prev => prev.filter(t => t.id !== id));
    if (primaryTensorId === id) {
      const remaining = selectedTensors.filter(t => t.id !== id);
      setPrimaryTensorId(remaining[0]?.id || '');
    }
    if (comparisonTensorId === id) {
      setComparisonTensorId(null);
    }
  };
  
  const updateTensor = (id: string, updates: Partial<TensorInfo>) => {
    setSelectedTensors(prev => prev.map(t => 
      t.id === id ? { ...t, ...updates } : t
    ));
  };
  
  // Computed values for backward compatibility
  const primaryTensor = selectedTensors.find(t => t.id === primaryTensorId);
  const comparisonTensor = comparisonTensorId ? selectedTensors.find(t => t.id === comparisonTensorId) : null;
  
  const tensorInput = primaryTensor?.input || '';
  const tensorData = primaryTensor?.data || null;
  const referenceTensorInput = comparisonTensor?.input || '';
  const referenceTensorData = comparisonTensor?.data || null;
  
  const analysisResults = primaryTensor ? tensorAnalysisResults[primaryTensor.id] : null;
  const referenceAnalysisResults = comparisonTensor ? tensorAnalysisResults[comparisonTensor.id] : null;
  
  // Extract data for the current property and create the expected structure for charts
  const directionalData: { [key: string]: any } = {};
  const referenceDirectionalData: { [key: string]: any } = {};
  
  // Populate directional data for all planes with current property
  ['xy', 'xz', 'yz'].forEach(plane => {
    directionalData[plane] = analysisResults?.directionalData?.[plane]?.[selectedProperty] || [];
    referenceDirectionalData[plane] = referenceAnalysisResults?.directionalData?.[plane]?.[selectedProperty] || [];
  });
  
  const surfaceData = analysisResults?.surfaceData?.[selectedProperty] || null;
  const referenceSurfaceData = referenceAnalysisResults?.surfaceData?.[selectedProperty] || null;
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string>('');
  const [logs, setLogs] = useState<Array<{ message: string; level: string; timestamp: Date }>>([]);
  // Names from current tensors
  const tensorName = primaryTensor?.name || '';
  const referenceTensorName = comparisonTensor?.name || '';
  
  const setTensorName = (name: string) => {
    if (primaryTensor) {
      updateTensor(primaryTensor.id, { name });
    }
  };
  
  const setReferenceTensorName = (name: string) => {
    if (comparisonTensor) {
      updateTensor(comparisonTensor.id, { name });
    }
  };
  
  const setTensorInput = (input: string) => {
    if (primaryTensor) {
      updateTensor(primaryTensor.id, { input });
    }
  };
  
  const setReferenceTensorInput = (input: string) => {
    if (comparisonTensor) {
      updateTensor(comparisonTensor.id, { input });
    }
  };
  
  // Update comparison mode to set/unset comparison tensor
  const handleComparisonModeChange = (enabled: boolean) => {
    setComparisonMode(enabled);
    if (enabled && !comparisonTensorId) {
      // Set the second tensor as comparison if available
      const secondTensor = selectedTensors.find(t => t.id !== primaryTensorId);
      if (secondTensor) {
        setComparisonTensorId(secondTensor.id);
      }
      // If no second tensor available, user will need to select one from dropdown
    } else if (!enabled) {
      setComparisonTensorId(null);
    }
  };

  // Handle adding tensors from modal
  const handleAddTensors = (tensors: Array<{ name: string; input: string; source: 'paste' | 'file' }>) => {
    const newTensors = tensors.map(tensor => ({
      id: `tensor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: tensor.name,
      input: tensor.input,
      data: null as number[][] | null,
      isSelected: false
    }));

    setSelectedTensors(prev => [...prev, ...newTensors]);
    
    // If we don't have a primary tensor set, set the first new one
    if (!primaryTensorId && newTensors.length > 0) {
      setPrimaryTensorId(newTensors[0].id);
    }
    
    addLog(`Added ${tensors.length} tensor(s)`, 'info');
  };

  // Handle loading saved tensor from modal
  const handleLoadSaved = (name: string) => {
    const tensor = savedTensors.find(t => t.name === name);
    if (tensor) {
      handleAddTensors([{
        name,
        input: tensor.data,
        source: 'paste'
      }]);
    }
  };
  const [savedTensors, setSavedTensors] = useState<Array<{ name: string; data: string; timestamp: Date }>>([]);
  const [showAddTensorModal, setShowAddTensorModal] = useState<boolean>(false);
  const [showLoadDropdown, setShowLoadDropdown] = useState<boolean>(false);
  const [showReferenceLoadDropdown, setShowReferenceLoadDropdown] = useState<boolean>(false);

  // Initialize tensors from localStorage and add examples if needed
  useEffect(() => {
    const loadInitialTensors = () => {
      try {
        const saved = localStorage.getItem('elasticTensors');
        const savedTensorList = saved ? JSON.parse(saved).map((tensor: any) => ({
          ...tensor,
          timestamp: new Date(tensor.timestamp)
        })) : [];
        setSavedTensors(savedTensorList);

        // Load saved tensors as selected tensors
        const initialTensors: TensorInfo[] = savedTensorList.map((tensor: any, index: number) => ({
          id: `saved-${index}-${Date.now()}`,
          name: tensor.name,
          input: tensor.data,
          data: null,
          isSelected: false
        }));

        // If no saved tensors, add example tensors
        if (initialTensors.length === 0) {
          const siliconData = `166  64  64   0   0   0
 64 166  64   0   0   0
 64  64 166   0   0   0
  0   0   0  80   0   0
  0   0   0   0  80   0
  0   0   0   0   0  80`;

          const quartzData = `48.137 11.411 12.783  0.000 -3.654  0.000
11.411 34.968 14.749  0.000 -0.094  0.000
12.783 14.749 26.015  0.000 -4.528  0.000
 0.000  0.000  0.000 14.545  0.000  0.006
-3.654 -0.094 -4.528  0.000 10.771  0.000
 0.000  0.000  0.000  0.006  0.000 11.947`;

          initialTensors.push(
            {
              id: 'example-silicon',
              name: 'Silicon (Example)',
              input: siliconData,
              data: null,
              isSelected: false
            },
            {
              id: 'example-quartz',
              name: 'Quartz (Example)',
              input: quartzData,
              data: null,
              isSelected: false
            }
          );
        }

        setSelectedTensors(initialTensors);
        
        // Set primary tensor to the first one
        if (initialTensors.length > 0) {
          setPrimaryTensorId(initialTensors[0].id);
        }
      } catch (error) {
        console.error('Failed to load initial tensors:', error);
        // addLog not available yet, so just log to console
      }
    };

    loadInitialTensors();
  }, []); // Empty dependency array - run once on mount
  
  // Rotation state
  const [enableRotation, setEnableRotation] = useState<boolean>(false);
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [rotationAxis, setRotationAxis] = useState<[number, number, number]>([0, 0, 1]);
  const [selectedAxisPreset, setSelectedAxisPreset] = useState<string>('Z');
  const [originalTensorData, setOriginalTensorData] = useState<number[][] | null>(null);

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

      case 'analyzeAllResult':
        if (data.success) {
          // Process all tensor results at once
          const results: { [id: string]: any } = {};
          for (const result of data.data) {
            results[result.id] = result;
          }
          setTensorAnalysisResults(results);
          setIsCalculating(false);
          addLog(`Analysis complete for ${data.data.length} tensor(s)`, 'info');
        } else {
          setError('Analysis failed: ' + data.error);
          setIsCalculating(false);
        }
        break;

      case 'analysisResult':
        // Legacy support for old message type - map to primary tensor
        if (data.success) {
          const tensorId = primaryTensorId;
          if (tensorId) {
            setTensorAnalysisResults(prev => ({
              ...prev,
              [tensorId]: data.data
            }));
          }
          setIsCalculating(false);
        } else {
          setError('Analysis failed: ' + data.error);
          setIsCalculating(false);
        }
        break;

      case 'directionalDataResult':
        // Legacy support - update the stored results
        if (data.success) {
          const tensorId = data.isReference ? comparisonTensorId : primaryTensorId;
          if (tensorId) {
            setTensorAnalysisResults(prev => ({
              ...prev,
              [tensorId]: {
                ...prev[tensorId],
                directionalData: {
                  ...prev[tensorId]?.directionalData,
                  [data.plane]: {
                    ...prev[tensorId]?.directionalData?.[data.plane],
                    [selectedProperty]: data.data
                  }
                }
              }
            }));
          }
        } else {
          setError('Directional data generation failed: ' + data.error);
        }
        break;

      case '3DSurfaceResult':
        // Legacy support - update the stored results
        if (data.success) {
          const tensorId = data.isReference ? comparisonTensorId : primaryTensorId;
          if (tensorId) {
            setTensorAnalysisResults(prev => ({
              ...prev,
              [tensorId]: {
                ...prev[tensorId],
                surfaceData: {
                  ...prev[tensorId]?.surfaceData,
                  [data.data.property]: data.data
                }
              }
            }));
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

  // This function is no longer needed with the new unified analysis
  const generateDirectionalDataForBoth = () => {
    // Legacy function kept for compatibility - does nothing
    console.log('generateDirectionalDataForBoth called but not needed with new unified analysis');
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

  // Function to apply rotation to tensor
  const applyTensorRotation = (originalMatrix: number[][]): number[][] => {
    if (!enableRotation || rotationAngle === 0) {
      return originalMatrix;
    }
    
    try {
      const result = applyRotationToTensor(originalMatrix, rotationAngle, rotationAxis);
      addLog(`Applied rotation: ${rotationAngle}° about axis [${rotationAxis.join(', ')}]`, 'info');
      return result.rotatedMatrix;
    } catch (error) {
      addLog(`Rotation failed: ${error.message}`, 'error');
      return originalMatrix;
    }
  };

  // Function to handle axis preset changes
  const handleAxisPresetChange = (preset: string) => {
    setSelectedAxisPreset(preset);
    if (preset === 'CUSTOM') {
      return; // Keep current axis values
    }
    const axis = COMMON_AXES[preset as keyof typeof COMMON_AXES];
    if (axis) {
      setRotationAxis(axis);
    }
  };

  // Function to apply rotation and re-analyze
  const applyRotationAndAnalyze = () => {
    if (!originalTensorData) {
      setError('No tensor data to rotate');
      return;
    }
    
    const rotatedMatrix = applyTensorRotation(originalTensorData);
    setTensorData(rotatedMatrix);
    
    // Re-run analysis with rotated tensor
    if (worker && isWorkerReady) {
      setIsCalculating(true);
      worker.postMessage({
        type: 'analyzeTensor',
        data: {
          tensorData: rotatedMatrix
        }
      });
    }
  };

  const analyzeTensor = () => {
    if (!isWorkerReady) {
      setError('Worker not ready. Please wait for initialization.');
      return;
    }

    try {
      setError('');
      setLogs([]);
      
      // Prepare tensors for analysis - collect all tensors with valid input
      const tensorsToAnalyze = [];
      
      // Primary tensor (with rotation if enabled)
      if (primaryTensor && primaryTensor.input.trim()) {
        const matrix = parseTensorInput(primaryTensor.input);
        setOriginalTensorData(matrix);
        const finalMatrix = applyTensorRotation(matrix);
        
        // Update tensor data
        updateTensor(primaryTensor.id, { data: finalMatrix });
        
        tensorsToAnalyze.push({
          id: primaryTensor.id,
          data: finalMatrix
        });
      }
      
      // Comparison tensor (no rotation applied to reference)
      if (comparisonMode && comparisonTensor && comparisonTensor.input.trim()) {
        const referenceMatrix = parseTensorInput(comparisonTensor.input);
        
        // Update tensor data
        updateTensor(comparisonTensor.id, { data: referenceMatrix });
        
        tensorsToAnalyze.push({
          id: comparisonTensor.id,
          data: referenceMatrix
        });
      }
      
      // Future extension: analyze any other selected tensors
      // const otherSelectedTensors = selectedTensors.filter(t => 
      //   t.isSelected && t.id !== primaryTensorId && t.id !== comparisonTensorId && t.input.trim()
      // );
      // for (const tensor of otherSelectedTensors) {
      //   const matrix = parseTensorInput(tensor.input);
      //   updateTensor(tensor.id, { data: matrix });
      //   tensorsToAnalyze.push({ id: tensor.id, data: matrix });
      // }
      
      if (tensorsToAnalyze.length === 0) {
        setError('No valid tensor data to analyze');
        return;
      }
      
      setIsCalculating(true);
      
      // Use the new comprehensive analysis
      worker?.postMessage({
        type: 'analyzeAll',
        data: {
          tensors: tensorsToAnalyze,
          properties: ['youngs', 'linear_compressibility', 'shear', 'poisson']
        }
      });
      
    } catch (err) {
      setError((err as Error).message);
      setTensorAnalysisResults({});
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

  // Re-analyze when property changes to get new data
  useEffect(() => {
    // With the new unified analysis, all properties are computed at once
    // so we don't need to regenerate on property change
  }, [selectedProperty]);

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
        {/* Left Column - Tensor Management */}
        <div className={styles.inputColumn}>
          <div className={styles.inputSection}>
            <div className={styles.header}>
              <h3>Tensor Management</h3>
              <div className={styles.workerStatus}>
                <span className={`${styles.statusIndicator} ${isWorkerReady ? styles.ready : styles.loading}`}>
                  {isWorkerReady ? '●' : '○'}
                </span>
                {isWorkerReady ? 'Ready' : 'Loading...'}
              </div>
            </div>

            {/* Add Tensor Button */}
            <button
              onClick={() => setShowAddTensorModal(true)}
              className={styles.addTensorButton}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Add Tensors
            </button>

            {/* Tensor Selection for Analysis */}
            {selectedTensors.length > 0 && (
              <div className={styles.tensorSelectionSection}>
                <h4>Analysis Selection</h4>
                <div className={styles.tensorSelector}>
                  <label>Primary:</label>
                  <select
                    value={primaryTensorId}
                    onChange={(e) => setPrimaryTensorId(e.target.value)}
                  >
                    {selectedTensors.map(tensor => (
                      <option key={tensor.id} value={tensor.id}>
                        {tensor.name || `Unnamed (${tensor.id.slice(-6)})`}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className={styles.modeToggle}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={comparisonMode}
                      onChange={(e) => handleComparisonModeChange(e.target.checked)}
                      className={styles.checkbox}
                    />
                    Comparison Mode
                  </label>
                </div>

                {comparisonMode && (
                  <div className={styles.tensorSelector}>
                    <label>Compare to:</label>
                    <select
                      value={comparisonTensorId || ''}
                      onChange={(e) => setComparisonTensorId(e.target.value || null)}
                    >
                      <option value="">Select comparison tensor...</option>
                      {selectedTensors.filter(t => t.id !== primaryTensorId).map(tensor => (
                        <option key={tensor.id} value={tensor.id}>
                          {tensor.name || `Unnamed (${tensor.id.slice(-6)})`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Tensor List */}
            {selectedTensors.length > 0 && (
              <div>
                <h4>Tensors ({selectedTensors.length})</h4>
                <div className={styles.tensorList}>
                  {selectedTensors.map(tensor => (
                    <div 
                      key={tensor.id} 
                      className={`${styles.tensorItem} ${
                        (tensor.id === primaryTensorId || tensor.id === comparisonTensorId) ? styles.selected : ''
                      }`}
                    >
                      <div className={styles.tensorInfo}>
                        <div className={`${styles.tensorName} ${!tensor.name ? styles.empty : ''}`}>
                          {tensor.name || `Unnamed Tensor`}
                          {tensor.id === primaryTensorId && <span style={{ color: 'var(--ifm-color-primary)' }}> (Primary)</span>}
                          {tensor.id === comparisonTensorId && <span style={{ color: 'var(--ifm-color-secondary)' }}> (Comparison)</span>}
                        </div>
                        <div className={styles.tensorStats}>
                          {tensor.input ? `${tensor.input.split('\n').length} lines` : 'No data'} • 
                          {tensor.data ? ' Processed' : ' Not processed'}
                        </div>
                      </div>
                      <div className={styles.tensorActions}>
                        <button
                          onClick={() => {
                            const newName = prompt('Enter tensor name:', tensor.name);
                            if (newName !== null) {
                              updateTensor(tensor.id, { name: newName });
                            }
                          }}
                          className={styles.tensorActionButton}
                          title="Rename tensor"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => saveTensor(tensor.name || `tensor-${Date.now()}`, tensor.input)}
                          disabled={!tensor.input}
                          className={styles.tensorActionButton}
                          title="Save to localStorage"
                        >
                          💾
                        </button>
                        <button
                          onClick={() => removeTensor(tensor.id)}
                          className={`${styles.tensorActionButton} ${styles.danger}`}
                          title="Remove tensor"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedTensors.length === 0 && (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px 20px', 
                color: 'var(--ifm-color-emphasis-600)',
                fontStyle: 'italic'
              }}>
                No tensors added yet. Click "Add Tensors" to get started.
              </div>
            )}


            {/* Rotation Controls */}
            <div className={styles.rotationSection}>
              <div className={styles.header}>
                <h4>Tensor Rotation</h4>
              </div>
              
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={enableRotation}
                  onChange={(e) => setEnableRotation(e.target.checked)}
                  className={styles.checkbox}
                />
                Enable Rotation
              </label>
              
              {enableRotation && (
                <div className={styles.rotationControls}>
                  <div className={styles.rotationRow}>
                    <label className={styles.rotationLabel}>
                      Angle (degrees):
                      <input
                        type="number"
                        value={rotationAngle}
                        onChange={(e) => setRotationAngle(parseFloat(e.target.value) || 0)}
                        step="1"
                        min="-360"
                        max="360"
                        className={styles.rotationInput}
                      />
                    </label>
                  </div>
                  
                  <div className={styles.rotationRow}>
                    <label className={styles.rotationLabel}>
                      Rotation Axis:
                      <select
                        value={selectedAxisPreset}
                        onChange={(e) => handleAxisPresetChange(e.target.value)}
                        className={styles.axisSelect}
                      >
                        <option value="X">X-axis (1,0,0)</option>
                        <option value="Y">Y-axis (0,1,0)</option>
                        <option value="Z">Z-axis (0,0,1)</option>
                        <option value="BODY_DIAGONAL">Body diagonal (1,1,1)</option>
                        <option value="FACE_DIAGONAL_XY">Face diagonal XY (1,1,0)</option>
                        <option value="FACE_DIAGONAL_XZ">Face diagonal XZ (1,0,1)</option>
                        <option value="FACE_DIAGONAL_YZ">Face diagonal YZ (0,1,1)</option>
                        <option value="CUSTOM">Custom</option>
                      </select>
                    </label>
                  </div>
                  
                  {selectedAxisPreset === 'CUSTOM' && (
                    <div className={styles.rotationRow}>
                      <div className={styles.customAxisInputs}>
                        <label className={styles.axisComponent}>
                          X:
                          <input
                            type="number"
                            value={rotationAxis[0]}
                            onChange={(e) => setRotationAxis([parseFloat(e.target.value) || 0, rotationAxis[1], rotationAxis[2]])}
                            step="0.1"
                            className={styles.axisInput}
                          />
                        </label>
                        <label className={styles.axisComponent}>
                          Y:
                          <input
                            type="number"
                            value={rotationAxis[1]}
                            onChange={(e) => setRotationAxis([rotationAxis[0], parseFloat(e.target.value) || 0, rotationAxis[2]])}
                            step="0.1"
                            className={styles.axisInput}
                          />
                        </label>
                        <label className={styles.axisComponent}>
                          Z:
                          <input
                            type="number"
                            value={rotationAxis[2]}
                            onChange={(e) => setRotationAxis([rotationAxis[0], rotationAxis[1], parseFloat(e.target.value) || 0])}
                            step="0.1"
                            className={styles.axisInput}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                  
                  {originalTensorData && (
                    <div className={styles.rotationRow}>
                      <button
                        onClick={applyRotationAndAnalyze}
                        disabled={!isWorkerReady || isCalculating}
                        className={styles.rotationButton}
                      >
                        Apply Rotation & Re-analyze
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

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
                        Ref Data: {referenceAnalysisResults ? 'Available' : 'None'}
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

                  {comparisonMode && referenceAnalysisResults && (
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

      {/* Add Tensor Modal */}
      <AddTensorModal
        isOpen={showAddTensorModal}
        onClose={() => setShowAddTensorModal(false)}
        onAddTensors={handleAddTensors}
        savedTensors={savedTensors}
        onLoadSaved={handleLoadSaved}
      />
    </div>
  );
};
