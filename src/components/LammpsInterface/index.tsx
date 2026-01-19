import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import styles from './LammpsInterface.module.css';
import { TabId, DEFAULT_SCRIPT } from './types';
import { useLammpsWorker } from './hooks/useLammpsWorker';
import { useLocalStorage, restoreFilesFromState } from './hooks/useLocalStorage';
import { detectMainInputFile } from './utils/fileDetection';
import { parseLammpsDataFile, lammpsDataToPDB, LammpsDataFile } from './utils/lammpsDataParser';
import { InputTab } from './tabs/InputTab';
import { OutputTab } from './tabs/OutputTab';
import { ViewerTab } from './tabs/ViewerTab';

interface LammpsInterfaceProps {}

// Count frames in XYZ trajectory data
const countXYZFrames = (data: string): number => {
  const lines = data.trim().split('\n');
  let count = 0;
  let i = 0;
  while (i < lines.length) {
    const numAtoms = parseInt(lines[i], 10);
    if (!isNaN(numAtoms) && numAtoms > 0) {
      count++;
      i += numAtoms + 2;
    } else {
      i++;
    }
  }
  return count;
};

// Check if a file is a topology file (PDB, GRO, etc.)
const isTopologyFile = (filename: string): boolean => {
  return /\.(pdb|ent|pqr|gro)$/i.test(filename);
};

// Check if file is a LAMMPS coord/data file (for conversion to PDB)
const isLammpsCoordFile = (filename: string): boolean => {
  return /coord\.lmp$/i.test(filename) ||
         /data\.lmp$/i.test(filename) ||
         /\.data$/i.test(filename);
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'input', label: 'Input' },
  { id: 'output', label: 'Output' },
  { id: 'viewer', label: 'Viewer' },
];

