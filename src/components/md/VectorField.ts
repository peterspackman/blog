/**
 * VectorField - A 2D grid-based vector field for external forces
 *
 * Supports:
 * - O(1) lookup per particle (bilinear interpolation optional)
 * - Visualization as background color
 * - Drawing mode for custom barriers
 * - Multiple field types: repulsive, attractive, electric
 */

export interface FieldCell {
    fx: number;  // Force x-component
    fy: number;  // Force y-component
    potential: number;  // Scalar potential (for visualization/energy)
}

export interface VectorFieldConfig {
    gridWidth: number;   // Number of cells in x
    gridHeight: number;  // Number of cells in y
    boxWidth: number;    // Physical width of simulation box
    boxHeight: number;   // Physical height of simulation box
    xMin: number;        // Physical x origin
    yMin: number;        // Physical y origin
}

// Field interaction types
export type FieldInteraction = 'repulsive' | 'attractive' | 'electric';

// Field shape/potential types
export type FieldShape = 'exponential' | 'harmonic' | 'constant';

export interface VectorField {
    // Core lookup
    getForce(x: number, y: number, interpolate?: boolean): { fx: number; fy: number };
    getPotential(x: number, y: number, interpolate?: boolean): number;

    // Field manipulation
    setCell(ix: number, iy: number, fx: number, fy: number, potential: number): void;
    clear(): void;

    // Drawing API - paint potential at world coordinates
    paintAt(worldX: number, worldY: number, radius: number, strength: number, shape: FieldShape): void;
    eraseAt(worldX: number, worldY: number, radius: number): void;

    // Predefined field patterns
    addBarrier(x1: number, y1: number, x2: number, y2: number, strength: number, width: number, shape: FieldShape): void;
    addVerticalSeparator(xPos: number, strength: number, width: number, shape: FieldShape): void;
    addHorizontalSeparator(yPos: number, strength: number, width: number, shape: FieldShape): void;
    addRadialField(cx: number, cy: number, strength: number, falloff: number): void;
    addUniformField(fx: number, fy: number): void;
    addPoint(cx: number, cy: number, strength: number, radius: number, shape: FieldShape): void;

    // Visualization
    renderToImageData(colorScheme: 'potential' | 'magnitude' | 'direction', isDark?: boolean): ImageData;
    getVisualizationCanvas(): HTMLCanvasElement;
    markDirty(): void;

    // Grid info
    readonly config: VectorFieldConfig;
    readonly data: Float32Array;  // Flat array: [fx, fy, potential, fx, fy, potential, ...]

    // Coordinate conversion
    worldToGrid(x: number, y: number): { ix: number; iy: number };
    gridToWorld(ix: number, iy: number): { x: number; y: number };
}

