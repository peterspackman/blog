import React from 'react';
import clsx from 'clsx';
import styles from './Controls.module.css';

export interface LegendEntry {
    key: string;
    label: React.ReactNode;
    color: string;
    shape?: 'dot' | 'line' | 'dashed';
    /** When set, the entry becomes a toggle button. */
    active?: boolean;
}

export interface LegendProps {
    items: LegendEntry[];
    onToggle?: (key: string) => void;
    className?: string;
}

/** Series key. Text stays in text colours; the swatch carries identity. */
export function Legend({ items, onToggle, className }: LegendProps) {
    return (
        <div className={clsx(styles.legend, className)}>
            {items.map((it) => {
                const swatch = (
                    <span
                        aria-hidden
                        className={clsx(
                            styles.swatch,
                            it.shape && it.shape !== 'dot' && styles.swatchLine,
                            it.shape === 'dashed' && styles.swatchDashed,
                        )}
                        style={it.shape === 'dashed' ? { color: it.color } : { background: it.color }}
                    />
                );
                const off = it.active === false;
                return onToggle ? (
                    <button
                        key={it.key}
                        type="button"
                        aria-pressed={!off}
                        className={clsx(styles.legendItem, off && styles.legendItemOff)}
                        onClick={() => onToggle(it.key)}
                    >
                        {swatch}
                        {it.label}
                    </button>
                ) : (
                    <span key={it.key} className={styles.legendItem}>
                        {swatch}
                        {it.label}
                    </span>
                );
            })}
        </div>
    );
}

export default Legend;
