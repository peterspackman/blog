import React, { useId } from 'react';
import styles from './Controls.module.css';

export interface SelectProps<T extends string> {
    label?: React.ReactNode;
    value: T;
    onChange: (value: T) => void;
    options: readonly { value: T; label: React.ReactNode; disabled?: boolean }[];
    disabled?: boolean;
    'aria-label'?: string;
}

export function Select<T extends string>({ label, value, onChange, options, disabled, ...aria }: SelectProps<T>) {
    const id = useId();
    const select = (
        <select
            id={id}
            className={styles.select}
            value={value}
            disabled={disabled}
            aria-label={aria['aria-label']}
            onChange={(e) => onChange(e.target.value as T)}
        >
            {options.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                    {o.label}
                </option>
            ))}
        </select>
    );
    if (!label) return select;
    return (
        <div className={styles.selectField}>
            <label htmlFor={id}>{label}</label>
            {select}
        </div>
    );
}

export default Select;
