import React, { useRef, useState } from 'react';
import type { WulffShape2D } from './geometry';

export interface Facet2DView {
    angle: number;
    gamma: number;
    family: number;
}

const GAMMA_MAX = 2;

/** Shared frame: both panels use the same scale so γ and the shape line up. */
function frameFor(size: number) {
    const pad = 18;
    const r = size / 2 - pad;
    const scale = r / GAMMA_MAX;
    const toSvg = (x: number, y: number): [number, number] => [size / 2 + x * scale, size / 2 - y * scale];
    return { r, scale, toSvg, c: size / 2 };
}

const muted = { stroke: 'var(--viz-grid)', fill: 'none' } as const;

function PolarGrid({ size }: { size: number }) {
    const { scale, c } = frameFor(size);
    return (
        <g>
            {[0.5, 1, 1.5, 2].map((g) => (
                <circle key={g} cx={c} cy={c} r={g * scale} style={muted} />
            ))}
            {[0.5, 1, 1.5].map((g) => (
                <text
                    key={g}
                    x={c + 4}
                    y={c - g * scale - 3}
                    style={{ fill: 'var(--viz-muted)', fontSize: 10, fontFamily: 'var(--ifm-font-family-monospace)' }}
                >
                    {g}
                </text>
            ))}
            <line x1={c - 2 * scale} y1={c} x2={c + 2 * scale} y2={c} style={muted} />
            <line x1={c} y1={c - 2 * scale} x2={c} y2={c + 2 * scale} style={muted} />
        </g>
    );
}

export interface GammaPlotProps {
    size: number;
    facets: Facet2DView[];
    colors: string[];
    /** Called with the facet index and its new γ while dragging. */
    onChange: (index: number, gamma: number) => void;
    /** Draw γ(θ) as a continuous curve (smooth model) instead of draggable points. */
    curve?: boolean;
    /** In curve mode, the family index of the curved (non-cusp) directions. */
    curvedFamily?: number;
}

