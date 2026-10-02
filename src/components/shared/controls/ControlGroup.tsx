import React from 'react';
import styles from './Controls.module.css';

/** A labelled stack of controls in a sidebar. */
export const ControlGroup: React.FC<{ label?: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode }> = ({
    label,
    hint,
    children,
}) => (
    <div className={styles.group}>
        {label && <h3 className={styles.groupLabel}>{label}</h3>}
        {children}
        {hint && <p className={styles.hint}>{hint}</p>}
    </div>
);

export const ControlHint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className={styles.hint}>{children}</p>
);
