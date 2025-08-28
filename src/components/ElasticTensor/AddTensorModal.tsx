import React, { useState, useRef } from 'react';
import styles from './ElasticTensor.module.css';

interface TensorToAdd {
  name: string;
  input: string;
  source: 'paste' | 'file';
}

interface AddTensorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTensors: (tensors: TensorToAdd[]) => void;
}

export const AddTensorModal: React.FC<AddTensorModalProps> = ({
  isOpen,
  onClose,
  onAddTensors
}) => {
  const [currentInput, setCurrentInput] = useState('');
  const [currentName, setCurrentName] = useState('');
  const [pendingTensors, setPendingTensors] = useState<TensorToAdd[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  const handleFiles = async (files: File[]) => {
    const newTensors: TensorToAdd[] = [];
    
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

    setPendingTensors(prev => [...prev, ...newTensors]);
  };

  const addFromPaste = () => {
    if (currentInput.trim() && currentName.trim()) {
      setPendingTensors(prev => [...prev, {
        name: currentName.trim(),
        input: currentInput.trim(),
        source: 'paste'
      }]);
      setCurrentInput('');
      setCurrentName('');
    }
  };

  const removePending = (index: number) => {
    setPendingTensors(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddAll = () => {
    if (pendingTensors.length > 0) {
      onAddTensors(pendingTensors);
      setPendingTensors([]);
      setCurrentInput('');
      setCurrentName('');
      onClose();
    }
  };

  const loadExampleTensor = (example: string) => {
    let data = '';
    let name = '';
    
    if (example === 'silicon') {
      data = `166  64  64   0   0   0
 64 166  64   0   0   0
 64  64 166   0   0   0
  0   0   0  80   0   0
  0   0   0   0  80   0
  0   0   0   0   0  80`;
      name = 'Silicon';
    } else if (example === 'quartz') {
      data = `48.137 11.411 12.783  0.000 -3.654  0.000
11.411 34.968 14.749  0.000 -0.094  0.000
12.783 14.749 26.015  0.000 -4.528  0.000
 0.000  0.000  0.000 14.545  0.000  0.006
-3.654 -0.094 -4.528  0.000 10.771  0.000
 0.000  0.000  0.000  0.006  0.000 11.947`;
      name = 'Quartz';
    }

    setPendingTensors(prev => [...prev, {
      name,
      input: data,
      source: 'paste'
    }]);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Add Tensors</h3>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>

        <div className={styles.modalContent}>
          {/* Drag and Drop Area */}
          <div 
            className={`${styles.dropZone} ${dragActive ? styles.dragActive : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className={styles.dropZoneContent}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10,9 9,9 8,9"/>
              </svg>
              <div>
                <p style={{ margin: '8px 0 4px 0' }}>Drop .txt files here or</p>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className={styles.selectFilesButton}
                >
                  Select Files
                </button>
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.dat"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {/* Manual Entry */}
          <div className={styles.manualEntry}>
            <h4>Or enter manually:</h4>
            <input
              type="text"
              value={currentName}
              onChange={(e) => setCurrentName(e.target.value)}
              placeholder="Tensor name"
              className={styles.tensorNameInput}
            />
            <textarea
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              placeholder="6x6 elastic stiffness matrix (GPa)..."
              rows={6}
              className={styles.tensorInput}
            />
            <button 
              onClick={addFromPaste}
              disabled={!currentInput.trim() || !currentName.trim()}
              className={styles.addButton}
            >
              Add to List
            </button>
          </div>

          {/* Quick Add Examples */}
          <div className={styles.exampleSection}>
            <h4>Quick add examples:</h4>
            <div className={styles.exampleButtons}>
              <button 
                onClick={() => loadExampleTensor('silicon')}
                className={styles.exampleButton}
              >
                Silicon
              </button>
              <button 
                onClick={() => loadExampleTensor('quartz')}
                className={styles.exampleButton}
              >
                Quartz
              </button>
            </div>
          </div>


          {/* Pending Tensors List */}
          {pendingTensors.length > 0 && (
            <div className={styles.pendingSection}>
              <h4>Ready to add ({pendingTensors.length}):</h4>
              <div className={styles.pendingList}>
                {pendingTensors.map((tensor, index) => (
                  <div key={index} className={styles.pendingItem}>
                    <div className={styles.pendingInfo}>
                      <strong>{tensor.name}</strong>
                      <span className={styles.pendingSource}>({tensor.source})</span>
                    </div>
                    <button
                      onClick={() => removePending(index)}
                      className={styles.removePending}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button onClick={onClose} className={styles.cancelButton}>
            Cancel
          </button>
          <button 
            onClick={handleAddAll}
            disabled={pendingTensors.length === 0}
            className={styles.addAllButton}
          >
            Add All ({pendingTensors.length})
          </button>
        </div>
      </div>
    </div>
  );
};