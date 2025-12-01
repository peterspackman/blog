import { ParticleSystemData } from './Thermostats';

// Boltzmann constant in eV/K
const kB = 8.617333262e-5;

export interface CollectiveVariable {
    name: string;
    values: number[];
    times: number[];
    unit: string;
    description: string;
}

export interface RadialDistributionFunction {
    r: number[];
    gr: number[];
    gr_partial: { [key: string]: number[] }; // e.g., "0-0", "0-1", "1-1"
    binWidth: number;
    maxRadius: number;
    sampleCount: number;
}

export interface SystemSnapshot {
    time: number;
    temperature: number;
    pressure: number;
    totalEnergy: number;
    kineticEnergy: number;
    potentialEnergy: number;
    density: number;
    volume: number;
}

export class AnalyticsEngine {
    private collectiveVariables: Map<string, CollectiveVariable>;
    private systemSnapshots: SystemSnapshot[];
    private rdf: RadialDistributionFunction;
    private currentTime: number;
    private samplingInterval: number;
    private lastSampleTime: number;
    private maxHistoryLength: number;
    private particleTypes: Uint8Array;

    constructor(
        samplingInterval: number = 1.0,
        maxHistoryLength: number = 1000,
        rdfMaxRadius: number = 10.0,
        rdfBins: number = 100
    ) {
        this.collectiveVariables = new Map();
        this.systemSnapshots = [];
        this.samplingInterval = samplingInterval;
        this.lastSampleTime = 0;
        this.currentTime = 0;
        this.maxHistoryLength = maxHistoryLength;
        this.particleTypes = new Uint8Array(0);

        // Initialize RDF
        const binWidth = rdfMaxRadius / rdfBins;
        this.rdf = {
            r: Array.from({ length: rdfBins }, (_, i) => (i + 0.5) * binWidth),
            gr: new Array(rdfBins).fill(0),
            gr_partial: {},
            binWidth,
            maxRadius: rdfMaxRadius,
            sampleCount: 0
        };

        this.initializeCollectiveVariables();
    }

    private initializeCollectiveVariables(): void {
        const variables = [
            { name: 'temperature', unit: 'K', description: 'Instantaneous temperature' },
            { name: 'pressure', unit: 'eV/Å²', description: 'Instantaneous pressure' },
            { name: 'totalEnergy', unit: 'eV', description: 'Total energy (kinetic + potential)' },
            { name: 'kineticEnergy', unit: 'eV', description: 'Total kinetic energy' },
            { name: 'potentialEnergy', unit: 'eV', description: 'Total potential energy' },
            { name: 'density', unit: 'amu/Å²', description: 'System density (2D)' },
            { name: 'volume', unit: 'Å²', description: 'System area (2D)' },
            { name: 'diffusionCoefficient', unit: 'Å²/time', description: 'Self-diffusion coefficient' },
            { name: 'heatCapacity', unit: 'kB', description: 'Heat capacity at constant volume' }
        ];

        variables.forEach(variable => {
            this.collectiveVariables.set(variable.name, {
                name: variable.name,
                values: [],
                times: [],
                unit: variable.unit,
                description: variable.description
            });
        });
    }

    updateTime(deltaTime: number): void {
        this.currentTime += deltaTime;
    }

    shouldSample(): boolean {
        return (this.currentTime - this.lastSampleTime) >= this.samplingInterval;
    }

    calculateAndSample(
        particleData: ParticleSystemData,
        potentialEnergy: number,
        systemVolume: number,
        virial: number
    ): void {
        if (!this.shouldSample()) return;

        const snapshot = this.calculateSystemProperties(particleData, potentialEnergy, systemVolume, virial);
        this.systemSnapshots.push(snapshot);

        // Update collective variables
        Object.entries(snapshot).forEach(([key, value]) => {
            if (key !== 'time' && this.collectiveVariables.has(key)) {
                const cv = this.collectiveVariables.get(key)!;
                cv.values.push(value);
                cv.times.push(this.currentTime);

                // Limit history length
                if (cv.values.length > this.maxHistoryLength) {
                    cv.values.shift();
                    cv.times.shift();
                }
            }
        });

        // Calculate additional derived properties
        this.calculateDerivedProperties();

        // Update RDF
        this.updateRadialDistributionFunction(particleData, systemVolume);

        this.lastSampleTime = this.currentTime;

        // Limit snapshots history
        if (this.systemSnapshots.length > this.maxHistoryLength) {
            this.systemSnapshots.shift();
        }
    }

