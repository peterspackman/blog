import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import { CollapsibleSection, SegmentedControl, Select, SliderWithInput, VizButton } from '../shared/controls';
import MathFormula from '../MathFormula';
import type { CGResult } from './parse';
import { cgCommand } from './runCG';
import { useCGSession } from './useCGSession';
import {
    FacetTable,
    FiniteFigure,
    PairFigure,
    sharedExtents,
    SolventTable,
    SurfaceFigure,
    solventLabel,
    useWulffSet,
    WulffShapes,
    type Extents,
    type WulffSet,
} from './figures';
import styles from './CrystalGrowth.module.css';

const MODEL = 'gfn2';
const PRECOMPUTED = '/data/cg/paracetamol.json';
const DEFAULT_CIF = '/data/cg/paracetamol.cif';
const DEFAULT_CACHE = '/data/cg/paracetamol_cache.json';
// Placeholders until the preprint and the paper are out.
const PREPRINT_URL = '#';
const PAPER_URL = '#';

/** Precomputed, and the starting set. */
const DEFAULT_SOLVENTS = ['water', 'methanol', 'ethanol', 'acetone', 'ethylethanoate', 'toluene', 'n-hexane'];
const ALL_SOLVENTS = [
    'water', 'methanol', 'ethanol', '1-propanol', '2-propanol', '1-octanol', 'acetone', 'acetonitrile',
    'ethylethanoate', 'tetrahydrofuran', 'dimethylsulfoxide', 'dichloromethane', 'chloroform', 'toluene',
    'benzene', 'cyclohexane', 'n-hexane', 'n-heptane',
];

const AUTHORS = [
    { name: 'James R. Brookes', aff: [1] },
    { name: 'Peter R. Spackman', aff: [1], corresponding: true },
    { name: 'Julian D. Gale', aff: [1] },
    { name: 'Michael W. Anderson', aff: [2, 3] },
    { name: 'Alvin J. Walisinghe', aff: [2, 3] },
];
const AFFILIATIONS = [
    'Curtin University',
    'The University of Manchester',
    'Crystogen',
];

function useThreads() {
    const [threads, setThreads] = useState(1);
    useEffect(() => {
        const isolated = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;
        setThreads(isolated ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1)) : 1);
    }, []);
    return threads;
}

function useElapsed(started: number | null) {
    const [now, setNow] = useState(0);
    useEffect(() => {
        if (started === null) return;
        setNow(performance.now());
        const id = setInterval(() => setNow(performance.now()), 200);
        return () => clearInterval(id);
    }, [started]);
    return started === null ? null : Math.max(0, (now - started) / 1000);
}

function Eq({ tex }: { tex: string }) {
    return (
        <div className={styles.equation}>
            <MathFormula math={tex} inline={false} />
        </div>
    );
}

const M = ({ tex }: { tex: string }) => <MathFormula math={tex} />;

function Stat({ label, value, unit }: { label: React.ReactNode; value: string; unit?: string }) {
    return (
        <div className={styles.stat}>
            <dt>{label}</dt>
            <dd>
                {value}
                {unit && <span className={styles.statUnit}> {unit}</span>}
            </dd>
        </div>
    );
}

const signed = (x: number, dp = 1) => x.toFixed(dp).replace('-', '−');

