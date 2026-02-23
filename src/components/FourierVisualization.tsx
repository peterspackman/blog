import React, { useState, useMemo, useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import { useColorMode } from '@docusaurus/theme-common';
import BrowserOnly from '@docusaurus/BrowserOnly';
import styles from './fourier/FourierVisualization.module.css';

import { InputPanel } from './fourier/InputPanel';
import { FourierDisplay } from './fourier/FourierDisplay';
import { FourierControls } from './fourier/FourierControls';
import { compute2DFFT, logNormalize, linearNormalize } from './fourier/fftCompute';
import { generatePattern } from './fourier/patterns';
import { FourierGPU } from './fourier/fourierGPU';
import { DEFAULT_PARAMS, DEFAULT_DRAW_SETTINGS } from './fourier/types';
import { getGroup, getDefaultLatticeParams, computeCellDims, getOpsAsFloats } from './fourier/symmetry';
import type { InputMode, PatternType, DisplayMode, ColormapType, PackShape, PackPacking } from './fourier/types';
import type { ControlTheme } from './shared/controls';

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

const PATTERN_HINTS: Record<PatternType, string> = {
    rectangle: 'A rectangle transforms to a sinc x sinc pattern (cross-shaped).',
    doubleSlit: 'Two slits produce Young\'s interference fringes modulated by a sinc envelope.',
    circle: 'A circle transforms to an Airy disk pattern (concentric rings).',
    grating: 'A periodic grating produces discrete spots at the grating frequency.',
    gaussian: 'A Gaussian transforms to another Gaussian - the FT of a Gaussian is a Gaussian.',
    pointSources: 'Point sources produce a broad interference pattern; more points sharpen the peaks.',
    rhombus: 'A rhombus (diamond) produces a sinc-like pattern with four-fold symmetry aligned to its diagonals.',
    packedShapes: 'Packed shapes combine a lattice of discrete spots (from periodicity) with the shape\'s transform as an envelope.',
};

interface FourierVisualizationProps {
    className?: string;
}

const FourierVisualizationInner: React.FC<FourierVisualizationProps> = ({ className }) => {
    const { colorMode } = useColorMode();
    const isDark = colorMode === 'dark';

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
    const [inputMode, setInputMode] = useState<InputMode>('pattern');
    const [patternType, setPatternType] = useState<PatternType>('rectangle');
    const [displayMode, setDisplayMode] = useState<DisplayMode>('magnitude');
    const [colormap, setColormap] = useState<ColormapType>('inferno');
    const [gamma, setGamma] = useState(2);
    const [resolution, setResolution] = useState(256);
    const [wallpaperGroup, setWallpaperGroup] = useState(DEFAULT_DRAW_SETTINGS.wallpaperGroup);
    const [tiles, setTiles] = useState(DEFAULT_DRAW_SETTINGS.tiles);
    const [symmetryEnabled, setSymmetryEnabled] = useState(true);
    const [brushRadius, setBrushRadius] = useState(3);
    const [cellAngle, setCellAngle] = useState(90);
    const [cellRatio, setCellRatio] = useState(1.0);

    // Reset cell shape to group defaults when wallpaper group changes
    const handleWallpaperGroupChange = useCallback((g: string) => {
        setWallpaperGroup(g);
        const group = getGroup(g);
        const defaults = getDefaultLatticeParams(group.lattice);
        setCellAngle(defaults.angle);
        setCellRatio(defaults.ratio);
    }, []);

    // Pattern params
    const [rectWidth, setRectWidth] = useState(DEFAULT_PARAMS.rectWidth);
    const [rectHeight, setRectHeight] = useState(DEFAULT_PARAMS.rectHeight);
    const [slitWidth, setSlitWidth] = useState(DEFAULT_PARAMS.slitWidth);
    const [slitSeparation, setSlitSeparation] = useState(DEFAULT_PARAMS.slitSeparation);
    const [circleRadius, setCircleRadius] = useState(DEFAULT_PARAMS.circleRadius);
    const [gratingFrequency, setGratingFrequency] = useState(DEFAULT_PARAMS.gratingFrequency);
    const [gratingAngle, setGratingAngle] = useState(DEFAULT_PARAMS.gratingAngle);
    const [sigmaX, setSigmaX] = useState(DEFAULT_PARAMS.sigmaX);
    const [sigmaY, setSigmaY] = useState(DEFAULT_PARAMS.sigmaY);
    const [pointCount, setPointCount] = useState(DEFAULT_PARAMS.pointCount);
    const [pointSpacing, setPointSpacing] = useState(DEFAULT_PARAMS.pointSpacing);
    const [rhombusWidth, setRhombusWidth] = useState(DEFAULT_PARAMS.rhombusWidth);
    const [rhombusHeight, setRhombusHeight] = useState(DEFAULT_PARAMS.rhombusHeight);
    const [packShape, setPackShape] = useState<PackShape>(DEFAULT_PARAMS.packShape);
    const [packPacking, setPackPacking] = useState<PackPacking>(DEFAULT_PARAMS.packPacking);
    const [packElementSize, setPackElementSize] = useState(DEFAULT_PARAMS.packElementSize);
    const [packSpacing, setPackSpacing] = useState(DEFAULT_PARAMS.packSpacing);
    const [packEnvelopeRadius, setPackEnvelopeRadius] = useState(DEFAULT_PARAMS.packEnvelopeRadius);

    const params = useMemo(() => ({
        rectWidth, rectHeight, slitWidth, slitSeparation,
        circleRadius, gratingFrequency, gratingAngle,
        sigmaX, sigmaY, pointCount, pointSpacing,
        rhombusWidth, rhombusHeight,
        packShape, packPacking, packElementSize, packSpacing, packEnvelopeRadius,
    }), [rectWidth, rectHeight, slitWidth, slitSeparation,
        circleRadius, gratingFrequency, gratingAngle,
        sigmaX, sigmaY, pointCount, pointSpacing,
        rhombusWidth, rhombusHeight,
        packShape, packPacking, packElementSize, packSpacing, packEnvelopeRadius]);

    // GPU pipeline (WebGL 2 with full FFT on GPU)
    const gpuInitialized = useRef(false);
    const gpuRef = useRef<FourierGPU | null>(null);
    if (!gpuInitialized.current) {
        gpuInitialized.current = true;
        gpuRef.current = FourierGPU.create();
    }
    useEffect(() => () => {
        gpuRef.current?.dispose();
        gpuRef.current = null;
    }, []);

    const hasGPU = gpuRef.current !== null;

    // Interactive data from draw/upload modes (stored as state)
    const [interactiveData, setInteractiveData] = useState<Float32Array | null>(null);

    // Container refs & sizes (must be before GPU effect that depends on them)
    const inputContentRef = useRef<HTMLDivElement>(null);
    const outputContentRef = useRef<HTMLDivElement>(null);

    const inputSize = useContainerSize(inputContentRef);
    const outputSize = useContainerSize(outputContentRef);

    const inputSquareSize = Math.min(inputSize.width - 16, inputSize.height - 16);
    const outputSquareSize = Math.min(outputSize.width - 16, outputSize.height - 16);

    // ── GPU path (pattern mode with WebGL 2 available) ──────────────────────

    // For the GPU path, the input panel canvas and output canvas are both
    // updated via drawImage from the GPU's offscreen canvas. No Float32Array
    // passes through React state — only uniforms change.
    const gpuInputCanvasRef = useRef<HTMLCanvasElement>(null);
    const gpuOutputCanvasRef = useRef<HTMLCanvasElement>(null);
    const gpuOverlayCanvasRef = useRef<HTMLCanvasElement>(null);

    // GPU render trigger — fires on every relevant param change
    const useGPUPath = hasGPU && (inputMode === 'pattern' || inputMode === 'draw');

    // ── Draw-mode GPU state ────────────────────────────────────────────────────

    // Monotonic counter to trigger GPU re-render when raw buffer changes
    const [rawBufferVersion, setRawBufferVersion] = useState(0);

    const cellDims = useMemo(() =>
        computeCellDims(resolution, tiles, cellAngle, cellRatio),
    [resolution, tiles, cellAngle, cellRatio]);

    const opsInfo = useMemo(() =>
        getOpsAsFloats(wallpaperGroup, symmetryEnabled),
    [wallpaperGroup, symmetryEnabled]);

    const handleRawBufferUpdate = useCallback((raw: Float32Array) => {
        const gpu = gpuRef.current;
        if (!gpu) return;
        gpu.uploadRawBuffer(raw);
        setRawBufferVersion(v => v + 1);
    }, []);

    // Keep GPU canvas sizes in sync
    const updateGPUCanvasSize = useCallback((
        canvasRef: React.RefObject<HTMLCanvasElement | null>,
        w: number, h: number,
    ) => {
        const c = canvasRef.current;
        if (c && (c.width !== w || c.height !== h)) {
            c.width = w;
            c.height = h;
        }
    }, []);

    useEffect(() => {
        if (!useGPUPath) return;
        updateGPUCanvasSize(gpuInputCanvasRef, inputSquareSize, inputSquareSize);
        updateGPUCanvasSize(gpuOutputCanvasRef, outputSquareSize, outputSquareSize);
    }, [useGPUPath, inputSquareSize, outputSquareSize, updateGPUCanvasSize]);

    useEffect(() => {
        if (!useGPUPath) return;
        const gpu = gpuRef.current!;
        const outputCanvas = gpuOutputCanvasRef.current;
        if (!outputCanvas) return;

        const outputCtx = outputCanvas.getContext('2d');
        if (!outputCtx) return;

        const outputW = outputCanvas.width;
        const outputH = outputCanvas.height;

        if (inputMode === 'draw') {
            // Draw mode GPU: wallpaper expand → FFT → display
            // Input display is handled by InputPanel's own Canvas2D
            gpu.renderWallpaper(
                resolution, cellDims.cellW, cellDims.cellH, cellDims.shear,
                opsInfo.data, opsInfo.count,
                displayMode, colormap, gamma,
            );
            outputCtx.clearRect(0, 0, outputW, outputH);
            outputCtx.drawImage(gpu.getCanvas(), 0, 0, outputW, outputH);
        } else {
            // Pattern mode GPU: SDF → FFT → display
            const inputCanvas = gpuInputCanvasRef.current;
            if (!inputCanvas) return;
            const inputCtx = inputCanvas.getContext('2d');
            if (!inputCtx) return;
            const inputW = inputCanvas.width;
            const inputH = inputCanvas.height;

            gpu.renderPatternOnly(patternType, params, resolution);
            inputCtx.clearRect(0, 0, inputW, inputH);
            inputCtx.drawImage(gpu.getCanvas(), 0, 0, inputW, inputH);

            gpu.render(patternType, params, resolution, displayMode, colormap, gamma);
            outputCtx.clearRect(0, 0, outputW, outputH);
            outputCtx.drawImage(gpu.getCanvas(), 0, 0, outputW, outputH);
        }
    }, [useGPUPath, inputMode, patternType, params, resolution, displayMode, colormap, gamma,
        inputSquareSize, outputSquareSize,
        cellDims, opsInfo, rawBufferVersion]);

    // ── CPU fallback path (draw/upload modes, or no WebGL 2) ────────────────

    const patternData = useMemo(() => {
        if (useGPUPath) return null; // GPU handles it
        if (inputMode !== 'pattern') return null;
        return generatePattern(patternType, params, resolution);
    }, [useGPUPath, inputMode, patternType, params, resolution]);

    const activeData = inputMode === 'pattern' ? patternData : interactiveData;

    const fftResult = useMemo(() => {
        if (useGPUPath) return null; // GPU handles it
        if (!activeData) return null;
        return compute2DFFT(activeData, resolution);
    }, [useGPUPath, activeData, resolution]);

    const displayData = useMemo(() => {
        if (useGPUPath) return null; // GPU handles it
        if (!fftResult) return null;
        switch (displayMode) {
            case 'magnitude':
                return logNormalize(fftResult.magnitude);
            case 'phase':
                return linearNormalize(fftResult.phase, true);
            case 'real':
                return linearNormalize(fftResult.real, true);
            case 'imaginary':
                return linearNormalize(fftResult.imaginary, true);
        }
    }, [useGPUPath, fftResult, displayMode]);

    // Callback for draw/upload
    const handleInteractiveData = useCallback((data: Float32Array) => {
        setInteractiveData(data);
    }, []);

    // Display label
    const displayLabel = displayMode === 'magnitude' ? '|F(k)|'
        : displayMode === 'phase' ? 'arg(F(k))'
        : displayMode === 'real' ? 'Re(F(k))'
        : 'Im(F(k))';

    return (
        <div className={`${styles.container} ${className || ''}`}>
            <h2 className={styles.title}>Fourier Transform Visualizer</h2>

            <div className={styles.mainGrid}>
                {/* LEFT: Input Panel */}
                <div className={styles.inputPanel}>
                    <div className={styles.panelHeader}>
                        <h3 className={styles.panelTitle}>
                            Input f(x,y)
                        </h3>
                    </div>
                    <div className={styles.panelContent} ref={inputContentRef}>
                        <div className={styles.viewerContainer}>
                            {inputSquareSize > 100 && (
                                useGPUPath && inputMode === 'pattern' ? (
                                    <div style={{
                                        position: 'relative',
                                        width: inputSquareSize,
                                        height: inputSquareSize,
                                        borderRadius: '4px',
                                        border: `1px solid ${theme.border}`,
                                        overflow: 'hidden',
                                        backgroundColor: '#000',
                                    }}>
                                        <canvas
                                            ref={gpuInputCanvasRef}
                                            width={inputSquareSize}
                                            height={inputSquareSize}
                                            style={{
                                                width: inputSquareSize,
                                                height: inputSquareSize,
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <InputPanel
                                        width={inputSquareSize}
                                        height={inputSquareSize}
                                        mode={inputMode}
                                        data={activeData}
                                        N={resolution}
                                        onInteractiveData={handleInteractiveData}
                                        wallpaperGroup={wallpaperGroup}
                                        tiles={tiles}
                                        symmetryEnabled={symmetryEnabled}
                                        brushRadius={brushRadius}
                                        cellAngle={cellAngle}
                                        cellRatio={cellRatio}
                                        theme={theme}
                                        onRawBufferUpdate={useGPUPath ? handleRawBufferUpdate : undefined}
                                    />
                                )
                            )}
                        </div>
                    </div>
                </div>

                {/* CENTER: Output Panel */}
                <div className={styles.outputPanel}>
                    <div className={styles.panelHeader}>
                        <h3 className={styles.panelTitle}>
                            Fourier Transform F(k)
                            <span style={{ fontWeight: 400, fontSize: '0.75rem', marginLeft: '0.5rem', opacity: 0.7 }}>
                                {displayLabel}
                            </span>
                        </h3>
                    </div>
                    <div className={styles.panelContent} ref={outputContentRef}>
                        <div className={styles.viewerContainer}>
                            {outputSquareSize > 100 && (
                                useGPUPath ? (
                                    <div style={{
                                        position: 'relative',
                                        width: outputSquareSize,
                                        height: outputSquareSize,
                                        borderRadius: '4px',
                                        border: `1px solid ${theme.border}`,
                                        overflow: 'hidden',
                                        backgroundColor: theme.surface || theme.inputBg,
                                    }}>
                                        <canvas
                                            ref={gpuOutputCanvasRef}
                                            width={outputSquareSize}
                                            height={outputSquareSize}
                                            style={{
                                                width: outputSquareSize,
                                                height: outputSquareSize,
                                            }}
                                        />
                                        <canvas
                                            ref={gpuOverlayCanvasRef}
                                            width={outputSquareSize}
                                            height={outputSquareSize}
                                            style={{
                                                position: 'absolute',
                                                left: 0,
                                                top: 0,
                                                pointerEvents: 'none',
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <FourierDisplay
                                        width={outputSquareSize}
                                        height={outputSquareSize}
                                        data={displayData}
                                        N={resolution}
                                        colormap={colormap}
                                        gamma={gamma}
                                        label={displayLabel}
                                        theme={theme}
                                    />
                                )
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT: Settings Panel */}
                <div className={styles.settingsPanel}>
                    <FourierControls
                        inputMode={inputMode}
                        onInputModeChange={setInputMode}
                        patternType={patternType}
                        onPatternTypeChange={setPatternType}
                        displayMode={displayMode}
                        onDisplayModeChange={setDisplayMode}
                        colormap={colormap}
                        onColormapChange={setColormap}
                        gamma={gamma}
                        onGammaChange={setGamma}
                        resolution={resolution}
                        onResolutionChange={setResolution}
                        rectWidth={rectWidth}
                        onRectWidthChange={setRectWidth}
                        rectHeight={rectHeight}
                        onRectHeightChange={setRectHeight}
                        slitWidth={slitWidth}
                        onSlitWidthChange={setSlitWidth}
                        slitSeparation={slitSeparation}
                        onSlitSeparationChange={setSlitSeparation}
                        circleRadius={circleRadius}
                        onCircleRadiusChange={setCircleRadius}
                        gratingFrequency={gratingFrequency}
                        onGratingFrequencyChange={setGratingFrequency}
                        gratingAngle={gratingAngle}
                        onGratingAngleChange={setGratingAngle}
                        sigmaX={sigmaX}
                        onSigmaXChange={setSigmaX}
                        sigmaY={sigmaY}
                        onSigmaYChange={setSigmaY}
                        pointCount={pointCount}
                        onPointCountChange={setPointCount}
                        pointSpacing={pointSpacing}
                        onPointSpacingChange={setPointSpacing}
                        rhombusWidth={rhombusWidth}
                        onRhombusWidthChange={setRhombusWidth}
                        rhombusHeight={rhombusHeight}
                        onRhombusHeightChange={setRhombusHeight}
                        packShape={packShape}
                        onPackShapeChange={setPackShape}
                        packPacking={packPacking}
                        onPackPackingChange={setPackPacking}
                        packElementSize={packElementSize}
                        onPackElementSizeChange={setPackElementSize}
                        packSpacing={packSpacing}
                        onPackSpacingChange={setPackSpacing}
                        packEnvelopeRadius={packEnvelopeRadius}
                        onPackEnvelopeRadiusChange={setPackEnvelopeRadius}
                        wallpaperGroup={wallpaperGroup}
                        onWallpaperGroupChange={handleWallpaperGroupChange}
                        tiles={tiles}
                        onTilesChange={setTiles}
                        symmetryEnabled={symmetryEnabled}
                        onSymmetryEnabledChange={setSymmetryEnabled}
                        brushRadius={brushRadius}
                        onBrushRadiusChange={setBrushRadius}
                        cellAngle={cellAngle}
                        onCellAngleChange={setCellAngle}
                        cellRatio={cellRatio}
                        onCellRatioChange={setCellRatio}
                        theme={theme}
                    />
                </div>
            </div>

            {/* Explanation section */}
            <div className={styles.explanationContainer}>
                <h3 className={styles.explanationTitle}>
                    Understanding the Fourier Transform
                </h3>
                <p className={styles.explanationText}>
                    The 2D Fourier transform decomposes a spatial pattern into its
                    constituent spatial frequencies. Low frequencies (near the center)
                    represent gradual changes, while high frequencies (near the edges)
                    represent sharp features and fine detail. The magnitude shows how
                    much of each frequency is present; the phase encodes where those
                    features are located.
                </p>

                {inputMode === 'pattern' && (
                    <div className={styles.explanationNote}>
                        <strong>Current pattern:</strong> {PATTERN_HINTS[patternType]}
                    </div>
                )}

                <ul className={styles.hintList}>
                    <li><strong>Inverse relationship:</strong> a wider input feature produces a narrower FT, and vice versa.</li>
                    <li><strong>Rotation:</strong> rotating the input rotates the FT by the same angle.</li>
                    <li><strong>Periodicity:</strong> periodic structures produce discrete spots in the FT at the corresponding frequency.</li>
                </ul>
            </div>
        </div>
    );
};

const FourierVisualization: React.FC<FourierVisualizationProps> = (props) => {
    return (
        <BrowserOnly fallback={<div>Loading visualization...</div>}>
            {() => <FourierVisualizationInner {...props} />}
        </BrowserOnly>
    );
};

export default FourierVisualization;
