import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseScfIterations } from '@peterspackman/ce-calc/scf-iterations.js';
import { SegmentedControl, VizButton } from '../shared/controls';
import { VizPanel, useVizTheme } from '../shared/viz';
import type { Molecule } from './molecule';
import { lobePalette, type LobeColors } from './orbitalColors';
import { CalculationPanel } from './panels/CalculationPanel';
import { ConvergencePanel } from './panels/ConvergencePanel';
import { LogPanel } from './panels/LogPanel';
import { MoleculePanel } from './panels/MoleculePanel';
import { OrbitalsPanel } from './panels/OrbitalsPanel';
import { SummaryPanel } from './panels/SummaryPanel';
import { SurfacesPanel } from './panels/SurfacesPanel';
import { CHARGE_COLORMAP, ChargesPanel, type ChargeView } from './panels/ChargesPanel';
import { chargeToUnit, formatCharge, symmetricLimit } from './charges';
import { useCharges } from './useCharges';
import { useCe } from './runtime';
import { TabBar, activeTab, type TabOption } from './panels/TabBar';
import { VibrationsPanel, type ModePlayback } from './panels/VibrationsPanel';
import { lastScfBlock } from './scfBlocks';
import { DEFAULT_DISPLAY, DEFAULT_SETTINGS, modelLabel, type CalculationSettings, type DisplaySettings } from './settings';
import { useCalculation } from './useCalculation';
import { orbitalKey, useOrbitalVolumes, type OrbitalRef } from './useOrbitalVolumes';
import { useSurfaces } from './useSurfaces';
import { SIGNED_FIELD_KINDS, molecularSurfaceKinds } from './surfaceKinds';
import { Viewport, type ViewportHandle, type ViewportMesh, type ViewportSignedVolume, type ViewportSurface } from './Viewport';
import styles from './WavefunctionCalculator.module.css';

type InspectorTab = 'surfaces' | 'orbitals' | 'charges' | 'vibrations';
type OutputTab = 'summary' | 'convergence' | 'log';

const REPRESENTATIONS = [
    { value: 'ball+stick', label: 'Ball & stick' },
    { value: 'tube', label: 'Tube' },
    { value: 'spacefill', label: 'Spacefill' },
    { value: 'wireframe', label: 'Wire' },
] as const;

const NO_CHARGES: ChargeView = { scheme: null, labels: true, colour: false };

const NO_PLAYBACK: ModePlayback = { mode: null, playing: false, amplitude: 0.3, showVectors: false };

