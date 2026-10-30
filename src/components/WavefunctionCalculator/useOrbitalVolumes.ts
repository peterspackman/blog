import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OrbitalSpin } from '@peterspackman/ce-chem/compute';
import type { VolumeData } from '@peterspackman/ce-chem/data/VolumeData.js';
import { cubeBoxAround, type GridQuality } from './cubeBox';
import { loadCe, runTask, TaskCancelledError } from './runtime';
import type { CalculationResult } from './useCalculation';

export interface OrbitalRef {
    spin: OrbitalSpin;
    /** 0-based within its spin, as occ cube's --orbital takes it. */
    index: number;
}

export const orbitalKey = (o: OrbitalRef) => `${o.spin}:${o.index}`;

export type VolumeEntry =
    | { status: 'loading' }
    | { status: 'ready'; volume: VolumeData }
    | { status: 'failed'; error: string };

/** The cube request for one orbital, boxed around the result's atoms. */
export function orbitalCubeParams(result: CalculationResult, orbital: OrbitalRef, quality: GridQuality) {
    return {
        label: `${orbital.spin} MO ${orbital.index}`,
        property: 'mo',
        wavefunctionData: result.wavefunction.owfJson,
        // occ reads a numeric --orbital as 1-based (isosurface/orbital_index.cpp).
        orbital: String(orbital.index + 1),
        // occ needs the spin block for an unrestricted wavefunction.
        ...(orbital.spin === 'alpha' || orbital.spin === 'beta' ? { spin: orbital.spin } : {}),
        ...cubeBoxAround(result.structure.atoms.map((a) => a.position), quality),
        format: 'cube' as const,
    };
}

/**
 * Selected orbitals and their grids. Each selected orbital gets an occ cube
 * task; finished grids are kept per result and grid quality, so toggling an
 * orbital back on, or returning to a quality, is instant.
 */
export function useOrbitalVolumes(result: CalculationResult | null, quality: GridQuality) {
    // Tagged with the run it belongs to, so a new result never fetches the old selection.
    const [selection, setSelection] = useState<{ resultId?: number; orbitals: OrbitalRef[] }>({ orbitals: [] });
    const selected = selection.orbitals;
    const [entries, setEntries] = useState<Record<string, VolumeEntry>>({});
    const cache = useRef(new Map<string, VolumeData>());
    const inFlight = useRef(new Map<string, AbortController>());

    const cacheKey = useCallback(
        (o: OrbitalRef) => `${result?.id}:${quality}:${orbitalKey(o)}`,
        [result?.id, quality],
    );

    // A new result invalidates everything; orbitals are computed only when picked.
    useEffect(() => {
        for (const c of inFlight.current.values()) c.abort();
        inFlight.current.clear();
        cache.current.clear();
        setEntries({});
        setSelection({ resultId: result?.id, orbitals: [] });
    }, [result]);

    useEffect(() => {
        if (!result || selection.resultId !== result.id) return;
        const wanted = new Set(selected.map(cacheKey));
        for (const [key, controller] of inFlight.current) {
            if (!wanted.has(key)) {
                controller.abort();
                inFlight.current.delete(key);
            }
        }
        setEntries((prev) => {
            const out: Record<string, VolumeEntry> = {};
            for (const orbital of selected) {
                const key = cacheKey(orbital);
                const cached = cache.current.get(key);
                out[key] = cached ? { status: 'ready', volume: cached } : (prev[key] ?? { status: 'loading' });
            }
            return out;
        });
        for (const orbital of selected) {
            const key = cacheKey(orbital);
            if (cache.current.has(key) || inFlight.current.has(key)) continue;
            const controller = new AbortController();
            inFlight.current.set(key, controller);
            loadCe()
                .then(({ occ }) => runTask(occ.occCubeComputation.request(orbitalCubeParams(result, orbital, quality)), { signal: controller.signal }))
                .then(
                    (volume) => {
                        cache.current.set(key, volume);
                        if (controller.signal.aborted) return;
                        setEntries((prev) => (key in prev ? { ...prev, [key]: { status: 'ready', volume } } : prev));
                    },
                    (error) => {
                        if (controller.signal.aborted || error instanceof TaskCancelledError) return;
                        const message = error instanceof Error ? error.message : String(error);
                        setEntries((prev) => (key in prev ? { ...prev, [key]: { status: 'failed', error: message } } : prev));
                    },
                )
                .finally(() => {
                    if (inFlight.current.get(key) === controller) inFlight.current.delete(key);
                });
        }
    }, [result, quality, selection, selected, cacheKey]);

    useEffect(() => () => {
        for (const c of inFlight.current.values()) c.abort();
    }, []);

    const toggle = useCallback((orbital: OrbitalRef) => {
        setSelection((prev) => ({
            ...prev,
            orbitals: prev.orbitals.some((o) => orbitalKey(o) === orbitalKey(orbital))
                ? prev.orbitals.filter((o) => orbitalKey(o) !== orbitalKey(orbital))
                : [...prev.orbitals, orbital],
        }));
    }, []);

    const clear = useCallback(() => setSelection((prev) => ({ ...prev, orbitals: [] })), []);

    const isSelected = useMemo(() => {
        const keys = new Set(selected.map(orbitalKey));
        return (o: OrbitalRef) => keys.has(orbitalKey(o));
    }, [selected]);

    const entryFor = useCallback((o: OrbitalRef): VolumeEntry | undefined => entries[cacheKey(o)], [entries, cacheKey]);

    return { selected, entryFor, toggle, clear, isSelected };
}
