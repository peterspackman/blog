import React, { useState, useRef, useEffect } from 'react';
import styles from './FileUploader.module.css';

interface FileUploaderProps {
  onFileLoad: (xyzContent: string) => void;
}

// Example molecules collection
const exampleMolecules = {
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

const FileUploader: React.FC<FileUploaderProps> = ({ onFileLoad }) => {
  const [fileName, setFileName] = useState<string>('');
  const [xyzText, setXyzText] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedExample, setSelectedExample] = useState<string>('water');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load water molecule by default on mount
  useEffect(() => {
    const defaultMolecule = exampleMolecules.water;
    setXyzText(defaultMolecule.xyz);
    setFileName('');
    setSelectedExample('water');
    onFileLoad(defaultMolecule.xyz);
  }, []); // Empty dependency array - only run once on mount

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
      onFileLoad(content);
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
    if (text.trim()) {
      setFileName('');
      setSelectedExample(''); // Clear example selection when manually editing
      onFileLoad(text);
    }
  };

  const handleExampleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const exampleKey = e.target.value;
    if (exampleKey && exampleMolecules[exampleKey as keyof typeof exampleMolecules]) {
      const molecule = exampleMolecules[exampleKey as keyof typeof exampleMolecules];
      setXyzText(molecule.xyz);
      setFileName('');
      setSelectedExample(exampleKey);
      onFileLoad(molecule.xyz);
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
          className={`${styles.combinedInput} ${isDragging ? styles.dragging : ''}`}
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
      </div>
    </div>
  );
};

export default FileUploader;