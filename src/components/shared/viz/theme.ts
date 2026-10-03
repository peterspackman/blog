import { useEffect, useMemo, useState } from 'react';
import { useColorMode } from '@docusaurus/theme-common';
import type { ControlTheme } from '../controls';

/**
 * Resolved --viz-* tokens from src/css/custom.css, for code that can't use
 * CSS variables directly (canvas 2D, WebGL uniforms, echarts, NGL, three).
 * CSS-styled components should use var(--viz-*) instead.
 */
export interface VizTheme {
    isDark: boolean;
    /** Page background behind the content. */
    page: string;
    surface: string;
    surfaceSubtle: string;
    canvas: string;
    border: string;
    text: string;
    muted: string;
    grid: string;
    axis: string;
    accent: string;
    accentSoft: string;
    onAccent: string;
    /** Categorical series colours; assign in order, never cycle. */
    series: string[];
    positive: string;
    negative: string;
    success: string;
    warning: string;
    danger: string;
    fontSans: string;
    fontMono: string;
    /** Legacy shape for components that still take a `theme` prop. */
    controls: ControlTheme;
}

// Fallbacks for SSR and the first client render (mirror custom.css).
const LIGHT = {
    page: '#ffffff', surface: '#ffffff', surfaceSubtle: '#f5f7fa', canvas: '#ffffff', border: '#e1e6ee',
    text: '#1d2532', muted: '#5f6b7d', grid: '#eff0f1', axis: '#9aa3b1',
    accent: '#1f5bbf', accentSoft: '#edf2fa', onAccent: '#ffffff',
    series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
    positive: '#eb6834', negative: '#2a78d6',
    success: '#1a7f4b', warning: '#b45309', danger: '#c62f2f',
};
const DARK: typeof LIGHT = {
    page: '#1b1b1d', surface: '#222429', surfaceSubtle: '#2a2d34', canvas: '#222429', border: '#373b45',
    text: '#e5e8ee', muted: '#9aa2b1', grid: '#36383d', axis: '#6b7280',
    accent: '#7aa7ff', accentSoft: '#2e3647', onAccent: '#0f1115',
    series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
    positive: '#d95926', negative: '#3987e5',
    success: '#3fb27f', warning: '#e0a03a', danger: '#ef6b6b',
};
const FONT_SANS = "'Source Sans 3 Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const FONT_MONO = "'Source Code Pro Variable', SFMono-Regular, Menlo, Consolas, monospace";

function readTokens(isDark: boolean, fromCss: boolean): VizTheme {
    const fb = isDark ? DARK : LIGHT;
    let get = (_name: string, fallback: string) => fallback;
    // Only trust the computed CSS once the page's data-theme agrees with the
    // requested mode; during hydration Docusaurus reports the default mode
    // while the stylesheet may already be dark.
    if (fromCss && typeof document !== 'undefined' && document.documentElement.dataset.theme === (isDark ? 'dark' : 'light')) {
        const cs = getComputedStyle(document.documentElement);
        get = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
    }
    const t = {
        isDark,
        page: get('--viz-page', fb.page),
        surface: get('--viz-surface', fb.surface),
        surfaceSubtle: get('--viz-surface-subtle', fb.surfaceSubtle),
        canvas: get('--viz-canvas', fb.canvas),
        border: get('--viz-border', fb.border),
        text: get('--viz-text', fb.text),
        muted: get('--viz-muted', fb.muted),
        grid: get('--viz-grid', fb.grid),
        axis: get('--viz-axis', fb.axis),
        accent: get('--ifm-color-primary', fb.accent),
        accentSoft: get('--viz-accent-soft', fb.accentSoft),
        onAccent: get('--viz-on-accent', fb.onAccent),
        series: fb.series.map((c, i) => get(`--viz-series-${i + 1}`, c)),
        positive: get('--viz-positive', fb.positive),
        negative: get('--viz-negative', fb.negative),
        success: get('--viz-success', fb.success),
        warning: get('--viz-warning', fb.warning),
        danger: get('--viz-danger', fb.danger),
        fontSans: get('--ifm-font-family-base', FONT_SANS),
        fontMono: get('--ifm-font-family-monospace', FONT_MONO),
    };
    return {
        ...t,
        controls: {
            background: t.surfaceSubtle,
            surface: t.surface,
            border: t.border,
            text: t.text,
            textMuted: t.muted,
            accent: t.accent,
            inputBg: t.surfaceSubtle,
        },
    };
}

/**
 * Theme tokens for imperative drawing code. The returned object is stable
 * until the colour mode changes, so it is safe in effect dependency lists.
 */
export function useVizTheme(): VizTheme {
    const { colorMode } = useColorMode();
    const isDark = colorMode === 'dark';
    // Render the built-in palette until mounted so the first client render
    // matches the server HTML, then switch to the live CSS tokens.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    return useMemo(() => readTokens(isDark, mounted), [isDark, mounted]);
}

/** Canvas font shorthand using the site fonts, e.g. canvasFont(theme, 11, 'mono'). */
export function canvasFont(theme: VizTheme, sizePx: number, family: 'sans' | 'mono' = 'sans', weight = 400): string {
    return `${weight} ${sizePx}px ${family === 'mono' ? theme.fontMono : theme.fontSans}`;
}

/** Append an alpha channel to a #rrggbb colour. */
export function withAlpha(hex: string, alpha: number): string {
    const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
    return hex.length === 7 ? hex + a : hex;
}