export default function WavefunctionCalculator({ occVersion }: { occVersion?: string }) {
    const theme = useVizTheme();
    const viewport = useRef<ViewportHandle>(null);
    const [molecule, setMolecule] = useState<Molecule | null>(null);
    const [settings, setSettings] = useState<CalculationSettings>(DEFAULT_SETTINGS);
    const [display, setDisplay] = useState<DisplaySettings>(DEFAULT_DISPLAY);
    const [inspectorTab, setInspectorTab] = useState<InspectorTab>('orbitals');
    const [outputTab, setOutputTab] = useState<OutputTab>('convergence');
    const [playback, setPlayback] = useState<ModePlayback>(NO_PLAYBACK);
    const [ranWith, setRanWith] = useState<Molecule | null>(null);
    const calculation = useCalculation();
    // A result only belongs on screen while the input is still what produced it.
    const result = calculation.result && ranWith === molecule ? calculation.result : null;
    const orbitals = useOrbitalVolumes(result, display.gridQuality);
    const isosurfaces = useSurfaces(result);
    const charges = useCharges(result, occVersion);
    const ce = useCe();
    const [chargeView, setChargeView] = useState<ChargeView>(NO_CHARGES);
    // Charges belong to a result: a new one starts with none drawn.
    const chargeResultId = result?.id;
    useEffect(() => setChargeView(NO_CHARGES), [chargeResultId]);

    const shownCharges = charges.sets.find((c) => c.id === chargeView.scheme);
    const atomLabels = useMemo(
        () => (shownCharges && chargeView.labels ? shownCharges.values.map((q) => formatCharge(q)) : null),
        [shownCharges, chargeView.labels],
    );
    const atomColorFn = useMemo(() => {
        if (!ce || !shownCharges || !chargeView.colour) return null;
        const limit = symmetricLimit(shownCharges.values);
        const values = shownCharges.values;
        return (i: number) => ce.viewer.evaluateColormap(CHARGE_COLORMAP, chargeToUnit(values[i] ?? 0, limit));
    }, [ce, shownCharges, chargeView.colour]);
    const running = calculation.phase === 'running';
    const structure = result?.structure ?? molecule?.data ?? null;

    const palette = useMemo(() => lobePalette(theme), [theme]);
    const colorsFor = useCallback(
        (o: OrbitalRef): LobeColors | undefined => {
            const i = orbitals.selected.findIndex((s) => orbitalKey(s) === orbitalKey(o));
            return i < 0 ? undefined : palette[i % palette.length];
        },
        [orbitals.selected, palette],
    );

    const surfaces = useMemo<ViewportSurface[]>(() => {
        const out: ViewportSurface[] = [];
        for (const o of orbitals.selected) {
            const entry = orbitals.entryFor(o);
            const colors = colorsFor(o);
            if (entry?.status === 'ready' && colors) out.push({ key: `${result?.id}:${orbitalKey(o)}`, volume: entry.volume, colors });
        }
        return out;
    }, [orbitals, colorsFor, result?.id]);

    const meshes = useMemo<ViewportMesh[]>(
        () =>
            isosurfaces.layers.flatMap((l) =>
                l.status === 'ready' && l.mesh ? [{ key: `${result?.id}:${l.id}`, mesh: l.mesh, property: l.property, opacity: l.opacity, visible: l.visible }] : [],
            ),
        [isosurfaces.layers, result?.id],
    );

    const signedVolumes = useMemo<ViewportSignedVolume[]>(
        () =>
            isosurfaces.layers.flatMap((l) =>
                l.status === 'ready' && l.volume
                    ? [
                          {
                              key: `${result?.id}:${l.id}`,
                              volume: l.volume,
                              isovalue: l.isovalue,
                              opacity: l.opacity,
                              visible: l.visible,
                              colors: SIGNED_FIELD_KINDS[l.kind]?.invertColours
                                  ? { positive: palette[0].negative, negative: palette[0].positive }
                                  : palette[0],
                          },
                      ]
                    : [],
            ),
        [isosurfaces.layers, result?.id, palette],
    );

    const scf = useMemo(() => lastScfBlock(parseScfIterations(calculation.log)), [calculation.log]);

    const onMolecule = useCallback((m: Molecule | null) => {
        setMolecule(m);
        if (m?.formalCharge !== undefined) setSettings((s) => ({ ...s, charge: m.formalCharge ?? 0 }));
    }, []);

    const run = () => {
        if (!molecule) return;
        setPlayback(NO_PLAYBACK);
        setRanWith(molecule);
        setInspectorTab(settings.frequencies ? 'vibrations' : 'orbitals');
        setOutputTab('convergence');
        void calculation.run(molecule, settings);
    };

    // Swap the live convergence plot for the numbers once a run finishes.
    const resultId = result?.id;
    useEffect(() => {
        if (resultId !== undefined) setOutputTab((t) => (t === 'convergence' ? 'summary' : t));
    }, [resultId]);

    const inspectorTabs: TabOption<InspectorTab>[] = [
        { value: 'orbitals', label: 'Orbitals' },
        { value: 'surfaces', label: 'Surfaces' },
        { value: 'charges', label: 'Charges' },
        { value: 'vibrations', label: 'Vibrations', disabled: !result?.vibrations && !result?.frequenciesCm },
    ];
    const outputTabs: TabOption<OutputTab>[] = [
        { value: 'summary', label: 'Results', disabled: !result },
        // Enabled while running, so the tabs don't blink off before occ's first output.
        { value: 'convergence', label: 'Convergence', disabled: !calculation.log && !running },
        { value: 'log', label: 'Log', disabled: !calculation.log && !running },
    ];
    const shownInspectorTab = activeTab(inspectorTab, inspectorTabs);
    const shownOutputTab = activeTab(outputTab, outputTabs);

    const energy = result?.wavefunction.totalEnergy;

    return (
        <div className={styles.workspace}>
            <div className={styles.inputs}>
                <MoleculePanel molecule={molecule} onMolecule={onMolecule} disabled={running} />
                <CalculationPanel
                    settings={settings}
                    onChange={setSettings}
                    molecule={molecule}
                    calculation={calculation}
                    onRun={run}
                    onCancel={calculation.cancel}
                />
            </div>

            <VizPanel
                className={styles.viewerPanel}
                bodyClassName={styles.viewerBody}
                flush
                title={molecule?.formula ?? 'No molecule'}
                subtitle={
                    result
                        ? `${modelLabel(result.settings.method, result.settings.basis)} · E = ${energy?.toFixed(6)} Eh`
                        : running
                          ? 'calculating…'
                          : undefined
                }
                actions={
                    <>
                        <SegmentedControl
                            value={display.representation}
                            onChange={(v) => setDisplay((d) => ({ ...d, representation: v }))}
                            options={REPRESENTATIONS}
                            aria-label="Representation"
                        />
                        <VizButton size="sm" variant="ghost" onClick={() => viewport.current?.fit()} title="Fit the molecule in view">
                            Fit
                        </VizButton>
                    </>
                }
            >
                <Viewport
                    ref={viewport}
                    structure={structure}
                    representation={display.representation}
                    surfaces={surfaces}
                    meshes={meshes}
                    signedVolumes={signedVolumes}
                    isovalue={display.isovalue}
                    opacity={display.opacity}
                    surfaceStyle={display.surfaceStyle}
                    mode={playback.mode}
                    playing={playback.playing}
                    amplitude={playback.amplitude}
                    showVectors={playback.showVectors}
                    atomLabels={atomLabels}
                    atomColorFn={atomColorFn}
                />
            </VizPanel>

            <VizPanel className={styles.inspector} bodyClassName={styles.inspectorPanelBody} flush>
                <TabBar<InspectorTab> value={shownInspectorTab} tabs={inspectorTabs} onChange={setInspectorTab} label="Inspect" />
                <div className={styles.tabBody} role="tabpanel">
                    {!result && (
                        <p className={styles.hint}>
                            {running
                                ? 'Orbitals appear here when the calculation finishes.'
                                : 'Choose a molecule and a method, then run. Surfaces, orbitals and vibrational modes appear here.'}
                        </p>
                    )}
                    {result && shownInspectorTab === 'surfaces' && (
                        <SurfacesPanel
                            layers={isosurfaces.layers}
                            onAdd={(kind, isovalue, separation) => {
                                const d = molecularSurfaceKinds().find((k) => k.value === kind);
                                if (d) isosurfaces.add(d, isovalue, separation);
                            }}
                            onUpdate={isosurfaces.update}
                            onRemove={isosurfaces.remove}
                        />
                    )}
                    {result && shownInspectorTab === 'charges' && (
                        <ChargesPanel
                            atoms={result.structure.atoms}
                            sets={charges.sets}
                            dmaState={charges.dmaState}
                            onComputeDma={charges.computeDma}
                            view={chargeView}
                            onView={setChargeView}
                        />
                    )}
                    {result && shownInspectorTab === 'orbitals' && (
                        <OrbitalsPanel
                            result={result}
                            isSelected={orbitals.isSelected}
                            entryFor={orbitals.entryFor}
                            colorsFor={colorsFor}
                            onToggle={orbitals.toggle}
                            onClear={orbitals.clear}
                            display={display}
                            onDisplay={setDisplay}
                        />
                    )}
                    {result && shownInspectorTab === 'vibrations' && (
                        <VibrationsPanel modes={result.vibrations} frequenciesCm={result.frequenciesCm} playback={playback} onPlayback={setPlayback} />
                    )}
                </div>
            </VizPanel>

            {calculation.phase !== 'idle' && (
                <VizPanel className={styles.output} bodyClassName={styles.outputBody} flush>
                    <TabBar<OutputTab> value={shownOutputTab} tabs={outputTabs} onChange={setOutputTab} label="Output" />
                    <div className={styles.outputTabBody} role="tabpanel">
                        {shownOutputTab === 'summary' && result && <SummaryPanel result={result} />}
                        {shownOutputTab === 'convergence' && <ConvergencePanel scf={scf} optimization={result?.optimization} />}
                        {shownOutputTab === 'log' && <LogPanel log={calculation.log} name={molecule?.data.name} />}
                        {!shownOutputTab && <p className={styles.hint}>Starting occ…</p>}
                    </div>
                </VizPanel>
            )}
        </div>
    );
}
