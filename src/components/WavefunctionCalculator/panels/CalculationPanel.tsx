import React, { useEffect } from 'react';
import { CollapsibleSection, Select, SliderWithInput, ToggleSwitch, VizButton } from '../../shared/controls';
import { VizPanel } from '../../shared/viz';
import { allowedMultiplicities, type Molecule } from '../molecule';
import { BASIS_SETS, METHODS, usesBuiltinBasis, type CalculationSettings } from '../settings';
import type { CalculationState } from '../useCalculation';
import styles from '../WavefunctionCalculator.module.css';

const MULTIPLICITY_NAMES: Record<number, string> = { 1: 'singlet', 2: 'doublet', 3: 'triplet', 4: 'quartet', 5: 'quintet', 6: 'sextet', 7: 'septet' };

interface CalculationPanelProps {
    settings: CalculationSettings;
    onChange: (settings: CalculationSettings) => void;
    molecule: Molecule | null;
    calculation: CalculationState;
    onRun: () => void;
    onCancel: () => void;
}

export function CalculationPanel({ settings, onChange, molecule, calculation, onRun, onCancel }: CalculationPanelProps) {
    const running = calculation.phase === 'running';
    const set = <K extends keyof CalculationSettings>(key: K, value: CalculationSettings[K]) => onChange({ ...settings, [key]: value });

    const electrons = molecule ? molecule.nuclearCharge - settings.charge : 0;
    const multiplicities = electrons > 0 ? allowedMultiplicities(electrons) : [];
    const openShell = settings.multiplicity > 1;
    // occ tb runs GFN2-xTB: no SCF options, no optimisation step limit.
    const tightBinding = usesBuiltinBasis(settings.method);

    // Keep the multiplicity consistent with the electron count as the charge
    // or molecule changes.
    useEffect(() => {
        if (multiplicities.length && !multiplicities.includes(settings.multiplicity)) {
            onChange({ ...settings, multiplicity: multiplicities[0] });
        }
    }, [multiplicities.join(','), settings, onChange]);

    const canRun = !!molecule && electrons > 0 && multiplicities.includes(settings.multiplicity);
    const progress = calculation.progress;

    return (
        <VizPanel title="Calculation" stack>
            <div className={styles.fieldGrid}>
                <Select label="Method" value={settings.method} onChange={(v) => set('method', v)} options={METHODS} disabled={running} />
                {usesBuiltinBasis(settings.method) ? (
                    <Select label="Basis" value="builtin" onChange={() => {}} options={[{ value: 'builtin', label: 'Built-in (minimal)' }]} disabled />
                ) : (
                    <Select label="Basis" value={settings.basis} onChange={(v) => set('basis', v)} options={BASIS_SETS} disabled={running} />
                )}
                <label className={styles.numberField}>
                    <span>Charge</span>
                    <input
                        type="number"
                        className={styles.textInput}
                        value={settings.charge}
                        min={-4}
                        max={4}
                        step={1}
                        disabled={running}
                        onChange={(e) => set('charge', Math.trunc(Number(e.target.value) || 0))}
                    />
                </label>
                <Select
                    label="Multiplicity"
                    value={String(settings.multiplicity)}
                    onChange={(v) => set('multiplicity', Number(v))}
                    options={(multiplicities.length ? multiplicities : [settings.multiplicity]).map((m) => ({
                        value: String(m),
                        label: `${m} (${MULTIPLICITY_NAMES[m] ?? 'high spin'})`,
                    }))}
                    disabled={running || !multiplicities.length}
                />
            </div>

            <ToggleSwitch
                label={openShell ? 'Unrestricted (required for open shells)' : 'Unrestricted'}
                checked={settings.unrestricted || openShell}
                onChange={(v) => set('unrestricted', v)}
                disabled={running || openShell || tightBinding}
            />
            <ToggleSwitch label="Optimise geometry" checked={settings.optimize} onChange={(v) => set('optimize', v)} disabled={running} />
            <ToggleSwitch label="Vibrational frequencies" checked={settings.frequencies} onChange={(v) => set('frequencies', v)} disabled={running} />
            {settings.frequencies && !settings.optimize && (
                <p className={styles.hint}>Frequencies are only meaningful at a stationary point: optimise first unless the geometry already is one.</p>
            )}

            <CollapsibleSection title="Convergence limits">
                <SliderWithInput
                    label="Max SCF iterations"
                    value={settings.maxScfIterations}
                    onChange={(v) => set('maxScfIterations', Math.round(v))}
                    min={20}
                    max={500}
                    step={10}
                    decimals={0}
                    disabled={running || tightBinding}
                />
                <SliderWithInput
                    label="Max optimisation steps"
                    value={settings.maxOptSteps}
                    onChange={(v) => set('maxOptSteps', Math.round(v))}
                    min={10}
                    max={500}
                    step={10}
                    decimals={0}
                    disabled={running || !settings.optimize || tightBinding}
                />
                {tightBinding && <p className={styles.hint}>GFN2-xTB uses occ's own convergence settings.</p>}
            </CollapsibleSection>

            {running ? (
                <VizButton variant="danger" block onClick={onCancel}>
                    Cancel
                </VizButton>
            ) : (
                <VizButton variant="primary" block onClick={onRun} disabled={!canRun}>
                    Run calculation
                </VizButton>
            )}

            {running && (
                <div className={styles.progress} role="status">
                    <div className={styles.progressTrack}>
                        <div
                            className={progress && progress.fraction >= 0 ? styles.progressBar : styles.progressIndeterminate}
                            style={progress && progress.fraction >= 0 ? { width: `${Math.round(progress.fraction * 100)}%` } : undefined}
                        />
                    </div>
                    <span>{progress?.message || 'Starting occ…'}</span>
                </div>
            )}
            {calculation.phase === 'failed' && <p className={styles.error}>{calculation.error}</p>}
            {calculation.phase === 'cancelled' && <p className={styles.hint}>Cancelled.</p>}
        </VizPanel>
    );
}
