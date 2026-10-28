/**
 * Results for one structure and d_min across a set of solvents.
 *
 * Solvents run one at a time, each in a fresh worker; occ's pair-energy cache
 * from the first run is handed to the next, so only the first solvent pays
 * for the dimer calculations.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { parseCGResult, type CGResult } from './parse';
import { CGCancelled, runCrystalGrowth, type CGRun } from './runCG';

export interface Structure {
    name: string;
    /** null for the bundled default structure. */
    cif: string | null;
}

export interface Busy {
    solvent: string;
    done: number;
    total: number;
    started: number;
}

const key = (s: Structure, dmin: number) => `${s.name}|${s.cif?.length ?? 0}|${dmin}`;

export function useCGSession(opts: {
    defaultCif: string;
    precomputed: string;
    /** occ's pair-energy cache for the default structure, so extra solvents skip the dimers. */
    defaultCache: string;
    model: string;
    threads: number;
}) {
    const [structure, setStructure] = useState<Structure>({ name: 'paracetamol', cif: null });
    const [dmin, setDmin] = useState(3);
    const [results, setResults] = useState<Record<string, CGResult>>({});
    const [resultsKey, setResultsKey] = useState<string | null>(null);
    const [live, setLive] = useState(false);
    const [busy, setBusy] = useState<Busy | null>(null);
    const [lastRun, setLastRun] = useState<{ seconds: number; count: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [log, setLog] = useState('');

    const cache = useRef<{ structure: string; files: Record<string, string> } | null>(null);
    const queue = useRef<string[]>([]);
    const current = useRef<CGRun | null>(null);
    const optsRef = useRef(opts);
    optsRef.current = opts;

    useEffect(() => {
        let alive = true;
        fetch(opts.precomputed)
            .then((r) => r.json())
            .then((set) => {
                if (!alive) return;
                const parsed: Record<string, CGResult> = {};
                for (const [solvent, { json, stdout }] of Object.entries<{ json: unknown; stdout: string }>(set.results)) {
                    parsed[solvent] = parseCGResult(json, stdout);
                }
                setResults(parsed);
                setResultsKey(key({ name: set.name, cif: null }, set.dmin));
            })
            .catch((err) => {
                if (alive) setError(`Could not load the precomputed results: ${(err as Error).message}`);
            });
        return () => {
            alive = false;
            queue.current = [];
            current.current?.cancel();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const stale = resultsKey !== null && resultsKey !== key(structure, dmin);

    const drain = useCallback(async (s: Structure, d: number, fresh: boolean) => {
        const started = performance.now();
        const { defaultCif, defaultCache, model, threads } = optsRef.current;
        const cif = s.cif ?? (await fetch(defaultCif).then((r) => r.text()));
        const structureKey = `${s.name}|${s.cif?.length ?? 0}`;
        if (fresh || cache.current?.structure !== structureKey) cache.current = null;
        if (!cache.current && !fresh && s.cif === null) {
            const files = await fetch(defaultCache)
                .then((r) => r.json())
                .catch(() => null);
            if (files) cache.current = { structure: structureKey, files };
        }
        let done = 0;
        while (queue.current.length) {
            const solvent = queue.current.shift()!;
            setBusy({ solvent, done, total: done + 1 + queue.current.length, started });
            const lines: string[] = [];
            const run = runCrystalGrowth(
                { cif, name: s.name, model, solvent, dmin: d, threads, cache: cache.current?.files },
                (t) => lines.push(t),
            );
            current.current = run;
            try {
                const out = await run.promise;
                if (!cache.current && Object.keys(out.cache).length) cache.current = { structure: structureKey, files: out.cache };
                setResults((prev) => ({ ...prev, [solvent]: out.result }));
                setLog(out.stdout);
                done += 1;
            } catch (err) {
                setLog(lines.join('\n'));
                if (!(err instanceof CGCancelled)) setError(`${solvent}: ${(err as Error).message}`);
                queue.current = [];
            }
        }
        current.current = null;
        setBusy(null);
        if (done) {
            setLive(true);
            setLastRun({ seconds: (performance.now() - started) / 1000, count: done });
        }
    }, []);

    /** Recompute every solvent in `solvents` for the current inputs. */
    const runAll = useCallback(
        (solvents: string[]) => {
            if (busy || !solvents.length) return;
            setError(null);
            const k = key(structure, dmin);
            if (k !== resultsKey) {
                setResults({});
                setResultsKey(k);
            }
            queue.current = [...solvents];
            // From scratch: Run is the full calculation, dimers included.
            void drain(structure, dmin, true);
        },
        [busy, structure, dmin, resultsKey, drain],
    );

    /** Compute one more solvent for the inputs the current results belong to. */
    const add = useCallback(
        (solvent: string) => {
            if (stale || results[solvent]) return;
            if (busy) {
                if (!queue.current.includes(solvent) && busy.solvent !== solvent) {
                    queue.current.push(solvent);
                    setBusy((b) => b && { ...b, total: b.total + 1 });
                }
                return;
            }
            setError(null);
            queue.current = [solvent];
            void drain(structure, dmin, false);
        },
        [stale, results, busy, structure, dmin, drain],
    );

    const cancel = useCallback(() => {
        queue.current = [];
        current.current?.cancel();
    }, []);

    return {
        structure, setStructure, dmin, setDmin,
        results, stale, live, busy, lastRun, error, log,
        runAll, add, cancel,
    };
}
