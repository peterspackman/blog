import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { PathCursor } from './path';

/** A value derived from the cursor; re-renders the caller only when it changes. */
export function useCursorValue<T>(cursor: PathCursor, read: (x: number) => T): T {
    return useSyncExternalStore(cursor.subscribe, () => read(cursor.get()), () => read(cursor.get()));
}

/**
 * Moves the cursor towards `target` at `rate` x per second (times `speed`),
 * stopping there. A `target` of null means stopped.
 */
export function usePlayback(cursor: PathCursor, rate: number, speed: number) {
    const [target, setTarget] = useState<number | null>(null);
    const speedRef = useRef(speed);
    speedRef.current = speed;

    useEffect(() => {
        if (target === null) return;
        let raf = 0;
        let last = performance.now();
        const tick = (now: number) => {
            const dt = Math.min(0.1, (now - last) / 1000);
            last = now;
            const x = cursor.get();
            const step = rate * speedRef.current * dt;
            const next = x < target ? Math.min(target, x + step) : Math.max(target, x - step);
            cursor.set(next);
            if (next === target) setTarget(null);
            else raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, cursor, rate]);

    return { target, setTarget };
}
