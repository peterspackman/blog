import React, { useCallback, useMemo, useState } from 'react';
import {
    usePrefersReducedMotion,
    useVizTheme,
    VizPanel,
    VizPanelSection,
    VizPanelSplit,
    VizPlotHeader,
    VizSectionHeader,
    VizWorkbench,
} from '../shared/viz';
import { ButtonRow, ControlGroup, ControlHint, SegmentedControl, ToggleSwitch, VizButton } from '../shared/controls';
import { EnergyProfile, type ProfileCurve } from '../reactionPath/EnergyProfile';
import type { MeasureDef } from '../reactionPath/measures';
import { PathStage } from '../reactionPath/PathStage';
import { PathViewport, sideView } from '../reactionPath/PathViewport';
import { buildPath, createCursor, energyAt, progressOf, type ConformerPath, type PathCursor, type Progress } from '../reactionPath/path';
import { useCursorValue, usePlayback } from '../reactionPath/playback';
import data from './data/propene_hbr.json';
import styles from './Markovnikov.module.css';

/** Atom labels in the path data: propene's carbons, then HBr's H and Br. */
const C1 = 0, C2 = 1, C3 = 2, H = 9, BR = 10;
const CARBONS = [C1, C2, C3];

const SPEEDS = [
    { value: 0.5, label: '½×' },
    { value: 1, label: '1×' },
    { value: 2, label: '2×' },
];

/** Progress per second at 1×: complex to product in about seven seconds. */
const RATE = 0.15;

/** One line per stop, in path order: the complex, the transition states, the products. */
const STOPS = [
    { label: 'Propene···HBr', note: 'HBr sits loosely over the C=C.' },
    { label: 'Transition states', note: 'H⁺ is on carbon and Br⁻ has let go: a carbocation and a bromide. Watch where the + charge sits.' },
    { label: 'Products', note: 'The products are close in energy; the gap between the barriers is what decides it.' },
];

interface Route {
    key: string;
    /** Its curve's colour, repeated on its title so the viewers and lines pair up. */
    color: string;
    title: string;
    detail: string;
    name: string;
    path: ConformerPath;
    progress: Progress;
    /** The carbon H⁺ goes to and the one Br ends on. */
    hTo: number;
    brTo: number;
}

/**
 * Each carbon with propene's hydrogens on it: the incoming proton is left
 * out, so the numbers show where the positive charge goes in the propene
 * framework rather than where the proton landed.
 */
function carbonGroups(positions: ArrayLike<number>, symbols: readonly string[]): number[][] {
    const d = (i: number, j: number) =>
        Math.hypot(positions[3 * i] - positions[3 * j], positions[3 * i + 1] - positions[3 * j + 1], positions[3 * i + 2] - positions[3 * j + 2]);
    return CARBONS.map((c) => [c, ...symbols.flatMap((el, i) => (el === 'H' && i !== H && d(i, c) < 1.25 ? [i] : []))]);
}

/** Two decimals with an explicit sign; anything that rounds to zero reads as ±0.00. */
const signed = (v: number) => {
    const t = Math.abs(v).toFixed(2);
    return Number(t) === 0 ? `±${t}` : `${v > 0 ? '+' : '−'}${t}`;
};

