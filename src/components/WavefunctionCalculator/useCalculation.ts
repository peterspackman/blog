/**
 * Custom hook encapsulating all calculation state and orchestration.
 * Owns: worker lifecycle, results, logs, errors, cube cache, trajectories.
 */

import { useState, useRef, useCallback } from 'react';
import { parseCalculationResults } from './resultParser';
import {
    runSCFWorker, runCubeWorker,
    buildSCFCommandPreview, buildCubeCommandPreview,
} from './workerClient';
import { NormalModeTrajectory } from './NormalModeTrajectory';
import type {
    CalculationResult,
    SCFSettings,
    CubeGeometrySettings,
    GridInfo,
    LogEntry,
} from './types';

export function useCalculation() {
    // ── State ──────────────────────────────────────────────────────────────
    const [isCalculating, setIsCalculating] = useState(false);
    const [isCubeComputing, setIsCubeComputing] = useState(false);
    const [results, setResults] = useState<CalculationResult | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [error, setError] = useState('');
    const [cubeResults, setCubeResults] = useState<Map<string, string>>(new Map());
    const [cubeGridInfo, setCubeGridInfo] = useState<GridInfo | null>(null);
    const [wavefunctionData, setWavefunctionData] = useState<Uint8Array | null>(null);
    const [precomputedTrajectories, setPrecomputedTrajectories] = useState<Map<number, string>>(new Map());

    const workerHandleRef = useRef<{ terminate: () => void } | null>(null);

    // ── Logging ────────────────────────────────────────────────────────────
    const addLog = useCallback((message: string, level: string) => {
        setLogs(prev => [...prev, { message, level, timestamp: new Date() }]);
    }, []);

    const clearLogs = useCallback(() => setLogs([]), []);

    // ── SCF Calculation ────────────────────────────────────────────────────
    const runCalculation = useCallback((xyzData: string, settings: SCFSettings) => {
        setResults(null);
        setLogs([]);
        setError('');
        setIsCalculating(true);
        setPrecomputedTrajectories(new Map());

        addLog('Starting calculation via CLI...', 'info');
        addLog(`Running: ${buildSCFCommandPreview(settings)}`, 'info');

        if (settings.optimize) addLog('Optimization enabled (max 50 steps)', 'info');
        if (settings.computeFrequencies && settings.optimize) addLog('Frequency calculation enabled', 'info');

        const handle = runSCFWorker(
            { xyzData, settings },
            {
                onOutput: (text) => addLog(text, 'info'),
                onError: (text) => addLog(text, 'error'),
                onReady: () => addLog('CLI worker ready, executing command...', 'info'),
            },
            (response) => {
                if (response.code !== 0) {
                    setError(`Calculation failed with exit code ${response.code}`);
                    setIsCalculating(false);
                    workerHandleRef.current = null;
                    return;
                }

                addLog('Calculation completed, parsing results...', 'info');

                try {
                    const { result, owfData, logs: parseLogs } = parseCalculationResults(
                        response.files, response.stdout,
                    );

                    for (const pl of parseLogs) addLog(pl.message, pl.level);

                    if (owfData) setWavefunctionData(owfData);

                    setResults(result);
                    addLog(`Energy: ${result.energy.toFixed(8)} Ha (${result.energyInEV.toFixed(4)} eV)`, 'info');
                    addLog('Calculation completed successfully!', 'info');

                    // Pre-compute normal mode trajectories
                    if (result.frequencies?.normalModes && result.optimization?.finalXYZ) {
                        precomputeTrajectories(result);
                    }
                } catch (err: any) {
                    setError(`Failed to parse results: ${err.message}`);
                    addLog(`Error: ${err.message}`, 'error');
                }

                setIsCalculating(false);
                workerHandleRef.current = null;
            },
        );

        workerHandleRef.current = handle;
    }, [addLog]);

    // ── Cancel ─────────────────────────────────────────────────────────────
    const cancelCalculation = useCallback(() => {
        if (workerHandleRef.current) {
            workerHandleRef.current.terminate();
            workerHandleRef.current = null;
            addLog('Calculation cancelled by user', 'warn');
            setIsCalculating(false);
            setIsCubeComputing(false);
        }
    }, [addLog]);

    // ── Clear results ──────────────────────────────────────────────────────
    const clearResults = useCallback(() => {
        setResults(null);
        setCubeResults(new Map());
        setCubeGridInfo(null);
        setPrecomputedTrajectories(new Map());
    }, []);

    // ── Cube computation ───────────────────────────────────────────────────
    const requestCubeComputation = useCallback((
        cubeType: string,
        cubeSettings: CubeGeometrySettings,
        orbitalIndex?: number,
        gridStepsOverride?: number,
        spin?: 'alpha' | 'beta',
    ) => {
        if (!wavefunctionData) {
            setError('No wavefunction data available for cube computation.');
            return;
        }

        // Map cubeType to property/orbital
        let property = 'density';
        let orbital: string | null = null;
        const spinChannel = spin || null;

        if (cubeType === 'molecular_orbital' && orbitalIndex !== undefined) {
            property = 'density';
            orbital = (orbitalIndex + 1).toString(); // CLI uses 1-based
        } else if (cubeType === 'electron_density') {
            property = 'density';
        } else if (cubeType === 'electric_potential') {
            property = 'esp';
        }

        const gridSteps = gridStepsOverride || cubeSettings.gridSteps;

        addLog(`Requesting ${cubeType} cube via CLI...`, 'info');
        addLog(`Running: ${buildCubeCommandPreview(property, orbital, spinChannel, cubeSettings, gridSteps)}`, 'info');

        setIsCubeComputing(true);

        const handle = runCubeWorker(
            {
                owfData: wavefunctionData,
                property,
                orbital,
                spin: spinChannel,
                cubeSettings,
                gridStepsOverride,
            },
            {
                onOutput: (text) => addLog(text, 'info'),
                onError: (text) => addLog(text, 'error'),
            },
            (response) => {
                setIsCubeComputing(false);

                if (response.code !== 0 || !response.cubeData) {
                    setError(`Cube generation failed with exit code ${response.code}`);
                    addLog('Cube generation failed', 'error');
                    workerHandleRef.current = null;
                    return;
                }

                // Build cache key
                let key: string;
                if (orbitalIndex !== undefined) {
                    key = spin
                        ? `molecular_orbital_${orbitalIndex}_${spin}_${gridSteps}`
                        : `molecular_orbital_${orbitalIndex}_${gridSteps}`;
                } else {
                    key = cubeType;
                }

                setCubeResults(prev => new Map(prev.set(key, response.cubeData!)));

                if (response.gridInfo) {
                    setCubeGridInfo(response.gridInfo as GridInfo);
                    addLog(`Grid info: ${response.gridInfo.nx}x${response.gridInfo.ny}x${response.gridInfo.nz} points`, 'info');
                }

                const spinLabel = spin ? ` (${spin})` : '';
                addLog(`Cube completed: ${property}${orbital ? ` (orbital ${orbital}${spinLabel})` : ''}`, 'info');
                workerHandleRef.current = null;
            },
        );

        workerHandleRef.current = handle;
    }, [wavefunctionData, addLog]);

    // ── Normal mode trajectories ───────────────────────────────────────────
    const precomputeTrajectories = useCallback((calcResults: CalculationResult) => {
        if (!calcResults.frequencies?.normalModes || !calcResults.optimization?.finalXYZ) return;

        const finalXYZ = calcResults.optimization.finalXYZ;
        const modes = calcResults.frequencies.normalModes;
        const frequencies = calcResults.frequencies.frequencies;
        const newTrajectories = new Map<number, string>();

        const trajectories = NormalModeTrajectory.precomputeAllTrajectories(
            finalXYZ, frequencies, modes,
        );
        for (const [k, v] of trajectories) {
            newTrajectories.set(k, v);
        }

        if (newTrajectories.size > 0) {
            setPrecomputedTrajectories(newTrajectories);
            addLog(`Pre-computed ${newTrajectories.size} normal mode trajectories`, 'info');
        }
    }, [addLog]);

    // ── Restore a saved session ───────────────────────────────────────────
    const restoreSession = useCallback((savedResults: CalculationResult, savedWfnData?: Uint8Array) => {
        setResults(savedResults);
        if (savedWfnData) {
            setWavefunctionData(savedWfnData);
        }
        if (savedResults.frequencies?.normalModes && savedResults.optimization?.finalXYZ) {
            precomputeTrajectories(savedResults);
        }
        addLog('Restored previous session from local storage', 'info');
    }, [addLog, precomputeTrajectories]);

    return {
        // State
        isCalculating,
        isCubeComputing,
        isWorking: isCalculating || isCubeComputing,
        results,
        logs,
        error,
        setError,
        cubeResults,
        cubeGridInfo,
        wavefunctionData,
        precomputedTrajectories,

        // Actions
        runCalculation,
        cancelCalculation,
        clearResults,
        restoreSession,
        requestCubeComputation,
        addLog,
        clearLogs,
    };
}
