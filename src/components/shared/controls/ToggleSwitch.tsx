import React from 'react';
import clsx from 'clsx';
import styles from './Controls.module.css';
import type { ControlTheme } from './SliderWithInput';

export interface ToggleSwitchProps {
    label: React.ReactNode;
    checked: boolean;
    onChange: (checked: boolean) => void;
    /** @deprecated ignored */
    theme?: ControlTheme;
    disabled?: boolean;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ label, checked, onChange, disabled = false }) => (
    <label className={clsx(styles.toggle, disabled && styles.disabled)}>
        <span>{label}</span>
        <input
            type="checkbox"
            role="switch"
            className={styles.visuallyHidden}
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
        />
        <span className={clsx(styles.switch, checked && styles.switchOn)} aria-hidden />
    </label>
);

export default ToggleSwitch;