export function createVectorField(config: VectorFieldConfig): VectorField {
    const { gridWidth, gridHeight, boxWidth, boxHeight, xMin, yMin } = config;
    const cellWidth = boxWidth / gridWidth;
    const cellHeight = boxHeight / gridHeight;

    // 3 floats per cell: fx, fy, potential
    const data = new Float32Array(gridWidth * gridHeight * 3);

    // Offscreen canvas for visualization
    let visCanvas: HTMLCanvasElement | null = null;
    let visCtx: CanvasRenderingContext2D | null = null;
    let needsVisUpdate = true;

    const getIndex = (ix: number, iy: number): number => {
        return (iy * gridWidth + ix) * 3;
    };

    const worldToGrid = (x: number, y: number): { ix: number; iy: number; fx: number; fy: number } => {
        // Convert world coords to grid coords
        const gx = (x - xMin) / cellWidth;
        const gy = (y - yMin) / cellHeight;

        // Integer cell indices (clamped)
        const ix = Math.max(0, Math.min(gridWidth - 1, Math.floor(gx)));
        const iy = Math.max(0, Math.min(gridHeight - 1, Math.floor(gy)));

        // Fractional part for interpolation
        const fx = gx - ix;
        const fy = gy - iy;

        return { ix, iy, fx, fy };
    };

    const gridToWorld = (ix: number, iy: number): { x: number; y: number } => {
        return {
            x: xMin + (ix + 0.5) * cellWidth,
            y: yMin + (iy + 0.5) * cellHeight,
        };
    };

    const getForce = (x: number, y: number, interpolate = false): { fx: number; fy: number } => {
        const { ix, iy, fx: fracX, fy: fracY } = worldToGrid(x, y);

        if (!interpolate) {
            const idx = getIndex(ix, iy);
            return { fx: data[idx], fy: data[idx + 1] };
        }

        // Bilinear interpolation
        const ix1 = Math.min(ix + 1, gridWidth - 1);
        const iy1 = Math.min(iy + 1, gridHeight - 1);

        const idx00 = getIndex(ix, iy);
        const idx10 = getIndex(ix1, iy);
        const idx01 = getIndex(ix, iy1);
        const idx11 = getIndex(ix1, iy1);

        const w00 = (1 - fracX) * (1 - fracY);
        const w10 = fracX * (1 - fracY);
        const w01 = (1 - fracX) * fracY;
        const w11 = fracX * fracY;

        return {
            fx: data[idx00] * w00 + data[idx10] * w10 + data[idx01] * w01 + data[idx11] * w11,
            fy: data[idx00 + 1] * w00 + data[idx10 + 1] * w10 + data[idx01 + 1] * w01 + data[idx11 + 1] * w11,
        };
    };

    const getPotential = (x: number, y: number, interpolate = false): number => {
        const { ix, iy, fx: fracX, fy: fracY } = worldToGrid(x, y);

        if (!interpolate) {
            const idx = getIndex(ix, iy);
            return data[idx + 2];
        }

        // Bilinear interpolation
        const ix1 = Math.min(ix + 1, gridWidth - 1);
        const iy1 = Math.min(iy + 1, gridHeight - 1);

        const idx00 = getIndex(ix, iy);
        const idx10 = getIndex(ix1, iy);
        const idx01 = getIndex(ix, iy1);
        const idx11 = getIndex(ix1, iy1);

        const w00 = (1 - fracX) * (1 - fracY);
        const w10 = fracX * (1 - fracY);
        const w01 = (1 - fracX) * fracY;
        const w11 = fracX * fracY;

        return data[idx00 + 2] * w00 + data[idx10 + 2] * w10 + data[idx01 + 2] * w01 + data[idx11 + 2] * w11;
    };

    const setCell = (ix: number, iy: number, fx: number, fy: number, potential: number): void => {
        if (ix < 0 || ix >= gridWidth || iy < 0 || iy >= gridHeight) return;
        const idx = getIndex(ix, iy);
        data[idx] = fx;
        data[idx + 1] = fy;
        data[idx + 2] = potential;
        needsVisUpdate = true;
    };

    const clear = (): void => {
        data.fill(0);
        needsVisUpdate = true;
    };

    // Calculate potential/force factor based on shape
    const getShapeFactor = (dist: number, radius: number, shape: FieldShape): number => {
        if (dist >= radius) return 0;
        const normalizedDist = dist / radius;

        switch (shape) {
            case 'exponential':
                // Exponential decay: strong at center, falls off smoothly
                return Math.exp(-3 * normalizedDist) * (1 - normalizedDist);
            case 'harmonic':
                // Harmonic/quadratic: (1 - r/R)^2
                return (1 - normalizedDist) * (1 - normalizedDist);
            case 'constant':
                // Constant within radius
                return 1;
            default:
                return 1 - normalizedDist;
        }
    };

    // Paint potential at world coordinates (for drawing mode)
    const paintAt = (worldX: number, worldY: number, radius: number, strength: number, shape: FieldShape): void => {
        // Convert radius to grid cells
        const radiusCellsX = Math.ceil(radius / cellWidth);
        const radiusCellsY = Math.ceil(radius / cellHeight);

        const { ix: centerIx, iy: centerIy } = worldToGrid(worldX, worldY);

        for (let dy = -radiusCellsY; dy <= radiusCellsY; dy++) {
            for (let dx = -radiusCellsX; dx <= radiusCellsX; dx++) {
                const ix = centerIx + dx;
                const iy = centerIy + dy;

                if (ix < 0 || ix >= gridWidth || iy < 0 || iy >= gridHeight) continue;

                // Get cell center in world coords
                const { x: cx, y: cy } = gridToWorld(ix, iy);
                const distX = cx - worldX;
                const distY = cy - worldY;
                const dist = Math.sqrt(distX * distX + distY * distY);

                if (dist < radius && dist > 0.001) {
                    const factor = getShapeFactor(dist, radius, shape);
                    const forceMag = strength * factor / dist;

                    const idx = getIndex(ix, iy);
                    // Accumulate forces pointing away from paint center (repulsive)
                    data[idx] += distX * forceMag;
                    data[idx + 1] += distY * forceMag;
                    data[idx + 2] += strength * factor;  // Potential
                }
            }
        }
        needsVisUpdate = true;
    };

    // Erase potential at world coordinates
    const eraseAt = (worldX: number, worldY: number, radius: number): void => {
        const radiusCellsX = Math.ceil(radius / cellWidth);
        const radiusCellsY = Math.ceil(radius / cellHeight);

        const { ix: centerIx, iy: centerIy } = worldToGrid(worldX, worldY);

        for (let dy = -radiusCellsY; dy <= radiusCellsY; dy++) {
            for (let dx = -radiusCellsX; dx <= radiusCellsX; dx++) {
                const ix = centerIx + dx;
                const iy = centerIy + dy;

                if (ix < 0 || ix >= gridWidth || iy < 0 || iy >= gridHeight) continue;

                const { x: cx, y: cy } = gridToWorld(ix, iy);
                const distX = cx - worldX;
                const distY = cy - worldY;
                const dist = Math.sqrt(distX * distX + distY * distY);

                if (dist < radius) {
                    const idx = getIndex(ix, iy);
                    // Fade out based on distance from eraser center
                    const fade = dist / radius;
                    data[idx] *= fade;
                    data[idx + 1] *= fade;
                    data[idx + 2] *= fade;
                }
            }
        }
        needsVisUpdate = true;
    };

    // Add a point source (repulsive or attractive based on sign of strength)
    const addPoint = (cx: number, cy: number, strength: number, radius: number, shape: FieldShape): void => {
        for (let iy = 0; iy < gridHeight; iy++) {
            for (let ix = 0; ix < gridWidth; ix++) {
                const { x: px, y: py } = gridToWorld(ix, iy);

                const dx = px - cx;
                const dy = py - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 0.001 && dist < radius) {
                    const factor = getShapeFactor(dist, radius, shape);
                    const forceMag = strength * factor / dist;

                    const idx = getIndex(ix, iy);
                    data[idx] += dx * forceMag;
                    data[idx + 1] += dy * forceMag;
                    data[idx + 2] += strength * factor;
                }
            }
        }
        needsVisUpdate = true;
    };

    // Add a line barrier that repels particles
    const addBarrier = (x1: number, y1: number, x2: number, y2: number, strength: number, width: number, shape: FieldShape): void => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return;

        for (let iy = 0; iy < gridHeight; iy++) {
            for (let ix = 0; ix < gridWidth; ix++) {
                const { x: cx, y: cy } = gridToWorld(ix, iy);

                // Project point onto line segment
                const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / (len * len)));
                const projX = x1 + t * dx;
                const projY = y1 + t * dy;

                // Distance to line
                const distX = cx - projX;
                const distY = cy - projY;
                const dist = Math.sqrt(distX * distX + distY * distY);

                if (dist < width && dist > 0.001) {
                    const factor = getShapeFactor(dist, width, shape);
                    const forceMag = strength * factor / dist;

                    const idx = getIndex(ix, iy);
                    data[idx] += distX * forceMag;
                    data[idx + 1] += distY * forceMag;
                    data[idx + 2] += strength * factor;
                }
            }
        }
        needsVisUpdate = true;
    };

    const addVerticalSeparator = (xPos: number, strength: number, width: number, shape: FieldShape): void => {
        for (let iy = 0; iy < gridHeight; iy++) {
            for (let ix = 0; ix < gridWidth; ix++) {
                const { x: cx } = gridToWorld(ix, iy);
                const dist = Math.abs(cx - xPos);

                if (dist < width) {
                    const factor = getShapeFactor(dist, width, shape);
                    const sign = cx < xPos ? -1 : 1;

                    const idx = getIndex(ix, iy);
                    data[idx] += strength * factor * sign;
                    data[idx + 2] += strength * factor;
                }
            }
        }
        needsVisUpdate = true;
    };

    const addHorizontalSeparator = (yPos: number, strength: number, width: number, shape: FieldShape): void => {
        for (let iy = 0; iy < gridHeight; iy++) {
            for (let ix = 0; ix < gridWidth; ix++) {
                const { y: cy } = gridToWorld(ix, iy);
                const dist = Math.abs(cy - yPos);

                if (dist < width) {
                    const factor = getShapeFactor(dist, width, shape);
                    const sign = cy < yPos ? -1 : 1;

                    const idx = getIndex(ix, iy);
                    data[idx + 1] += strength * factor * sign;
                    data[idx + 2] += strength * factor;
                }
            }
        }
        needsVisUpdate = true;
    };

    const addRadialField = (cx: number, cy: number, strength: number, falloff: number): void => {
        for (let iy = 0; iy < gridHeight; iy++) {
            for (let ix = 0; ix < gridWidth; ix++) {
                const { x: px, y: py } = gridToWorld(ix, iy);

                const dx = px - cx;
                const dy = py - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 0.001) {
                    const factor = strength * Math.exp(-dist / falloff);
                    const idx = getIndex(ix, iy);
                    data[idx] += (dx / dist) * factor;
                    data[idx + 1] += (dy / dist) * factor;
                    data[idx + 2] += Math.abs(factor);
                }
            }
        }
        needsVisUpdate = true;
    };

    const addUniformField = (fx: number, fy: number): void => {
        const potential = Math.sqrt(fx * fx + fy * fy);
        for (let iy = 0; iy < gridHeight; iy++) {
            for (let ix = 0; ix < gridWidth; ix++) {
                const idx = getIndex(ix, iy);
                data[idx] += fx;
                data[idx + 1] += fy;
                data[idx + 2] += potential;
            }
        }
        needsVisUpdate = true;
    };

    const ensureVisCanvas = (): void => {
        if (!visCanvas) {
            visCanvas = document.createElement('canvas');
            visCanvas.width = gridWidth;
            visCanvas.height = gridHeight;
            visCtx = visCanvas.getContext('2d');
        }
    };

    const renderToImageData = (colorScheme: 'potential' | 'magnitude' | 'direction', isDark = false): ImageData => {
        ensureVisCanvas();
        if (!visCtx) throw new Error('Failed to get canvas context');

        const imageData = visCtx.createImageData(gridWidth, gridHeight);
        const pixels = imageData.data;

        // Find max for normalization (skip zero cells)
        let maxPotential = 0;
        let maxMagnitude = 0;
        for (let i = 0; i < gridWidth * gridHeight; i++) {
            const idx = i * 3;
            const potential = Math.abs(data[idx + 2]);
            const magnitude = Math.sqrt(data[idx] * data[idx] + data[idx + 1] * data[idx + 1]);
            if (potential > maxPotential) maxPotential = potential;
            if (magnitude > maxMagnitude) maxMagnitude = magnitude;
        }

        // Background color based on theme
        const bgR = isDark ? 26 : 255;
        const bgG = isDark ? 26 : 255;
        const bgB = isDark ? 26 : 255;

        for (let iy = 0; iy < gridHeight; iy++) {
            for (let ix = 0; ix < gridWidth; ix++) {
                const dataIdx = (iy * gridWidth + ix) * 3;
                // No Y flip needed - simulation Y=0 is at top, same as canvas
                const pixelIdx = (iy * gridWidth + ix) * 4;

                const potential = data[dataIdx + 2];
                const fx = data[dataIdx];
                const fy = data[dataIdx + 1];
                const magnitude = Math.sqrt(fx * fx + fy * fy);

                // Alpha based on potential strength
                const alpha = maxPotential > 0 ? Math.min(1, Math.abs(potential) / maxPotential) : 0;

                if (alpha < 0.01) {
                    // Transparent - show background
                    pixels[pixelIdx] = bgR;
                    pixels[pixelIdx + 1] = bgG;
                    pixels[pixelIdx + 2] = bgB;
                    pixels[pixelIdx + 3] = 255;
                } else {
                    // Color based on potential sign (blue = repulsive, red = attractive)
                    // Repulsive potentials are positive (particles pushed away)
                    if (potential > 0) {
                        // Repulsive - blue/cyan
                        pixels[pixelIdx] = Math.floor(bgR * (1 - alpha) + 100 * alpha);
                        pixels[pixelIdx + 1] = Math.floor(bgG * (1 - alpha) + 180 * alpha);
                        pixels[pixelIdx + 2] = Math.floor(bgB * (1 - alpha) + 255 * alpha);
                    } else {
                        // Attractive - red/orange
                        pixels[pixelIdx] = Math.floor(bgR * (1 - alpha) + 255 * alpha);
                        pixels[pixelIdx + 1] = Math.floor(bgG * (1 - alpha) + 100 * alpha);
                        pixels[pixelIdx + 2] = Math.floor(bgB * (1 - alpha) + 100 * alpha);
                    }
                    pixels[pixelIdx + 3] = 255;
                }
            }
        }

        needsVisUpdate = false;
        return imageData;
    };

    const getVisualizationCanvas = (): HTMLCanvasElement => {
        ensureVisCanvas();
        if (needsVisUpdate && visCtx) {
            const imageData = renderToImageData('potential');
            visCtx.putImageData(imageData, 0, 0);
        }
        return visCanvas!;
    };

    const markDirty = (): void => {
        needsVisUpdate = true;
    };

    return {
        getForce,
        getPotential,
        setCell,
        clear,
        paintAt,
        eraseAt,
        addBarrier,
        addVerticalSeparator,
        addHorizontalSeparator,
        addRadialField,
        addUniformField,
        addPoint,
        renderToImageData,
        getVisualizationCanvas,
        markDirty,
        config,
        data,
        worldToGrid: (x, y) => {
            const result = worldToGrid(x, y);
            return { ix: result.ix, iy: result.iy };
        },
        gridToWorld,
    };
}

