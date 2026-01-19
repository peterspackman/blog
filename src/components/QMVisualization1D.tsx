import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useColorMode } from '@docusaurus/theme-common';
import styles from './QMVisualization.module.css';

import { WavefunctionCanvas, type DisplayOptions } from './qm1d/WavefunctionCanvas';
import { PhasorDiagram } from './qm1d/PhasorDiagram';
import { QMControls } from './qm1d/QMControls';
import { QMExplanation } from './qm1d/QMExplanation';
import { getPotentialDisplayName, type PotentialType, type PotentialConfig } from './qm1d/physics';
import type { ControlTheme } from './shared/controls';

// Hook to measure container width
function useContainerWidth(ref: React.RefObject<HTMLDivElement>) {
    const [width, setWidth] = useState(800);

    useLayoutEffect(() => {
        const updateWidth = () => {
            if (ref.current) {
                const containerWidth = ref.current.getBoundingClientRect().width;
                setWidth(Math.max(400, Math.floor(containerWidth)));
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

interface QMVisualization1DProps {
    className?: string;
}

const QMVisualization1D: React.FC<QMVisualization1DProps> = ({ className }) => {
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
    const [activeStates, setActiveStates] = useState<number[]>([0]);
    const [isAnimating, setIsAnimating] = useState(true);
    const [speed, setSpeed] = useState(0.2);
    const [potentialType, setPotentialType] = useState<PotentialType>('harmonic');

    const [displayOptions, setDisplayOptions] = useState<DisplayOptions>({
        showReal: true,
        showImaginary: true,
        showProbability: true,
        showPotential: true,
        showIndividualStates: true,
    });

    // Animation state
    const animationRef = useRef<number | null>(null);
    const tauRef = useRef(0); // Dimensionless time

    // Canvas container ref for measuring width
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const canvasWidth = useContainerWidth(canvasContainerRef);
    const canvasHeight = Math.min(500, Math.round(canvasWidth * 0.45)); // Cap at 500px

    // Derived state
    const [tau, setTau] = useState(0);

    // Potential configuration
    const potentialConfig: PotentialConfig = {
        type: potentialType,
        xMin: -6,
        xMax: 6,
    };

    // Animation loop
    useEffect(() => {
        const animate = () => {
            if (isAnimating) {
                // Increment dimensionless time
                // 0.05 per frame at speed=1 means ~125 frames per ground state period (2*pi)
                tauRef.current += 0.05 * speed;
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
    const toggleState = useCallback((n: number) => {
        setActiveStates((prev) => {
            if (prev.includes(n)) {
                // Prevent removing last state
                if (prev.length > 1) {
                    return prev.filter((state) => state !== n);
                }
                return prev;
            }
            return [...prev, n].sort((a, b) => a - b);
        });
    }, []);

    // Set potential type
    const handlePotentialTypeChange = useCallback((type: PotentialType) => {
        setPotentialType(type);
    }, []);

    // Update display option
    const handleDisplayOptionChange = useCallback(
        <K extends keyof DisplayOptions>(key: K, value: boolean) => {
            setDisplayOptions((prev) => ({ ...prev, [key]: value }));
        },
        []
    );

    return (
        <div className={`${styles.container} ${className || ''}`}>
            <h2 className={styles.title}>
                Quantum {getPotentialDisplayName(potentialType)} Visualization
            </h2>

            {/* Main grid layout: canvas area + sidebar */}
            <div className={styles.gridLayout}>
                {/* Left: Canvas area */}
                <div className={styles.canvasArea} ref={canvasContainerRef}>
                    {/* Main wavefunction canvas */}
                    <div className={styles.canvasWrapper}>
                        <WavefunctionCanvas
                            width={canvasWidth}
                            height={canvasHeight}
                            activeStates={activeStates}
                            tau={tau}
                            potentialConfig={potentialConfig}
                            displayOptions={displayOptions}
                        />
                    </div>

                    {/* Phasor diagram below canvas */}
                    <div className={styles.phasorWrapper}>
                        <PhasorDiagram
                            activeStates={activeStates}
                            tau={tau}
                            potentialConfig={potentialConfig}
                            onToggleState={toggleState}
                            theme={theme}
                        />
                    </div>
                </div>

                {/* Right: Sidebar controls */}
                <div className={styles.sidebarArea}>
                    <QMControls
                        potentialType={potentialType}
                        onPotentialTypeChange={handlePotentialTypeChange}
                        displayOptions={displayOptions}
                        onDisplayOptionChange={handleDisplayOptionChange}
                        isAnimating={isAnimating}
                        onIsAnimatingChange={setIsAnimating}
                        speed={speed}
                        onSpeedChange={setSpeed}
                        theme={theme}
                    />
                </div>
            </div>

            {/* Explanation section */}
            <QMExplanation
                potentialType={potentialType}
                activeStates={activeStates}
            />
        </div>
    );
};

export default QMVisualization1D;
