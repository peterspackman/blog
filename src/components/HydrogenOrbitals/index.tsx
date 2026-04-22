import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useColorMode } from '@docusaurus/theme-common';
import BrowserOnly from '@docusaurus/BrowserOnly';
import MathFormula from '../MathFormula';
import type { BasisMode, DisplayMode, RenderMode, Term } from './types';
import { BOUNDING_RADIUS } from './shaders';
import {
    hydrogenEnergy,
    isoForProbability,
    nodeCount,
    radialR,
    sampleFieldOnGrid,
    type EstTerm,
    type SampleSpec,
} from './physics';
import { cartesianMonomials, cartesianNorm } from './codegen';
import RadialPlot from './RadialPlot';

type SliceAxis = 0 | 1 | 2;

interface Theme {
    surface: string;
    border: string;
    text: string;
    textMuted: string;
    accent: string;
    inputBg: string;
}

function useTheme(isDark: boolean): Theme {
    return {
        surface: isDark ? '#1b1b1f' : '#ffffff',
        border: isDark ? '#333' : '#e0e0e0',
        text: isDark ? '#e0e0e0' : '#222',
        textMuted: isDark ? '#999' : '#666',
        accent: isDark ? '#6b9eff' : '#2563eb',
        inputBg: isDark ? '#2a2a30' : '#f3f4f6',
    };
}

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>) {
    const [width, setWidth] = useState(800);
    useLayoutEffect(() => {
        const update = () => {
            if (ref.current) setWidth(Math.max(320, Math.floor(ref.current.getBoundingClientRect().width)));
        };
        update();
        const ro = new ResizeObserver(update);
        if (ref.current) ro.observe(ref.current);
        return () => ro.disconnect();
    }, [ref]);
    return width;
}

// Chemistry names for the angular harmonic Y_{l,m}.
function ylmLatex(l: number, m: number): string {
    if (l === 0) return 'Y_{0,0}';
    if (l === 1) {
        if (m === 0) return 'Y_{1,0}\\;(p_z)';
        if (m === +1) return 'Y_{1,1}\\;(p_x)';
        if (m === -1) return 'Y_{1,-1}\\;(p_y)';
    }
    if (l === 2) {
        if (m === 0) return 'Y_{2,0}\\;(d_{z^2})';
        if (m === +1) return 'Y_{2,1}\\;(d_{xz})';
        if (m === -1) return 'Y_{2,-1}\\;(d_{yz})';
        if (m === +2) return 'Y_{2,2}\\;(d_{x^2-y^2})';
        if (m === -2) return 'Y_{2,-2}\\;(d_{xy})';
    }
    if (l === 3) {
        if (m === 0) return 'Y_{3,0}\\;(f_{z^3})';
        if (m === +1) return 'Y_{3,1}\\;(f_{xz^2})';
        if (m === -1) return 'Y_{3,-1}\\;(f_{yz^2})';
        if (m === +2) return 'Y_{3,2}\\;(f_{z(x^2-y^2)})';
        if (m === -2) return 'Y_{3,-2}\\;(f_{xyz})';
        if (m === +3) return 'Y_{3,3}\\;(f_{x(x^2-3y^2)})';
        if (m === -3) return 'Y_{3,-3}\\;(f_{y(3x^2-y^2)})';
    }
    return `Y_{${l},${m}}`;
}

function shellLabel(n: number, l: number): string {
    const shell = ['s', 'p', 'd', 'f', 'g'][l] ?? `l=${l}`;
    return `${n}${shell}`;
}

function cartesianLatex(a: number, b: number, c: number): string {
    const part = (letter: string, n: number) => {
        if (n === 0) return '';
        if (n === 1) return letter;
        return `${letter}^{${n}}`;
    };
    const body = part('x', a) + part('y', b) + part('z', c);
    return body || '1';
}

function headlineLatex(
    mode: DisplayMode,
    basis: BasisMode,
    n: number,
    l: number,
    m: number,
    cart: [number, number, number],
): string {
    if (mode === 'radial') return `R_{${n},${l}}(r)`;
    const angular =
        basis === 'cartesian'
            ? cartesianLatex(cart[0], cart[1], cart[2])
            : ylmLatex(l, m);
    if (mode === 'angular') return angular;
    // full ψ: pair with R_{n, l_equiv} where l_equiv = l (spherical) or a+b+c (cartesian).
    const lEq = basis === 'cartesian' ? cart[0] + cart[1] + cart[2] : l;
    return `R_{${n},${lEq}}(r)\\cdot ${angular}`;
}

/** Suggested bounding radius (Bohr) for rendering the current mode. */
function boundingRadiusFor(mode: DisplayMode, n: number): number {
    if (mode === 'angular') return BOUNDING_RADIUS; // 6
    // Radial and full ψ grow with n: peak of r²|R|² is ~n² a₀.
    // Include some buffer so the outer shell is fully inside.
    return Math.round(3 * n * n + 4);
}

