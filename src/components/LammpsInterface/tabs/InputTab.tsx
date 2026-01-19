import React, { useRef, useState, useEffect } from 'react';
import styles from '../LammpsInterface.module.css';
import { isLikelyInputFile } from '../utils/fileDetection';

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

  return (
    <div
      className={`${styles.inputTabContainer} ${isDragging ? styles.inputTabDragging : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className={styles.dragOverlay}>
          <div className={styles.dragOverlayContent}>
            <div className={styles.dragIcon}>+</div>
            <div>Drop files here</div>
          </div>
        </div>
      )}

      {/* Left panel: File browser */}
      <div className={styles.fileBrowserPanel}>
        <div className={styles.fileBrowserHeader}>
          <h4>Files</h4>
          <button
            className={styles.addFileBtn}
            onClick={() => fileInputRef.current?.click()}
            title="Add files"
          >
            +
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => e.target.files && onFileUpload(e.target.files)}
          style={{ display: 'none' }}
        />

        {/* File list */}
        <div className={styles.fileList}>
          {filenames.length === 0 ? (
            <div
              className={styles.emptyFileList}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className={styles.dropZoneIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <span>Drop files or click to upload</span>
            </div>
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
                  <div className={styles.fileItemLeft}>
                    {isInput && (
                      <label
                        className={styles.mainFileToggle}
                        onClick={(e) => e.stopPropagation()}
                        title="Set as main input file"
                      >
                        <input
                          type="checkbox"
                          checked={isMain}
                          onChange={(e) => {
                            onMainFileSelect(e.target.checked ? filename : '');
                          }}
                        />
                        <span className={styles.checkmark} />
                      </label>
                    )}
                    <span className={styles.fileName} title={filename}>
                      {filename}
                    </span>
                    {isMain && <span className={styles.mainBadge}>MAIN</span>}
                  </div>
                  <button
                    className={styles.fileDeleteBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileDelete(filename);
                      if (selectedFile === filename) {
                        setSelectedFile(null);
                      }
                    }}
                    title="Delete file"
                  >
                    ×
                  </button>
                </div>
              );
            })
          )}
        </div>

        {filenames.length > 0 && (
          <div
            className={styles.dropZoneSmall}
            onClick={() => fileInputRef.current?.click()}
          >
            + Add more files
          </div>
        )}
      </div>

      {/* Right panel: Editor */}
      <div className={styles.editorPanel}>
        <div className={styles.editorHeader}>
          <h4>
            {currentEditingFile ? currentEditingFile : 'LAMMPS Script'}
            {currentEditingFile && !isLikelyInputFile(currentEditingFile) && (
              <span className={styles.readOnlyBadge}>Read-only</span>
            )}
          </h4>
          {!currentEditingFile && (
            <span className={styles.editorHint}>Default script (no file selected)</span>
          )}
        </div>

        <textarea
          className={styles.editor}
          value={editorContent}
          onChange={(e) => {
            if (currentEditingFile) {
              // Editing an uploaded file
              onScriptChange(e.target.value);
            } else {
              // Editing the default script
              onScriptChange(e.target.value);
            }
          }}
          placeholder="Enter LAMMPS commands here..."
          readOnly={currentEditingFile ? !isLikelyInputFile(currentEditingFile) : false}
        />

        <div className={styles.editorFooter}>
          <div className={styles.buttonGroup}>
            {!isRunning ? (
              <button
                onClick={onRun}
                disabled={!isReady}
                className="button button--primary"
              >
                Run LAMMPS
              </button>
            ) : (
              <button
                onClick={onCancel}
                className="button button--danger"
              >
                Cancel
              </button>
            )}
          </div>
          <div className={styles.status}>
            {status}
          </div>
        </div>
      </div>
    </div>
  );
};
