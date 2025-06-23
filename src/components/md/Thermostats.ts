export interface ParticleSystemData {
    positions: Float32Array;
    velocities: Float32Array;
    accelerations: Float32Array;
    masses: Float32Array;
    count: number;
}

export abstract class Thermostat {
    protected targetTemperature: number;
    protected timeStep: number;

    constructor(targetTemperature: number, timeStep: number) {
        this.targetTemperature = targetTemperature;
        this.timeStep = timeStep;
    }

    abstract apply(particleData: ParticleSystemData): void;
    
    setTargetTemperature(temperature: number): void {
        this.targetTemperature = temperature;
    }

    setTimeStep(timeStep: number): void {
        this.timeStep = timeStep;
    }

    protected calculateCurrentTemperature(particleData: ParticleSystemData): number {
        const { velocities, masses, count } = particleData;
        let totalKE = 0;

        for (let i = 0; i < count; i++) {
            const idx = i * 2;
            const vx = velocities[idx];
            const vy = velocities[idx + 1];
            const v2 = vx * vx + vy * vy;
            totalKE += 0.5 * masses[i] * v2;
        }

        // Temperature in 2D: T = KE / (N * k_B), where k_B = 1 in reduced units
        return totalKE / count;
    }

    getDescription(): string {
        return "Base thermostat class";
    }
}

export class VelocityRescalingThermostat extends Thermostat {
    private couplingStrength: number;

    constructor(targetTemperature: number, timeStep: number, couplingStrength: number = 0.1) {
        super(targetTemperature, timeStep);
        this.couplingStrength = couplingStrength;
    }

    apply(particleData: ParticleSystemData): void {
        const currentTemp = this.calculateCurrentTemperature(particleData);
        
        if (currentTemp > 0.001) {
            const scaleFactor = Math.sqrt(this.targetTemperature / currentTemp);
            const dampedScaleFactor = 1.0 + this.couplingStrength * (scaleFactor - 1.0);
            
            const { velocities, count } = particleData;
            for (let i = 0; i < count; i++) {
                const idx = i * 2;
                velocities[idx] *= dampedScaleFactor;
                velocities[idx + 1] *= dampedScaleFactor;
            }
        }
    }

    setCouplingStrength(strength: number): void {
        this.couplingStrength = Math.max(0, Math.min(1, strength));
    }

    getDescription(): string {
        return "Velocity rescaling thermostat with adjustable coupling strength";
    }
}

export class LangevinThermostat extends Thermostat {
    private friction: number;
    private randomForces: Float32Array;

    constructor(targetTemperature: number, timeStep: number, friction: number = 1.0) {
        super(targetTemperature, timeStep);
        this.friction = friction;
        this.randomForces = new Float32Array(0);
    }

    apply(particleData: ParticleSystemData): void {
        const { velocities, masses, count } = particleData;
        
        // Resize random forces array if needed
        if (this.randomForces.length !== count * 2) {
            this.randomForces = new Float32Array(count * 2);
        }

        // Generate random forces (Box-Muller transform for Gaussian distribution)
        for (let i = 0; i < count * 2; i += 2) {
            const u1 = Math.random();
            const u2 = Math.random();
            const magnitude = Math.sqrt(-2 * Math.log(u1));
            this.randomForces[i] = magnitude * Math.cos(2 * Math.PI * u2);
            this.randomForces[i + 1] = magnitude * Math.sin(2 * Math.PI * u2);
        }

        // Apply Langevin dynamics
        const kT = this.targetTemperature; // Boltzmann constant = 1 in reduced units
        const gamma = this.friction;
        const dt = this.timeStep;
        
        for (let i = 0; i < count; i++) {
            const idx = i * 2;
            const mass = masses[i];
            
            // Friction force: -γ * v
            const frictionX = -gamma * velocities[idx];
            const frictionY = -gamma * velocities[idx + 1];
            
            // Random force: sqrt(2 * γ * k_B * T * m / dt) * ξ
            const randomMagnitude = Math.sqrt(2 * gamma * kT * mass / dt);
            const randomX = randomMagnitude * this.randomForces[idx];
            const randomY = randomMagnitude * this.randomForces[idx + 1];
            
            // Apply forces as velocity changes
            velocities[idx] += (frictionX + randomX) * dt / mass;
            velocities[idx + 1] += (frictionY + randomY) * dt / mass;
        }
    }

    setFriction(friction: number): void {
        this.friction = Math.max(0, friction);
    }

    getFriction(): number {
        return this.friction;
    }

    getDescription(): string {
        return "Langevin thermostat with stochastic dynamics";
    }
}

export class BerendsenThermostat extends Thermostat {
    private relaxationTime: number;

    constructor(targetTemperature: number, timeStep: number, relaxationTime: number = 10.0) {
        super(targetTemperature, timeStep);
        this.relaxationTime = relaxationTime;
    }

    apply(particleData: ParticleSystemData): void {
        const currentTemp = this.calculateCurrentTemperature(particleData);
        
        if (currentTemp > 0.001) {
            const dt = this.timeStep;
            const tau = this.relaxationTime;
            
            // Berendsen scaling factor
            const scaleFactor = Math.sqrt(1 + (dt / tau) * (this.targetTemperature / currentTemp - 1));
            
            const { velocities, count } = particleData;
            for (let i = 0; i < count; i++) {
                const idx = i * 2;
                velocities[idx] *= scaleFactor;
                velocities[idx + 1] *= scaleFactor;
            }
        }
    }

    setRelaxationTime(relaxationTime: number): void {
        this.relaxationTime = Math.max(0.1, relaxationTime);
    }

    getRelaxationTime(): number {
        return this.relaxationTime;
    }

    getDescription(): string {
        return "Berendsen thermostat with exponential temperature relaxation";
    }
}

export class NoseHooverThermostat extends Thermostat {
    private thermostatMass: number;
    private thermostatPosition: number;
    private thermostatVelocity: number;

    constructor(targetTemperature: number, timeStep: number, thermostatMass: number = 1.0) {
        super(targetTemperature, timeStep);
        this.thermostatMass = thermostatMass;
        this.thermostatPosition = 0;
        this.thermostatVelocity = 0;
    }

    apply(particleData: ParticleSystemData): void {
        const { velocities, masses, count } = particleData;
        const dt = this.timeStep;
        const Q = this.thermostatMass;
        const kT = this.targetTemperature;
        
        // Calculate kinetic energy
        let totalKE = 0;
        for (let i = 0; i < count; i++) {
            const idx = i * 2;
            const vx = velocities[idx];
            const vy = velocities[idx + 1];
            totalKE += 0.5 * masses[i] * (vx * vx + vy * vy);
        }

        // Nose-Hoover equations of motion
        const dof = 2 * count; // degrees of freedom in 2D
        const thermostatForce = (2 * totalKE - dof * kT) / Q;
        
        // Update thermostat velocity and position
        this.thermostatVelocity += thermostatForce * dt * 0.5;
        this.thermostatPosition += this.thermostatVelocity * dt;
        
        // Apply thermostat to particle velocities
        const velocityScale = Math.exp(-this.thermostatVelocity * dt);
        for (let i = 0; i < count; i++) {
            const idx = i * 2;
            velocities[idx] *= velocityScale;
            velocities[idx + 1] *= velocityScale;
        }
        
        // Final thermostat velocity update
        this.thermostatVelocity += thermostatForce * dt * 0.5;
    }

    setThermostatMass(mass: number): void {
        this.thermostatMass = Math.max(0.1, mass);
    }

    reset(): void {
        this.thermostatPosition = 0;
        this.thermostatVelocity = 0;
    }

    getDescription(): string {
        return "Nosé-Hoover thermostat for canonical ensemble";
    }
}

export enum ThermostatType {
    VELOCITY_RESCALING = 'velocity_rescaling',
    LANGEVIN = 'langevin',
    BERENDSEN = 'berendsen',
    NOSE_HOOVER = 'nose_hoover'
}

export function createThermostat(
    type: ThermostatType,
    targetTemperature: number,
    timeStep: number,
    options?: {
        couplingStrength?: number;
        friction?: number;
        relaxationTime?: number;
        thermostatMass?: number;
    }
): Thermostat {
    switch (type) {
        case ThermostatType.VELOCITY_RESCALING:
            return new VelocityRescalingThermostat(
                targetTemperature,
                timeStep,
                options?.couplingStrength ?? 0.1
            );
        case ThermostatType.LANGEVIN:
            return new LangevinThermostat(
                targetTemperature,
                timeStep,
                options?.friction ?? 1.0
            );
        case ThermostatType.BERENDSEN:
            return new BerendsenThermostat(
                targetTemperature,
                timeStep,
                options?.relaxationTime ?? 10.0
            );
        case ThermostatType.NOSE_HOOVER:
            return new NoseHooverThermostat(
                targetTemperature,
                timeStep,
                options?.thermostatMass ?? 1.0
            );
        default:
            return new VelocityRescalingThermostat(targetTemperature, timeStep);
    }
}