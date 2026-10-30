import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { OrbitalRow, SpinOrbitalTable } from '@peterspackman/ce-chem/compute';
import { SegmentedControl, SliderWithInput } from '../../shared/controls';
import type { GridQuality } from '../cubeBox';
import { layoutLevels } from '../levelLayout';
import { rgbToCss, type LobeColors } from '../orbitalColors';
import type { DisplaySettings } from '../settings';
import type { CalculationResult } from '../useCalculation';
import type { OrbitalRef, VolumeEntry } from '../useOrbitalVolumes';
import styles from '../WavefunctionCalculator.module.css';

/** Orbitals listed either side of the frontier before "show all". */
const FRONTIER_WINDOW = 5;

/** Each orbital row's height in px; the diagram's connectors land on row centres. */
const ROW_HEIGHT = 28;
const DIAGRAM_WIDTH = 64;
const LEVEL_X0 = 4;
const LEVEL_X1 = 30;
const LEVEL_PAD = 8;

interface OrbitalsPanelProps {
    result: CalculationResult;
    isSelected: (o: OrbitalRef) => boolean;
    entryFor: (o: OrbitalRef) => VolumeEntry | undefined;
    colorsFor: (o: OrbitalRef) => LobeColors | undefined;
    onToggle: (o: OrbitalRef) => void;
    onClear: () => void;
    display: DisplaySettings;
    onDisplay: (display: DisplaySettings) => void;
}

function visibleRows(table: SpinOrbitalTable, showAll: boolean): OrbitalRow[] {
    if (showAll) return table.rows;
    const centre = table.homo >= 0 ? table.homo : 0;
    return table.rows.filter((r) => r.index >= centre - FRONTIER_WINDOW + 1 && r.index <= centre + FRONTIER_WINDOW);
}

