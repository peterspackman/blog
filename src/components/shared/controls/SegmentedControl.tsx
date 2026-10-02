import React from 'react';
import clsx from 'clsx';
import styles from './Controls.module.css';

export interface SegmentOption<T extends string | number> {
    value: T;
    label: React.ReactNode;
    title?: string;
    disabled?: boolean;
}

export interface SegmentedControlProps<T extends string | number> {
    value: T;
    onChange: (value: T) => void;
    options: readonly SegmentOption<T>[];
    /** Wrap into a grid with this many columns instead of one row. */
    columns?: number;
    'aria-label'?: string;
    className?: string;
}

/** One-of-N choice shown as a row (or grid) of buttons. */
export function SegmentedControl<T extends string | number>({
    value,
    onChange,
    options,
    columns,
    className,
    ...aria
}: SegmentedControlProps<T>) {
    return (
        <div
            role="radiogroup"
            aria-label={aria['aria-label']}
            className={clsx(styles.segmented, columns && styles.segmentedWrap, className)}
            style={columns ? ({ '--seg-cols': columns } as React.CSSProperties) : undefined}
        >
            {options.map((o) => (
                <button
                    key={String(o.value)}
                    type="button"
                    role="radio"
                    aria-checked={o.value === value}
                    title={o.title}
                    disabled={o.disabled}
                    className={clsx(styles.segment, o.value === value && styles.segmentActive)}
                    onClick={() => onChange(o.value)}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export default SegmentedControl;
