import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Tracks an element's content-box size with a ResizeObserver.
 * Returns [ref, {width, height}]; sizes are 0 until first measured.
 * The ref is a callback ref, so it also works for elements that mount
 * later (e.g. inside a tab that isn't shown initially).
 */
export function useContainerSize<T extends HTMLElement = HTMLDivElement>() {
    const [el, setEl] = useState<T | null>(null);
    const ref = useCallback((node: T | null) => setEl(node), []);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useIsoLayoutEffect(() => {
        if (!el) {
            setSize((s) => (s.width === 0 && s.height === 0 ? s : { width: 0, height: 0 }));
            return;
        }
        const update = (w: number, h: number) =>
            setSize((s) => (s.width === w && s.height === h ? s : { width: w, height: h }));
        const r = el.getBoundingClientRect();
        update(Math.floor(el.clientWidth || r.width), Math.floor(el.clientHeight || r.height));
        const ro = new ResizeObserver(([entry]) => {
            const box = entry.contentRect;
            update(Math.floor(box.width), Math.floor(box.height));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [el]);

    return [ref, size] as const;
}

/**
 * Sizes a 2D canvas for the device pixel ratio and returns a context already
 * scaled so drawing code works in CSS pixels. Call inside your draw effect:
 *
 *   const ctx = setupHiDPICanvas(canvasRef.current, width, height);
 */
export function setupHiDPICanvas(
    canvas: HTMLCanvasElement | null,
    width: number,
    height: number,
): CanvasRenderingContext2D | null {
    if (!canvas || width <= 0 || height <= 0) return null;
    const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
    }
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
}

/** Hook form of setupHiDPICanvas that also returns a stable ref. */
export function useHiDPICanvas(width: number, height: number) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const getContext = useCallback(
        () => setupHiDPICanvas(canvasRef.current, width, height),
        [width, height],
    );
    return { canvasRef, getContext };
}

/** True when the user prefers reduced motion (SSR-safe, live-updating). */
export function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReduced(mq.matches);
        const on = (e: MediaQueryListEvent) => setReduced(e.matches);
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, []);
    return reduced;
}
