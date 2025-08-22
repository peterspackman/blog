import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './FileUploader.module.css';

interface FileUploaderProps {
  onFileLoad: (xyzContent: string) => void;
  onValidationChange?: (isValid: boolean, error?: string) => void;
}

// Example molecules collection
const exampleMolecules = {
  formaldehyde: {
    name: 'Formaldehyde (CH₂O)',
    xyz: `4
Formaldehyde
H  1.0686 -0.1411  1.0408
C  0.5979  0.0151  0.0688
H  1.2687  0.2002 -0.7717
O -0.5960 -0.0151 -0.0686`
  },
  water: {
    name: 'Water (H₂O)',
    xyz: `3
Water molecule
O  0.000000  0.000000  0.000000
H  0.757000  0.586000  0.000000
H -0.757000  0.586000  0.000000`
  },
  urea: {
    name: 'Urea (CH₄N₂O)',
    xyz: `8
Urea molecule
C  0.000000  0.000000  0.000000
O  0.000000  1.220000  0.000000
N  1.150000 -0.610000  0.000000
N -1.150000 -0.610000  0.000000
H  1.150000 -1.610000  0.000000
H  2.050000 -0.110000  0.000000
H -1.150000 -1.610000  0.000000
H -2.050000 -0.110000  0.000000`
  },
  formamide: {
    name: 'Formamide (CH₃NO)',
    xyz: `6
Formamide molecule
C  0.000000  0.000000  0.000000
O  1.220000  0.000000  0.000000
N -0.610000  1.150000  0.000000
H -0.610000 -0.950000  0.000000
H -1.610000  1.150000  0.000000
H -0.110000  2.050000  0.000000`
  },
  methane: {
    name: 'Methane (CH₄)',
    xyz: `5
Methane molecule
C  0.000000  0.000000  0.000000
H  0.629000  0.629000  0.629000
H -0.629000 -0.629000  0.629000
H -0.629000  0.629000 -0.629000
H  0.629000 -0.629000 -0.629000`
  },
  ammonia: {
    name: 'Ammonia (NH₃)',
    xyz: `4
Ammonia molecule
N  0.000000  0.000000  0.000000
H  0.000000  0.950000  0.330000
H  0.820000 -0.480000  0.330000
H -0.820000 -0.480000  0.330000`
  },
  ethylene: {
    name: 'Ethylene (C₂H₄)',
    xyz: `6
Ethylene molecule
C  0.000000  0.000000  0.668000
C  0.000000  0.000000 -0.668000
H  0.000000  0.923000  1.232000
H  0.000000 -0.923000  1.232000
H  0.000000  0.923000 -1.232000
H  0.000000 -0.923000 -1.232000`
  }
};

