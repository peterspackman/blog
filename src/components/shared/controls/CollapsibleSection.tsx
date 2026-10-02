import React, { useId, useState } from 'react';
import clsx from 'clsx';
import styles from './Controls.module.css';
import type { ControlTheme } from './SliderWithInput';

export interface CollapsibleSectionProps {
    title: React.ReactNode;
    children: React.ReactNode;
    defaultExpanded?: boolean;
    /** @deprecated ignored */
    theme?: ControlTheme;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, children, defaultExpanded = false }) => {
    const [open, setOpen] = useState(defaultExpanded);
    const id = useId();
    return (
        <div className={styles.collapsible}>
            <button
                type="button"
                className={styles.collapsibleHeader}
                aria-expanded={open}
                aria-controls={id}
                onClick={() => setOpen((o) => !o)}
            >
                <span>{title}</span>
                <span className={clsx(styles.chevron, open && styles.chevronOpen)} aria-hidden />
            </button>
            <div id={id} className={clsx(styles.collapsibleBody, open && styles.collapsibleBodyOpen)}>
                <div className={styles.collapsibleInner} inert={!open || undefined}>
                    <div className={styles.collapsibleContent}>{children}</div>
                </div>
            </div>
        </div>
    );
};

export default CollapsibleSection;
