import React from 'react';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

/**
 * A running dimensionless time τ held outside React state. The page that
 * owns the clock does not re-render as it ticks; only components that read
 * it with useClockTau() do (the plot, phasors, readout).
 */
export interface AnimationClock {
    get(): number;
    subscribe(listener: () => void): () => void;
    reset(): void;
}

function createClock(): AnimationClock & { advance(dt: number): void } {
    let tau = 0;
    const listeners = new Set<() => void>();
    const emit = () => listeners.forEach((l) => l());
    return {
        get: () => tau,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        reset() {
            tau = 0;
            emit();
        },
        advance(dt) {
            tau += dt;
            emit();
        },
    };
}

/**
 * Starts a clock advancing at `rate` τ per second while `running`.
 * Frame-rate independent (the old loops added a fixed step per frame, so a
 * 120 Hz display ran twice as fast).
 */
export function useAnimationClock(running: boolean, rate: number): AnimationClock {
    const clock = useMemo(createClock, []);
    const rateRef = useRef(rate);
    rateRef.current = rate;

    useEffect(() => {
        if (!running) return;
        let raf = 0;
        let last = performance.now();
        const tick = (now: number) => {
            const dt = Math.min(0.1, (now - last) / 1000);
            last = now;
            clock.advance(dt * rateRef.current);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [running, clock]);

    return clock;
}

/** Current τ; re-renders the calling component on every tick. */
export function useClockTau(clock: AnimationClock): number {
    return useSyncExternalStore(clock.subscribe, clock.get, clock.get);
}

/**
 * Render-prop that confines per-frame re-rendering to its own subtree:
 *   <WithTau clock={clock}>{(tau) => <Plot tau={tau} />}</WithTau>
 */
export function WithTau({ clock, children }: { clock: AnimationClock; children: (tau: number) => React.ReactNode }) {
    return <>{children(useClockTau(clock))}</>;
}
