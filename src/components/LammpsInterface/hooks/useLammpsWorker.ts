import { useState, useEffect, useCallback, useRef } from 'react';
import { OutputLine, VfsFile, TrajectoryInfo } from '../types';

interface UseLammpsWorkerReturn {
  worker: Worker | null;
  isReady: boolean;
  isRunning: boolean;
  status: string;
  output: OutputLine[];
  vfsFiles: VfsFile[];
  trajectoryFiles: TrajectoryInfo[];
  trajectoryContent: { filename: string; content: Uint8Array; size: number } | null;
  appendOutput: (text: string, isError?: boolean) => void;
  clearOutput: () => void;
  uploadFile: (name: string, content: ArrayBuffer) => void;
  deleteFile: (filename: string) => void;
  runSimulation: (inputFile: string, inputContent?: string) => void;
  cancelSimulation: () => void;
  listFiles: () => void;
  getFile: (filename: string) => void;
  getFileContentAsText: (filename: string) => Promise<string | null>;
  pollTrajectory: () => void;
  fetchTrajectory: (filename: string) => void;
  clearTrajectoryContent: () => void;
  reuploadFiles: (files: Map<string, ArrayBuffer>) => void;
}

export function useLammpsWorker(): UseLammpsWorkerReturn {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState('Loading LAMMPS...');
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [vfsFiles, setVfsFiles] = useState<VfsFile[]>([]);
  const [trajectoryFiles, setTrajectoryFiles] = useState<TrajectoryInfo[]>([]);
  const [trajectoryContent, setTrajectoryContent] = useState<{ filename: string; content: Uint8Array; size: number } | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const pendingFilesRef = useRef<Map<string, ArrayBuffer>>(new Map());
  const fileContentResolversRef = useRef<Map<string, (content: string | null) => void>>(new Map());

  // Use ref to always have latest state in message handler
  const stateRef = useRef({ isReady, pendingFiles: pendingFilesRef.current });
  stateRef.current = { isReady, pendingFiles: pendingFilesRef.current };

  const appendOutput = useCallback((text: string, isError: boolean = false) => {
    setOutput(prev => [...prev, { text, isError }]);
  }, []);

  const clearOutput = useCallback(() => {
    setOutput([]);
  }, []);

  const clearTrajectoryContent = useCallback(() => {
    setTrajectoryContent(null);
    setTrajectoryFiles([]);
  }, []);

  // Initialize worker on mount
  useEffect(() => {
    const initializeWorker = async () => {
      try {
        setOutput(prev => [...prev, { text: 'Creating LAMMPS Web Worker...', isError: false }]);

        const newWorker = new Worker(
          new URL('../lammps-worker.js', import.meta.url),
          { type: 'module' }
        );

        // Message handler with direct state updates
        newWorker.onmessage = (e: MessageEvent) => {
          const { type, data } = e.data;
          const currentWorker = e.target as Worker;

          switch (type) {
            case 'ready':
              setOutput(prev => [...prev, { text: data, isError: false }]);
              // Upload any pending files
              const pending = pendingFilesRef.current;
              if (pending.size > 0) {
                setOutput(prev => [...prev, { text: `Re-uploading ${pending.size} file(s) to new worker...`, isError: false }]);
                for (const [filename, content] of pending) {
                  currentWorker.postMessage({
                    type: 'upload-file',
                    data: { name: filename, content }
                  });
                }
              }
              setStatus('Ready');
              setIsReady(true);
              break;

            case 'stdout':
              setOutput(prev => [...prev, { text: data, isError: false }]);
              break;

            case 'stderr':
              setOutput(prev => [...prev, { text: data, isError: true }]);
              break;

            case 'completed':
              setOutput(prev => [...prev, { text: data.message, isError: false }]);
              setOutput(prev => [...prev, { text: 'Checking for output files...', isError: false }]);
              setStatus('Complete');
              setIsRunning(false);
              // List files after completion
              setTimeout(() => {
                currentWorker.postMessage({ type: 'list-files', data: {} });
              }, 500);
              break;

            case 'cancelled':
              setOutput(prev => [...prev, { text: data, isError: false }]);
              setStatus('Cancelled');
              setIsRunning(false);
              break;

            case 'error':
              setOutput(prev => [...prev, { text: data, isError: true }]);
              setStatus('Error');
              setIsRunning(false);
              break;

            case 'file-uploaded':
              if (typeof data === 'string') {
                setOutput(prev => [...prev, { text: data, isError: false }]);
              } else {
                setOutput(prev => [...prev, { text: `Uploaded: ${data.filename} (${data.size} bytes)`, isError: false }]);
              }
              break;

            case 'file-deleted':
              if (typeof data === 'string') {
                setOutput(prev => [...prev, { text: data, isError: false }]);
              } else {
                setOutput(prev => [...prev, { text: `Deleted: ${data.filename}`, isError: false }]);
              }
              break;

            case 'file-not-found':
              setOutput(prev => [...prev, { text: data.message, isError: true }]);
              break;

            case 'file-list':
              setVfsFiles(data);
              if (data.length === 0) {
                setOutput(prev => [...prev, { text: 'VFS is empty - no files found', isError: false }]);
              } else {
                setOutput(prev => [...prev, { text: `VFS contains ${data.length} file(s):`, isError: false }]);
                data.forEach((file: VfsFile) => {
                  if (!file.isDirectory) {
                    const sizeStr = file.size > 1024
                      ? `${(file.size / 1024).toFixed(1)} KB`
                      : `${file.size} B`;
                    setOutput(prev => [...prev, { text: `  → ${file.name} (${sizeStr})`, isError: false }]);
                  }
                });
              }
              break;

            case 'file-content':
              // Check if there's a pending resolver for this file (async fetch)
              const resolver = fileContentResolversRef.current.get(data.filename);
              if (resolver) {
                // Return content as text
                const textContent = new TextDecoder().decode(data.content);
                resolver(textContent);
                fileContentResolversRef.current.delete(data.filename);
              } else {
                // Trigger download (legacy behavior)
                const blob = new Blob([data.content], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = data.filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                setOutput(prev => [...prev, { text: `Downloaded: ${data.filename} (${data.size} bytes)`, isError: false }]);
              }
              break;

            case 'trajectory-files':
              setTrajectoryFiles(data);
              break;

            case 'trajectory-content':
              setTrajectoryContent(data);
              break;
          }
        };

        newWorker.onerror = (error) => {
          setOutput(prev => [...prev, { text: `Worker error: ${error.message}`, isError: true }]);
          setStatus('Error');
        };

        setWorker(newWorker);
        workerRef.current = newWorker;
        setOutput(prev => [...prev, { text: 'Web Worker created, initializing LAMMPS...', isError: false }]);

        newWorker.postMessage({ type: 'init' });
      } catch (error) {
        setOutput(prev => [...prev, { text: `Failed to create worker: ${(error as Error).message}`, isError: true }]);
        setStatus('Error');
      }
    };

    initializeWorker();

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const uploadFile = useCallback((name: string, content: ArrayBuffer) => {
    pendingFilesRef.current.set(name, content);
    if (workerRef.current && isReady) {
      workerRef.current.postMessage({
        type: 'upload-file',
        data: { name, content }
      });
    }
  }, [isReady]);

  const deleteFile = useCallback((filename: string) => {
    pendingFilesRef.current.delete(filename);
    if (workerRef.current && isReady) {
      workerRef.current.postMessage({
        type: 'delete-file',
        data: { filename }
      });
    }
  }, [isReady]);

  const runSimulation = useCallback((inputFile: string, inputContent?: string) => {
    if (!isReady || !workerRef.current) {
      setOutput(prev => [...prev, { text: 'LAMMPS worker not ready yet!', isError: true }]);
      return;
    }

    setStatus('Running...');
    setIsRunning(true);

    workerRef.current.postMessage({
      type: 'run-lammps',
      data: {
        inputFile,
        inputContent
      }
    });
  }, [isReady]);

  // Create message handler - used for both initial setup and restart after cancel
  const createMessageHandler = useCallback(() => {
    return (e: MessageEvent) => {
      const { type, data } = e.data;
      const currentWorker = e.target as Worker;

      switch (type) {
        case 'ready':
          setOutput(prev => [...prev, { text: data, isError: false }]);
          // Upload any pending files
          const pending = pendingFilesRef.current;
          if (pending.size > 0) {
            setOutput(prev => [...prev, { text: `Re-uploading ${pending.size} file(s) to new worker...`, isError: false }]);
            for (const [filename, content] of pending) {
              currentWorker.postMessage({
                type: 'upload-file',
                data: { name: filename, content }
              });
            }
          }
          setStatus('Ready');
          setIsReady(true);
          break;

        case 'stdout':
          setOutput(prev => [...prev, { text: data, isError: false }]);
          break;

        case 'stderr':
          setOutput(prev => [...prev, { text: data, isError: true }]);
          break;

        case 'completed':
          setOutput(prev => [...prev, { text: data.message, isError: false }]);
          setOutput(prev => [...prev, { text: 'Checking for output files...', isError: false }]);
          setStatus('Complete');
          setIsRunning(false);
          // List files after completion
          setTimeout(() => {
            currentWorker.postMessage({ type: 'list-files', data: {} });
          }, 500);
          break;

        case 'cancelled':
          setOutput(prev => [...prev, { text: data, isError: false }]);
          setStatus('Cancelled');
          setIsRunning(false);
          break;

        case 'error':
          setOutput(prev => [...prev, { text: data, isError: true }]);
          setStatus('Error');
          setIsRunning(false);
          break;

        case 'file-uploaded':
          if (typeof data === 'string') {
            setOutput(prev => [...prev, { text: data, isError: false }]);
          } else {
            setOutput(prev => [...prev, { text: `Uploaded: ${data.filename} (${data.size} bytes)`, isError: false }]);
          }
          break;

        case 'file-deleted':
          if (typeof data === 'string') {
            setOutput(prev => [...prev, { text: data, isError: false }]);
          } else {
            setOutput(prev => [...prev, { text: `Deleted: ${data.filename}`, isError: false }]);
          }
          break;

        case 'file-not-found':
          setOutput(prev => [...prev, { text: data.message, isError: true }]);
          break;

        case 'file-list':
          setVfsFiles(data);
          if (data.length === 0) {
            setOutput(prev => [...prev, { text: 'VFS is empty - no files found', isError: false }]);
          } else {
            setOutput(prev => [...prev, { text: `VFS contains ${data.length} file(s):`, isError: false }]);
            data.forEach((file: VfsFile) => {
              if (!file.isDirectory) {
                const sizeStr = file.size > 1024
                  ? `${(file.size / 1024).toFixed(1)} KB`
                  : `${file.size} B`;
                setOutput(prev => [...prev, { text: `  → ${file.name} (${sizeStr})`, isError: false }]);
              }
            });
          }
          break;

        case 'file-content':
          // Check if there's a pending resolver for this file (async fetch)
          const resolver = fileContentResolversRef.current.get(data.filename);
          if (resolver) {
            // Return content as text
            const textContent = new TextDecoder().decode(data.content);
            resolver(textContent);
            fileContentResolversRef.current.delete(data.filename);
          } else {
            // Trigger download (legacy behavior)
            const blob = new Blob([data.content], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = data.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setOutput(prev => [...prev, { text: `Downloaded: ${data.filename} (${data.size} bytes)`, isError: false }]);
          }
          break;

        case 'trajectory-files':
          setTrajectoryFiles(data);
          break;

        case 'trajectory-content':
          setTrajectoryContent(data);
          break;
      }
    };
  }, []);

  const cancelSimulation = useCallback(() => {
    if (!isRunning || !workerRef.current) return;

    setOutput(prev => [...prev, { text: 'Cancelling simulation and restarting worker...', isError: true }]);

    workerRef.current.terminate();
    workerRef.current = null;
    setWorker(null);
    setIsReady(false);
    setIsRunning(false);
    setStatus('Cancelled - Restarting...');

    // Reinitialize after delay
    setTimeout(() => {
      const newWorker = new Worker(
        new URL('../lammps-worker.js', import.meta.url),
        { type: 'module' }
      );

      newWorker.onmessage = createMessageHandler();

      newWorker.onerror = (error) => {
        setOutput(prev => [...prev, { text: `Worker error: ${error.message}`, isError: true }]);
        setStatus('Error');
      };

      setWorker(newWorker);
      workerRef.current = newWorker;
      newWorker.postMessage({ type: 'init' });
    }, 500);
  }, [isRunning, createMessageHandler]);

  const listFiles = useCallback(() => {
    if (!isReady || !workerRef.current) {
      setOutput(prev => [...prev, { text: 'Worker not ready yet!', isError: true }]);
      return;
    }
    workerRef.current.postMessage({ type: 'list-files', data: {} });
  }, [isReady]);

  const getFile = useCallback((filename: string) => {
    if (!isReady || !workerRef.current) {
      setOutput(prev => [...prev, { text: 'Worker not ready yet!', isError: true }]);
      return;
    }
    setOutput(prev => [...prev, { text: `Downloading ${filename}...`, isError: false }]);
    workerRef.current.postMessage({ type: 'get-file', data: { filename } });
  }, [isReady]);

  const getFileContentAsText = useCallback((filename: string): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!isReady || !workerRef.current) {
        resolve(null);
        return;
      }
      // Check if already fetching this file - prevent duplicate requests
      if (fileContentResolversRef.current.has(filename)) {
        resolve(null);
        return;
      }
      // Register resolver for this file
      fileContentResolversRef.current.set(filename, resolve);
      // Request file content
      workerRef.current.postMessage({ type: 'get-file', data: { filename } });
      // Timeout after 10 seconds
      setTimeout(() => {
        if (fileContentResolversRef.current.has(filename)) {
          fileContentResolversRef.current.delete(filename);
          resolve(null);
        }
      }, 10000);
    });
  }, [isReady]);

  const pollTrajectory = useCallback(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: 'poll-trajectory', data: {} });
  }, []);

  const fetchTrajectory = useCallback((filename: string) => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: 'get-trajectory', data: { filename } });
  }, []);

  const reuploadFiles = useCallback((files: Map<string, ArrayBuffer>) => {
    pendingFilesRef.current = new Map(files);
  }, []);

  return {
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
    deleteFile,
    runSimulation,
    cancelSimulation,
    listFiles,
    getFile,
    getFileContentAsText,
    pollTrajectory,
    fetchTrajectory,
    clearTrajectoryContent,
    reuploadFiles,
  };
}
