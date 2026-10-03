import React, { useMemo, useState } from 'react';
import Admonition from '@theme/Admonition';
import {
    useContainerSize,
    useVizTheme,
    VizExplanation,
    VizPanel,
    VizPanelSection,
    VizPlotHeader,
    VizSectionHeader,
    VizWorkbench,
} from '../shared/viz';
import {
    CollapsibleSection,
    ControlGroup,
    ControlHint,
    SegmentedControl,
    SliderWithInput,
} from '../shared/controls';
import MathFormula from '../MathFormula';
import { fill, nodeCount, solveHuckel, type Topology } from './huckel';
import { BandDiagram, OrbitalView } from './BandViews';

const TOPOLOGIES = [
    { value: 'chain' as const, label: 'Chain', title: 'Linear polyene: open ends' },
    { value: 'ring' as const, label: 'Ring', title: 'Cyclic polyene: periodic, like benzene' },
];

const FILLINGS = [
    { value: 'empty', label: 'Empty' },
    { value: 'half', label: 'Half' },
    { value: 'full', label: 'Full' },
];

const ORBITAL_PICKS = [
    { value: 'lowest', label: 'Lowest' },
    { value: 'homo', label: 'HOMO' },
    { value: 'lumo', label: 'LUMO' },
    { value: 'highest', label: 'Highest' },
];

