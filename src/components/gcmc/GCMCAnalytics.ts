/**
 * GCMC-specific analytics engine.
 * Tracks particle count, energy, acceptance rates, RDF, and P(N) histogram.
 */

import { GCMCParticleData } from './GCMCParticleData';
import { TrialMoveType } from './MCEngine';

export interface GCMCSnapshot {
    step: number;
    particleCount: number;
    particleCountsByType: number[];
    totalEnergy: number;
    density: number;
    acceptanceRates: Record<TrialMoveType, number>;
}

export interface GCMCRadialDistribution {
    r: number[];
    gr: number[];
    gr_partial: Record<string, number[]>;
    binWidth: number;
    maxRadius: number;
    sampleCount: number;
}

export interface DensityProfile {
    y: number[];             // bin centres (Å)
    rho: number[];           // total density per bin
    rhoByType: number[][];   // density per type per bin
    binWidth: number;
    sampleCount: number;
}

export class GCMCAnalyticsEngine {
    private snapshots: GCMCSnapshot[] = [];
    private maxHistory: number;

    // P(N) histogram
    private particleCountHistogram: Map<number, number> = new Map();
    private histogramSamples = 0;

    // Density profiles (x, y, radial) with sliding window
    private densityProfileX: DensityProfile;
    private densityProfileY: DensityProfile;
    private radialProfile: DensityProfile;
    private densityNumTypes: number;
    private densityWindow: number;     // max samples to keep
    private densityNumBins: number;
    // Ring buffers: each entry is one sample's bin counts [total, type0, type1, ...]
    // For x, y, and radial, stored as flat arrays for efficiency
    private densityRingX: number[][];
    private densityRingY: number[][];
    private densityRingR: number[][];
    private densityRingHead = 0;
    private densityRingCount = 0;

    // RDF
    private rdf: GCMCRadialDistribution;
    private rdfAccumulator: number[];
    private rdfPartialAccumulators: Record<string, number[]>;
    private rdfSampleCount = 0;

    constructor(
        maxHistory: number = 2000,
        rdfMaxRadius: number = 15.0,
        rdfBins: number = 100,
        densityBins: number = 40,
        numTypes: number = 2,
        densityWindow: number = 500,
    ) {
        this.maxHistory = maxHistory;
        this.densityNumTypes = numTypes;
        this.densityNumBins = densityBins;
        this.densityWindow = densityWindow;

        const makeDensityProfile = (): DensityProfile => ({
            y: new Array(densityBins).fill(0),
            rho: new Array(densityBins).fill(0),
            rhoByType: Array.from({ length: numTypes }, () => new Array(densityBins).fill(0)),
            binWidth: 1,
            sampleCount: 0,
        });
        this.densityProfileX = makeDensityProfile();
        this.densityProfileY = makeDensityProfile();
        this.radialProfile = makeDensityProfile();

        // Pre-allocate ring buffers
        // Each entry: [bin0_total, bin0_type0, bin0_type1, ..., bin1_total, ...]
        // Width per entry = densityBins * (1 + numTypes)
        this.densityRingX = [];
        this.densityRingY = [];
        this.densityRingR = [];

        const binWidth = rdfMaxRadius / rdfBins;
        const r = Array.from({ length: rdfBins }, (_, i) => (i + 0.5) * binWidth);
        this.rdf = {
            r,
            gr: new Array(rdfBins).fill(0),
            gr_partial: {},
            binWidth,
            maxRadius: rdfMaxRadius,
            sampleCount: 0,
        };
        this.rdfAccumulator = new Array(rdfBins).fill(0);
        this.rdfPartialAccumulators = {};
    }

    recordSnapshot(snapshot: GCMCSnapshot): void {
        this.snapshots.push(snapshot);
        if (this.snapshots.length > this.maxHistory) {
            this.snapshots.shift();
        }

        // Update P(N) histogram
        const n = snapshot.particleCount;
        this.particleCountHistogram.set(n, (this.particleCountHistogram.get(n) ?? 0) + 1);
        this.histogramSamples++;
    }

