import { describe, expect, it } from 'vitest';
import { bandEnergy, fill, levelWavevector, nodeCount, solveHuckel } from '../huckel';

describe('Hückel chain', () => {
    it('matches E_k = 2β cos(kπ/(N+1)) for a uniform chain', () => {
        const n = 12, beta = -2.5;
        const { energies } = solveHuckel({ n, beta, delta: 0, topology: 'chain' });
        energies.forEach((e, i) => expect(e).toBeCloseTo(2 * beta * Math.cos(((i + 1) * Math.PI) / (n + 1)), 9));
    });

    it('orbitals are orthonormal and the n-th has n−1 nodes', () => {
        const { orbitals } = solveHuckel({ n: 9, beta: -2.5, delta: 0.2, topology: 'chain' });
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                const dot = orbitals[i].reduce((s, x, k) => s + x * orbitals[j][k], 0);
                expect(dot).toBeCloseTo(i === j ? 1 : 0, 9);
            }
            expect(nodeCount(orbitals[i], false)).toBe(i);
        }
    });

    it('opens a gap of about 4|β|δ for a long alternating chain', () => {
        const { energies } = solveHuckel({ n: 100, beta: -2.5, delta: 0.1, topology: 'chain' });
        const { gap } = fill(energies, 100);
        expect(gap).toBeGreaterThan(0.95 * 4 * 2.5 * 0.1);
        expect(gap).toBeLessThan(1.1 * 4 * 2.5 * 0.1);
    });
});

describe('Hückel ring', () => {
    it('benzene: 2β, β, β, −β, −β, −2β with a closed shell', () => {
        const { energies } = solveHuckel({ n: 6, beta: -1, delta: 0, topology: 'ring' });
        [-2, -1, -1, 1, 1, 2].forEach((e, i) => expect(energies[i]).toBeCloseTo(e, 9));
        expect(fill(energies, 6).gap).toBeCloseTo(2, 9);
    });

    it('cyclobutadiene (4n): half-filled degenerate pair, no gap', () => {
        const { energies } = solveHuckel({ n: 4, beta: -1, delta: 0, topology: 'ring' });
        expect(fill(energies, 4).gap).toBeCloseTo(0, 9);
    });

    it('ring levels sit on the band', () => {
        const n = 10, beta = -2.5;
        const { energies } = solveHuckel({ n, beta, delta: 0, topology: 'ring' });
        energies.forEach((e, i) => expect(e).toBeCloseTo(bandEnergy(levelWavevector(i, n, 'ring'), beta, 0), 9));
    });
});
