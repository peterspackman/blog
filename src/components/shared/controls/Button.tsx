import React from 'react';
import clsx from 'clsx';
import styles from './Controls.module.css';

export interface VizButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md';
    block?: boolean;
}

export const VizButton = React.forwardRef<HTMLButtonElement, VizButtonProps>(
    ({ variant = 'secondary', size = 'md', block, className, type = 'button', ...rest }, ref) => (
        <button
            ref={ref}
            type={type}
            className={clsx(styles.button, styles[variant], size === 'sm' && styles.small, block && styles.block, className)}
            {...rest}
        />
    ),
);
VizButton.displayName = 'VizButton';

/** Equal-width row of buttons. */
export const ButtonRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className={styles.buttonRow}>{children}</div>
);
