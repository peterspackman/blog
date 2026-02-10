/**
 * NGLRenderer - NGL.js layer for molecular/crystal structure visualization
 *
 * Handles:
 * - Molecular structures (PDB, XYZ, etc.)
 * - Crystal structures with unit cell wireframes
 * - Crystallographic axes
 * - Various representations (ball+stick, spacefill, etc.)
 */

import React, {
    useEffect,
    useRef,
    useCallback,
    useImperativeHandle,
    forwardRef,
} from 'react';
import * as NGL from 'ngl';
import * as THREE from 'three';
import type {
    CrystalStructure,
    CameraState,
    NGLRendererRef,
    StructureRepresentation,
    ColorScheme,
    SlicePlaneConfig,
    VolumeGrid,
    MillerPlanesConfig,
} from './types';
import { calculateDSpacing } from '../diffraction/physics';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NGLShape = any;

// Viridis color scale
function viridis(t: number): [number, number, number] {
    const c0 = [0.267, 0.004, 0.329];
    const c1 = [0.282, 0.140, 0.457];
    const c2 = [0.254, 0.265, 0.529];
    const c3 = [0.206, 0.371, 0.553];
    const c4 = [0.163, 0.471, 0.558];
    const c5 = [0.128, 0.566, 0.550];
    const c6 = [0.135, 0.659, 0.517];
    const c7 = [0.267, 0.749, 0.440];
    const c8 = [0.478, 0.821, 0.318];
    const c9 = [0.741, 0.873, 0.150];
    const c10 = [0.993, 0.906, 0.144];
    const colors = [c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10];
    const idx = Math.min(Math.floor(t * 10), 9);
    const frac = t * 10 - idx;
    return [
        colors[idx][0] + frac * (colors[idx + 1][0] - colors[idx][0]),
        colors[idx][1] + frac * (colors[idx + 1][1] - colors[idx][1]),
        colors[idx][2] + frac * (colors[idx + 1][2] - colors[idx][2]),
    ];
}

export interface NGLRendererProps {
    width: number;
    height: number;
    structure?: CrystalStructure;
    pdbData?: string;
    pdbUrl?: string;
    xyzData?: string;
    representation?: StructureRepresentation;
    colorScheme?: ColorScheme;
    showHydrogens?: boolean;
    showUnitCell?: boolean;
    showAxes?: boolean;
    /** Generate supercell, e.g., [2, 2, 2] for 2x2x2 */
    supercell?: [number, number, number];
    /** Starting cell offset for supercell */
    supercellOrigin?: [number, number, number];
    slicePlane?: SlicePlaneConfig;
    /** Miller planes for selected (hkl) reflection */
    millerPlanes?: MillerPlanesConfig;
    /** Volume grid for textured slice plane */
    volumeGrid?: VolumeGrid;
    autoRotate?: boolean;
    isDark: boolean;
    onCameraChange?: (state: CameraState) => void;
}