    private calculateSystemProperties(
        particleData: ParticleSystemData,
        potentialEnergy: number,
        systemVolume: number,
        virial: number
    ): SystemSnapshot {
        const { velocities, masses, count } = particleData;

        // Calculate kinetic energy and temperature
        let kineticEnergy = 0;
        for (let i = 0; i < count; i++) {
            const idx = i * 2;
            const vx = velocities[idx];
            const vy = velocities[idx + 1];
            kineticEnergy += 0.5 * masses[i] * (vx * vx + vy * vy);
        }

        // Temperature in 2D: T = KE / (N * kB) in Kelvin
        // KE is in eV (from mass in amu, velocity in Å/time_unit)
        const temperature = kineticEnergy / (count * kB);
        const totalEnergy = kineticEnergy + potentialEnergy;

        // Calculate pressure (2D ideal gas + virial correction)
        const pressure = (kineticEnergy + virial) / systemVolume;

        // Calculate density (assuming unit mass for simplicity)
        const totalMass = masses.reduce((sum, mass) => sum + mass, 0);
        const density = totalMass / systemVolume;

        return {
            time: this.currentTime,
            temperature,
            pressure,
            totalEnergy,
            kineticEnergy,
            potentialEnergy,
            density,
            volume: systemVolume
        };
    }

    private calculateDerivedProperties(): void {
        if (this.systemSnapshots.length < 10) return;

        // Calculate heat capacity from energy fluctuations
        const energies = this.systemSnapshots.slice(-50).map(s => s.totalEnergy);
        const temperatures = this.systemSnapshots.slice(-50).map(s => s.temperature);
        
        if (energies.length > 1) {
            const avgEnergy = energies.reduce((sum, e) => sum + e, 0) / energies.length;
            const avgTemp = temperatures.reduce((sum, t) => sum + t, 0) / temperatures.length;
            
            const energyVar = energies.reduce((sum, e) => sum + (e - avgEnergy) ** 2, 0) / (energies.length - 1);
            const heatCapacity = energyVar / (avgTemp * avgTemp);
            
            const heatCapacityCV = this.collectiveVariables.get('heatCapacity')!;
            heatCapacityCV.values.push(heatCapacity);
            heatCapacityCV.times.push(this.currentTime);
            
            if (heatCapacityCV.values.length > this.maxHistoryLength) {
                heatCapacityCV.values.shift();
                heatCapacityCV.times.shift();
            }
        }

        // Calculate diffusion coefficient from mean square displacement (simplified)
        // This would require tracking particle trajectories over time
        const diffusionCV = this.collectiveVariables.get('diffusionCoefficient')!;
        diffusionCV.values.push(0); // Placeholder - would need proper MSD calculation
        diffusionCV.times.push(this.currentTime);
        
        if (diffusionCV.values.length > this.maxHistoryLength) {
            diffusionCV.values.shift();
            diffusionCV.times.shift();
        }
    }