const HydrogenOrbitalsInner: React.FC = () => {
    const { colorMode } = useColorMode();
    const isDark = colorMode === 'dark';
    const theme = useTheme(isDark);

    const [displayMode, setDisplayMode] = useState<DisplayMode>('angular');
    const [basisMode, setBasisMode] = useState<BasisMode>('spherical');
    const [n, setN] = useState(2);
    const [l, setL] = useState(1);
    const [m, setM] = useState(0);
    // Cartesian exponents (a, b, c) with a+b+c = l. Default to x² for l=2 — the
    // classic "contaminated" case where raw ≠ spherical.
    const [cartesian, setCartesian] = useState<[number, number, number]>([1, 0, 0]);
    const [primaryCoeff, setPrimaryCoeff] = useState(1);
    // Additional terms in a linear combination (primary is term 0, derived
    // from the sliders above). Stays empty in single-orbital mode.
    const [extraTerms, setExtraTerms] = useState<Term[]>([]);
    const [isoValue, setIsoValue] = useState(0.05);
    // Iso slider can represent either a probability fraction (default, 10–99%)
    // or a raw amplitude (advanced). Probability-enclosing iso is the chemistry
    // standard: pick an iso such that ∫|ψ|² over the enclosed region = fraction.
    const [isoMode, setIsoMode] = useState<'probability' | 'amplitude'>('probability');
    const [isoProbFraction, setIsoProbFraction] = useState(0.9);
    const [renderMode, setRenderMode] = useState<RenderMode>('isosurface');
    const [sliceAxis, setSliceAxis] = useState<SliceAxis>(2);
    const [slicePosition, setSlicePosition] = useState(0);
    const [clipEnabled, setClipEnabled] = useState(false);
    const [envelopeScale, setEnvelopeScale] = useState(2.0);
    const [colorPositive, setColorPositive] = useState('#ed8936');
    const [colorNegative, setColorNegative] = useState('#3b82f6');
    const [showAxes, setShowAxes] = useState(false);

    // Quantum-number constraint enforcement: l ≤ n-1, |m| ≤ l.
    useEffect(() => {
        if (displayMode !== 'angular' && l >= n) setL(Math.max(0, n - 1));
    }, [n, l, displayMode]);
    useEffect(() => {
        if (Math.abs(m) > l) setM(0);
    }, [l, m]);

    // Radial mode is a single s-shell (Y_{0,0}); basis doesn't apply there.
    // Otherwise basis is independent of display mode and persists freely.

    // Keep the cartesian exponents consistent with l (a + b + c = l).
    useEffect(() => {
        const sum = cartesian[0] + cartesian[1] + cartesian[2];
        if (sum !== l) {
            // Default monomial for each l: l=0 → 1, l=1 → z, l=2 → x², l=3 → z³, l=4 → z⁴.
            const defaults: Array<[number, number, number]> = [
                [0, 0, 0],
                [0, 0, 1],
                [2, 0, 0],
                [0, 0, 3],
                [0, 0, 4],
            ];
            setCartesian(defaults[l] ?? [l, 0, 0]);
        }
    }, [l, cartesian]);

    // Iso value auto-tune: different modes have very different amplitude scales.
    // Use a dedicated iso per mode so switching doesn't leave a blank screen.
    const [isoByMode, setIsoByMode] = useState<Record<DisplayMode, number>>({
        angular: 0.05,
        radial: 0.05,
        full: 0.02,
    });
    useEffect(() => {
        setIsoValue(isoByMode[displayMode]);
    }, [displayMode, isoByMode]);
    const updateIso = (v: number) => {
        setIsoValue(v);
        setIsoByMode((prev) => ({ ...prev, [displayMode]: v }));
    };

    // Build the unified term list: primary term (from sliders) + extras.
    const primaryTerm: Term = useMemo(
        () =>
            basisMode === 'cartesian'
                ? {
                      kind: 'cartesian',
                      n,
                      a: cartesian[0],
                      b: cartesian[1],
                      c: cartesian[2],
                      coeff: primaryCoeff,
                  }
                : { kind: 'spherical', n, l, m, coeff: primaryCoeff },
        [basisMode, n, l, m, cartesian, primaryCoeff],
    );
    const terms: Term[] = useMemo(
        () => [primaryTerm, ...extraTerms],
        [primaryTerm, extraTerms],
    );

    // l used for radial-mode rendering (single-term).
    const radL = basisMode === 'spherical' ? l : cartesian[0] + cartesian[1] + cartesian[2];

    const boundingRadius = useMemo(() => {
        // Bounding radius needs to fit the largest-n term we're rendering.
        const maxN = Math.max(...terms.map((t) => t.n), 1);
        return boundingRadiusFor(displayMode, maxN);
    }, [displayMode, terms]);

    // ---- Term-list editing helpers ----
    const applyTerms = (newTerms: Term[], forceDisplay?: DisplayMode) => {
        const first = newTerms[0];
        if (!first) return;
        if (first.kind === 'cartesian') {
            setBasisMode('cartesian');
            setN(first.n);
            setCartesian([first.a, first.b, first.c]);
        } else {
            setBasisMode('spherical');
            setN(first.n);
            setL(first.l);
            setM(first.m);
        }
        setPrimaryCoeff(first.coeff);
        setExtraTerms(newTerms.slice(1));
        if (forceDisplay) setDisplayMode(forceDisplay);
    };
    /** Add a term that matches the primary's basis, so the "+" stays
     *  contextual (you get an l,m term if you're in spherical, a Cartesian
     *  monomial if you're in Cartesian). Individual terms can be flipped
     *  afterward via the basis toggle inside the card. */
    const addTerm = () => {
        if (terms.length >= 8) return;
        const newTerm: Term =
            basisMode === 'cartesian'
                ? { kind: 'cartesian', n, a: 1, b: 0, c: 0, coeff: 0.5 }
                : { kind: 'spherical', n, l: 1, m: 0, coeff: 0.5 };
        setExtraTerms((prev) => [...prev, newTerm]);
    };

    /** Flip a term between spherical and cartesian in place, preserving n
     *  and total degree where possible. */
    const flipTermKind = (idx: number) => {
        setExtraTerms((prev) => {
            const copy = [...prev];
            const t = copy[idx];
            if (t.kind === 'spherical') {
                const deg = t.l;
                const defaults: Array<[number, number, number]> = [
                    [0, 0, 0], [0, 0, 1], [2, 0, 0], [0, 0, 3], [0, 0, 4],
                ];
                const [a, b, c] = defaults[deg] ?? [deg, 0, 0];
                copy[idx] = { kind: 'cartesian', n: t.n, a, b, c, coeff: t.coeff };
            } else {
                copy[idx] = {
                    kind: 'spherical',
                    n: t.n,
                    l: t.a + t.b + t.c,
                    m: 0,
                    coeff: t.coeff,
                };
            }
            return copy;
        });
    };
    const removeExtraTerm = (idx: number) => {
        setExtraTerms((prev) => prev.filter((_, i) => i !== idx));
    };
    const updateExtraTerm = (idx: number, patch: Partial<Term>) => {
        setExtraTerms((prev) => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...patch } as Term;
            return copy;
        });
    };
    const clearExtras = () => setExtraTerms([]);
    const normalizeCoeffs = () => {
        const all = [primaryCoeff, ...extraTerms.map((t) => t.coeff)];
        const sumSq = all.reduce((s, c) => s + c * c, 0);
        const f = 1 / Math.sqrt(Math.max(sumSq, 1e-12));
        setPrimaryCoeff(primaryCoeff * f);
        setExtraTerms(extraTerms.map((t) => ({ ...t, coeff: t.coeff * f })));
    };

    // ---- Preset hybrids ----
    // Hybrid presets are switched to angular (Y) view because the textbook
    // "directional lobe" picture lives there — in full ψ mode the 2s radial
    // node at r=2 creates an inner/outer sign-flip that makes sp/sp² look
    // cluttered, nothing like the intended teardrop.
    const LC_PRESETS: Array<{
        id: string;
        label: string;
        terms: Term[];
        mode?: DisplayMode;
    }> = [
        {
            id: 'single',
            label: 'Single',
            terms: [{ kind: 'spherical', n: 2, l: 1, m: 0, coeff: 1 }],
        },
        {
            id: 'sp',
            label: 'sp',
            mode: 'angular',
            terms: [
                { kind: 'spherical', n: 2, l: 0, m: 0, coeff: 1 / Math.SQRT2 },
                { kind: 'spherical', n: 2, l: 1, m: 0, coeff: 1 / Math.SQRT2 },
            ],
        },
        {
            id: 'sp2',
            label: 'sp²',
            mode: 'angular',
            terms: [
                { kind: 'spherical', n: 2, l: 0, m: 0, coeff: 1 / Math.sqrt(3) },
                { kind: 'spherical', n: 2, l: 1, m: +1, coeff: Math.sqrt(2 / 3) },
            ],
        },
        {
            id: 'sp3',
            label: 'sp³',
            mode: 'angular',
            terms: [
                { kind: 'spherical', n: 2, l: 0, m: 0, coeff: 0.5 },
                { kind: 'spherical', n: 2, l: 1, m: +1, coeff: 0.5 },
                { kind: 'spherical', n: 2, l: 1, m: -1, coeff: 0.5 },
                { kind: 'spherical', n: 2, l: 1, m: 0, coeff: 0.5 },
            ],
        },
        {
            id: 'cart_sp',
            label: 'sp (cart.)',
            mode: 'angular',
            terms: [
                { kind: 'cartesian', n: 2, a: 0, b: 0, c: 0, coeff: 1 / Math.SQRT2 },
                { kind: 'cartesian', n: 2, a: 0, b: 0, c: 1, coeff: 1 / Math.SQRT2 },
            ],
        },
        {
            id: 'cart_sp3',
            label: 'sp³ (cart.)',
            mode: 'angular',
            terms: [
                { kind: 'cartesian', n: 2, a: 0, b: 0, c: 0, coeff: 0.5 },
                { kind: 'cartesian', n: 2, a: 1, b: 0, c: 0, coeff: 0.5 },
                { kind: 'cartesian', n: 2, a: 0, b: 1, c: 0, coeff: 0.5 },
                { kind: 'cartesian', n: 2, a: 0, b: 0, c: 1, coeff: 0.5 },
            ],
        },
        {
            id: 'px_from_complex',
            label: 'p_x = ½(Y₁⁻¹−Y₁⁺¹)',
            mode: 'angular',
            terms: [
                { kind: 'spherical', n: 2, l: 1, m: -1, coeff: 1 / Math.SQRT2 },
                { kind: 'spherical', n: 2, l: 1, m: +1, coeff: -1 / Math.SQRT2 },
            ],
        },
    ];

    // Single grid sample drives both normScale (for slice/density) and the
    // probability-enclosing iso value. Sampling is ~5ms for 20³.
    const fieldSample = useMemo(() => {
        const estTerms: EstTerm[] = terms.map((t) =>
            t.kind === 'spherical'
                ? { kind: 'spherical', n: t.n, l: t.l, m: t.m, coeff: t.coeff }
                : {
                      kind: 'cartesian',
                      n: t.n,
                      a: t.a,
                      b: t.b,
                      c: t.c,
                      coeff: t.coeff,
                      norm: cartesianNorm(t.a, t.b, t.c),
                  },
        );
        const spec: SampleSpec =
            displayMode === 'radial'
                ? { mode: 'radial', n, l: radL }
                : displayMode === 'angular'
                    ? { mode: 'angular', terms: estTerms, envelopeScale }
                    : { mode: 'full', terms: estTerms };
        return sampleFieldOnGrid(spec, boundingRadius);
    }, [displayMode, n, radL, terms, boundingRadius, envelopeScale]);

    const normScale = 1 / Math.max(fieldSample.maxAbs, 1e-8);

    // Probability-enclosing iso: the amplitude at which ∫|ψ|² over {|ψ|>iso}
    // equals `isoProbFraction` × total mass on the sampled grid.
    const probIso = useMemo(
        () => isoForProbability(fieldSample.values, isoProbFraction),
        [fieldSample, isoProbFraction],
    );

    // Effective iso fed to the shader.
    const effectiveIso = isoMode === 'probability' ? probIso : isoValue;

    const containerRef = useRef<HTMLDivElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const containerWidth = useContainerWidth(containerRef);
    const isNarrow = containerWidth < 780;
    const canvasWidth = isNarrow
        ? containerWidth
        : Math.max(380, Math.floor(containerWidth * 0.58));
    const canvasHeight = Math.max(360, Math.floor(canvasWidth * 0.8));
    const panelWidth = isNarrow ? containerWidth : Math.max(300, containerWidth - canvasWidth - 16);

    // Lazy-load Scene only in the browser so SSR doesn't choke on R3F.
    const [Scene, setScene] = useState<React.ComponentType<any> | null>(null);
    useEffect(() => {
        import('./Scene').then((mod) => setScene(() => mod.default));
    }, []);

    const sliderStyle = {
        width: '100%',
        accentColor: theme.accent,
    } as const;

    const buttonRow = (
        options: { value: string; label: string }[],
        current: string,
        onSelect: (v: string) => void,
    ) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {options.map((opt) => (
                <button
                    key={opt.value}
                    onClick={() => onSelect(opt.value)}
                    style={{
                        flex: 1,
                        minWidth: 60,
                        padding: '6px 10px',
                        borderRadius: 4,
                        border: `1px solid ${theme.border}`,
                        background: current === opt.value ? theme.accent : theme.inputBg,
                        color: current === opt.value ? '#fff' : theme.text,
                        cursor: 'pointer',
                        fontSize: 13,
                    }}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );

    /** Compact toggle row for small integer ranges (n, l, m sliders).
     *  Shows an explicit + sign on positives only when the range contains
     *  negatives (so m goes -1 0 +1 but n goes 1 2 3 4). */
    const numberRow = (
        min: number,
        max: number,
        current: number,
        onSelect: (v: number) => void,
    ) => {
        const values: number[] = [];
        for (let v = min; v <= max; v++) values.push(v);
        const signed = min < 0;
        return (
            <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {values.map((v) => {
                    const selected = v === current;
                    const label = signed && v > 0 ? `+${v}` : String(v);
                    return (
                        <button
                            key={v}
                            onClick={() => onSelect(v)}
                            style={{
                                flex: '1 1 32px',
                                minWidth: 32,
                                padding: '4px 6px',
                                borderRadius: 3,
                                border: `1px solid ${theme.border}`,
                                background: selected ? theme.accent : theme.inputBg,
                                color: selected ? '#fff' : theme.text,
                                cursor: 'pointer',
                                fontSize: 12,
                                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                            }}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
        );
    };

    const { radial: rNodes, angular: aNodes } = nodeCount(n, l);
    const energy = hydrogenEnergy(n, 1);

    const showN = displayMode !== 'angular';
    const showM = displayMode !== 'radial';

    return (
        <div
            ref={containerRef}
            style={{
                color: theme.text,
                padding: '0 12px',
                maxWidth: 1200,
                margin: '0 auto',
            }}
        >
            {/* Headline: live factorisation */}
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <MathFormula
                    math={headlineLatex(displayMode, basisMode, n, l, m, cartesian)}
                    inline={false}
                />
                <div style={{ color: theme.textMuted, fontSize: 13, marginTop: 4 }}>
                    {displayMode === 'angular' && basisMode === 'spherical' && (
                        <>
                            Angular part · <em>l</em> = {l}, <em>m</em> = {m > 0 ? `+${m}` : m} ·
                            universal for any central potential
                        </>
                    )}
                    {displayMode === 'angular' && basisMode === 'cartesian' && (
                        <>
                            Raw Cartesian monomial · degree {l} · {(l + 1) * (l + 2) / 2} functions
                            {l >= 2 ? ` at this degree (overcomplete vs ${2 * l + 1} spherical)` : ''}
                        </>
                    )}
                    {displayMode === 'radial' && (
                        <>
                            Radial part · {shellLabel(n, l)} · {rNodes} radial node
                            {rNodes === 1 ? '' : 's'} · E = {energy.toFixed(2)} eV
                        </>
                    )}
                    {displayMode === 'full' && basisMode === 'spherical' && (
                        <>
                            Hydrogen orbital {shellLabel(n, l)}
                            {m !== 0 ? ` (m = ${m > 0 ? `+${m}` : m})` : ''} · {rNodes} radial +
                            {' '}{aNodes} angular node{rNodes + aNodes === 1 ? '' : 's'} · E ={' '}
                            {energy.toFixed(2)} eV
                        </>
                    )}
                    {displayMode === 'full' && basisMode === 'cartesian' && (
                        <>
                            R_{`{${n},${cartesian[0] + cartesian[1] + cartesian[2]}}`}(r) · (Cartesian monomial) · E ={' '}
                            {energy.toFixed(2)} eV — Cartesian basis functions are a common
                            primitive form (e.g. GTOs) but not eigenfunctions of L̂².
                        </>
                    )}
                </div>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: isNarrow ? '1fr' : `${canvasWidth}px 1fr`,
                    gap: 16,
                    alignItems: 'start',
                }}
            >
                <div
                    ref={canvasContainerRef}
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                    {Scene ? (
                        <Scene
                            width={canvasWidth}
                            height={canvasHeight}
                            isDark={isDark}
                            terms={terms}
                            radN={n}
                            radL={radL}
                            isoValue={effectiveIso}
                            renderMode={renderMode}
                            displayMode={displayMode}
                            sliceAxis={sliceAxis}
                            slicePosition={slicePosition}
                            clipEnabled={clipEnabled}
                            envelopeScale={envelopeScale}
                            colorPositive={colorPositive}
                            colorNegative={colorNegative}
                            background={isDark ? '#0e0e12' : '#fafbfc'}
                            boundingRadius={boundingRadius}
                            normScale={normScale}
                            showAxes={showAxes}
                        />
                    ) : (
                        <div
                            style={{
                                width: canvasWidth,
                                height: canvasHeight,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: theme.surface,
                                border: `1px solid ${theme.border}`,
                                borderRadius: 8,
                                color: theme.textMuted,
                            }}
                        >
                            Loading…
                        </div>
                    )}
                    {showN && (
                        <div
                            style={{
                                background: theme.surface,
                                border: `1px solid ${theme.border}`,
                                borderRadius: 8,
                                padding: 8,
                            }}
                        >
                            <RadialPlot
                                n={n}
                                l={radL}
                                rMax={boundingRadius}
                                width={canvasWidth - 18}
                                height={130}
                                isDark={isDark}
                                colorR={theme.accent}
                                colorProb={colorPositive}
                            />
                        </div>
                    )}
                </div>

                <div
                    style={{
                        background: theme.surface,
                        border: `1px solid ${theme.border}`,
                        borderRadius: 8,
                        padding: 14,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14,
                    }}
                >
                    {/* Display mode: the separation-of-variables selector */}
                    <section>
                        <label style={{ fontSize: 13, color: theme.textMuted, display: 'block', marginBottom: 6 }}>
                            ψ(r,θ,φ) = R(r) · Y(θ,φ) — what to show
                        </label>
                        {buttonRow(
                            [
                                { value: 'angular', label: 'Y(θ,φ)' },
                                { value: 'radial', label: 'R(r)' },
                                { value: 'full', label: 'ψ = R·Y' },
                            ],
                            displayMode,
                            (v) => setDisplayMode(v as DisplayMode),
                        )}
                    </section>

                    {/* Primary-term section header */}
                    <div
                        style={{
                            fontSize: 12,
                            color: theme.textMuted,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                            marginTop: -2,
                        }}
                    >
                        Term #1 {extraTerms.length > 0 ? '(primary)' : ''}
                    </div>

                    {/* Quantum numbers — button toggles since ranges are small. */}
                    {showN && (
                        <section>
                            <label style={{ fontSize: 12, color: theme.textMuted, display: 'block', marginBottom: 4 }}>
                                <b style={{ color: theme.text }}>n</b> (principal)
                            </label>
                            {numberRow(1, 4, n, setN)}
                        </section>
                    )}

                    <section>
                        <label style={{ fontSize: 12, color: theme.textMuted, display: 'block', marginBottom: 4 }}>
                            <b style={{ color: theme.text }}>l</b> (azimuthal)
                        </label>
                        {numberRow(0, showN ? n - 1 : 4, l, setL)}
                    </section>

                    {/* Angular basis selector — meaningful for angular & full modes.
                        Radial mode has no angular factor (s-shell only). */}
                    {displayMode !== 'radial' && (
                        <section>
                            <label style={{ fontSize: 13, color: theme.textMuted, display: 'block', marginBottom: 6 }}>
                                Angular basis
                            </label>
                            {buttonRow(
                                [
                                    { value: 'spherical', label: 'Spherical Y_{l,m}' },
                                    { value: 'cartesian', label: 'Cartesian x^a y^b z^c' },
                                ],
                                basisMode,
                                (v) => setBasisMode(v as BasisMode),
                            )}
                        </section>
                    )}

                    {/* m toggles for spherical; monomial picker for cartesian */}
                    {showM && basisMode === 'spherical' && (
                        <section>
                            <label style={{ fontSize: 12, color: theme.textMuted, display: 'block', marginBottom: 4 }}>
                                <b style={{ color: theme.text }}>m</b> (magnetic)
                            </label>
                            {numberRow(-l, l, m, setM)}
                        </section>
                    )}

                    {basisMode === 'cartesian' && displayMode !== 'radial' && (
                        <section>
                            <label style={{ fontSize: 13, color: theme.textMuted, display: 'block', marginBottom: 6 }}>
                                Monomial ({(l + 1) * (l + 2) / 2} at l = {l})
                            </label>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(58px, 1fr))',
                                    gap: 4,
                                }}
                            >
                                {cartesianMonomials(l).map((mono) => {
                                    const selected =
                                        mono.a === cartesian[0] &&
                                        mono.b === cartesian[1] &&
                                        mono.c === cartesian[2];
                                    return (
                                        <button
                                            key={`${mono.a}-${mono.b}-${mono.c}`}
                                            onClick={() =>
                                                setCartesian([mono.a, mono.b, mono.c])
                                            }
                                            style={{
                                                padding: '6px 8px',
                                                borderRadius: 4,
                                                border: `1px solid ${theme.border}`,
                                                background: selected ? theme.accent : theme.inputBg,
                                                color: selected ? '#fff' : theme.text,
                                                cursor: 'pointer',
                                                fontSize: 13,
                                                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                                            }}
                                        >
                                            {mono.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* Render mode */}
                    <section>
                        <label style={{ fontSize: 13, color: theme.textMuted, display: 'block', marginBottom: 6 }}>
                            Render mode
                        </label>
                        {buttonRow(
                            [
                                { value: 'isosurface', label: 'Isosurface' },
                                { value: 'density', label: 'Density' },
                                { value: 'slice', label: 'Slice' },
                            ],
                            renderMode,
                            (v) => setRenderMode(v as RenderMode),
                        )}
                    </section>

                    {(renderMode === 'isosurface' || renderMode === 'density') && (
                        <section>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: 4,
                                }}
                            >
                                <label style={{ fontSize: 13, color: theme.textMuted }}>
                                    {isoMode === 'probability'
                                        ? `Isosurface encloses ${Math.round(
                                              isoProbFraction * 100,
                                          )}% of probability`
                                        : `Iso amplitude = ${isoValue.toFixed(4)}`}
                                </label>
                                <button
                                    onClick={() =>
                                        setIsoMode((m) =>
                                            m === 'probability' ? 'amplitude' : 'probability',
                                        )
                                    }
                                    style={{
                                        fontSize: 11,
                                        padding: '2px 8px',
                                        border: `1px solid ${theme.border}`,
                                        background: theme.inputBg,
                                        color: theme.text,
                                        borderRadius: 3,
                                        cursor: 'pointer',
                                    }}
                                    title="Toggle between probability-enclosing and raw-amplitude iso"
                                >
                                    {isoMode === 'probability' ? '→ amplitude' : '→ %'}
                                </button>
                            </div>
                            {isoMode === 'probability' ? (
                                <input
                                    type="range"
                                    min={0.1}
                                    max={0.99}
                                    step={0.01}
                                    value={isoProbFraction}
                                    onChange={(e) =>
                                        setIsoProbFraction(parseFloat(e.target.value))
                                    }
                                    style={sliderStyle}
                                />
                            ) : (
                                <input
                                    type="range"
                                    min={0.0005}
                                    max={Math.max(0.3, fieldSample.maxAbs * 0.9)}
                                    step={0.0005}
                                    value={isoValue}
                                    onChange={(e) => updateIso(parseFloat(e.target.value))}
                                    style={sliderStyle}
                                />
                            )}
                            {isoMode === 'probability' && (
                                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                                    ⇒ amplitude {probIso.toFixed(4)} (of peak{' '}
                                    {fieldSample.maxAbs.toFixed(4)})
                                </div>
                            )}
                        </section>
                    )}

                    {/* Cutaway toggle — only meaningful for the 3D modes */}
                    {renderMode !== 'slice' && (
                        <section>
                            <label style={{ fontSize: 13, color: theme.text, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={clipEnabled}
                                    onChange={(e) => setClipEnabled(e.target.checked)}
                                />
                                Half cutaway
                                <span style={{ color: theme.textMuted, fontSize: 11 }}>
                                    (cut the volume along a plane to see inside)
                                </span>
                            </label>
                        </section>
                    )}

                    {/* Plane controls — shared between slice mode and 3D cutaway */}
                    {(renderMode === 'slice' || clipEnabled) && (
                        <>
                            <section>
                                <label style={{ fontSize: 13, color: theme.textMuted, display: 'block', marginBottom: 6 }}>
                                    {renderMode === 'slice' ? 'Slice plane (normal)' : 'Cutaway plane (normal)'}
                                </label>
                                {buttonRow(
                                    [
                                        { value: '0', label: 'x = c' },
                                        { value: '1', label: 'y = c' },
                                        { value: '2', label: 'z = c' },
                                    ],
                                    String(sliceAxis),
                                    (v) => setSliceAxis(parseInt(v) as SliceAxis),
                                )}
                            </section>
                            <section>
                                <label style={{ fontSize: 13, color: theme.textMuted }}>
                                    Plane position = {slicePosition.toFixed(2)}
                                </label>
                                <input
                                    type="range"
                                    min={-boundingRadius}
                                    max={boundingRadius}
                                    step={0.1}
                                    value={slicePosition}
                                    onChange={(e) => setSlicePosition(parseFloat(e.target.value))}
                                    style={sliderStyle}
                                />
                            </section>
                        </>
                    )}

                    {displayMode === 'angular' && (
                        <section>
                            <label style={{ fontSize: 13, color: theme.textMuted }}>
                                Envelope length λ = {envelopeScale.toFixed(2)}
                                <span style={{ color: theme.textMuted, marginLeft: 6 }}>
                                    (e<sup>−r/λ</sup>)
                                </span>
                            </label>
                            <input
                                type="range"
                                min={0.5}
                                max={4}
                                step={0.1}
                                value={envelopeScale}
                                onChange={(e) => setEnvelopeScale(parseFloat(e.target.value))}
                                style={sliderStyle}
                            />
                        </section>
                    )}

                    <section style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 13, color: theme.textMuted, display: 'block' }}>
                                + lobe
                            </label>
                            <input
                                type="color"
                                value={colorPositive}
                                onChange={(e) => setColorPositive(e.target.value)}
                                style={{ width: '100%', height: 28, border: 'none', padding: 0, background: 'transparent' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 13, color: theme.textMuted, display: 'block' }}>
                                − lobe
                            </label>
                            <input
                                type="color"
                                value={colorNegative}
                                onChange={(e) => setColorNegative(e.target.value)}
                                style={{ width: '100%', height: 28, border: 'none', padding: 0, background: 'transparent' }}
                            />
                        </div>
                        <label
                            style={{
                                fontSize: 12,
                                color: theme.text,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                height: 28,
                                whiteSpace: 'nowrap',
                                cursor: 'pointer',
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={showAxes}
                                onChange={(e) => setShowAxes(e.target.checked)}
                            />
                            axes
                        </label>
                    </section>

                    {/* ---- Linear combinations ---- */}
                    <section
                        style={{
                            borderTop: `1px solid ${theme.border}`,
                            paddingTop: 10,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                        }}
                    >
                        <div style={{ fontSize: 13, color: theme.textMuted }}>
                            Linear combination{' '}
                            <span style={{ fontSize: 11 }}>
                                ({terms.length} term{terms.length === 1 ? '' : 's'})
                            </span>
                        </div>
                        <div style={{ fontSize: 11, color: theme.textMuted, lineHeight: 1.5 }}>
                            ψ = c₁·(Term #1) + c₂·(Term #2) + … Term #1 is edited by the sliders
                            above. The ⇄ inside each card flips that term's basis.
                        </div>

                        {/* Preset row */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {LC_PRESETS.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => applyTerms(p.terms, p.mode)}
                                    style={{
                                        padding: '4px 10px',
                                        borderRadius: 4,
                                        border: `1px solid ${theme.border}`,
                                        background: theme.inputBg,
                                        color: theme.text,
                                        fontSize: 12,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        {/* Primary coefficient — shown only in LC mode */}
                        {extraTerms.length > 0 && (
                            <div>
                                <label style={{ fontSize: 12, color: theme.textMuted }}>
                                    Primary coefficient = {primaryCoeff.toFixed(3)}
                                </label>
                                <input
                                    type="range"
                                    min={-2}
                                    max={2}
                                    step={0.01}
                                    value={primaryCoeff}
                                    onChange={(e) => setPrimaryCoeff(parseFloat(e.target.value))}
                                    style={sliderStyle}
                                />
                            </div>
                        )}

                        {/* Extra-term cards */}
                        {extraTerms.map((t, idx) => (
                            <div
                                key={idx}
                                style={{
                                    border: `1px solid ${theme.border}`,
                                    borderRadius: 4,
                                    padding: 8,
                                    background: theme.inputBg,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 6,
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        fontSize: 12,
                                        color: theme.textMuted,
                                        gap: 6,
                                    }}
                                >
                                    <span>Term #{idx + 2}</span>
                                    <button
                                        onClick={() => flipTermKind(idx)}
                                        style={{
                                            padding: '2px 8px',
                                            borderRadius: 3,
                                            border: `1px solid ${theme.border}`,
                                            background: theme.surface,
                                            color: theme.text,
                                            cursor: 'pointer',
                                            fontSize: 11,
                                        }}
                                        title="Flip basis (spherical ↔ cartesian)"
                                    >
                                        {t.kind === 'spherical' ? 'Y_{l,m}' : 'x^a y^b z^c'} ⇄
                                    </button>
                                    <button
                                        onClick={() => removeExtraTerm(idx)}
                                        style={{
                                            border: 'none',
                                            background: 'transparent',
                                            color: theme.textMuted,
                                            cursor: 'pointer',
                                            fontSize: 16,
                                            lineHeight: 1,
                                            marginLeft: 'auto',
                                        }}
                                        title="Remove term"
                                    >
                                        ×
                                    </button>
                                </div>

                                {t.kind === 'spherical' ? (
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr 1fr',
                                            gap: 6,
                                            fontSize: 12,
                                        }}
                                    >
                                        {(['n', 'l', 'm'] as const).map((field) => (
                                            <label key={field} style={{ color: theme.textMuted }}>
                                                {field}
                                                <input
                                                    type="number"
                                                    value={t[field]}
                                                    min={field === 'n' ? 1 : field === 'm' ? -t.l : 0}
                                                    max={
                                                        field === 'n'
                                                            ? 4
                                                            : field === 'l'
                                                                ? t.n - 1
                                                                : t.l
                                                    }
                                                    onChange={(e) => {
                                                        const v = parseInt(e.target.value);
                                                        if (Number.isNaN(v)) return;
                                                        const patch: any = { [field]: v };
                                                        // Keep (n, l, m) consistent.
                                                        if (field === 'n' && t.l >= v) patch.l = v - 1;
                                                        if (field === 'l' && Math.abs(t.m) > v) patch.m = 0;
                                                        updateExtraTerm(idx, patch);
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        padding: '2px 4px',
                                                        background: theme.surface,
                                                        color: theme.text,
                                                        border: `1px solid ${theme.border}`,
                                                        borderRadius: 3,
                                                    }}
                                                />
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <div style={{ display: 'flex', gap: 8, fontSize: 12, color: theme.textMuted }}>
                                            <label>
                                                n
                                                <input
                                                    type="number"
                                                    value={t.n}
                                                    min={1}
                                                    max={4}
                                                    onChange={(e) =>
                                                        updateExtraTerm(idx, { n: parseInt(e.target.value) || 1 })
                                                    }
                                                    style={{
                                                        width: 48,
                                                        marginLeft: 6,
                                                        padding: '2px 4px',
                                                        background: theme.surface,
                                                        color: theme.text,
                                                        border: `1px solid ${theme.border}`,
                                                        borderRadius: 3,
                                                    }}
                                                />
                                            </label>
                                            <label>
                                                degree l
                                                <select
                                                    value={t.a + t.b + t.c}
                                                    onChange={(e) => {
                                                        const newL = parseInt(e.target.value);
                                                        // Snap (a, b, c) to a sensible default at the new degree.
                                                        const defaults: Array<[number, number, number]> = [
                                                            [0, 0, 0],
                                                            [0, 0, 1],
                                                            [2, 0, 0],
                                                            [0, 0, 3],
                                                            [0, 0, 4],
                                                        ];
                                                        const [a, b, c] = defaults[newL] ?? [newL, 0, 0];
                                                        updateExtraTerm(idx, { a, b, c });
                                                    }}
                                                    style={{
                                                        marginLeft: 6,
                                                        padding: '2px 4px',
                                                        background: theme.surface,
                                                        color: theme.text,
                                                        border: `1px solid ${theme.border}`,
                                                        borderRadius: 3,
                                                    }}
                                                >
                                                    {[0, 1, 2, 3, 4].map((ll) => (
                                                        <option key={ll} value={ll}>
                                                            {ll}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        </div>
                                        <div
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(50px, 1fr))',
                                                gap: 3,
                                            }}
                                        >
                                            {cartesianMonomials(t.a + t.b + t.c).map((mono) => {
                                                const selected =
                                                    mono.a === t.a && mono.b === t.b && mono.c === t.c;
                                                return (
                                                    <button
                                                        key={`${mono.a}-${mono.b}-${mono.c}`}
                                                        onClick={() =>
                                                            updateExtraTerm(idx, {
                                                                a: mono.a,
                                                                b: mono.b,
                                                                c: mono.c,
                                                            })
                                                        }
                                                        style={{
                                                            padding: '3px 5px',
                                                            fontSize: 11,
                                                            border: `1px solid ${theme.border}`,
                                                            background: selected ? theme.accent : theme.surface,
                                                            color: selected ? '#fff' : theme.text,
                                                            borderRadius: 3,
                                                            cursor: 'pointer',
                                                            fontFamily:
                                                                'ui-monospace, SFMono-Regular, monospace',
                                                        }}
                                                    >
                                                        {mono.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <label style={{ fontSize: 12, color: theme.textMuted }}>
                                    coeff = {t.coeff.toFixed(3)}
                                </label>
                                <input
                                    type="range"
                                    min={-2}
                                    max={2}
                                    step={0.01}
                                    value={t.coeff}
                                    onChange={(e) =>
                                        updateExtraTerm(idx, { coeff: parseFloat(e.target.value) })
                                    }
                                    style={sliderStyle}
                                />
                            </div>
                        ))}

                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <button
                                onClick={addTerm}
                                disabled={terms.length >= 8}
                                style={{
                                    flex: 2,
                                    minWidth: 120,
                                    padding: '6px 10px',
                                    border: `1px solid ${theme.border}`,
                                    background: theme.inputBg,
                                    color: theme.text,
                                    fontSize: 12,
                                    borderRadius: 4,
                                    cursor: terms.length >= 8 ? 'not-allowed' : 'pointer',
                                    opacity: terms.length >= 8 ? 0.5 : 1,
                                }}
                                title="Add a term of the current basis; flip with ⇄ after"
                            >
                                + Add term ({basisMode === 'cartesian' ? 'x^a y^b z^c' : 'Y_{l,m}'})
                            </button>
                            {extraTerms.length > 0 && (
                                <>
                                    <button
                                        onClick={normalizeCoeffs}
                                        style={{
                                            padding: '5px 10px',
                                            border: `1px solid ${theme.border}`,
                                            background: theme.inputBg,
                                            color: theme.text,
                                            fontSize: 12,
                                            borderRadius: 4,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Normalize
                                    </button>
                                    <button
                                        onClick={clearExtras}
                                        style={{
                                            padding: '5px 10px',
                                            border: `1px solid ${theme.border}`,
                                            background: theme.inputBg,
                                            color: theme.text,
                                            fontSize: 12,
                                            borderRadius: 4,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Clear
                                    </button>
                                </>
                            )}
                        </div>
                    </section>

                    <div style={{ fontSize: 11, color: theme.textMuted, borderTop: `1px solid ${theme.border}`, paddingTop: 8 }}>
                        {displayMode === 'angular' && basisMode === 'spherical' &&
                            'Y_{l,m}(θ,φ) is universal for any central potential — angular nodes are fixed by l.'}
                        {displayMode === 'angular' && basisMode === 'cartesian' && l < 2 &&
                            'At l ≤ 1 the Cartesian and spherical bases agree — same functions, same shapes.'}
                        {displayMode === 'angular' && basisMode === 'cartesian' && l >= 2 &&
                            `At l=${l} there are ${(l + 1) * (l + 2) / 2} Cartesian monomials but only ${2 * l + 1} true Y_{l,m}. The extras (e.g. x², y², z²) carry lower-l "contamination" (x²+y²+z² = r² is an s-like piece). Compare x² with d_{z²} by switching basis.`}
                        {displayMode === 'radial' &&
                            'R_{nl}(r) is specific to the Coulomb potential (hydrogen) — n − l − 1 radial nodes.'}
                        {displayMode === 'full' &&
                            'ψ is the product of both factors — combines angular lobes with radial shells.'}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const HydrogenOrbitals: React.FC = () => (
    <BrowserOnly fallback={<div style={{ minHeight: 420 }} />}>
        {() => <HydrogenOrbitalsInner />}
    </BrowserOnly>
);

export default HydrogenOrbitals;
