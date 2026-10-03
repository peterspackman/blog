import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';

/**
 * Owns one echarts instance on an always-mounted div: created on mount,
 * resized with its container, disposed on unmount.
 *
 * Pass `option` to have it applied (replacing, not merging) whenever it
 * changes; build it with echartsBase/echartsAxis from useVizTheme() so the
 * chart follows the colour mode. Leave it undefined to drive the returned
 * instance yourself.
 *
 * Imported directly (not via the shared/viz barrel) so pages without charts
 * don't bundle echarts.
 */
export function useEChart(option?: echarts.EChartsCoreOption | null) {
    const ref = useRef<HTMLDivElement>(null);
    const [chart, setChart] = useState<echarts.ECharts | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const instance = echarts.init(el);
        setChart(instance);
        const observer = new ResizeObserver(() => instance.resize());
        observer.observe(el);
        return () => {
            observer.disconnect();
            instance.dispose();
            setChart(null);
        };
    }, []);

    useEffect(() => {
        if (!chart || option === undefined) return;
        if (option) chart.setOption(option, true);
        else chart.clear();
    }, [chart, option]);

    return [ref, chart] as const;
}
