import React, { useState, useRef } from 'react';
import styles from './FileUploader.module.css';

interface FileUploaderProps {
  onFileLoad: (xyzContent: string) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileLoad }) => {
  const [fileName, setFileName] = useState<string>('');
  const [xyzText, setXyzText] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      onFileLoad(text);
    }
  };

  const clearFile = () => {
    setFileName('');
    setXyzText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBrowseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const exampleXYZ = `3
Water molecule
O  0.000000  0.000000  0.000000
H  0.757000  0.586000  0.000000
H -0.757000  0.586000  0.000000`;

  return (
    <div className={styles.section}>
      
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
            placeholder={fileName ? `Loaded: ${fileName}` : `${exampleXYZ}\n\n...or drag & drop XYZ file here`}
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