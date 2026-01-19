import React, { useMemo } from 'react';
import styles from '../LammpsInterface.module.css';
import { LammpsMass } from '../utils/lammpsDataParser';

// Lazy load TrajectoryViewer to avoid SSR issues
const TrajectoryViewer = React.lazy(() => import('../../TrajectoryViewer'));

interface ViewerTabProps {
  trajectoryData: string | null;
  trajectoryFormat: 'xyz' | 'dcd' | 'lammpstrj' | null;
  trajectoryFilename: string | null;
  frameCount: number;
  isSimulationRunning: boolean;
  isPolling: boolean;
  // Optional topology file for DCD trajectories
  topologyFile?: { name: string; content: ArrayBuffer; hasExplicitBonds?: boolean } | null;
  // Optional binary trajectory content for DCD
  trajectoryBinaryContent?: ArrayBuffer | null;
  // Atom type mapping for LAMMPS files
  atomTypes?: LammpsMass[];
  elementMapping?: Map<number, string>;
  onElementMappingChange?: (mapping: Map<number, string>) => void;
  // Explicit bonds from topology as [atom1, atom2] pairs (1-indexed)
  bonds?: [number, number][];
}

export const ViewerTab: React.FC<ViewerTabProps> = ({
  trajectoryData,
  trajectoryFormat,
  trajectoryFilename,
  frameCount,
  isSimulationRunning,
  isPolling,
  topologyFile,
  trajectoryBinaryContent,
  atomTypes,
  elementMapping,
  onElementMappingChange,
  bonds,
}) => {
  // Check if we're in browser environment
  const isBrowser = typeof window !== 'undefined';

  // Convert ArrayBuffer to File objects for NGL.js
  const structureFile = useMemo(() => {
    if (!topologyFile || !isBrowser) return undefined;
    return new File([topologyFile.content], topologyFile.name, {
      type: 'chemical/x-pdb'
    });
  }, [topologyFile, isBrowser]);

  const trajectoryFile = useMemo(() => {
    if (!trajectoryBinaryContent || !trajectoryFilename || !isBrowser) return undefined;
    if (trajectoryFormat !== 'dcd') return undefined;
    return new File([trajectoryBinaryContent], trajectoryFilename, {
      type: 'application/octet-stream'
    });
  }, [trajectoryBinaryContent, trajectoryFilename, trajectoryFormat, isBrowser]);

  // Determine display mode
  const useBinaryMode = trajectoryFormat === 'dcd' && structureFile && trajectoryFile;
  const hasTrajectory = trajectoryData || useBinaryMode;
  const hasTopologyOnly = !hasTrajectory && structureFile;

  // Show empty state if no trajectory and no topology
  if (!hasTrajectory && !hasTopologyOnly) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.viewerPlaceholder}>
          <div className={styles.placeholderContent}>
            {isSimulationRunning ? (
              <>
                <div className={styles.liveIndicator}>
                  <span className={styles.liveDot} />
                  Simulation running...
                </div>
                <p>Waiting for trajectory data...</p>
                {isPolling && (
                  <small>Polling for trajectory files every 2 seconds</small>
                )}
              </>
            ) : (
              <>
                <p>No structure to display</p>
                <small>
                  Upload a PDB file to view the initial structure, or run a simulation with trajectory output.
                </small>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show viewer with structure/trajectory
  return (
    <div className={styles.tabContent}>
      <div className={styles.viewerContainer}>
        {/* Status bar */}
        <div className={styles.viewerStatus}>
          <span className={styles.trajectoryInfo}>
            {hasTopologyOnly ? (
              <>
                <strong>{topologyFile?.name}</strong>
                <span> (initial structure)</span>
              </>
            ) : trajectoryFilename ? (
              <>
                <strong>{trajectoryFilename}</strong>
                {frameCount > 0 && <span> ({frameCount} frames)</span>}
              </>
            ) : null}
          </span>
          {isSimulationRunning && (
            <span className={styles.liveIndicator}>
              <span className={styles.liveDot} />
              Live
            </span>
          )}
        </div>

        {/* Trajectory viewer */}
        <div className={styles.viewerWrapper}>
          {isBrowser ? (
            <React.Suspense fallback={<div className={styles.viewerLoading}>Loading viewer...</div>}>
              {hasTopologyOnly ? (
                <TrajectoryViewer
                  structureFile={structureFile}
                  moleculeName="Initial Structure"
                  autoPlay={false}
                  autoBond={!topologyFile?.hasExplicitBonds}
                  atomTypes={atomTypes}
                  elementMapping={elementMapping}
                  onElementMappingChange={onElementMappingChange}
                />
              ) : useBinaryMode ? (
                <TrajectoryViewer
                  structureFile={structureFile}
                  trajectoryFile={trajectoryFile}
                  moleculeName="LAMMPS Trajectory"
                  autoPlay={false}
                  autoBond={!topologyFile?.hasExplicitBonds}
                  atomTypes={atomTypes}
                  elementMapping={elementMapping}
                  onElementMappingChange={onElementMappingChange}
                />
              ) : (trajectoryFormat === 'xyz' || trajectoryFormat === 'lammpstrj') ? (
                <TrajectoryViewer
                  trajectoryData={trajectoryData!}
                  moleculeName="LAMMPS Trajectory"
                  autoPlay={false}
                  autoBond={!bonds || bonds.length === 0}
                  bonds={bonds}
                  atomTypes={atomTypes}
                  elementMapping={elementMapping}
                  onElementMappingChange={onElementMappingChange}
                />
              ) : (
                <div className={styles.viewerPlaceholder}>
                  <div className={styles.placeholderContent}>
                    <p>Unsupported trajectory format: {trajectoryFormat}</p>
                    <small>Supported formats: XYZ, LAMMPSTRJ, or DCD (with PDB topology).</small>
                  </div>
                </div>
              )}
            </React.Suspense>
          ) : (
            <div className={styles.viewerPlaceholder}>
              <div className={styles.placeholderContent}>
                <p>Viewer not available during server-side rendering.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
