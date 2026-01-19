import { useState, useEffect, useCallback, useRef } from 'react';
import { TrajectoryInfo } from '../types';
import { getTrajectoryFormat } from '../utils/fileDetection';

interface UseTrajectoryPollingOptions {
  pollInterval?: number; // milliseconds
  onFrameCountUpdate?: (count: number) => void;
}

interface UseTrajectoryPollingReturn {
  trajectoryData: string | null;
  trajectoryBinaryContent: ArrayBuffer | null;  // For binary formats like DCD
  trajectoryFormat: 'xyz' | 'dcd' | 'lammpstrj' | null;
  trajectoryFilename: string | null;
  frameCount: number;
  lastFileSize: number;
  isPolling: boolean;
  startPolling: () => void;
  stopPolling: () => void;
  clearTrajectory: () => void;
}

/**
 * Hook for polling trajectory files during LAMMPS simulation
 */
export function useTrajectoryPolling(
  worker: Worker | null,
  isRunning: boolean,
  options: UseTrajectoryPollingOptions = {}
): UseTrajectoryPollingReturn {
  const { pollInterval = 2000, onFrameCountUpdate } = options;

  const [trajectoryData, setTrajectoryData] = useState<string | null>(null);
  const [trajectoryBinaryContent, setTrajectoryBinaryContent] = useState<ArrayBuffer | null>(null);
  const [trajectoryFormat, setTrajectoryFormat] = useState<'xyz' | 'dcd' | 'lammpstrj' | null>(null);
  const [trajectoryFilename, setTrajectoryFilename] = useState<string | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [lastFileSize, setLastFileSize] = useState(0);
  const [isPolling, setIsPolling] = useState(false);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wasRunningRef = useRef(false);

  // Count frames in XYZ data
  const countXYZFrames = useCallback((data: string): number => {
    const lines = data.trim().split('\n');
    let count = 0;
    let i = 0;
    while (i < lines.length) {
      const numAtoms = parseInt(lines[i], 10);
      if (!isNaN(numAtoms) && numAtoms > 0) {
        count++;
        // Skip to next frame: numAtoms line + comment line + atom lines
        i += numAtoms + 2;
      } else {
        i++;
      }
    }
    return count;
  }, []);

  // Parse DCD header to get frame count
  const parseDCDFrameCount = useCallback((buffer: ArrayBuffer): number => {
    try {
      const view = new DataView(buffer);
      // DCD header: first 4 bytes are block size, then 4 bytes 'CORD', then nframes at offset 8
      // Actually LAMMPS DCD: offset 8 is number of frames (little-endian int32)
      if (buffer.byteLength < 100) return 0;
      const nframes = view.getInt32(8, true); // little-endian
      return nframes > 0 ? nframes : 0;
    } catch {
      return 0;
    }
  }, []);

  // Handle trajectory content received from worker
  const handleTrajectoryContent = useCallback((data: { filename: string; content: Uint8Array; size: number }) => {
    const format = getTrajectoryFormat(data.filename);
    setTrajectoryFormat(format);
    setTrajectoryFilename(data.filename);
    setLastFileSize(data.size);

    if (format === 'xyz' || format === 'lammpstrj') {
      // Text-based format
      const text = new TextDecoder().decode(data.content);
      setTrajectoryData(text);
      setTrajectoryBinaryContent(null);
      const frames = countXYZFrames(text);
      setFrameCount(frames);
      onFrameCountUpdate?.(frames);
    } else if (format === 'dcd') {
      // Binary format - store as ArrayBuffer
      const buffer = data.content.buffer.slice(
        data.content.byteOffset,
        data.content.byteOffset + data.content.byteLength
      );
      setTrajectoryBinaryContent(buffer);
      setTrajectoryData(null);
      const frames = parseDCDFrameCount(buffer);
      setFrameCount(frames);
      onFrameCountUpdate?.(frames);
    }
  }, [countXYZFrames, parseDCDFrameCount, onFrameCountUpdate]);

  // Handle trajectory files list from polling
  const handleTrajectoryFiles = useCallback((files: TrajectoryInfo[]) => {
    if (files.length > 0) {
      // Prefer DCD (binary, proper trajectory format), then xyz/lammpstrj
      const dcdFile = files.find(f => f.format === 'dcd');
      const targetFile = dcdFile || files[0];

      // Only fetch if size changed (new content)
      if (targetFile.size !== lastFileSize) {
        worker?.postMessage({
          type: 'get-trajectory',
          data: { filename: targetFile.filename }
        });
      }
    }
  }, [worker, lastFileSize]);

  // Set up worker message handler for trajectory-specific messages
  useEffect(() => {
    if (!worker) return;

    const handleMessage = (e: MessageEvent) => {
      const { type, data } = e.data;
      if (type === 'trajectory-files') {
        handleTrajectoryFiles(data);
      } else if (type === 'trajectory-content') {
        handleTrajectoryContent(data);
      }
    };

    worker.addEventListener('message', handleMessage);
    return () => {
      worker.removeEventListener('message', handleMessage);
    };
  }, [worker, handleTrajectoryFiles, handleTrajectoryContent]);

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;

    setIsPolling(true);
    pollingIntervalRef.current = setInterval(() => {
      worker?.postMessage({ type: 'poll-trajectory', data: {} });
    }, pollInterval);
  }, [worker, pollInterval]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const clearTrajectory = useCallback(() => {
    setTrajectoryData(null);
    setTrajectoryBinaryContent(null);
    setTrajectoryFormat(null);
    setTrajectoryFilename(null);
    setFrameCount(0);
    setLastFileSize(0);
  }, []);

  // Start/stop polling based on simulation running state
  useEffect(() => {
    if (isRunning && !wasRunningRef.current) {
      // Simulation just started
      startPolling();
    } else if (!isRunning && wasRunningRef.current) {
      // Simulation just ended - do final poll then stop
      stopPolling();
      // Final fetch after small delay
      setTimeout(() => {
        worker?.postMessage({ type: 'poll-trajectory', data: {} });
      }, 500);
    }
    wasRunningRef.current = isRunning;
  }, [isRunning, startPolling, stopPolling, worker]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  return {
    trajectoryData,
    trajectoryBinaryContent,
    trajectoryFormat,
    trajectoryFilename,
    frameCount,
    lastFileSize,
    isPolling,
    startPolling,
    stopPolling,
    clearTrajectory,
  };
}
