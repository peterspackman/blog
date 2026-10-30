import { useEffect, useState } from 'react';
import type { ComputationDef, TaskState } from '@peterspackman/ce-chem/tasks.js';
import type { WebTaskManager } from '@peterspackman/ce-calc/tasks';

/**
 * ce-calc and ce-viewer touch Worker, ResizeObserver and WebGL when used, so
 * they are only ever loaded in the browser, on first need, and shared by
 * everything on the page.
 */
async function importCe() {
    const [tasks, occ, calc, viewer] = await Promise.all([
        import('@peterspackman/ce-calc/tasks'),
        import('@peterspackman/ce-calc/occ'),
        import('@peterspackman/ce-calc'),
        import('@peterspackman/ce-viewer/viewer'),
    ]);
    return { tasks, occ, calc, viewer };
}

export type CeModules = Awaited<ReturnType<typeof importCe>>;

let modules: Promise<CeModules> | null = null;
let manager: WebTaskManager | null = null;

export function loadCe(): Promise<CeModules> {
    modules ??= importCe().catch((error) => {
        modules = null;
        throw error;
    });
    return modules;
}

async function taskManager(): Promise<WebTaskManager> {
    const { tasks } = await loadCe();
    manager ??= new tasks.WebTaskManager();
    return manager;
}

export class TaskCancelledError extends Error {
    constructor() {
        super('Cancelled');
        this.name = 'TaskCancelledError';
    }
}

/**
 * Submit a computation and resolve with its result. `onUpdate` sees every
 * state change (progress, the growing log); aborting `signal` cancels the task,
 * terminating its occ worker, and rejects with TaskCancelledError.
 */
export async function runTask<R>(
    request: ComputationDef<string, unknown, R>,
    options: { onUpdate?: (state: TaskState<R>) => void; signal?: AbortSignal } = {},
): Promise<R> {
    const { onUpdate, signal } = options;
    if (signal?.aborted) throw new TaskCancelledError();
    const [tm, { tasks }] = await Promise.all([taskManager(), loadCe()]);
    const id = await tm.submit(request);
    return new Promise<R>((resolve, reject) => {
        let settled = false;
        const onAbort = () => void tm.cancel(id);
        const handle = (raw: TaskState) => {
            if (settled) return;
            const state = raw as TaskState<R>;
            onUpdate?.(state);
            if (!tasks.isTerminalStatus(state.status)) return;
            settled = true;
            off();
            signal?.removeEventListener('abort', onAbort);
            void tm.cleanup(id);
            if (state.status === 'completed' && state.result !== undefined) resolve(state.result);
            else if (state.status === 'cancelled') reject(new TaskCancelledError());
            else reject(new Error(state.error || `occ task ${state.status}`));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        const off = tm.onTask(id, handle);
        // onTask only reports later changes; the task may already have moved on.
        const current = tm.getState(id);
        if (current) handle(current);
    });
}

/** The ce-* modules once loaded in the browser; null until then. */
export function useCe(): CeModules | null {
    const [ce, setCe] = useState<CeModules | null>(null);
    useEffect(() => {
        let live = true;
        loadCe().then((m) => live && setCe(m), () => {});
        return () => {
            live = false;
        };
    }, []);
    return ce;
}

/** How a surface property is coloured: ce-viewer's colormap for it and its range. */
export function propertyColouring(ce: CeModules, values: Float32Array, property: string) {
    const v = ce.viewer;
    return {
        colormap: v.resolvePropertyColormap(property),
        range: v.isDataRange(property) ? v.computeRange(values) : v.defaultRange(property),
    };
}