export function OrbitalsPanel(props: OrbitalsPanelProps) {
    const { result, isSelected, entryFor, colorsFor, onToggle, onClear, display, onDisplay } = props;
    const spins = result.orbitals.spins;
    const [spinIndex, setSpinIndex] = useState(0);
    const [showAll, setShowAll] = useState(false);
    const [hovered, setHovered] = useState<number | null>(null);
    const table = spins[Math.min(spinIndex, spins.length - 1)];
    const rows = useMemo(() => (table ? visibleRows(table, showAll) : []), [table, showAll]);
    if (!table) return <p className={styles.hint}>This wavefunction has no orbitals to show.</p>;

    // Highest energy at the top, as in an energy-level diagram. Each level is
    // joined to its row, so the list stays evenly spaced while the diagram
    // keeps the real spacing.
    const ordered = [...rows].reverse();
    const height = ordered.length * ROW_HEIGHT;
    const layout = layoutLevels(
        ordered.map((r) => r.energyEv),
        LEVEL_PAD,
        height - LEVEL_PAD,
    );
    const set = <K extends keyof DisplaySettings>(key: K, value: DisplaySettings[K]) => onDisplay({ ...display, [key]: value });

    return (
        <div className={styles.inspectorBody}>
            {spins.length > 1 && (
                <SegmentedControl<number>
                    value={spinIndex}
                    onChange={setSpinIndex}
                    options={spins.map((s, i) => ({ value: i, label: s.spin === 'alpha' ? 'α spin' : s.spin === 'beta' ? 'β spin' : s.spin }))}
                    aria-label="Spin"
                />
            )}

            <div className={styles.orbitalLayout} onMouseLeave={() => setHovered(null)}>
                <svg className={styles.ladder} width={DIAGRAM_WIDTH} height={height} aria-hidden>
                    {layout.breaks.map((y) => (
                        <g key={y} className={styles.levelBreak}>
                            <line x1={LEVEL_X0 - 2} x2={LEVEL_X0 + 6} y1={y - 3} y2={y + 1} />
                            <line x1={LEVEL_X0 - 2} x2={LEVEL_X0 + 6} y1={y + 1} y2={y + 5} />
                        </g>
                    ))}
                    {ordered.map((r, i) => {
                        const ref = { spin: table.spin, index: r.index };
                        const colors = colorsFor(ref);
                        const { index, of } = layout.slot[i];
                        const width = (LEVEL_X1 - LEVEL_X0 - (of - 1) * 2) / of;
                        const x0 = LEVEL_X0 + index * (width + 2);
                        const y = layout.y[i];
                        const active = hovered === r.index || !!colors;
                        const stroke = colors ? rgbToCss(colors.positive) : undefined;
                        return (
                            <g key={r.index} className={clsx(r.occupied ? styles.levelOccupied : styles.level, active && styles.levelActive)}>
                                <path
                                    className={styles.connector}
                                    d={`M ${x0 + width} ${y} C ${DIAGRAM_WIDTH - 14} ${y}, ${LEVEL_X1 + 8} ${(i + 0.5) * ROW_HEIGHT}, ${DIAGRAM_WIDTH} ${(i + 0.5) * ROW_HEIGHT}`}
                                    style={stroke ? { stroke } : undefined}
                                />
                                <line x1={x0} x2={x0 + width} y1={y} y2={y} style={stroke ? { stroke } : undefined} />
                            </g>
                        );
                    })}
                </svg>

                <ul className={styles.orbitalList}>
                    {ordered.map((r) => {
                        const ref = { spin: table.spin, index: r.index };
                        const selected = isSelected(ref);
                        const entry = selected ? entryFor(ref) : undefined;
                        const colors = colorsFor(ref);
                        return (
                            <li key={r.index} onMouseEnter={() => setHovered(r.index)}>
                                <button
                                    type="button"
                                    className={clsx(styles.orbitalRow, selected && styles.orbitalRowSelected)}
                                    aria-pressed={selected}
                                    onClick={() => onToggle(ref)}
                                    onFocus={() => setHovered(r.index)}
                                    title={entry?.status === 'failed' ? entry.error : entry?.status === 'loading' ? 'Computing the grid…' : undefined}
                                >
                                    <span className={styles.swatch} aria-hidden>
                                        {colors && (
                                            <>
                                                <span style={{ background: rgbToCss(colors.positive) }} />
                                                <span style={{ background: rgbToCss(colors.negative) }} />
                                            </>
                                        )}
                                    </span>
                                    <span className={clsx(styles.orbitalLabel, r.label.startsWith('HOMO') || r.label.startsWith('LUMO') ? styles.frontier : undefined)}>
                                        {r.label || `#${r.index + 1}`}
                                    </span>
                                    <span className={styles.orbitalEnergy}>{r.energyEv.toFixed(2)} eV</span>
                                    <span className={styles.orbitalOcc}>
                                        {entry?.status === 'loading' ? '…' : entry?.status === 'failed' ? '!' : r.occupation.toFixed(r.occupation % 1 ? 1 : 0)}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>

            <div className={styles.rowActions}>
                <button type="button" className={styles.linkButton} onClick={() => setShowAll((v) => !v)}>
                    {showAll ? 'Frontier orbitals only' : `Show all ${table.rows.length}`}
                </button>
                <button type="button" className={styles.linkButton} onClick={onClear}>
                    Hide all surfaces
                </button>
            </div>

            <SliderWithInput label="Isovalue" value={display.isovalue} onChange={(v) => set('isovalue', v)} min={0.005} max={0.15} step={0.005} decimals={3} />
            <SliderWithInput label="Opacity" value={display.opacity} onChange={(v) => set('opacity', v)} min={0.1} max={1} step={0.05} />
            <SegmentedControl
                value={display.surfaceStyle}
                onChange={(v) => set('surfaceStyle', v)}
                options={[
                    { value: 'solid', label: 'Solid' },
                    { value: 'wireframe', label: 'Mesh' },
                ]}
                aria-label="Surface style"
            />
            <SegmentedControl<GridQuality>
                value={display.gridQuality}
                onChange={(v) => set('gridQuality', v)}
                options={[
                    { value: 'coarse', label: 'Coarse', title: '0.3 Å grid' },
                    { value: 'medium', label: 'Medium', title: '0.2 Å grid' },
                    { value: 'fine', label: 'Fine', title: '0.12 Å grid' },
                ]}
                aria-label="Grid quality"
            />
            <p className={styles.hint}>Click orbitals to show their ±isosurfaces. Each one is a separate occ grid evaluation.</p>
        </div>
    );
}