const FileUploader: React.FC<FileUploaderProps> = ({ onFileLoad, onValidationChange }) => {
  const [fileName, setFileName] = useState<string>('');
  const [xyzText, setXyzText] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedExample, setSelectedExample] = useState<string>('formaldehyde');
  const [isValid, setIsValid] = useState<boolean>(true);
  const [validationError, setValidationError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Validate XYZ format
  const validateXYZ = (content: string): { isValid: boolean; error?: string } => {
    try {
      const lines = content.trim().split('\n');
      if (lines.length < 3) {
        return { isValid: false, error: 'XYZ file must have at least 3 lines' };
      }
      
      const numAtoms = parseInt(lines[0]);
      if (isNaN(numAtoms) || numAtoms <= 0) {
        return { isValid: false, error: 'First line must be a positive integer (number of atoms)' };
      }
      
      // Skip comment line (can be empty/blank) and get atom lines
      const atomLines = lines.slice(2);
      if (atomLines.length < numAtoms) {
        return { isValid: false, error: `Expected ${numAtoms} atom lines, but found ${atomLines.length}` };
      }
      
      // Validate each atom line (basic format validation only - OCC will handle element validation)
      for (let i = 0; i < numAtoms; i++) {
        const atomLine = atomLines[i];
        if (!atomLine || !atomLine.trim()) {
          return { isValid: false, error: `Line ${i + 3}: Empty atom line` };
        }
        
        const parts = atomLine.trim().split(/\s+/);
        if (parts.length < 4) {
          return { isValid: false, error: `Line ${i + 3}: Expected element symbol and 3 coordinates` };
        }
        
        const element = parts[0];
        // Basic check for valid element symbol format (starts with capital letter)
        if (!/^[A-Z][a-z]?$/.test(element)) {
          return { isValid: false, error: `Line ${i + 3}: Invalid element symbol format '${element}'` };
        }
        
        for (let j = 1; j <= 3; j++) {
          const coord = parseFloat(parts[j]);
          if (isNaN(coord)) {
            return { isValid: false, error: `Line ${i + 3}: Invalid coordinate '${parts[j]}'` };
          }
        }
      }
      
      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: 'Failed to parse XYZ format: ' + error.message };
    }
  };

  // Load formaldehyde molecule by default on mount
  useEffect(() => {
    const defaultMolecule = exampleMolecules.formaldehyde;
    setXyzText(defaultMolecule.xyz);
    setFileName('');
    setSelectedExample('formaldehyde');
    setIsValid(true);
    setValidationError('');
    onFileLoad(defaultMolecule.xyz);
    if (onValidationChange) {
      onValidationChange(true);
    }
  }, []); // Empty dependency array - only run once on mount
  
  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleFile = async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'xyz') {
      alert('Please upload an XYZ file.');
      return;
    }

    setFileName(file.name);
    
    try {
      const content = await file.text();
      setXyzText(content);
      
      const validation = validateXYZ(content);
      setIsValid(validation.isValid);
      setValidationError(validation.error || '');
      
      if (validation.isValid) {
        onFileLoad(content);
      }
      
      if (onValidationChange) {
        onValidationChange(validation.isValid, validation.error);
      }
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Failed to read file: ' + error.message);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setXyzText(text);
    setFileName('');
    setSelectedExample(''); // Clear example selection when manually editing
    
    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Debounce validation by 300ms
    debounceTimerRef.current = setTimeout(() => {
      if (text.trim()) {
        const validation = validateXYZ(text);
        setIsValid(validation.isValid);
        setValidationError(validation.error || '');
        
        if (validation.isValid) {
          onFileLoad(text);
        }
        
        if (onValidationChange) {
          onValidationChange(validation.isValid, validation.error);
        }
      } else {
        setIsValid(true);
        setValidationError('');
        if (onValidationChange) {
          onValidationChange(true);
        }
      }
    }, 300);
  };

  const handleExampleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const exampleKey = e.target.value;
    if (exampleKey && exampleMolecules[exampleKey as keyof typeof exampleMolecules]) {
      const molecule = exampleMolecules[exampleKey as keyof typeof exampleMolecules];
      setXyzText(molecule.xyz);
      setFileName('');
      setSelectedExample(exampleKey);
      setIsValid(true);
      setValidationError('');
      onFileLoad(molecule.xyz);
      if (onValidationChange) {
        onValidationChange(true);
      }
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const clearFile = () => {
    setFileName('');
    setXyzText('');
    setSelectedExample('');
    setIsValid(true);
    setValidationError('');
    if (onValidationChange) {
      onValidationChange(true);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBrowseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  return (
    <div className={styles.section}>
      <div className={styles.exampleSection}>
        <label className={styles.exampleLabel}>Example Molecules</label>
        <select 
          value={selectedExample} 
          onChange={handleExampleChange}
          className={styles.exampleSelect}
        >
          <option value="">Select an example...</option>
          {Object.entries(exampleMolecules).map(([key, molecule]) => (
            <option key={key} value={key}>{molecule.name}</option>
          ))}
        </select>
      </div>
      
      <div className={styles.inputContainer}>
        <div className={styles.headerRow}>
          <span className={styles.label}>XYZ Coordinates</span>
          <div className={styles.controls}>
            <button onClick={handleBrowseClick} className={styles.browseButton}>
              Browse
            </button>
            {(fileName || xyzText) && (
              <button onClick={clearFile} className={styles.clearButton}>Clear</button>
            )}
          </div>
        </div>
        
        <div
          className={`${styles.combinedInput} ${isDragging ? styles.dragging : ''} ${!isValid ? styles.invalid : xyzText.trim() ? styles.valid : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <textarea
            value={xyzText}
            onChange={handleTextChange}
            placeholder={fileName ? `Loaded: ${fileName}` : 'Select an example molecule above or drag & drop XYZ file here'}
            rows={8}
            className={styles.xyzTextarea}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".xyz"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
        {!isValid && validationError && (
          <div className={styles.errorMessage}>
            {validationError}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUploader;