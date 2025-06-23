import { ParticleSystemData } from './Thermostats';
import { Bounds } from './BoundaryConditions';

export interface SystemBox {
    width: number;
    height: number;
    volume: number;
}

export abstract class Barostat {
    protected targetPressure: number;
    protected timeStep: number;
    protected systemBox: SystemBox;

    constructor(targetPressure: number, timeStep: number, systemBox: SystemBox) {
        this.targetPressure = targetPressure;
        this.timeStep = timeStep;
        this.systemBox = systemBox;
    }

    abstract apply(particleData: ParticleSystemData, virial: number): { newBox: SystemBox; scaleFactors: { x: number; y: number } };

    setTargetPressure(pressure: number): void {
        this.targetPressure = pressure;
    }

    setTimeStep(timeStep: number): void {
        this.timeStep = timeStep;
    }

    updateSystemBox(box: SystemBox): void {
        this.systemBox = box;
    }

    protected calculatePressure(particleData: ParticleSystemData, virial: number): number {
        const { velocities, masses, count } = particleData;
        const volume = this.systemBox.volume;

        // Calculate kinetic contribution to pressure
        let kineticPressure = 0;
        for (let i = 0; i < count; i++) {
            const idx = i * 2;
            const vx = velocities[idx];
            const vy = velocities[idx + 1];
            kineticPressure += masses[i] * (vx * vx + vy * vy);
        }
        kineticPressure /= (2 * volume); // 2D pressure

        // Total pressure = kinetic + virial contributions
        const virialPressure = virial / volume;
        return kineticPressure + virialPressure;
    }

    getDescription(): string {
        return "Base barostat class";
    }
}

export class BerendsenBarostat extends Barostat {
    private relaxationTime: number;
    private compressibility: number;

    constructor(
        targetPressure: number,
        timeStep: number,
        systemBox: SystemBox,
        relaxationTime: number = 50.0,
        compressibility: number = 4.5e-5 // typical for liquids
    ) {
        super(targetPressure, timeStep, systemBox);
        this.relaxationTime = relaxationTime;
        this.compressibility = compressibility;
    }

    apply(particleData: ParticleSystemData, virial: number): { newBox: SystemBox; scaleFactors: { x: number; y: number } } {
        const currentPressure = this.calculatePressure(particleData, virial);
        const dt = this.timeStep;
        const tau = this.relaxationTime;
        const beta = this.compressibility;

        // Berendsen pressure scaling
        const pressureDiff = this.targetPressure - currentPressure;
        const scaleFactor = Math.pow(1 - beta * dt * pressureDiff / tau, 1/3); // 1/3 for isotropic scaling in 2D

        const newWidth = this.systemBox.width * scaleFactor;
        const newHeight = this.systemBox.height * scaleFactor;
        const newVolume = newWidth * newHeight;

        return {
            newBox: {
                width: newWidth,
                height: newHeight,
                volume: newVolume
            },
            scaleFactors: {
                x: scaleFactor,
                y: scaleFactor
            }
        };
    }

    setRelaxationTime(relaxationTime: number): void {
        this.relaxationTime = Math.max(1.0, relaxationTime);
    }

    setCompressibility(compressibility: number): void {
        this.compressibility = Math.max(0, compressibility);
    }

    getDescription(): string {
        return "Berendsen barostat for NPT ensemble simulation";
    }
}

export class ParrinelloRahmanBarostat extends Barostat {
    private barostatMass: number;
    private boxMatrix: number[][]; // 2x2 matrix for 2D
    private boxVelocity: number[][]; // 2x2 matrix
    private boxAcceleration: number[][]; // 2x2 matrix

    constructor(
        targetPressure: number,
        timeStep: number,
        systemBox: SystemBox,
        barostatMass: number = 1000.0
    ) {
        super(targetPressure, timeStep, systemBox);
        this.barostatMass = barostatMass;
        
        // Initialize box matrix (diagonal for rectangular box)
        this.boxMatrix = [
            [systemBox.width, 0],
            [0, systemBox.height]
        ];
        this.boxVelocity = [[0, 0], [0, 0]];
        this.boxAcceleration = [[0, 0], [0, 0]];
    }

    apply(particleData: ParticleSystemData, virial: number): { newBox: SystemBox; scaleFactors: { x: number; y: number } } {
        const currentPressure = this.calculatePressure(particleData, virial);
        const dt = this.timeStep;
        const W = this.barostatMass;
        const volume = this.systemBox.volume;

        // Pressure tensor (simplified for isotropic case)
        const pressureTensor = [
            [currentPressure - this.targetPressure, 0],
            [0, currentPressure - this.targetPressure]
        ];

        // Update box acceleration
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
                this.boxAcceleration[i][j] = (volume / W) * pressureTensor[i][j];
            }
        }

        // Update box velocity (velocity Verlet)
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
                this.boxVelocity[i][j] += this.boxAcceleration[i][j] * dt * 0.5;
            }
        }

        // Update box matrix
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
                this.boxMatrix[i][j] += this.boxVelocity[i][j] * dt;
            }
        }

        // Calculate new box dimensions (assuming diagonal matrix)
        const newWidth = Math.abs(this.boxMatrix[0][0]);
        const newHeight = Math.abs(this.boxMatrix[1][1]);
        const newVolume = newWidth * newHeight;

        const scaleX = newWidth / this.systemBox.width;
        const scaleY = newHeight / this.systemBox.height;

        return {
            newBox: {
                width: newWidth,
                height: newHeight,
                volume: newVolume
            },
            scaleFactors: {
                x: scaleX,
                y: scaleY
            }
        };
    }

    reset(): void {
        this.boxMatrix = [
            [this.systemBox.width, 0],
            [0, this.systemBox.height]
        ];
        this.boxVelocity = [[0, 0], [0, 0]];
        this.boxAcceleration = [[0, 0], [0, 0]];
    }

    getDescription(): string {
        return "Parrinello-Rahman barostat with full stress tensor coupling";
    }
}

export class MonteCarloBarostat extends Barostat {
    private attemptFrequency: number;
    private maxVolumeChange: number;
    private stepCounter: number;
    private acceptedMoves: number;
    private totalAttempts: number;

    constructor(
        targetPressure: number,
        timeStep: number,
        systemBox: SystemBox,
        attemptFrequency: number = 25,
        maxVolumeChange: number = 0.01
    ) {
        super(targetPressure, timeStep, systemBox);
        this.attemptFrequency = attemptFrequency;
        this.maxVolumeChange = maxVolumeChange;
        this.stepCounter = 0;
        this.acceptedMoves = 0;
        this.totalAttempts = 0;
    }

    apply(particleData: ParticleSystemData, virial: number): { newBox: SystemBox; scaleFactors: { x: number; y: number } } {
        this.stepCounter++;

        // Only attempt volume moves at specified frequency
        if (this.stepCounter % this.attemptFrequency !== 0) {
            return {
                newBox: this.systemBox,
                scaleFactors: { x: 1.0, y: 1.0 }
            };
        }

        const { count } = particleData;
        const currentVolume = this.systemBox.volume;
        const kT = this.calculateTemperature(particleData);

        // Propose new volume
        const deltaV = (Math.random() - 0.5) * 2 * this.maxVolumeChange * currentVolume;
        const newVolume = currentVolume + deltaV;

        if (newVolume <= 0) {
            return {
                newBox: this.systemBox,
                scaleFactors: { x: 1.0, y: 1.0 }
            };
        }

        // Calculate scale factor (isotropic scaling)
        const scaleFactor = Math.sqrt(newVolume / currentVolume);
        const newWidth = this.systemBox.width * scaleFactor;
        const newHeight = this.systemBox.height * scaleFactor;

        // Monte Carlo acceptance criterion
        const deltaE = -this.targetPressure * deltaV; // Pressure work term
        const configTerm = count * kT * Math.log(newVolume / currentVolume); // Configuration integral
        const deltaA = deltaE + configTerm;

        this.totalAttempts++;
        const accepted = Math.random() < Math.exp(-deltaA / kT);

        if (accepted) {
            this.acceptedMoves++;
            return {
                newBox: {
                    width: newWidth,
                    height: newHeight,
                    volume: newVolume
                },
                scaleFactors: {
                    x: scaleFactor,
                    y: scaleFactor
                }
            };
        }

        return {
            newBox: this.systemBox,
            scaleFactors: { x: 1.0, y: 1.0 }
        };
    }

    private calculateTemperature(particleData: ParticleSystemData): number {
        const { velocities, masses, count } = particleData;
        let totalKE = 0;

        for (let i = 0; i < count; i++) {
            const idx = i * 2;
            const vx = velocities[idx];
            const vy = velocities[idx + 1];
            totalKE += 0.5 * masses[i] * (vx * vx + vy * vy);
        }

        return totalKE / count;
    }

    getAcceptanceRatio(): number {
        return this.totalAttempts > 0 ? this.acceptedMoves / this.totalAttempts : 0;
    }

    resetStatistics(): void {
        this.acceptedMoves = 0;
        this.totalAttempts = 0;
    }

    getDescription(): string {
        return "Monte Carlo barostat with volume move acceptance/rejection";
    }
}

export enum BarostatType {
    BERENDSEN = 'berendsen',
    PARRINELLO_RAHMAN = 'parrinello_rahman',
    MONTE_CARLO = 'monte_carlo'
}

export function createBarostat(
    type: BarostatType,
    targetPressure: number,
    timeStep: number,
    systemBox: SystemBox,
    options?: {
        relaxationTime?: number;
        compressibility?: number;
        barostatMass?: number;
        attemptFrequency?: number;
        maxVolumeChange?: number;
    }
): Barostat {
    switch (type) {
        case BarostatType.BERENDSEN:
            return new BerendsenBarostat(
                targetPressure,
                timeStep,
                systemBox,
                options?.relaxationTime ?? 50.0,
                options?.compressibility ?? 4.5e-5
            );
        case BarostatType.PARRINELLO_RAHMAN:
            return new ParrinelloRahmanBarostat(
                targetPressure,
                timeStep,
                systemBox,
                options?.barostatMass ?? 1000.0
            );
        case BarostatType.MONTE_CARLO:
            return new MonteCarloBarostat(
                targetPressure,
                timeStep,
                systemBox,
                options?.attemptFrequency ?? 25,
                options?.maxVolumeChange ?? 0.01
            );
        default:
            return new BerendsenBarostat(targetPressure, timeStep, systemBox);
    }
}

export function applyBoxScaling(particleData: ParticleSystemData, scaleFactors: { x: number; y: number }): void {
    const { positions, count } = particleData;
    
    for (let i = 0; i < count; i++) {
        const idx = i * 2;
        positions[idx] *= scaleFactors.x;
        positions[idx + 1] *= scaleFactors.y;
    }
}