    /**
     * Calculate RDF from current particle configuration.
     */
    calculateRDF(
        data: GCMCParticleData,
        boxWidth: number,
        boxHeight: number
    ): void {
        const N = data.count;
        if (N < 2) return;

        const { binWidth, maxRadius } = this.rdf;
        const numBins = this.rdf.r.length;
        const halfW = boxWidth / 2;
        const halfH = boxHeight / 2;
        const area = boxWidth * boxHeight;

        const localBins = new Array(numBins).fill(0);

        for (let i = 0; i < N; i++) {
            for (let j = i + 1; j < N; j++) {
                let dx = data.positions[j * 2] - data.positions[i * 2];
                let dy = data.positions[j * 2 + 1] - data.positions[i * 2 + 1];

                if (dx > halfW) dx -= boxWidth;
                else if (dx < -halfW) dx += boxWidth;
                if (dy > halfH) dy -= boxHeight;
                else if (dy < -halfH) dy += boxHeight;

                const r = Math.sqrt(dx * dx + dy * dy);
                if (r < maxRadius) {
                    const bin = Math.floor(r / binWidth);
                    if (bin < numBins) {
                        localBins[bin] += 2; // count both i-j and j-i

                        // Partial RDF
                        const key = `${Math.min(data.types[i], data.types[j])}-${Math.max(data.types[i], data.types[j])}`;
                        if (!this.rdfPartialAccumulators[key]) {
                            this.rdfPartialAccumulators[key] = new Array(numBins).fill(0);
                        }
                        this.rdfPartialAccumulators[key][bin] += 2;
                    }
                }
            }
        }

        // Accumulate
        for (let b = 0; b < numBins; b++) {
            this.rdfAccumulator[b] += localBins[b];
        }
        this.rdfSampleCount++;

        // Normalize to g(r) -- 2D: ring area = 2*pi*r*dr
        const density = N / area;
        for (let b = 0; b < numBins; b++) {
            const r = this.rdf.r[b];
            const shellArea = 2 * Math.PI * r * binWidth;
            const idealCount = density * shellArea * N;
            this.rdf.gr[b] = idealCount > 0
                ? this.rdfAccumulator[b] / (this.rdfSampleCount * idealCount)
                : 0;
        }

        // Normalize partial RDFs
        this.rdf.gr_partial = {};
        for (const [key, acc] of Object.entries(this.rdfPartialAccumulators)) {
            this.rdf.gr_partial[key] = new Array(numBins).fill(0);
            for (let b = 0; b < numBins; b++) {
                const r = this.rdf.r[b];
                const shellArea = 2 * Math.PI * r * binWidth;
                const idealCount = density * shellArea * N;
                this.rdf.gr_partial[key][b] = idealCount > 0
                    ? acc[b] / (this.rdfSampleCount * idealCount)
                    : 0;
            }
        }

        this.rdf.sampleCount = this.rdfSampleCount;
    }

    /** Set the sliding window length for density profiles. */
    setDensityWindow(window: number): void {
        this.densityWindow = Math.max(10, window);
        // Trim ring buffers if needed
        while (this.densityRingX.length > this.densityWindow) {
            this.densityRingX.shift();
            this.densityRingY.shift();
            this.densityRingR.shift();
        }
        this.densityRingCount = this.densityRingX.length;
    }

    getDensityWindow(): number {
        return this.densityWindow;
    }

