// Cell list with Verlet skin for efficient neighbor finding
// Achieves O(N) scaling for uniform density systems

export interface NeighborPair {
    i: number;
    j: number;
    dx: number;  // Minimum image displacement x
    dy: number;  // Minimum image displacement y
    rSquared: number;
}

export interface NeighborListConfig {
    boxWidth: number;
    boxHeight: number;
    xMin: number;
    yMin: number;
    cutoff: number;
    skin: number;           // Extra distance for Verlet list (rebuild when atoms move > skin/2)
    isPeriodic: boolean;
    maxNeighborsPerAtom: number;
    rebuildInterval: number; // Rebuild at most every N steps
}

export class NeighborList {
    // Box parameters
    private boxWidth: number;
    private boxHeight: number;
    private halfBoxWidth: number;
    private halfBoxHeight: number;
    private xMin: number;
    private yMin: number;
    private isPeriodic: boolean;

    // Cutoff parameters
    private cutoff: number;
    private skin: number;
    private effectiveCutoff: number;  // cutoff + skin
    private effectiveCutoffSq: number;
    private cutoffSq: number;

    // Cell list parameters (square cells for simpler distance checks)
    private cellSize: number;
    private nCellsX: number;
    private nCellsY: number;
    private head: Int32Array;   // First atom index in each cell (-1 if empty)
    private next: Int32Array;   // Next atom in linked list (-1 if end)
    private cellVisited: Uint8Array;  // Reusable array to track visited cells during neighbor search

    // Neighbor list (Verlet list)
    private maxAtoms: number;
    private maxNeighborsPerAtom: number;
    private neighborIndices: Int32Array;    // Flat array: [atom0_neighbors..., atom1_neighbors..., ...]
    private neighborCounts: Int32Array;     // Number of neighbors per atom
    private neighborDx: Float32Array;       // Cached minimum image dx
    private neighborDy: Float32Array;       // Cached minimum image dy
    private neighborRSq: Float32Array;      // Cached r²

    // Verlet list management
    private lastBuildPositions: Float32Array;
    private needsRebuild: boolean = true;
    private rebuildInterval: number;
    private stepsSinceRebuild: number = 0;
    private totalPairs: number = 0;

    constructor(config: NeighborListConfig, maxAtoms: number) {
        this.boxWidth = config.boxWidth;
        this.boxHeight = config.boxHeight;
        this.halfBoxWidth = config.boxWidth / 2;
        this.halfBoxHeight = config.boxHeight / 2;
        this.xMin = config.xMin;
        this.yMin = config.yMin;
        this.isPeriodic = config.isPeriodic;

        this.cutoff = config.cutoff;
        this.skin = config.skin;
        this.effectiveCutoff = config.cutoff + config.skin;
        this.effectiveCutoffSq = this.effectiveCutoff * this.effectiveCutoff;
        this.cutoffSq = config.cutoff * config.cutoff;

        this.maxAtoms = maxAtoms;
        this.maxNeighborsPerAtom = config.maxNeighborsPerAtom;
        this.rebuildInterval = config.rebuildInterval;

        // Calculate cell grid dimensions with square cells
        // Cell size = 2 * effectiveCutoff ensures correct neighbor searching
        // Use the smaller dimension to determine cell count, ensuring square cells
        const targetCellSize = 2 * this.effectiveCutoff;
        const minDim = Math.min(this.boxWidth, this.boxHeight);
        const nCellsMin = Math.max(1, Math.floor(minDim / targetCellSize));
        this.cellSize = minDim / nCellsMin;
        this.nCellsX = Math.max(1, Math.floor(this.boxWidth / this.cellSize));
        this.nCellsY = Math.max(1, Math.floor(this.boxHeight / this.cellSize));

        // Allocate cell list arrays
        const nCells = this.nCellsX * this.nCellsY;
        this.head = new Int32Array(nCells);
        this.next = new Int32Array(maxAtoms);
        this.cellVisited = new Uint8Array(nCells);

        // Allocate neighbor list arrays (fixed size as requested)
        const maxPairs = maxAtoms * this.maxNeighborsPerAtom;
        this.neighborIndices = new Int32Array(maxPairs);
        this.neighborCounts = new Int32Array(maxAtoms);
        this.neighborDx = new Float32Array(maxPairs);
        this.neighborDy = new Float32Array(maxPairs);
        this.neighborRSq = new Float32Array(maxPairs);

        // Position cache for checking displacement
        this.lastBuildPositions = new Float32Array(maxAtoms * 2);
    }

