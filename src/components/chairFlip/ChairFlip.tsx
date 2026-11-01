import React, { useCallback, useMemo, useState } from 'react';
import {
    usePrefersReducedMotion,
    useVizTheme,
    VizPanel,
    VizPanelSection,
    VizPlotHeader,
    VizWorkbench,
} from '../shared/viz';
import { ButtonRow, ControlGroup, ControlHint, SegmentedControl, ToggleSwitch, VizButton } from '../shared/controls';
import data from './data/methylcyclohexane_flip.json';
import { EnergyProfile, type ProfileCurve } from '../reactionPath/EnergyProfile';
import { PathStage } from '../reactionPath/PathStage';
import { PathViewport, sideView } from '../reactionPath/PathViewport';
import rp from '../reactionPath/ReactionPath.module.css';
import {
    bondedHydrogens,
    buildPath,
    createCursor,
    distanceAlong,
    energyAt,
    nearestFrame,
    pointAt,
    type ConformerPath,
    type PathCursor,
} from '../reactionPath/path';
import { useCursorValue, usePlayback } from '../reactionPath/playback';
import { METHYLCYCLOHEXANE_NOTES, methylcyclohexaneMeasures } from './notes';
import styles from './ChairFlip.module.css';

const SPEEDS = [
    { value: 0.5, label: '½×' },
    { value: 1, label: '1×' },
    { value: 2, label: '2×' },
];

/** Å of path per second at 1×: the whole flip in about eight seconds. */
const BASE_SPEED = 1.8;

