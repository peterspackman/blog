import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { StructureData } from '@peterspackman/ce-chem/data';
import type { VolumeData } from '@peterspackman/ce-chem/data/VolumeData.js';
import type { IsosurfaceResult } from '@peterspackman/ce-chem/compute/surface-types.js';
import type { VibMode } from '@peterspackman/ce-chem/compute';
import type {
    NormalModeAnimator,
    OrbitalSurface,
    RGB,
    RepresentationType,
    AtomLabels,
    StructureObject,
    SurfaceObject,
    ViewerStage,
} from '@peterspackman/ce-viewer/viewer';
import { useVizTheme } from '../shared/viz';
import { cssColorToHex, cssColorToRgb } from './orbitalColors';
import { viewAxes } from './orientation';
import { loadCe, propertyColouring, type CeModules } from './runtime';
import styles from './Viewport.module.css';

export interface ViewportSurface {
    key: string;
    volume: VolumeData;
    colors: { positive: RGB; negative: RGB };
}

/** A computed isosurface mesh (density, ESP, …), coloured by one of its properties. */
export interface ViewportMesh {
    key: string;
    mesh: IsosurfaceResult;
    /** '' for a plain colour. */
    property: string;
    opacity: number;
    visible: boolean;
}

/** A signed field's grid (deformation density), drawn as + and − lobes at ±isovalue. */
export interface ViewportSignedVolume {
    key: string;
    volume: VolumeData;
    isovalue: number;
    opacity: number;
    visible: boolean;
    colors: { positive: RGB; negative: RGB };
}

export interface ViewportProps {
    structure: StructureData | null;
    representation: RepresentationType;
    surfaces: ViewportSurface[];
    meshes: ViewportMesh[];
    signedVolumes: ViewportSignedVolume[];
    isovalue: number;
    opacity: number;
    surfaceStyle: 'solid' | 'wireframe';
    mode: VibMode | null;
    playing: boolean;
    amplitude: number;
    showVectors: boolean;
    /** One label per atom ('' for none); null for no labels. */
    atomLabels?: string[] | null;
    /** Per-atom colour (linear RGB 0–1) in place of element colours; null for element colours. */
    atomColorFn?: ((atomIndex: number) => RGB) | null;
    children?: React.ReactNode;
}

export interface ViewportHandle {
    fit(): void;
}

/**
 * The ce-viewer stage as a React component. Props describe the scene; effects
 * apply each change to the long-lived three.js objects rather than rebuilding.
 */