export default function Markovnikov({ title }: { title: string }) {
    const theme = useVizTheme();
    const reducedMotion = usePrefersReducedMotion();
    const routes = useMemo<Route[]>(() => {
        const make = (k: number) => buildPath({ ...data.paths[k], symbols: data.symbols, method: data.method });
        const exterior = make(0), interior = make(1);
        return [
            {
                key: 'exterior',
                color: theme.series[0],
                title: 'H⁺ to CH₂',
                detail: '→ 2-bromopropane (Markovnikov)',
                name: 'H⁺ to CH₂',
                path: exterior,
                progress: progressOf(exterior),
                hTo: C1,
                brTo: C2,
            },
            {
                key: 'interior',
                color: theme.series[1],
                title: 'H⁺ to CH',
                detail: '→ 1-bromopropane',
                name: 'H⁺ to CH',
                path: interior,
                progress: progressOf(interior),
                hTo: C2,
                brTo: C1,
            },
        ];
    }, [theme.series]);
    const cursor = useMemo(() => createCursor(0), []);
    const [speed, setSpeed] = useState(1);
    const [showCharges, setShowCharges] = useState(true);
    const [showHydrogens, setShowHydrogens] = useState(true);
    const [shown, setShown] = useState<ReadonlySet<string>>(() => new Set());
    const toggleMeasure = (key: string, on: boolean) =>
        setShown((prev) => {
            const next = new Set(prev);
            if (on) next.add(key);
            else next.delete(key);
            return next;
        });
    const { target, setTarget } = usePlayback(cursor, RATE, speed);
    const playing = target !== null;

    const curves = useMemo<ProfileCurve[]>(
        () =>
            routes.map((r, i) => ({
                key: r.key,
                name: r.name,
                path: r.path,
                progress: r.progress,
                color: r.color,
                labels: r.path.points.map((p) => (p.kind === 'ts' ? 'TS' : p.frame === 0 ? (i === 0 ? 'Propene···HBr' : '') : p.label)),
                // The lower curve's labels go below it, the upper one's above, so the pairs don't collide.
                labelPosition: (k: number) => (k === 0 ? 'top' : i === 0 ? 'bottom' : 'top'),
            })),
        [routes],
    );

    const stops = [0, 0.5, 1];
    const stop = useCursorValue(cursor, (x) => stops.findIndex((v) => Math.abs(v - x) < 0.004));
    const nearest = useCursorValue(cursor, (x) => (x < 0.25 ? 0 : x < 0.75 ? 1 : 2));
    const atStart = useCursorValue(cursor, (x) => x <= 1e-6);
    const atEnd = useCursorValue(cursor, (x) => x >= 1 - 1e-6);

    const goTo = useCallback(
        (x: number) => {
            if (reducedMotion) {
                setTarget(null);
                cursor.set(x);
            } else {
                setTarget(x);
            }
        },
        [reducedMotion, cursor, setTarget],
    );
    const step = (dir: 1 | -1) => {
        const x = target ?? cursor.get();
        const next = dir > 0 ? stops.find((v) => v > x + 1e-6) : [...stops].reverse().find((v) => v < x - 1e-6);
        if (next !== undefined) goTo(next);
    };
    const togglePlay = () => {
        if (playing) return setTarget(null);
        if (cursor.get() >= 1 - 1e-6) cursor.set(0);
        setTarget(1);
    };

    const measures = [
        { key: 'ch', label: 'H···C (forming)', defs: (r: Route): MeasureDef[] => [[H, r.hTo]] },
        { key: 'hbr', label: 'H···Br (breaking)', defs: (): MeasureDef[] => [[H, BR]] },
        { key: 'cbr', label: 'Br···C (forming)', defs: (r: Route): MeasureDef[] => [[BR, r.brTo]] },
    ];

    const playButtons = (
        <>
            <VizButton onClick={() => step(-1)} disabled={atStart} aria-label="Previous stationary point">
                ◀ Prev
            </VizButton>
            <VizButton variant="primary" onClick={togglePlay}>
                {playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}
            </VizButton>
            <VizButton onClick={() => step(1)} disabled={atEnd} aria-label="Next stationary point">
                Next ▶
            </VizButton>
        </>
    );

    const sidebar = (
        <VizPanel stack>
            <ControlGroup label="Path">
                <ButtonRow>{playButtons}</ButtonRow>
                <SegmentedControl<number> aria-label="Speed" value={speed} onChange={setSpeed} options={SPEEDS} />
                <ControlHint>Click or drag on the profile to move.</ControlHint>
            </ControlGroup>
            <ControlGroup label="Show">
                <ToggleSwitch label="Charges" checked={showCharges} onChange={setShowCharges} />
                <ToggleSwitch label="Hydrogens" checked={showHydrogens} onChange={setShowHydrogens} />
                {showCharges && <ControlHint>Blue δ+, red δ−; each carbon with its hydrogens.</ControlHint>}
            </ControlGroup>
            <ControlGroup label="Measure">
                {measures.map((m) => (
                    <ToggleSwitch key={m.key} label={m.label} checked={shown.has(m.key)} onChange={(on) => toggleMeasure(m.key, on)} />
                ))}
            </ControlGroup>
            <ControlGroup label="Stops">
                <ol className={styles.stopList}>
                    {STOPS.map((s, k) => (
                        <li key={k}>
                            <button type="button" className={styles.stopButton} aria-current={k === stop ? 'step' : undefined} onClick={() => goTo(stops[k])}>
                                {k === 1 && <span className={styles.tsMark} aria-label="transition state">‡</span>}
                                {s.label}
                            </button>
                        </li>
                    ))}
                </ol>
                <ControlHint>ωB97M-V/def2-TZVPD; kJ/mol from the propene···HBr complex.</ControlHint>
            </ControlGroup>
        </VizPanel>
    );

    return (
        <VizWorkbench sidebar={sidebar}>
            <VizPanel flush>
                <VizPanelSection>
                    <VizPlotHeader title={title} readout={<Readout routes={routes} cursor={cursor} />} />
                </VizPanelSection>
                <PathStage
                    controls={playButtons}
                    caption={
                        <>
                            <span className={styles.noteTitle}>{stop === nearest ? STOPS[nearest].label : `Near: ${STOPS[nearest].label}`}</span>
                            {STOPS[nearest].note}
                        </>
                    }
                    profile={
                        <EnergyProfile
                            curves={curves}
                            cursor={cursor}
                            xName="Reaction progress"
                            xTicks={false}
                            onScrubStart={() => setTarget(null)}
                            ariaLabel="Energy along both HBr addition paths; click to move along them"
                        />
                    }
                >
                    {(full) => (
                        <VizPanelSplit equal>
                            {routes.map((r) => (
                                <RouteView
                                    key={r.key}
                                    route={r}
                                    full={full}
                                    cursor={cursor}
                                    showCharges={showCharges}
                                    showHydrogens={showHydrogens}
                                    measurements={measures.filter((m) => shown.has(m.key)).flatMap((m) => m.defs(r))}
                                />
                            ))}
                        </VizPanelSplit>
                    )}
                </PathStage>
            </VizPanel>
        </VizWorkbench>
    );
}