/** Polar plot of γ(θ) at the facet normals; drag a point to change its energy. */
export function GammaPlot({ size, facets, colors, onChange, curve, curvedFamily = 1 }: GammaPlotProps) {
    const { scale, toSvg, c } = frameFor(size);
    const svgRef = useRef<SVGSVGElement>(null);
    const [dragging, setDragging] = useState<number | null>(null);

    const gammaFromPointer = (e: React.PointerEvent, i: number) => {
        const rect = svgRef.current!.getBoundingClientRect();
        const x = ((e.clientX - rect.left) * (size / rect.width) - c) / scale;
        const y = -((e.clientY - rect.top) * (size / rect.height) - c) / scale;
        const a = (facets[i].angle * Math.PI) / 180;
        // Project onto the facet normal so the point slides along its spoke.
        return Math.min(GAMMA_MAX, Math.max(0.2, x * Math.cos(a) + y * Math.sin(a)));
    };

    const pts = facets.map((f) => {
        const a = (f.angle * Math.PI) / 180;
        return toSvg(f.gamma * Math.cos(a), f.gamma * Math.sin(a));
    });

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${size} ${size}`}
            width={size}
            height={size}
            role="img"
            aria-label="Surface energy polar plot; drag points to change surface energies"
            style={{ display: 'block', touchAction: 'none', userSelect: 'none' }}
            onPointerMove={(e) => dragging !== null && onChange(dragging, gammaFromPointer(e, dragging))}
            onPointerUp={() => setDragging(null)}
            onPointerLeave={() => setDragging(null)}
        >
            <PolarGrid size={size} />
            {curve ? (
                <>
                    <polygon
                        points={pts.map((p) => p.join(',')).join(' ')}
                        style={{ fill: 'var(--viz-accent-soft)', stroke: colors[curvedFamily], strokeWidth: 2 }}
                    />
                    {facets.map((f, i) =>
                        f.family !== curvedFamily ? (
                            <g key={`c${i}`}>
                                <line x1={c} y1={c} x2={pts[i][0]} y2={pts[i][1]} style={{ stroke: colors[f.family], strokeWidth: 1.5 }} />
                                <circle cx={pts[i][0]} cy={pts[i][1]} r={4} style={{ fill: colors[f.family] }} />
                            </g>
                        ) : null,
                    )}
                </>
            ) : (
                <>
                    {facets.map((f, i) => (
                        <line key={`s${i}`} x1={c} y1={c} x2={pts[i][0]} y2={pts[i][1]} style={{ stroke: colors[f.family], strokeWidth: 1.5, opacity: 0.6 }} />
                    ))}
                    {facets.map((f, i) => (
                        <circle
                            key={`h${i}`}
                            cx={pts[i][0]}
                            cy={pts[i][1]}
                            r={dragging === i ? 8 : 6.5}
                            style={{ fill: colors[f.family], stroke: 'var(--viz-surface)', strokeWidth: 2, cursor: 'grab' }}
                            onPointerDown={(e) => {
                                (e.target as Element).setPointerCapture?.(e.pointerId);
                                setDragging(i);
                            }}
                        >
                            <title>{`θ = ${f.angle.toFixed(1)}°, γ = ${f.gamma.toFixed(2)}`}</title>
                        </circle>
                    ))}
                </>
            )}
        </svg>
    );
}

export interface ShapePlotProps {
    size: number;
    facets: Facet2DView[];
    shape: WulffShape2D;
    colors: string[];
    showConstruction: boolean;
}

/** The equilibrium shape: intersection of the half-planes n·x ≤ γ. */
export function ShapePlot({ size, facets, shape, colors, showConstruction }: ShapePlotProps) {
    const { scale, toSvg, c } = frameFor(size);
    const L = GAMMA_MAX * 1.5;
    return (
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Equilibrium crystal shape" style={{ display: 'block' }}>
            <defs>
                <clipPath id="wulff-frame">
                    <rect x={0} y={0} width={size} height={size} />
                </clipPath>
            </defs>
            <PolarGrid size={size} />
            {showConstruction && (
                <g clipPath="url(#wulff-frame)">
                    {facets.map((f, i) => {
                        const a = (f.angle * Math.PI) / 180;
                        const [nx, ny] = [Math.cos(a), Math.sin(a)];
                        // Foot of the perpendicular, then the line through it.
                        const [fx, fy] = [f.gamma * nx, f.gamma * ny];
                        const p1 = toSvg(fx - ny * L, fy + nx * L);
                        const p2 = toSvg(fx + ny * L, fy - nx * L);
                        const foot = toSvg(fx, fy);
                        return (
                            <g key={i} style={{ opacity: 0.55 }}>
                                <line x1={c} y1={c} x2={foot[0]} y2={foot[1]} style={{ stroke: colors[f.family], strokeWidth: 1 }} />
                                <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} style={{ stroke: colors[f.family], strokeWidth: 1, strokeDasharray: '4 4' }} />
                            </g>
                        );
                    })}
                </g>
            )}
            <polygon
                points={shape.vertices.map(([x, y]) => toSvg(x, y).join(',')).join(' ')}
                style={{ fill: 'var(--viz-accent-soft)', stroke: 'none' }}
            />
            {shape.vertices.map(([x, y], i) => {
                const [x2, y2] = shape.vertices[(i + 1) % shape.vertices.length];
                const fam = shape.edgeFacet[i] >= 0 ? facets[shape.edgeFacet[i]].family : -1;
                const a = toSvg(x, y);
                const b = toSvg(x2, y2);
                return (
                    <line
                        key={i}
                        x1={a[0]}
                        y1={a[1]}
                        x2={b[0]}
                        y2={b[1]}
                        style={{ stroke: fam >= 0 ? colors[fam] : 'var(--viz-text)', strokeWidth: facets.length > 24 ? 2.5 : 3, strokeLinecap: 'round' }}
                    />
                );
            })}
            <circle cx={c} cy={c} r={2.5} style={{ fill: 'var(--viz-text)' }} />
        </svg>
    );
}