const LammpsInterface: React.FC<LammpsInterfaceProps> = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('input');

  // File management state
  const [uploadedFiles, setUploadedFiles] = useState<Map<string, ArrayBuffer>>(new Map());
  const [selectedMainFile, setSelectedMainFile] = useState('');
  const [inputScript, setInputScript] = useState(DEFAULT_SCRIPT);
  const [isScriptModified, setIsScriptModified] = useState(false);

  // Local storage persistence
  const { savedState, saveInputs, saveOutputs, clearStorage, hasStoredData } = useLocalStorage();
  const hasRestoredRef = useRef(false);

  // Trajectory display state
  const [trajectoryData, setTrajectoryData] = useState<string | null>(null);
  const [trajectoryFormat, setTrajectoryFormat] = useState<'xyz' | 'dcd' | 'lammpstrj' | null>(null);
  const [trajectoryFilename, setTrajectoryFilename] = useState<string | null>(null);
  const [trajectoryBinaryContent, setTrajectoryBinaryContent] = useState<ArrayBuffer | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [lastFetchedSize, setLastFetchedSize] = useState(0);

  // Element mapping for LAMMPS atom types (type number -> element symbol)
  const [elementMapping, setElementMapping] = useState<Map<number, string>>(new Map());

  // Parse LAMMPS data file and extract info (without converting to PDB yet)
  const lammpsData = useMemo((): { data: LammpsDataFile; filename: string } | null => {
    console.log('[LAMMPS Debug] Checking uploaded files:', Array.from(uploadedFiles.keys()));
    for (const [name, content] of uploadedFiles) {
      console.log(`[LAMMPS Debug] File "${name}" - isLammpsCoordFile: ${isLammpsCoordFile(name)}`);
      if (isLammpsCoordFile(name)) {
        try {
          const text = new TextDecoder().decode(content);
          const parsed = parseLammpsDataFile(text);
          console.log('[LAMMPS Debug] Parsed result:', parsed ? {
            atoms: parsed.atoms.length,
            bonds: parsed.bonds.length,
            masses: parsed.masses,
            atomTypes: parsed.atomTypes
          } : null);
          if (parsed) {
            return { data: parsed, filename: name };
          }
        } catch (e) {
          console.warn('Failed to parse LAMMPS data file:', e);
        }
      }
    }
    return null;
  }, [uploadedFiles]);

  // Initialize element mapping from masses when LAMMPS data is loaded
  useEffect(() => {
    if (lammpsData && elementMapping.size === 0) {
      const newMapping = new Map<number, string>();

      if (lammpsData.data.masses.length > 0) {
        // Use masses to guess elements
        for (const { type, mass } of lammpsData.data.masses) {
          const elements: [number, string][] = [
            [1.008, 'H'], [12.01, 'C'], [14.01, 'N'], [16.00, 'O'],
            [19.00, 'F'], [32.06, 'S'], [35.45, 'Cl'], [39.95, 'Ar'],
          ];
          let closest = 'X';
          let minDiff = Infinity;
          for (const [m, el] of elements) {
            const diff = Math.abs(mass - m);
            if (diff < minDiff) {
              minDiff = diff;
              closest = el;
            }
          }
          newMapping.set(type, minDiff < 1.5 ? closest : 'X');
        }
      } else if (lammpsData.data.atomTypes > 0) {
        // No masses section - initialize mapping from atomTypes count
        // Default all to 'X', user can change via UI
        for (let i = 1; i <= lammpsData.data.atomTypes; i++) {
          newMapping.set(i, 'X');
        }
        console.log('[LAMMPS Debug] No masses found, initialized default mapping for', lammpsData.data.atomTypes, 'types');
      }

      setElementMapping(newMapping);
    }
  }, [lammpsData, elementMapping.size]);

  // Find topology file from uploaded files (for DCD trajectories or initial structure view)
  // Priority: PDB files first, then convert LAMMPS data files to PDB
  const topologyFile = useMemo(() => {
    // First check for native PDB/GRO files
    for (const [name, content] of uploadedFiles) {
      if (isTopologyFile(name)) {
        console.log('[LAMMPS Debug] Found native topology file:', name);
        return { name, content, hasExplicitBonds: true };
      }
    }

    // If no PDB but we have parsed LAMMPS data, convert to PDB with current element mapping
    if (lammpsData) {
      console.log('[LAMMPS Debug] Converting LAMMPS data to PDB with element mapping:',
        Object.fromEntries(elementMapping));
      const pdbContent = lammpsDataToPDB(lammpsData.data, elementMapping.size > 0 ? elementMapping : undefined);
      console.log('[LAMMPS Debug] Generated PDB (first 500 chars):', pdbContent.substring(0, 500));
      console.log('[LAMMPS Debug] PDB has CONECT records:', pdbContent.includes('CONECT'));
      const encoder = new TextEncoder();
      return {
        name: lammpsData.filename.replace(/\.\w+$/, '.pdb'),
        content: encoder.encode(pdbContent).buffer,
        hasExplicitBonds: lammpsData.data.bonds.length > 0
      };
    }

    console.log('[LAMMPS Debug] No topology file found');
    return null;
  }, [uploadedFiles, lammpsData, elementMapping]);

  // Create atom type info for UI - either from masses or synthesized from atomTypes count
  const atomTypeInfo = useMemo(() => {
    if (!lammpsData) return undefined;

    if (lammpsData.data.masses.length > 0) {
      return lammpsData.data.masses;
    }

    // No masses section - create synthetic entries based on atomTypes count
    if (lammpsData.data.atomTypes > 0) {
      const synthetic: { type: number; mass: number }[] = [];
      for (let i = 1; i <= lammpsData.data.atomTypes; i++) {
        synthetic.push({ type: i, mass: 0 }); // mass 0 indicates unknown
      }
      return synthetic;
    }

    return undefined;
  }, [lammpsData]);

  // Worker hook - now returns trajectory state directly
  const {
    worker,
    isReady,
    isRunning,
    status,
    output,
    vfsFiles,
    trajectoryFiles,
    trajectoryContent,
    appendOutput,
    clearOutput,
    uploadFile,
    deleteFile: workerDeleteFile,
    runSimulation,
    cancelSimulation,
    listFiles,
    getFile,
    getFileContentAsText,
    pollTrajectory,
    fetchTrajectory,
    clearTrajectoryContent,
    reuploadFiles,
  } = useLammpsWorker();

  // Restore from local storage on mount (once worker is ready)
  useEffect(() => {
    if (!hasRestoredRef.current && savedState && isReady) {
      hasRestoredRef.current = true;

      // Restore uploaded files
      if (savedState.uploadedFiles && Object.keys(savedState.uploadedFiles).length > 0) {
        const restoredFiles = restoreFilesFromState(savedState.uploadedFiles);
        setUploadedFiles(restoredFiles);

        // Upload to worker
        restoredFiles.forEach((content, filename) => {
          uploadFile(filename, content);
        });
      }

      // Restore selected file and script
      if (savedState.selectedMainFile) {
        setSelectedMainFile(savedState.selectedMainFile);
      }
      if (savedState.inputScript) {
        setInputScript(savedState.inputScript);
      }

      // Restore output
      if (savedState.output && savedState.output.length > 0) {
        savedState.output.forEach(line => appendOutput(line.text, line.isError));
      }

      console.log('[LAMMPS] Restored state from local storage');
    }
  }, [savedState, isReady, uploadFile, appendOutput]);

  // Save outputs when simulation completes
  useEffect(() => {
    if (status === 'Complete' && output.length > 0) {
      saveOutputs(output);
    }
  }, [status, output, saveOutputs]);

  // Trajectory polling state
  const [isPolling, setIsPolling] = useState(false);

  // When trajectory files are found, fetch the content
  useEffect(() => {
    if (trajectoryFiles.length > 0) {
      // Prefer DCD (binary, proper trajectory format with topology-based bonds)
      const dcdFile = trajectoryFiles.find(f => f.format === 'dcd');
      const targetFile = dcdFile || trajectoryFiles[0];

      // Only fetch if size changed (new content available)
      if (targetFile.size > lastFetchedSize) {
        fetchTrajectory(targetFile.filename);
      }
    }
  }, [trajectoryFiles, lastFetchedSize, fetchTrajectory]);

  // When trajectory content is received, parse and display it
  useEffect(() => {
    if (trajectoryContent && trajectoryContent.size > 0) {
      setLastFetchedSize(trajectoryContent.size);

      // Determine format from filename
      let format: 'xyz' | 'dcd' | 'lammpstrj' = 'xyz';
      if (/\.dcd$/i.test(trajectoryContent.filename)) format = 'dcd';
      else if (/\.lammpstrj$/i.test(trajectoryContent.filename)) format = 'lammpstrj';

      setTrajectoryFormat(format);
      setTrajectoryFilename(trajectoryContent.filename);

      if (format === 'xyz' || format === 'lammpstrj') {
        // Text-based trajectory
        const text = new TextDecoder().decode(trajectoryContent.content);
        setTrajectoryData(text);
        setTrajectoryBinaryContent(null);
        const frames = countXYZFrames(text);
        setFrameCount(frames);
      } else if (format === 'dcd') {
        // Binary trajectory - store the raw content
        setTrajectoryData(null);
        setTrajectoryBinaryContent(trajectoryContent.content.buffer);
        // DCD frame count will be determined by the viewer
        setFrameCount(0);
      }
    }
  }, [trajectoryContent]);

  // Start/stop polling based on simulation running state
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    if (isRunning) {
      setIsPolling(true);
      // Start polling every 2 seconds
      pollInterval = setInterval(() => {
        pollTrajectory();
      }, 2000);
    } else {
      setIsPolling(false);
      // Final poll after simulation ends
      if (worker) {
        setTimeout(() => {
          pollTrajectory();
        }, 500);
      }
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isRunning, worker, pollTrajectory]);

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
        setInputScript(DEFAULT_SCRIPT);
      }
    }
  }, [selectedMainFile, uploadedFiles, isScriptModified]);

  // Keep worker in sync with uploaded files
  useEffect(() => {
    reuploadFiles(uploadedFiles);
  }, [uploadedFiles, reuploadFiles]);

  // Handle file upload
  const handleFileUpload = useCallback((files: FileList) => {
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

        if (filesProcessed === totalFiles) {
          setUploadedFiles(new Map(newFiles));

          // Auto-detect main input file if none selected
          if (!selectedMainFile) {
            const detected = detectMainInputFile(Array.from(newFiles.keys()));
            if (detected) {
              setSelectedMainFile(detected);
              appendOutput(`Auto-detected main input file: ${detected}`);
            }
          }

          // Upload to worker
          if (worker && isReady) {
            appendOutput(`Sending ${totalFiles} file(s) to LAMMPS worker...`);
            Array.from(files).forEach(file => {
              const fileContent = newFiles.get(file.name);
              if (fileContent) {
                uploadFile(file.name, fileContent);
              }
            });
          }
        }
      };
      reader.onerror = () => {
        appendOutput(`Failed to read file: ${file.name}`, true);
        filesProcessed++;
      };
      reader.readAsArrayBuffer(file);
    });
  }, [uploadedFiles, selectedMainFile, worker, isReady, appendOutput, uploadFile]);

  // Handle file deletion
  const handleFileDelete = useCallback((filename: string) => {
    const newFiles = new Map(uploadedFiles);
    newFiles.delete(filename);
    setUploadedFiles(newFiles);

    if (selectedMainFile === filename) {
      setSelectedMainFile('');
      setIsScriptModified(false);
    }

    workerDeleteFile(filename);
  }, [uploadedFiles, selectedMainFile, workerDeleteFile]);

  // Handle main file selection
  const handleMainFileSelect = useCallback((filename: string) => {
    setSelectedMainFile(filename);
    setIsScriptModified(false);
  }, []);

  // Handle script change
  const handleScriptChange = useCallback((newScript: string) => {
    setInputScript(newScript);
    setIsScriptModified(true);

    // Update file content in memory if we have a selected file
    if (selectedMainFile) {
      const encoder = new TextEncoder();
      const updatedFiles = new Map(uploadedFiles);
      updatedFiles.set(selectedMainFile, encoder.encode(newScript).buffer);
      setUploadedFiles(updatedFiles);
    }
  }, [selectedMainFile, uploadedFiles]);

  // Handle clearing storage and resetting state
  const handleClearStorage = useCallback(() => {
    // Clear localStorage
    clearStorage();

    // Reset all component state
    setUploadedFiles(new Map());
    setSelectedMainFile('');
    setInputScript(DEFAULT_SCRIPT);
    setIsScriptModified(false);

    // Clear trajectory state
    setTrajectoryData(null);
    setTrajectoryFormat(null);
    setTrajectoryFilename(null);
    setTrajectoryBinaryContent(null);
    setFrameCount(0);
    setLastFetchedSize(0);
    clearTrajectoryContent();

    // Clear element mapping
    setElementMapping(new Map());

    // Clear output
    clearOutput();

    // Switch to input tab
    setActiveTab('input');

    appendOutput('Cleared all saved data and reset state.');
  }, [clearStorage, clearOutput, clearTrajectoryContent, appendOutput]);

  // Handle run
  const handleRun = useCallback(() => {
    // Save state to local storage before running
    saveInputs(uploadedFiles, selectedMainFile, inputScript);

    // Clear previous output and charts
    clearOutput();

    // Clear previous trajectory
    setTrajectoryData(null);
    setTrajectoryFormat(null);
    setTrajectoryFilename(null);
    setTrajectoryBinaryContent(null);
    setFrameCount(0);
    setLastFetchedSize(0);
    clearTrajectoryContent();

    try {
      const scriptContent = inputScript.trim();

      if (selectedMainFile) {
        // Upload edited content if modified
        if (isScriptModified) {
          appendOutput(`Uploading edited version of ${selectedMainFile}...`);
          const encoder = new TextEncoder();
          uploadFile(selectedMainFile, encoder.encode(inputScript).buffer);
        }
        runSimulation(selectedMainFile);
      } else if (scriptContent) {
        runSimulation('input.lmp', scriptContent);
      } else {
        appendOutput('No input provided! Either select a main input file or enter commands.', true);
      }
    } catch (error) {
      appendOutput(`Error: ${(error as Error).message}`, true);
    }
  }, [inputScript, selectedMainFile, isScriptModified, appendOutput, uploadFile, runSimulation, clearTrajectoryContent, clearOutput, saveInputs, uploadedFiles]);

  // Count errors for badge
  const errorCount = output.filter(line => line.isError).length;

  return (
    <div className={styles.container}>
      {/* Tab bar */}
      <div className={styles.tabBar}>
        <div className={styles.tabBarTabs}>
          {TABS.map(({ id, label }) => {
            const isActive = activeTab === id;
            const badge = id === 'output' && errorCount > 0 ? errorCount :
                         id === 'viewer' && frameCount > 0 ? frameCount : undefined;

            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`${styles.tabButton} ${isActive ? styles.tabButtonActive : ''}`}
              >
                {label}
                {badge !== undefined && (
                  <span className={`${styles.tabBadge} ${id === 'output' && errorCount > 0 ? styles.tabBadgeError : ''}`}>
                    {badge}
                  </span>
                )}
                {id === 'viewer' && isPolling && (
                  <span className={styles.liveDotSmall} />
                )}
              </button>
            );
          })}
        </div>
        <button
          className={styles.clearStorageBtn}
          onClick={handleClearStorage}
          disabled={isRunning}
          title="Clear saved state and reset"
        >
          Clear
        </button>
      </div>

      {/* Tab content */}
      <div className={styles.tabContentWrapper}>
        {activeTab === 'input' && (
          <InputTab
            uploadedFiles={uploadedFiles}
            selectedMainFile={selectedMainFile}
            inputScript={inputScript}
            isReady={isReady}
            isRunning={isRunning}
            status={status}
            onFileUpload={handleFileUpload}
            onFileDelete={handleFileDelete}
            onMainFileSelect={handleMainFileSelect}
            onScriptChange={handleScriptChange}
            onRun={handleRun}
            onCancel={cancelSimulation}
          />
        )}

        {activeTab === 'output' && (
          <OutputTab
            output={output}
            vfsFiles={vfsFiles}
            isReady={isReady}
            isRunning={isRunning}
            onClearOutput={clearOutput}
            onListFiles={listFiles}
            onDownloadFile={getFile}
            onFetchFileContent={getFileContentAsText}
          />
        )}

        {activeTab === 'viewer' && (
          <ViewerTab
            trajectoryData={trajectoryData}
            trajectoryFormat={trajectoryFormat}
            trajectoryFilename={trajectoryFilename}
            frameCount={frameCount}
            isSimulationRunning={isRunning}
            isPolling={isPolling}
            topologyFile={topologyFile}
            trajectoryBinaryContent={trajectoryBinaryContent}
            atomTypes={atomTypeInfo}
            elementMapping={elementMapping}
            onElementMappingChange={setElementMapping}
            bonds={lammpsData?.data.bonds.map(b => [b.atom1, b.atom2] as [number, number])}
          />
        )}
      </div>
    </div>
  );
};

export default LammpsInterface;
