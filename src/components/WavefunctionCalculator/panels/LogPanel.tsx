import React, { useEffect, useRef } from 'react';
import { VizButton } from '../../shared/controls';
import { download } from '../download';
import styles from '../WavefunctionCalculator.module.css';

/** occ's output, following the end while it streams unless scrolled up. */
export function LogPanel({ log, name }: { log: string; name?: string }) {
    const ref = useRef<HTMLPreElement>(null);
    const pinned = useRef(true);

    useEffect(() => {
        const el = ref.current;
        if (el && pinned.current) el.scrollTop = el.scrollHeight;
    }, [log]);

    if (!log) return <p className={styles.hint}>occ's output appears here when a calculation runs.</p>;
    return (
        <div className={styles.inspectorBody}>
            <pre
                ref={ref}
                className={styles.log}
                onScroll={(e) => {
                    const el = e.currentTarget;
                    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
                }}
            >
                {log}
            </pre>
            <div className={styles.actions}>
                <VizButton size="sm" onClick={() => download(`${(name || 'occ').replace(/[^\w.-]+/g, '_')}.log`, log, 'text/plain')}>
                    Download log
                </VizButton>
            </div>
        </div>
    );
}
