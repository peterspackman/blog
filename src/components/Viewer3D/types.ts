/**
 * Viewer3D Types
 *
 * Unified types for the hybrid NGL+Three.js viewer component.
 */

import type { ControlTheme } from '../shared/controls';

// Re-export CrystalStructure from diffraction/physics for convenience
export type { CrystalStructure, Atom } from '../diffraction/physics';

// ============================================================================
// Volume Data Types
// ============================================================================

export interface VolumeGrid {
    data: Float32Array;
    dimensions: [number, number, number];
    origin: [number, number, number];
    spacing: [number, number, number];
}

export interface SlicePlaneConfig {
    axis: 'x' | 'y' | 'z';
    position: number;  // 0-1 fractional coordinate
    showTexture?: boolean;
    colorScale?: 'viridis' | 'thermal' | 'bluered';
}

export interface IsosurfaceConfig {
    value: number;
    color?: string;
    opacity?: number;
    showBothPhases?: boolean;  // +/- isosurfaces for orbitals
}

// ============================================================================
// Trajectory Types
// ============================================================================

export interface TrajectoryConfig {
    frames: string[];  // Array of XYZ/PDB frame data
    currentFrame: number;
    fps?: number;
    onFrameChange?: (frame: number) => void;
}

// ============================================================================
// Atom Interaction Types
// ============================================================================

export interface AtomInfo {
    index: number;
    element: string;
    position: [number, number, number];
    residue?: string;
    chain?: string;
}

// ============================================================================
// Representation Types
// ============================================================================

export type StructureRepresentation =
    | 'ball+stick'
    | 'spacefill'
    | 'licorice'
    | 'line'
    | 'cartoon';

export type ColorScheme =
    | 'element'
    | 'chainname'
    | 'residue'
    | 'uniform';

// ============================================================================
// Main Props Interface
// ============================================================================

export interface Viewer3DProps {
    // -------------------------------------------------------------------------
    // Sizing
    // -------------------------------------------------------------------------
    width: number;
    height: number;

    // -------------------------------------------------------------------------
    // Structure Data (choose one or combine)
    // -------------------------------------------------------------------------
    /** Load structure from URL (PDB/mmCIF/etc.) */
    pdbUrl?: string;
    /** Raw PDB format string */
    pdbData?: string;
    /** Crystal structure object (will be converted to PDB) */
    structure?: import('../diffraction/physics').CrystalStructure;
    /** XYZ format string */
    xyzData?: string;

    // -------------------------------------------------------------------------
    // Volumetric Data
    // -------------------------------------------------------------------------
    /** Load cube file from URL */
    cubeUrl?: string;
    /** Raw cube file string */
    cubeData?: string;
    /** Raw 3D grid data for volumetric rendering */
    volumeGrid?: VolumeGrid;

    // -------------------------------------------------------------------------
    // Structure Display Options
    // -------------------------------------------------------------------------
    /** Molecular representation style */
    representation?: StructureRepresentation;
    /** Color scheme for atoms */
    colorScheme?: ColorScheme;
    /** Show hydrogen atoms */
    showHydrogens?: boolean;
    /** Overall structure opacity (0-1) */
    opacity?: number;

    // -------------------------------------------------------------------------
    // Unit Cell / Crystal Options
    // -------------------------------------------------------------------------
    /** Show unit cell wireframe */
    showUnitCell?: boolean;
    /** Show crystallographic axes (a=red, b=green, c=blue) */
    showAxes?: boolean;
    /** Generate supercell, e.g., [2, 2, 2] */
    supercell?: [number, number, number];

    // -------------------------------------------------------------------------
    // Isosurface Options
    // -------------------------------------------------------------------------
    /** Isosurface configuration */
    isosurface?: IsosurfaceConfig;

    // -------------------------------------------------------------------------
    // Slice Plane
    // -------------------------------------------------------------------------
    /** Slice plane configuration */
    slicePlane?: SlicePlaneConfig;

    // -------------------------------------------------------------------------
    // Trajectory
    // -------------------------------------------------------------------------
    /** Trajectory playback configuration */
    trajectory?: TrajectoryConfig;

    // -------------------------------------------------------------------------
    // Interaction
    // -------------------------------------------------------------------------
    /** Enable auto-rotation */
    autoRotate?: boolean;
    /** Callback when atom is clicked */
    onAtomClick?: (atom: AtomInfo) => void;
    /** Callback when hovering over atom */
    onAtomHover?: (atom: AtomInfo | null) => void;

    // -------------------------------------------------------------------------
    // Theme
    // -------------------------------------------------------------------------
    theme: ControlTheme;
}

// ============================================================================
// Internal State Types
// ============================================================================

export interface CameraState {
    position: [number, number, number];
    target: [number, number, number];
    up: [number, number, number];
    zoom: number;
}

export interface NGLRendererRef {
    stage: import('ngl').Stage | null;
    getCameraState: () => CameraState | null;
    setCameraState: (state: CameraState) => void;
}

export interface VolumeRendererRef {
    scene: import('three').Scene | null;
    camera: import('three').Camera | null;
    getCameraState: () => CameraState | null;
    setCameraState: (state: CameraState) => void;
}
