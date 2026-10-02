import React from 'react';
import clsx from 'clsx';
import styles from './Phasor.module.css';

export interface PhasorCellProps {
    /** Accumulated phase in radians; the filled sector shows phase mod 2π. */
    phase: number;
    active: boolean;
    /** Identity colour of this state (matches its curve). */
    color: string;
    /** Text under the cell; omit when the grid has its own axis labels. */
    label?: React.ReactNode;
    /** Tooltip / accessible description. */
    title: string;
    onToggle: () => void;
    /** Show only this state: right-click, double-click or Shift+activate. */
    onSelectOnly?: () => void;
    /** CSS length, default 2.25rem. */
    size?: string;
}

/** A square whose filled sector rotates with a stationary state's phase e^{-iEt/ħ}. */
export function PhasorCell({ phase, active, color, label, title, onToggle, onSelectOnly, size }: PhasorCellProps) {
    const deg = (((phase * 180) / Math.PI) % 360 + 360) % 360;
    const background = active
        ? `conic-gradient(from -90deg, ${color} ${deg}deg, color-mix(in srgb, ${color} 14%, transparent) ${deg}deg)`
        : undefined;
    return (
        <div className={styles.item}>
            <button
                type="button"
                className={clsx(styles.cell, active && styles.cellActive)}
                style={{ background, '--phasor-color': color, '--phasor-size': size } as React.CSSProperties}
                aria-pressed={active}
                aria-label={title}
                title={title}
                onClick={(e) => (e.shiftKey && onSelectOnly ? onSelectOnly() : onToggle())}
                onDoubleClick={onSelectOnly}
                onContextMenu={(e) => {
                    if (!onSelectOnly) return;
                    e.preventDefault();
                    onSelectOnly();
                }}
            />
            {label !== undefined && <span className={clsx(styles.label, active && styles.labelActive)}>{label}</span>}
        </div>
    );
}

/** Wrapping row of phasor cells with the standard usage hint. */
export function PhasorGrid({ children, hint = true, layout }: { children: React.ReactNode; hint?: boolean; layout?: React.ReactNode }) {
    return (
        <div className={clsx(layout && styles.shell, layout && styles.shellFit)}>
            {layout ?? <div className={styles.grid}>{children}</div>}
            {hint && (
                <p className={styles.hint}>
                    Click to toggle a state; double-click, right-click or Shift-click to show only that state. The
                    filled sector is the state's phase.
                </p>
            )}
        </div>
    );
}

export interface PhasorMatrixProps {
    rows: number[];
    cols: number[];
    rowTitle: React.ReactNode;
    colTitle: React.ReactNode;
    renderCell: (row: number, col: number) => React.ReactNode;
}

/** Grid of phasor cells indexed by two quantum numbers, with axis labels. */
export function PhasorMatrix({ rows, cols, rowTitle, colTitle, renderCell }: PhasorMatrixProps) {
    return (
        <div className={styles.matrix} style={{ '--cols': cols.length } as React.CSSProperties}>
            {rows.map((r) => (
                <React.Fragment key={r}>
                    <span className={styles.axisLabel}>{r}</span>
                    {cols.map((c) => (
                        <React.Fragment key={c}>{renderCell(r, c)}</React.Fragment>
                    ))}
                </React.Fragment>
            ))}
            <span className={styles.axisTitle}>{rowTitle}</span>
            {cols.map((c) => (
                <span key={c} className={styles.axisLabel}>
                    {c}
                </span>
            ))}
            <span />
            <span className={styles.axisTitle} style={{ gridColumn: `2 / span ${cols.length}`, textAlign: 'center' }}>
                {colTitle}
            </span>
        </div>
    );
}