// Generate PDB content from crystal structure with optional supercell
function generatePDB(
    structure: CrystalStructure,
    supercell: [number, number, number] = [1, 1, 1],
    origin: [number, number, number] = [0, 0, 0],
): string {
    const { a, b = a, c = a, atoms } = structure;
    const [nx, ny, nz] = supercell;
    const [ox, oy, oz] = origin;
    const lines: string[] = [];

    // CRYST1 record for expanded unit cell
    const totalA = a * nx;
    const totalB = b * ny;
    const totalC = c * nz;
    lines.push(
        `CRYST1${totalA.toFixed(3).padStart(9)}${totalB.toFixed(3).padStart(9)}${totalC.toFixed(3).padStart(9)}` +
        `  90.00  90.00  90.00 P 1           1`
    );

    // Generate atoms - expand to show full supercell
    let atomNum = 1;
    const offsets = [0, 1];

    // Loop over supercell repetitions (starting from origin offset)
    for (let ix = ox; ix < ox + nx; ix++) {
        for (let iy = oy; iy < oy + ny; iy++) {
            for (let iz = oz; iz < oz + nz; iz++) {
                for (const atom of atoms) {
                    const [fx, fy, fz] = atom.position;

                    for (const dx of offsets) {
                        for (const dy of offsets) {
                            for (const dz of offsets) {
                                const newFx = fx + dx;
                                const newFy = fy + dy;
                                const newFz = fz + dz;

                                if (
                                    newFx >= 0 && newFx <= 1.001 &&
                                    newFy >= 0 && newFy <= 1.001 &&
                                    newFz >= 0 && newFz <= 1.001
                                ) {
                                    // Position in Cartesian coordinates
                                    const x = (ix + newFx) * a;
                                    const y = (iy + newFy) * b;
                                    const z = (iz + newFz) * c;

                                    // Skip atoms on the boundary of adjacent cells (avoid duplicates)
                                    // Keep atoms at the outer boundary of the supercell
                                    const onInnerBoundaryX = ix < ox + nx - 1 && Math.abs(newFx - 1) < 0.001;
                                    const onInnerBoundaryY = iy < oy + ny - 1 && Math.abs(newFy - 1) < 0.001;
                                    const onInnerBoundaryZ = iz < oz + nz - 1 && Math.abs(newFz - 1) < 0.001;
                                    if (onInnerBoundaryX || onInnerBoundaryY || onInnerBoundaryZ) {
                                        continue;
                                    }

                                    const el = atom.element;
                                    const atomName = el.length === 1 ? ` ${el}  ` : `${el}  `.slice(0, 4);

                                    const line =
                                        'ATOM  ' +
                                        atomNum.toString().padStart(5) +
                                        ' ' +
                                        atomName +
                                        ' ' +
                                        'MOL' +
                                        ' ' +
                                        'A' +
                                        '   1' +
                                        '    ' +
                                        x.toFixed(3).padStart(8) +
                                        y.toFixed(3).padStart(8) +
                                        z.toFixed(3).padStart(8) +
                                        '  1.00' +
                                        '  0.00' +
                                        '          ' +
                                        el.padStart(2);

                                    lines.push(line);
                                    atomNum++;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    lines.push('END');
    return lines.join('\n');
}

export const NGLRenderer = forwardRef<NGLRendererRef, NGLRendererProps>(
    (
        {
            width,
            height,
            structure,
            pdbData,
            pdbUrl,
            xyzData,
            representation = 'ball+stick',
            colorScheme = 'element',
            showHydrogens = true,
            showUnitCell = true,
            showAxes = false,
            supercell = [1, 1, 1],
            supercellOrigin = [0, 0, 0],
            slicePlane,
            millerPlanes,
            volumeGrid,
            autoRotate = true,
            isDark,
            onCameraChange,
        },
        ref
    ) => {
        const containerRef = useRef<HTMLDivElement>(null);
        const stageRef = useRef<NGL.Stage | null>(null);
        const structureComponentRef = useRef<NGL.StructureComponent | null>(null);
        const unitCellShapeRef = useRef<NGL.Component | null>(null);
        const axesShapeRef = useRef<NGL.Component | null>(null);
        const slicePlaneShapeRef = useRef<NGL.Component | null>(null);
        const millerPlanesShapeRef = useRef<NGL.Component | null>(null);
        // Three.js mesh for textured slice (added to NGL's scene)
        const texturedSliceMeshRef = useRef<THREE.Mesh | null>(null);
        const sliceTextureRef = useRef<THREE.DataTexture | null>(null);

        // Expose imperative handle for camera synchronization
        useImperativeHandle(ref, () => ({
            stage: stageRef.current,
            getCameraState: () => {
                const stage = stageRef.current;
                if (!stage) return null;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const viewer = stage.viewer as any;
                const camera = viewer.camera;

                // NGL viewer controls may not be exposed in types
                const target = viewer.controls?.target || { x: 0, y: 0, z: 0 };

                return {
                    position: [camera.position.x, camera.position.y, camera.position.z],
                    target: [target.x, target.y, target.z],
                    up: [camera.up.x, camera.up.y, camera.up.z],
                    zoom: camera.zoom,
                };
            },
            setCameraState: (state: CameraState) => {
                const stage = stageRef.current;
                if (!stage) return;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const viewer = stage.viewer as any;
                viewer.camera.position.set(...state.position);
                viewer.camera.up.set(...state.up);
                if (viewer.controls?.target) {
                    viewer.controls.target.set(...state.target);
                }
                viewer.camera.zoom = state.zoom;
                viewer.requestRender();
            },
        }));

        const getBackgroundColor = useCallback(() => {
            return isDark ? '#2d2d2d' : '#f8f9fa';
        }, [isDark]);

        // Create unit cell wireframe
        const createUnitCellShape = useCallback(
            (stage: NGL.Stage) => {
                if (unitCellShapeRef.current) {
                    stage.removeComponent(unitCellShapeRef.current);
                    unitCellShapeRef.current = null;
                }

                if (!showUnitCell || !structure) return;

                const { a, b = a, c = a } = structure;
                const [nx, ny, nz] = supercell;
                const [ox, oy, oz] = supercellOrigin;
                // Cartesian bounds of the supercell
                const minX = ox * a, minY = oy * b, minZ = oz * c;
                const maxX = (ox + nx) * a, maxY = (oy + ny) * b, maxZ = (oz + nz) * c;

                const shape: NGLShape = new NGL.Shape('unitcell');
                const color: [number, number, number] = isDark
                    ? [0.5, 0.5, 0.5]
                    : [0.3, 0.3, 0.3];
                const innerColor: [number, number, number] = isDark
                    ? [0.3, 0.3, 0.3]
                    : [0.6, 0.6, 0.6];

                // Draw outer supercell boundary
                const corners = [
                    [minX, minY, minZ], [maxX, minY, minZ], [maxX, maxY, minZ], [minX, maxY, minZ],
                    [minX, minY, maxZ], [maxX, minY, maxZ], [maxX, maxY, maxZ], [minX, maxY, maxZ],
                ];

                const edges = [
                    [0, 1], [1, 2], [2, 3], [3, 0],
                    [4, 5], [5, 6], [6, 7], [7, 4],
                    [0, 4], [1, 5], [2, 6], [3, 7],
                ];

                for (const [i, j] of edges) {
                    shape.addWideline(
                        corners[i] as [number, number, number],
                        corners[j] as [number, number, number],
                        color
                    );
                }

                // Draw inner unit cell boundaries (thinner lines)
                if (nx > 1 || ny > 1 || nz > 1) {
                    // Inner x planes
                    for (let ix = ox + 1; ix < ox + nx; ix++) {
                        const x = ix * a;
                        shape.addWideline([x, minY, minZ], [x, maxY, minZ], innerColor);
                        shape.addWideline([x, minY, maxZ], [x, maxY, maxZ], innerColor);
                        shape.addWideline([x, minY, minZ], [x, minY, maxZ], innerColor);
                        shape.addWideline([x, maxY, minZ], [x, maxY, maxZ], innerColor);
                    }
                    // Inner y planes
                    for (let iy = oy + 1; iy < oy + ny; iy++) {
                        const y = iy * b;
                        shape.addWideline([minX, y, minZ], [maxX, y, minZ], innerColor);
                        shape.addWideline([minX, y, maxZ], [maxX, y, maxZ], innerColor);
                        shape.addWideline([minX, y, minZ], [minX, y, maxZ], innerColor);
                        shape.addWideline([maxX, y, minZ], [maxX, y, maxZ], innerColor);
                    }
                    // Inner z planes
                    for (let iz = oz + 1; iz < oz + nz; iz++) {
                        const z = iz * c;
                        shape.addWideline([minX, minY, z], [maxX, minY, z], innerColor);
                        shape.addWideline([minX, maxY, z], [maxX, maxY, z], innerColor);
                        shape.addWideline([minX, minY, z], [minX, maxY, z], innerColor);
                        shape.addWideline([maxX, minY, z], [maxX, maxY, z], innerColor);
                    }
                }

                const shapeComp = stage.addComponentFromObject(shape);
                if (shapeComp) {
                    shapeComp.addRepresentation('buffer', { linewidth: 3 });
                    unitCellShapeRef.current = shapeComp;
                }
            },
            [structure, showUnitCell, isDark, supercell, supercellOrigin]
        );

        // Create axes labels
        const createAxesShape = useCallback(
            (stage: NGL.Stage) => {
                if (axesShapeRef.current) {
                    stage.removeComponent(axesShapeRef.current);
                    axesShapeRef.current = null;
                }

                if (!showAxes || !structure) return;

                const { a, b = a, c = a } = structure;
                const shape: NGLShape = new NGL.Shape('axes');
                const offset = -0.5;
                const length = Math.max(a, b, c) * 0.25;

                // a-axis (red)
                shape.addWideline(
                    [offset, offset, offset],
                    [offset + length, offset, offset],
                    [1, 0.3, 0.3]
                );
                shape.addArrow(
                    [offset + length * 0.8, offset, offset],
                    [offset + length, offset, offset],
                    [1, 0.3, 0.3],
                    0.1
                );

                // b-axis (green)
                shape.addWideline(
                    [offset, offset, offset],
                    [offset, offset + length, offset],
                    [0.3, 1, 0.3]
                );
                shape.addArrow(
                    [offset, offset + length * 0.8, offset],
                    [offset, offset + length, offset],
                    [0.3, 1, 0.3],
                    0.1
                );

                // c-axis (blue)
                shape.addWideline(
                    [offset, offset, offset],
                    [offset, offset, offset + length],
                    [0.3, 0.3, 1]
                );
                shape.addArrow(
                    [offset, offset, offset + length * 0.8],
                    [offset, offset, offset + length],
                    [0.3, 0.3, 1],
                    0.1
                );

                const shapeComp = stage.addComponentFromObject(shape);
                if (shapeComp) {
                    shapeComp.addRepresentation('buffer', { linewidth: 4 });
                    axesShapeRef.current = shapeComp;
                }
            },
            [showAxes, structure]
        );

        // Create slice plane indicator
        const createSlicePlaneShape = useCallback(
            (stage: NGL.Stage) => {
                if (slicePlaneShapeRef.current) {
                    stage.removeComponent(slicePlaneShapeRef.current);
                    slicePlaneShapeRef.current = null;
                }

                if (!slicePlane || !structure) return;
                if (slicePlane.showPlane === false) return;  // Explicitly disabled

                const { a, b = a, c = a } = structure;
                const shape: NGLShape = new NGL.Shape('sliceplane');
                const color: [number, number, number] = isDark
                    ? [0.42, 0.62, 1]
                    : [0.15, 0.39, 0.92];

                let corners: [number, number, number][];

                // Check if using zone axis or legacy axis
                if (slicePlane.zoneAxis) {
                    const [u, v, w] = slicePlane.zoneAxis;
                    const len = Math.sqrt(u * u + v * v + w * w);
                    if (len === 0) return;

                    // Normalize zone axis
                    const nx = u / len, ny = v / len, nz = w / len;

                    // Find two perpendicular basis vectors in the plane
                    let b1x: number, b1y: number, b1z: number;
                    if (Math.abs(u) <= Math.abs(v) && Math.abs(u) <= Math.abs(w)) {
                        b1x = 0; b1y = -w; b1z = v;
                    } else if (Math.abs(v) <= Math.abs(w)) {
                        b1x = w; b1y = 0; b1z = -u;
                    } else {
                        b1x = -v; b1y = u; b1z = 0;
                    }
                    const b1Len = Math.sqrt(b1x * b1x + b1y * b1y + b1z * b1z);
                    b1x /= b1Len; b1y /= b1Len; b1z /= b1Len;

                    // Second basis: n × b1
                    const b2x = ny * b1z - nz * b1y;
                    const b2y = nz * b1x - nx * b1z;
                    const b2z = nx * b1y - ny * b1x;

                    // Center of plane in Cartesian coordinates
                    // Position along zone axis in fractional coords, scaled by lattice params
                    const centerX = slicePlane.position * nx * a;
                    const centerY = slicePlane.position * ny * b;
                    const centerZ = slicePlane.position * nz * c;

                    // Scale basis vectors to roughly cover the unit cell
                    const scale = Math.max(a, b, c) * 0.75;

                    corners = [
                        [centerX - b1x * scale - b2x * scale, centerY - b1y * scale - b2y * scale, centerZ - b1z * scale - b2z * scale],
                        [centerX + b1x * scale - b2x * scale, centerY + b1y * scale - b2y * scale, centerZ + b1z * scale - b2z * scale],
                        [centerX + b1x * scale + b2x * scale, centerY + b1y * scale + b2y * scale, centerZ + b1z * scale + b2z * scale],
                        [centerX - b1x * scale + b2x * scale, centerY - b1y * scale + b2y * scale, centerZ - b1z * scale + b2z * scale],
                    ];
                } else {
                    // Legacy axis-based slice plane
                    switch (slicePlane.axis) {
                        case 'x': {
                            const xPos = slicePlane.position * a;
                            corners = [
                                [xPos, 0, 0],
                                [xPos, b, 0],
                                [xPos, b, c],
                                [xPos, 0, c],
                            ];
                            break;
                        }
                        case 'y': {
                            const yPos = slicePlane.position * b;
                            corners = [
                                [0, yPos, 0],
                                [a, yPos, 0],
                                [a, yPos, c],
                                [0, yPos, c],
                            ];
                            break;
                        }
                        case 'z':
                        default: {
                            const zPos = slicePlane.position * c;
                            corners = [
                                [0, 0, zPos],
                                [a, 0, zPos],
                                [a, b, zPos],
                                [0, b, zPos],
                            ];
                            break;
                        }
                    }
                }

                for (let i = 0; i < 4; i++) {
                    const j = (i + 1) % 4;
                    shape.addWideline(corners[i], corners[j], color);
                }

                for (const corner of corners) {
                    shape.addSphere(corner, color, 0.1);
                }

                const shapeComp = stage.addComponentFromObject(shape);
                if (shapeComp) {
                    shapeComp.addRepresentation('buffer', { linewidth: 5 });
                    slicePlaneShapeRef.current = shapeComp;
                }
            },
            [slicePlane, structure, isDark]
        );

        // Create Miller planes for selected (hkl) reflection
        // Uses NGL Shape: addMesh for filled quads + addWideline for edges
        const createMillerPlanesShape = useCallback(
            (stage: NGL.Stage) => {
                if (millerPlanesShapeRef.current) {
                    stage.removeComponent(millerPlanesShapeRef.current);
                    millerPlanesShapeRef.current = null;
                }

                if (!millerPlanes) return;

                const { hkl, structure: mpStructure } = millerPlanes;
                const [h, k, l] = hkl;
                if (h === 0 && k === 0 && l === 0) return;

                const { a, b = a, c = a } = mpStructure;
                const d = calculateDSpacing(h, k, l, mpStructure);
                if (!isFinite(d) || d <= 0) return;

                const shape: NGLShape = new NGL.Shape('millerplanes');
                const edgeColor: [number, number, number] = isDark
                    ? [1.0, 0.7, 0.26]
                    : [0.85, 0.53, 0.1];
                const fillColor: [number, number, number] = isDark
                    ? [1.0, 0.7, 0.26]
                    : [0.85, 0.53, 0.1];

                // Plane normal in Cartesian coords (reciprocal lattice direction)
                const nx = h / a;
                const ny = k / b;
                const nz = l / c;
                const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
                if (nLen === 0) return;
                const nHat = [nx / nLen, ny / nLen, nz / nLen];

                // Find two perpendicular basis vectors in the plane
                let b1x: number, b1y: number, b1z: number;
                if (Math.abs(nHat[0]) <= Math.abs(nHat[1]) && Math.abs(nHat[0]) <= Math.abs(nHat[2])) {
                    b1x = 0; b1y = -nHat[2]; b1z = nHat[1];
                } else if (Math.abs(nHat[1]) <= Math.abs(nHat[2])) {
                    b1x = nHat[2]; b1y = 0; b1z = -nHat[0];
                } else {
                    b1x = -nHat[1]; b1y = nHat[0]; b1z = 0;
                }
                const b1Len = Math.sqrt(b1x * b1x + b1y * b1y + b1z * b1z);
                b1x /= b1Len; b1y /= b1Len; b1z /= b1Len;

                // Second basis: nHat x b1
                const b2x = nHat[1] * b1z - nHat[2] * b1y;
                const b2y = nHat[2] * b1x - nHat[0] * b1z;
                const b2z = nHat[0] * b1y - nHat[1] * b1x;

                // Scale to cover unit cell
                const scale = Math.sqrt(a * a + b * b + c * c) * 0.6;

                // Project all unit cell corners onto the normal to find
                // which plane indices n actually intersect the cell
                const cellCorners = [
                    [0, 0, 0], [a, 0, 0], [0, b, 0], [0, 0, c],
                    [a, b, 0], [a, 0, c], [0, b, c], [a, b, c],
                ];
                let minProj = Infinity, maxProj = -Infinity;
                for (const corner of cellCorners) {
                    const proj = corner[0] * nHat[0] + corner[1] * nHat[1] + corner[2] * nHat[2];
                    minProj = Math.min(minProj, proj);
                    maxProj = Math.max(maxProj, proj);
                }
                const nMin = Math.ceil(minProj / d - 0.01);
                const nMax = Math.floor(maxProj / d + 0.01);

                for (let n = nMin; n <= nMax; n++) {
                    const px = n * d * nHat[0];
                    const py = n * d * nHat[1];
                    const pz = n * d * nHat[2];

                    const corners: [number, number, number][] = [
                        [px - b1x * scale - b2x * scale, py - b1y * scale - b2y * scale, pz - b1z * scale - b2z * scale],
                        [px + b1x * scale - b2x * scale, py + b1y * scale - b2y * scale, pz + b1z * scale - b2z * scale],
                        [px + b1x * scale + b2x * scale, py + b1y * scale + b2y * scale, pz + b1z * scale + b2z * scale],
                        [px - b1x * scale + b2x * scale, py - b1y * scale + b2y * scale, pz - b1z * scale + b2z * scale],
                    ];

                    // Wireframe edges
                    for (let i = 0; i < 4; i++) {
                        const j = (i + 1) % 4;
                        shape.addWideline(corners[i], corners[j], edgeColor);
                    }

                    // Filled quad via addMesh (two triangles)
                    // Vertices: 4 corners, indices: [0,1,2] + [0,2,3]
                    const position = new Float32Array([
                        ...corners[0], ...corners[1], ...corners[2], ...corners[3],
                    ]);
                    // Per-vertex color (RGB for each of 4 vertices)
                    const color = new Float32Array([
                        ...fillColor, ...fillColor, ...fillColor, ...fillColor,
                    ]);
                    // Two triangles forming the quad
                    const index = new Uint32Array([0, 1, 2, 0, 2, 3]);
                    // Normal for each vertex (same normal for flat quad)
                    const normal = new Float32Array([
                        nHat[0], nHat[1], nHat[2],
                        nHat[0], nHat[1], nHat[2],
                        nHat[0], nHat[1], nHat[2],
                        nHat[0], nHat[1], nHat[2],
                    ]);

                    shape.addMesh(position, color, index, normal, `plane_${n}`);
                }

                const shapeComp = stage.addComponentFromObject(shape);
                if (shapeComp) {
                    shapeComp.addRepresentation('buffer', { linewidth: 4 });
                    millerPlanesShapeRef.current = shapeComp;
                }
            },
            [millerPlanes, isDark]
        );

        // Create textured slice plane (added directly to NGL's Three.js scene)
        const updateTexturedSlice = useCallback(
            (stage: NGL.Stage) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const viewer = stage.viewer as any;
                const scene = viewer.scene as THREE.Scene;

                // Remove existing textured slice
                if (texturedSliceMeshRef.current) {
                    scene.remove(texturedSliceMeshRef.current);
                    texturedSliceMeshRef.current.geometry.dispose();
                    (texturedSliceMeshRef.current.material as THREE.Material).dispose();
                    texturedSliceMeshRef.current = null;
                }
                if (sliceTextureRef.current) {
                    sliceTextureRef.current.dispose();
                    sliceTextureRef.current = null;
                }

                if (!slicePlane?.showTexture || !volumeGrid || !structure) return;

                const { a, b = a, c = a } = structure;
                const { data, dimensions } = volumeGrid;
                const [nx, ny, nz] = dimensions;
                const { axis, position } = slicePlane;

                // Extract 2D slice from volume
                // Volume data is stored as data[x + y*nx + z*nx*ny]
                // For each axis, we need to map texture coordinates correctly
                let sliceData: Float32Array;
                let sliceWidth: number;
                let sliceHeight: number;

                if (axis === 'z') {
                    // z-slice: texture u=x, v=y, fixed z
                    sliceWidth = nx;
                    sliceHeight = ny;
                    const zIdx = Math.min(nz - 1, Math.max(0, Math.floor(position * nz)));
                    sliceData = new Float32Array(nx * ny);
                    for (let iy = 0; iy < ny; iy++) {
                        for (let ix = 0; ix < nx; ix++) {
                            // Texture v=0 is bottom (y=0), v=1 is top (y=ny-1)
                            sliceData[iy * nx + ix] = data[ix + iy * nx + zIdx * nx * ny];
                        }
                    }
                } else if (axis === 'y') {
                    // y-slice: texture u=x, v=z, fixed y
                    sliceWidth = nx;
                    sliceHeight = nz;
                    const yIdx = Math.min(ny - 1, Math.max(0, Math.floor(position * ny)));
                    sliceData = new Float32Array(nx * nz);
                    for (let iz = 0; iz < nz; iz++) {
                        for (let ix = 0; ix < nx; ix++) {
                            sliceData[iz * nx + ix] = data[ix + yIdx * nx + iz * nx * ny];
                        }
                    }
                } else {
                    // x-slice: texture u=y, v=z, fixed x
                    sliceWidth = ny;
                    sliceHeight = nz;
                    const xIdx = Math.min(nx - 1, Math.max(0, Math.floor(position * nx)));
                    sliceData = new Float32Array(ny * nz);
                    for (let iz = 0; iz < nz; iz++) {
                        for (let iy = 0; iy < ny; iy++) {
                            sliceData[iz * ny + iy] = data[xIdx + iy * nx + iz * nx * ny];
                        }
                    }
                }

                // Find min/max for normalization
                let min = Infinity, max = -Infinity;
                for (let i = 0; i < sliceData.length; i++) {
                    min = Math.min(min, sliceData[i]);
                    max = Math.max(max, sliceData[i]);
                }
                const range = max - min || 1;

                // Create RGBA texture data with viridis colormap
                const rgbaData = new Uint8Array(sliceWidth * sliceHeight * 4);
                for (let i = 0; i < sliceData.length; i++) {
                    const t = (sliceData[i] - min) / range;
                    const [r, g, bVal] = viridis(t);
                    rgbaData[i * 4] = Math.floor(r * 255);
                    rgbaData[i * 4 + 1] = Math.floor(g * 255);
                    rgbaData[i * 4 + 2] = Math.floor(bVal * 255);
                    rgbaData[i * 4 + 3] = 200; // Semi-transparent
                }

                const texture = new THREE.DataTexture(rgbaData, sliceWidth, sliceHeight);
                texture.format = THREE.RGBAFormat;
                texture.type = THREE.UnsignedByteType;
                texture.magFilter = THREE.LinearFilter;
                texture.minFilter = THREE.LinearFilter;
                texture.needsUpdate = true;
                sliceTextureRef.current = texture;

                // Create plane geometry sized to unit cell dimensions
                // PlaneGeometry is created in XY plane, centered at origin
                let planeWidth: number, planeHeight: number;
                if (axis === 'z') {
                    planeWidth = a;
                    planeHeight = b;
                } else if (axis === 'y') {
                    planeWidth = a;
                    planeHeight = c;
                } else {
                    planeWidth = b;
                    planeHeight = c;
                }

                const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
                const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    side: THREE.DoubleSide,
                    depthWrite: false,
                });

                const mesh = new THREE.Mesh(geometry, material);

                // Position the plane in crystal coordinates
                // PlaneGeometry is created in XY plane, so we rotate it into position
                // then translate its center to the correct location
                if (axis === 'z') {
                    // Rotate to lie in XY plane (horizontal), normal pointing up (+Z)
                    mesh.rotation.x = -Math.PI / 2;
                    // After rotation: plane's local X -> world X, plane's local Y -> world -Z
                    // But we want it in the XY plane at height z, so:
                    // Center at (a/2, b/2, z*c)
                    mesh.position.set(a / 2, position * c, b / 2);
                } else if (axis === 'y') {
                    // Plane in XZ at fixed y, normal pointing +Y
                    // No rotation needed, but flip to be vertical in XZ
                    // PlaneGeometry in XY, we want it in XZ
                    mesh.rotation.x = -Math.PI / 2;
                    mesh.rotation.z = -Math.PI / 2;
                    // Actually simpler: just don't rotate and position correctly
                    mesh.rotation.set(0, 0, 0);
                    // Plane in XY, rotate to XZ: rotate around X by 90 degrees
                    mesh.rotation.x = Math.PI / 2;
                    mesh.position.set(a / 2, position * b, c / 2);
                } else {
                    // Plane in YZ at fixed x, normal pointing +X
                    mesh.rotation.y = Math.PI / 2;
                    mesh.position.set(position * a, b / 2, c / 2);
                }

                scene.add(mesh);
                texturedSliceMeshRef.current = mesh;

                // Request render update
                viewer.requestRender();
            },
            [slicePlane, volumeGrid, structure]
        );

        // Update structure
        const updateStructure = useCallback(
            async (stage: NGL.Stage) => {
                // Remove existing structure
                const toRemove: NGL.Component[] = [];
                stage.eachComponent((comp: NGL.Component) => {
                    if (comp.name === 'structure.pdb' || comp.name === 'structure') {
                        toRemove.push(comp);
                    }
                });
                toRemove.forEach((comp) => {
                    try {
                        stage.removeComponent(comp);
                    } catch (e) {
                        // Ignore
                    }
                });
                structureComponentRef.current = null;

                // Determine data source
                let file: File | string | undefined;
                let loadParams: Record<string, unknown> = {
                    defaultRepresentation: false,
                    name: 'structure',
                };

                if (pdbUrl) {
                    file = pdbUrl;
                } else if (pdbData) {
                    const blob = new Blob([pdbData], { type: 'text/plain' });
                    file = new File([blob], 'structure.pdb');
                    loadParams.name = 'structure.pdb';
                } else if (xyzData) {
                    const blob = new Blob([xyzData], { type: 'text/plain' });
                    file = new File([blob], 'structure.xyz');
                    loadParams.ext = 'xyz';
                } else if (structure) {
                    const pdbContent = generatePDB(structure, supercell, supercellOrigin);
                    const blob = new Blob([pdbContent], { type: 'text/plain' });
                    file = new File([blob], 'structure.pdb');
                    loadParams.name = 'structure.pdb';
                }

                if (!file) return;

                try {
                    const component = (await stage.loadFile(
                        file,
                        loadParams
                    )) as NGL.StructureComponent;

                    structureComponentRef.current = component;

                    const repParams: Record<string, unknown> = {
                        colorScheme: colorScheme,
                    };

                    if (!showHydrogens) {
                        repParams.sele = 'not hydrogen';
                    }

                    switch (representation) {
                        case 'spacefill':
                            component.addRepresentation('spacefill', {
                                ...repParams,
                                radiusScale: 0.4,
                            });
                            break;
                        case 'licorice':
                            component.addRepresentation('licorice', {
                                ...repParams,
                                radiusScale: 0.3,
                            });
                            break;
                        case 'line':
                            component.addRepresentation('line', repParams);
                            break;
                        case 'cartoon':
                            component.addRepresentation('cartoon', repParams);
                            break;
                        case 'ball+stick':
                        default:
                            component.addRepresentation('ball+stick', {
                                ...repParams,
                                aspectRatio: 2.5,
                                bondScale: 0.3,
                                radiusScale: 0.4,
                            });
                            break;
                    }

                    stage.autoView();
                } catch (error) {
                    console.error('Error loading structure:', error);
                }
            },
            [structure, pdbData, pdbUrl, xyzData, representation, colorScheme, showHydrogens, supercell, supercellOrigin]
        );

        // Initialize NGL Stage
        useEffect(() => {
            if (!containerRef.current) return;

            const stage = new NGL.Stage(containerRef.current, {
                backgroundColor: getBackgroundColor(),
                quality: 'medium',
            });
            stageRef.current = stage;

            stage.setSpin(autoRotate);

            // Stop spin on user interaction
            const stopSpin = () => stage.setSpin(false);
            const el = containerRef.current;
            el.addEventListener('mousedown', stopSpin);
            el.addEventListener('touchstart', stopSpin);

            // Initial setup
            updateStructure(stage);
            createUnitCellShape(stage);
            createAxesShape(stage);
            createSlicePlaneShape(stage);
            createMillerPlanesShape(stage);
            updateTexturedSlice(stage);

            return () => {
                // Clean up textured slice mesh
                if (texturedSliceMeshRef.current) {
                    const viewer = stage.viewer as any;
                    const scene = viewer?.scene as THREE.Scene;
                    if (scene) {
                        scene.remove(texturedSliceMeshRef.current);
                    }
                    texturedSliceMeshRef.current.geometry.dispose();
                    (texturedSliceMeshRef.current.material as THREE.Material).dispose();
                    texturedSliceMeshRef.current = null;
                }
                if (sliceTextureRef.current) {
                    sliceTextureRef.current.dispose();
                    sliceTextureRef.current = null;
                }
                el.removeEventListener('mousedown', stopSpin);
                el.removeEventListener('touchstart', stopSpin);
                stage.dispose();
                stageRef.current = null;
            };
        }, []);

        // Update on structure change
        useEffect(() => {
            if (stageRef.current) {
                updateStructure(stageRef.current);
                createUnitCellShape(stageRef.current);
            }
        }, [structure, pdbData, pdbUrl, xyzData, representation, colorScheme, showHydrogens, supercell, updateStructure, createUnitCellShape]);

        // Update unit cell visibility
        useEffect(() => {
            if (stageRef.current) {
                createUnitCellShape(stageRef.current);
            }
        }, [showUnitCell, createUnitCellShape]);

        // Update axes
        useEffect(() => {
            if (stageRef.current) {
                createAxesShape(stageRef.current);
            }
        }, [showAxes, createAxesShape]);

        // Update slice plane wireframe
        useEffect(() => {
            if (stageRef.current) {
                createSlicePlaneShape(stageRef.current);
            }
        }, [slicePlane, createSlicePlaneShape]);

        // Update Miller planes
        useEffect(() => {
            if (stageRef.current) {
                createMillerPlanesShape(stageRef.current);
            }
        }, [millerPlanes, createMillerPlanesShape]);

        // Update textured slice plane
        useEffect(() => {
            if (stageRef.current) {
                updateTexturedSlice(stageRef.current);
            }
        }, [slicePlane, volumeGrid, updateTexturedSlice]);

        // Update background on theme change
        useEffect(() => {
            if (stageRef.current) {
                stageRef.current.setParameters({ backgroundColor: getBackgroundColor() });
                createUnitCellShape(stageRef.current);
                createAxesShape(stageRef.current);
                createSlicePlaneShape(stageRef.current);
                createMillerPlanesShape(stageRef.current);
            }
        }, [isDark, getBackgroundColor, createUnitCellShape, createAxesShape, createSlicePlaneShape, createMillerPlanesShape]);

        // Update auto-rotate
        useEffect(() => {
            if (stageRef.current) {
                stageRef.current.setSpin(autoRotate);
            }
        }, [autoRotate]);

        // Handle resize
        useEffect(() => {
            if (stageRef.current) {
                stageRef.current.handleResize();
            }
        }, [width, height]);

        return (
            <div
                ref={containerRef}
                style={{
                    width,
                    height,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                }}
            />
        );
    }
);

NGLRenderer.displayName = 'NGLRenderer';

export default NGLRenderer;
