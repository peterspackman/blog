import React, { useEffect } from 'react';
import clsx from 'clsx';
import type { AtomData } from '@peterspackman/ce-chem/data';
import { SegmentedControl, ToggleSwitch, VizButton } from '../../shared/controls';
import { formatCharge, symmetricLimit, type ChargeSet } from '../charges';
import { useCe } from '../runtime';
import type { DmaState } from '../useCharges';
import styles from '../WavefunctionCalculator.module.css';

export interface ChargeView {
    scheme: ChargeSet['id'] | null;
    labels: boolean;
    colour: boolean;
}

/** Diverging map shared with ESP: red for negative, blue for positive. */
export const CHARGE_COLORMAP = 'RedWhiteBlue';

interface ChargesPanelProps {
    atoms: AtomData[];
    sets: ChargeSet[];
    dmaState: DmaState;
    onComputeDma: () => void;
    view: ChargeView;
    onView: (view: ChargeView) => void;
}

export function ChargesPanel({ atoms, sets, dmaState, onComputeDma, view, onView }: ChargesPanelProps) {
    const ce = useCe();
    // DMA is quick for the molecules this page handles: start it when the tab opens.
    useEffect(() => {
        if (dmaState.status === 'idle') onComputeDma();
    }, [dmaState.status, onComputeDma]);

    const shown = sets.find((s) => s.id === view.scheme) ?? sets[0];
    // Pick up the first scheme to arrive; colouring the atoms stays the user's choice.
    useEffect(() => {
        if (!view.scheme && sets[0]) onView({ ...view, scheme: sets[0].id });
    }, [view, sets, onView]);

    const limit = shown ? symmetricLimit(shown.values) : 1;
    const set = (patch: Partial<ChargeView>) => onView({ ...view, ...patch });

    return (
        <div className={styles.inspectorBody}>
            {sets.length > 1 && (
                <SegmentedControl<ChargeSet['id']>
                    value={shown?.id ?? sets[0].id}
                    onChange={(scheme) => set({ scheme })}
                    options={sets.map((s) => ({ value: s.id, label: s.label }))}
                    aria-label="Charge scheme"
                />
            )}
            {dmaState.status === 'computing' && <p className={styles.hint}>Computing charges…</p>}
            {dmaState.status === 'unavailable' && <p className={styles.hint}>{dmaState.reason}</p>}
            {dmaState.status === 'failed' && (
                <p className={styles.error}>
                    DMA failed: {dmaState.error}{' '}
                    <VizButton size="sm" variant="ghost" onClick={onComputeDma}>
                        Retry
                    </VizButton>
                </p>
            )}

            {shown && (
                <>
                    <ToggleSwitch label="Label atoms with charges" checked={view.labels} onChange={(labels) => set({ labels })} />
                    <ToggleSwitch label="Colour atoms by charge" checked={view.colour} onChange={(colour) => set({ colour })} />
                    {view.colour && ce && (
                        <div className={styles.legend}>
                            <div className={styles.legendBar} style={{ background: ce.viewer.colormapCssGradient(CHARGE_COLORMAP) }} />
                            <div className={styles.legendLabels}>
                                <span>{formatCharge(-limit)} e</span>
                                <span>0</span>
                                <span>{formatCharge(limit)} e</span>
                            </div>
                        </div>
                    )}

                    <table className={styles.chargeTable}>
                        <thead>
                            <tr>
                                <th scope="col">Atom</th>
                                {sets.map((s) => (
                                    <th key={s.id} scope="col" className={clsx(s.id === shown.id && styles.chargeShown)}>
                                        {s.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {atoms.map((a, i) => (
                                <tr key={i}>
                                    <th scope="row">
                                        {a.element}
                                        <span className={styles.secondaryInline}>{i + 1}</span>
                                    </th>
                                    {sets.map((s) => (
                                        <td key={s.id}>{formatCharge(s.values[i], 3)}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <th scope="row">Total</th>
                                {sets.map((s) => (
                                    <td key={s.id}>{formatCharge(s.values.reduce((t, q) => t + q, 0), 3)}</td>
                                ))}
                            </tr>
                        </tfoot>
                    </table>
                    <p className={styles.hint}>
                        {sets.some((s) => s.id === 'dma') &&
                            "DMA charges are the monopoles of a distributed multipole analysis of the wavefunction. They look smaller than, say, Mulliken charges because DMA carries much of each atom's polarity in its atomic dipole instead. "}
                        {sets.some((s) => s.id === 'xtb') && 'GFN2-xTB charges come from its self-consistent charge model. '}
                        {sets.length > 2 && 'Schemes differ by design: compare trends between atoms rather than absolute values.'}
                    </p>
                </>
            )}
        </div>
    );
}
