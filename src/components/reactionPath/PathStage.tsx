import clsx from 'clsx';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { VizPanelSection } from '../shared/viz';
import { VizButton } from '../shared/controls';
import styles from './ReactionPath.module.css';

export interface PathStageProps {
    /** The structure view(s); told when they fill the screen so they can size their viewports. */
    children: (full: boolean) => React.ReactNode;
    /** A line about the current stop, under the viewers (beside the buttons in full screen). */
    caption?: React.ReactNode;
    profile: React.ReactNode;
    /** Playback buttons for the full-screen bar, where the sidebar isn't. */
    controls: React.ReactNode;
}

/**
 * The structure view(s) over the energy profile, with a full-screen mode in
 * which the structures fill the screen above a floating dock: playback
 * buttons, the caption and the profile as the controller. The same elements
 * stay mounted either way, so the viewers keep their cameras.
 *
 * Without the Fullscreen API (iPhone Safari) it still covers the window.
 */
export function PathStage({ children, caption, profile, controls }: PathStageProps) {
    const ref = useRef<HTMLDivElement>(null);
    const dockRef = useRef<HTMLDivElement>(null);
    const [full, setFull] = useState(false);
    // The dock's height, so full-screen viewports can end above it (--stage-dock).
    const [dock, setDock] = useState(0);

    const enter = () => {
        setFull(true);
        ref.current?.requestFullscreen?.().catch(() => {});
    };
    const exit = useCallback(() => {
        setFull(false);
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }, []);

    useEffect(() => {
        if (!full) return;
        // Esc leaves real full screen by itself; this catches that and the window-filling fallback.
        const onChange = () => {
            if (!document.fullscreenElement) setFull(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') exit();
        };
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('fullscreenchange', onChange);
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = overflow;
            document.removeEventListener('fullscreenchange', onChange);
            window.removeEventListener('keydown', onKey);
        };
    }, [full, exit]);

    useEffect(() => {
        const el = dockRef.current;
        if (!full || !el) return;
        const observer = new ResizeObserver(() => setDock(el.offsetHeight));
        observer.observe(el);
        return () => observer.disconnect();
    }, [full]);

    return (
        <div ref={ref} className={clsx(styles.stage, full && styles.full)} style={full ? ({ '--stage-dock': `${dock}px` } as React.CSSProperties) : undefined}>
            <div className={styles.stageViewers}>
                {children(full)}
                {!full && (
                    <button type="button" className={styles.expand} onClick={enter} aria-label="Full screen" title="Full screen">
                        <svg viewBox="0 0 16 16" aria-hidden>
                            <path d="M1.5 5.5v-4h4M10.5 1.5h4v4M14.5 10.5v4h-4M5.5 14.5h-4v-4" />
                        </svg>
                    </button>
                )}
            </div>
            <div ref={dockRef} className={styles.stageDock}>
                {full ? (
                    <VizPanelSection className={styles.stageBar}>
                        <span className={styles.stageButtons}>{controls}</span>
                        {caption && <span className={styles.stageCaption}>{caption}</span>}
                        <VizButton onClick={exit} aria-label="Exit full screen">
                            ✕
                        </VizButton>
                    </VizPanelSection>
                ) : (
                    caption && <VizPanelSection className={styles.stageCaption}>{caption}</VizPanelSection>
                )}
                <VizPanelSection className={styles.stageProfile}>{profile}</VizPanelSection>
            </div>
        </div>
    );
}
