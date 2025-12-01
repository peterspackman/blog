/**
 * Tests for MD force calculations
 *
 * CONVENTION NOTE: The Potentials module stores dU/dr (the gradient), NOT -dU/dr (the force).
 * This is an intentional design choice. The force application in useSimulation.ts accounts
 * for this by using: F_i = gradient * (r_j - r_i)/|r|, which correctly gives the physical force.
 *
 * This means:
 * - Gradient < 0 in repulsive region (potential decreasing as r increases)
 * - Gradient > 0 in attractive region (potential increasing as r increases toward 0)
 */

import { LennardJonesPotential, CoulombPotential, PotentialManager } from '../Potentials';

describe('Gradient verification against finite differences', () => {
    const epsilon = 0.01;  // eV - LJ well depth
    const sigma = 3.4;     // Angstrom - LJ size parameter
    const h = 1e-6;        // Finite difference step size

    // Create 1x1 matrices for single type
    const epsilonMatrix = [[epsilon]];
    const sigmaMatrix = [[sigma]];

    describe('Lennard-Jones potential', () => {
        const lj = new LennardJonesPotential(epsilonMatrix, sigmaMatrix, 1.0, 1.0, 15.0);

        test('gradient equals dU/dr at r = sigma', () => {
            const r = sigma;
            const { force: gradient } = lj.calculate(r, 0, 0);

            // Finite difference: dU/dr ≈ (U(r+h) - U(r-h)) / (2h)
            const U_plus = lj.calculate(r + h, 0, 0).potential;
            const U_minus = lj.calculate(r - h, 0, 0).potential;
            const numericalGradient = (U_plus - U_minus) / (2 * h);

            expect(gradient).toBeCloseTo(numericalGradient, 4);
        });

        test('gradient equals dU/dr at r = 1.5 * sigma (attractive region)', () => {
            const r = 1.5 * sigma;
            const { force: gradient } = lj.calculate(r, 0, 0);

            const U_plus = lj.calculate(r + h, 0, 0).potential;
            const U_minus = lj.calculate(r - h, 0, 0).potential;
            const numericalGradient = (U_plus - U_minus) / (2 * h);

            expect(gradient).toBeCloseTo(numericalGradient, 4);
        });

        test('gradient equals dU/dr at r = 0.9 * sigma (repulsive region)', () => {
            const r = 0.9 * sigma;
            const { force: gradient } = lj.calculate(r, 0, 0);

            const U_plus = lj.calculate(r + h, 0, 0).potential;
            const U_minus = lj.calculate(r - h, 0, 0).potential;
            const numericalGradient = (U_plus - U_minus) / (2 * h);

            expect(gradient).toBeCloseTo(numericalGradient, 4);
        });

        test('gradient is zero at equilibrium distance (r = 2^(1/6) * sigma)', () => {
            const r_eq = Math.pow(2, 1/6) * sigma;
            const { force: gradient } = lj.calculate(r_eq, 0, 0);

            expect(Math.abs(gradient)).toBeLessThan(1e-10);
        });

        test('gradient is negative (repulsive) for r < r_eq', () => {
            // In repulsive region, potential decreases as r increases, so dU/dr < 0
            const r_eq = Math.pow(2, 1/6) * sigma;
            const { force: gradient } = lj.calculate(r_eq * 0.9, 0, 0);

            expect(gradient).toBeLessThan(0);
        });

        test('gradient is positive (attractive) for r > r_eq', () => {
            // In attractive region beyond minimum, potential increases toward 0 as r increases, so dU/dr > 0
            const r_eq = Math.pow(2, 1/6) * sigma;
            const { force: gradient } = lj.calculate(r_eq * 1.5, 0, 0);

            expect(gradient).toBeGreaterThan(0);
        });

        test('potential minimum is -epsilon at r = 2^(1/6) * sigma', () => {
            const r_eq = Math.pow(2, 1/6) * sigma;
            const { potential } = lj.calculate(r_eq, 0, 0);

            expect(potential).toBeCloseTo(-epsilon, 6);
        });
    });

    describe('Coulomb potential', () => {
        // Two particle types: +1 and -1 charge
        const charges = [1.0, -1.0];
        const coulomb = new CoulombPotential(charges, 1.0);

        test('gradient equals dU/dr for opposite charges', () => {
            const r = 5.0;  // Angstrom
            const { force: gradient } = coulomb.calculate(r, 0, 1);  // +1 and -1

            const U_plus = coulomb.calculate(r + h, 0, 1).potential;
            const U_minus = coulomb.calculate(r - h, 0, 1).potential;
            const numericalGradient = (U_plus - U_minus) / (2 * h);

            expect(gradient).toBeCloseTo(numericalGradient, 4);
        });

        test('gradient equals dU/dr for like charges', () => {
            const r = 5.0;
            const { force: gradient } = coulomb.calculate(r, 0, 0);  // +1 and +1

            const U_plus = coulomb.calculate(r + h, 0, 0).potential;
            const U_minus = coulomb.calculate(r - h, 0, 0).potential;
            const numericalGradient = (U_plus - U_minus) / (2 * h);

            expect(gradient).toBeCloseTo(numericalGradient, 4);
        });

        test('opposite charges: gradient is positive (attractive)', () => {
            // Opposite charges have negative potential that increases toward 0 as r increases
            // So dU/dr > 0 (potential becoming less negative)
            const { force: gradient } = coulomb.calculate(5.0, 0, 1);
            expect(gradient).toBeGreaterThan(0);
        });

        test('like charges: gradient is negative (repulsive)', () => {
            // Like charges have positive potential that decreases toward 0 as r increases
            // So dU/dr < 0
            const { force: gradient } = coulomb.calculate(5.0, 0, 0);
            expect(gradient).toBeLessThan(0);
        });
    });

    describe('PotentialManager with multiple potentials', () => {
        test('total gradient equals sum of individual gradients', () => {
            // Two types with different LJ params
            const epsMatrix = [[epsilon, epsilon], [epsilon, epsilon]];
            const sigMatrix = [[sigma, sigma], [sigma, sigma]];
            const charges = [1.0, -1.0];

            const manager = new PotentialManager();
            manager.addPotential(new LennardJonesPotential(epsMatrix, sigMatrix, 1.0, 1.0, 15.0));
            manager.addPotential(new CoulombPotential(charges, 0.5));

            const r = 4.0;
            const type1 = 0;
            const type2 = 1;

            const total = manager.calculateTotal(r, type1, type2);

            // Verify against finite difference of total potential
            const U_plus = manager.calculateTotal(r + h, type1, type2).potential;
            const U_minus = manager.calculateTotal(r - h, type1, type2).potential;
            const numericalGradient = (U_plus - U_minus) / (2 * h);

            expect(total.force).toBeCloseTo(numericalGradient, 4);
        });
    });
});

