import { useCallback, useEffect, useRef, useState } from 'react';
import { orbitalTablesFromOwf } from '@peterspackman/ce-chem/compute';
import type { OrbitalTables, VibMode } from '@peterspackman/ce-chem/compute';
import type { StructureData } from '@peterspackman/ce-chem/data';
import type { TaskProgress } from '@peterspackman/ce-chem/tasks.js';
import type { WavefunctionResult } from '@peterspackman/ce-calc/occ';
import type { OccOptimizeResult, OptimizationTrace } from '@peterspackman/ce-calc/occ/optimize.js';
import { xtbCharges } from './charges';
import type { Molecule } from './molecule';
import { loadCe, runTask, TaskCancelledError } from './runtime';
import { effectiveBasis, type CalculationSettings } from './settings';

export interface CalculationResult {
    /** Distinguishes runs, so caches keyed on it never mix results. */
    id: number;
    settings: CalculationSettings;
    /** The geometry the wavefunction belongs to: optimised if optimisation ran. */
    structure: StructureData;
    wavefunction: WavefunctionResult;
    orbitals: OrbitalTables;
    optimization?: OptimizationTrace;
    /** Present whenever frequencies were asked for; `vibrations` only when occ also wrote the modes. */
    frequenciesCm?: number[];
    vibrations?: VibMode[];
    /** GFN2-xTB charges stored in the wavefunction file, for xTB runs. */
    xtbCharges?: number[];
    elapsedMs: number;
}

export type CalculationPhase = 'idle' | 'running' | 'done' | 'failed' | 'cancelled';

export interface CalculationState {
    phase: CalculationPhase;
    /** occ's output so far; kept after the run for the log tab. */
    log: string;
    progress: TaskProgress | null;
    result: CalculationResult | null;
    error: string | null;
}

const IDLE: CalculationState = { phase: 'idle', log: '', progress: null, result: null, error: null };

let nextRunId = 1;

/** Runs one calculation at a time; starting another cancels the first. */
export function useCalculation() {
    const [state, setState] = useState<CalculationState>(IDLE);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => () => abortRef.current?.abort(), []);

    const run = useCallback(async (molecule: Molecule, settings: CalculationSettings) => {
        abortRef.current?.abort();
        const abort = new AbortController();
        abortRef.current = abort;
        setState({ ...IDLE, phase: 'running' });

        const started = performance.now();
        const params = {
            atoms: molecule.data.atoms,
            method: settings.method,
            basis: effectiveBasis(settings.method, settings.basis),
            charge: settings.charge,
            multiplicity: settings.multiplicity,
            unrestricted: settings.unrestricted || settings.multiplicity > 1,
            scfMaxIter: settings.maxScfIterations,
        };
        const onUpdate = (s: { log?: string; progress: TaskProgress }) => {
            if (abort.signal.aborted) return;
            setState((prev) => ({ ...prev, log: s.log ?? prev.log, progress: s.progress }));
        };

        try {
            const { occ } = await loadCe();
            const wantsDriver = settings.optimize || settings.frequencies;
            const result: OccOptimizeResult | WavefunctionResult = wantsDriver
                ? await runTask(
                      occ.occOptimizeComputation.request({
                          ...params,
                          optimize: settings.optimize ? { maxIterations: settings.maxOptSteps } : undefined,
                          frequencies: settings.frequencies,
                      }),
                      { onUpdate, signal: abort.signal },
                  )
                : await runTask(occ.occWavefunctionComputation.request(params), { onUpdate, signal: abort.signal });

            // A plain SCF result has none of the optimisation fields.
            const driven = result as WavefunctionResult & Partial<Pick<OccOptimizeResult, 'atoms' | 'optimization' | 'vibrations' | 'frequenciesCm'>>;
            const finalAtoms = driven.atoms ?? molecule.data.atoms;
            const owf: unknown = JSON.parse(new TextDecoder().decode(result.owfJson));
            const calc: CalculationResult = {
                id: nextRunId++,
                settings,
                structure: { ...molecule.data, atoms: finalAtoms.map((a) => ({ ...a, position: { ...a.position } })) },
                wavefunction: result,
                orbitals: orbitalTablesFromOwf(owf),
                xtbCharges: xtbCharges(owf),
                optimization: driven.optimization,
                frequenciesCm: driven.frequenciesCm,
                vibrations: driven.vibrations,
                elapsedMs: performance.now() - started,
            };
            if (!abort.signal.aborted) setState((prev) => ({ ...prev, phase: 'done', progress: null, result: calc }));
        } catch (error) {
            if (abortRef.current !== abort) return;
            if (error instanceof TaskCancelledError) {
                setState((prev) => ({ ...prev, phase: 'cancelled', progress: null }));
            } else {
                const message = error instanceof Error ? error.message : String(error);
                setState((prev) => ({ ...prev, phase: 'failed', progress: null, error: message }));
            }
        }
    }, []);

    const cancel = useCallback(() => abortRef.current?.abort(), []);

    return { ...state, run, cancel };
}