    /**
     * Accumulate density profiles with sliding window.
     */
    calculateDensityProfile(
        data: GCMCParticleData,
        boxWidth: number,
        boxHeight: number
    ): void {
        const numBins = this.densityNumBins;
        const nTypes = this.densityNumTypes;
        const binWidthX = boxWidth / numBins;
        const binWidthY = boxHeight / numBins;
        const cx = boxWidth / 2;
        const cy = boxHeight / 2;
        const maxR = Math.min(cx, cy);
        const radialBinWidth = maxR / numBins;

        // Build this sample's bin counts: [total, type0, type1, ...] per bin
        const stride = 1 + nTypes;
        const sampleX = new Array(numBins * stride).fill(0);
        const sampleY = new Array(numBins * stride).fill(0);
        const sampleR = new Array(numBins * stride).fill(0);

        for (let i = 0; i < data.count; i++) {
            const x = data.positions[i * 2];
            const y = data.positions[i * 2 + 1];
            const t = data.types[i];

            const bx = Math.min(numBins - 1, Math.max(0, Math.floor(x / binWidthX)));
            const by = Math.min(numBins - 1, Math.max(0, Math.floor(y / binWidthY)));
            sampleX[bx * stride]++;
            sampleY[by * stride]++;
            if (t < nTypes) {
                sampleX[bx * stride + 1 + t]++;
                sampleY[by * stride + 1 + t]++;
            }

            const dx = x - cx;
            const dy = y - cy;
            const r = Math.sqrt(dx * dx + dy * dy);
            const br = Math.min(numBins - 1, Math.max(0, Math.floor(r / radialBinWidth)));
            sampleR[br * stride]++;
            if (t < nTypes) {
                sampleR[br * stride + 1 + t]++;
            }
        }

        // Push into ring buffer, evict oldest if at capacity
        this.densityRingX.push(sampleX);
        this.densityRingY.push(sampleY);
        this.densityRingR.push(sampleR);
        if (this.densityRingX.length > this.densityWindow) {
            this.densityRingX.shift();
            this.densityRingY.shift();
            this.densityRingR.shift();
        }
        this.densityRingCount = this.densityRingX.length;

        // Sum over window
        const sumX = new Array(numBins * stride).fill(0);
        const sumY = new Array(numBins * stride).fill(0);
        const sumR = new Array(numBins * stride).fill(0);
        for (let s = 0; s < this.densityRingCount; s++) {
            const sx = this.densityRingX[s];
            const sy = this.densityRingY[s];
            const sr = this.densityRingR[s];
            for (let k = 0; k < numBins * stride; k++) {
                sumX[k] += sx[k];
                sumY[k] += sy[k];
                sumR[k] += sr[k];
            }
        }

        const nSamples = this.densityRingCount;
        const stripAreaX = binWidthX * boxHeight;
        const stripAreaY = binWidthY * boxWidth;

        // Set bin centres
        this.densityProfileX.binWidth = binWidthX;
        this.densityProfileY.binWidth = binWidthY;
        this.radialProfile.binWidth = radialBinWidth;

        for (let b = 0; b < numBins; b++) {
            this.densityProfileX.y[b] = (b + 0.5) * binWidthX;
            this.densityProfileY.y[b] = (b + 0.5) * binWidthY;
            this.radialProfile.y[b] = (b + 0.5) * radialBinWidth;

            // X profile
            this.densityProfileX.rho[b] = sumX[b * stride] / (nSamples * stripAreaX);
            for (let t = 0; t < nTypes; t++) {
                this.densityProfileX.rhoByType[t][b] = sumX[b * stride + 1 + t] / (nSamples * stripAreaX);
            }

            // Y profile
            this.densityProfileY.rho[b] = sumY[b * stride] / (nSamples * stripAreaY);
            for (let t = 0; t < nTypes; t++) {
                this.densityProfileY.rhoByType[t][b] = sumY[b * stride + 1 + t] / (nSamples * stripAreaY);
            }

            // Radial profile
            const r = this.radialProfile.y[b];
            const annulusArea = 2 * Math.PI * r * radialBinWidth;
            if (annulusArea > 0) {
                this.radialProfile.rho[b] = sumR[b * stride] / (nSamples * annulusArea);
                for (let t = 0; t < nTypes; t++) {
                    this.radialProfile.rhoByType[t][b] = sumR[b * stride + 1 + t] / (nSamples * annulusArea);
                }
            }
        }

        this.densityProfileX.sampleCount = nSamples;
        this.densityProfileY.sampleCount = nSamples;
        this.radialProfile.sampleCount = nSamples;
    }

    getDensityProfileX(): DensityProfile { return this.densityProfileX; }
    getDensityProfileY(): DensityProfile { return this.densityProfileY; }
    getRadialProfile(): DensityProfile { return this.radialProfile; }

    getSnapshots(): GCMCSnapshot[] {
        return this.snapshots;
    }

    getRDF(): GCMCRadialDistribution {
        return this.rdf;
    }

    getParticleCountHistogram(): { n: number[]; probability: number[] } {
        if (this.histogramSamples === 0) return { n: [], probability: [] };

        const entries = Array.from(this.particleCountHistogram.entries()).sort((a, b) => a[0] - b[0]);
        return {
            n: entries.map(e => e[0]),
            probability: entries.map(e => e[1] / this.histogramSamples),
        };
    }

    getAverageParticleCount(window?: number): number {
        const snaps = window
            ? this.snapshots.slice(-window)
            : this.snapshots;
        if (snaps.length === 0) return 0;
        return snaps.reduce((sum, s) => sum + s.particleCount, 0) / snaps.length;
    }

    getAverageEnergy(window?: number): number {
        const snaps = window
            ? this.snapshots.slice(-window)
            : this.snapshots;
        if (snaps.length === 0) return 0;
        return snaps.reduce((sum, s) => sum + s.totalEnergy, 0) / snaps.length;
    }

    reset(): void {
        this.snapshots = [];
        this.particleCountHistogram.clear();
        this.histogramSamples = 0;
        this.rdfAccumulator.fill(0);
        this.rdfPartialAccumulators = {};
        this.rdfSampleCount = 0;
        this.rdf.gr.fill(0);
        this.rdf.gr_partial = {};
        this.rdf.sampleCount = 0;
        this.densityRingX = [];
        this.densityRingY = [];
        this.densityRingR = [];
        this.densityRingHead = 0;
        this.densityRingCount = 0;
        this.densityProfileX.rho.fill(0);
        this.densityProfileX.rhoByType.forEach(a => a.fill(0));
        this.densityProfileX.sampleCount = 0;
        this.densityProfileY.rho.fill(0);
        this.densityProfileY.rhoByType.forEach(a => a.fill(0));
        this.densityProfileY.sampleCount = 0;
        this.radialProfile.rho.fill(0);
        this.radialProfile.rhoByType.forEach(a => a.fill(0));
        this.radialProfile.sampleCount = 0;
    }
}
