import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'lammps-interface-state';

interface StoredState {
  uploadedFiles: Record<string, string>; // filename -> base64 content
  selectedMainFile: string | null;
  inputScript: string;
  output: Array<{ text: string; isError: boolean }>;
  savedAt: number;
}

interface UseLocalStorageReturn {
  savedState: StoredState | null;
  saveInputs: (
    uploadedFiles: Map<string, ArrayBuffer>,
    selectedMainFile: string | null,
    inputScript: string
  ) => void;
  saveOutputs: (output: Array<{ text: string; isError: boolean }>) => void;
  clearStorage: () => void;
  hasStoredData: boolean;
}

// Convert ArrayBuffer to base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Convert base64 to ArrayBuffer
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

export function useLocalStorage(): UseLocalStorageReturn {
  const [savedState, setSavedState] = useState<StoredState | null>(null);
  const [hasStoredData, setHasStoredData] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StoredState;
        setSavedState(parsed);
        setHasStoredData(true);
      }
    } catch (e) {
      console.warn('Failed to load from localStorage:', e);
    }
  }, []);

  const saveInputs = useCallback((
    uploadedFiles: Map<string, ArrayBuffer>,
    selectedMainFile: string | null,
    inputScript: string
  ) => {
    try {
      // Convert uploaded files to base64
      const filesRecord: Record<string, string> = {};
      uploadedFiles.forEach((content, filename) => {
        filesRecord[filename] = arrayBufferToBase64(content);
      });

      const state: StoredState = {
        uploadedFiles: filesRecord,
        selectedMainFile,
        inputScript,
        output: [],
        savedAt: Date.now(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSavedState(state);
      setHasStoredData(true);
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }, []);

  const saveOutputs = useCallback((output: Array<{ text: string; isError: boolean }>) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored) as StoredState;
        // Only save last 500 lines to avoid storage limits
        state.output = output.slice(-500);
        state.savedAt = Date.now();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        setSavedState(state);
      }
    } catch (e) {
      console.warn('Failed to save outputs to localStorage:', e);
    }
  }, []);

  const clearStorage = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setSavedState(null);
      setHasStoredData(false);
    } catch (e) {
      console.warn('Failed to clear localStorage:', e);
    }
  }, []);

  return {
    savedState,
    saveInputs,
    saveOutputs,
    clearStorage,
    hasStoredData,
  };
}

// Helper to restore files from stored state
export function restoreFilesFromState(
  storedFiles: Record<string, string>
): Map<string, ArrayBuffer> {
  const files = new Map<string, ArrayBuffer>();
  for (const [filename, base64] of Object.entries(storedFiles)) {
    files.set(filename, base64ToArrayBuffer(base64));
  }
  return files;
}
