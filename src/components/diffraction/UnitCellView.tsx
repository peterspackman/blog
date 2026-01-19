import React, { useEffect, useRef, useCallback } from 'react';
import * as NGL from 'ngl';
import type { CrystalStructure } from './physics';
import type { ControlTheme } from '../shared/controls';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NGLShape = any;

export interface UnitCellViewProps {
    width: number;
    height: number;
    structure: CrystalStructure;
    showBonds: boolean;
    showLabels: boolean;
    theme: ControlTheme;
    sliceZ?: number; // Show slice plane indicator at this z position (0-1)
}

// Generate PDB content from crystal structure
// PDB format: https://www.wwpdb.org/documentation/file-format-content/format33/sect9.html
function generatePDB(structure: CrystalStructure): string {
    const { a, b = a, c = a, atoms } = structure;
    const lines: string[] = [];

    // CRYST1 record for unit cell
    lines.push(
        `CRYST1${a.toFixed(3).padStart(9)}${(b).toFixed(3).padStart(9)}${(c).toFixed(3).padStart(9)}` +
        `  90.00  90.00  90.00 P 1           1`
    );

    // Generate atoms - expand to show full unit cell with symmetry equivalents
    let atomNum = 1;
    const offsets = [0, 1]; // Show atoms at 0 and 1 for each fractional coordinate

    for (const atom of atoms) {
        const [fx, fy, fz] = atom.position;

        // Generate symmetry equivalents at unit cell corners/edges/faces
        for (const dx of offsets) {
            for (const dy of offsets) {
                for (const dz of offsets) {
                    const newFx = fx + dx;
                    const newFy = fy + dy;
                    const newFz = fz + dz;

                    // Only include if within or on boundary of unit cell
                    if (newFx >= 0 && newFx <= 1.001 &&
                        newFy >= 0 && newFy <= 1.001 &&
                        newFz >= 0 && newFz <= 1.001) {

                        // Convert fractional to Cartesian
                        const x = newFx * a;
                        const y = newFy * b;
                        const z = newFz * c;

                        // PDB ATOM record format (columns are 1-indexed):
                        // 1-6: "ATOM  "
                        // 7-11: Atom serial number (right justified)
                        // 12: Space
                        // 13-16: Atom name (element symbol, left justified for 1-2 char elements)
                        // 17: Alternate location indicator
                        // 18-20: Residue name
                        // 21: Space
                        // 22: Chain identifier
                        // 23-26: Residue sequence number (right justified)
                        // 27-30: Insertion code + spaces
                        // 31-38: X coordinate (8.3 format)
                        // 39-46: Y coordinate (8.3 format)
                        // 47-54: Z coordinate (8.3 format)
                        // 55-60: Occupancy (6.2 format)
                        // 61-66: Temperature factor (6.2 format)
                        // 67-76: Spaces
                        // 77-78: Element symbol (right justified)
                        // 79-80: Charge

                        const el = atom.element;
                        // Atom name: 2-char elements start at col 13, 1-char at col 14
                        const atomName = el.length === 1 ? ` ${el}  ` : `${el}  `.slice(0, 4);

                        const line =
                            'ATOM  ' +                                    // 1-6
                            atomNum.toString().padStart(5) +              // 7-11
                            ' ' +                                         // 12
                            atomName +                                    // 13-16
                            ' ' +                                         // 17 (altLoc)
                            'MOL' +                                       // 18-20 (resName)
                            ' ' +                                         // 21
                            'A' +                                         // 22 (chainID)
                            '   1' +                                      // 23-26 (resSeq)
                            '    ' +                                      // 27-30 (iCode + spaces)
                            x.toFixed(3).padStart(8) +                    // 31-38
                            y.toFixed(3).padStart(8) +                    // 39-46
                            z.toFixed(3).padStart(8) +                    // 47-54
                            '  1.00' +                                    // 55-60 (occupancy)
                            '  0.00' +                                    // 61-66 (tempFactor)
                            '          ' +                                // 67-76 (spaces)
                            el.padStart(2);                               // 77-78 (element)

                        lines.push(line);
                        atomNum++;
                    }
                }
            }
        }
    }

    lines.push('END');
    return lines.join('\n');
}

