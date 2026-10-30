import { useCallback, useEffect, useRef, useState } from 'react';
import { CHARGE_SCHEME_LABELS, chargeSchemesFor, isChargeScheme } from '@peterspackman/ce-chem/compute/charge-schemes.js';
import { atLeastVersion, distinctChargeSchemes, dmaCharges, POPULATION_OCC_VERSION, type ChargeSet } from './charges';
import { loadCe, runTask, TaskCancelledError } from './runtime';
import type { CalculationResult } from './useCalculation';

/** GDMA's standard switch between grid and analytical partitioning. */
const DMA_BIG_EXPONENT = 4;

export type DmaState = { status: 'unavailable'; reason: string } | { status: 'idle' } | { status: 'computing' } | { status: 'failed'; error: string } | { status: 'ready' };

/**
 * Partial-charge sets for a result, from one occ population (DMA) run when the
 * Charges tab first asks: DMA monopoles, plus every scheme occ supports for
 * the method once occjs has `--charges`. Older occjs gives DMA alone, and for
 * GFN2-xTB only the charges stored in the wavefunction (its DMA was wrong there).
 */
export function useCharges(result: CalculationResult | null, occVersion: string | undefined) {
    const population = atLeastVersion(occVersion, POPULATION_OCC_VERSION);
    const [computed, setComputed] = useState<ChargeSet[]>([]);
    const [state, setState] = useState<DmaState>({ status: 'idle' });
    const controller = useRef<AbortController | null>(null);

    useEffect(() => {
        controller.current?.abort();
        controller.current = null;
        setComputed([]);
        setState(
            result?.xtbCharges && !population
                ? { status: 'unavailable', reason: `DMA for GFN2-xTB needs occ ${POPULATION_OCC_VERSION} or later.` }
                : { status: 'idle' },
        );
    }, [result, population]);

    useEffect(() => () => controller.current?.abort(), []);

    const computeDma = useCallback(() => {
        if (!result || controller.current || (result.xtbCharges && !population)) return;
        const abort = new AbortController();
        controller.current = abort;
        setState({ status: 'computing' });
        const atomCount = result.structure.atoms.length;
        loadCe()
            .then(({ occ }) =>
                runTask(
                    occ.occDmaComputation.request({
                        label: 'Partial charges',
                        wavefunctionData: result.wavefunction.owfJson,
                        // Rank 1 also gives the atomic dipoles; a site's charge is the same at any rank.
                        maxRank: 1,
                        bigExponent: DMA_BIG_EXPONENT,
                        ...(population ? { chargeSchemes: distinctChargeSchemes(chargeSchemesFor(result.settings.method)) } : {}),
                    }),
                    { signal: abort.signal },
                ),
            )
            .then(
                (dma) => {
                    const schemes: ChargeSet[] = Object.entries(dma.charges ?? {}).flatMap(([scheme, values]) =>
                        isChargeScheme(scheme) ? [{ id: scheme, label: CHARGE_SCHEME_LABELS[scheme], values }] : [],
                    );
                    setComputed([{ id: 'dma', label: 'DMA', values: dmaCharges(dma, atomCount) }, ...schemes]);
                    setState({ status: 'ready' });
                },
                (error) => {
                    if (abort.signal.aborted || error instanceof TaskCancelledError) return;
                    controller.current = null;
                    setState({ status: 'failed', error: error instanceof Error ? error.message : String(error) });
                },
            );
    }, [result, population]);

    // The stored xTB charges show at once; a population run's own `xtb` set replaces them.
    const stored: ChargeSet[] =
        result?.xtbCharges && !computed.some((c) => c.id === 'xtb') ? [{ id: 'xtb', label: CHARGE_SCHEME_LABELS.xtb, values: result.xtbCharges }] : [];
    return { sets: [...computed, ...stored], dmaState: state, computeDma };
}
