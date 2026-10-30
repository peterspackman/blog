import React from 'react';
import clsx from 'clsx';
import type { VibMode } from '@peterspackman/ce-chem/compute';
import { SliderWithInput, ToggleSwitch, VizButton } from '../../shared/controls';
import styles from '../WavefunctionCalculator.module.css';

export interface ModePlayback {
    mode: VibMode | null;
    playing: boolean;
    amplitude: number;
    showVectors: boolean;
}

interface VibrationsPanelProps {
    modes: VibMode[] | undefined;
    /** Frequencies without displacements, for runs (GFN2-xTB via occ tb) that only report these. */
    frequenciesCm: number[] | undefined;
    playback: ModePlayback;
    onPlayback: (playback: ModePlayback) => void;
}

export function VibrationsPanel({ modes, frequenciesCm, playback, onPlayback }: VibrationsPanelProps) {
    if (!modes && frequenciesCm) return <FrequencyList frequencies={frequenciesCm} />;
    if (!modes) {
        return <p className={styles.hint}>Turn on “Vibrational frequencies” and run again to see normal modes.</p>;
    }
    if (modes.length === 0) return <p className={styles.hint}>occ returned no vibrational modes.</p>;

    const imaginary = modes.filter((m) => m.imaginary).length;
    const set = (patch: Partial<ModePlayback>) => onPlayback({ ...playback, ...patch });

    return (
        <div className={styles.inspectorBody}>
            {imaginary > 0 && (
                <p className={styles.warning}>
                    {imaginary} imaginary {imaginary === 1 ? 'mode' : 'modes'}: this geometry is not a minimum.
                </p>
            )}
            <ul className={styles.modeList}>
                {modes.map((m) => {
                    const active = playback.mode === m;
                    return (
                        <li key={m.index}>
                            <button
                                type="button"
                                className={clsx(styles.modeRow, active && styles.orbitalRowSelected)}
                                aria-pressed={active}
                                onClick={() => set(active ? { mode: null, playing: false } : { mode: m, playing: true })}
                            >
                                <span className={styles.modeIndex}>{m.index + 1}</span>
                                <span className={clsx(styles.modeFrequency, m.imaginary && styles.imaginary)}>{formatFrequency(m.frequencyCm)}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
            <VizButton size="sm" onClick={() => set({ playing: !playback.playing })} disabled={!playback.mode}>
                {playback.playing ? 'Pause' : 'Play'}
            </VizButton>
            <SliderWithInput label="Amplitude" value={playback.amplitude} onChange={(v) => set({ amplitude: v })} min={0.05} max={1} step={0.05} unit=" Å" />
            <ToggleSwitch label="Displacement arrows" checked={playback.showVectors} onChange={(v) => set({ showVectors: v })} />
        </div>
    );
}

const formatFrequency = (cm: number) => `${Math.abs(cm).toFixed(1)}${cm < 0 ? 'i' : ''} cm⁻¹`;

/** Frequencies with nothing to animate: occ reported the values but not the modes. */
function FrequencyList({ frequencies }: { frequencies: number[] }) {
    const imaginary = frequencies.filter((f) => f < 0).length;
    return (
        <div className={styles.inspectorBody}>
            {imaginary > 0 && (
                <p className={styles.warning}>
                    {imaginary} imaginary {imaginary === 1 ? 'mode' : 'modes'}: this geometry is not a minimum.
                </p>
            )}
            <ul className={styles.modeList}>
                {frequencies.map((f, i) => (
                    <li key={i} className={styles.modeRow}>
                        <span className={styles.modeIndex}>{i + 1}</span>
                        <span className={clsx(styles.modeFrequency, f < 0 && styles.imaginary)}>{formatFrequency(f)}</span>
                    </li>
                ))}
            </ul>
            <p className={styles.hint}>This occ build reports GFN2-xTB frequencies but not their normal modes, so they can't be animated yet.</p>
        </div>
    );
}
