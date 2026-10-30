import React from 'react';
import { HA_TO_EV } from '@peterspackman/ce-chem/compute';
import { exportXYZ } from '@peterspackman/ce-chem/exporters';
import { VizButton } from '../../shared/controls';
import { modelLabel } from '../settings';
import { download } from '../download';
import type { CalculationResult } from '../useCalculation';
import styles from '../WavefunctionCalculator.module.css';

const fmt = (x: number | undefined | null, digits: number) => (x === undefined || x === null || !Number.isFinite(x) ? '—' : x.toFixed(digits));

export function SummaryPanel({ result }: { result: CalculationResult }) {
    const { wavefunction: wfn, settings, orbitals } = result;
    const stem = (result.structure.name || 'molecule').replace(/[^\w.-]+/g, '_');

    const tiles: { label: string; value: React.ReactNode; detail?: React.ReactNode }[] = [
        {
            label: 'Total energy',
            value: (
                <>
                    {fmt(wfn.totalEnergy, 8)} E<sub>h</sub>
                </>
            ),
            detail: `${fmt(wfn.totalEnergy * HA_TO_EV, 4)} eV`,
        },
        ...orbitals.spins.map((s) => ({
            label: orbitals.spins.length > 1 ? `${s.spin === 'alpha' ? 'α' : 'β'} HOMO / LUMO` : 'HOMO / LUMO',
            value: `${fmt(s.homoEnergyHa * HA_TO_EV, 3)} / ${fmt(s.lumoEnergyHa * HA_TO_EV, 3)} eV`,
            detail: `gap ${fmt(s.gapHa * HA_TO_EV, 3)} eV`,
        })),
        {
            label: 'Model',
            value: modelLabel(settings.method, settings.basis),
            detail: `${wfn.basisFunctions} basis functions`,
        },
        {
            label: 'Electrons',
            value: wfn.electrons,
            detail: `charge ${settings.charge}, multiplicity ${settings.multiplicity}`,
        },
        ...(result.optimization
            ? [
                  {
                      label: 'Optimisation',
                      value: result.optimization.converged ? 'Converged' : 'Not converged',
                      detail: `${result.optimization.steps} steps`,
                  },
              ]
            : []),
        { label: 'Wall time', value: `${(result.elapsedMs / 1000).toFixed(1)} s` },
    ];

    return (
        <div className={styles.inspectorBody}>
            <dl className={styles.tiles}>
                {tiles.map((t) => (
                    <div key={t.label} className={styles.tile}>
                        <dt>{t.label}</dt>
                        <dd>
                            {t.value}
                            {t.detail && <span className={styles.secondary}>{t.detail}</span>}
                        </dd>
                    </div>
                ))}
            </dl>

            <div className={styles.actions}>
                <VizButton size="sm" onClick={() => download(`${stem}.owf.json`, wfn.owfJson, 'application/json')}>
                    Wavefunction (.owf.json)
                </VizButton>
                <VizButton size="sm" onClick={() => download(`${stem}.xyz`, exportXYZ(result.structure), 'chemical/x-xyz')}>
                    {result.optimization ? 'Optimised geometry' : 'Geometry'} (.xyz)
                </VizButton>
            </div>
        </div>
    );
}
