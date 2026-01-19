import React, { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { useColorMode } from '@docusaurus/theme-common';
import BrowserOnly from '@docusaurus/BrowserOnly';
import styles from './diffraction/DiffractionVisualization.module.css';

import { PowderPattern } from './diffraction/PowderPattern';
import { ReciprocalLattice } from './diffraction/ReciprocalLattice';
import { ElectronDensity } from './diffraction/ElectronDensity';
import { DiffractionControls } from './diffraction/DiffractionControls';
import { calculatePowderPattern, CU_K_ALPHA } from './diffraction/physics';
import { Viewer3D } from './Viewer3D';
import { STRUCTURES } from './diffraction/structures';
import type { ControlTheme } from './shared/controls';
import MathFormula from './MathFormula';

// Type for control points in form factor editor
interface ControlPoint {
    s: number;
    f: number;
}

// Cromer-Mann coefficients for generating initial form factors
const CROMER_MANN_COEFFS: Record<string, number[]> = {
    H: [0.489918, 20.6593, 0.262003, 7.74039, 0.196767, 49.5519, 0.049879, 2.20159, 0.001305],
    C: [2.31, 20.8439, 1.02, 10.2075, 1.5886, 0.5687, 0.865, 51.6512, 0.2156],
    N: [12.2126, 0.0057, 3.1322, 9.8933, 2.0125, 28.9975, 1.1663, 0.5826, -11.529],
    O: [3.0485, 13.2771, 2.2868, 5.7011, 1.5463, 0.3239, 0.867, 32.9089, 0.2508],
    Na: [4.7626, 3.285, 3.1736, 8.8422, 1.2674, 0.3136, 1.1128, 129.424, 0.676],
    Cl: [11.4604, 0.0104, 7.1964, 1.1662, 6.2556, 18.5194, 1.6455, 47.7784, -9.5574],
    Si: [6.2915, 2.4386, 3.0353, 32.3337, 1.9891, 0.6785, 1.541, 81.6937, 1.1407],
    Fe: [11.7695, 4.7611, 7.3573, 0.3072, 3.5222, 15.3535, 2.3045, 76.8805, 1.0369],
    Ca: [8.6266, 10.4421, 7.3873, 0.6599, 1.5899, 85.7484, 1.0211, 178.437, 1.3751],
    Ti: [9.7595, 7.8508, 7.3558, 0.5, 1.6991, 35.6338, 1.9021, 116.105, 1.2807],
    Cs: [20.3892, 3.569, 19.1062, 0.3107, 10.662, 24.3879, 1.4953, 213.904, 3.3352],
    Ba: [20.1807, 3.21, 19.1136, 0.2855, 10.9054, 20.0558, 0.7763, 51.746, 3.029],
    K: [8.2186, 12.7949, 7.4398, 0.7748, 1.0519, 213.187, 0.8659, 41.6841, 1.4228],
    I: [20.1472, 4.347, 18.9949, 0.3814, 7.5138, 27.766, 2.2735, 66.8776, 4.0712],
};

function generateFormFactorPoints(element: string, numPoints = 8): ControlPoint[] {
    const coeffs = CROMER_MANN_COEFFS[element] || CROMER_MANN_COEFFS.C;
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

// Hook to measure container dimensions
function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
    const [size, setSize] = useState({ width: 400, height: 400 });

    useLayoutEffect(() => {
        const updateSize = () => {
            if (ref.current) {
                const rect = ref.current.getBoundingClientRect();
                setSize({
                    width: Math.max(200, Math.floor(rect.width)),
                    height: Math.max(200, Math.floor(rect.height)),
                });
            }
        };

        updateSize();

        const resizeObserver = new ResizeObserver(updateSize);
        if (ref.current) {
            resizeObserver.observe(ref.current);
        }

        return () => resizeObserver.disconnect();
    }, [ref]);

    return size;
}

interface DiffractionVisualizationProps {
    className?: string;
}

const DiffractionVisualizationInner: React.FC<DiffractionVisualizationProps> = ({
    className,
}) => {
    // Dark mode support
    const { colorMode } = useColorMode();
    const isDark = colorMode === 'dark';

    // Theme-aware colors - memoized to prevent child re-renders
    const theme = useMemo<ControlTheme>(() => ({
        background: isDark ? '#2d2d2d' : '#f8f9fa',
        surface: isDark ? '#3d3d3d' : '#ffffff',
        border: isDark ? '#555' : '#e0e0e0',
        text: isDark ? '#e0e0e0' : '#333',
        textMuted: isDark ? '#999' : '#666',
        accent: isDark ? '#6b9eff' : '#2563eb',
        inputBg: isDark ? '#4a4a4a' : '#f3f4f6',
    }), [isDark]);

    // State
    const [structureId, setStructureId] = useState('NaCl');
    const [wavelength, setWavelength] = useState(CU_K_ALPHA);
    const [twoThetaMax, setTwoThetaMax] = useState(140);
    const [peakWidth, setPeakWidth] = useState(0.8);
    const [showPeakLabels, setShowPeakLabels] = useState(true);
    const [reciprocalPlane, setReciprocalPlane] = useState<'hk0' | 'h0l' | '0kl'>('hk0');
    const [maxIndex, setMaxIndex] = useState(8);
    const [showAbsences, setShowAbsences] = useState(true);
    const [oscillationRange, setOscillationRange] = useState(5);
    const [detectorDistance, setDetectorDistance] = useState(100);
    const [slicePosition, setSlicePosition] = useState(0);
    const [sliceAxis, setSliceAxis] = useState<'x' | 'y' | 'z'>('z');
    const [densityResolution, setDensityResolution] = useState(64);
    const [showContours, setShowContours] = useState(true);
    const [noise, setNoise] = useState(0);
    const [bFactor, setBFactor] = useState(1.5);
    const [densityDisplayMode, setDensityDisplayMode] = useState<'magnitude' | 'signed'>('magnitude');
    const [showAtomsOnSlice, setShowAtomsOnSlice] = useState(true);
    const [showBonds, setShowBonds] = useState(true);
    const [showLabels, setShowLabels] = useState(true);
    const [supercell, setSupercell] = useState<[number, number, number]>([1, 1, 1]);
    const [selectedReflection, setSelectedReflection] = useState<[number, number, number] | null>(null);
    const [formFactors, setFormFactors] = useState<Record<string, ControlPoint[]>>({});

    // Tab states - default to density slice and lattice view
    const [realSpaceView, setRealSpaceView] = useState<'3d' | 'density'>('density');
    const [reciprocalView, setReciprocalView] = useState<'lattice' | 'detector' | 'pxrd'>('lattice');

    // Container refs for measuring dimensions
    const realSpaceContentRef = useRef<HTMLDivElement>(null);
    const reciprocalContentRef = useRef<HTMLDivElement>(null);

    const realSpaceSize = useContainerSize(realSpaceContentRef);
    const reciprocalSize = useContainerSize(reciprocalContentRef);

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

    // Calculate viewer sizes (square, based on smaller dimension with some padding)
    const viewer3DSize = Math.min(realSpaceSize.width - 16, realSpaceSize.height - 16);
    const densityViewSize = Math.min(realSpaceSize.width - 16, realSpaceSize.height - 16);

    // Calculate reciprocal view sizes
    const reciprocalViewWidth = reciprocalSize.width - 16;
    const reciprocalViewHeight = reciprocalSize.height - 16;

    return (
        <div className={`${styles.container} ${className || ''}`}>
            <h2 className={styles.title}>X-ray Diffraction Simulator</h2>

            {/* Main three-column grid layout */}
            <div className={styles.mainGrid}>
                {/* LEFT: Real Space Panel (tabbed: 3D / Density) */}
                <div className={styles.realSpacePanel}>
                    <div className={styles.panelHeader}>
                        <h3 className={styles.panelTitle}>Real Space</h3>
                        <div className={styles.viewTabs}>
                            <button
                                className={`${styles.viewTab} ${realSpaceView === '3d' ? styles.viewTabActive : ''}`}
                                onClick={() => setRealSpaceView('3d')}
                            >
                                3D
                            </button>
                            <button
                                className={`${styles.viewTab} ${realSpaceView === 'density' ? styles.viewTabActive : ''}`}
                                onClick={() => setRealSpaceView('density')}
                            >
                                Density
                            </button>
                        </div>
                    </div>
                    <div className={styles.panelContent} ref={realSpaceContentRef}>
                        <div className={styles.viewerContainer}>
                            {realSpaceView === '3d' ? (
                                viewer3DSize > 100 && (
                                    <Viewer3D
                                        width={viewer3DSize}
                                        height={viewer3DSize}
                                        structure={structure}
                                        representation={showBonds ? 'ball+stick' : 'spacefill'}
                                        showUnitCell={true}
                                        showAxes={showLabels}
                                        supercell={supercell}
                                        autoRotate={true}
                                        theme={theme}
                                    />
                                )
                            ) : (
                                densityViewSize > 100 && (
                                    <ElectronDensity
                                        width={densityViewSize}
                                        height={densityViewSize}
                                        structure={structure}
                                        wavelength={wavelength}
                                        slicePosition={slicePosition}
                                        sliceAxis={sliceAxis}
                                        resolution={densityResolution}
                                        showContours={showContours}
                                        maxHKL={maxIndex}
                                        theme={theme}
                                        formFactors={formFactors}
                                        bFactor={bFactor}
                                        noise={noise}
                                        displayMode={densityDisplayMode}
                                        showAtoms={showAtomsOnSlice}
                                    />
                                )
                            )}
                        </div>
                    </div>
                    {/* Slice controls - only show when density tab is active */}
                    {realSpaceView === 'density' && (
                        <div className={styles.sliceControls}>
                            <span className={styles.sliceLabel}>{sliceAxis}-slice:</span>
                            <input
                                type="range"
                                className={styles.sliceSlider}
                                min={0}
                                max={1}
                                step={0.01}
                                value={slicePosition}
                                onChange={(e) => setSlicePosition(parseFloat(e.target.value))}
                            />
                            <span className={styles.sliceValue}>{slicePosition.toFixed(2)}</span>
                            <div className={styles.sliceButtons}>
                                <button
                                    className={`${styles.sliceButton} ${slicePosition === 0 ? styles.sliceButtonActive : ''}`}
                                    onClick={() => setSlicePosition(0)}
                                >
                                    0
                                </button>
                                <button
                                    className={`${styles.sliceButton} ${Math.abs(slicePosition - 0.25) < 0.01 ? styles.sliceButtonActive : ''}`}
                                    onClick={() => setSlicePosition(0.25)}
                                >
                                    1/4
                                </button>
                                <button
                                    className={`${styles.sliceButton} ${Math.abs(slicePosition - 0.5) < 0.01 ? styles.sliceButtonActive : ''}`}
                                    onClick={() => setSlicePosition(0.5)}
                                >
                                    1/2
                                </button>
                            </div>
                            <div className={styles.displayModeToggle}>
                                <button
                                    className={`${styles.sliceButton} ${densityDisplayMode === 'magnitude' ? styles.sliceButtonActive : ''}`}
                                    onClick={() => setDensityDisplayMode('magnitude')}
                                    title="Show |ρ|"
                                >
                                    |ρ|
                                </button>
                                <button
                                    className={`${styles.sliceButton} ${densityDisplayMode === 'signed' ? styles.sliceButtonActive : ''}`}
                                    onClick={() => setDensityDisplayMode('signed')}
                                    title="Show ρ (signed)"
                                >
                                    ±ρ
                                </button>
                            </div>
                            <div className={styles.displayModeToggle}>
                                <button
                                    className={`${styles.sliceButton} ${showAtomsOnSlice ? styles.sliceButtonActive : ''}`}
                                    onClick={() => setShowAtomsOnSlice(!showAtomsOnSlice)}
                                    title="Show atom positions"
                                >
                                    Atoms
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT: Reciprocal Space Panel (tabbed) */}
                <div className={styles.reciprocalPanel}>
                    <div className={styles.panelHeader}>
                        <h3 className={styles.panelTitle}>Reciprocal Space</h3>
                        <div className={styles.viewTabs}>
                            <button
                                className={`${styles.viewTab} ${reciprocalView === 'lattice' ? styles.viewTabActive : ''}`}
                                onClick={() => setReciprocalView('lattice')}
                            >
                                Lattice
                            </button>
                            <button
                                className={`${styles.viewTab} ${reciprocalView === 'detector' ? styles.viewTabActive : ''}`}
                                onClick={() => setReciprocalView('detector')}
                            >
                                Detector
                            </button>
                            <button
                                className={`${styles.viewTab} ${reciprocalView === 'pxrd' ? styles.viewTabActive : ''}`}
                                onClick={() => setReciprocalView('pxrd')}
                            >
                                PXRD
                            </button>
                        </div>
                    </div>
                    <div className={styles.panelContent} ref={reciprocalContentRef}>
                        {reciprocalView === 'pxrd' ? (
                            <PowderPattern
                                width={reciprocalViewWidth}
                                height={reciprocalViewHeight}
                                reflections={reflections}
                                wavelength={wavelength}
                                peakWidth={peakWidth}
                                showLabels={showPeakLabels}
                                twoThetaRange={[5, twoThetaMax]}
                                selectedReflection={selectedReflection}
                                onSelectReflection={setSelectedReflection}
                                theme={theme}
                            />
                        ) : (
                            <ReciprocalLattice
                                width={reciprocalViewWidth}
                                height={reciprocalViewHeight}
                                structure={structure}
                                reflections={reflections}
                                plane={reciprocalPlane}
                                maxIndex={maxIndex}
                                showAbsences={showAbsences}
                                selectedReflection={selectedReflection}
                                onSelectReflection={setSelectedReflection}
                                theme={theme}
                                viewMode={reciprocalView === 'detector' ? 'detector' : 'reciprocal'}
                                wavelength={wavelength}
                                oscillationRange={oscillationRange}
                                detectorDistance={detectorDistance}
                                twoThetaMax={twoThetaMax}
                                bFactor={bFactor}
                            />
                        )}
                    </div>
                </div>

                {/* SETTINGS Panel */}
                <div className={styles.settingsPanel}>
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
                        showPeakLabels={showPeakLabels}
                        onShowPeakLabelsChange={setShowPeakLabels}
                        reciprocalPlane={reciprocalPlane}
                        onReciprocalPlaneChange={setReciprocalPlane}
                        maxIndex={maxIndex}
                        onMaxIndexChange={setMaxIndex}
                        showAbsences={showAbsences}
                        onShowAbsencesChange={setShowAbsences}
                        reciprocalView={reciprocalView}
                        oscillationRange={oscillationRange}
                        onOscillationRangeChange={setOscillationRange}
                        detectorDistance={detectorDistance}
                        onDetectorDistanceChange={setDetectorDistance}
                        slicePosition={slicePosition}
                        onSlicePositionChange={setSlicePosition}
                        sliceAxis={sliceAxis}
                        onSliceAxisChange={setSliceAxis}
                        densityResolution={densityResolution}
                        onDensityResolutionChange={setDensityResolution}
                        showContours={showContours}
                        onShowContoursChange={setShowContours}
                        noise={noise}
                        onNoiseChange={setNoise}
                        bFactor={bFactor}
                        onBFactorChange={setBFactor}
                        showBonds={showBonds}
                        onShowBondsChange={setShowBonds}
                        showLabels={showLabels}
                        onShowLabelsChange={setShowLabels}
                        supercell={supercell}
                        onSupercellChange={setSupercell}
                        formFactors={formFactors}
                        onFormFactorsChange={setFormFactors}
                        theme={theme}
                    />
                </div>
            </div>

            {/* Explanation section */}
            <div className={styles.explanationContainer}>
                <h3 className={styles.explanationTitle}>
                    X-ray Diffraction and Crystal Structure
                </h3>
                <p className={styles.explanationText}>
                    X-ray diffraction reveals the atomic arrangement in crystals through
                    the interference of scattered X-rays. This simulation shows the
                    relationship between real-space structure, reciprocal space, and
                    the resulting diffraction pattern.
                </p>

                <h4>Key equations:</h4>
                <ul className={styles.explanationList}>
                    <li className={styles.explanationListItem}>
                        <strong>Bragg's Law:</strong>{' '}
                        <MathFormula math="n\lambda = 2d\sin\theta" inline={true} />
                        {' '} determines which angles produce diffraction peaks
                    </li>
                    <li className={styles.explanationListItem}>
                        <strong>d-spacing (cubic):</strong>{' '}
                        <MathFormula
                            math="d_{hkl} = \frac{a}{\sqrt{h^2 + k^2 + l^2}}"
                            inline={true}
                        />
                    </li>
                    <li className={styles.explanationListItem}>
                        <strong>Structure factor:</strong>{' '}
                        <MathFormula
                            math="F_{hkl} = \sum_j f_j \exp[2\pi i(hx_j + ky_j + lz_j)]"
                            inline={true}
                        />
                    </li>
                </ul>

                <h4>Systematic absences:</h4>
                <p className={styles.explanationText}>
                    Some reflections are forbidden due to crystal symmetry. For FCC lattices
                    (like NaCl), reflections are only allowed when h, k, l are all odd or
                    all even. These <em>systematic absences</em> are shown as crossed circles
                    in the reciprocal lattice view.
                </p>

                <div className={styles.explanationNote}>
                    <strong>Try it:</strong> Compare NaCl (FCC) with CsCl (simple cubic) to
                    see different systematic absence patterns. Use the Density tab to see
                    electron density at different z-planes through the unit cell.
                </div>
            </div>
        </div>
    );
};

// Wrap with BrowserOnly for SSR safety
const DiffractionVisualization: React.FC<DiffractionVisualizationProps> = (props) => {
    return (
        <BrowserOnly fallback={<div>Loading visualization...</div>}>
            {() => <DiffractionVisualizationInner {...props} />}
        </BrowserOnly>
    );
};

export default DiffractionVisualization;
