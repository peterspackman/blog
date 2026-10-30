import React from 'react';
import styles from '../WavefunctionCalculator.module.css';

export interface TabOption<T extends string> {
    value: T;
    label: string;
    disabled?: boolean;
}

/** The first enabled tab if `value` is disabled or missing, so a panel never shows an empty tab. */
export function activeTab<T extends string>(value: T, tabs: readonly TabOption<T>[]): T | undefined {
    return tabs.some((t) => t.value === value && !t.disabled) ? value : tabs.find((t) => !t.disabled)?.value;
}

export function TabBar<T extends string>({ value, tabs, onChange, label }: { value: T | undefined; tabs: readonly TabOption<T>[]; onChange: (v: T) => void; label: string }) {
    return (
        <div className={styles.tabs} role="tablist" aria-label={label}>
            {tabs.map((t) => (
                <button
                    key={t.value}
                    type="button"
                    role="tab"
                    aria-selected={value === t.value}
                    className={styles.tab}
                    disabled={t.disabled}
                    onClick={() => onChange(t.value)}
                >
                    {t.label}
                </button>
            ))}
        </div>
    );
}
