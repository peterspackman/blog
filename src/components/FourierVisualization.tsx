import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import Admonition from '@theme/Admonition';
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
import { VizButton } from './shared/controls';

import { InputPanel } from './fourier/InputPanel';
import { FourierDisplay } from './fourier/FourierDisplay';
import { FourierControls, PATTERN_TYPES } from './fourier/FourierControls';
import { compute2DFFT, logNormalize, linearNormalize } from './fourier/fftCompute';
import { generatePattern } from './fourier/patterns';
import { FourierGPU } from './fourier/fourierGPU';
import { DEFAULT_PARAMS, DEFAULT_DRAW_SETTINGS } from './fourier/types';
import { getGroup, getDefaultLatticeParams, computeCellDims, getOpsAsFloats } from './fourier/symmetry';
import type { InputMode, PatternType, DisplayMode, ColormapType, PackShape, PackPacking } from './fourier/types';

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
    title: string;
}

const FourierVisualizationInner: React.FC<FourierVisualizationProps> = ({ title }) => {
    const theme = useVizTheme();

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
    // Fullscreen
    const containerRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [inputContentRef, inputSize] = useContainerSize();
    const [outputContentRef, outputSize] = useContainerSize();

    // Square canvases fill their half of the card, capped so both fit on screen.
    const viewportCap = typeof window !== 'undefined' ? window.innerHeight - (isFullscreen ? 140 : 300) : 600;
    const squareFor = (w: number) => (w > 0 ? Math.max(200, Math.min(w, viewportCap)) : 0);
    const inputSquareSize = squareFor(inputSize.width);
    const outputSquareSize = squareFor(outputSize.width);

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

        // Enable smooth interpolation when stretching FFT grid to display canvas
        outputCtx.imageSmoothingEnabled = true;
        outputCtx.imageSmoothingQuality = 'high';

        if (inputMode === 'draw') {
            gpu.renderWallpaper(
                resolution, cellDims.cellW, cellDims.cellH, cellDims.shear,
                opsInfo.data, opsInfo.count,
                displayMode, colormap, gamma,
            );
            outputCtx.clearRect(0, 0, outputW, outputH);
            outputCtx.drawImage(gpu.getCanvas(), 0, 0, outputW, outputH);
        } else {
            const inputCanvas = gpuInputCanvasRef.current;
            if (!inputCanvas) return;
            const inputCtx = inputCanvas.getContext('2d');
            if (!inputCtx) return;
            const inputW = inputCanvas.width;
            const inputH = inputCanvas.height;

            inputCtx.imageSmoothingEnabled = true;
            inputCtx.imageSmoothingQuality = 'high';

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


    const prevResolutionRef = useRef(resolution);

    const toggleFullscreen = useCallback(() => {
        if (!containerRef.current) return;

        if (!document.fullscreenElement) {
            // Auto-bump resolution for fullscreen
            if (resolution < 512) {
                prevResolutionRef.current = resolution;
                setResolution(512);
            }
            containerRef.current.requestFullscreen().then(() => {
                setIsFullscreen(true);
            }).catch(() => {
                setIsFullscreen(true);
            });
        } else {
            document.exitFullscreen().then(() => {
                setIsFullscreen(false);
            });
        }
    }, [resolution]);

    useEffect(() => {
        const handleChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleChange);
        return () => document.removeEventListener('fullscreenchange', handleChange);
    }, []);

    // Escape key exits CSS fallback fullscreen
    useEffect(() => {
        if (!isFullscreen || document.fullscreenElement) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsFullscreen(false);
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isFullscreen]);

    const patternLabel = PATTERN_TYPES.find((p) => p.value === patternType)?.label ?? patternType;
    const inputLabel = inputMode === 'pattern' ? patternLabel : inputMode === 'draw' ? 'Drawing' : 'Uploaded image';

    return (
        <>
            <div
                ref={containerRef}
                style={
                    isFullscreen
                        ? {
                              position: 'fixed',
                              inset: 0,
                              zIndex: 9999,
                              overflow: 'auto',
                              padding: '0.75rem',
                              background: 'var(--ifm-background-color)',
                          }
                        : undefined
                }
            >
                <VizWorkbench
                    sidebar={
                        <VizPanel stack>
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
                />
                        </VizPanel>
                    }
                >
                    <VizPanel flush>
                        <VizPanelSection style={{ paddingBottom: 0 }}>
                            <VizPlotHeader
                                title={title}
                                readout={
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
                                        {inputLabel} · {resolution}×{resolution}
                                        <VizButton variant="secondary" size="sm" onClick={toggleFullscreen}>
                                            {isFullscreen ? 'Exit full screen' : 'Full screen'}
                                        </VizButton>
                                    </span>
                                }
                            />
                        </VizPanelSection>
                        <VizPanelSplit equal>
                            <VizPanelSection>
                                <VizSectionHeader title="Input f(x, y)" />
                                <div ref={inputContentRef} style={{ display: 'grid', justifyItems: 'center', lineHeight: 0 }}>
                                    {inputSquareSize > 0 && (
                                        useGPUPath && inputMode === 'pattern' ? (
                                            <div style={{
                                                position: 'relative',
                                                width: inputSquareSize,
                                                height: inputSquareSize,
                                                borderRadius: 'var(--viz-radius)',
                                                overflow: 'hidden',
                                                // Intensity image: black is zero signal in both themes.
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
                            </VizPanelSection>
                            <VizPanelSection>
                                <VizSectionHeader title="Transform F(k)" detail={displayLabel} />
                                <div ref={outputContentRef} style={{ display: 'grid', justifyItems: 'center', lineHeight: 0 }}>
                                    {outputSquareSize > 0 && (
                                        useGPUPath ? (
                                            <div style={{
                                                position: 'relative',
                                                width: outputSquareSize,
                                                height: outputSquareSize,
                                                borderRadius: 'var(--viz-radius)',
                                                overflow: 'hidden',
                                                backgroundColor: theme.canvas,
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
                            </VizPanelSection>
                        </VizPanelSplit>
                    </VizPanel>
                </VizWorkbench>
            </div>

            {!isFullscreen && (
                <VizExplanation
                    aside={
                        <>
                            {inputMode === 'pattern' && (
                                <Admonition type="info" title={patternLabel}>
                                    {PATTERN_HINTS[patternType]}
                                </Admonition>
                            )}
                            <Admonition type="tip" title="Try this">
                                Make the rectangle narrower and watch its transform spread out; then switch to Draw, pick a
                                wallpaper group and see the symmetry appear in the spots.
                            </Admonition>
                        </>
                    }
                >
                    <h2>Understanding the Fourier transform</h2>
                    <p>
                        The 2D Fourier transform decomposes a spatial pattern into its constituent spatial frequencies.
                        Low frequencies (near the centre) represent gradual changes, while high frequencies (near the
                        edges) represent sharp features and fine detail. The magnitude shows how much of each frequency
                        is present; the phase encodes where those features are located.
                    </p>
                    <ul>
                        <li>
                            <strong>Inverse relationship:</strong> a wider input feature produces a narrower transform,
                            and vice versa.
                        </li>
                        <li>
                            <strong>Rotation:</strong> rotating the input rotates the transform by the same angle.
                        </li>
                        <li>
                            <strong>Periodicity:</strong> periodic structures produce discrete spots at the
                            corresponding frequencies.
                        </li>
                    </ul>
                </VizExplanation>
            )}
        </>
    );
};

const FourierVisualization: React.FC<FourierVisualizationProps> = (props) => (
    <BrowserOnly fallback={<div style={{ minHeight: 560 }} />}>{() => <FourierVisualizationInner {...props} />}</BrowserOnly>
);

export default FourierVisualization;