export default function CrystalGrowthPaper() {
    const threads = useThreads();
    const session = useCGSession({
        defaultCif: DEFAULT_CIF,
        defaultCache: DEFAULT_CACHE,
        precomputed: PRECOMPUTED,
        model: MODEL,
        threads,
    });
    const { structure, setStructure, dmin, setDmin, results, stale, live, busy, lastRun, error, log } = session;
    const [solvents, setSolvents] = useState(DEFAULT_SOLVENTS);
    const [selected, setSelected] = useState('water');
    const fileInput = useRef<HTMLInputElement>(null);
    const elapsed = useElapsed(busy?.started ?? null);

    // Solvents in the set that have a result, in set order.
    const available = useMemo(() => solvents.filter((s) => results[s]), [solvents, results]);
    const current = available.includes(selected) ? selected : available[0];
    const result = current ? results[current] : null;

    const addSolvent = (s: string) => {
        if (!solvents.includes(s)) setSolvents((prev) => [...prev, s]);
        setSelected(s);
        session.add(s);
    };
    const removeSolvent = (s: string) => setSolvents((prev) => (prev.length > 1 ? prev.filter((x) => x !== s) : prev));

    const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        file.text().then((cif) => {
            const name = file.name.replace(/\.cif$/i, '').replace(/[^A-Za-z0-9_-]+/g, '_') || 'crystal';
            setStructure({ name, cif });
        });
        e.target.value = '';
    };

    const command = cgCommand({ name: structure.name, model: MODEL, solvent: current ?? 'water', dmin });
    const plural = threads > 1 ? 's' : '';
    const addable = ALL_SOLVENTS.filter((s) => !solvents.includes(s));

    let status: React.ReactNode = null;
    if (busy) status = `${solventLabel(busy.solvent)} (${busy.done + 1} of ${busy.total}) · ${elapsed?.toFixed(1)} s`;
    else if (error) status = <span className={styles.statusError}>{error}</span>;
    else if (stale) status = 'inputs changed: press Run to recompute';
    else if (lastRun) status = `${lastRun.count} solvent${lastRun.count > 1 ? 's' : ''} in ${lastRun.seconds.toFixed(1)} s on ${threads} thread${plural}`;
    else if (!live) status = 'showing precomputed results';

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <p className={styles.kicker}>Crystal Growth &amp; Design (forthcoming)</p>
                <h1 className={styles.title}>Predicting molecular crystal growth</h1>
                <p className={styles.subtitle}>
                    Automated surface terminations, interchangeable interaction energy models and finite particles in
                    the CrystalClear protocol
                </p>
                <p className={styles.authors}>
                    {AUTHORS.map((a, i) => (
                        <React.Fragment key={a.name}>
                            {i > 0 && ', '}
                            <span className={styles.author}>
                                {a.name}
                                <sup>
                                    {a.aff.join(',')}
                                    {a.corresponding && '*'}
                                </sup>
                            </span>
                        </React.Fragment>
                    ))}
                </p>
                <p className={styles.affiliations}>
                    {AFFILIATIONS.map((a, i) => (
                        <span key={a}>
                            <sup>{i + 1}</sup>
                            {a}
                        </span>
                    ))}
                </p>
                <div className={styles.links}>
                    <Link className={styles.linkButton} to={PREPRINT_URL}>
                        Preprint
                    </Link>
                    <Link className={styles.linkButton} to={PAPER_URL}>
                        Paper
                    </Link>
                    <Link className={styles.linkButton} to="https://getocc.xyz">
                        occ
                    </Link>
                </div>
            </header>

            <section className={styles.abstract}>
                <h2 className={styles.abstractTitle}>Abstract</h2>
                <p>
                    The incorporation of crystal growth processes extends the utility of predictive techniques beyond
                    simply crystal geometry and a thermodynamic ranking with the ultimate goal being actionable
                    information to target specific crystallisation. Pairwise model interaction energies with implicit
                    solvation have been previously demonstrated in the CrystalClear protocol to provide a computationally
                    efficient route to incorporate such processes, though some limitations restricted its use.
                    We present several advancements to overcome these limitations, incorporating a native
                    implementation of the semi-empirical GFN2-xTB model with SMD solvation, and validating both GFN2-xTB
                    and the CE-1p model against reference lattice energies and solubilities. Further, automated
                    enumeration of symmetry-unique faces and construction of solvated surface energies as part of the
                    same protocol facilitates direct prediction of solvent-dependent equilibrium crystal shapes while
                    eliminating the tedium and errors frequently associated with manual construction of surface
                    geometries required to evaluate surface free energies. To demonstrate the potential of these
                    advancements we present two case studies, oxindole and ritonavir, evaluating the accuracy of the
                    crystal growth protocol in reproducing experimental results for particle size effects, polymorph
                    stability and more. All methods presented here are freely available and implemented in open source
                    software, ensuring accessibility, extendability and transferability to the broader community.
                </p>
            </section>

            <section className={styles.runCard} aria-label="Calculation">
                <p className={styles.runIntro}>
                    The results below come from <code>occ cg</code> running in this tab (WebAssembly), with GFN2-xTB
                    and SMD solvation. The pair energies are computed once per structure, so each extra solvent takes
                    a second or so.
                </p>
                <div className={styles.runControls}>
                    <label className={styles.field}>
                        <span>Structure</span>
                        <Select
                            aria-label="Structure"
                            value={structure.cif ? 'upload' : 'paracetamol'}
                            onChange={(v) =>
                                v === 'paracetamol' ? setStructure({ name: 'paracetamol', cif: null }) : fileInput.current?.click()
                            }
                            options={[
                                { value: 'paracetamol', label: 'paracetamol, form I' },
                                { value: 'upload', label: structure.cif ? `${structure.name}.cif` : 'your own CIF…' },
                            ]}
                            disabled={!!busy}
                        />
                        <input ref={fileInput} type="file" accept=".cif" hidden onChange={onFile} />
                    </label>
                    <div className={clsx(styles.field, styles.fieldWide)}>
                        <SliderWithInput
                            label={<>Faces down to d<sub>min</sub></>}
                            value={dmin}
                            onChange={setDmin}
                            min={2}
                            max={5}
                            step={0.25}
                            decimals={2}
                            unit="Å"
                            disabled={!!busy}
                        />
                    </div>
                    <div className={styles.runButton}>
                        {busy ? (
                            <VizButton variant="secondary" block onClick={session.cancel}>
                                Cancel
                            </VizButton>
                        ) : (
                            <VizButton variant="primary" block onClick={() => session.runAll(solvents)}>
                                Run {solvents.length > 1 ? `all ${solvents.length}` : ''}
                            </VizButton>
                        )}
                    </div>
                </div>

                <div className={styles.field}>
                    <span>Solvents</span>
                    <div className={styles.chips}>
                        {solvents.map((s) => {
                            const pending = busy?.solvent === s;
                            return (
                                <span
                                    key={s}
                                    className={clsx(styles.chip, !results[s] && styles.chipEmpty, pending && styles.chipPending)}
                                >
                                    {solventLabel(s)}
                                    <button
                                        type="button"
                                        className={styles.chipRemove}
                                        aria-label={`Remove ${solventLabel(s)}`}
                                        onClick={() => removeSolvent(s)}
                                        disabled={solvents.length <= 1}
                                    >
                                        ×
                                    </button>
                                </span>
                            );
                        })}
                        {addable.length > 0 && (
                            <Select
                                aria-label="Add a solvent"
                                value={'' as string}
                                onChange={(v) => v && addSolvent(v)}
                                options={[
                                    { value: '', label: 'add a solvent…' },
                                    ...addable.map((s) => ({ value: s, label: solventLabel(s) })),
                                ]}
                            />
                        )}
                    </div>
                </div>

                <div className={styles.runMeta}>
                    <code className={styles.command}>{command}</code>
                    <span className={styles.status} role="status">
                        {status}
                    </span>
                </div>

                {result && (
                    <dl className={styles.stats}>
                        <Stat label={<M tex="U_\mathrm{lat}" />} value={signed(result.totals.latticeEnergy)} unit="kJ/mol" />
                        <Stat label={<M tex="\Delta H_\mathrm{sub}" />} value={signed(result.totals.dHsub)} unit="kJ/mol" />
                        <Stat
                            label={<M tex="\Delta G_\mathrm{solv}" />}
                            value={signed(result.totals.solvation)}
                            unit="kJ/mol"
                        />
                        <Stat
                            label={<M tex="\log S_0" />}
                            value={signed(result.totals.logS, 2)}
                        />
                    </dl>
                )}

                {log && (
                    <CollapsibleSection title="occ output">
                        <pre className={styles.log}>{log}</pre>
                    </CollapsibleSection>
                )}
            </section>

            {result && current && (
                <Results results={results} order={available} selected={current} onSelect={setSelected} />
            )}

            <footer className={styles.footer}>
                Same calculation, natively: <code>{command}</code>. Swap <code>-m gfn2</code> for <code>ce-b3lyp</code> or{' '}
                <code>ce-1p</code> for the CrystalExplorer models. <Link to="https://getocc.xyz">getocc.xyz</Link>
            </footer>
        </main>
    );
}