    // Update box parameters (e.g., after resize)
    updateBox(boxWidth: number, boxHeight: number, xMin: number, yMin: number): void {
        this.boxWidth = boxWidth;
        this.boxHeight = boxHeight;
        this.halfBoxWidth = boxWidth / 2;
        this.halfBoxHeight = boxHeight / 2;
        this.xMin = xMin;
        this.yMin = yMin;

        // Recalculate cell grid with square cells (cell size = 2 * effectiveCutoff)
        const targetCellSize = 2 * this.effectiveCutoff;
        const minDim = Math.min(this.boxWidth, this.boxHeight);
        const nCellsMin = Math.max(1, Math.floor(minDim / targetCellSize));
        this.cellSize = minDim / nCellsMin;
        this.nCellsX = Math.max(1, Math.floor(this.boxWidth / this.cellSize));
        this.nCellsY = Math.max(1, Math.floor(this.boxHeight / this.cellSize));

        // Reallocate cell arrays if needed
        const nCells = this.nCellsX * this.nCellsY;
        if (this.head.length < nCells) {
            this.head = new Int32Array(nCells);
            this.cellVisited = new Uint8Array(nCells);
        }

        this.needsRebuild = true;
    }

    setPeriodicBoundaries(isPeriodic: boolean): void {
        if (this.isPeriodic !== isPeriodic) {
            this.isPeriodic = isPeriodic;
            this.needsRebuild = true;
        }
    }

    setCutoff(cutoff: number): void {
        if (this.cutoff !== cutoff) {
            this.cutoff = cutoff;
            this.effectiveCutoff = cutoff + this.skin;
            this.effectiveCutoffSq = this.effectiveCutoff * this.effectiveCutoff;
            this.cutoffSq = cutoff * cutoff;

            // Recalculate cell grid with square cells (cell size = 2 * effectiveCutoff)
            const targetCellSize = 2 * this.effectiveCutoff;
            const minDim = Math.min(this.boxWidth, this.boxHeight);
            const nCellsMin = Math.max(1, Math.floor(minDim / targetCellSize));
            this.cellSize = minDim / nCellsMin;
            this.nCellsX = Math.max(1, Math.floor(this.boxWidth / this.cellSize));
            this.nCellsY = Math.max(1, Math.floor(this.boxHeight / this.cellSize));

            this.needsRebuild = true;
        }
    }

    // Apply minimum image convention for periodic boundaries
    minimumImage(dx: number, dy: number): [number, number] {
        if (this.isPeriodic) {
            if (dx > this.halfBoxWidth) dx -= this.boxWidth;
            else if (dx < -this.halfBoxWidth) dx += this.boxWidth;

            if (dy > this.halfBoxHeight) dy -= this.boxHeight;
            else if (dy < -this.halfBoxHeight) dy += this.boxHeight;
        }
        return [dx, dy];
    }

    // Check if rebuild is needed based on atom displacement
    // We use skin/4 as threshold because TWO particles could each move skin/4
    // toward each other, totaling skin/2 of approach - we want some safety margin
    private checkDisplacement(positions: Float32Array, count: number): boolean {
        const thresholdSq = (this.skin / 4) * (this.skin / 4);

        for (let i = 0; i < count; i++) {
            const idx = i * 2;
            let dx = positions[idx] - this.lastBuildPositions[idx];
            let dy = positions[idx + 1] - this.lastBuildPositions[idx + 1];

            // Apply minimum image for displacement check too
            [dx, dy] = this.minimumImage(dx, dy);

            if (dx * dx + dy * dy > thresholdSq) {
                return true;
            }
        }
        return false;
    }