    private updateRadialDistributionFunction(particleData: ParticleSystemData, systemVolume: number): void {
        const { positions, count } = particleData;
        const types = this.particleTypes.length === count ? this.particleTypes : new Uint8Array(count).fill(0);
        
        const binWidth = this.rdf.binWidth;
        const maxRadius = this.rdf.maxRadius;
        const bins = this.rdf.r.length;
        
        // Reset bins for this sample
        const histogram = new Array(bins).fill(0);
        const partialHistograms: { [key: string]: number[] } = {};
        
        // Initialize partial histograms
        const uniqueTypes = Array.from(new Set(types));
        uniqueTypes.forEach(type1 => {
            uniqueTypes.forEach(type2 => {
                if (type1 <= type2) {
                    const key = `${type1}-${type2}`;
                    partialHistograms[key] = new Array(bins).fill(0);
                }
            });
        });

        // Calculate distances and fill histograms
        for (let i = 0; i < count; i++) {
            for (let j = i + 1; j < count; j++) {
                const idx1 = i * 2;
                const idx2 = j * 2;
                
                const dx = positions[idx2] - positions[idx1];
                const dy = positions[idx2 + 1] - positions[idx1 + 1];
                const r = Math.sqrt(dx * dx + dy * dy);
                
                if (r < maxRadius && r > 0) {
                    const binIndex = Math.floor(r / binWidth);
                    if (binIndex < bins) {
                        histogram[binIndex]++;
                        
                        // Update partial histograms
                        const type1 = types[i];
                        const type2 = types[j];
                        const key = type1 <= type2 ? `${type1}-${type2}` : `${type2}-${type1}`;
                        if (partialHistograms[key]) {
                            partialHistograms[key][binIndex]++;
                        }
                    }
                }
            }
        }

        // Normalize to get g(r)
        const density = count / systemVolume;
        for (let i = 0; i < bins; i++) {
            const r = this.rdf.r[i];
            const shellVolume = 2 * Math.PI * r * binWidth; // 2D shell area
            const idealCount = density * shellVolume * count;
            
            // Update running average
            const alpha = 1.0 / (this.rdf.sampleCount + 1);
            this.rdf.gr[i] = (1 - alpha) * this.rdf.gr[i] + alpha * (histogram[i] / idealCount);
            
            // Update partial g(r)
            Object.entries(partialHistograms).forEach(([key, hist]) => {
                if (!this.rdf.gr_partial[key]) {
                    this.rdf.gr_partial[key] = new Array(bins).fill(0);
                }
                this.rdf.gr_partial[key][i] = (1 - alpha) * this.rdf.gr_partial[key][i] + 
                                               alpha * (hist[i] / idealCount);
            });
        }

        this.rdf.sampleCount++;
    }

    setParticleTypes(types: Uint8Array): void {
        this.particleTypes = new Uint8Array(types);
    }

    getCollectiveVariable(name: string): CollectiveVariable | undefined {
        return this.collectiveVariables.get(name);
    }

    getAllCollectiveVariables(): Map<string, CollectiveVariable> {
        return new Map(this.collectiveVariables);
    }

    getRadialDistributionFunction(): RadialDistributionFunction {
        return { ...this.rdf };
    }

    getSystemSnapshots(): SystemSnapshot[] {
        return [...this.systemSnapshots];
    }

    getLatestSnapshot(): SystemSnapshot | undefined {
        return this.systemSnapshots[this.systemSnapshots.length - 1];
    }

    getTimeAverages(windowSize: number = 100): { [key: string]: number } {
        const averages: { [key: string]: number } = {};
        
        this.collectiveVariables.forEach((cv, name) => {
            if (cv.values.length > 0) {
                const window = cv.values.slice(-windowSize);
                averages[name] = window.reduce((sum, val) => sum + val, 0) / window.length;
            }
        });
        
        return averages;
    }

    getFluctuations(windowSize: number = 100): { [key: string]: number } {
        const fluctuations: { [key: string]: number } = {};
        
        this.collectiveVariables.forEach((cv, name) => {
            if (cv.values.length > 1) {
                const window = cv.values.slice(-windowSize);
                const mean = window.reduce((sum, val) => sum + val, 0) / window.length;
                const variance = window.reduce((sum, val) => sum + (val - mean) ** 2, 0) / (window.length - 1);
                fluctuations[name] = Math.sqrt(variance);
            }
        });
        
        return fluctuations;
    }

    exportData(): {
        collectiveVariables: { [key: string]: CollectiveVariable };
        rdf: RadialDistributionFunction;
        snapshots: SystemSnapshot[];
    } {
        const cvData: { [key: string]: CollectiveVariable } = {};
        this.collectiveVariables.forEach((cv, name) => {
            cvData[name] = { ...cv };
        });
        
        return {
            collectiveVariables: cvData,
            rdf: { ...this.rdf },
            snapshots: [...this.systemSnapshots]
        };
    }

    reset(): void {
        this.collectiveVariables.forEach(cv => {
            cv.values = [];
            cv.times = [];
        });
        this.systemSnapshots = [];
        this.rdf.gr.fill(0);
        this.rdf.gr_partial = {};
        this.rdf.sampleCount = 0;
        this.currentTime = 0;
        this.lastSampleTime = 0;
    }

    setSamplingInterval(interval: number): void {
        this.samplingInterval = Math.max(0.1, interval);
    }

    getCurrentTime(): number {
        return this.currentTime;
    }
}