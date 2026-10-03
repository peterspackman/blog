import type { VizTheme } from './theme';

/**
 * Base echarts option built from the site tokens. Merge it under a chart's
 * own option (echarts renders to canvas, so CSS variables such as
 * var(--ifm-…) can't be used in options; take colours from here instead).
 *
 *   chart.setOption({ ...echartsBase(theme), xAxis: { ...echartsAxis(theme), … }, … })
 */
export function echartsBase(theme: VizTheme) {
    return {
        backgroundColor: 'transparent',
        color: theme.series,
        textStyle: { fontFamily: theme.fontSans, color: theme.text },
        title: { textStyle: { color: theme.text, fontFamily: theme.fontSans, fontWeight: 600, fontSize: 13 } },
        tooltip: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            textStyle: { color: theme.text, fontFamily: theme.fontSans, fontSize: 12 },
            extraCssText: 'box-shadow: var(--viz-shadow); border-radius: 6px;',
        },
    };
}

/**
 * Legend styling. Not part of echartsBase: an echarts `legend` key renders a
 * legend for every named series, so charts opt in explicitly.
 */
export function echartsLegend(theme: VizTheme) {
    return { textStyle: { color: theme.muted, fontFamily: theme.fontSans }, inactiveColor: theme.border };
}

/** Axis styling for value/category axes. */
export function echartsAxis(theme: VizTheme) {
    return {
        axisLine: { lineStyle: { color: theme.axis } },
        axisTick: { lineStyle: { color: theme.axis } },
        axisLabel: { color: theme.muted, fontFamily: theme.fontMono, fontSize: 11 },
        nameTextStyle: { color: theme.muted, fontFamily: theme.fontSans, fontSize: 12 },
        splitLine: { lineStyle: { color: theme.grid } },
    };
}

/** Sequential colour ramp for heatmaps/visualMap (light → accent). */
export function echartsSequential(theme: VizTheme): string[] {
    return [theme.surfaceSubtle, theme.series[0]];
}
