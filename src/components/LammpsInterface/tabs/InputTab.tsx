import React, { useRef, useState, useEffect } from 'react';
import styles from '../LammpsInterface.module.css';
import { isLikelyInputFile } from '../utils/fileDetection';
import { VizButton } from '../../shared/controls';

interface InputTabProps {
  uploadedFiles: Map<string, ArrayBuffer>;
  selectedMainFile: string;
  inputScript: string;
  isReady: boolean;
  isRunning: boolean;
  status: string;
  onFileUpload: (files: FileList) => void;
  onFileDelete: (filename: string) => void;
  onMainFileSelect: (filename: string) => void;
  onScriptChange: (script: string) => void;
  onRun: () => void;
  onCancel: () => void;
}

export const InputTab: React.FC<InputTabProps> = ({
  uploadedFiles,
  selectedMainFile,
  inputScript,
  isReady,
  isRunning,
  status,
  onFileUpload,
  onFileDelete,
  onMainFileSelect,
  onScriptChange,
  onRun,
  onCancel,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(selectedMainFile || null);

  // Sync selectedFile with selectedMainFile when it changes externally
  useEffect(() => {
    if (selectedMainFile && selectedMainFile !== selectedFile) {
      setSelectedFile(selectedMainFile);
    }
  }, [selectedMainFile]);

  // Handle drag events for the whole tab
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the container entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      onFileUpload(e.dataTransfer.files);
    }
  };

  const filenames = Array.from(uploadedFiles.keys());

  // When a file is selected in the list, show its content
  const handleFileClick = (filename: string) => {
    setSelectedFile(filename);
    // If it's an input file, also select it as the main file
    if (isLikelyInputFile(filename)) {
      onMainFileSelect(filename);
    }
  };

  // Get content of selected file for display
  const getFileContent = (filename: string): string => {
    const content = uploadedFiles.get(filename);
    if (!content) return '';
    try {
      return new TextDecoder().decode(content);
    } catch {
      return '[Binary file - cannot display]';
    }
  };

  // Determine what to show in the editor
  // If we have a selected file that matches the selectedMainFile, use inputScript (which tracks edits)
  // Otherwise show the file content or the default script
  const isEditingMainFile = selectedFile && selectedFile === selectedMainFile;
  const editorContent = isEditingMainFile
    ? inputScript
    : selectedFile && uploadedFiles.has(selectedFile)
      ? getFileContent(selectedFile)
      : inputScript;

  const isEditingUploadedFile = selectedFile && uploadedFiles.has(selectedFile);
  const currentEditingFile = isEditingUploadedFile ? selectedFile : null;

  const readOnly = currentEditingFile ? !isLikelyInputFile(currentEditingFile) : false;

  return (
    <div
      className={styles.inputSplit}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className={styles.dragOverlay}>
          <div className={styles.dragIcon}>+</div>
          <div>Drop files to add them</div>
        </div>
      )}

      {/* Left: file browser */}
      <section className={`${styles.pane} ${styles.filePane}`}>
        <div className={styles.paneHeader}>
          <h2 className={styles.paneTitle}>Files</h2>
          <VizButton variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} title="Add files">
            + Add
          </VizButton>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => e.target.files && onFileUpload(e.target.files)}
          style={{ display: 'none' }}
        />

        <div className={styles.fileList}>
          {filenames.length === 0 ? (
            <button
              type="button"
              className={styles.dropZone}
              onClick={() => fileInputRef.current?.click()}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Drop input and data files here, or click to upload. With no files, the default script runs.</span>
            </button>
          ) : (
            filenames.map(filename => {
              const isInput = isLikelyInputFile(filename);
              const isMain = selectedMainFile === filename;
              const isSelected = selectedFile === filename;

              return (
                <div
                  key={filename}
                  className={`${styles.fileListItem} ${isSelected ? styles.fileListItemSelected : ''}`}
                  onClick={() => handleFileClick(filename)}
                >
                  {isInput && (
                    <input
                      type="checkbox"
                      className={styles.mainCheckbox}
                      checked={isMain}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onMainFileSelect(e.target.checked ? filename : '')}
                      title="Run this file"
                      aria-label={`Run ${filename}`}
                    />
                  )}
                  <span className={styles.fileName} title={filename}>{filename}</span>
                  {isMain && <span className={styles.badge}>main</span>}
                  <button
                    type="button"
                    className={styles.fileDeleteBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileDelete(filename);
                      if (selectedFile === filename) setSelectedFile(null);
                    }}
                    title="Remove file"
                    aria-label={`Remove ${filename}`}
                  >
                    ×
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Right: editor */}
      <section className={styles.pane}>
        <div className={styles.paneHeader}>
          <h2 className={styles.paneTitle}>
            {currentEditingFile ?? 'Input script'}
            {readOnly && <span className={styles.badgeMuted}>read-only</span>}
          </h2>
          {!currentEditingFile && <span className={styles.paneHint}>default example</span>}
        </div>

        <textarea
          className={styles.editor}
          value={editorContent}
          onChange={(e) => onScriptChange(e.target.value)}
          placeholder="Enter LAMMPS commands here…"
          readOnly={readOnly}
          spellCheck={false}
        />

        <div className={styles.paneFooter}>
          {!isRunning ? (
            <VizButton variant="primary" onClick={onRun} disabled={!isReady}>
              Run LAMMPS
            </VizButton>
          ) : (
            <VizButton variant="danger" onClick={onCancel}>
              Cancel
            </VizButton>
          )}
          <span className={styles.status}>{status}</span>
        </div>
      </section>
    </div>
  );
};