function RouteView({
    route,
    full,
    cursor,
    showCharges,
    showHydrogens,
    measurements,
}: {
    route: Route;
    full: boolean;
    cursor: PathCursor;
    showCharges: boolean;
    showHydrogens: boolean;
    measurements: MeasureDef[];
}) {
    const { path } = route;
    // Side-on to propene with C1 on the left and the HBr above.
    const view = useMemo(() => sideView(path, CARBONS, C1, C3, 15, BR), [path]);
    const ts = path.points[1];
    const labels = useCallback(
        (positions: Float32Array, q: Float32Array | null) => {
            if (!q) return [];
            const sums = carbonGroups(positions, path.symbols).map((g) => g.reduce((t, i) => t + q[i], 0));
            const at = (i: number): [number, number, number] => [positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]];
            return [...CARBONS.map((c, k) => ({ position: at(c), text: signed(sums[k]) })), { position: at(BR), text: signed(q[BR]) }];
        },
        [path],
    );
    const groups = useCallback((positions: Float32Array) => carbonGroups(positions, path.symbols), [path]);
    const measured = useMemo(() => measurements, [JSON.stringify(measurements)]); // eslint-disable-line react-hooks/exhaustive-deps
    return (
        <VizPanelSection className={styles.routeSection}>
            <VizSectionHeader title={<RouteName route={route} />} detail={`${route.detail} · barrier ${path.energies[ts.frame].toFixed(0)} kJ/mol`} />
            <PathViewport
                className={full ? styles.fullViewport : undefined}
                path={path}
                cursor={cursor}
                progress={route.progress}
                view={view}
                zoom={1.2}
                showCharges={showCharges}
                chargeGroups={groups}
                chargeScale={0.25}
                showHydrogens={showHydrogens}
                measurements={measured}
                labels={showCharges ? labels : undefined}
            />
        </VizPanelSection>
    );
}

/** A route's name after a swatch of its profile line. */
function RouteName({ route }: { route: Route }) {
    return (
        <span className={styles.routeName}>
            <Swatch color={route.color} />
            {route.title}
        </span>
    );
}

/** A short stretch of a profile line, to tie a label to its curve. */
function Swatch({ color }: { color: string }) {
    return (
        <svg className={styles.swatch} viewBox="0 0 22 10" aria-hidden>
            <line x1={1} x2={21} y1={5} y2={5} stroke={color} strokeWidth={2} />
            <circle cx={11} cy={5} r={3} fill={color} />
        </svg>
    );
}

/** Both paths' energies at the cursor; re-renders on every move, so kept small. */
function Readout({ routes, cursor }: { routes: Route[]; cursor: PathCursor }) {
    const energies = useCursorValue(cursor, (x) => routes.map((r) => energyAt(r.path, r.progress.toS(x)).toFixed(0)).join(' '));
    const values = energies.split(' ');
    return (
        <span className={styles.readout}>
            {routes.map((r, i) => (
                <span key={r.key}>
                    <RouteName route={r} /> {values[i]}
                </span>
            ))}
            <span>kJ/mol</span>
        </span>
    );
}
