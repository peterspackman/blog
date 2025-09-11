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
  getTensorColor,
  getComputedTensorColor
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

  // UI state
  const [selectedProperty, setSelectedProperty] = useState<string>('youngs');
  const [selectedPlane, setSelectedPlane] = useState<string>('xy');
  const [show3D, setShow3D] = useState<boolean>(false);
  const [use3DScatter, setUse3DScatter] = useState<boolean>(true);
  const [showDifference, setShowDifference] = useState<boolean>(false);
  const [showShading, setShowShading] = useState<boolean>(true);
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const [showGridLines, setShowGridLines] = useState<boolean>(true);

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
  };

  const updateTensor = (id: string, updates: Partial<TensorInfo>) => {
    setSelectedTensors(prev => prev.map(t =>
      t.id === id ? { ...t, ...updates } : t
    ));
  };

  // Multi-selection functions
  const toggleTensorSelection = (id: string) => {
    setSelectedTensors(prev => prev.map(t =>
      t.id === id ? { ...t, isSelected: !t.isSelected } : t
    ));
  };

  const getSelectedTensors = () => {
    return selectedTensors.filter(t => t.isSelected);
  };

  const getFilteredTensors = () => {
    if (!tensorSearchQuery.trim()) {
      return selectedTensors;
    }
    return selectedTensors.filter(tensor => 
      tensor.name.toLowerCase().includes(tensorSearchQuery.toLowerCase())
    );
  };

  const clearAllSelections = () => {
    setSelectedTensors(prev => prev.map(t => ({ ...t, isSelected: false })));
  };

  const clearAllTensors = () => {
    if (window.confirm(`Are you sure you want to remove all ${selectedTensors.length} tensors? This will also clear them from storage and cannot be undone.`)) {
      setSelectedTensors([]);
      setTensorAnalysisResults({});
      
      // Also clear from localStorage
      try {
        localStorage.setItem('elasticTensors', JSON.stringify([]));
        setSavedTensors([]);
        addLog('Cleared all tensors and storage', 'info');
      } catch (error) {
        console.error('Failed to clear storage:', error);
      }
    }
  };

  const copyPropertiesTable = () => {
    const selectedTensors = getSelectedTensors();
    let text = 'Tensor\tAveraging scheme\tBulk modulus (GPa)\tYoung\'s modulus (GPa)\tShear modulus (GPa)\tPoisson\'s ratio\tλ₁\tλ₂\tλ₃\tλ₄\tλ₅\tλ₆\n';
    
    selectedTensors.forEach(tensor => {
      const results = tensorAnalysisResults[tensor.id];
      if (results) {
        ['voigt', 'reuss', 'hill'].forEach((scheme, schemeIndex) => {
          text += `${tensor.name || 'Unnamed'}\t${scheme.charAt(0).toUpperCase() + scheme.slice(1)}\t`;
          text += `${results.properties.bulkModulus[scheme].toFixed(3)}\t`;
          text += `${results.properties.youngsModulus[scheme].toFixed(3)}\t`;
          text += `${results.properties.shearModulus[scheme].toFixed(3)}\t`;
          text += `${results.properties.poissonRatio[scheme].toFixed(5)}`;
          
          if (schemeIndex === 0) {
            // Add eigenvalues only for the first scheme
            (results.eigenvalues || Array(6).fill(null)).slice(0, 6).forEach(eigenval => {
              text += `\t${eigenval !== null && eigenval !== undefined ? eigenval.toFixed(2) : 'N/A'}`;
            });
          } else {
            // Add empty cells for eigenvalues in other schemes
            text += '\t\t\t\t\t\t';
          }
          text += '\n';
        });
      }
    });
    
    navigator.clipboard.writeText(text.trim()).then(() => {
      addLog('Properties table copied to clipboard', 'info');
    }).catch(err => {
      console.error('Failed to copy table:', err);
    });
  };

  const copyVariationsTable = () => {
    const selectedTensors = getSelectedTensors();
    let text = 'Tensor\tE_min\tE_max\tE_aniso\tβ_min\tβ_max\tβ_aniso\tG_min\tG_max\tG_aniso\tν_min\tν_max\tν_aniso\n';
    
    selectedTensors.forEach(tensor => {
      const results = tensorAnalysisResults[tensor.id];
      if (results && results.extrema) {
        text += `${tensor.name || 'Unnamed'}\t`;
        text += `${results.extrema.youngsModulus.min.toFixed(3)}\t${results.extrema.youngsModulus.max.toFixed(3)}\t${results.extrema.youngsModulus.anisotropy.toFixed(2)}\t`;
        text += `${results.extrema.linearCompressibility.min.toFixed(3)}\t${results.extrema.linearCompressibility.max.toFixed(3)}\t${results.extrema.linearCompressibility.anisotropy.toFixed(2)}\t`;
        text += `${results.extrema.shearModulus.min.toFixed(3)}\t${results.extrema.shearModulus.max.toFixed(3)}\t${results.extrema.shearModulus.anisotropy.toFixed(2)}\t`;
        text += `${results.extrema.poissonRatio.min.toFixed(5)}\t${results.extrema.poissonRatio.max.toFixed(5)}\t${isFinite(results.extrema.poissonRatio.anisotropy) ? results.extrema.poissonRatio.anisotropy.toFixed(2) : '∞'}\n`;
      }
    });
    
    navigator.clipboard.writeText(text.trim()).then(() => {
      addLog('Variations table copied to clipboard', 'info');
    }).catch(err => {
      console.error('Failed to copy table:', err);
    });
  };

  const getTensorColorIndex = (tensorId: string) => {
    const selectedList = getSelectedTensors();
    const index = selectedList.findIndex(t => t.id === tensorId);
    return index >= 0 ? index % 10 : 0; // Cycle through 10 colors
  };

  const getTensorColor = (tensorId: string) => {
    const colorIndex = getTensorColorIndex(tensorId);
    return `var(--tensor-color-${colorIndex})`;
  };

  // Multi-tensor support
  const selectedTensorsList = getSelectedTensors();

  // Extract multi-tensor data for charts
  const getMultiTensorData = () => {
    const selectedTensorList = getSelectedTensors();
    const multiTensorData: { [plane: string]: Array<{ data: any[], tensorId: string, name: string, colorIndex: number }> } = {
      xy: [],
      xz: [],
      yz: []
    };

    const surfaceDataList: Array<{ data: any, tensorId: string, name: string, colorIndex: number }> = [];

    selectedTensorList.forEach((tensor) => {
      const results = tensorAnalysisResults[tensor.id];
      if (results) {
        const colorIndex = getTensorColorIndex(tensor.id);

        // Add directional data for each plane
        ['xy', 'xz', 'yz'].forEach(plane => {
          const planeData = results.directionalData?.[plane]?.[selectedProperty] || [];
          if (planeData.length > 0) {
            multiTensorData[plane].push({
              data: planeData,
              tensorId: tensor.id,
              name: tensor.name || 'Unnamed',
              colorIndex
            });
          }
        });

        // Add surface data
        const surfData = results.surfaceData?.[selectedProperty];
        if (surfData) {
          surfaceDataList.push({
            data: surfData,
            tensorId: tensor.id,
            name: tensor.name || 'Unnamed',
            colorIndex
          });
        }
      }
    });

    return { directionalData: multiTensorData, surfaceData: surfaceDataList };
  };

  const multiData = getMultiTensorData();

  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string>('');
  const [logs, setLogs] = useState<Array<{ message: string; level: string; timestamp: Date }>>([]);

  // Handle adding tensors from modal
  const handleAddTensors = (tensors: Array<{ name: string; input: string; source: 'paste' | 'file' }>) => {
    const newTensors = tensors.map(tensor => ({
      id: `tensor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: tensor.name,
      input: tensor.input,
      data: null as number[][] | null,
      isSelected: false
    }));

    // Save all tensors to localStorage in one batch
    try {
      const newSavedTensors = tensors.map(tensor => ({
        name: tensor.name.trim(),
        data: tensor.input.trim(),
        timestamp: new Date()
      }));
      
      // Remove any existing tensors with the same names, then add new ones
      const existingNames = new Set(newSavedTensors.map(t => t.name));
      const filteredExisting = savedTensors.filter(t => !existingNames.has(t.name));
      const updatedTensors = [...newSavedTensors, ...filteredExisting];
      
      setSavedTensors(updatedTensors);
      localStorage.setItem('elasticTensors', JSON.stringify(updatedTensors));
    } catch (error) {
      console.error('Failed to save tensors:', error);
      setError('Failed to save tensors to localStorage');
    }

    setSelectedTensors(prev => [...prev, ...newTensors]);

    addLog(`Added and saved ${tensors.length} tensor(s)`, 'info');
  };

  const [savedTensors, setSavedTensors] = useState<Array<{ name: string; data: string; timestamp: Date }>>([]);
  const [showAddTensorModal, setShowAddTensorModal] = useState<boolean>(false);
  const [showLoadDropdown, setShowLoadDropdown] = useState<boolean>(false);
  const [showReferenceLoadDropdown, setShowReferenceLoadDropdown] = useState<boolean>(false);
  const [tensorSearchQuery, setTensorSearchQuery] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);

  // Handle drag and drop for tensor files
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFiles = async (files: File[]) => {
    const newTensors: Array<{ name: string; input: string; source: 'paste' | 'file' }> = [];
    
    for (const file of files) {
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        try {
          const content = await file.text();
          const name = file.name.replace(/\.(txt|dat)$/i, '');
          newTensors.push({
            name,
            input: content.trim(),
            source: 'file'
          });
        } catch (error) {
          console.error(`Failed to read file ${file.name}:`, error);
        }
      }
    }

    if (newTensors.length > 0) {
      handleAddTensors(newTensors);
    }
  };

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

    const selectedTensors = getSelectedTensors();

    if (selectedTensors.length === 0) {
      setError('No tensors selected for analysis. Click on tensors to select them.');
      return;
    }

    try {
      setError('');
      setLogs([]);

      // Prepare all selected tensors for analysis
      const tensorsToAnalyze = [];
      let hasRotation = false;

      for (const tensor of selectedTensors) {
        if (!tensor.input.trim()) {
          addLog(`Skipping tensor "${tensor.name || 'Unnamed'}" - no input data`, 'warning');
          continue;
        }

        try {
          const matrix = parseTensorInput(tensor.input);

          // Apply rotation only to the first tensor if enabled (for backward compatibility)
          let finalMatrix = matrix;
          if (!hasRotation && enableRotation) {
            setOriginalTensorData(matrix);
            finalMatrix = applyTensorRotation(matrix);
            hasRotation = true;
            addLog(`Applied rotation to "${tensor.name || 'Unnamed'}"`, 'info');
          }

          // Update tensor data
          updateTensor(tensor.id, { data: finalMatrix });

          tensorsToAnalyze.push({
            id: tensor.id,
            data: finalMatrix
          });

        } catch (parseError) {
          addLog(`Failed to parse tensor "${tensor.name || 'Unnamed'}": ${(parseError as Error).message}`, 'error');
        }
      }

      if (tensorsToAnalyze.length === 0) {
        setError('No valid tensors to analyze. Check tensor input data.');
        return;
      }

      setIsCalculating(true);
      addLog(`Analyzing ${tensorsToAnalyze.length} tensor(s)...`, 'info');

      // Use the comprehensive analysis for all selected tensors
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
              <h3>Elastic Tensors</h3>
              <div className={styles.workerStatus}>
                <span className={`${styles.statusIndicator} ${isWorkerReady ? styles.ready : styles.loading}`}>
                  {isWorkerReady ? '●' : '○'}
                </span>
                {isWorkerReady ? 'Ready' : 'Loading...'}
              </div>
            </div>

            {/* Add Tensor Drop Zone */}
            <div
              onClick={() => setShowAddTensorModal(true)}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`${styles.addTensorDropZone} ${dragActive ? styles.dragActive : ''}`}
              style={{
                border: '2px dashed var(--ifm-color-emphasis-300)',
                borderRadius: '8px',
                padding: '20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginBottom: '16px',
                backgroundColor: dragActive 
                  ? 'var(--ifm-color-primary-lightest)' 
                  : 'var(--ifm-background-surface-color)',
                borderColor: dragActive 
                  ? 'var(--ifm-color-primary)' 
                  : 'var(--ifm-color-emphasis-300)'
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '8px' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10,9 9,9 8,9"/>
              </svg>
              <div>
                <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                  {dragActive ? 'Drop tensor files here' : 'Add Tensors'}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--ifm-color-emphasis-600)' }}>
                  {dragActive ? 'Release to upload' : 'Drag & drop .txt files or click to browse'}
                </div>
              </div>
            </div>

            {/* Tensor List */}
            {selectedTensors.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0 }}>Tensors ({selectedTensors.length}, {getSelectedTensors().length} selected)</h4>
                  <button
                    onClick={clearAllTensors}
                    style={{
                      padding: '4px 8px',
                      border: '1px solid var(--ifm-color-danger)',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      background: 'transparent',
                      color: 'var(--ifm-color-danger)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--ifm-color-danger)';
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--ifm-color-danger)';
                    }}
                    title="Remove all tensors and clear storage"
                  >
                    Clear All
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="Search tensors..."
                    value={tensorSearchQuery}
                    onChange={(e) => setTensorSearchQuery(e.target.value)}
                    className={styles.tensorSearchInput}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      border: '1px solid var(--ifm-color-emphasis-300)',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      background: 'var(--ifm-background-color)',
                      color: 'var(--ifm-color-content)'
                    }}
                  />
                  <button
                    onClick={clearAllSelections}
                    disabled={getSelectedTensors().length === 0}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid var(--ifm-color-emphasis-300)',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      background: 'var(--ifm-background-color)',
                      color: 'var(--ifm-color-content)',
                      cursor: getSelectedTensors().length > 0 ? 'pointer' : 'not-allowed',
                      opacity: getSelectedTensors().length > 0 ? 1 : 0.5
                    }}
                    title="Clear all selections"
                  >
                    Clear
                  </button>
                </div>
                <div className={styles.tensorList} style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {getFilteredTensors().map(tensor => {
                    const colorIndex = getTensorColorIndex(tensor.id);
                    return (
                      <div
                        key={tensor.id}
                        className={`${styles.tensorItem} ${tensor.isSelected ? styles.selected : ''
                          }`}
                        onClick={() => toggleTensorSelection(tensor.id)}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: tensor.isSelected ? getComputedTensorColor(colorIndex) + '20' : 'transparent',
                          borderLeft: tensor.isSelected ? `3px solid ${getComputedTensorColor(colorIndex)}` : '3px solid transparent'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                          {tensor.isSelected && (
                            <div className={`${styles.tensorColorIndicator} tensor-color-${colorIndex}`} />
                          )}
                          <div className={styles.tensorInfo} style={{ flex: 1, minWidth: 0 }}>
                            <div className={`${styles.tensorName} ${!tensor.name ? styles.empty : ''}`}>
                              {tensor.name || `Unnamed Tensor`}
                            </div>
                          </div>
                        </div>
                        <div className={styles.tensorActions}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const newName = prompt('Enter tensor name:', tensor.name);
                              if (newName !== null) {
                                updateTensor(tensor.id, { name: newName });
                              }
                            }}
                            className={styles.tensorActionButton}
                            title="Rename tensor"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Remove from localStorage if it's saved
                              if (tensor.name) {
                                deleteTensor(tensor.name);
                              }
                              removeTensor(tensor.id);
                            }}
                            className={`${styles.tensorActionButton} ${styles.danger}`}
                            title="Remove tensor and delete from storage"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}
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


            <button
              onClick={analyzeTensor}
              disabled={!isWorkerReady || isCalculating}
              className="button button--primary button--lg"
              style={{ width: '100%', marginBottom: '16px' }}
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
          {selectedTensorsList.length > 0 && (
            <>
              {/* Positive Definiteness Error */}
              {selectedTensorsList.some(tensor => {
                const results = tensorAnalysisResults[tensor.id];
                return results?.eigenvalues && !results.isPositiveDefinite;
              }) && (
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
                    <strong style={{ color: '#721c24' }}>Warning: Some Tensors Not Positive Definite</strong>
                    <div style={{ fontSize: '0.9em', color: '#721c24', marginTop: '4px' }}>
                      One or more elastic tensors have non-positive eigenvalues, indicating they are not physically stable. 
                      Properties and visualizations for these tensors are not physically meaningful.
                    </div>
                  </div>
                </div>
              )}

              {/* Eigenvalue Error Warning */}
              {selectedTensorsList.some(tensor => {
                const results = tensorAnalysisResults[tensor.id];
                return results?.eigenvalueError;
              }) && (
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
                      Some tensors have eigenvalue calculation errors.
                    </div>
                  </div>
                </div>
              )}

              {/* Tables Section - only show if any selected tensor has analysis results */}
              {selectedTensorsList.some(tensor => tensorAnalysisResults[tensor.id]) && (
                <div className={styles.tablesGrid}>
                <div className={styles.tableCell}>
                  <h3>
                    Properties
                    <button
                      onClick={copyPropertiesTable}
                      className={styles.copyButton}
                      title="Copy table to clipboard"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="m5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                  </h3>
                  <table className={styles.propertiesTable}>
                    <thead>
                      <tr>
                        <th>Tensor</th>
                        <th>Averaging scheme</th>
                        <th>Bulk modulus (GPa)</th>
                        <th>Young's modulus (GPa)</th>
                        <th>Shear modulus (GPa)</th>
                        <th>Poisson's ratio</th>
                        <th>λ₁</th>
                        <th>λ₂</th>
                        <th>λ₃</th>
                        <th>λ₄</th>
                        <th>λ₅</th>
                        <th>λ₆</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSelectedTensors().map(tensor => {
                        const results = tensorAnalysisResults[tensor.id];
                        const colorIndex = getTensorColorIndex(tensor.id);
                        const color = getComputedTensorColor(colorIndex);

                        if (!results) return null;

                        return ['voigt', 'reuss', 'hill'].map((scheme, schemeIndex) => (
                          <tr key={`${tensor.id}-${scheme}`}>
                            <td style={{
                              fontWeight: '500',
                              borderLeft: `3px solid ${color}`,
                              paddingLeft: '8px'
                            }}>
                              {tensor.name || 'Unnamed'}
                            </td>
                            <td>{scheme.charAt(0).toUpperCase() + scheme.slice(1)}</td>
                            <td>{results.properties.bulkModulus[scheme].toFixed(3)}</td>
                            <td>{results.properties.youngsModulus[scheme].toFixed(3)}</td>
                            <td>{results.properties.shearModulus[scheme].toFixed(3)}</td>
                            <td>{results.properties.poissonRatio[scheme].toFixed(5)}</td>
                            {/* Eigenvalues only in the first row (Voigt) */}
                            {schemeIndex === 0 ?
                              (results.eigenvalues || Array(6).fill(null)).slice(0, 6).map((eigenval, idx) => (
                                <td key={`eig${idx}`} style={{ fontSize: '0.8rem' }}>
                                  {eigenval !== null && eigenval !== undefined ? eigenval.toFixed(2) : 'N/A'}
                                </td>
                              ))
                              :
                              Array.from({ length: 6 }, (_, i) => (
                                <td key={`empty-${i}`}></td>
                              ))
                            }
                          </tr>
                        ));
                      }).flat()}
                    </tbody>
                  </table>
                </div>

                <div className={styles.tableCell}>
                  <h3>
                    Variations of the elastic moduli
                    <button
                      onClick={copyVariationsTable}
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
                        <th colSpan="3">Young's modulus (GPa)</th>
                        <th colSpan="3">Linear compressibility (TPa<sup>−1</sup>)</th>
                        <th colSpan="3">Shear modulus (GPa)</th>
                        <th colSpan="3">Poisson's ratio</th>
                      </tr>
                      <tr>
                        <th>Tensor</th>
                        <th><em>E</em><sub>min</sub></th>
                        <th><em>E</em><sub>max</sub></th>
                        <th><em>E</em><sub>aniso</sub></th>
                        <th>β<sub>min</sub></th>
                        <th>β<sub>max</sub></th>
                        <th>β<sub>aniso</sub></th>
                        <th><em>G</em><sub>min</sub></th>
                        <th><em>G</em><sub>max</sub></th>
                        <th><em>G</em><sub>aniso</sub></th>
                        <th>ν<sub>min</sub></th>
                        <th>ν<sub>max</sub></th>
                        <th>ν<sub>aniso</sub></th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSelectedTensors().map(tensor => {
                        const results = tensorAnalysisResults[tensor.id];
                        const colorIndex = getTensorColorIndex(tensor.id);
                        const color = getComputedTensorColor(colorIndex);

                        if (!results) return null;

                        return (
                          <tr key={tensor.id}>
                            <td style={{
                              fontWeight: '500',
                              borderLeft: `3px solid ${color}`,
                              paddingLeft: '8px'
                            }}>
                              {tensor.name || 'Unnamed'}
                            </td>
                            <td>{results.extrema.youngsModulus.min.toFixed(3)}</td>
                            <td>{results.extrema.youngsModulus.max.toFixed(3)}</td>
                            <td>{results.extrema.youngsModulus.anisotropy.toFixed(2)}</td>
                            <td>{results.extrema.linearCompressibility.min.toFixed(3)}</td>
                            <td>{results.extrema.linearCompressibility.max.toFixed(3)}</td>
                            <td>{results.extrema.linearCompressibility.anisotropy.toFixed(2)}</td>
                            <td>{results.extrema.shearModulus.min.toFixed(3)}</td>
                            <td>{results.extrema.shearModulus.max.toFixed(3)}</td>
                            <td>{results.extrema.shearModulus.anisotropy.toFixed(2)}</td>
                            <td>{results.extrema.poissonRatio.min.toFixed(5)}</td>
                            <td>{results.extrema.poissonRatio.max.toFixed(5)}</td>
                            <td>{isFinite(results.extrema.poissonRatio.anisotropy) ? results.extrema.poissonRatio.anisotropy.toFixed(2) : '∞'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              )}

              {/* Charts Section - only show if any selected tensor has analysis results */}
              {selectedTensorsList.some(tensor => tensorAnalysisResults[tensor.id]) && (
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
                    <option value="matrix">Tensor Matrix Components</option>
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

                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={showShading}
                      onChange={(e) => setShowShading(e.target.checked)}
                      className={styles.checkbox}
                    />
                    Show Area Shading
                  </label>

                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={showLegend}
                      onChange={(e) => setShowLegend(e.target.checked)}
                      className={styles.checkbox}
                    />
                    Show Legend
                  </label>

                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={showGridLines}
                      onChange={(e) => setShowGridLines(e.target.checked)}
                      className={styles.checkbox}
                    />
                    Show Grid Lines
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

                </div>

                {selectedProperty === 'matrix' ? (
                  <>
                    {/* Stiffness Matrix Table */}
                    <div className={styles.sectionTitle}>Stiffness Matrix (C) - GPa</div>
                    <div className={styles.surfaceChartContainer}>
                      <div className={styles.matrixComponentsTable}>
                        <table className={styles.propertiesTable}>
                          <thead>
                            <tr>
                              <th>Tensor</th>
                              {[
                                'C11', 'C12', 'C13', 'C14', 'C15', 'C16',
                                'C22', 'C23', 'C24', 'C25', 'C26',
                                'C33', 'C34', 'C35', 'C36',
                                'C44', 'C45', 'C46',
                                'C55', 'C56',
                                'C66'
                              ].map(label => (
                                <th key={label} style={{ fontSize: '0.8rem' }}>{label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {getSelectedTensors().map(tensor => {
                              const results = tensorAnalysisResults[tensor.id];
                              const colorIndex = getTensorColorIndex(tensor.id);
                              const color = getComputedTensorColor(colorIndex);

                              if (!results) return null;

                              const stiffnessIndices = [
                                [0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
                                [1, 1], [1, 2], [1, 3], [1, 4], [1, 5],
                                [2, 2], [2, 3], [2, 4], [2, 5],
                                [3, 3], [3, 4], [3, 5],
                                [4, 4], [4, 5],
                                [5, 5]
                              ];

                              return (
                                <tr key={tensor.id}>
                                  <td style={{
                                    fontWeight: '500',
                                    borderLeft: `3px solid ${color}`,
                                    paddingLeft: '8px'
                                  }}>
                                    {tensor.name || 'Unnamed'}
                                  </td>
                                  {stiffnessIndices.map(([i, j], idx) => (
                                    <td key={`C${idx}`} style={{ fontSize: '0.8rem' }}>
                                      {results.stiffnessMatrix?.[i]?.[j]?.toFixed(1) || 'N/A'}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Compliance Matrix Table */}
                    <div className={styles.sectionTitle}>Compliance Matrix (S) - GPa⁻¹</div>
                    <div className={styles.surfaceChartContainer}>
                      <div className={styles.matrixComponentsTable}>
                        <table className={styles.propertiesTable}>
                          <thead>
                            <tr>
                              <th>Tensor</th>
                              {[
                                'S11', 'S12', 'S13', 'S14', 'S15', 'S16',
                                'S22', 'S23', 'S24', 'S25', 'S26',
                                'S33', 'S34', 'S35', 'S36',
                                'S44', 'S45', 'S46',
                                'S55', 'S56',
                                'S66'
                              ].map(label => (
                                <th key={label} style={{ fontSize: '0.8rem' }}>{label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {getSelectedTensors().map(tensor => {
                              const results = tensorAnalysisResults[tensor.id];
                              const colorIndex = getTensorColorIndex(tensor.id);
                              const color = getComputedTensorColor(colorIndex);

                              if (!results) return null;

                              const complianceIndices = [
                                [0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
                                [1, 1], [1, 2], [1, 3], [1, 4], [1, 5],
                                [2, 2], [2, 3], [2, 4], [2, 5],
                                [3, 3], [3, 4], [3, 5],
                                [4, 4], [4, 5],
                                [5, 5]
                              ];

                              return (
                                <tr key={tensor.id}>
                                  <td style={{
                                    fontWeight: '500',
                                    borderLeft: `3px solid ${color}`,
                                    paddingLeft: '8px'
                                  }}>
                                    {tensor.name || 'Unnamed'}
                                  </td>
                                  {complianceIndices.map(([i, j], idx) => (
                                    <td key={`S${idx}`} style={{ fontSize: '0.8rem' }}>
                                      {results.complianceMatrix?.[i]?.[j]?.toFixed(6) || 'N/A'}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : show3D && selectedProperty !== 'matrix' ? (
                  <>
                    {selectedTensorsList.every(tensor => {
                      const results = tensorAnalysisResults[tensor.id];
                      return results?.isPositiveDefinite !== false;
                    }) ? (
                      <>
                        {/* 3D Surface chart */}
                        <div className={styles.sectionTitle}>3D Property Surface</div>
                        <div className={styles.surfaceChartContainer}>
                          {multiData.surfaceData.length > 0 && (
                            <SurfaceChart
                              multiSurfaceData={multiData.surfaceData}
                              property={selectedProperty}
                              useScatter={use3DScatter}
                              showLegend={showLegend}
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
                          <PolarChart
                            property={selectedProperty}
                            plane={plane}
                            multiTensorData={multiData.directionalData[plane]}
                            showShading={showShading}
                            showLegend={showLegend}
                            showGridLines={showGridLines}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Directional charts below */}
                    <div className={styles.sectionTitle}>Angular Variation</div>
                    <div className={styles.directionalChartsGrid}>
                      {['xy', 'xz', 'yz'].map(plane => (
                        <div key={plane} className={styles.chartContainer}>
                          <div className={styles.chartLabel}>{plane.toUpperCase()} Plane</div>
                          <DirectionalChart
                            property={selectedProperty}
                            multiTensorData={multiData.directionalData[plane]}
                            showShading={showShading}
                            showLegend={showLegend}
                            showGridLines={showGridLines}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add Tensor Modal */}
      <AddTensorModal
        isOpen={showAddTensorModal}
        onClose={() => setShowAddTensorModal(false)}
        onAddTensors={handleAddTensors}
      />
    </div>
  );
};
