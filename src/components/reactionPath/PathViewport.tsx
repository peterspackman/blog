import clsx from 'clsx';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    BufferAttribute,
    BufferGeometry,
    DoubleSide,
    LineBasicMaterial,
    LineSegments,
    Mesh,
    MeshLambertMaterial,
    Vector2,
    type Group,
} from 'three';
import { detectBonds, getElementColor } from '@peterspackman/ce-chem/data';
import { parseStructure } from '@peterspackman/ce-chem/parsers';
import type { StructureObject, ViewerStage } from '@peterspackman/ce-viewer/viewer';
import { useVizTheme } from '../shared/viz';
import { cssColorToHex, cssColorToRgb } from '../WavefunctionCalculator/orbitalColors';
import { viewAxes } from '../WavefunctionCalculator/orientation';
import { loadCe, type CeModules } from '../WavefunctionCalculator/runtime';
import { centroid, formatMeasure, labelAnchor, measure, type MeasureDef } from './measures';
import { chargesAt, distanceAlong, positionsAt, type ConformerPath, type PathCursor, type Progress } from './path';
import styles from './ReactionPath.module.css';

type Vec3 = [number, number, number];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export interface View {
    /** Into the screen. */
    direction: Vec3;
    up: Vec3;
}

/**
 * Nearly side-on to the plane of `planeAtoms` in the first image, looking
 * across the `from`→`to` axis (which lies left–right), tilted `tilt` degrees
 * down onto the plane. `above`: an atom to keep on the upper side.
 */
export function sideView(
    path: ConformerPath,
    planeAtoms: readonly number[],
    from: number,
    to: number,
    tilt: number,
    above?: number,
): View | null {
    const x = path.frames[0];
    const at = (i: number): Vec3 => [x[3 * i], x[3 * i + 1], x[3 * i + 2]];
    const axes = viewAxes(planeAtoms.map((i) => {
        const [px, py, pz] = at(i);
        return { x: px, y: py, z: pz };
    }));
    if (!axes) return null;
    let n = axes.normal;
    if (above !== undefined && n[0] * (x[3 * above] - x[3 * from]) + n[1] * (x[3 * above + 1] - x[3 * from + 1]) + n[2] * (x[3 * above + 2] - x[3 * from + 2]) < 0) {
        n = [-n[0], -n[1], -n[2]];
    }
    const side = cross(n, sub(at(to), at(from)));
    const len = Math.hypot(...side);
    const c = Math.cos((tilt * Math.PI) / 180), s = Math.sin((tilt * Math.PI) / 180);
    return { direction: [0, 1, 2].map((k) => (c * side[k]) / len - s * n[k]) as Vec3, up: n };
}

function xyzOf(path: ConformerPath): string {
    const x = path.frames[0];
    const lines = path.symbols.map((el, i) => `${el} ${x[3 * i]} ${x[3 * i + 1]} ${x[3 * i + 2]}`);
    return `${path.symbols.length}\n\n${lines.join('\n')}\n`;
}

export interface PathViewportProps {
    /** Extra class on the viewport box, e.g. to size it in full-screen mode. */
    className?: string;
    path: ConformerPath;
    /** Where on the path, in `progress`'s x. */
    cursor: PathCursor;
    /** From the cursor's x to this path's s; distance along it by default. */
    progress?: Progress;
    view?: View | null;
    /** Camera zoom after fitting the structure; fitToContent leaves room to rotate the whole box. */
    zoom?: number;
    /** Atoms drawn in `highlightColor` instead of their element colour. */
    highlight?: readonly number[];
    highlightColor?: string;
    /** Distances, angles and dihedrals to draw, kept up to date as the atoms move. */
    measurements?: readonly MeasureDef[];
    showHydrogens?: boolean;
    /** Shade a six-membered `path.ring` as a chair is drawn: the C2–C3–C5–C6 seat and the triangles at C1 and C4. */
    ringFaces?: boolean;
    /** Colours of the seat, the C1 end and the C4 end. */
    ringColors?: readonly [string, string, string];
    /** Colour atoms by the path's charges instead of by element. */
    showCharges?: boolean;
    /** |charge| (e) drawn at full colour. */
    chargeScale?: number;
    /** Atoms coloured as one by their summed charge (say a CH₃); others by their own. */
    chargeGroups?: (positions: Float32Array) => number[][];
    /** Text placed in the scene, recomputed as the atoms move. */
    labels?: (positions: Float32Array, charges: Float32Array | null) => { position: [number, number, number]; text: string }[];
}

