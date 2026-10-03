import React, { Suspense, lazy, useMemo, useState } from 'react';
import Admonition from '@theme/Admonition';
import BrowserOnly from '@docusaurus/BrowserOnly';
import {
    useContainerSize,
    useVizTheme,
    VizExplanation,
    VizPanel,
    VizPanelSection,
    VizPanelSplit,
    VizPlotHeader,
    VizSectionHeader,
    VizWorkbench,
} from '../shared/viz';
import {
    CollapsibleSection,
    ControlGroup,
    ControlHint,
    Legend,
    SegmentedControl,
    SliderWithInput,
    ToggleSwitch,
    VizButton,
} from '../shared/controls';
import MathFormula from '../MathFormula';
import {
    cubicWulff,
    extents,
    latticeFacets,
    orthorhombicWulff,
    smoothCubicWulff,
    smoothRectWulff2D,
    smoothWulff2D,
    wulff2D,
    LATTICE_FAMILIES,
    ORTHO_FAMILIES,
    type Lattice2D,
    type OrthoFamily,
} from './geometry';
import { GammaPlot, ShapePlot } from './Wulff2D';

const Wulff3D = lazy(() => import('./Wulff3D'));

type Mode = '2d' | '3d';
type Model = 'facets' | 'smooth';

const MODES = [
    { value: '2d' as const, label: '2D construction' },
    { value: '3d' as const, label: '3D crystal' },
];

const LATTICES = [
    { value: 'square' as const, label: 'Square' },
    { value: 'rectangular' as const, label: 'Rectangular', title: 'The 2D analogue of orthorhombic: a and b are not equivalent' },
    { value: 'hexagonal' as const, label: 'Hexagonal' },
];

const MODELS = [
    { value: 'facets' as const, label: 'Facets', title: 'A few low-index facets, each with its own energy' },
    { value: 'smooth' as const, label: 'Smooth γ', title: 'γ defined in every direction, with cusps at the lattice directions' },
];

/** Default γ per family, per lattice. */
const DEFAULT_2D: Record<Lattice2D, number[]> = {
    square: [1.2, 1.0],
    rectangular: [0.7, 1.4, 1.1],
    hexagonal: [1.2, 1.0],
};

/** Classic cubic shapes: [γ100, γ110, γ111]. */
const SHAPES_3D: { value: string; label: string; gammas: [number, number, number] }[] = [
    { value: 'cube', label: 'Cube', gammas: [1, 2, 2] },
    { value: 'octahedron', label: 'Octahedron', gammas: [2, 2, 1] },
    { value: 'truncated', label: 'Truncated octahedron', gammas: [1.12, 1.6, 1] },
    { value: 'cubo', label: 'Cuboctahedron', gammas: [1, 2, 2 / Math.sqrt(3)] },
    { value: 'dodeca', label: 'Rhombic dodecahedron', gammas: [2, 1, 2] },
];

type System = 'cubic' | 'ortho';
const SYSTEMS = [
    { value: 'cubic' as const, label: 'Cubic' },
    { value: 'ortho' as const, label: 'Orthorhombic' },
];

type OrthoGammas = Record<OrthoFamily, number>;
const HIGH = { '101': 3, '011': 3, '111': 3 };
/** Orthorhombic habits; the long axis is c (z). */
const SHAPES_ORTHO: { value: string; label: string; gammas: OrthoGammas }[] = [
    { value: 'needle', label: 'Needle', gammas: { '100': 0.5, '010': 0.5, '001': 2.6, '110': 0.55, ...HIGH } },
    { value: 'capped', label: 'Capped needle', gammas: { '100': 0.55, '010': 0.55, '001': 3, '110': 3, '101': 1.1, '011': 1.1, '111': 3 } },
    { value: 'lath', label: 'Lath', gammas: { '100': 0.35, '010': 1.0, '001': 2.4, '110': 3, ...HIGH } },
    { value: 'plate', label: 'Plate', gammas: { '100': 1.6, '010': 1.6, '001': 0.35, '110': 1.75, ...HIGH } },
    { value: 'brick', label: 'Brick', gammas: { '100': 0.8, '010': 1.2, '001': 1.6, '110': 3, ...HIGH } },
];
const MAIN_ORTHO: OrthoFamily[] = ['100', '010', '001'];
const MINOR_ORTHO: OrthoFamily[] = ['110', '101', '011', '111'];

