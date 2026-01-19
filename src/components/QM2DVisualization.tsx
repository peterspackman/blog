import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useColorMode } from '@docusaurus/theme-common';
import styles from './QMVisualization.module.css';

import { Wavefunction2DCanvas } from './qm2d/Wavefunction2DCanvas';
import { ColorScale } from './qm2d/ColorScale';
import { PhasorGrid } from './qm2d/PhasorGrid';
import { QM2DControls } from './qm2d/QM2DControls';
import {
    type QuantumState2D,
    type DisplayMode,
    type ColorMapType,
    MAX_ACTIVE_STATES,
    formatStateString,
    calcEnergy,
} from './qm2d/physics';
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

interface QM2DVisualizationProps {
    className?: string;
}

const QM2DVisualization: React.FC<QM2DVisualizationProps> = ({ className }) => {
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
    const [activeStates, setActiveStates] = useState<QuantumState2D[]>([
        { nx: 1, ny: 1 },
    ]);
    const [isAnimating, setIsAnimating] = useState(true);
    const [speed, setSpeed] = useState(0.2);
    const [displayMode, setDisplayMode] = useState<DisplayMode>('probability');
    const [colorMapType, setColorMapType] = useState<ColorMapType>('viridis');
    const [showContours, setShowContours] = useState(false);

    // Animation state
    const animationRef = useRef<number | null>(null);
    const tauRef = useRef(0);

    // Canvas container ref for measuring width
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const canvasWidth = useContainerWidth(canvasContainerRef);

    // Main canvas size
    const canvasSize = Math.min(500, Math.floor(canvasWidth * 0.65)); // 65% of width, cap at 500px

    // Derived state
    const [tau, setTau] = useState(0);

    // Animation loop
    useEffect(() => {
        const animate = () => {
            if (isAnimating) {
                // Increment dimensionless time
                // Use a slower increment for 2D (more complex patterns)
                tauRef.current += 0.008 * speed;
                setTau(tauRef.current);
            }
            animationRef.current = requestAnimationFrame(animate);
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isAnimating, speed]);

    // Toggle quantum state
    const toggleState = useCallback((nx: number, ny: number) => {
        setActiveStates((prev) => {
            const stateIndex = prev.findIndex(
                (s) => s.nx === nx && s.ny === ny
            );

            if (stateIndex >= 0) {
                // Remove state if it exists (but prevent removing the last state)
                if (prev.length > 1) {
                    return prev.filter((_, i) => i !== stateIndex);
                }
                return prev;
            } else {
                // Add state if it doesn't exist (limit to MAX_ACTIVE_STATES)
                if (prev.length < MAX_ACTIVE_STATES) {
                    return [...prev, { nx, ny }];
                }
                return prev;
            }
        });
    }, []);

    return (
        <div className={`${styles.container} ${className || ''}`}>
            <h2 className={styles.title}>2D Particle in a Box</h2>

            {/* Main grid layout: canvas area + sidebar */}
            <div className={styles.gridLayout}>
                {/* Left: Canvas area */}
                <div className={styles.canvasArea} ref={canvasContainerRef}>
                    {/* Main canvas + Phasor grid side by side */}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {/* Wavefunction visualization */}
                        <div>
                            <div className={styles.canvasWrapper}>
                                <Wavefunction2DCanvas
                                    width={canvasSize}
                                    height={canvasSize}
                                    activeStates={activeStates}
                                    tau={tau}
                                    displayMode={displayMode}
                                    colorMapType={colorMapType}
                                    showContours={showContours}
                                    theme={theme}
                                />
                            </div>
                            {/* Color scale below main canvas */}
                            <div style={{ marginTop: '0.5rem' }}>
                                <ColorScale
                                    width={canvasSize}
                                    colorMapType={colorMapType}
                                    displayMode={displayMode}
                                    theme={theme}
                                />
                            </div>
                        </div>

                        {/* Phasor grid */}
                        <PhasorGrid
                            activeStates={activeStates}
                            tau={tau}
                            onToggleState={toggleState}
                            theme={theme}
                        />
                    </div>
                </div>

                {/* Right: Sidebar controls */}
                <div className={styles.sidebarArea}>
                    <QM2DControls
                        displayMode={displayMode}
                        onDisplayModeChange={setDisplayMode}
                        colorMapType={colorMapType}
                        onColorMapChange={setColorMapType}
                        showContours={showContours}
                        onShowContoursChange={setShowContours}
                        isAnimating={isAnimating}
                        onIsAnimatingChange={setIsAnimating}
                        speed={speed}
                        onSpeedChange={setSpeed}
                        theme={theme}
                    />
                </div>
            </div>

            {/* Explanation section */}
            <div className={styles.explanationContainer}>
                <h3 className={styles.explanationTitle}>
                    About 2D Particle in a Box
                </h3>
                <p className={styles.explanationText}>
                    This visualization shows a quantum particle confined to a
                    two-dimensional square box with infinite potential walls.
                    The system has eigenstates characterized by two quantum
                    numbers (n<sub>x</sub>, n<sub>y</sub>), corresponding to the
                    number of nodes in each dimension.
                </p>
                <p className={styles.explanationText}>
                    The energy of each state is{' '}
                    <MathFormula
                        math="E = \frac{\pi^2 \hbar^2}{2 m L^2} (n_x^2 + n_y^2)"
                        inline={true}
                    />
                    , meaning higher quantum numbers have higher energies. Each
                    quantum state evolves in time with a phase factor{' '}
                    <MathFormula
                        math="e^{-i E t / \hbar}"
                        inline={true}
                    />
                    , with faster rotation for higher energy states.
                </p>

                <h4>Key features to observe:</h4>
                <ul className={styles.explanationList}>
                    <li className={styles.explanationListItem}>
                        Probability densities show characteristic nodal patterns
                        based on quantum numbers
                    </li>
                    <li className={styles.explanationListItem}>
                        Superposition of states creates interference patterns
                        that evolve in time
                    </li>
                    <li className={styles.explanationListItem}>
                        States with different energies evolve at different
                        rates, creating complex dynamics
                    </li>
                    <li className={styles.explanationListItem}>
                        The phasor grid shows the phase evolution of each active
                        quantum state
                    </li>
                </ul>

                <div className={styles.explanationNote}>
                    <strong>Tip:</strong> Try activating multiple states with
                    different quantum numbers to see interference effects and
                    observe how the pattern evolves over time!
                </div>

                {/* Active states and energies */}
                {activeStates.length > 0 && (
                    <div className={styles.stateEnergiesContainer}>
                        <h4>Active States: {formatStateString(activeStates)}</h4>
                        <ul className={styles.stateEnergiesList}>
                            {activeStates.map((state) => (
                                <li
                                    key={`${state.nx}-${state.ny}`}
                                    className={styles.stateEnergiesItem}
                                >
                                    State (n<sub>x</sub>={state.nx}, n<sub>y</sub>
                                    ={state.ny}): E = {calcEnergy(state.nx, state.ny)}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QM2DVisualization;