    // Get cell index for a position
    private getCellIndex(x: number, y: number): number {
        // Normalize position relative to box origin
        let nx = x - this.xMin;
        let ny = y - this.yMin;

        // Wrap for periodic boundaries
        if (this.isPeriodic) {
            nx = ((nx % this.boxWidth) + this.boxWidth) % this.boxWidth;
            ny = ((ny % this.boxHeight) + this.boxHeight) % this.boxHeight;
        }

        // Clamp to valid range (using square cellSize)
        const cx = Math.min(this.nCellsX - 1, Math.max(0, Math.floor(nx / this.cellSize)));
        const cy = Math.min(this.nCellsY - 1, Math.max(0, Math.floor(ny / this.cellSize)));

        return cy * this.nCellsX + cx;
    }

    // Build cell list from positions
    private buildCellList(positions: Float32Array, count: number): void {
        // Clear head array
        this.head.fill(-1);

        // Insert atoms into cells using linked list
        for (let i = 0; i < count; i++) {
            const idx = i * 2;
            const cellIdx = this.getCellIndex(positions[idx], positions[idx + 1]);

            this.next[i] = this.head[cellIdx];
            this.head[cellIdx] = i;
        }
    }

    // Build the neighbor list using cell list
    build(positions: Float32Array, count: number): void {
        // Build cell list first
        this.buildCellList(positions, count);

        // Clear neighbor counts
        this.neighborCounts.fill(0);
        this.totalPairs = 0;

        // For each atom, find neighbors in same and adjacent cells
        for (let i = 0; i < count; i++) {
            const idxI = i * 2;
            const xi = positions[idxI];
            const yi = positions[idxI + 1];

            // Get cell coordinates for atom i (using square cellSize)
            let nxi = xi - this.xMin;
            let nyi = yi - this.yMin;
            if (this.isPeriodic) {
                nxi = ((nxi % this.boxWidth) + this.boxWidth) % this.boxWidth;
                nyi = ((nyi % this.boxHeight) + this.boxHeight) % this.boxHeight;
            }
            const cxi = Math.min(this.nCellsX - 1, Math.max(0, Math.floor(nxi / this.cellSize)));
            const cyi = Math.min(this.nCellsY - 1, Math.max(0, Math.floor(nyi / this.cellSize)));

            // Search neighboring cells (including self)
            // Track visited cells to avoid counting pairs multiple times when nCells is small
            for (let dcy = -1; dcy <= 1; dcy++) {
                for (let dcx = -1; dcx <= 1; dcx++) {
                    let ncx = cxi + dcx;
                    let ncy = cyi + dcy;

                    // Handle periodic wrapping of cell indices
                    if (this.isPeriodic) {
                        ncx = ((ncx % this.nCellsX) + this.nCellsX) % this.nCellsX;
                        ncy = ((ncy % this.nCellsY) + this.nCellsY) % this.nCellsY;
                    } else {
                        // Skip out-of-bounds cells for non-periodic
                        if (ncx < 0 || ncx >= this.nCellsX || ncy < 0 || ncy >= this.nCellsY) {
                            continue;
                        }
                    }

                    const neighborCellIdx = ncy * this.nCellsX + ncx;

                    // Skip if we've already visited this cell for this atom
                    if (this.cellVisited[neighborCellIdx] === 1) {
                        continue;
                    }
                    this.cellVisited[neighborCellIdx] = 1;

                    // Iterate through atoms in neighboring cell
                    let j = this.head[neighborCellIdx];
                    while (j >= 0) {
                        // Only consider pairs where j > i to avoid duplicates
                        if (j > i) {
                            const idxJ = j * 2;
                            let dx = positions[idxJ] - xi;
                            let dy = positions[idxJ + 1] - yi;

                            // Apply minimum image convention
                            [dx, dy] = this.minimumImage(dx, dy);

                            const rSq = dx * dx + dy * dy;

                            // Check against effective cutoff (includes skin)
                            if (rSq < this.effectiveCutoffSq) {
                                const neighborIdx = this.neighborCounts[i];

                                if (neighborIdx < this.maxNeighborsPerAtom) {
                                    const pairIdx = i * this.maxNeighborsPerAtom + neighborIdx;
                                    this.neighborIndices[pairIdx] = j;
                                    this.neighborDx[pairIdx] = dx;
                                    this.neighborDy[pairIdx] = dy;
                                    this.neighborRSq[pairIdx] = rSq;
                                    this.neighborCounts[i]++;
                                    this.totalPairs++;
                                }
                            }
                        }
                        j = this.next[j];
                    }
                }
            }

            // Clear visited flags for next atom
            this.cellVisited.fill(0);
        }

        // Cache positions for displacement check
        this.lastBuildPositions.set(positions.subarray(0, count * 2));
        this.needsRebuild = false;
        this.stepsSinceRebuild = 0;
    }

