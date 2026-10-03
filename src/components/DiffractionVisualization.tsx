import React, { useState, useMemo, useEffect } from 'react';
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
} from './shared/viz';
import { SegmentedControl, SliderWithInput, ToggleSwitch } from './shared/controls';

import { PowderPattern } from './diffraction/PowderPattern';
import { ReciprocalLattice } from './diffraction/ReciprocalLattice';
import { ElectronDensity } from './diffraction/ElectronDensity';
import { DiffractionControls } from './diffraction/DiffractionControls';
import { calculatePowderPattern, CU_K_ALPHA, FORM_FACTOR_COEFFS } from './diffraction/physics';
import type { ControlPoint } from './diffraction/physics';
import { Viewer3D } from './Viewer3D';
import { STRUCTURES } from './diffraction/structures';
import type { ControlTheme } from './shared/controls';
import MathFormula from './MathFormula';

function generateFormFactorPoints(element: string, numPoints = 8): ControlPoint[] {
    const coeffs = FORM_FACTOR_COEFFS[element] || FORM_FACTOR_COEFFS.C;
    const sMax = 1.5;
    const points: ControlPoint[] = [];
    for (let i = 0; i < numPoints; i++) {
        const s = (i / (numPoints - 1)) * sMax;
        const s2 = s * s;
        let f = coeffs[8];
        for (let j = 0; j < 4; j++) {
            f += coeffs[2 * j] * Math.exp(-coeffs[2 * j + 1] * s2);
        }
        points.push({ s, f });
    }
    return points;
}

interface DiffractionVisualizationProps {
    title: string;
}

const REAL_VIEWS = [
    { value: 'density' as const, label: 'Density', title: 'Electron density on a plane through the cell' },
    { value: '3d' as const, label: '3D', title: 'Rotating 3D structure' },
];
const RECIPROCAL_VIEWS = [
    { value: 'lattice' as const, label: 'Lattice', title: 'Reciprocal-lattice layer perpendicular to the zone axis' },
    { value: 'detector' as const, label: 'Detector', title: 'What a flat detector records' },
    { value: 'pxrd' as const, label: 'Powder', title: 'Powder diffraction pattern' },
];
const SLICE_PRESETS = [
    { value: 0, label: '0' },
    { value: 0.25, label: '¼' },
    { value: 0.5, label: '½' },
];
const DENSITY_MODES = [
    { value: 'magnitude' as const, label: '|ρ|', title: 'Magnitude' },
    { value: 'signed' as const, label: '±ρ', title: 'Signed (shows Fourier ripples)' },
];

