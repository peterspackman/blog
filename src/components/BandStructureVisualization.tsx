import React, { useState, useMemo, useRef, useLayoutEffect } from 'react';
import { useColorMode } from '@docusaurus/theme-common';
import BrowserOnly from '@docusaurus/BrowserOnly';
import styles from './QMVisualization.module.css';

import { EnergyLevels } from './bandstructure/EnergyLevels';
import { DOSPlot } from './bandstructure/DOSPlot';
import { OrbitalDisplay } from './bandstructure/OrbitalDisplay';
import { BandControls } from './bandstructure/BandControls';
import {
    calculateEnergyLevels,
    calculateFermiLevel,
    getEnergyRange,
    DEFAULT_ALPHA,
    DEFAULT_BETA,
} from './bandstructure/physics';
import type { ControlTheme } from './shared/controls';
import MathFormula from './MathFormula';

// Hook to measure container width
function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>) {
    const [width, setWidth] = useState(600);

    useLayoutEffect(() => {
        const updateWidth = () => {
            if (ref.current) {
                const containerWidth = ref.current.getBoundingClientRect().width;
                setWidth(Math.max(300, Math.floor(containerWidth)));
            }
        };

        updateWidth();

        const resizeObserver = new ResizeObserver(updateWidth);
        if (ref.current) {
            resizeObserver.observe(ref.current);
        }

        return () => resizeObserver.disconnect();
    }, [ref]);

    return width;
}

interface BandStructureVisualizationProps {
    className?: string;
}