type Tab = 'faces' | 'solvents' | 'surfaces' | 'pairs' | 'finite';

const TABS: { value: Tab; label: string }[] = [
    { value: 'faces', label: 'Faces' },
    { value: 'solvents', label: 'Solvents' },
    { value: 'surfaces', label: 'Surface energies' },
    { value: 'pairs', label: 'Pair energies' },
    { value: 'finite', label: 'Finite particles' },
];

const CYCLE_MS = 1800;

function SolventSwitcher({
    order,
    selected,
    onSelect,
}: {
    order: string[];
    selected: string;
    onSelect: (s: string) => void;
}) {
    const [playing, setPlaying] = useState(false);
    const step = (by: number) => onSelect(order[(order.indexOf(selected) + by + order.length) % order.length]);
    const stepRef = useRef(step);
    stepRef.current = step;
    useEffect(() => {
        if (!playing || order.length < 2) return;
        const id = setInterval(() => stepRef.current(1), CYCLE_MS);
        return () => clearInterval(id);
    }, [playing, order.length]);

    if (order.length < 2) return null;
    return (
        <div className={styles.switcher}>
            <VizButton variant="ghost" size="sm" className={styles.stepButton} aria-label="Previous solvent" onClick={() => step(-1)}>
                ‹
            </VizButton>
            <SegmentedControl<string>
                aria-label="Solvent"
                value={selected}
                onChange={(s) => {
                    setPlaying(false);
                    onSelect(s);
                }}
                options={order.map((s) => ({ value: s, label: solventLabel(s) }))}
            />
            <VizButton variant="ghost" size="sm" className={styles.stepButton} aria-label="Next solvent" onClick={() => step(1)}>
                ›
            </VizButton>
            <VizButton
                variant="secondary"
                size="sm"
                aria-pressed={playing}
                onClick={() => setPlaying((p) => !p)}
            >
                {playing ? 'Pause' : 'Cycle'}
            </VizButton>
        </div>
    );
}

