import React from 'react';
import clsx from 'clsx';
import Layout from '@theme/Layout';
import styles from './Viz.module.css';

export interface VizPageProps {
    /** Page <title> and visible heading. */
    title: string;
    /** Meta description. */
    description?: string;
    /** Visible heading if different from the document title. */
    heading?: React.ReactNode;
    /** One or two sentences under the heading. */
    intro?: React.ReactNode;
    /** Buttons on the right of the header (e.g. fullscreen). */
    actions?: React.ReactNode;
    /** The visualisation renders the <h1> itself (see VizPlotHeader). */
    titleInPlot?: boolean;
    children: React.ReactNode;
}

/** Standard shell for an interactive visualisation page. */
export function VizPage({ title, description, heading, intro, actions, titleInPlot, children }: VizPageProps) {
    return (
        <Layout title={title} description={description}>
            <main className={clsx(styles.page, titleInPlot && styles.pageBare)}>
                {!titleInPlot && (
                    <header className={styles.header}>
                        <div>
                            <h1 className={styles.title}>{heading ?? title}</h1>
                            {intro && <p className={styles.intro}>{intro}</p>}
                        </div>
                        {actions && <div className={styles.headerActions}>{actions}</div>}
                    </header>
                )}
                {children}
            </main>
        </Layout>
    );
}

export interface VizWorkbenchProps {
    /** Controls column. Sticky on desktop; below the visualisation on mobile. */
    sidebar: React.ReactNode;
    sidebarSide?: 'right' | 'left';
    className?: string;
    children: React.ReactNode;
}

/** Visualisation area plus a controls sidebar. */
export function VizWorkbench({ sidebar, sidebarSide = 'right', className, children }: VizWorkbenchProps) {
    const main = <div className={styles.main}>{children}</div>;
    const side = <aside className={styles.sidebar} aria-label="Controls">{sidebar}</aside>;
    return (
        <div className={clsx(styles.workbench, sidebarSide === 'left' && styles.workbenchLeft, className)}>
            {sidebarSide === 'left' ? <>{side}{main}</> : <>{main}{side}</>}
        </div>
    );
}

export interface VizPanelProps {
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    actions?: React.ReactNode;
    /** Remove body padding (for edge-to-edge canvases). */
    flush?: boolean;
    /** Space children as a vertical stack (for control sidebars). */
    stack?: boolean;
    className?: string;
    bodyClassName?: string;
    style?: React.CSSProperties;
    children: React.ReactNode;
}

/** A bordered card with an optional header row. */
export function VizPanel({ title, subtitle, actions, flush, stack, className, bodyClassName, style, children }: VizPanelProps) {
    return (
        <section className={clsx(styles.panel, className)} style={style}>
            {(title || actions) && (
                <div className={styles.panelHeader}>
                    <h2 className={styles.panelTitle}>
                        {title}
                        {subtitle && <span className={styles.panelSubtitle}>{subtitle}</span>}
                    </h2>
                    {actions && <div className={styles.panelActions}>{actions}</div>}
                </div>
            )}
            <div className={clsx(flush ? styles.panelBodyFlush : styles.panelBody, stack && styles.panelStack, bodyClassName)}>{children}</div>
        </section>
    );
}

export interface VizStageProps extends React.HTMLAttributes<HTMLDivElement> {
    /** CSS aspect-ratio, e.g. "16 / 10" or 1. Omit to size by height. */
    aspect?: string | number;
}

/** Background frame for a canvas/SVG drawing, sized by aspect ratio. */
export const VizStage = React.forwardRef<HTMLDivElement, VizStageProps>(
    ({ aspect, className, style, ...rest }, ref) => (
        <div
            ref={ref}
            className={clsx(styles.stage, className)}
            style={{ aspectRatio: aspect !== undefined ? String(aspect) : undefined, ...style }}
            {...rest}
        />
    ),
);
VizStage.displayName = 'VizStage';

/**
 * Long-form explanation below a visualisation, using docs typography.
 * With `aside`, notes and tables sit beside the prose on wide screens.
 */
export function VizExplanation({ aside, children }: { aside?: React.ReactNode; children: React.ReactNode }) {
    if (!aside) return <section className={clsx('markdown', styles.explanation)}>{children}</section>;
    return (
        // 'markdown' goes on the columns, not the grid: Infima gives .markdown a
        // ::before clearfix that would otherwise occupy the first grid cell.
        <section className={clsx(styles.explanation, styles.explanationSplit)}>
            <div className={clsx('markdown', styles.prose)}>{children}</div>
            <aside className={clsx('markdown', styles.aside)}>{aside}</aside>
        </section>
    );
}

/** Panels side by side, wrapping on narrow screens. The first one grows. */
export function VizRow({ children }: { children: React.ReactNode }) {
    return <div className={styles.row}>{children}</div>;
}

/** A section inside a flush VizPanel; consecutive sections get a divider. */
export const VizPanelSection = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...rest }, ref) => <div ref={ref} className={clsx(styles.panelSection, className)} {...rest} />,
);
VizPanelSection.displayName = 'VizPanelSection';

/** Readout pinned to the top-right of a position:relative plot container. */
export function VizCornerLabel({ children }: { children: React.ReactNode }) {
    return <span className={styles.cornerLabel}>{children}</span>;
}

/** Page title and a live readout as the first row of a plot card. */
export function VizPlotHeader({ title, readout }: { title: React.ReactNode; readout?: React.ReactNode }) {
    return (
        <div className={styles.plotHeader}>
            <h1 className={styles.plotTitle}>{title}</h1>
            {readout && <span className={styles.plotReadout}>{readout}</span>}
        </div>
    );
}

/** Two VizPanelSections side by side in a flush VizPanel; stacks when narrow. */
export function VizPanelSplit({ children }: { children: React.ReactNode }) {
    return (
        <div className={styles.splitWrap}>
            <div className={styles.split}>{children}</div>
        </div>
    );
}

export interface VizCanvasFitProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Intrinsic drawing size; the frame keeps this aspect ratio. */
    width: number;
    height: number;
    /** Vertical space (px) to leave for surrounding UI when capping height to the viewport. */
    reserve?: number;
}

/**
 * Scales a fixed-size drawing to the available width, and caps it so the
 * whole thing fits in the viewport height. Children (a canvas) should fill
 * it with width/height 100%.
 */
export function VizCanvasFit({ width, height, reserve = 240, style, ...rest }: VizCanvasFitProps) {
    const aspect = width / height;
    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                maxWidth: `max(16rem, calc((100vh - ${reserve}px) * ${aspect.toFixed(4)}))`,
                aspectRatio: `${width} / ${height}`,
                margin: '0 auto',
                ...style,
            }}
            {...rest}
        />
    );
}
