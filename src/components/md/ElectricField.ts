/**
 * ElectricField - A coarse grid-based electric field for charge-dependent forces
 *
 * Separate from the potential field (VectorField) which affects all particles equally.
 * This field affects particles based on their charge (type).
 *
 * Visualized as arrows on a coarse grid.
 */

export interface ElectricFieldConfig {
    gridWidth: number;   // Number of cells in x (coarse, e.g. 8-16)
    gridHeight: number;  // Number of cells in y
    boxWidth: number;    // Physical width of simulation box
    boxHeight: number;   // Physical height of simulation box
    xMin: number;
    yMin: number;
}

export type ElectricFieldPreset = 'none' | 'draw' | 'uniform-right' | 'uniform-down' | 'uniform-left' | 'uniform-up' |
                                   'radial-out' | 'radial-in' | 'dipole-horizontal' | 'dipole-vertical' | 'quadrupole' |
                                   'battery-lr' | 'battery-rl';

export interface ElectricField {
    // Core lookup - returns field vector at position
    getField(x: number, y: number, interpolate?: boolean): { ex: number; ey: number };

    // Field manipulation
    setCell(ix: number, iy: number, ex: number, ey: number): void;
    addToCell(ix: number, iy: number, dex: number, dey: number): void;
    clear(): void;

    // Drawing API
    paintAt(worldX: number, worldY: number, ex: number, ey: number, radius: number): void;
    perturbAt(worldX: number, worldY: number, dex: number, dey: number, radius: number): void;

    // Presets
    applyPreset(preset: ElectricFieldPreset, strength: number): void;

    // Coordinate conversion
    worldToGrid(x: number, y: number): { ix: number; iy: number };
    gridToWorld(ix: number, iy: number): { x: number; y: number };

    // Rendering - draw arrows on a canvas context
    drawArrows(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, isDark: boolean): void;

    // Grid info
    readonly config: ElectricFieldConfig;
    readonly data: Float32Array;  // Flat array: [ex, ey, ex, ey, ...]
}