describe('Potential edge cases', () => {
    test('LJ potential handles very small r gracefully', () => {
        const lj = new LennardJonesPotential([[0.01]], [[3.4]], 1.0, 1.0, 15.0);

        // Very small distance - should not return Infinity or NaN
        const result = lj.calculate(0.5, 0, 0);
        expect(isFinite(result.potential)).toBe(true);
        expect(isFinite(result.force)).toBe(true);
    });

    test('Coulomb potential handles small distances', () => {
        const coulomb = new CoulombPotential([1.0, -1.0], 1.0);

        // Small distance - should still be finite
        const result = coulomb.calculate(0.5, 0, 1);
        expect(isFinite(result.potential)).toBe(true);
        expect(isFinite(result.force)).toBe(true);
    });

    test('LJ cutoff is respected', () => {
        const cutoff = 10.0;
        const lj = new LennardJonesPotential([[0.01]], [[3.4]], 1.0, 1.0, cutoff);

        // Beyond cutoff
        const result = lj.calculate(cutoff + 1, 0, 0);
        expect(result.potential).toBe(0);
        expect(result.force).toBe(0);

        // Just inside cutoff
        const result2 = lj.calculate(cutoff - 0.1, 0, 0);
        expect(result2.potential).not.toBe(0);
    });
});
