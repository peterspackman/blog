import { useCallback, useEffect, useRef, useState } from 'react';
import type { IsosurfaceResult, SurfaceKindDescriptor } from '@peterspackman/ce-chem/compute/surface-types.js';
import { isDisplayableProperty } from '@peterspackman/ce-chem/compute/surface-types.js';
import type { VolumeData } from '@peterspackman/ce-chem/data/VolumeData.js';
import { cubeBoxAround } from './cubeBox';
import { loadCe, runTask, TaskCancelledError } from './runtime';
import { SIGNED_FIELD_KINDS, gridQualityFor, surfaceSettings } from './surfaceKinds';
import type { CalculationResult } from './useCalculation';

export interface SurfaceLayer {
    id: number;
    kind: SurfaceKindDescriptor['value'];
    label: string;
    isovalue: number;
    separation: number;
    status: 'computing' | 'ready' | 'failed';
    error?: string;
    mesh?: IsosurfaceResult;
    /** For a signed field: the grid both lobes are drawn from, at ±isovalue. */
    volume?: VolumeData;
    /** Property the surface is coloured by; '' for a plain colour. */
    property: string;
    opacity: number;
    visible: boolean;
}

/**
 * Properties a mesh can be coloured by, in the order occ returned them. A
 * property that is constant over the surface carries nothing to show: for an
 * isolated molecule that is everything measured from surrounding atoms (de,
 * dnorm, fragment patches).
 */
export function colourableProperties(mesh: IsosurfaceResult | undefined): string[] {
    if (!mesh) return [];
    return Object.keys(mesh.properties).filter((name) => isDisplayableProperty(name) && varies(mesh.properties[name]));
}

function varies(values: Float32Array): boolean {
    for (let i = 1; i < values.length; i++) if (values[i] !== values[0]) return true;
    return false;
}

/** The kind's conventional colouring if the mesh has it, else none. */
function initialProperty(preferred: string | undefined, mesh: IsosurfaceResult): string {
    return preferred && preferred in mesh.properties ? preferred : '';
}

let nextLayerId = 1;

/**
 * Isosurfaces of the current result's wavefunction (density, ESP, …), each an
 * occ isosurface task, or an occ cube for a signed field. They belong to the result they were computed from and
 * are dropped when it changes.
 */
export function useSurfaces(result: CalculationResult | null) {
    const [layers, setLayers] = useState<SurfaceLayer[]>([]);
    const tasks = useRef(new Map<number, AbortController>());

    useEffect(() => {
        for (const c of tasks.current.values()) c.abort();
        tasks.current.clear();
        setLayers([]);
    }, [result]);

    useEffect(() => () => {
        for (const c of tasks.current.values()) c.abort();
    }, []);

    const patch = useCallback((id: number, change: Partial<SurfaceLayer>) => {
        setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...change } : l)));
    }, []);

    const add = useCallback(
        (descriptor: SurfaceKindDescriptor, isovalue: number, separation: number) => {
            if (!result) return;
            const id = nextLayerId++;
            const settings = surfaceSettings(descriptor, isovalue, separation);
            setLayers((prev) => [
                ...prev,
                { id, kind: descriptor.value, label: descriptor.label, isovalue, separation, status: 'computing', property: '', opacity: 1, visible: true },
            ]);
            const controller = new AbortController();
            tasks.current.set(id, controller);
            const signed = SIGNED_FIELD_KINDS[descriptor.value];
            if (signed) {
                loadCe()
                    .then(({ occ }) =>
                        runTask(
                            occ.occCubeComputation.request({
                                label: descriptor.label,
                                property: signed.property,
                                wavefunctionData: result.wavefunction.owfJson,
                                ...cubeBoxAround(result.structure.atoms.map((a) => a.position), gridQualityFor(separation)),
                                format: 'cube',
                            }),
                            { signal: controller.signal },
                        ),
                    )
                    .then(
                        (volume) => patch(id, { status: 'ready', volume }),
                        (error) => {
                            if (controller.signal.aborted || error instanceof TaskCancelledError) return;
                            patch(id, { status: 'failed', error: error instanceof Error ? error.message : String(error) });
                        },
                    )
                    .finally(() => tasks.current.delete(id));
                return;
            }
            loadCe()
                .then(async ({ occ, viewer }) => {
                    const mesh = await runTask(
                        occ.occIsosurfaceComputation.request({
                            label: descriptor.label,
                            interiorAtoms: result.structure.atoms,
                            environmentAtoms: [],
                            surfaceKind: settings.surfaceKind,
                            isovalue: settings.isovalue,
                            separation: settings.separation,
                            properties: settings.properties,
                            wavefunctionData: result.wavefunction.owfJson,
                        }),
                        { signal: controller.signal },
                    );
                    return { mesh, preferred: viewer.SURFACE_DEFAULTS[descriptor.value]?.defaultProperty };
                })
                .then(
                    ({ mesh, preferred }) => patch(id, { status: 'ready', mesh, property: initialProperty(preferred, mesh) }),
                    (error) => {
                        if (controller.signal.aborted || error instanceof TaskCancelledError) return;
                        patch(id, { status: 'failed', error: error instanceof Error ? error.message : String(error) });
                    },
                )
                .finally(() => tasks.current.delete(id));
        },
        [result, patch],
    );

    const remove = useCallback((id: number) => {
        tasks.current.get(id)?.abort();
        tasks.current.delete(id);
        setLayers((prev) => prev.filter((l) => l.id !== id));
    }, []);

    return { layers, add, update: patch, remove };
}