function Results({
    results,
    order,
    selected,
    onSelect,
}: {
    results: Record<string, CGResult>;
    order: string[];
    selected: string;
    onSelect: (s: string) => void;
}) {
    const wulff = useWulffSet(results);
    const extents = useMemo(() => sharedExtents(order.map((s) => results[s])), [results, order]);
    const [tab, setTab] = useState<Tab>('faces');
    const result = results[selected];
    const tabs = TABS.filter((t) => t.value !== 'finite' || result.samples.length > 0);
    if (!wulff || !wulff.solv[selected]) return null;

    return (
        <section className={styles.results} aria-label="Results">
            <div className={styles.hero}>
                <h2 className={styles.resultsTitle}>Predicted crystal shape</h2>
                <p className={styles.resultsText}>
                    The equilibrium (Wulff) shape of {result.title} in vacuum and in solution, from the surface energy
                    of every face. Drag to rotate.
                </p>
                <SolventSwitcher order={order} selected={selected} onSelect={onSelect} />
                <WulffShapes result={result} data={wulff} />
            </div>

            <div className={styles.tabBar}>
                <SegmentedControl<Tab> aria-label="Detail" value={tab} onChange={setTab} options={tabs} />
            </div>

            <div className={styles.tabPanel}>
                <TabBody
                    tab={tab}
                    result={result}
                    results={results}
                    order={order}
                    wulff={wulff}
                    extents={extents}
                    onSelect={onSelect}
                />
            </div>
        </section>
    );
}

function TabBody({
    tab,
    result,
    results,
    order,
    wulff,
    extents,
    onSelect,
}: {
    tab: Tab;
    result: CGResult;
    results: Record<string, CGResult>;
    order: string[];
    wulff: WulffSet;
    extents: Extents;
    onSelect: (s: string) => void;
}) {
    switch (tab) {
        case 'faces':
            return (
                <>
                    <p className={styles.tabText}>Each face's lowest surface energy and its share of the shape's area.</p>
                    <FacetTable result={result} data={wulff} />
                </>
            );
        case 'solvents':
            return (
                <>
                    <p className={styles.tabText}>
                        Solvation, dissolution and solubility in each solvent, with the two faces that cover most of the
                        shape. Click a row to show it.
                    </p>
                    <SolventTable results={results} order={order} data={wulff} selected={result.solvent} onSelect={onSelect} />
                </>
            );
        case 'surfaces':
            return (
                <>
                    <p className={styles.tabText}>
                        Every termination of every face down to <M tex="d_\mathrm{min}" />, in vacuum and in solution.
                        Filled points are the lowest-energy termination, which is the one the shape uses.
                    </p>
                    <Eq tex="\gamma_{hkl}(t) = \frac{s}{2}\,\frac{E_\mathrm{bulk} - E_\mathrm{slab}(t)}{2A_{hkl}}" />
                    <SurfaceFigure result={result} extents={extents} />
                </>
            );
        case 'pairs':
            return (
                <>
                    <p className={styles.tabText}>
                        Growth free energy of each symmetry-unique contact: crystal energy, redistributed
                        long-range energy and desolvation. Diamonds are the totals.
                    </p>
                    <PairFigure result={result} extents={extents} />
                </>
            );
        case 'finite':
            return (
                <>
                    <p className={styles.tabText}>
                        Excess energy per molecule of a particle with the solvated shape, split into surface, edge and
                        corner terms.
                    </p>
                    <Eq tex="\frac{E_\mathrm{excess}}{N} = a\,N^{-1/3} + b\,N^{-2/3} + c\,N^{-1}" />
                    <FiniteFigure result={result} extents={extents} />
                </>
            );
    }
}
