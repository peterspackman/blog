import React, {
    useState,
    useEffect,
    useRef,
    useCallback,
    useLayoutEffect,
    useMemo,
} from 'react';
import { useColorMode } from '@docusaurus/theme-common';
import styles from './QMVisualization.module.css';

import { WavefunctionCanvas, type DisplayOptions } from './qm1d/WavefunctionCanvas';
import { PhasorDiagram } from './qm1d/PhasorDiagram';
import { QMControls } from './qm1d/QMControls';
import { QMExplanation } from './qm1d/QMExplanation';
import {
    buildStateSet,
    defaultDomain,
    defaultParams,
    getPotentialDisplayName,
    type PotentialType,
    type PotentialConfig,
    type PotentialParams,
} from './qm1d/physics';
import type { ControlTheme } from './shared/controls';

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
        if (ref.current) resizeObserver.observe(ref.current);
        return () => resizeObserver.disconnect();
    }, [ref]);

    return width;
}

interface QMVisualization1DProps {
    className?: string;
}

const QMVisualization1D: React.FC<QMVisualization1DProps> = ({ className }) => {
    const { colorMode } = useColorMode();
    const isDark = colorMode === 'dark';

    const theme: ControlTheme = {
        background: isDark ? '#2d2d2d' : '#f8f9fa',
        surface: isDark ? '#3d3d3d' : '#ffffff',
        border: isDark ? '#555' : '#e0e0e0',
        text: isDark ? '#e0e0e0' : '#333',
        textMuted: isDark ? '#999' : '#666',
        accent: isDark ? '#6b9eff' : '#2563eb',
        inputBg: isDark ? '#4a4a4a' : '#f3f4f6',
    };

    const [activeStates, setActiveStates] = useState<number[]>([0]);
    const [isAnimating, setIsAnimating] = useState(true);
    const [speed, setSpeed] = useState(0.2);
    const [potentialType, setPotentialType] = useState<PotentialType>('harmonic');
    const [potentialParams, setPotentialParams] = useState<PotentialParams>(
        defaultParams('harmonic')
    );

    const [displayOptions, setDisplayOptions] = useState<DisplayOptions>({
        showReal: false,
        showImaginary: false,
        showProbability: true,
        showPotential: true,
        showIndividualStates: false,
        showEnergyLevels: true,
        autoRescale: false,
    });

    const animationRef = useRef<number | null>(null);
    const tauRef = useRef(0);
    const [tau, setTau] = useState(0);

    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const canvasWidth = useContainerWidth(canvasContainerRef);
    const canvasHeight = Math.min(500, Math.round(canvasWidth * 0.45));

    // Build state set — memoized so we only diagonalize when params change
    const stateSet = useMemo(() => {
        const domain = defaultDomain(potentialType, potentialParams);
        const config: PotentialConfig = {
            type: potentialType,
            xMin: domain.xMin,
            xMax: domain.xMax,
            ...potentialParams,
        };
        return buildStateSet(config);
    }, [potentialType, potentialParams]);

    // Animation loop
    useEffect(() => {
        const animate = () => {
            if (isAnimating) {
                tauRef.current += 0.05 * speed;
                setTau(tauRef.current);
            }
            animationRef.current = requestAnimationFrame(animate);
        };
        animationRef.current = requestAnimationFrame(animate);
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [isAnimating, speed]);

    const toggleState = useCallback((n: number) => {
        setActiveStates((prev) => {
            if (prev.includes(n)) {
                return prev.length > 1 ? prev.filter((s) => s !== n) : prev;
            }
            return [...prev, n].sort((a, b) => a - b);
        });
    }, []);

    const selectOnlyState = useCallback((n: number) => {
        setActiveStates([n]);
    }, []);

    const handlePotentialTypeChange = useCallback((type: PotentialType) => {
        setPotentialType(type);
        setPotentialParams(defaultParams(type));
        // Different potentials have different numbers of bound states and
        // different energy orderings, so reset to just the ground state.
        setActiveStates([0]);
        tauRef.current = 0;
        setTau(0);
    }, []);

    const handlePotentialParamChange = useCallback(
        <K extends keyof PotentialParams>(key: K, value: PotentialParams[K]) => {
            setPotentialParams((prev) => ({ ...prev, [key]: value }));
        },
        []
    );

    const handleDisplayOptionChange = useCallback(
        <K extends keyof DisplayOptions>(key: K, value: boolean) => {
            setDisplayOptions((prev) => ({ ...prev, [key]: value }));
        },
        []
    );

    return (
        <div className={`${styles.container} ${className || ''}`}>
            <h2 className={styles.title}>
                Quantum {getPotentialDisplayName(potentialType)}
            </h2>

            <div className={styles.gridLayout}>
                <div className={styles.canvasArea} ref={canvasContainerRef}>
                    <div className={styles.canvasWrapper}>
                        <WavefunctionCanvas
                            width={canvasWidth}
                            height={canvasHeight}
                            activeStates={activeStates}
                            tau={tau}
                            stateSet={stateSet}
                            displayOptions={displayOptions}
                            theme={theme}
                        />
                    </div>

                    <div className={styles.phasorWrapper}>
                        <PhasorDiagram
                            activeStates={activeStates}
                            tau={tau}
                            stateSet={stateSet}
                            onToggleState={toggleState}
                            onSelectOnly={selectOnlyState}
                            theme={theme}
                        />
                    </div>
                </div>

                <div className={styles.sidebarArea}>
                    <QMControls
                        potentialType={potentialType}
                        onPotentialTypeChange={handlePotentialTypeChange}
                        potentialParams={potentialParams}
                        onPotentialParamChange={handlePotentialParamChange}
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

            <QMExplanation
                potentialType={potentialType}
                activeStates={activeStates}
            />
        </div>
    );
};

export default QMVisualization1D;
