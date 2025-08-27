import React, { useState, useEffect, useRef } from 'react';
import styles from './LammpsInterface.module.css';

interface LammpsInterfaceProps {}

interface UploadedFile {
  name: string;
  content: ArrayBuffer;
}

const LammpsInterface: React.FC<LammpsInterfaceProps> = () => {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState('Loading LAMMPS...');
  const [output, setOutput] = useState<Array<{ text: string; isError: boolean }>>([]);
  const defaultScript = `# LAMMPS input script
units lj
dimension 3
atom_style atomic
lattice fcc 0.8442
region box block 0 4 0 4 0 4
create_box 1 box
create_atoms 1 box
mass 1 1.0
velocity all create 1.44 87287 loop geom
pair_style lj/cut 2.5
pair_coeff 1 1 1.0 1.0 2.5
neighbor 0.3 bin
neigh_modify delay 0 every 20 check no
fix 1 all nve
thermo 100
dump 1 all xyz 50 trajectory.xyz
run 1000
undump 1`;

  const [inputScript, setInputScript] = useState(defaultScript);
  
  const [uploadedFiles, setUploadedFiles] = useState<Map<string, ArrayBuffer>>(new Map());
  const [selectedMainFile, setSelectedMainFile] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [vfsFiles, setVfsFiles] = useState<Array<{name: string; size: number; isDirectory: boolean; path: string}>>([]);
  const [isScriptModified, setIsScriptModified] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Initialize worker
  useEffect(() => {
    initializeWorker();
    return () => {
      if (worker) {
        worker.terminate();
      }
    };
  }, []);

  // Cleanup effect to ensure worker termination
  useEffect(() => {
    return () => {
      if (worker) {
        worker.terminate();
      }
    };
  }, [worker]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Update script content when selected file changes (only if not manually modified)
  useEffect(() => {
    if (!isScriptModified) {
      if (selectedMainFile && uploadedFiles.has(selectedMainFile)) {
        const fileContent = uploadedFiles.get(selectedMainFile);
        if (fileContent) {
          const text = new TextDecoder().decode(fileContent);
          setInputScript(text);
        }
      } else {
        // No file selected, show default script
        setInputScript(defaultScript);
      }
    }
  }, [selectedMainFile, uploadedFiles, defaultScript, isScriptModified]);

  const initializeWorker = async () => {
    try {
      appendOutput('Creating LAMMPS Web Worker...');
      
      // Create our custom worker
      const newWorker = new Worker(
        new URL('./lammps-worker.js', import.meta.url),
        { type: 'module' }
      );

      newWorker.onmessage = handleWorkerMessage;
      newWorker.onerror = (error) => {
        appendOutput(`Worker error: ${error.message}`, true);
        setStatus('Error');
      };

      setWorker(newWorker);
      appendOutput('Web Worker created, initializing LAMMPS...');
      
      // Send initialization message to the worker
      newWorker.postMessage({ type: 'init' });
      
    } catch (error) {
      appendOutput(`Failed to create worker: ${error.message}`, true);
      setStatus('Error');
    }
  };

  const handleWorkerMessage = (e: MessageEvent) => {
    const { type, data } = e.data;
    const currentWorker = e.target as Worker; // Get the worker that sent this message
    
    // Debug logging
    console.log('Worker message:', type, data);

    switch (type) {
      case 'ready':
        appendOutput(data);
        
        // Upload any previously loaded files
        if (uploadedFiles.size > 0) {
          appendOutput(`Re-uploading ${uploadedFiles.size} file(s) to new worker...`);
          for (let [filename, content] of uploadedFiles) {
            // If this is the currently selected and modified file, use the current script content
            let fileContent = content;
            if (filename === selectedMainFile && isScriptModified) {
              const encoder = new TextEncoder();
              fileContent = encoder.encode(inputScript).buffer;
            }
            
            worker?.postMessage({
              type: 'upload-file',
              data: {
                name: filename,
                content: fileContent
              }
            });
          }
        }
        
        setStatus('Ready');
        setIsReady(true);
        break;
        
      case 'stdout':
        appendOutput(data);
        break;
        
      case 'stderr':
        appendOutput(data, true);
        break;
        
      case 'completed':
        appendOutput(data.message);
        appendOutput('Checking for output files...');
        setStatus('Complete');
        setIsRunning(false);
        // Automatically list files after completion using the current worker reference
        console.log('Sending list-files request after completion');
        setTimeout(() => {
          console.log('Actually sending list-files message');
          currentWorker.postMessage({
            type: 'list-files',
            data: {}
          });
        }, 500); // Small delay to ensure files are flushed
        break;
        
      case 'cancelled':
        appendOutput(data);
        setStatus('Cancelled');
        setIsRunning(false);
        break;
        
      case 'error':
        appendOutput(data, true);
        setStatus('Error');
        setIsRunning(false);
        break;
        
      case 'file-uploaded':
        if (typeof data === 'string') {
          appendOutput(data);
        } else {
          appendOutput(`Uploaded: ${data.filename} (${data.size} bytes)`);
        }
        break;
        
      case 'file-deleted':
        if (typeof data === 'string') {
          appendOutput(data);
        } else {
          appendOutput(`Deleted: ${data.filename}`);
        }
        break;
        
      case 'file-not-found':
        appendOutput(data.message, true);
        break;
        
      case 'file-list':
        setVfsFiles(data);
        if (data.length === 0) {
          appendOutput('VFS is empty - no files found');
        } else {
          appendOutput(`VFS contains ${data.length} file(s):`);
          data.forEach((file: any) => {
            if (!file.isDirectory) {
              appendOutput(`  → ${file.name} (${file.size > 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${file.size} B`})`);
            }
          });
          appendOutput('Files available in Output Files panel below');
        }
        break;
        
      case 'file-content':
        // Trigger download when file content is received
        const blob = new Blob([data.content], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        appendOutput(`Downloaded: ${data.filename} (${data.size} bytes)`);
        break;
    }
  };

  const appendOutput = (text: string, isError: boolean = false) => {
    setOutput(prev => [...prev, { text, isError }]);
  };

  const clearOutput = () => {
    setOutput([]);
  };

  const listVFSFiles = () => {
    if (!isReady || !worker) {
      appendOutput('Worker not ready yet!', true);
      return;
    }

    worker.postMessage({
      type: 'list-files',
      data: {}
    });
  };

  const cancelRun = () => {
    if (!isRunning || !worker) {
      return;
    }

    appendOutput('Cancelling simulation and restarting worker...', true);
    
    // Terminate the current worker
    worker.terminate();
    setWorker(null);
    setIsReady(false);
    setIsRunning(false);
    setStatus('Cancelled - Restarting...');
    
    // Create a new worker after a short delay
    setTimeout(() => {
      initializeWorker();
    }, 500);
  };

  const downloadFile = (filename: string) => {
    if (!isReady || !worker) {
      appendOutput('Worker not ready yet!', true);
      return;
    }

    appendOutput(`Downloading ${filename}...`);
    worker.postMessage({
      type: 'get-file',
      data: { filename }
    });
  };

  const handleScriptChange = (newScript: string) => {
    setInputScript(newScript);
    setIsScriptModified(true);
    
    // If we have a selected file, update its content in memory
    if (selectedMainFile) {
      const updatedFiles = new Map(uploadedFiles);
      const encoder = new TextEncoder();
      const encodedContent = encoder.encode(newScript);
      updatedFiles.set(selectedMainFile, encodedContent.buffer);
      setUploadedFiles(updatedFiles);
    }
  };

  const resetScriptToOriginal = () => {
    setIsScriptModified(false);
    // This will trigger the useEffect to reload the original content
  };

  const runLammps = () => {
    if (!isReady || !worker) {
      appendOutput('LAMMPS worker not ready yet!', true);
      return;
    }

    setStatus('Running...');
    setIsRunning(true);

    try {
      const textAreaInput = inputScript.trim();

      if (selectedMainFile) {
        // If file has been modified, upload the current content first
        if (isScriptModified) {
          appendOutput(`Uploading edited version of ${selectedMainFile}...`);
          const encoder = new TextEncoder();
          const encodedContent = encoder.encode(inputScript);
          
          worker.postMessage({
            type: 'upload-file',
            data: {
              name: selectedMainFile,
              content: encodedContent.buffer
            }
          });
        }
        
        // Use selected main input file
        worker.postMessage({
          type: 'run-lammps',
          data: {
            inputFile: selectedMainFile
          }
        });
      } else if (textAreaInput) {
        // Use textarea input
        worker.postMessage({
          type: 'run-lammps',
          data: {
            inputContent: textAreaInput,
            inputFile: 'input.lmp'
          }
        });
      } else {
        throw new Error('No input provided! Either select a main input file or enter commands in the textarea.');
      }
    } catch (error) {
      appendOutput(`Error: ${error.message}`, true);
      setStatus('Error');
      setIsRunning(false);
    }
  };

  const handleFileUpload = (files: FileList) => {
    const newFiles = new Map(uploadedFiles);
    let filesProcessed = 0;
    const totalFiles = files.length;

    appendOutput(`Starting upload of ${totalFiles} file(s)...`);

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as ArrayBuffer;
        newFiles.set(file.name, content);
        filesProcessed++;

        appendOutput(`Read file: ${file.name} (${content.byteLength} bytes)`);

        // Update state when all files are processed
        if (filesProcessed === totalFiles) {
          setUploadedFiles(new Map(newFiles));

          // Send all new files to worker if ready
          if (worker && isReady) {
            appendOutput(`Sending ${totalFiles} file(s) to LAMMPS worker...`);
            Array.from(files).forEach(file => {
              let fileContent = newFiles.get(file.name);
              
              // If this is the currently selected and modified file, use the current script content
              if (file.name === selectedMainFile && isScriptModified && fileContent) {
                const encoder = new TextEncoder();
                fileContent = encoder.encode(inputScript).buffer;
              }
              
              if (fileContent) {
                worker.postMessage({
                  type: 'upload-file',
                  data: {
                    name: file.name,
                    content: fileContent
                  }
                });
              }
            });
          } else {
            appendOutput('Worker not ready, files will be uploaded when ready', true);
          }
        }
      };
      reader.onerror = () => {
        appendOutput(`Failed to read file: ${file.name}`, true);
        filesProcessed++;
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const deleteFile = (filename: string) => {
    const newFiles = new Map(uploadedFiles);
    newFiles.delete(filename);
    setUploadedFiles(newFiles);
    
    if (selectedMainFile === filename) {
      setSelectedMainFile('');
    }

    if (worker && isReady) {
      worker.postMessage({
        type: 'delete-file',
        data: { filename: filename }
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const inputFiles = Array.from(uploadedFiles.keys()).filter(
    filename => filename.endsWith('.lmp') || filename.endsWith('.in') || 
               filename.endsWith('.inp') || filename.includes('input')
  );

  return (
    <div className="container" style={{ maxWidth: 'none', padding: '1rem' }}>
      <div className="row" style={{ margin: 0 }}>
        <div className="col col--6" style={{ padding: '0 0.5rem 0 0' }}>
          <div className={styles.leftColumn}>
            {/* Files Panel */}
            <div className={`${styles.panel} ${styles.filesPanel}`}>
          <h3>Files</h3>
          <div 
            className={`${styles.fileUpload} ${isDragging ? styles.dragover : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <div>Click or drag files here</div>
            <small>Upload LAMMPS input files, data files, etc.</small>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            style={{ display: 'none' }}
          />
          
          {uploadedFiles.size > 0 && (
            <>
              <div className={styles.fileBadges}>
                {Array.from(uploadedFiles.keys()).map(filename => {
                  const isInputFile = filename.endsWith('.lmp') || filename.endsWith('.in') || 
                                    filename.endsWith('.inp') || filename.includes('input');
                  const isSelected = selectedMainFile === filename;
                  
                  return (
                    <div 
                      key={filename} 
                      className={`${styles.fileBadge} ${isSelected ? styles.selected : ''}`}
                      onClick={() => {
                        if (isInputFile) {
                          const newSelection = isSelected ? '' : filename;
                          setSelectedMainFile(newSelection);
                          setIsScriptModified(false); // Reset modification flag when changing files
                        }
                      }}
                      style={{ cursor: isInputFile ? 'pointer' : 'default' }}
                      title={isInputFile ? 'Click to select as main input file' : filename}
                    >
                      <span className={styles.fileBadgeText}>{filename}</span>
                      <button 
                        className={styles.deleteBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFile(filename);
                        }}
                        title="Delete file"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
              {inputFiles.length > 0 && (
                <div className={styles.inputFileHint}>
                  Click input files above to specify main input file
                </div>
              )}
            </>
          )}
        </div>

        {/* Script Panel */}
        <div className={`${styles.panel} ${styles.scriptPanel}`}>
          <h3>LAMMPS Script</h3>
          <textarea
            className={styles.inputScript}
            value={inputScript}
            onChange={(e) => handleScriptChange(e.target.value)}
            placeholder="Enter LAMMPS commands here or select an input file above..."
          />
          <div className={styles.buttonGroup}>
            {!isRunning ? (
              <button 
                onClick={runLammps} 
                disabled={!isReady}
                className="button button--primary"
              >
                Run LAMMPS
              </button>
            ) : (
              <button 
                onClick={cancelRun}
                className="button button--danger"
              >
                Cancel Run
              </button>
            )}
            <button onClick={clearOutput} className="button button--secondary">
              Clear Output
            </button>
            <button 
              onClick={listVFSFiles} 
              disabled={!isReady}
              className="button button--secondary"
            >
              List VFS Files
            </button>
          </div>
          <div className={styles.status}>Status: {status}</div>
            </div>
          </div>
        </div>

        <div className="col col--6" style={{ padding: '0 0 0 0.5rem' }}>
          <div className={styles.rightColumn}>
            {/* Output Panel */}
            <div className={`${styles.panel} ${styles.outputPanel}`}>
        <h3>Output</h3>
        <div ref={outputRef} className={styles.output}>
          {output.length === 0 ? (
            'Waiting for LAMMPS to initialize...'
          ) : (
            output.map((line, index) => (
              <div
                key={index}
                className={line.isError ? styles.error : ''}
              >
                {line.text}
              </div>
            ))
          )}
        </div>
      </div>

            {/* Output Files Panel - positioned below right panel */}
            {vfsFiles.length > 0 && (
              <div className={styles.outputFilesPanel}>
                <h3>Output Files</h3>
                <div className={styles.outputFilesList}>
                  {vfsFiles.filter(file => !file.isDirectory).map(file => (
                    <div key={file.name} className={styles.outputFileItem}>
                      <span className={styles.outputFileName}>{file.name}</span>
                      <button 
                        className="button button--primary button--sm"
                        onClick={() => downloadFile(file.name)}
                        disabled={!isReady}
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LammpsInterface;