/**
 * Triangles over the ring (indices into `ring`): the four-carbon seat as two
 * triangles, then the ends at C1 and C4. In a chair the seat is flat and the
 * ends fold opposite ways; in a boat they fold the same way.
 */
const RING_FACES = [1, 2, 4, 1, 4, 5, 0, 1, 5, 2, 3, 4];
/** The seat's edges across the ring, where the ends fold, then its diagonal:
 *  faint, so it vanishes in a flat seat and shows as a crease in a twist-boat. */
const RING_FOLDS = [1, 5, 2, 4, 1, 4];

/** The ce-viewer stage showing the path's structure at the cursor. */
export function PathViewport(props: PathViewportProps) {
    const { path, cursor, progress = distanceAlong, view = null, zoom = 1.4 } = props;
    const { highlight = [], highlightColor, measurements = [] } = props;
    const { showHydrogens = true, ringFaces = false, ringColors, showCharges = false, chargeScale = 0.4, chargeGroups, labels: labelsFor } = props;
    const sAt = () => progress.toS(cursor.get());
    const hostRef = useRef<HTMLDivElement>(null);
    const theme = useVizTheme();
    const [ce, setCe] = useState<CeModules | null>(null);
    const [stage, setStage] = useState<ViewerStage | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const structure = useMemo(() => parseStructure('path.xyz', xyzOf(path)), [path]);
    const [mol, setMol] = useState<StructureObject | null>(null);

    useEffect(() => {
        let live = true;
        loadCe().then(
            (m) => live && setCe(m),
            (e) => live && setLoadError(e instanceof Error ? e.message : String(e)),
        );
        return () => {
            live = false;
        };
    }, []);

    useEffect(() => {
        if (!stage) return;
        stage.setBackground(cssColorToHex(theme.canvas));
        stage.requestRender();
    }, [stage, theme.canvas]);

    useEffect(() => {
        if (!ce || !stage) return;
        // Bonds are guessed from distances at each frame. When they change (a
        // reaction), the structure is rebuilt with the new ones; along a
        // conformational path they never do, and it's only ever moved.
        const atomsAt = (x: Float32Array) =>
            structure.atoms.map((a, i) => ({ ...a, position: { x: x[3 * i], y: x[3 * i + 1], z: x[3 * i + 2] } }));
        const keyOf = (bonds: { atomA: number; atomB: number }[]) => bonds.map((b) => `${b.atomA}-${b.atomB}`).join(' ');
        const buffer = new Float32Array(path.frames[0].length);
        let obj = new ce.viewer.StructureObject(structure, 'ball+stick', 'standard');
        let bondKey = keyOf(structure.bonds);
        stage.attachStructure(obj);
        if (view) stage.lookAlong(view.direction, view.up);
        stage.fitToContent({ only: [obj.group] });
        stage.camera.zoom = zoom;
        stage.camera.updateProjectionMatrix();
        setMol(obj);
        const apply = () => {
            const x = positionsAt(path, sAt(), buffer);
            const atoms = atomsAt(x);
            const bonds = detectBonds(atoms);
            const key = keyOf(bonds);
            if (key !== bondKey) {
                const next = new ce.viewer.StructureObject({ ...structure, atoms, bonds }, 'ball+stick', 'standard');
                stage.detachStructure(obj);
                obj.dispose();
                stage.attachStructure(next);
                obj = next;
                bondKey = key;
                setMol(next);
            }
            obj.updatePositions(x);
            stage.requestRender();
        };
        apply();
        const off = cursor.subscribe(apply);
        return () => {
            off();
            setMol(null);
            stage.detachStructure(obj);
            obj.dispose();
            stage.requestRender();
        };
        // The view and zoom are where the structure first appears; the user moves the camera after that.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ce, stage, structure, path, cursor, progress]);

    useEffect(() => {
        if (!mol || !stage || (showCharges && path.charges)) return;
        const marked = new Uint8Array(path.symbols.length);
        for (const i of highlight) marked[i] = 1;
        const colour = highlightColor ? cssColorToRgb(highlightColor) : null;
        const atoms = structure.atoms;
        mol.setAtomColorFn(
            colour ? (i) => (marked[i] ? colour : getElementColor(atoms[i].atomicNumber)) : null,
            // Every atom, when coming back from charge colours.
            colour ? marked : undefined,
        );
        stage.requestRender();
    }, [mol, stage, structure, path, highlight, highlightColor, showCharges]);

    useEffect(() => {
        if (!mol || !stage || !showCharges || !path.charges) return;
        const positive = cssColorToRgb(theme.series[0]);
        const negative = cssColorToRgb(theme.series[7]);
        const neutral: [number, number, number] = [0.92, 0.92, 0.92];
        const all = new Uint8Array(path.symbols.length).fill(1);
        const q = new Float32Array(path.symbols.length);
        const positions = new Float32Array(path.frames[0].length);
        const colourFor = (i: number): [number, number, number] => {
            const t = Math.max(-1, Math.min(1, q[i] / chargeScale));
            const to = t > 0 ? positive : negative;
            const f = Math.abs(t);
            return [0, 1, 2].map((k) => neutral[k] + (to[k] - neutral[k]) * f) as [number, number, number];
        };
        const recolour = () => {
            const s = sAt();
            chargesAt(path, s, q);
            if (chargeGroups) {
                for (const group of chargeGroups(positionsAt(path, s, positions))) {
                    const sum = group.reduce((t, i) => t + q[i], 0);
                    for (const i of group) q[i] = sum;
                }
            }
            mol.setAtomColorFn(colourFor, all);
            stage.requestRender();
        };
        recolour();
        return cursor.subscribe(recolour);
        // sAt reads cursor and progress, both listed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mol, stage, path, cursor, progress, showCharges, chargeScale, chargeGroups, theme.series]);

    useEffect(() => {
        if (!ce || !stage || !mol || measurements.length === 0) return;
        const v = ce.viewer;
        const resolution = stage.renderer.getSize(new Vector2());
        const labels = new v.LabelBatch({ fontSize: 13, fontWeight: 600, anchor: 'center' });
        labels.setViewport(resolution.x, resolution.y, stage.renderer.getPixelRatio());
        labels.setColors(theme.text, theme.canvas);
        mol.group.add(labels.object);
        let lines: Group | null = null;
        let current = positionsAt(path, sAt());
        // Labels are pushed out from the ring's centre, or the molecule's.
        const centreAtoms = path.ring.length ? path.ring : path.symbols.map((_, i) => i);
        const draw = () => {
            const ms = measurements.map((def) => measure(def, current));
            if (lines) {
                mol.group.remove(lines);
                v.disposeMeasurementLines(lines);
            }
            lines = v.buildMeasurementLines(ms, 2, resolution);
            if (lines) mol.group.add(lines);
            const centre = centroid(centreAtoms, current);
            labels.setLabels(ms.map((m) => ({ position: labelAnchor(m, centre), text: formatMeasure(m) })));
            stage.requestRender();
        };
        draw();
        const offMove = mol.onPositionsChanged((positions) => {
            current = positions;
            draw();
        });
        const offResize = stage.onResize((w, h, ratio) => {
            resolution.set(w, h);
            labels.setViewport(w, h, ratio);
            draw();
        });
        return () => {
            offMove();
            offResize();
            if (lines) {
                mol.group.remove(lines);
                v.disposeMeasurementLines(lines);
            }
            mol.group.remove(labels.object);
            labels.dispose();
            stage.requestRender();
        };
        // sAt reads cursor and progress, both listed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ce, stage, mol, path, cursor, progress, measurements, theme.text, theme.canvas]);

    useEffect(() => {
        if (!mol || !stage) return;
        const hidden = showHydrogens ? undefined : new Set(path.symbols.flatMap((el, i) => (el === 'H' ? [i] : [])));
        mol.setSuppressedAtoms(hidden);
        stage.requestRender();
    }, [mol, stage, path, showHydrogens]);

    useEffect(() => {
        if (!mol || !stage || !ringFaces || path.ring.length !== 6) return;
        const vertices = new BufferAttribute(new Float32Array(path.ring.length * 3), 3);
        const faces = new BufferGeometry();
        faces.setAttribute('position', vertices);
        faces.setIndex(RING_FACES);
        // Seat (two triangles), then each end, one material apiece.
        faces.addGroup(0, 6, 0);
        faces.addGroup(6, 3, 1);
        faces.addGroup(9, 3, 2);
        const folds = new BufferGeometry();
        folds.setAttribute('position', vertices);
        folds.setIndex(RING_FOLDS);
        folds.addGroup(0, 4, 0);
        folds.addGroup(4, 2, 1);
        const colours = ringColors ?? [theme.accent, theme.accent, theme.accent];
        const faceMaterials = colours.map(
            (color) => new MeshLambertMaterial({ color, transparent: true, opacity: 0.8, side: DoubleSide, depthWrite: false }),
        );
        const lineMaterials = [0.5, 0.25].map((opacity) => new LineBasicMaterial({ color: theme.text, transparent: true, opacity }));
        const mesh = new Mesh(faces, faceMaterials);
        const lines = new LineSegments(folds, lineMaterials);
        mol.group.add(mesh, lines);
        const place = (positions: ArrayLike<number>) => {
            path.ring.forEach((atom, k) => vertices.setXYZ(k, positions[3 * atom], positions[3 * atom + 1], positions[3 * atom + 2]));
            vertices.needsUpdate = true;
            faces.computeVertexNormals();
            faces.computeBoundingSphere();
            folds.computeBoundingSphere();
            stage.requestRender();
        };
        place(positionsAt(path, sAt()));
        const off = mol.onPositionsChanged(place);
        return () => {
            off();
            mol.group.remove(mesh, lines);
            faces.dispose();
            folds.dispose();
            faceMaterials.forEach((m) => m.dispose());
            lineMaterials.forEach((m) => m.dispose());
            stage.requestRender();
        };
        // sAt reads cursor and progress, both listed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mol, stage, path, cursor, progress, ringFaces, ringColors, theme.accent, theme.text]);

    useEffect(() => {
        if (!ce || !stage || !mol || !labelsFor) return;
        const resolution = stage.renderer.getSize(new Vector2());
        const batch = new ce.viewer.LabelBatch({ fontSize: 13, fontWeight: 600, anchor: 'above', gap: 10 });
        batch.setViewport(resolution.x, resolution.y, stage.renderer.getPixelRatio());
        batch.setColors(theme.text, theme.canvas);
        mol.group.add(batch.object);
        const q = path.charges ? new Float32Array(path.symbols.length) : null;
        const draw = (positions: Float32Array) => {
            if (q) chargesAt(path, sAt(), q);
            batch.setLabels(labelsFor(positions, q));
            stage.requestRender();
        };
        draw(positionsAt(path, sAt()));
        const offMove = mol.onPositionsChanged(draw);
        const offResize = stage.onResize((w, h, ratio) => batch.setViewport(w, h, ratio));
        return () => {
            offMove();
            offResize();
            mol.group.remove(batch.object);
            batch.dispose();
            stage.requestRender();
        };
        // sAt reads cursor and progress, both listed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ce, stage, mol, path, cursor, progress, labelsFor, theme.text, theme.canvas]);

    // Declared last so the structure above is torn down before its stage.
    useEffect(() => {
        if (!ce || !hostRef.current) return;
        const canvas = document.createElement('canvas');
        hostRef.current.appendChild(canvas);
        const s = new ce.viewer.ViewerStage(canvas, { debugGlobal: false });
        setStage(s);
        return () => {
            setStage(null);
            s.dispose();
            canvas.remove();
        };
    }, [ce]);

    return (
        <div className={clsx(styles.viewport, props.className)}>
            <div ref={hostRef} className={styles.canvasHost} />
            {loadError && <div className={styles.message}>Could not load the viewer: {loadError}</div>}
            {!loadError && !stage && <div className={styles.message}>Loading viewer…</div>}
        </div>
    );
}
