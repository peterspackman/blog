import { useEffect, useRef } from 'react';
import { ParticleData } from './ParticleData';
import { VectorField, FieldPreset } from './VectorField';
import { ElectricField, ElectricFieldPreset } from './ElectricField';
import { NeighborList } from './NeighborList';

interface Theme {
    canvasBg: string;
    [key: string]: string;
}

interface UseCanvasRendererProps {
    canvasRef: React.RefObject<HTMLCanvasElement>;
    particleData: ParticleData | null;
    width: number;
    height: number;
    running: boolean;
    isDark: boolean;
    theme: Theme;
    coordinateScale: number;
    visualScale: number;
    baseParticleRadius: number;
    typeColors: string[];
    vectorFieldRef: React.RefObject<VectorField | null>;
    electricFieldRef: React.RefObject<ElectricField | null>;
    neighborListRef: React.RefObject<NeighborList | null>;
    showField: boolean;
    showEField: boolean;
    showCells: boolean;
    showInteractions: boolean;
    showCutoffRadius: boolean;
    fieldPreset: FieldPreset;
    eFieldPreset: ElectricFieldPreset;
    cutoffRadius: number;
    stepsPerFrame: number;
    onSimulationStep: () => void;
    isPeriodic: boolean;
}

export function useCanvasRenderer({
    canvasRef,
    particleData,
    width,
    height,
    running,
    isDark,
    theme,
    coordinateScale,
    visualScale,
    baseParticleRadius,
    typeColors,
    vectorFieldRef,
    electricFieldRef,
    neighborListRef,
    showField,
    showEField,
    showCells,
    showInteractions,
    showCutoffRadius,
    fieldPreset,
    eFieldPreset,
    cutoffRadius,
    stepsPerFrame,
    onSimulationStep,
    isPeriodic,
}: UseCanvasRendererProps) {
    const fieldCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const fieldImageRef = useRef<ImageData | null>(null);

    // Track boundary crossings for arrow indicator
    const prevPositionsRef = useRef<Float32Array | null>(null);
    const flashTimersRef = useRef<Float32Array | null>(null);
    const flashDirectionsRef = useRef<Float32Array | null>(null); // Store direction particle came from
    const FLASH_DURATION = 30; // ~0.5s at 60fps

    // Handle high-DPI displays for crisp rendering
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

    const setupCanvasDPI = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        // Set display size (CSS)
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        // Set actual size in memory (scaled for DPI)
        canvas.width = width * dpr;
        canvas.height = height * dpr;

        // Scale context to match DPI
        ctx.scale(dpr, dpr);
    };

    // Setup canvas DPI when dimensions change
    useEffect(() => {
        setupCanvasDPI();
    }, [width, height, dpr]);

    // Update field visualization
    const updateFieldVisualization = () => {
        if (!vectorFieldRef.current) return;

        fieldImageRef.current = vectorFieldRef.current.renderToImageData('potential', isDark);

        if (fieldCanvasRef.current) {
            const ctx = fieldCanvasRef.current.getContext('2d');
            if (ctx && fieldImageRef.current) {
                ctx.putImageData(fieldImageRef.current, 0, 0);
            }
        }
    };

    // Initialize/update field canvas dimensions when vectorField changes
    useEffect(() => {
        if (vectorFieldRef.current) {
            const gridWidth = vectorFieldRef.current.config.gridWidth;
            const gridHeight = vectorFieldRef.current.config.gridHeight;

            if (!fieldCanvasRef.current) {
                fieldCanvasRef.current = document.createElement('canvas');
            }
            // Always update dimensions to match current vectorField
            if (fieldCanvasRef.current.width !== gridWidth || fieldCanvasRef.current.height !== gridHeight) {
                fieldCanvasRef.current.width = gridWidth;
                fieldCanvasRef.current.height = gridHeight;
            }

            updateFieldVisualization();
        }
    }, [vectorFieldRef.current, isDark]);

    // Update field visualization when theme changes
    useEffect(() => {
        updateFieldVisualization();
    }, [isDark]);

    // Animation loop with typed array optimizations
    useEffect(() => {
        if (!particleData) return;

        let animationFrameId: number;

        const render = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) return;

            // Reset transform and apply DPI scaling
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            ctx.strokeStyle = isDark ? '#444' : '#000000';
            ctx.fillStyle = theme.canvasBg;
            ctx.fillRect(0, 0, width, height);

            // Draw vector field background (stretched to fill canvas)
            if (showField && fieldPreset !== 'none' && fieldCanvasRef.current) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(fieldCanvasRef.current, 0, 0, width, height);
            }

            ctx.strokeRect(0, 0, width, height);

            // Draw electric field arrows
            if (showEField && electricFieldRef.current && eFieldPreset !== 'none') {
                electricFieldRef.current.drawArrows(ctx, width, height, isDark);
            }

            // Update simulation if running
            if (running) {
                // Run multiple simulation steps per frame
                for (let i = 0; i < stepsPerFrame; i++) {
                    onSimulationStep();
                }
            }

            // Efficiently draw particles from typed arrays
            const positions = particleData.positions;
            const types = particleData.types;
            const visualRadius = baseParticleRadius * visualScale; // Visual scale only affects circle size

            // Debug: Draw cell grid (square cells)
            if (showCells && neighborListRef.current) {
                const stats = neighborListRef.current.getStats();
                const [nCellsX, nCellsY] = stats.nCells;
                const cellSize = stats.cellSize;

                ctx.strokeStyle = 'rgba(100, 100, 255, 0.3)';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);

                // Draw vertical lines
                for (let i = 0; i <= nCellsX; i++) {
                    const x = i * cellSize * coordinateScale;
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, height);
                    ctx.stroke();
                }

                // Draw horizontal lines
                for (let j = 0; j <= nCellsY; j++) {
                    const y = j * cellSize * coordinateScale;
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(width, y);
                    ctx.stroke();
                }

                ctx.setLineDash([]);
            }

            // Debug: Draw interaction lines between neighbor pairs
            if (showInteractions && neighborListRef.current) {
                ctx.lineWidth = 1;

                // Box dimensions for PBC wrapping detection
                const boxW = width;
                const boxH = height;
                const halfBoxW = boxW / 2;
                const halfBoxH = boxH / 2;

                neighborListRef.current.forEachPair((i, j, dx, dy, rSq) => {
                    const idxI = i * 2;
                    const idxJ = j * 2;

                    const x1 = positions[idxI] * coordinateScale;
                    const y1 = positions[idxI + 1] * coordinateScale;
                    const x2 = positions[idxJ] * coordinateScale;
                    const y2 = positions[idxJ + 1] * coordinateScale;

                    // Color by distance (closer = more red)
                    const r = Math.sqrt(rSq);
                    const intensity = Math.max(0, 1 - r / cutoffRadius);
                    ctx.strokeStyle = `rgba(255, ${Math.floor(100 * (1 - intensity))}, ${Math.floor(100 * (1 - intensity))}, ${0.3 + 0.5 * intensity})`;

                    // Check if this interaction wraps across periodic boundary
                    const screenDx = x2 - x1;
                    const screenDy = y2 - y1;
                    const wrapsX = isPeriodic && Math.abs(screenDx) > halfBoxW;
                    const wrapsY = isPeriodic && Math.abs(screenDy) > halfBoxH;

                    if (wrapsX || wrapsY) {
                        // Draw wrapped lines - from each particle toward the boundary
                        // Use the minimum image dx, dy (already computed by neighbor list)
                        const miDx = dx * coordinateScale;
                        const miDy = dy * coordinateScale;

                        // Line from particle i toward j (using minimum image direction)
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        // Draw halfway along the minimum image vector, but clip at boundary
                        let endX1 = x1 + miDx;
                        let endY1 = y1 + miDy;
                        // Clip to box edges
                        if (endX1 < 0) endX1 = 0;
                        if (endX1 > boxW) endX1 = boxW;
                        if (endY1 < 0) endY1 = 0;
                        if (endY1 > boxH) endY1 = boxH;
                        ctx.lineTo(endX1, endY1);
                        ctx.stroke();

                        // Line from particle j back toward i (opposite direction)
                        ctx.beginPath();
                        ctx.moveTo(x2, y2);
                        let endX2 = x2 - miDx;
                        let endY2 = y2 - miDy;
                        // Clip to box edges
                        if (endX2 < 0) endX2 = 0;
                        if (endX2 > boxW) endX2 = boxW;
                        if (endY2 < 0) endY2 = 0;
                        if (endY2 > boxH) endY2 = boxH;
                        ctx.lineTo(endX2, endY2);
                        ctx.stroke();
                    } else {
                        // Normal line within the box
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.stroke();
                    }
                }, particleData.count);
            }

            // Debug: Draw cutoff radius around first particle
            if (showCutoffRadius && particleData.count > 0) {
                const x = positions[0] * coordinateScale;
                const y = positions[1] * coordinateScale;
                const cutoffPixels = cutoffRadius * coordinateScale;

                ctx.strokeStyle = 'rgba(0, 200, 100, 0.5)';
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 3]);
                ctx.beginPath();
                ctx.arc(x, y, cutoffPixels, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            ctx.strokeStyle = isDark ? '#555' : '#000000';
            ctx.lineWidth = 0.5;

            // Initialize flash tracking arrays if needed
            if (!flashTimersRef.current || flashTimersRef.current.length < particleData.count) {
                flashTimersRef.current = new Float32Array(particleData.count);
            }
            if (!flashDirectionsRef.current || flashDirectionsRef.current.length < particleData.count * 2) {
                flashDirectionsRef.current = new Float32Array(particleData.count * 2);
            }
            if (!prevPositionsRef.current || prevPositionsRef.current.length < particleData.count * 2) {
                prevPositionsRef.current = new Float32Array(particleData.count * 2);
                // Initialize with current positions
                prevPositionsRef.current.set(positions.subarray(0, particleData.count * 2));
            }

            // Box dimensions for boundary crossing detection
            const boxWidth = width / coordinateScale;
            const boxHeight = height / coordinateScale;
            const halfBoxWidth = boxWidth / 2;
            const halfBoxHeight = boxHeight / 2;

            for (let i = 0; i < particleData.count; i++) {
                const idx = i * 2;
                const typeIdx = types[i];

                // Convert position from angstroms to pixels using fixed coordinate scale
                const screenX = positions[idx] * coordinateScale;
                const screenY = positions[idx + 1] * coordinateScale;

                // Detect boundary crossing (position jumped more than half box)
                if (isPeriodic && running) {
                    const dx = positions[idx] - prevPositionsRef.current[idx];
                    const dy = positions[idx + 1] - prevPositionsRef.current[idx + 1];

                    if (Math.abs(dx) > halfBoxWidth || Math.abs(dy) > halfBoxHeight) {
                        flashTimersRef.current[i] = FLASH_DURATION;
                        // Store direction particle came from
                        // If dx > 0 (jumped right, meaning it wrapped from right edge), arrow points right
                        // If dx < 0 (jumped left, meaning it wrapped from left edge), arrow points left
                        const jumpDx = dx > halfBoxWidth ? 1 : (dx < -halfBoxWidth ? -1 : 0);
                        const jumpDy = dy > halfBoxHeight ? 1 : (dy < -halfBoxHeight ? -1 : 0);
                        flashDirectionsRef.current[idx] = jumpDx;
                        flashDirectionsRef.current[idx + 1] = jumpDy;
                    }
                }

                // Decrement flash timers
                if (flashTimersRef.current[i] > 0) {
                    flashTimersRef.current[i]--;
                }

                // Update previous positions
                prevPositionsRef.current[idx] = positions[idx];
                prevPositionsRef.current[idx + 1] = positions[idx + 1];

                // Draw the particle
                ctx.beginPath();
                ctx.arc(screenX, screenY, visualRadius, 0, 2 * Math.PI);
                ctx.fillStyle = typeColors[typeIdx];
                ctx.fill();
                ctx.stroke();

                // Draw arrow and circle indicating where particle came from
                if (flashTimersRef.current[i] > 0 && flashDirectionsRef.current) {
                    const flashIntensity = flashTimersRef.current[i] / FLASH_DURATION;
                    const dirX = flashDirectionsRef.current[idx];
                    const dirY = flashDirectionsRef.current[idx + 1];

                    // Green highlight circle
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, visualRadius + 3 + flashIntensity * 3, 0, 2 * Math.PI);
                    ctx.strokeStyle = `rgba(50, 220, 100, ${flashIntensity * 0.9})`;
                    ctx.lineWidth = 3;
                    ctx.stroke();

                    if (dirX !== 0 || dirY !== 0) {
                        // Arrow parameters - bigger and bolder
                        const arrowLength = 20 + flashIntensity * 8;
                        const arrowHeadSize = 8;
                        const startOffset = visualRadius + 6;

                        // Arrow start and end points
                        const startX = screenX + dirX * startOffset;
                        const startY = screenY + dirY * startOffset;
                        const endX = screenX + dirX * (startOffset + arrowLength);
                        const endY = screenY + dirY * (startOffset + arrowLength);

                        ctx.strokeStyle = `rgba(50, 220, 100, ${flashIntensity * 0.95})`;
                        ctx.fillStyle = `rgba(50, 220, 100, ${flashIntensity * 0.95})`;
                        ctx.lineWidth = 3;

                        // Draw arrow line
                        ctx.beginPath();
                        ctx.moveTo(startX, startY);
                        ctx.lineTo(endX, endY);
                        ctx.stroke();

                        // Draw arrowhead
                        const angle = Math.atan2(dirY, dirX);
                        ctx.beginPath();
                        ctx.moveTo(endX, endY);
                        ctx.lineTo(
                            endX - arrowHeadSize * Math.cos(angle - Math.PI / 6),
                            endY - arrowHeadSize * Math.sin(angle - Math.PI / 6)
                        );
                        ctx.lineTo(
                            endX - arrowHeadSize * Math.cos(angle + Math.PI / 6),
                            endY - arrowHeadSize * Math.sin(angle + Math.PI / 6)
                        );
                        ctx.closePath();
                        ctx.fill();
                    }

                    // Reset styles
                    ctx.lineWidth = 0.5;
                    ctx.strokeStyle = isDark ? '#555' : '#000000';
                }
            }

            animationFrameId = window.requestAnimationFrame(render);
        };

        render();

        return () => {
            window.cancelAnimationFrame(animationFrameId);
        };
    }, [
        particleData, running, baseParticleRadius, width, height,
        stepsPerFrame, visualScale, typeColors, showCells,
        showInteractions, showCutoffRadius, cutoffRadius, isDark,
        theme, dpr, showField, fieldPreset, showEField, eFieldPreset,
        onSimulationStep, isPeriodic, coordinateScale
    ]);

    return {
        updateFieldVisualization,
        fieldCanvasRef,
        fieldImageRef,
    };
}
