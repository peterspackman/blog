export interface ForceResult {
    potential: number;
    force: number;
}

export abstract class Potential {
    abstract calculate(r: number, type1: number, type2: number): ForceResult;
    abstract getDescription(): string;
}

export class LennardJonesPotential extends Potential {
    private epsilonMatrix: number[][];
    private sigmaMatrix: number[][];
    private epsilonScale: number;
    private sigmaScale: number;
    private cutoffRadius: number;

    constructor(
        epsilonMatrix: number[][],
        sigmaMatrix: number[][],
        epsilonScale: number = 1.0,
        sigmaScale: number = 1.0,
        cutoffRadius: number = 10.0
    ) {
        super();
        this.epsilonMatrix = epsilonMatrix;
        this.sigmaMatrix = sigmaMatrix;
        this.epsilonScale = epsilonScale;
        this.sigmaScale = sigmaScale;
        this.cutoffRadius = cutoffRadius;
    }

    calculate(r: number, type1: number, type2: number): ForceResult {
        if (r > this.cutoffRadius) {
            return { potential: 0, force: 0 };
        }

        const eps = this.epsilonMatrix[type1][type2] * this.epsilonScale;
        const sig = this.sigmaMatrix[type1][type2] * this.sigmaScale;

        const sigOverR = sig / r;
        const sigOverR6 = Math.pow(sigOverR, 6);
        const sigOverR12 = Math.pow(sigOverR6, 2);

        const potential = 4 * eps * (sigOverR12 - sigOverR6);
        const force = 24 * eps * (sigOverR6 - 2 * sigOverR12) / r;

        return { potential, force };
    }

    updateParameters(epsilonMatrix: number[][], sigmaMatrix: number[][], epsilonScale?: number, sigmaScale?: number): void {
        this.epsilonMatrix = epsilonMatrix;
        this.sigmaMatrix = sigmaMatrix;
        if (epsilonScale !== undefined) this.epsilonScale = epsilonScale;
        if (sigmaScale !== undefined) this.sigmaScale = sigmaScale;
    }

    setCutoff(cutoff: number): void {
        this.cutoffRadius = cutoff;
    }

    getDescription(): string {
        return "Lennard-Jones 12-6 potential with type-dependent parameters";
    }
}

export class CoulombPotential extends Potential {
    private charges: number[];
    private chargeScale: number;
    private coulombConstant: number;
    private cutoffRadius: number;

    constructor(
        charges: number[],
        chargeScale: number = 1.0,
        coulombConstant: number = 14.3996, // eV·Å/e² (1/(4πε₀) in eV-Å-e units)
        cutoffRadius: number = Infinity
    ) {
        super();
        this.charges = charges;
        this.chargeScale = chargeScale;
        this.coulombConstant = coulombConstant;
        this.cutoffRadius = cutoffRadius;
    }

    calculate(r: number, type1: number, type2: number): ForceResult {
        if (r > this.cutoffRadius) {
            return { potential: 0, force: 0 };
        }

        const q1 = this.charges[type1] * this.chargeScale;
        const q2 = this.charges[type2] * this.chargeScale;

        const potential = this.coulombConstant * q1 * q2 / r;
        const force = -this.coulombConstant * q1 * q2 / (r * r);

        return { potential, force };
    }

    updateCharges(charges: number[], chargeScale?: number): void {
        this.charges = charges;
        if (chargeScale !== undefined) this.chargeScale = chargeScale;
    }

    setCutoff(cutoff: number): void {
        this.cutoffRadius = cutoff;
    }

    getDescription(): string {
        return "Coulomb electrostatic potential";
    }
}

export class HarmonicPotential extends Potential {
    private springConstants: number[][];
    private equilibriumDistances: number[][];

    constructor(springConstants: number[][], equilibriumDistances: number[][]) {
        super();
        this.springConstants = springConstants;
        this.equilibriumDistances = equilibriumDistances;
    }

    calculate(r: number, type1: number, type2: number): ForceResult {
        const k = this.springConstants[type1][type2];
        const r0 = this.equilibriumDistances[type1][type2];
        const dr = r - r0;

        const potential = 0.5 * k * dr * dr;
        const force = -k * dr;

        return { potential, force };
    }

    updateParameters(springConstants: number[][], equilibriumDistances: number[][]): void {
        this.springConstants = springConstants;
        this.equilibriumDistances = equilibriumDistances;
    }

    getDescription(): string {
        return "Harmonic potential for bonded interactions";
    }
}

export class MorsePotential extends Potential {
    private dissociationEnergies: number[][];
    private alphaParameters: number[][];
    private equilibriumDistances: number[][];

    constructor(
        dissociationEnergies: number[][],
        alphaParameters: number[][],
        equilibriumDistances: number[][]
    ) {
        super();
        this.dissociationEnergies = dissociationEnergies;
        this.alphaParameters = alphaParameters;
        this.equilibriumDistances = equilibriumDistances;
    }

    calculate(r: number, type1: number, type2: number): ForceResult {
        const De = this.dissociationEnergies[type1][type2];
        const alpha = this.alphaParameters[type1][type2];
        const re = this.equilibriumDistances[type1][type2];

        const exp1 = Math.exp(-alpha * (r - re));
        const exp2 = Math.exp(-2 * alpha * (r - re));

        const potential = De * (exp2 - 2 * exp1);
        const force = 2 * De * alpha * (exp1 - exp2);

        return { potential, force };
    }

    getDescription(): string {
        return "Morse potential for realistic bond dissociation";
    }
}

export class PotentialManager {
    private potentials: Potential[];
    private weights: number[];

    constructor() {
        this.potentials = [];
        this.weights = [];
    }

    addPotential(potential: Potential, weight: number = 1.0): void {
        this.potentials.push(potential);
        this.weights.push(weight);
    }

    removePotential(index: number): void {
        if (index >= 0 && index < this.potentials.length) {
            this.potentials.splice(index, 1);
            this.weights.splice(index, 1);
        }
    }

    calculateTotal(r: number, type1: number, type2: number): ForceResult {
        let totalPotential = 0;
        let totalForce = 0;

        for (let i = 0; i < this.potentials.length; i++) {
            const result = this.potentials[i].calculate(r, type1, type2);
            totalPotential += result.potential * this.weights[i];
            totalForce += result.force * this.weights[i];
        }

        return { potential: totalPotential, force: totalForce };
    }

    getPotentials(): Potential[] {
        return [...this.potentials];
    }

    getWeights(): number[] {
        return [...this.weights];
    }

    setWeight(index: number, weight: number): void {
        if (index >= 0 && index < this.weights.length) {
            this.weights[index] = weight;
        }
    }

    clear(): void {
        this.potentials = [];
        this.weights = [];
    }
}

export function createDefaultPotentials(
    epsilonMatrix: number[][],
    sigmaMatrix: number[][],
    charges: number[]
): PotentialManager {
    const manager = new PotentialManager();
    
    const ljPotential = new LennardJonesPotential(epsilonMatrix, sigmaMatrix);
    const coulombPotential = new CoulombPotential(charges);
    
    manager.addPotential(ljPotential, 1.0);
    manager.addPotential(coulombPotential, 1.0);
    
    return manager;
}