export const Viewport = forwardRef<ViewportHandle, ViewportProps>(function Viewport(props, ref) {
    const { structure, representation, surfaces, meshes, signedVolumes, isovalue, opacity, surfaceStyle, mode, playing, amplitude, showVectors } = props;
    const { atomLabels = null, atomColorFn = null } = props;
    const hostRef = useRef<HTMLDivElement>(null);
    const theme = useVizTheme();
    const [ce, setCe] = useState<CeModules | null>(null);
    const [stage, setStage] = useState<ViewerStage | null>(null);
    const [mol, setMol] = useState<StructureObject | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const animatorRef = useRef<NormalModeAnimator | null>(null);
    const labelsRef = useRef<AtomLabels | null>(null);
    const surfacesRef = useRef(new Map<string, { volume: VolumeData; surface: OrbitalSurface }>());
    const signedRef = useRef(new Map<string, { volume: VolumeData; surface: OrbitalSurface }>());
    const meshesRef = useRef(new Map<string, { mesh: IsosurfaceResult; object: SurfaceObject; property?: string }>());
    // Orbital lobes reach well past the atoms; refit once when a structure's
    // first surfaces arrive, then leave the camera to the user.
    const fittedSurfacesRef = useRef(false);
    // The element sequence last oriented for: a new molecule turns face-on,
    // the same one (say, its optimised geometry) keeps the user's view.
    const orientedForRef = useRef<string | null>(null);

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
        stage.setOutlineColor(cssColorToHex(theme.accent));
        stage.requestRender();
    }, [stage, theme.canvas, theme.accent]);

    useEffect(() => {
        if (!ce || !stage || !structure) return;
        const obj = new ce.viewer.StructureObject(structure, representation, 'standard');
        stage.attachStructure(obj);
        const identity = structure.atoms.map((a) => a.element).join(' ');
        if (orientedForRef.current !== identity) {
            orientedForRef.current = identity;
            const axes = viewAxes(structure.atoms.map((a) => a.position));
            if (axes) stage.lookAlong(axes.normal, axes.up);
        }
        stage.fitToContent({ only: [obj.group] });
        fittedSurfacesRef.current = false;
        stage.requestRender();
        setMol(obj);
        return () => {
            // The animator writes into this structure; stop it (restoring the
            // equilibrium geometry) before the structure goes.
            animatorRef.current?.dispose();
            animatorRef.current = null;
            // Labels hang under the structure's group.
            labelsRef.current?.dispose();
            labelsRef.current = null;
            setMol(null);
            stage.detachStructure(obj);
            obj.dispose();
            stage.requestRender();
        };
        // Representation changes are applied in place below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ce, stage, structure]);

    useEffect(() => {
        if (!mol || !stage) return;
        mol.setRepresentation(representation);
        stage.requestRender();
    }, [mol, stage, representation]);

    useEffect(() => {
        if (!mol || !stage) return;
        mol.setAtomColorFn(atomColorFn);
        stage.requestRender();
    }, [mol, stage, atomColorFn]);

    useEffect(() => {
        if (!ce || !stage || !mol) return;
        if (!atomLabels) {
            labelsRef.current?.dispose();
            labelsRef.current = null;
            stage.requestRender();
            return;
        }
        if (labelsRef.current) labelsRef.current.setTexts(atomLabels);
        else labelsRef.current = new ce.viewer.AtomLabels(stage, mol, { texts: atomLabels, anchor: 'above', offset: 10 });
        labelsRef.current.setColors(theme.text, theme.canvas);
        stage.requestRender();
    }, [ce, stage, mol, atomLabels, theme.text, theme.canvas]);

    useEffect(() => {
        if (!ce || !stage) return;
        const current = surfacesRef.current;
        const wanted = new Map(surfaces.map((s) => [s.key, s]));
        for (const [key, entry] of current) {
            const next = wanted.get(key);
            if (!next || next.volume !== entry.volume) {
                stage.remove(entry.surface.group);
                entry.surface.dispose();
                current.delete(key);
            }
        }
        for (const s of surfaces) {
            const existing = current.get(s.key);
            if (existing) {
                existing.surface.setColors(s.colors.positive, s.colors.negative);
                continue;
            }
            const surface = new ce.viewer.OrbitalSurface(s.volume, {
                isovalue,
                opacity,
                style: surfaceStyle,
                colors: s.colors,
                target: stage,
            });
            stage.add(surface.group);
            current.set(s.key, { volume: s.volume, surface });
        }
        fitOnFirstSurface(stage);
        stage.requestRender();
        // Isovalue, opacity and style are applied to every surface below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ce, stage, surfaces]);

    useEffect(() => {
        if (!ce || !stage) return;
        const current = meshesRef.current;
        const wanted = new Map(meshes.map((m) => [m.key, m]));
        for (const [key, entry] of current) {
            const next = wanted.get(key);
            if (!next || next.mesh !== entry.mesh) {
                stage.remove(entry.object.group);
                entry.object.dispose();
                current.delete(key);
            }
        }
        for (const m of meshes) {
            let entry = current.get(m.key);
            if (!entry) {
                const object = new ce.viewer.SurfaceObject(m.mesh);
                object.setSolidColor(cssColorToRgb(theme.muted));
                stage.add(object.group);
                entry = { mesh: m.mesh, object };
                current.set(m.key, entry);
            }
            if (entry.property !== m.property) {
                entry.property = m.property;
                const values = m.mesh.properties[m.property];
                if (values) {
                    const { colormap, range } = propertyColouring(ce, values, m.property);
                    entry.object.setProperty(m.property, colormap, range);
                } else {
                    entry.object.setProperty('');
                }
            }
            entry.object.setOpacity(m.opacity);
            entry.object.setVisible(m.visible);
        }
        fitOnFirstSurface(stage);
        stage.requestRender();
        // fitOnFirstSurface reads refs only.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ce, stage, meshes, theme.muted]);

    useEffect(() => {
        if (!ce || !stage) return;
        const current = signedRef.current;
        const wanted = new Map(signedVolumes.map((v) => [v.key, v]));
        for (const [key, entry] of current) {
            const next = wanted.get(key);
            if (!next || next.volume !== entry.volume) {
                stage.remove(entry.surface.group);
                entry.surface.dispose();
                current.delete(key);
            }
        }
        for (const v of signedVolumes) {
            let entry = current.get(v.key);
            if (!entry) {
                const surface = new ce.viewer.OrbitalSurface(v.volume, { isovalue: v.isovalue, opacity: v.opacity, colors: v.colors, target: stage });
                stage.add(surface.group);
                entry = { volume: v.volume, surface };
                current.set(v.key, entry);
            }
            if (entry.surface.isovalue !== v.isovalue) entry.surface.setIsovalue(v.isovalue);
            entry.surface.setColors(v.colors.positive, v.colors.negative);
            entry.surface.setOpacity(v.opacity);
            entry.surface.setVisible(v.visible);
        }
        fitOnFirstSurface(stage);
        stage.requestRender();
        // fitOnFirstSurface reads refs only.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ce, stage, signedVolumes]);

    useEffect(() => {
        for (const { surface } of surfacesRef.current.values()) {
            if (surface.isovalue !== isovalue) surface.setIsovalue(isovalue);
            surface.setOpacity(opacity);
            surface.setStyle(surfaceStyle);
        }
        stage?.requestRender();
    }, [stage, surfaces, isovalue, opacity, surfaceStyle]);

    useEffect(() => {
        if (!ce || !stage || !mol || !mode) return;
        const animator = new ce.viewer.NormalModeAnimator(stage, mol, mode, { amplitude });
        animatorRef.current = animator;
        return () => {
            if (animatorRef.current !== animator) return;
            animator.dispose();
            animatorRef.current = null;
        };
        // Amplitude, playback and vectors are applied in place below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ce, stage, mol, mode]);

    useEffect(() => {
        const animator = animatorRef.current;
        if (!animator) return;
        animator.setAmplitude(amplitude);
        animator.showVectors(showVectors);
        if (playing) animator.play();
        else animator.pause();
    }, [mol, mode, playing, amplitude, showVectors]);

    function fitOnFirstSurface(s: ViewerStage) {
        if (fittedSurfacesRef.current || surfacesRef.current.size + meshesRef.current.size + signedRef.current.size === 0) return;
        fittedSurfacesRef.current = true;
        s.fitToContent();
    }

    // Declared last so that, on unmount, the structure, animator and surfaces
    // above are torn down before the stage they live on.
    useEffect(() => {
        if (!ce || !hostRef.current) return;
        const canvas = document.createElement('canvas');
        hostRef.current.appendChild(canvas);
        const s = new ce.viewer.ViewerStage(canvas, { debugGlobal: false });
        setStage(s);
        const surfaceMap = surfacesRef.current;
        const meshMap = meshesRef.current;
        const signedMap = signedRef.current;
        return () => {
            for (const { surface } of signedMap.values()) {
                s.remove(surface.group);
                surface.dispose();
            }
            signedMap.clear();
            for (const { surface } of surfaceMap.values()) {
                s.remove(surface.group);
                surface.dispose();
            }
            surfaceMap.clear();
            for (const { object } of meshMap.values()) {
                s.remove(object.group);
                object.dispose();
            }
            meshMap.clear();
            setStage(null);
            s.dispose();
            canvas.remove();
        };
    }, [ce]);

    useImperativeHandle(ref, () => ({
        fit() {
            stage?.fitToContent();
            stage?.requestRender();
        },
    }), [stage]);

    return (
        <div className={styles.viewport}>
            <div ref={hostRef} className={styles.canvasHost} />
            {loadError && <div className={styles.message}>Could not load the viewer: {loadError}</div>}
            {!loadError && !stage && <div className={styles.message}>Loading viewer…</div>}
            {props.children}
        </div>
    );
});