const BandStructure: React.FC<{ title: string }> = ({ title }) => {
    const theme = useVizTheme();
    const [topology, setTopology] = useState<Topology>('chain');
    const [n, setN] = useState(10);
    const [electrons, setElectrons] = useState(10);
    const [delta, setDelta] = useState(0);
    const [beta, setBeta] = useState(-2.5);
    const [dosSigma, setDosSigma] = useState(0.15);
    const [selectedRaw, setSelected] = useState<number | null>(null);

    const result = useMemo(() => solveHuckel({ n, beta, delta, topology }), [n, beta, delta, topology]);
    const filling = useMemo(() => fill(result.energies, electrons), [result, electrons]);
    // Default to the HOMO; keep any explicit choice in range.
    const selected = Math.min(n - 1, selectedRaw ?? Math.max(0, filling.homo));
    const orbital = result.orbitals[selected];

    const changeN = (next: number) => {
        const m = Math.round(Math.max(topology === 'ring' ? 3 : 2, next));
        // Stay half-filled (neutral) if we were; otherwise keep the count in range.
        setElectrons(electrons === n ? m : Math.min(electrons, 2 * m));
        setN(m);
        setSelected(null);
    };

    const fillingValue = electrons === 0 ? 'empty' : electrons === n ? 'half' : electrons === 2 * n ? 'full' : '';
    const dopingText =
        electrons === n
            ? 'Half-filled: one electron per atom, as in a neutral polyene.'
            : electrons > n
              ? `n-doped: ${electrons - n} extra electron${electrons - n === 1 ? '' : 's'}.`
              : `p-doped: ${n - electrons} hole${n - electrons === 1 ? '' : 's'}.`;

    const pickValue =
        selected === 0 ? 'lowest' : selected === filling.homo ? 'homo' : selected === filling.lumo ? 'lumo' : selected === n - 1 ? 'highest' : '';
    const pick = (v: string) =>
        setSelected(v === 'lowest' ? 0 : v === 'homo' ? Math.max(0, filling.homo) : v === 'lumo' ? Math.max(0, filling.lumo) : n - 1);

    const gapText = filling.homo < 0 || filling.lumo < 0 ? 'no HOMO–LUMO pair' : filling.gap > 1e-6 ? `gap ${filling.gap.toFixed(2)} eV` : 'no gap (metallic)';

    const [stageRef, stage] = useContainerSize();
    const diagramHeight = Math.round(Math.max(320, Math.min(460, stage.width * 0.5)));
    const orbitalHeight = topology === 'ring' ? Math.min(320, Math.max(220, stage.width * 0.35)) : 130;

    const sidebar = (
        <VizPanel stack>
            <ControlGroup label="Molecule">
                <SegmentedControl<Topology>
                    aria-label="Topology"
                    value={topology}
                    onChange={(t) => {
                        setTopology(t);
                        if (t === 'ring' && n < 3) changeN(3);
                        setSelected(null);
                    }}
                    options={TOPOLOGIES}
                />
                <SliderWithInput label="Atoms N" value={n} onChange={changeN} min={2} max={100} step={1} decimals={0} />
                <ControlHint>Increase N to watch the levels fill in the band.</ControlHint>
            </ControlGroup>
            <ControlGroup label="Electrons">
                <SegmentedControl
                    aria-label="Filling"
                    value={fillingValue}
                    onChange={(v) => setElectrons(v === 'empty' ? 0 : v === 'half' ? n : 2 * n)}
                    options={FILLINGS}
                />
                <SliderWithInput
                    label="Electrons"
                    value={electrons}
                    onChange={(v) => setElectrons(Math.round(v))}
                    min={0} max={2 * n} step={1} decimals={0}
                />
                <ControlHint>{dopingText}</ControlHint>
            </ControlGroup>
            <ControlGroup label="Bonds">
                <SliderWithInput label="Alternation δ" value={delta} onChange={setDelta} min={0} max={0.5} step={0.01} decimals={2} />
                <ControlHint>
                    {delta === 0
                        ? 'δ = 0: every bond is the same, as in an idealised chain.'
                        : `Bonds alternate between short (β×${(1 + delta).toFixed(2)}) and long (β×${(1 - delta).toFixed(2)}), like the double and single bonds of polyacetylene. Thick lines in the orbital view are the short bonds.`}
                </ControlHint>
                <SliderWithInput label="Hopping β" value={beta} onChange={setBeta} min={-4} max={-0.5} step={0.1} decimals={1} unit="eV" />
            </ControlGroup>
            <ControlGroup label="Orbital">
                <SegmentedControl aria-label="Orbital" columns={2} value={pickValue} onChange={pick} options={ORBITAL_PICKS} />
                <ControlHint>Or click any level or point in the diagram.</ControlHint>
            </ControlGroup>
            <CollapsibleSection title="Display">
                <SliderWithInput label="DOS broadening" value={dosSigma} onChange={setDosSigma} min={0.02} max={0.6} step={0.01} decimals={2} unit="eV" />
            </CollapsibleSection>
        </VizPanel>
    );

    return (
        <>
            <VizWorkbench sidebar={sidebar}>
                <VizPanel flush>
                    <VizPanelSection>
                        <VizPlotHeader
                            title={title}
                            readout={`${topology === 'ring' ? 'Ring' : 'Chain'} of ${n} · ${electrons} electrons · ${gapText}`}
                        />
                        <div ref={stageRef}>
                            {stage.width > 0 && (
                                <BandDiagram
                                    width={stage.width}
                                    height={diagramHeight}
                                    energies={result.energies}
                                    occupation={filling.occupation}
                                    fermi={filling.fermi}
                                    selected={selected}
                                    onSelect={setSelected}
                                    beta={beta}
                                    delta={delta}
                                    topology={topology}
                                    dosSigma={dosSigma}
                                    theme={theme}
                                />
                            )}
                        </div>
                    </VizPanelSection>
                    <VizPanelSection>
                        <VizSectionHeader
                            title={`Orbital ${selected + 1}`}
                            detail={`E = ${result.energies[selected].toFixed(2)} eV · ${nodeCount(orbital, topology === 'ring')} sign changes · ${filling.occupation[selected]} electron${filling.occupation[selected] === 1 ? '' : 's'}`}
                        />
                        {stage.width > 0 && (
                            <OrbitalView
                                width={stage.width}
                                height={orbitalHeight}
                                coefficients={orbital}
                                bonds={result.bonds}
                                topology={topology}
                                theme={theme}
                            />
                        )}
                    </VizPanelSection>
                </VizPanel>
            </VizWorkbench>

            <VizExplanation
                aside={
                    <>
                        <Admonition type="tip" title="Try this">
                            Slide N from 2 to 100. Each level sits on the same curve E(k); as N grows they crowd together
                            until the band is effectively continuous, with total width 4|β|.
                        </Admonition>
                        <Admonition type="note" title="Rings: 4n + 2">
                            Switch to a ring with 6 atoms (benzene): the 6 π electrons fill a closed shell. With 4 atoms
                            (cyclobutadiene) the last two electrons half-fill a degenerate pair, so there is no gap.
                        </Admonition>
                        <Admonition type="info" title="Peierls distortion">
                            A half-filled band is metallic. Alternating the bonds opens a gap at k = π/2, exactly at the
                            Fermi level, which lowers the energy of the filled states. This is why polyacetylene is a
                            semiconductor.
                        </Admonition>
                    </>
                }
            >
                <h2>From molecular orbitals to bands</h2>
                <p>
                    In the Hückel model each atom contributes one π orbital, and neighbouring atoms couple through the
                    hopping integral β. For a chain of N atoms the orbital energies are{' '}
                    <MathFormula math="E_j = \alpha + 2\beta\cos\left(\frac{j\pi}{N+1}\right)" inline />, j = 1 … N.
                </p>
                <p>
                    Read j as a wavevector <MathFormula math="k = j\pi/(N+1)" inline /> and every finite molecule's levels
                    lie on one curve, the band of the infinite chain,{' '}
                    <MathFormula math="E(k) = \alpha + 2\beta\cos k" inline />. More atoms just sample that curve more
                    finely, so discrete levels become a continuous band.
                </p>
                <h3>Bond alternation δ</h3>
                <p>
                    Real conjugated chains don't have equal bonds: polyacetylene alternates short double bonds and
                    long single bonds. The model captures this with two hopping integrals,{' '}
                    <MathFormula math="\beta_{1,2} = \beta(1 \pm \delta)" inline />, alternating along the chain. The
                    unit cell now holds two atoms, so the band splits in two:
                </p>
                <p style={{ textAlign: 'center' }}>
                    <MathFormula math="E_\pm(k) = \alpha \pm \sqrt{\beta_1^2 + \beta_2^2 + 2\beta_1\beta_2\cos 2k}" inline />
                </p>
                <p>
                    with a gap of <MathFormula math="2|\beta_1 - \beta_2| = 4|\beta|\delta" inline /> at k = π/2. At half
                    filling that gap sits exactly at the Fermi level, so the chain turns from a metal into a
                    semiconductor.
                </p>
                <ul>
                    <li>The lowest orbital has no sign changes (bonding everywhere); the highest changes sign at every bond.</li>
                    <li>Each level holds two electrons. With one electron per atom the band is half full.</li>
                    <li>The density of states piles up at the band edges, where E(k) is flat.</li>
                </ul>
            </VizExplanation>
        </>
    );
};

export default BandStructure;
