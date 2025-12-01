// Boltzmann constant in eV/K
const kB = 8.617333262e-5;

export interface ParticleSystemData {
    positions: Float32Array;
    velocities: Float32Array;
    accelerations: Float32Array;
    masses: Float32Array;
    count: number;
}

export abstract class Thermostat {
    protected targetTemperature: number;  // Kelvin
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

    // Get thermal energy kB*T in eV
    protected get kBT(): number {
        return kB * this.targetTemperature;
    }

    protected calculateCurrentTemperature(particleData: ParticleSystemData): number {
        const { velocities, masses, count } = particleData;
        let totalKE = 0;

        for (let i = 0; i < count; i++) {
            const idx = i * 2;
            const vx = velocities[idx];
            const vy = velocities[idx + 1];
            const v2 = vx * vx + vy * vy;
            totalKE += 0.5 * masses[i] * v2;  // KE in eV (mass in amu, v in Å/time_unit)
        }

        // Temperature in 2D: T = 2*KE / (2N * k_B) = KE / (N * k_B)
        // Factor of 2 in numerator for 2D, 2N degrees of freedom
        return totalKE / (count * kB);  // Returns Kelvin
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
    private baseFriction: number;  // Base friction coefficient γ in 1/time_unit
    private randomForces: Float32Array;

    // Default friction: γ = 0.01 gives relaxation time τ = 100 internal units ≈ 1 ps
    // This is appropriate for liquids/gases - not too aggressive
    constructor(targetTemperature: number, timeStep: number, friction: number = 0.01) {
        super(targetTemperature, timeStep);
        this.baseFriction = friction;
        this.randomForces = new Float32Array(0);
    }

    apply(particleData: ParticleSystemData): void {
        const { velocities, masses, count } = particleData;

        // Resize random forces array if needed
        if (this.randomForces.length !== count * 2) {
            this.randomForces = new Float32Array(count * 2);
        }

        // Check current temperature and adapt friction
        const currentTemp = this.calculateCurrentTemperature(particleData);
        const tempRatio = currentTemp / Math.max(1, this.targetTemperature);

        // Adaptive friction: increase when temperature is way above target
        // At 2x target temp, friction is 2x base
        // At 10x target temp, friction is 10x base (capped at 20x)
        // Below target, use base friction
        const adaptiveFriction = tempRatio > 1.5
            ? this.baseFriction * Math.min(20, tempRatio)
            : this.baseFriction;

        // Generate random forces (Box-Muller transform for Gaussian distribution)
        for (let i = 0; i < count * 2; i += 2) {
            const u1 = Math.random();
            const u2 = Math.random();
            const magnitude = Math.sqrt(-2 * Math.log(Math.max(1e-10, u1)));
            this.randomForces[i] = magnitude * Math.cos(2 * Math.PI * u2);
            this.randomForces[i + 1] = magnitude * Math.sin(2 * Math.PI * u2);
        }

        // Langevin equation: m*dv/dt = -γ*m*v + sqrt(2*γ*m*kB*T) * noise
        // Discretized: dv = -γ*v*dt + sqrt(2*γ*kB*T/m) * sqrt(dt) * noise
        //
        // Note: When using adaptive friction for damping, we still use base friction
        // for the random force term to maintain proper equilibration to target temp

        const thermalEnergy = this.kBT;  // eV
        const dt = this.timeStep;
        const sqrtDt = Math.sqrt(dt);

        for (let i = 0; i < count; i++) {
            const idx = i * 2;
            const mass = masses[i];

            // Friction term uses adaptive friction for stronger damping when hot
            const frictionFactorX = -adaptiveFriction * velocities[idx] * dt;
            const frictionFactorY = -adaptiveFriction * velocities[idx + 1] * dt;

            // Random term uses base friction to maintain proper temperature target
            const sigma = Math.sqrt(2 * this.baseFriction * thermalEnergy / mass);
            const randomX = sigma * sqrtDt * this.randomForces[idx];
            const randomY = sigma * sqrtDt * this.randomForces[idx + 1];

            // Update velocities
            velocities[idx] += frictionFactorX + randomX;
            velocities[idx + 1] += frictionFactorY + randomY;
        }
    }

    setFriction(friction: number): void {
        this.baseFriction = Math.max(0, friction);
    }

    getFriction(): number {
        return this.baseFriction;
    }

    getDescription(): string {
        return "Langevin thermostat with adaptive friction";
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
        const thermalEnergy = this.kBT;  // eV

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
        const thermostatForce = (2 * totalKE - dof * thermalEnergy) / Q;

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
    NONE = 'none',
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
): Thermostat | null {
    switch (type) {
        case ThermostatType.NONE:
            return null;  // NVE - no thermostat
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
                options?.friction ?? 0.01
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