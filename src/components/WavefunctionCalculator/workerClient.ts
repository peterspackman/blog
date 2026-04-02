/**
 * Typed wrapper around the OCC CLI Web Worker.
 * Eliminates raw postMessage/onmessage and `any` casts.
 */

import type { SCFSettings, CubeGeometrySettings, WorkerResponse } from './types';

export interface SCFWorkerRequest {
    xyzData: string;
    settings: SCFSettings;
}

export interface CubeWorkerRequest {
    owfData: Uint8Array;
    property: string;
    orbital?: string | null;
    spin?: 'alpha' | 'beta' | null;
    cubeSettings: CubeGeometrySettings;
    gridStepsOverride?: number;
}

export type WorkerCallbacks = {
    onOutput: (text: string) => void;
    onError: (text: string) => void;
    onReady?: () => void;
};

/**
 * Run an SCF calculation in a Web Worker.
 * Returns a handle with terminate() for cancellation.
 */
export function runSCFWorker(
    request: SCFWorkerRequest,
    callbacks: WorkerCallbacks,
    onComplete: (response: Extract<WorkerResponse, { type: 'exit' }>) => void,
): { terminate: () => void } {
    const worker = new Worker('/occ-cli-worker.js');
    let hasExited = false;

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const data = e.data;
        switch (data.type) {
            case 'ready':
                callbacks.onReady?.();
                break;
            case 'output':
                callbacks.onOutput(data.text);
                break;
            case 'error':
                callbacks.onError(data.text);
                break;
            case 'exit':
                if (hasExited) return;
                hasExited = true;
                onComplete(data);
                worker.terminate();
                break;
        }
    };

    worker.onerror = (err) => {
        callbacks.onError(`Worker error: ${err.message}`);
        worker.terminate();
    };

    const { settings } = request;
    const payload: Record<string, unknown> = {
        xyzData: request.xyzData,
        method: settings.method,
        basis: settings.basisSet,
        charge: settings.charge,
        multiplicity: settings.multiplicity,
        threads: settings.threads,
    };

    if (settings.optimize) {
        payload.optMaxIterations = 50;
    }
    if (settings.computeFrequencies && settings.optimize) {
        payload.computeFrequencies = true;
    }

    worker.postMessage(payload);

    return {
        terminate: () => {
            if (!hasExited) {
                hasExited = true;
                worker.terminate();
            }
        },
    };
}

/**
 * Run a cube generation in a Web Worker.
 */
export function runCubeWorker(
    request: CubeWorkerRequest,
    callbacks: WorkerCallbacks,
    onComplete: (response: Extract<WorkerResponse, { type: 'exit' }>) => void,
): { terminate: () => void } {
    const worker = new Worker('/occ-cli-worker.js');
    let hasExited = false;

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const data = e.data;
        switch (data.type) {
            case 'output':
                callbacks.onOutput(`[CUBE] ${data.text}`);
                break;
            case 'error':
                callbacks.onError(`[CUBE ERROR] ${data.text}`);
                break;
            case 'exit':
                if (hasExited) return;
                hasExited = true;
                onComplete(data);
                worker.terminate();
                break;
        }
    };

    worker.onerror = (err) => {
        callbacks.onError(`Cube worker error: ${err.message}`);
        worker.terminate();
    };

    const { cubeSettings } = request;
    const gridSteps = request.gridStepsOverride || cubeSettings.gridSteps;
    const payload: Record<string, unknown> = {
        command: 'cube',
        owfData: request.owfData,
        property: request.property,
        orbital: request.orbital,
        spin: request.spin,
        gridSteps,
    };

    if (cubeSettings.useAdaptive) {
        payload.adaptive = true;
        payload.bufferDistance = cubeSettings.bufferDistance;
        payload.threshold = cubeSettings.threshold;
    }
    if (cubeSettings.customOrigin) {
        payload.origin = cubeSettings.origin;
    }
    if (cubeSettings.customDirections) {
        payload.directionA = cubeSettings.directionA;
        payload.directionB = cubeSettings.directionB;
        payload.directionC = cubeSettings.directionC;
    }

    worker.postMessage(payload);

    return {
        terminate: () => {
            if (!hasExited) {
                hasExited = true;
                worker.terminate();
            }
        },
    };
}

/**
 * Build a human-readable command preview string for logging.
 */
export function buildSCFCommandPreview(settings: SCFSettings): string {
    let cmd = `occ scf input.xyz ${settings.method} ${settings.basisSet}`;
    if (settings.charge !== 0) cmd += ` --charge ${settings.charge}`;
    if (settings.multiplicity !== 1) cmd += ` --multiplicity ${settings.multiplicity}`;
    if (settings.optimize) cmd += ` --opt-max-iterations 50`;
    if (settings.computeFrequencies && settings.optimize) cmd += ` --frequencies`;
    cmd += ` --threads=${settings.threads}`;
    cmd += ` -o json -o fchk`;
    return cmd;
}

export function buildCubeCommandPreview(
    property: string,
    orbital: string | null | undefined,
    spin: string | null | undefined,
    cubeSettings: CubeGeometrySettings,
    gridSteps: number,
): string {
    let cmd = `occ cube input.owf.json ${property}`;
    if (spin) cmd += ` ${spin}`;
    if (orbital) cmd += ` --orbital ${orbital}`;
    cmd += ` -n ${gridSteps}`;
    if (cubeSettings.useAdaptive) cmd += ` --adaptive --buffer ${cubeSettings.bufferDistance} --threshold ${cubeSettings.threshold}`;
    if (cubeSettings.customOrigin) cmd += ` --origin ${cubeSettings.origin.join(' ')}`;
    if (cubeSettings.customDirections) {
        cmd += ` --da ${cubeSettings.directionA.join(' ')}`;
        cmd += ` --db ${cubeSettings.directionB.join(' ')}`;
        cmd += ` --dc ${cubeSettings.directionC.join(' ')}`;
    }
    return cmd;
}