// Predefined field presets (potential-based, affects all particles equally)
export type FieldPreset = 'none' | 'draw' | 'vertical-wall' | 'horizontal-wall' | 'box-walls' |
                          'center-repel' | 'center-attract' | 'electrode-walls';

export interface FieldOptions {
    strength?: number;
    width?: number;
    shape?: FieldShape;
    interaction?: FieldInteraction;
}

export function applyFieldPreset(
    field: VectorField,
    preset: FieldPreset,
    options: FieldOptions = {}
): void {
    const { strength = 50, width = 15, shape = 'harmonic' } = options;
    const { boxWidth, boxHeight, xMin, yMin } = field.config;
    const centerX = xMin + boxWidth / 2;
    const centerY = yMin + boxHeight / 2;

    // Don't clear for 'draw' mode - that's user-controlled
    if (preset !== 'draw') {
        field.clear();
    }

    switch (preset) {
        case 'vertical-wall':
            field.addVerticalSeparator(centerX, strength, width, shape);
            break;
        case 'horizontal-wall':
            field.addHorizontalSeparator(centerY, strength, width, shape);
            break;
        case 'box-walls':
            // Add walls on all 4 sides
            field.addVerticalSeparator(xMin + width / 2, strength, width, shape);
            field.addVerticalSeparator(xMin + boxWidth - width / 2, strength, width, shape);
            field.addHorizontalSeparator(yMin + width / 2, strength, width, shape);
            field.addHorizontalSeparator(yMin + boxHeight - width / 2, strength, width, shape);
            break;
        case 'center-repel':
            field.addPoint(centerX, centerY, strength, Math.min(boxWidth, boxHeight) / 2, shape);
            break;
        case 'center-attract':
            field.addPoint(centerX, centerY, -strength, Math.min(boxWidth, boxHeight) / 2, shape);
            break;
        case 'electrode-walls':
            // Left and right electrode walls (for battery simulation)
            // Left wall at ~15% from left edge, right wall at ~85% from left edge
            // This creates a clear region (15%-85%) for particles to migrate through
            // Particles should start to the LEFT of the left wall (0-15% region)
            const wallWidth = width * 0.6;
            const leftWallX = xMin + boxWidth * 0.15;
            const rightWallX = xMin + boxWidth * 0.85;
            field.addVerticalSeparator(leftWallX, strength * 2, wallWidth, shape);
            field.addVerticalSeparator(rightWallX, strength * 2, wallWidth, shape);
            break;
        case 'draw':
        case 'none':
        default:
            // No preset - either drawing mode or cleared
            break;
    }
}