export default function ChairFlip({ title }: { title: string }) {
    const path = useMemo(() => buildPath(data), []);
    const cursor = useMemo(() => createCursor(0), []);
    const notes = METHYLCYCLOHEXANE_NOTES;
    const labels = useMemo(() => notes.map((n) => n.short), [notes]);
    const theme = useVizTheme();
    const reducedMotion = usePrefersReducedMotion();
    // The methyl carbon (atom 0) and its hydrogens, coloured so the flip is easy to follow.
    const methyl = useMemo(() => [0, ...bondedHydrogens(path, 0)], [path]);
    const [speed, setSpeed] = useState(1);
    const [showHydrogens, setShowHydrogens] = useState(true);
    const [ringFaces, setRingFaces] = useState(true);
    // C1's end shares the methyl's colour.
    const ringColors = useMemo(() => [theme.series[0], theme.series[1], theme.series[2]] as const, [theme.series]);
    const measures = useMemo(() => methylcyclohexaneMeasures(path.ring), [path]);
    const [shown, setShown] = useState<ReadonlySet<string>>(() => new Set());
    const measurements = useMemo(() => measures.filter((m) => shown.has(m.key)).flatMap((m) => m.defs), [measures, shown]);
    const toggleMeasure = (key: string, on: boolean) =>
        setShown((prev) => {
            const next = new Set(prev);
            if (on) next.add(key);
            else next.delete(key);
            return next;
        });
    const { target, setTarget } = usePlayback(cursor, BASE_SPEED, speed);
    // Nearly side-on to the ring, across C1···C4, so the chair's zig-zag and the flipping end are in view.
    const view = useMemo(() => sideView(path, path.ring, path.ring[0], path.ring[3], 25), [path]);
    const curves = useMemo<ProfileCurve[]>(
        () => [{ key: 'flip', path, progress: distanceAlong, color: theme.series[0], labels }],
        [path, labels, theme.series],
    );
    const playing = target !== null;

    const activePoint = useCursorValue(cursor, (s) => pointAt(path, s));
    // The point whose note is shown: the one at the cursor, else the nearest.
    const notePoint = useCursorValue(cursor, (s) => {
        let best = 0;
        path.points.forEach((p, k) => {
            if (Math.abs(path.s[p.frame] - s) < Math.abs(path.s[path.points[best].frame] - s)) best = k;
        });
        return best;
    });

    const pointS = (k: number) => path.s[path.points[k].frame];
    const goTo = useCallback(
        (s: number) => {
            if (reducedMotion) {
                setTarget(null);
                cursor.set(s);
            } else {
                setTarget(s);
            }
        },
        [reducedMotion, cursor, setTarget],
    );

    const step = (dir: 1 | -1) => {
        const s = target ?? cursor.get();
        const eps = 1e-6;
        const stops = path.points.map((_, k) => pointS(k));
        const next = dir > 0 ? stops.find((x) => x > s + eps) : [...stops].reverse().find((x) => x < s - eps);
        if (next !== undefined) goTo(next);
    };

    const togglePlay = () => {
        if (playing) {
            setTarget(null);
            return;
        }
        // From the end, start over.
        if (cursor.get() >= path.length - 1e-6) cursor.set(0);
        setTarget(path.length);
    };

    const point = path.points[notePoint];
    const atStart = useCursorValue(cursor, (s) => s <= 1e-6);
    const atEnd = useCursorValue(cursor, (s) => s >= path.length - 1e-6);

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
                <ControlHint>Click or drag on the profile to move along the path.</ControlHint>
            </ControlGroup>
            <ControlGroup label="Show">
                <ToggleSwitch label="Ring faces" checked={ringFaces} onChange={setRingFaces} />
                <ToggleSwitch label="Hydrogens" checked={showHydrogens} onChange={setShowHydrogens} />
            </ControlGroup>
            <ControlGroup label="Measure">
                {measures.map((m) => (
                    <ToggleSwitch key={m.key} label={m.label} checked={shown.has(m.key)} onChange={(on) => toggleMeasure(m.key, on)} />
                ))}
            </ControlGroup>
            <ControlGroup label="Stationary points">
                <ol className={styles.pointList}>
                    {path.points.map((p, k) => (
                        <li key={k}>
                            <button
                                type="button"
                                className={styles.pointButton}
                                aria-current={k === activePoint ? 'step' : undefined}
                                onClick={() => goTo(pointS(k))}
                            >
                                <span className={styles.pointName}>
                                    {p.kind === 'ts' ? <span className={styles.tsMark} aria-label="transition state">‡</span> : null}
                                    {p.label}
                                </span>
                                <span className={styles.pointEnergy}>{path.energies[p.frame].toFixed(1)}</span>
                            </button>
                        </li>
                    ))}
                </ol>
                <ControlHint>kJ/mol relative to the equatorial chair; ‡ marks transition states. GFN2-xTB, climbing-image NEB.</ControlHint>
            </ControlGroup>
        </VizPanel>
    );

    return (
        <VizWorkbench sidebar={sidebar}>
            <VizPanel flush>
                <VizPanelSection>
                    <VizPlotHeader title={title} readout={<Readout path={path} cursor={cursor} />} />
                </VizPanelSection>
                <PathStage
                    controls={playButtons}
                    profile={
                        <EnergyProfile
                            curves={curves}
                            cursor={cursor}
                            xName="Reaction progress"
                            xTicks={false}
                            onScrubStart={() => setTarget(null)}
                            ariaLabel="Energy along the ring-flip path; click to move along it"
                        />
                    }
                >
                    {(full) => (
                        <VizPanelSection className={styles.viewerSection}>
                            <PathViewport
                                className={full ? rp.fullViewport : undefined}
                                path={path}
                                cursor={cursor}
                                view={view}
                                highlight={methyl}
                                highlightColor={theme.series[1]}
                                measurements={measurements}
                                showHydrogens={showHydrogens}
                                ringFaces={ringFaces}
                                ringColors={ringColors}
                            />
                            <div className={full ? `${styles.caption} ${styles.captionTop}` : styles.caption}>
                                <span className={styles.captionTitle}>
                                    {activePoint === notePoint ? point.label : `Near: ${point.label}`}
                                    <span className={styles.captionDetail}>
                                        {point.kind === 'ts' ? 'transition state' : 'minimum'} · {path.energies[point.frame].toFixed(1)} kJ/mol
                                    </span>
                                </span>
                                {notes[notePoint].body}
                            </div>
                        </VizPanelSection>
                    )}
                </PathStage>
            </VizPanel>
        </VizWorkbench>
    );
}

/** Energy and image at the cursor; re-renders on every move, so kept small. */
function Readout({ path, cursor }: { path: ConformerPath; cursor: PathCursor }) {
    const e = useCursorValue(cursor, (s) => energyAt(path, s).toFixed(1));
    const frame = useCursorValue(cursor, (s) => nearestFrame(path, s));
    return (
        <>
            {e} kJ/mol · image {frame + 1} of {path.frames.length}
        </>
    );
}
