import React, { useState, useRef } from 'react';
import { VizButton } from '../shared/controls';
import styles from './ElasticTensor.module.css';
import { EXAMPLE_TENSORS } from './examples';

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

  const addExample = (example: (typeof EXAMPLE_TENSORS)[number]) => {
    setPendingTensors(prev => [...prev, { name: example.name, input: example.input, source: 'paste' }]);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="add-tensors-title" onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 id="add-tensors-title">Add tensors</h3>
          <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Close">×</button>
        </div>

        <div className={styles.modalContent}>
          <div
            className={`${styles.dropZone} ${dragActive ? styles.dragActive : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <span>Drop .txt files here or</span>
            <VizButton size="sm" onClick={() => fileInputRef.current?.click()}>
              Select files
            </VizButton>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.dat"
            onChange={handleFileSelect}
            hidden
          />

          <div className={styles.modalSection}>
            <h4>Or enter manually</h4>
            <input
              type="text"
              value={currentName}
              onChange={(e) => setCurrentName(e.target.value)}
              placeholder="Tensor name"
              className={styles.input}
            />
            <textarea
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              placeholder="6×6 stiffness matrix in GPa (full or upper triangle)"
              rows={6}
              className={`${styles.input} ${styles.textarea}`}
            />
            <VizButton onClick={addFromPaste} disabled={!currentInput.trim() || !currentName.trim()}>
              Add to list
            </VizButton>
          </div>

          <div className={styles.modalSection}>
            <h4>Examples</h4>
            <div className={styles.buttonWrap}>
              {EXAMPLE_TENSORS.map((ex) => (
                <VizButton key={ex.name} size="sm" onClick={() => addExample(ex)}>
                  {ex.name}
                </VizButton>
              ))}
            </div>
          </div>

          {pendingTensors.length > 0 && (
            <div className={styles.modalSection}>
              <h4>Ready to add ({pendingTensors.length})</h4>
              <ul className={styles.pendingList}>
                {pendingTensors.map((tensor, index) => (
                  <li key={index} className={styles.pendingItem}>
                    <span>
                      <strong>{tensor.name}</strong> <span className={styles.pendingSource}>{tensor.source}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removePending(index)}
                      className={`${styles.iconButton} ${styles.iconDanger}`}
                      aria-label={`Remove ${tensor.name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <VizButton variant="ghost" onClick={onClose}>
            Cancel
          </VizButton>
          <VizButton variant="primary" onClick={handleAddAll} disabled={pendingTensors.length === 0}>
            Add {pendingTensors.length || ''} {pendingTensors.length === 1 ? 'tensor' : 'tensors'}
          </VizButton>
        </div>
      </div>
    </div>
  );
};