/** Smooth-γ waypoints from liquid to crystal. */
const ANISOTROPY_STEPS = [
    { value: 0, label: 'Droplet' },
    { value: 0.15, label: 'Rounded' },
    { value: 0.5, label: 'Faceted' },
    { value: 2, label: 'Crystal' },
];

const CURVED = [1];
const NONE: number[] = [];

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const anisotropyHint = (eps: number) =>
    eps === 0
        ? 'ε = 0: every direction costs the same, like a liquid, so the shape is a circle or sphere.'
        : 'Directions at the cusps become flat facets; the rest of the surface stays curved.';

const WulffConstruction: React.FC<{ title: string }> = ({ title }) => {
    const theme = useVizTheme();
    const [mode, setMode] = useState<Mode>('2d');

    // ---- 2D state ----
    const [lattice, setLattice] = useState<Lattice2D>('square');
    const [model2D, setModel2D] = useState<Model>('facets');
    const [eps2D, setEps2D] = useState(0.15);
    const [bOverA, setBOverA] = useState(1.5);
    const [symmetric, setSymmetric] = useState(true);
    const [showConstruction, setShowConstruction] = useState(true);
    const familyNames2D = LATTICE_FAMILIES[lattice];
    const baseFacets = useMemo(() => latticeFacets(lattice, bOverA), [lattice, bOverA]);
    const [gammas, setGammas] = useState<number[]>(() => baseFacets.map((f) => DEFAULT_2D.square[f.family]));
    const smooth2D = model2D === 'smooth';
    const rect = lattice === 'rectangular';
    // Rectangular smooth model: two independent cusp energies, ε blends liquid (0) → broken-bond crystal (1).
    const [rectSmooth, setRectSmooth] = useState({ g10: 0.6, g01: 1.4, eps: 0.5 });

    const facets = useMemo(
        () => baseFacets.map((f, i) => ({ ...f, gamma: gammas[i] ?? DEFAULT_2D[lattice][f.family] })),
        [baseFacets, gammas, lattice],
    );
    const smooth = useMemo(() => {
        if (!smooth2D) return null;
        if (rect) return smoothRectWulff2D(rectSmooth.eps, rectSmooth.g10, rectSmooth.g01);
        return smoothWulff2D(eps2D, lattice === 'square' ? 4 : 6);
    }, [smooth2D, rect, rectSmooth, eps2D, lattice]);
    const view2D = smooth ?? { facets, shape: wulff2D(facets) };
    const legendNames2D = smooth ? (rect ? ['{10} facets', '{01} facets', 'curved'] : ['flat facets', 'curved']) : familyNames2D;
    const curvedFamily2D = rect ? 2 : 1;
    const familyLength = legendNames2D.map((_, fam) =>
        view2D.facets.reduce((s, f, i) => s + (f.family === fam ? view2D.shape.facetLength[i] : 0), 0),
    );
    const familyGamma = familyNames2D.map((_, fam) => facets.find((f) => f.family === fam)?.gamma ?? 1);

    const changeLattice = (l: Lattice2D) => {
        setLattice(l);
        setGammas(latticeFacets(l, bOverA).map((f) => DEFAULT_2D[l][f.family]));
    };
    const setFacetGamma = (index: number, g: number) => {
        const fam = facets[index].family;
        setGammas(facets.map((f, i) => (i === index || (symmetric && f.family === fam) ? g : f.gamma)));
    };
    const setFamilyGamma = (fam: number, g: number) => setGammas(facets.map((f) => (f.family === fam ? g : f.gamma)));

    // ---- 3D state ----
    const [system, setSystem] = useState<System>('cubic');
    const [model3D, setModel3D] = useState<Model>('facets');
    const [eps3D, setEps3D] = useState(0.15);
    const [g3, setG3] = useState<[number, number, number]>([1.12, 1.6, 1]);
    const [gOrtho, setGOrtho] = useState<OrthoGammas>(SHAPES_ORTHO[0].gammas);
    const [cell, setCell] = useState({ b: 1, c: 1 });
    const [showEdges, setShowEdges] = useState(true);
    const smooth3D = system === 'cubic' && model3D === 'smooth';
    const shape3D = useMemo(() => {
        if (system === 'ortho') return orthorhombicWulff(gOrtho, { a: 1, b: cell.b, c: cell.c });
        return smooth3D ? smoothCubicWulff(eps3D, 400) : cubicWulff(...g3);
    }, [system, smooth3D, eps3D, g3, gOrtho, cell]);
    const shapePreset = SHAPES_3D.find((s) => s.gammas.every((g, i) => Math.abs(g - g3[i]) < 1e-3))?.value ?? '';
    const orthoPreset =
        SHAPES_ORTHO.find((s) => ORTHO_FAMILIES.every((f) => Math.abs(s.gammas[f] - gOrtho[f]) < 1e-3))?.value ?? '';
    const dims = extents(shape3D);
    const sortedDims = [...dims].sort((x, y) => y - x);
    const aspect = sortedDims.map((v) => (v / sortedDims[2]).toFixed(1)).join(' : ');

    const colors2D = smooth && !rect ? [theme.series[0], theme.series[2]] : theme.series.slice(0, 3);
    const colors3D =
        system === 'ortho'
            ? theme.series.slice(0, ORTHO_FAMILIES.length)
            : smooth3D
              ? [theme.series[0], theme.series[2]]
              : [theme.series[0], theme.series[2], theme.series[1]];
    const families3D =
        system === 'ortho' ? ORTHO_FAMILIES.map((f) => `{${f}}`) : smooth3D ? ['{100} facets', 'curved'] : ['{100}', '{110}', '{111}'];

    const [plotRef, plotSize] = useContainerSize();
    const viewportCap = typeof window !== 'undefined' ? window.innerHeight - 300 : 520;
    const size2D = Math.max(220, Math.min(plotSize.width, viewportCap, 520));
    const [stageRef, stageSize] = useContainerSize();
    const width3D = stageSize.width;
    const height3D = Math.max(280, Math.min(Math.round(width3D * 0.7), viewportCap));

    const anisotropyControls = (eps: number, setEps: (v: number) => void, max = 2) => {
        // The broken-bond blend tops out at ε = 1 (a sharp crystal).
        const steps = max === 2 ? ANISOTROPY_STEPS : ANISOTROPY_STEPS.map((s, i) => (i === 3 ? { ...s, value: 1 } : s));
        return (
            <ControlGroup label="Anisotropy" hint={anisotropyHint(eps)}>
                <SegmentedControl<number> aria-label="Anisotropy preset" columns={2} value={eps} onChange={setEps} options={steps} />
                <SliderWithInput label="ε" value={eps} onChange={setEps} min={0} max={max} step={0.01} decimals={2} />
            </ControlGroup>
        );
    };

    const sidebar2D = (
        <VizPanel stack>
            <ControlGroup label="Lattice">
                <SegmentedControl<Lattice2D> aria-label="Lattice" value={lattice} onChange={changeLattice} options={LATTICES} />
                {rect && !smooth2D && (
                    <SliderWithInput label="b / a" value={bOverA} onChange={setBOverA} min={1} max={3} step={0.05} decimals={2} />
                )}
            </ControlGroup>
            <ControlGroup label="Surface energy model">
                <SegmentedControl<Model> aria-label="Surface energy model" value={model2D} onChange={setModel2D} options={MODELS} />
            </ControlGroup>
            {smooth2D && rect ? (
                <>
                    {anisotropyControls(rectSmooth.eps, (e) => setRectSmooth({ ...rectSmooth, eps: e }), 1)}
                    <ControlGroup label="Facet energies">
                        <SliderWithInput label="γ {10}" value={rectSmooth.g10} onChange={(g) => setRectSmooth({ ...rectSmooth, g10: g })} min={0.2} max={2} step={0.01} decimals={2} />
                        <SliderWithInput label="γ {01}" value={rectSmooth.g01} onChange={(g) => setRectSmooth({ ...rectSmooth, g01: g })} min={0.2} max={2} step={0.01} decimals={2} />
                        <ControlHint>Unequal energies along a and b give rounded needles and plates.</ControlHint>
                    </ControlGroup>
                </>
            ) : smooth2D ? (
                anisotropyControls(eps2D, setEps2D)
            ) : (
                <>
                    <ControlGroup label="Surface energies">
                        <ToggleSwitch label="Keep symmetry" checked={symmetric} onChange={setSymmetric} />
                        {symmetric ? (
                            familyNames2D.map((name, fam) => (
                                <SliderWithInput
                                    key={name}
                                    label={`γ ${name}`}
                                    value={familyGamma[fam]}
                                    onChange={(g) => setFamilyGamma(fam, g)}
                                    min={0.2} max={2} step={0.01} decimals={2}
                                />
                            ))
                        ) : (
                            <ControlHint>Drag the points on the γ-plot to change each facet on its own.</ControlHint>
                        )}
                        <VizButton
                            variant="secondary"
                            size="sm"
                            onClick={() => setGammas(baseFacets.map((f) => DEFAULT_2D[lattice][f.family]))}
                        >
                            Reset energies
                        </VizButton>
                    </ControlGroup>
                    <ToggleSwitch label="Construction lines" checked={showConstruction} onChange={setShowConstruction} />
                </>
            )}
            <ControlGroup label="Perimeter">
                <Legend
                    items={legendNames2D.map((name, fam) => ({
                        key: name,
                        label: `${name} ${pct(familyLength[fam] / view2D.shape.perimeter)}`,
                        color: colors2D[fam],
                    }))}
                />
            </ControlGroup>
        </VizPanel>
    );

    const sidebar3D = (
        <VizPanel stack>
            <ControlGroup label="Crystal system">
                <SegmentedControl<System> aria-label="Crystal system" value={system} onChange={setSystem} options={SYSTEMS} />
            </ControlGroup>
            {system === 'cubic' ? (
                <>
                    <ControlGroup label="Surface energy model">
                        <SegmentedControl<Model> aria-label="Surface energy model" value={model3D} onChange={setModel3D} options={MODELS} />
                    </ControlGroup>
                    {smooth3D ? (
                        anisotropyControls(eps3D, setEps3D)
                    ) : (
                        <>
                            <ControlGroup label="Shape">
                                <SegmentedControl
                                    aria-label="Shape preset"
                                    columns={1}
                                    value={shapePreset}
                                    onChange={(v) => setG3(SHAPES_3D.find((s) => s.value === v)!.gammas)}
                                    options={SHAPES_3D}
                                />
                            </ControlGroup>
                            <ControlGroup label="Surface energies">
                                {['{100}', '{110}', '{111}'].map((fam, i) => (
                                    <SliderWithInput
                                        key={fam}
                                        label={`γ ${fam}`}
                                        value={g3[i]}
                                        onChange={(g) => setG3(g3.map((x, j) => (j === i ? g : x)) as [number, number, number])}
                                        min={0.5} max={2} step={0.01} decimals={2}
                                    />
                                ))}
                            </ControlGroup>
                        </>
                    )}
                </>
            ) : (
                <>
                    <ControlGroup label="Habit" hint="The c axis points up in the default view.">
                        <SegmentedControl
                            aria-label="Habit preset"
                            columns={2}
                            value={orthoPreset}
                            onChange={(v) => setGOrtho(SHAPES_ORTHO.find((s) => s.value === v)!.gammas)}
                            options={SHAPES_ORTHO}
                        />
                    </ControlGroup>
                    <ControlGroup label="Surface energies">
                        {MAIN_ORTHO.map((fam) => (
                            <SliderWithInput
                                key={fam}
                                label={`γ {${fam}}`}
                                value={gOrtho[fam]}
                                onChange={(g) => setGOrtho({ ...gOrtho, [fam]: g })}
                                min={0.2} max={3} step={0.01} decimals={2}
                            />
                        ))}
                    </ControlGroup>
                    <CollapsibleSection title="Edge and corner facets">
                        {MINOR_ORTHO.map((fam) => (
                            <SliderWithInput
                                key={fam}
                                label={`γ {${fam}}`}
                                value={gOrtho[fam]}
                                onChange={(g) => setGOrtho({ ...gOrtho, [fam]: g })}
                                min={0.2} max={3} step={0.01} decimals={2}
                            />
                        ))}
                    </CollapsibleSection>
                    <CollapsibleSection title="Unit cell">
                        <SliderWithInput label="b / a" value={cell.b} onChange={(b) => setCell({ ...cell, b })} min={0.5} max={2} step={0.05} decimals={2} />
                        <SliderWithInput label="c / a" value={cell.c} onChange={(c) => setCell({ ...cell, c })} min={0.5} max={2} step={0.05} decimals={2} />
                        <ControlHint>Cell shape tilts the {'{110}'}, {'{101}'}, {'{011}'} and {'{111}'} normals.</ControlHint>
                    </CollapsibleSection>
                </>
            )}
            <ControlGroup label={`Shape · ${aspect}`}>
                <Legend
                    items={families3D
                        .map((fam, i) => ({
                            key: fam,
                            label: `${fam} ${pct(shape3D.familyArea[i] / shape3D.totalArea)}`,
                            color: colors3D[i],
                            area: shape3D.familyArea[i],
                        }))
                        .filter((it) => system === 'cubic' || it.area > 1e-9)}
                />
                <ControlHint>Surface area by facet family; ratio of longest to shortest dimension.</ControlHint>
            </ControlGroup>
            {!smooth3D && <ToggleSwitch label="Edges" checked={showEdges} onChange={setShowEdges} />}
        </VizPanel>
    );

    const aside2D = smooth2D ? (
        <>
            <Admonition type="tip" title="From droplet to crystal">
                Start at ε = 0, a liquid droplet, and raise the anisotropy: flat facets appear at the cusps and widen
                until the rounded corners disappear.
            </Admonition>
            <Admonition type="note" title="Cusps make facets">
                A flat facet only forms where γ(θ) has a sharp minimum. A smooth minimum, like a liquid's constant γ,
                gives a curved surface.
            </Admonition>
        </>
    ) : (
        <>
            <Admonition type="tip" title="Try this">
                {lattice === 'rectangular'
                    ? 'Make γ{01} much larger than γ{10}: the crystal stretches into a needle, the 2D version of an orthorhombic habit.'
                    : 'Raise γ{11} until its facets vanish: once a plane lies outside the corners of the others it no longer touches the shape, however you move it.'}
            </Admonition>
            <Admonition type="note" title="Reading the plot">
                The γ-plot and the shape share one scale. Each dashed line is drawn at distance γ from the centre,
                perpendicular to its spoke; the crystal is the region inside all of them.
            </Admonition>
        </>
    );

    const aside3D =
        system === 'ortho' ? (
            <>
                <Admonition type="tip" title="Needles and plates">
                    Make γ{'{001}'} much larger than γ{'{100}'} and γ{'{010}'}: the expensive ends shrink and the crystal
                    grows into a needle along c. Reverse it for a plate.
                </Admonition>
                <Admonition type="note" title="Why cubic crystals can't do this">
                    In a cubic crystal symmetry makes the x, y and z faces identical, so their energies are equal. Lower
                    symmetry lets each direction have its own energy.
                </Admonition>
            </>
        ) : smooth3D ? (
            <>
                <Admonition type="tip" title="From droplet to crystal">
                    At ε = 0 the shape is a sphere, like a liquid drop. Raise ε and flat {'{100}'} faces open up, joined
                    by rounded edges, until the shape becomes a cube.
                </Admonition>
                <Admonition type="note" title="Rounded crystals">
                    Real crystals look like this near their roughening temperature, where only the lowest-energy faces
                    stay flat.
                </Admonition>
            </>
        ) : (
            <>
                <Admonition type="tip" title="Try this">
                    Start from the octahedron and lower γ{'{100}'}: square facets appear at the corners, giving the
                    truncated octahedron typical of gold and platinum nanoparticles.
                </Admonition>
                <Admonition type="note" title="Cuboctahedron">
                    The {'{100}'} and {'{111}'} facets meet exactly at the vertices when γ{'{111}'}/γ{'{100}'} = 2/√3 ≈
                    1.155.
                </Admonition>
            </>
        );

    return (
        <>
            <VizWorkbench sidebar={mode === '2d' ? sidebar2D : sidebar3D}>
                <VizPanel flush>
                    <VizPanelSection style={{ paddingBottom: 0 }}>
                        <VizPlotHeader
                            title={title}
                            readout={<SegmentedControl<Mode> aria-label="Mode" value={mode} onChange={setMode} options={MODES} />}
                        />
                    </VizPanelSection>
                    {mode === '2d' ? (
                        <VizPanelSplit equal>
                            <VizPanelSection>
                                <VizSectionHeader title="Surface energy" detail={smooth ? 'γ(θ)' : 'γ(θ), drag to change'} />
                                <div ref={plotRef} style={{ display: 'grid', justifyItems: 'center' }}>
                                    {plotSize.width > 0 && (
                                        <GammaPlot
                                            size={size2D}
                                            facets={view2D.facets}
                                            colors={colors2D}
                                            onChange={setFacetGamma}
                                            curve={!!smooth}
                                            curvedFamily={curvedFamily2D}
                                        />
                                    )}
                                </div>
                            </VizPanelSection>
                            <VizPanelSection>
                                <VizSectionHeader title="Equilibrium shape" detail="minimises Σ γ·length" />
                                <div style={{ display: 'grid', justifyItems: 'center' }}>
                                    {plotSize.width > 0 && (
                                        <ShapePlot
                                            size={size2D}
                                            facets={view2D.facets}
                                            shape={view2D.shape}
                                            colors={colors2D}
                                            showConstruction={showConstruction && !smooth}
                                        />
                                    )}
                                </div>
                            </VizPanelSection>
                        </VizPanelSplit>
                    ) : (
                        <VizPanelSection>
                            <div ref={stageRef}>
                                {width3D > 0 && (
                                    <BrowserOnly fallback={<div style={{ height: height3D }} />}>
                                        {() => (
                                            <Suspense fallback={<div style={{ height: height3D }} />}>
                                                <Wulff3D
                                                    width={width3D}
                                                    height={height3D}
                                                    shape={shape3D}
                                                    colors={colors3D}
                                                    edgeColor={theme.text}
                                                    background={theme.surface}
                                                    showEdges={showEdges && !smooth3D}
                                                    curvedFamilies={smooth3D ? CURVED : NONE}
                                                />
                                            </Suspense>
                                        )}
                                    </BrowserOnly>
                                )}
                            </div>
                            <ControlHint>Drag to rotate, scroll to zoom.</ControlHint>
                        </VizPanelSection>
                    )}
                </VizPanel>
            </VizWorkbench>

            <VizExplanation aside={mode === '2d' ? aside2D : aside3D}>
                <h2>The Wulff construction</h2>
                <p>
                    At fixed volume, a crystal in equilibrium takes the shape with the lowest total surface energy,{' '}
                    <MathFormula math="\sum_i \gamma_i A_i" inline />, so expensive faces are kept small or removed.
                    Wulff's theorem gives that shape directly: it is the region inside every facet plane, with each
                    plane at a distance from the centre proportional to its surface energy,{' '}
                    <MathFormula math="h_i \propto \gamma_i" inline />.
                </p>
                <ul>
                    <li>Low-energy facets sit close to the centre, so they are cut largest.</li>
                    <li>High-energy facets sit further out and shrink, or vanish if other planes already enclose them.</li>
                    <li>A liquid has the same γ in every direction, so its shape is a circle or sphere.</li>
                </ul>
                <p>
                    Cubic crystals give cubes, octahedra, rhombic dodecahedra and everything in between. Lower-symmetry
                    crystals, such as orthorhombic ones (rectangular in 2D), give each axis its own energies, which is
                    how needles, laths and plates form. The same construction with growth rates in place of γ gives
                    the kinetic growth shape: there too the slowest-growing faces end up largest.
                </p>
            </VizExplanation>
        </>
    );
};

export default WulffConstruction;