export function createElectricField(config: ElectricFieldConfig): ElectricField {
    const { gridWidth, gridHeight, boxWidth, boxHeight, xMin, yMin } = config;
    const cellWidth = boxWidth / gridWidth;
    const cellHeight = boxHeight / gridHeight;

    // 2 floats per cell: ex, ey
    const data = new Float32Array(gridWidth * gridHeight * 2);

    const getIndex = (ix: number, iy: number): number => {
        return (iy * gridWidth + ix) * 2;
    };

    const worldToGrid = (x: number, y: number): { ix: number; iy: number } => {
        const gx = (x - xMin) / cellWidth;
        const gy = (y - yMin) / cellHeight;
        const ix = Math.max(0, Math.min(gridWidth - 1, Math.floor(gx)));
        const iy = Math.max(0, Math.min(gridHeight - 1, Math.floor(gy)));
        return { ix, iy };
    };

    const gridToWorld = (ix: number, iy: number): { x: number; y: number } => {
        return {
            x: xMin + (ix + 0.5) * cellWidth,
            y: yMin + (iy + 0.5) * cellHeight,
        };
    };

    const getField = (x: number, y: number, interpolate = false): { ex: number; ey: number } => {
        const gx = (x - xMin) / cellWidth;
        const gy = (y - yMin) / cellHeight;
        const ix = Math.max(0, Math.min(gridWidth - 1, Math.floor(gx)));
        const iy = Math.max(0, Math.min(gridHeight - 1, Math.floor(gy)));

        if (!interpolate) {
            const idx = getIndex(ix, iy);
            return { ex: data[idx], ey: data[idx + 1] };
        }

        // Bilinear interpolation
        const fx = gx - ix;
        const fy = gy - iy;
        const ix1 = Math.min(ix + 1, gridWidth - 1);
        const iy1 = Math.min(iy + 1, gridHeight - 1);

        const idx00 = getIndex(ix, iy);
        const idx10 = getIndex(ix1, iy);
        const idx01 = getIndex(ix, iy1);
        const idx11 = getIndex(ix1, iy1);

        const w00 = (1 - fx) * (1 - fy);
        const w10 = fx * (1 - fy);
        const w01 = (1 - fx) * fy;
        const w11 = fx * fy;

        return {
            ex: data[idx00] * w00 + data[idx10] * w10 + data[idx01] * w01 + data[idx11] * w11,
            ey: data[idx00 + 1] * w00 + data[idx10 + 1] * w10 + data[idx01 + 1] * w01 + data[idx11 + 1] * w11,
        };
    };

    const setCell = (ix: number, iy: number, ex: number, ey: number): void => {
        if (ix < 0 || ix >= gridWidth || iy < 0 || iy >= gridHeight) return;
        const idx = getIndex(ix, iy);
        data[idx] = ex;
        data[idx + 1] = ey;
    };

    const addToCell = (ix: number, iy: number, dex: number, dey: number): void => {
        if (ix < 0 || ix >= gridWidth || iy < 0 || iy >= gridHeight) return;
        const idx = getIndex(ix, iy);
        data[idx] += dex;
        data[idx + 1] += dey;
    };

    const clear = (): void => {
        data.fill(0);
    };

    // Paint field at world coordinates (set cells within radius)
    const paintAt = (worldX: number, worldY: number, ex: number, ey: number, radius: number): void => {
        const radiusCellsX = Math.ceil(radius / cellWidth);
        const radiusCellsY = Math.ceil(radius / cellHeight);
        const { ix: centerIx, iy: centerIy } = worldToGrid(worldX, worldY);

        for (let dy = -radiusCellsY; dy <= radiusCellsY; dy++) {
            for (let dx = -radiusCellsX; dx <= radiusCellsX; dx++) {
                const ix = centerIx + dx;
                const iy = centerIy + dy;
                if (ix < 0 || ix >= gridWidth || iy < 0 || iy >= gridHeight) continue;

                const { x: cx, y: cy } = gridToWorld(ix, iy);
                const distSq = (cx - worldX) ** 2 + (cy - worldY) ** 2;
                if (distSq <= radius * radius) {
                    // Blend based on distance
                    const dist = Math.sqrt(distSq);
                    const blend = 1 - dist / radius;
                    const idx = getIndex(ix, iy);
                    data[idx] = data[idx] * (1 - blend) + ex * blend;
                    data[idx + 1] = data[idx + 1] * (1 - blend) + ey * blend;
                }
            }
        }
    };

    // Perturb field (add to existing)
    const perturbAt = (worldX: number, worldY: number, dex: number, dey: number, radius: number): void => {
        const radiusCellsX = Math.ceil(radius / cellWidth);
        const radiusCellsY = Math.ceil(radius / cellHeight);
        const { ix: centerIx, iy: centerIy } = worldToGrid(worldX, worldY);

        for (let dy = -radiusCellsY; dy <= radiusCellsY; dy++) {
            for (let dx = -radiusCellsX; dx <= radiusCellsX; dx++) {
                const ix = centerIx + dx;
                const iy = centerIy + dy;
                if (ix < 0 || ix >= gridWidth || iy < 0 || iy >= gridHeight) continue;

                const { x: cx, y: cy } = gridToWorld(ix, iy);
                const distSq = (cx - worldX) ** 2 + (cy - worldY) ** 2;
                if (distSq <= radius * radius) {
                    const dist = Math.sqrt(distSq);
                    const factor = 1 - dist / radius;
                    const idx = getIndex(ix, iy);
                    data[idx] += dex * factor;
                    data[idx + 1] += dey * factor;
                }
            }
        }
    };

    const applyPreset = (preset: ElectricFieldPreset, strength: number): void => {
        clear();

        const centerX = xMin + boxWidth / 2;
        const centerY = yMin + boxHeight / 2;

        switch (preset) {
            case 'uniform-right':
                for (let iy = 0; iy < gridHeight; iy++) {
                    for (let ix = 0; ix < gridWidth; ix++) {
                        setCell(ix, iy, strength, 0);
                    }
                }
                break;
            case 'uniform-left':
                for (let iy = 0; iy < gridHeight; iy++) {
                    for (let ix = 0; ix < gridWidth; ix++) {
                        setCell(ix, iy, -strength, 0);
                    }
                }
                break;
            case 'uniform-down':
                for (let iy = 0; iy < gridHeight; iy++) {
                    for (let ix = 0; ix < gridWidth; ix++) {
                        setCell(ix, iy, 0, strength);
                    }
                }
                break;
            case 'uniform-up':
                for (let iy = 0; iy < gridHeight; iy++) {
                    for (let ix = 0; ix < gridWidth; ix++) {
                        setCell(ix, iy, 0, -strength);
                    }
                }
                break;
            case 'radial-out':
                for (let iy = 0; iy < gridHeight; iy++) {
                    for (let ix = 0; ix < gridWidth; ix++) {
                        const { x, y } = gridToWorld(ix, iy);
                        const dx = x - centerX;
                        const dy = y - centerY;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > 0.001) {
                            setCell(ix, iy, (dx / dist) * strength, (dy / dist) * strength);
                        }
                    }
                }
                break;
            case 'radial-in':
                for (let iy = 0; iy < gridHeight; iy++) {
                    for (let ix = 0; ix < gridWidth; ix++) {
                        const { x, y } = gridToWorld(ix, iy);
                        const dx = x - centerX;
                        const dy = y - centerY;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > 0.001) {
                            setCell(ix, iy, -(dx / dist) * strength, -(dy / dist) * strength);
                        }
                    }
                }
                break;
            case 'dipole-horizontal':
                // Positive charge on left, negative on right
                for (let iy = 0; iy < gridHeight; iy++) {
                    for (let ix = 0; ix < gridWidth; ix++) {
                        const { x, y } = gridToWorld(ix, iy);
                        // Field from positive charge (left)
                        const dx1 = x - (centerX - boxWidth * 0.25);
                        const dy1 = y - centerY;
                        const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
                        // Field from negative charge (right)
                        const dx2 = x - (centerX + boxWidth * 0.25);
                        const dy2 = y - centerY;
                        const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

                        let ex = 0, ey = 0;
                        if (dist1 > 0.001) {
                            ex += (dx1 / dist1) * strength / (1 + dist1 * 0.1);
                            ey += (dy1 / dist1) * strength / (1 + dist1 * 0.1);
                        }
                        if (dist2 > 0.001) {
                            ex -= (dx2 / dist2) * strength / (1 + dist2 * 0.1);
                            ey -= (dy2 / dist2) * strength / (1 + dist2 * 0.1);
                        }
                        setCell(ix, iy, ex, ey);
                    }
                }
                break;
            case 'dipole-vertical':
                // Positive charge on top, negative on bottom
                for (let iy = 0; iy < gridHeight; iy++) {
                    for (let ix = 0; ix < gridWidth; ix++) {
                        const { x, y } = gridToWorld(ix, iy);
                        const dx1 = x - centerX;
                        const dy1 = y - (centerY - boxHeight * 0.25);
                        const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
                        const dx2 = x - centerX;
                        const dy2 = y - (centerY + boxHeight * 0.25);
                        const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

                        let ex = 0, ey = 0;
                        if (dist1 > 0.001) {
                            ex += (dx1 / dist1) * strength / (1 + dist1 * 0.1);
                            ey += (dy1 / dist1) * strength / (1 + dist1 * 0.1);
                        }
                        if (dist2 > 0.001) {
                            ex -= (dx2 / dist2) * strength / (1 + dist2 * 0.1);
                            ey -= (dy2 / dist2) * strength / (1 + dist2 * 0.1);
                        }
                        setCell(ix, iy, ex, ey);
                    }
                }
                break;
            case 'quadrupole':
                // Four charges in a square
                const charges = [
                    { x: centerX - boxWidth * 0.2, y: centerY - boxHeight * 0.2, q: 1 },
                    { x: centerX + boxWidth * 0.2, y: centerY - boxHeight * 0.2, q: -1 },
                    { x: centerX - boxWidth * 0.2, y: centerY + boxHeight * 0.2, q: -1 },
                    { x: centerX + boxWidth * 0.2, y: centerY + boxHeight * 0.2, q: 1 },
                ];
                for (let iy = 0; iy < gridHeight; iy++) {
                    for (let ix = 0; ix < gridWidth; ix++) {
                        const { x, y } = gridToWorld(ix, iy);
                        let ex = 0, ey = 0;
                        for (const charge of charges) {
                            const dx = x - charge.x;
                            const dy = y - charge.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist > 0.001) {
                                ex += charge.q * (dx / dist) * strength / (1 + dist * 0.1);
                                ey += charge.q * (dy / dist) * strength / (1 + dist * 0.1);
                            }
                        }
                        setCell(ix, iy, ex, ey);
                    }
                }
                break;
            case 'battery-lr':
                // Battery: uniform field left to right (drives + ions right)
                // Field is slightly weaker near electrodes (like real battery with concentration gradients)
                for (let iy = 0; iy < gridHeight; iy++) {
                    for (let ix = 0; ix < gridWidth; ix++) {
                        const { x } = gridToWorld(ix, iy);
                        // Slightly reduce field near edges (electrode regions)
                        const edgeDist = Math.min(x - xMin, xMin + boxWidth - x);
                        const edgeFactor = Math.min(1, edgeDist / (boxWidth * 0.15));
                        setCell(ix, iy, strength * edgeFactor, 0);
                    }
                }
                break;
            case 'battery-rl':
                // Battery: uniform field right to left (drives + ions left)
                for (let iy = 0; iy < gridHeight; iy++) {
                    for (let ix = 0; ix < gridWidth; ix++) {
                        const { x } = gridToWorld(ix, iy);
                        const edgeDist = Math.min(x - xMin, xMin + boxWidth - x);
                        const edgeFactor = Math.min(1, edgeDist / (boxWidth * 0.15));
                        setCell(ix, iy, -strength * edgeFactor, 0);
                    }
                }
                break;
            case 'draw':
            case 'none':
            default:
                break;
        }
    };

    const drawArrows = (ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, isDark: boolean): void => {
        const cellPixelsX = canvasWidth / gridWidth;
        const cellPixelsY = canvasHeight / gridHeight;
        const maxArrowLength = Math.min(cellPixelsX, cellPixelsY) * 0.4;

        // Find max magnitude for normalization
        let maxMag = 0;
        for (let i = 0; i < gridWidth * gridHeight; i++) {
            const idx = i * 2;
            const mag = Math.sqrt(data[idx] ** 2 + data[idx + 1] ** 2);
            if (mag > maxMag) maxMag = mag;
        }
        if (maxMag === 0) return;

        ctx.save();
        ctx.strokeStyle = isDark ? '#ffcc00' : '#cc8800';
        ctx.fillStyle = isDark ? '#ffcc00' : '#cc8800';
        ctx.lineWidth = 1.5;

        for (let iy = 0; iy < gridHeight; iy++) {
            for (let ix = 0; ix < gridWidth; ix++) {
                const idx = getIndex(ix, iy);
                const ex = data[idx];
                const ey = data[idx + 1];
                const mag = Math.sqrt(ex * ex + ey * ey);

                if (mag < maxMag * 0.01) continue;  // Skip very small arrows

                // Arrow center in canvas coords
                const cx = (ix + 0.5) * cellPixelsX;
                const cy = (iy + 0.5) * cellPixelsY;

                // Arrow length proportional to magnitude
                const arrowLen = (mag / maxMag) * maxArrowLength;
                const normX = ex / mag;
                const normY = ey / mag;

                // Draw arrow line
                const startX = cx - normX * arrowLen / 2;
                const startY = cy - normY * arrowLen / 2;
                const endX = cx + normX * arrowLen / 2;
                const endY = cy + normY * arrowLen / 2;

                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();

                // Draw arrowhead
                const headLen = Math.min(6, arrowLen * 0.4);
                const angle = Math.atan2(normY, normX);
                const headAngle = Math.PI / 5;

                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(endX - headLen * Math.cos(angle - headAngle), endY - headLen * Math.sin(angle - headAngle));
                ctx.lineTo(endX - headLen * Math.cos(angle + headAngle), endY - headLen * Math.sin(angle + headAngle));
                ctx.closePath();
                ctx.fill();
            }
        }

        ctx.restore();
    };

    return {
        getField,
        setCell,
        addToCell,
        clear,
        paintAt,
        perturbAt,
        applyPreset,
        worldToGrid,
        gridToWorld,
        drawArrows,
        config,
        data,
    };
}
