/** Runs `occ cg` in the OCC CLI worker (static/occ-cli-worker.js). */
import { parseCGResult, trimCGJson, type CGResult } from './parse';

export interface CGRequest {
    cif: string;
    /** File stem; occ names its outputs after it. */
    name: string;
    model: string;
    solvent: string;
    dmin: number;
    threads: number;
    /** Pair-energy cache from an earlier run on the same structure (path -> contents). */
    cache?: Record<string, string>;
}

export interface CGOutput {
    result: CGResult;
    stdout: string;
    cache: Record<string, string>;
}

export interface CGRun {
    promise: Promise<CGOutput>;
    cancel: () => void;
}

export class CGCancelled extends Error {
    constructor() {
        super('cancelled');
    }
}

export function runCrystalGrowth(req: CGRequest, onLine?: (text: string) => void): CGRun {
    const worker = new Worker('/occ-cli-worker.js', { type: 'module' });
    let settle: { resolve: (o: CGOutput) => void; reject: (e: Error) => void } | null = null;
    const promise = new Promise<CGOutput>((resolve, reject) => {
        settle = { resolve, reject };
    });
    const finish = () => {
        settle = null;
        worker.terminate();
    };
    const fail = (message: string) => {
        const s = settle;
        finish();
        s?.reject(new Error(message));
    };

    worker.onmessage = (e: MessageEvent) => {
        const data = e.data;
        if (!settle) return;
        if (data.type === 'output' || data.type === 'error') onLine?.(data.text);
        else if (data.type === 'exit') {
            const file = Object.keys(data.files ?? {}).find((f) => f.endsWith('_cg_results.json'));
            if (data.code !== 0 || !file) {
                fail(`occ exited with code ${data.code}`);
                return;
            }
            try {
                const json = trimCGJson(JSON.parse(data.files[file]));
                const out = { result: parseCGResult(json, data.stdout), stdout: data.stdout, cache: data.cache ?? {} };
                const s = settle;
                finish();
                s.resolve(out);
            } catch (err) {
                fail(`Could not read the results: ${(err as Error).message}`);
            }
        }
    };
    worker.onerror = (err) => fail(`Worker error: ${err.message || 'could not start the OCC worker'}`);

    worker.postMessage({ command: 'cg', ...req });
    return {
        promise,
        cancel: () => {
            const s = settle;
            if (!s) return;
            finish();
            s.reject(new CGCancelled());
        },
    };
}

/** The command line equivalent to a request, for display. */
export function cgCommand(req: Pick<CGRequest, 'name' | 'model' | 'solvent' | 'dmin'>): string {
    return `occ cg ${req.name}.cif -m ${req.model} -s ${req.solvent} --surface-d-min ${req.dmin} --morphology`;
}
