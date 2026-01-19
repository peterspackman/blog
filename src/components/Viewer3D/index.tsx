/**
 * Viewer3D - Unified 3D visualization component
 *
 * A hybrid NGL.js + Three.js viewer that combines:
 * - NGL layer: molecular/crystal structures, unit cells, trajectories
 * - Three.js layer: volumetric rendering, isosurfaces, textured slices
 *
 * The Two layers are overlaid with synchronized cameras.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { NGLRenderer, type NGLRendererProps } from './NGLRenderer';
import { VolumeRenderer, type VolumeRendererProps } from './VolumeRenderer';
import type {
    Viewer3DProps,
    CameraState,
    NGLRendererRef,
    VolumeRendererRef,
} from './types';

export type { Viewer3DProps } from './types';
export type { CrystalStructure, Atom, VolumeGrid, SlicePlaneConfig } from './types';

export const Viewer3D: React.FC<Viewer3DProps> = ({
    width,
    height,
    // Structure data
    pdbUrl,
    pdbData,
    structure,
    xyzData,
    // Volumetric data
    cubeUrl,
    cubeData,
    volumeGrid,
    // Display options
    representation = 'ball+stick',
    colorScheme = 'element',
    showHydrogens = true,
    opacity,
    // Crystal options
    showUnitCell = true,
    showAxes = false,
    supercell,
    // Isosurface
    isosurface,
    // Slice plane
    slicePlane,
    // Trajectory
    trajectory,
    // Interaction
    autoRotate = true,
    onAtomClick,
    onAtomHover,
    // Theme
    theme,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const nglRef = useRef<NGLRendererRef>(null);
    const volumeRef = useRef<VolumeRendererRef>(null);
    const syncIntervalRef = useRef<number | null>(null);

    const isDark = theme.text.startsWith('#e') || theme.text.startsWith('#f');

    // Determine if we need each layer
    const hasStructure = !!(pdbUrl || pdbData || structure || xyzData);
    const hasVolume = !!(cubeUrl || cubeData || volumeGrid);

    // Camera synchronization: sync Three.js camera to NGL camera
    const syncCameras = useCallback(() => {
        if (!nglRef.current || !volumeRef.current) return;

        const nglState = nglRef.current.getCameraState();
        if (nglState) {
            volumeRef.current.setCameraState(nglState);
        }
    }, []);

    // Set up camera sync interval when we have both layers
    useEffect(() => {
        if (hasStructure && hasVolume) {
            // Sync cameras at 60fps
            syncIntervalRef.current = window.setInterval(syncCameras, 16);
        }

        return () => {
            if (syncIntervalRef.current) {
                clearInterval(syncIntervalRef.current);
                syncIntervalRef.current = null;
            }
        };
    }, [hasStructure, hasVolume, syncCameras]);

    return (
        <div
            ref={containerRef}
            style={{
                width,
                height,
                position: 'relative',
                borderRadius: '4px',
                border: `1px solid ${theme.border}`,
                overflow: 'hidden',
                background: isDark ? '#2d2d2d' : '#f8f9fa',
            }}
        >
            {/* NGL Layer - structures, unit cells, textured slice */}
            {hasStructure && (
                <NGLRenderer
                    ref={nglRef}
                    width={width}
                    height={height}
                    structure={structure}
                    pdbData={pdbData}
                    pdbUrl={pdbUrl}
                    xyzData={xyzData}
                    representation={representation}
                    colorScheme={colorScheme}
                    showHydrogens={showHydrogens}
                    showUnitCell={showUnitCell}
                    showAxes={showAxes}
                    supercell={supercell}
                    slicePlane={slicePlane}
                    volumeGrid={volumeGrid}
                    autoRotate={autoRotate}
                    isDark={isDark}
                />
            )}

            {/* Three.js Layer - volumetric overlay */}
            {hasVolume && (
                <VolumeRenderer
                    ref={volumeRef}
                    width={width}
                    height={height}
                    volumeGrid={volumeGrid}
                    slicePlane={slicePlane}
                    isosurface={isosurface}
                    isDark={isDark}
                    latticeParams={structure ? {
                        a: structure.a,
                        b: structure.b ?? structure.a,
                        c: structure.c ?? structure.a,
                    } : undefined}
                />
            )}

            {/* Structure name label */}
            {structure && (
                <div
                    style={{
                        position: 'absolute',
                        top: 6,
                        left: 8,
                        color: theme.text,
                        fontSize: '10px',
                        fontWeight: 'bold',
                        pointerEvents: 'none',
                        zIndex: 10,
                    }}
                >
                    {structure.name}
                </div>
            )}

            {/* Slice position indicator */}
            {slicePlane && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 6,
                        left: 8,
                        color: isDark ? '#6b9eff' : '#2563eb',
                        fontSize: '9px',
                        pointerEvents: 'none',
                        zIndex: 10,
                    }}
                >
                    {slicePlane.axis} = {slicePlane.position.toFixed(2)}
                </div>
            )}

            {/* Interaction hint */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 6,
                    right: 8,
                    color: theme.textMuted,
                    fontSize: '9px',
                    pointerEvents: 'none',
                    zIndex: 10,
                }}
            >
                Drag to rotate
            </div>
        </div>
    );
};

export default Viewer3D;
