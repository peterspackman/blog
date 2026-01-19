import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useColorMode } from '@docusaurus/theme-common';
import BrowserOnly from '@docusaurus/BrowserOnly';
import styles from './QMVisualization.module.css';

import { QM3DScene } from './qm3d/QM3DScene';
import { StateSelector3D } from './qm3d/StateSelector3D';
import { QM3DControls } from './qm3d/QM3DControls';
import {
    type QuantumState3D,
    type ColorMapType,
    type RenderStyle,
    MAX_ACTIVE_STATES,
    formatStateString,
    calcStateEnergy,
} from './qm3d/physics';
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

interface QM3DVisualizationProps {
    className?: string;
}

const QM3DVisualizationInner: React.FC<QM3DVisualizationProps> = ({ className }) => {
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
    const [activeStates, setActiveStates] = useState<QuantumState3D[]>([
        { nx: 1, ny: 1, nz: 1 },
    ]);
    const [isAnimating, setIsAnimating] = useState(true);
    const [speed, setSpeed] = useState(0.2);
    const [colorMapType, setColorMapType] = useState<ColorMapType>('viridis');
    const [renderStyle, setRenderStyle] = useState<RenderStyle>('colorful');
    const [densityScale, setDensityScale] = useState(4.5);
    const [opacityPower, setOpacityPower] = useState(0.3);  // <1 = fuzzy, >1 = sharp
    const [threshold, setThreshold] = useState(0);  // Minimum density to render

    // Animation state
    const animationRef = useRef<number | null>(null);
    const tauRef = useRef(0);

    // Canvas container ref for measuring width
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const canvasWidth = useContainerWidth(canvasContainerRef);

    // Main canvas size
    const canvasSize = Math.min(500, Math.floor(canvasWidth * 0.65));

    // Derived state
    const [tau, setTau] = useState(0);

    // Animation loop
    useEffect(() => {
        const animate = () => {
            if (isAnimating) {
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
    const toggleState = useCallback((nx: number, ny: number, nz: number) => {
        setActiveStates((prev) => {
            const stateIndex = prev.findIndex(
                (s) => s.nx === nx && s.ny === ny && s.nz === nz
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
                    return [...prev, { nx, ny, nz }];
                }
                return prev;
            }
        });
    }, []);

    return (
        <div className={`${styles.container} ${className || ''}`}>
            <h2 className={styles.title}>3D Particle in a Box</h2>

            {/* Main grid layout: canvas area + sidebar */}
            <div className={styles.gridLayout}>
                {/* Left: Canvas area */}
                <div className={styles.canvasArea} ref={canvasContainerRef}>
                    {/* Main canvas + State selector side by side */}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {/* 3D visualization */}
                        <div>
                            <QM3DScene
                                activeStates={activeStates}
                                tau={tau}
                                densityScale={densityScale}
                                opacityPower={opacityPower}
                                threshold={threshold}
                                colorMapType={colorMapType}
                                renderStyle={renderStyle}
                                width={canvasSize}
                                height={canvasSize}
                                isDark={isDark}
                            />
                        </div>

                        {/* State selector grid */}
                        <StateSelector3D
                            activeStates={activeStates}
                            tau={tau}
                            onToggleState={toggleState}
                            theme={theme}
                        />
                    </div>
                </div>

                {/* Right: Sidebar controls */}
                <div className={styles.sidebarArea}>
                    <QM3DControls
                        colorMapType={colorMapType}
                        onColorMapChange={setColorMapType}
                        renderStyle={renderStyle}
                        onRenderStyleChange={setRenderStyle}
                        densityScale={densityScale}
                        onDensityScaleChange={setDensityScale}
                        opacityPower={opacityPower}
                        onOpacityPowerChange={setOpacityPower}
                        threshold={threshold}
                        onThresholdChange={setThreshold}
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
                    About 3D Particle in a Box
                </h3>
                <p className={styles.explanationText}>
                    This visualization shows a quantum particle confined to a
                    three-dimensional cubic box with infinite potential walls.
                    The system has eigenstates characterized by three quantum
                    numbers (n<sub>x</sub>, n<sub>y</sub>, n<sub>z</sub>), representing
                    the number of nodes in each dimension.
                </p>
                <p className={styles.explanationText}>
                    The energy of each state is{' '}
                    <MathFormula
                        math="E = \frac{\pi^2 \hbar^2}{2 m L^2} (n_x^2 + n_y^2 + n_z^2)"
                        inline={true}
                    />
                    . States with the same sum n<sub>x</sub><sup>2</sup> + n<sub>y</sub><sup>2</sup> + n<sub>z</sub><sup>2</sup>{' '}
                    are degenerate (same energy). Each state evolves with a phase{' '}
                    <MathFormula
                        math="e^{-i E t / \hbar}"
                        inline={true}
                    />
                    , with faster oscillation for higher energy states.
                </p>

                <h4>Key features to observe:</h4>
                <ul className={styles.explanationList}>
                    <li className={styles.explanationListItem}>
                        The probability density |ψ|² is rendered as a
                        semi-transparent cloud using volume ray marching
                    </li>
                    <li className={styles.explanationListItem}>
                        Superposition of states creates complex 3D interference
                        patterns that evolve over time
                    </li>
                    <li className={styles.explanationListItem}>
                        Degenerate states (same energy) can form standing wave
                        patterns when combined
                    </li>
                    <li className={styles.explanationListItem}>
                        Use the orbit controls to rotate and zoom the visualization
                    </li>
                </ul>

                <div className={styles.explanationNote}>
                    <strong>Tip:</strong> Try combining degenerate states like
                    (2,1,1), (1,2,1), and (1,1,2) to see how different combinations
                    create different spatial distributions with the same energy!
                </div>

                {/* Active states and energies */}
                {activeStates.length > 0 && (
                    <div className={styles.stateEnergiesContainer}>
                        <h4>Active States: {formatStateString(activeStates)}</h4>
                        <ul className={styles.stateEnergiesList}>
                            {activeStates.map((state) => (
                                <li
                                    key={`${state.nx}-${state.ny}-${state.nz}`}
                                    className={styles.stateEnergiesItem}
                                >
                                    State (n<sub>x</sub>={state.nx}, n<sub>y</sub>
                                    ={state.ny}, n<sub>z</sub>={state.nz}): E ={' '}
                                    {calcStateEnergy(state)}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

// Wrap with BrowserOnly for SSR safety
const QM3DVisualization: React.FC<QM3DVisualizationProps> = (props) => {
    return (
        <BrowserOnly fallback={<div>Loading 3D visualization...</div>}>
            {() => <QM3DVisualizationInner {...props} />}
        </BrowserOnly>
    );
};

export default QM3DVisualization;