export const UnitCellView: React.FC<UnitCellViewProps> = ({
    width,
    height,
    structure,
    showBonds,
    showLabels,
    theme,
    sliceZ,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<NGL.Stage | null>(null);
    const structureComponentRef = useRef<NGL.StructureComponent | null>(null);
    const unitCellShapeRef = useRef<NGL.Component | null>(null);
    const slicePlaneShapeRef = useRef<NGL.Component | null>(null);
    const axesShapeRef = useRef<NGL.Component | null>(null);

    const isDark = theme.text.startsWith('#e') || theme.text.startsWith('#f');

    // Get background color based on theme
    const getBackgroundColor = useCallback(() => {
        return isDark ? '#2d2d2d' : '#f8f9fa';
    }, [isDark]);

    // Create unit cell wireframe using NGL.Shape
    const createUnitCellShape = useCallback((stage: NGL.Stage) => {
        // Remove existing unit cell shape
        if (unitCellShapeRef.current) {
            stage.removeComponent(unitCellShapeRef.current);
            unitCellShapeRef.current = null;
        }

        const { a, b = a, c = a } = structure;
        const shape: NGLShape = new NGL.Shape('unitcell');
        const color: [number, number, number] = isDark ? [0.5, 0.5, 0.5] : [0.3, 0.3, 0.3];

        // Define corners
        const corners = [
            [0, 0, 0], [a, 0, 0], [a, b, 0], [0, b, 0],
            [0, 0, c], [a, 0, c], [a, b, c], [0, b, c],
        ];

        // Define edges
        const edges = [
            [0, 1], [1, 2], [2, 3], [3, 0], // Bottom
            [4, 5], [5, 6], [6, 7], [7, 4], // Top
            [0, 4], [1, 5], [2, 6], [3, 7], // Vertical
        ];

        for (const [i, j] of edges) {
            shape.addWideline(
                corners[i] as [number, number, number],
                corners[j] as [number, number, number],
                color
            );
        }

        const shapeComp = stage.addComponentFromObject(shape);
        if (shapeComp) {
            shapeComp.addRepresentation('buffer', { linewidth: 3 });
            unitCellShapeRef.current = shapeComp;
        }
    }, [structure, isDark]);

    // Create axes labels using NGL.Shape
    const createAxesShape = useCallback((stage: NGL.Stage) => {
        // Remove existing axes shape
        if (axesShapeRef.current) {
            stage.removeComponent(axesShapeRef.current);
            axesShapeRef.current = null;
        }

        if (!showLabels) return;

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
    }, [showLabels, structure]);

    // Create slice plane indicator using NGL.Shape
    const updateSlicePlane = useCallback((stage: NGL.Stage) => {
        // Remove existing slice plane
        if (slicePlaneShapeRef.current) {
            stage.removeComponent(slicePlaneShapeRef.current);
            slicePlaneShapeRef.current = null;
        }

        if (sliceZ === undefined) return;

        const { a, b = a, c = a } = structure;
        const zPos = sliceZ * c;

        const shape: NGLShape = new NGL.Shape('sliceplane');
        const color: [number, number, number] = isDark ? [0.42, 0.62, 1] : [0.15, 0.39, 0.92];

        // Draw slice plane border
        const corners: [number, number, number][] = [
            [0, 0, zPos],
            [a, 0, zPos],
            [a, b, zPos],
            [0, b, zPos],
        ];

        for (let i = 0; i < 4; i++) {
            const j = (i + 1) % 4;
            shape.addWideline(corners[i], corners[j], color);
        }

        // Add corner markers
        for (const corner of corners) {
            shape.addSphere(corner, color, 0.1);
        }

        const shapeComp = stage.addComponentFromObject(shape);
        if (shapeComp) {
            shapeComp.addRepresentation('buffer', { linewidth: 5 });
            slicePlaneShapeRef.current = shapeComp;
        }
    }, [structure, sliceZ, isDark]);

    // Update structure representation
    const updateStructure = useCallback(async (stage: NGL.Stage) => {
        // Remove any existing structure components (find by name)
        const toRemove: NGL.Component[] = [];
        stage.eachComponent((comp: NGL.Component) => {
            if (comp.name === 'structure.pdb') {
                toRemove.push(comp);
            }
        });
        toRemove.forEach(comp => {
            try {
                stage.removeComponent(comp);
            } catch (e) {
                // Ignore removal errors
            }
        });
        structureComponentRef.current = null;

        // Generate PDB content
        const pdbContent = generatePDB(structure);
        const blob = new Blob([pdbContent], { type: 'text/plain' });
        const file = new File([blob], 'structure.pdb');

        try {
            const component = await stage.loadFile(file, {
                defaultRepresentation: false,
                name: 'structure.pdb',
            }) as NGL.StructureComponent;

            // Store reference before adding representations
            structureComponentRef.current = component;

            if (showBonds) {
                component.addRepresentation('ball+stick', {
                    colorScheme: 'element',
                    aspectRatio: 2.5,
                    bondScale: 0.3,
                    radiusScale: 0.4,
                });
            } else {
                component.addRepresentation('spacefill', {
                    colorScheme: 'element',
                    radiusScale: 0.4,
                });
            }

            // Auto-view to fit structure
            stage.autoView();
        } catch (error) {
            console.error('Error loading structure:', error);
        }
    }, [structure, showBonds]);

    // Initialize NGL Stage
    useEffect(() => {
        if (!containerRef.current) return;

        const stage = new NGL.Stage(containerRef.current, {
            backgroundColor: getBackgroundColor(),
            quality: 'medium',
        });
        stageRef.current = stage;

        // Set up spin animation
        stage.setSpin(true);

        // Initial setup
        updateStructure(stage);
        createUnitCellShape(stage);
        createAxesShape(stage);
        updateSlicePlane(stage);

        return () => {
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
    }, [structure, showBonds, updateStructure, createUnitCellShape]);

    // Update axes on showLabels change
    useEffect(() => {
        if (stageRef.current) {
            createAxesShape(stageRef.current);
        }
    }, [showLabels, createAxesShape]);

    // Update slice plane on sliceZ change
    useEffect(() => {
        if (stageRef.current) {
            updateSlicePlane(stageRef.current);
        }
    }, [sliceZ, updateSlicePlane]);

    // Update background on theme change
    useEffect(() => {
        if (stageRef.current) {
            stageRef.current.setParameters({ backgroundColor: getBackgroundColor() });
            // Recreate shapes with updated colors
            createUnitCellShape(stageRef.current);
            createAxesShape(stageRef.current);
            updateSlicePlane(stageRef.current);
        }
    }, [isDark, getBackgroundColor, createUnitCellShape, createAxesShape, updateSlicePlane]);

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
                borderRadius: '4px',
                border: `1px solid ${theme.border}`,
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: 6,
                    left: 8,
                    color: theme.text,
                    fontSize: '10px',
                    fontWeight: 'bold',
                    pointerEvents: 'none',
                    zIndex: 1,
                }}
            >
                {structure.name}
            </div>
            {sliceZ !== undefined && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 6,
                        left: 8,
                        color: isDark ? '#6b9eff' : '#2563eb',
                        fontSize: '9px',
                        pointerEvents: 'none',
                        zIndex: 1,
                    }}
                >
                    z = {sliceZ.toFixed(2)}
                </div>
            )}
        </div>
    );
};

export default UnitCellView;