const BandStructureVisualizationInner: React.FC<BandStructureVisualizationProps> = ({
    className,
}) => {
    // Dark mode support
    const { colorMode } = useColorMode();
    const isDark = colorMode === 'dark';

    // Theme-aware colors
    const theme: ControlTheme = {
        background: isDark ? '#2d2d2d' : '#f8f9fa',
        surface: isDark ? '#3d3d3d' : '#ffffff',
        border: isDark ? '#555' : '#e0e0e0',
        text: isDark ? '#e0e0e0' : '#333',
        textMuted: isDark ? '#999' : '#666',
        accent: isDark ? '#6b9eff' : '#2563eb',
        inputBg: isDark ? '#4a4a4a' : '#f3f4f6',
    };

    // State
    const [N, setN] = useState(10);
    const [electronCount, setElectronCount] = useState(10); // Start half-filled (N electrons)
    const [alternation, setAlternation] = useState(0); // Bond alternation (Peierls)
    const [selectedK, setSelectedK] = useState<number | null>(1);
    const [beta, setBeta] = useState(DEFAULT_BETA);
    const [showSmoothedDOS, setShowSmoothedDOS] = useState(true);
    const [dosSigma, setDosSigma] = useState(0.15);
    const [showAtomLabels, setShowAtomLabels] = useState(true);
    const [showCoefficients, setShowCoefficients] = useState(false);

    // Container ref for measuring width
    const containerRef = useRef<HTMLDivElement>(null);
    const containerWidth = useContainerWidth(containerRef);

    // Calculate sizes
    const plotHeight = Math.min(400, containerWidth * 0.55);
    const energyLevelsWidth = Math.min(280, containerWidth * 0.35);
    const dosWidth = Math.min(250, containerWidth * 0.30);
    const orbitalWidth = Math.min(700, containerWidth - 40);
    const orbitalHeight = 180;

    // Hückel parameters
    const params = useMemo(
        () => ({
            N,
            alpha: DEFAULT_ALPHA,
            beta,
            alternation,
        }),
        [N, beta, alternation]
    );

    // Calculate energy levels
    const energyLevels = useMemo(
        () => calculateEnergyLevels(params, electronCount),
        [params, electronCount]
    );

    // Calculate Fermi level info
    const fermiInfo = useMemo(
        () => calculateFermiLevel(energyLevels, electronCount),
        [energyLevels, electronCount]
    );

    // Energy range (shared for alignment)
    const energyRange = useMemo(() => getEnergyRange(params), [params]);

    // Keep electron count in sync when N changes
    const handleNChange = (newN: number) => {
        setN(newN);
        // Maintain half-filling by default, but cap at max
        if (electronCount === N) {
            setElectronCount(newN);
        } else {
            setElectronCount(Math.min(electronCount, 2 * newN));
        }
    };

    return (
        <div className={`${styles.container} ${className || ''}`}>
            <h2 className={styles.title}>Band Structure Emergence</h2>

            {/* Main grid layout: canvas area + sidebar */}
            <div className={styles.gridLayout}>
                {/* Left: Visualization area */}
                <div className={styles.canvasArea} ref={containerRef}>
                    {/* Energy levels + DOS side by side */}
                    <div
                        style={{
                            display: 'flex',
                            gap: '1rem',
                            flexWrap: 'wrap',
                            alignItems: 'stretch',
                        }}
                    >
                        {/* Energy level diagram */}
                        <div>
                            <EnergyLevels
                                width={energyLevelsWidth}
                                height={plotHeight}
                                energyLevels={energyLevels}
                                selectedK={selectedK}
                                onSelectK={setSelectedK}
                                params={params}
                                energyRange={energyRange}
                                fermiInfo={fermiInfo}
                                electronCount={electronCount}
                                theme={theme}
                            />
                        </div>

                        {/* DOS plot */}
                        <div>
                            <DOSPlot
                                width={dosWidth}
                                height={plotHeight}
                                energyLevels={energyLevels}
                                params={params}
                                energyRange={energyRange}
                                showSmoothed={showSmoothedDOS}
                                sigma={dosSigma}
                                theme={theme}
                            />
                        </div>
                    </div>

                    {/* Orbital display */}
                    <div style={{ marginTop: '1rem' }}>
                        <OrbitalDisplay
                            width={orbitalWidth}
                            height={orbitalHeight}
                            N={N}
                            selectedK={selectedK}
                            showAtomLabels={showAtomLabels}
                            showCoefficients={showCoefficients}
                            theme={theme}
                        />
                    </div>
                </div>

                {/* Right: Sidebar controls */}
                <div className={styles.sidebarArea}>
                    <BandControls
                        N={N}
                        onNChange={handleNChange}
                        electronCount={electronCount}
                        onElectronCountChange={setElectronCount}
                        alternation={alternation}
                        onAlternationChange={setAlternation}
                        selectedK={selectedK}
                        onSelectedKChange={setSelectedK}
                        beta={beta}
                        onBetaChange={setBeta}
                        showSmoothedDOS={showSmoothedDOS}
                        onShowSmoothedDOSChange={setShowSmoothedDOS}
                        dosSigma={dosSigma}
                        onDosSigmaChange={setDosSigma}
                        showAtomLabels={showAtomLabels}
                        onShowAtomLabelsChange={setShowAtomLabels}
                        showCoefficients={showCoefficients}
                        onShowCoefficientsChange={setShowCoefficients}
                        bandGap={fermiInfo.bandGap}
                        theme={theme}
                    />
                </div>
            </div>

            {/* Explanation section */}
            <div className={styles.explanationContainer}>
                <h3 className={styles.explanationTitle}>
                    Band Structure from Molecular Orbitals
                </h3>
                <p className={styles.explanationText}>
                    This visualization demonstrates how discrete molecular orbital (MO)
                    energy levels merge into a continuous energy band as the number of
                    atoms increases. We use the{' '}
                    <strong>Hückel (tight-binding) model</strong> for a linear chain of
                    atoms with pi orbitals.
                </p>
                <p className={styles.explanationText}>
                    The energy of each MO is given by:{' '}
                    <MathFormula
                        math="E_k = \alpha + 2\beta \cos\left(\frac{k\pi}{N+1}\right)"
                        inline={true}
                    />
                    , where <em>k</em> = 1, 2, ..., N is the orbital index, and{' '}
                    <em>&beta;</em> is the hopping integral (typically -2.5 eV for C-C pi bonds).
                </p>

                <h4>Key features:</h4>
                <ul className={styles.explanationList}>
                    <li className={styles.explanationListItem}>
                        <strong>Band formation:</strong> As N increases, discrete levels merge
                        into a continuous band of width 4|&beta;|
                    </li>
                    <li className={styles.explanationListItem}>
                        <strong>Electron filling:</strong> Each orbital holds 2 electrons (spin).
                        The Fermi level (green dashed line) separates occupied from unoccupied states.
                    </li>
                    <li className={styles.explanationListItem}>
                        <strong>Doping:</strong> Adding/removing electrons from half-filling
                        simulates n-type or p-type doping
                    </li>
                    <li className={styles.explanationListItem}>
                        <strong>Peierls distortion:</strong> Bond alternation opens a band gap,
                        converting the metal to a semiconductor (like polyacetylene)
                    </li>
                </ul>

                <div className={styles.explanationNote}>
                    <strong>Try it:</strong> Start with N=10, then increase to see band formation.
                    Add bond alternation to open a gap. Change electron count to simulate doping!
                </div>
            </div>
        </div>
    );
};

// Wrap with BrowserOnly for SSR safety
const BandStructureVisualization: React.FC<BandStructureVisualizationProps> = (props) => {
    return (
        <BrowserOnly fallback={<div>Loading visualization...</div>}>
            {() => <BandStructureVisualizationInner {...props} />}
        </BrowserOnly>
    );
};

export default BandStructureVisualization;