    // Update neighbor list - rebuilds if necessary
    update(positions: Float32Array, count: number): boolean {
        this.stepsSinceRebuild++;

        // Check if we need to rebuild
        const shouldRebuild = this.needsRebuild ||
                              this.stepsSinceRebuild >= this.rebuildInterval ||
                              this.checkDisplacement(positions, count);

        if (shouldRebuild) {
            this.build(positions, count);
            return true;
        }

        // Update displacements for existing pairs (positions have moved slightly)
        this.updateDisplacements(positions, count);
        return false;
    }

    // Update cached displacements without rebuilding
    private updateDisplacements(positions: Float32Array, count: number): void {
        for (let i = 0; i < count; i++) {
            const idxI = i * 2;
            const xi = positions[idxI];
            const yi = positions[idxI + 1];
            const numNeighbors = this.neighborCounts[i];

            for (let n = 0; n < numNeighbors; n++) {
                const pairIdx = i * this.maxNeighborsPerAtom + n;
                const j = this.neighborIndices[pairIdx];
                const idxJ = j * 2;

                let dx = positions[idxJ] - xi;
                let dy = positions[idxJ + 1] - yi;
                [dx, dy] = this.minimumImage(dx, dy);

                this.neighborDx[pairIdx] = dx;
                this.neighborDy[pairIdx] = dy;
                this.neighborRSq[pairIdx] = dx * dx + dy * dy;
            }
        }
    }

    // Force a rebuild on next update
    invalidate(): void {
        this.needsRebuild = true;
    }

    // Iterate over neighbor pairs - callback receives (i, j, dx, dy, rSq)
    forEachPair(callback: (i: number, j: number, dx: number, dy: number, rSq: number) => void, count: number): void {
        for (let i = 0; i < count; i++) {
            const numNeighbors = this.neighborCounts[i];

            for (let n = 0; n < numNeighbors; n++) {
                const pairIdx = i * this.maxNeighborsPerAtom + n;
                const j = this.neighborIndices[pairIdx];
                const dx = this.neighborDx[pairIdx];
                const dy = this.neighborDy[pairIdx];
                const rSq = this.neighborRSq[pairIdx];

                // Only process pairs within actual cutoff (not skin)
                if (rSq < this.cutoffSq) {
                    callback(i, j, dx, dy, rSq);
                }
            }
        }
    }

    // Get statistics for debugging
    getStats(): { totalPairs: number; avgNeighbors: number; nCells: [number, number]; cellSize: number } {
        let totalNeighbors = 0;
        let atomsWithNeighbors = 0;

        for (let i = 0; i < this.neighborCounts.length; i++) {
            if (this.neighborCounts[i] > 0) {
                totalNeighbors += this.neighborCounts[i];
                atomsWithNeighbors++;
            }
        }

        return {
            totalPairs: this.totalPairs,
            avgNeighbors: atomsWithNeighbors > 0 ? totalNeighbors / atomsWithNeighbors : 0,
            nCells: [this.nCellsX, this.nCellsY],
            cellSize: this.cellSize
        };
    }

    getCutoff(): number {
        return this.cutoff;
    }

    getCutoffSquared(): number {
        return this.cutoffSq;
    }
}

// Factory function with sensible defaults
export function createNeighborList(
    boxWidth: number,
    boxHeight: number,
    xMin: number,
    yMin: number,
    maxAtoms: number,
    options?: Partial<NeighborListConfig>
): NeighborList {
    const config: NeighborListConfig = {
        boxWidth,
        boxHeight,
        xMin,
        yMin,
        cutoff: options?.cutoff ?? 12.0,
        skin: options?.skin ?? 2.0,
        isPeriodic: options?.isPeriodic ?? false,
        maxNeighborsPerAtom: options?.maxNeighborsPerAtom ?? 64,
        rebuildInterval: options?.rebuildInterval ?? 20
    };

    return new NeighborList(config, maxAtoms);
}