const DiffractionVisualizationInner: React.FC<DiffractionVisualizationProps> = ({ title }) => {
    // Dark mode support
    const vizTheme = useVizTheme();
    const isDark = vizTheme.isDark;

    // Theme-aware colors - memoized to prevent child re-renders
    const theme: ControlTheme = vizTheme.controls;

    // State
    const [structureId, setStructureId] = useState('NaCl');
    const [wavelength, setWavelength] = useState(CU_K_ALPHA);
    const [twoThetaMax, setTwoThetaMax] = useState(120);
    const [peakWidth, setPeakWidth] = useState(0.8);
    const [showPeakMarkers, setShowPeakMarkers] = useState(true);
    const [zoneAxis, setZoneAxis] = useState<[number, number, number]>([0, 0, 1]);
    const [maxIndex, setMaxIndex] = useState(8);
    const [showAbsences, setShowAbsences] = useState(true);
    const [detectorDistance, setDetectorDistance] = useState(100);
    const [showIndexingCircles, setShowIndexingCircles] = useState(false);
    const [slicePosition, setSlicePosition] = useState(0);
    const [noise, setNoise] = useState(0);
    const [bFactor, setBFactor] = useState(1.5);
    const [densityDisplayMode, setDensityDisplayMode] = useState<'magnitude' | 'signed'>('magnitude');
    const [showAtomsOnSlice, setShowAtomsOnSlice] = useState(true);
    const [detectorLimited, setDetectorLimited] = useState(false);
    const [showBonds, setShowBonds] = useState(true);
    const [showLabels, setShowLabels] = useState(true);
    const [selectedReflection, setSelectedReflection] = useState<[number, number, number] | null>(null);
    const [formFactors, setFormFactors] = useState<Record<string, ControlPoint[]>>({});

    // Tab states - default to density slice and lattice view
    const [realSpaceView, setRealSpaceView] = useState<'3d' | 'density'>('density');
    const [reciprocalView, setReciprocalView] = useState<'lattice' | 'detector' | 'pxrd'>('lattice');

    // Each half measures its own width; views are square and capped to the viewport.
    const [realSpaceRef, realSpaceSize] = useContainerSize();
    const [reciprocalRef, reciprocalSize] = useContainerSize();
    const viewportCap = typeof window !== 'undefined' ? window.innerHeight - 300 : 560;

    // Get current structure
    const structure = useMemo(
        () => STRUCTURES[structureId] || STRUCTURES.NaCl,
        [structureId]
    );

    // Initialize form factors for structure elements
    useEffect(() => {
        const elements = [...new Set(structure.atoms.map(a => a.element))];
        setFormFactors(prev => {
            const updated = { ...prev };
            for (const el of elements) {
                if (!updated[el]) {
                    updated[el] = generateFormFactorPoints(el);
                }
            }
            return updated;
        });
    }, [structure]);

    // Calculate reflections (with B-factor for thermal damping)
    const baseReflections = useMemo(
        () =>
            calculatePowderPattern({
                wavelength,
                structure,
                maxHKL: maxIndex,
                twoThetaMax,
                bFactor,
            }),
        [wavelength, structure, maxIndex, twoThetaMax, bFactor]
    );

    // Add noise to reflection intensities
    // Use a seeded random to ensure consistent noise for same noise level
    const reflections = useMemo(() => {
        if (noise === 0) return baseReflections;

        // Simple seeded random number generator
        const seededRandom = (seed: number) => {
            const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
            return x - Math.floor(x);
        };

        return baseReflections.map((ref, i) => {
            // Add noise proportional to sqrt(intensity) - Poisson-like counting statistics
            const noiseScale = Math.sqrt(ref.intensity) * noise * 0.5;
            const randomVal = (seededRandom(i * 1000 + noise * 10000) - 0.5) * 2;
            const noisyIntensity = Math.max(0, ref.intensity + randomVal * noiseScale);

            return {
                ...ref,
                intensity: noisyIntensity,
            };
        });
    }, [baseReflections, noise]);

    const realSize = Math.max(200, Math.min(realSpaceSize.width, viewportCap));
    const recipSquare = Math.max(200, Math.min(reciprocalSize.width, viewportCap));
    // The powder pattern is a plot, not an image: use the full width at 4:3.
    const recipWidth = reciprocalView === 'pxrd' ? Math.max(200, reciprocalSize.width) : recipSquare;
    const recipHeight = reciprocalView === 'pxrd' ? Math.min(recipSquare, Math.round(recipWidth * 0.75)) : recipSquare;
    const sliceLabel = `[${zoneAxis.join('')}] · d = ${slicePosition.toFixed(2)}`;

    const sidebar = (
        <VizPanel stack>
            <DiffractionControls
                structureId={structureId}
                onStructureChange={setStructureId}
                structure={structure}
                wavelength={wavelength}
                onWavelengthChange={setWavelength}
                twoThetaMax={twoThetaMax}
                onTwoThetaMaxChange={setTwoThetaMax}
                peakWidth={peakWidth}
                onPeakWidthChange={setPeakWidth}
                showPeakMarkers={showPeakMarkers}
                onShowPeakMarkersChange={setShowPeakMarkers}
                zoneAxis={zoneAxis}
                onZoneAxisChange={setZoneAxis}
                maxIndex={maxIndex}
                onMaxIndexChange={setMaxIndex}
                showAbsences={showAbsences}
                onShowAbsencesChange={setShowAbsences}
                realSpaceView={realSpaceView}
                reciprocalView={reciprocalView}
                detectorDistance={detectorDistance}
                onDetectorDistanceChange={setDetectorDistance}
                showIndexingCircles={showIndexingCircles}
                onShowIndexingCirclesChange={setShowIndexingCircles}
                noise={noise}
                onNoiseChange={setNoise}
                bFactor={bFactor}
                onBFactorChange={setBFactor}
                showBonds={showBonds}
                onShowBondsChange={setShowBonds}
                showLabels={showLabels}
                onShowLabelsChange={setShowLabels}
                formFactors={formFactors}
                onFormFactorsChange={setFormFactors}
                theme={theme}
            />
        </VizPanel>
    );

    return (
        <>
            <VizWorkbench sidebar={sidebar}>
                <VizPanel flush>
                    <VizPanelSection style={{ paddingBottom: 0 }}>
                        <VizPlotHeader
                            title={title}
                            readout={`${structure.name} · λ = ${wavelength.toFixed(4)} Å`}
                        />
                    </VizPanelSection>
                    <VizPanelSplit equal>
                        <VizPanelSection>
                            <VizSectionHeader
                                title="Real space"
                                detail={realSpaceView === 'density' ? sliceLabel : undefined}
                                actions={
                                    <SegmentedControl<'3d' | 'density'> aria-label="Real-space view" value={realSpaceView} onChange={setRealSpaceView} options={REAL_VIEWS} />
                                }
                            />
                            <div ref={realSpaceRef} style={{ display: 'grid', justifyItems: 'center', gap: '0.75rem' }}>
                                {realSpaceSize.width > 0 &&
                                    (realSpaceView === '3d' ? (
                                        <Viewer3D
                                            width={realSize}
                                            height={realSize}
                                            structure={structure}
                                            representation={showBonds ? 'ball+stick' : 'spacefill'}
                                            showUnitCell={true}
                                            showAxes={showLabels}
                                            supercell={[2, 2, 2]}
                                            supercellOrigin={[-1, -1, -1]}
                                            slicePlane={{ zoneAxis, position: slicePosition, showPlane: true }}
                                            millerPlanes={selectedReflection ? { hkl: selectedReflection, structure } : undefined}
                                            autoRotate={true}
                                            theme={theme}
                                        />
                                    ) : (
                                        <ElectronDensity
                                            width={realSize}
                                            height={realSize}
                                            structure={structure}
                                            wavelength={wavelength}
                                            slicePosition={slicePosition}
                                            zoneAxis={zoneAxis}
                                            maxHKL={maxIndex}
                                            twoThetaMax={twoThetaMax}
                                            detectorLimited={detectorLimited}
                                            theme={theme}
                                            formFactors={formFactors}
                                            bFactor={bFactor}
                                            noise={noise}
                                            displayMode={densityDisplayMode}
                                            showAtoms={showAtomsOnSlice}
                                        />
                                    ))}
                                {realSpaceView === 'density' && (
                                    <div style={{ width: '100%', maxWidth: realSize, display: 'grid', gap: '0.5rem' }}>
                                        <SliderWithInput
                                            label="Slice position"
                                            value={slicePosition}
                                            onChange={setSlicePosition}
                                            min={0} max={1} step={0.01} decimals={2}
                                        />
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                                            <SegmentedControl<number>
                                                aria-label="Slice preset"
                                                value={slicePosition}
                                                onChange={setSlicePosition}
                                                options={SLICE_PRESETS}
                                            />
                                            <SegmentedControl<'magnitude' | 'signed'>
                                                aria-label="Density display"
                                                value={densityDisplayMode}
                                                onChange={setDensityDisplayMode}
                                                options={DENSITY_MODES}
                                            />
                                        </div>
                                        <ToggleSwitch label="Atom positions" checked={showAtomsOnSlice} onChange={setShowAtomsOnSlice} />
                                        <ToggleSwitch
                                            label={`Only reflections the detector sees (2θ ≤ ${twoThetaMax}°)`}
                                            checked={detectorLimited}
                                            onChange={setDetectorLimited}
                                        />
                                    </div>
                                )}
                            </div>
                        </VizPanelSection>

                        <VizPanelSection>
                            <VizSectionHeader
                                title="Reciprocal space"
                                detail={reciprocalView !== 'pxrd' ? `[${zoneAxis.join('')}]` : undefined}
                                actions={
                                    <SegmentedControl<'lattice' | 'detector' | 'pxrd'> aria-label="Reciprocal-space view" value={reciprocalView} onChange={setReciprocalView} options={RECIPROCAL_VIEWS} />
                                }
                            />
                            <div ref={reciprocalRef} style={{ display: 'grid', justifyItems: 'center' }}>
                                {reciprocalSize.width > 0 &&
                                    (reciprocalView === 'pxrd' ? (
                                        <PowderPattern
                                            width={recipWidth}
                                            height={recipHeight}
                                            reflections={reflections}
                                            wavelength={wavelength}
                                            peakWidth={peakWidth}
                                            twoThetaRange={[5, twoThetaMax]}
                                            selectedReflection={selectedReflection}
                                            onSelectReflection={setSelectedReflection}
                                            showMarkers={showPeakMarkers}
                                            theme={theme}
                                        />
                                    ) : (
                                        <ReciprocalLattice
                                            width={recipSquare}
                                            height={recipSquare}
                                            structure={structure}
                                            reflections={reflections}
                                            zoneAxis={zoneAxis}
                                            maxIndex={maxIndex}
                                            showAbsences={showAbsences}
                                            selectedReflection={selectedReflection}
                                            onSelectReflection={setSelectedReflection}
                                            theme={theme}
                                            viewMode={reciprocalView === 'detector' ? 'detector' : 'reciprocal'}
                                            wavelength={wavelength}
                                            detectorDistance={detectorDistance}
                                            twoThetaMax={twoThetaMax}
                                            bFactor={bFactor}
                                            showIndexingCircles={showIndexingCircles}
                                            onShowIndexingCirclesChange={setShowIndexingCircles}
                                        />
                                    ))}
                            </div>
                        </VizPanelSection>
                    </VizPanelSplit>
                </VizPanel>
            </VizWorkbench>

            <VizExplanation
                aside={
                    <>
                        <Admonition type="tip" title="Try this">
                            Compare NaCl (face-centred) with diamond to see different systematic absences, then step the
                            density slice through the cell to watch atoms come in and out of the plane.
                        </Admonition>
                        <Admonition type="info" title="Click a reflection">
                            Selecting a spot in reciprocal space or a peak in the powder pattern highlights its lattice
                            planes in the 3D view.
                        </Admonition>
                    </>
                }
            >
                <h2>X-ray diffraction and crystal structure</h2>
                <p>
                    X-rays scattered by the electrons in a crystal interfere, so they only emerge in particular
                    directions. Those directions map out the reciprocal lattice; their intensities encode where the atoms
                    are. The density view rebuilds the electron density from the reflections by an inverse Fourier sum.
                </p>
                <ul>
                    <li>
                        <strong>Bragg's law</strong> <MathFormula math="n\lambda = 2d\sin\theta" inline /> sets the angle of
                        each reflection.
                    </li>
                    <li>
                        <strong>d-spacing</strong> for a cubic cell:{' '}
                        <MathFormula math="d_{hkl} = \frac{a}{\sqrt{h^2 + k^2 + l^2}}" inline />
                    </li>
                    <li>
                        <strong>Structure factor</strong>{' '}
                        <MathFormula math="F_{hkl} = \sum_j f_j \exp[2\pi i(hx_j + ky_j + lz_j)]" inline /> sets each
                        intensity, <MathFormula math="I \propto |F_{hkl}|^2" inline />.
                    </li>
                </ul>
                <h3>Systematic absences</h3>
                <p>
                    Lattice centring and symmetry make some structure factors cancel exactly. In a face-centred lattice
                    like NaCl, reflections only appear when h, k and l are all odd or all even; the missing ones are
                    drawn as crossed circles in the reciprocal-lattice view.
                </p>
            </VizExplanation>
        </>
    );
};

// Wrap with BrowserOnly for SSR safety
const DiffractionVisualization: React.FC<DiffractionVisualizationProps> = (props) => (
    <BrowserOnly fallback={<div style={{ minHeight: 560 }} />}>{() => <DiffractionVisualizationInner {...props} />}</BrowserOnly>
);

export default DiffractionVisualization;
