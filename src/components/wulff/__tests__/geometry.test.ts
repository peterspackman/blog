import { describe, expect, it } from 'vitest';
import { cubicFamily, cubicWulff, latticeFacets, wulff2D } from '../geometry';

describe('wulff2D', () => {
    it('gives a square of side 2γ when only {10} facets matter', () => {
        const facets = latticeFacets('square').map((f) => ({ ...f, gamma: f.family === 0 ? 1 : 10 }));
        const s = wulff2D(facets);
        expect(s.vertices).toHaveLength(4);
        expect(s.perimeter).toBeCloseTo(8, 9);
    });

    it('gives a regular octagon when γ{11} = γ{10}', () => {
        const facets = latticeFacets('square').map((f) => ({ ...f, gamma: 1 }));
        const s = wulff2D(facets);
        expect(s.vertices).toHaveLength(8);
        // Regular octagon with inradius 1: side = 2 tan(22.5°)
        for (const len of s.facetLength) expect(len).toBeCloseTo(2 * Math.tan(Math.PI / 8), 9);
    });

    it('drops a facet whose plane lies outside the shape', () => {
        const facets = latticeFacets('square').map((f) => ({ ...f, gamma: f.family === 0 ? 1 : Math.SQRT2 }));
        const s = wulff2D(facets);
        // {11} planes at √2 just touch the square's corners: zero length.
        facets.forEach((f, i) => {
            if (f.family === 1) expect(s.facetLength[i]).toBeCloseTo(0, 9);
        });
    });

    it('gives a hexagon for a hexagonal lattice with only {10}', () => {
        const facets = latticeFacets('hexagonal').map((f) => ({ ...f, gamma: f.family === 0 ? 1 : 10 }));
        expect(wulff2D(facets).vertices).toHaveLength(6);
    });
});

describe('cubicWulff', () => {
    it('family sizes are 6, 12, 8', () => {
        expect(cubicFamily(1, 0, 0)).toHaveLength(6);
        expect(cubicFamily(1, 1, 0)).toHaveLength(12);
        expect(cubicFamily(1, 1, 1)).toHaveLength(8);
    });

    it('is a cube when {100} dominates', () => {
        const s = cubicWulff(1, 10, 10);
        expect(s.faces).toHaveLength(6);
        expect(s.totalArea).toBeCloseTo(24, 6);
        expect(s.familyArea[0] / s.totalArea).toBeCloseTo(1, 9);
    });

    it('is an octahedron when {111} dominates', () => {
        const s = cubicWulff(10, 10, 1);
        expect(s.faces).toHaveLength(8);
        // Octahedron with inradius 1: edge a = √6, area = 2√3 a²
        expect(s.totalArea).toBeCloseTo(2 * Math.sqrt(3) * 6, 6);
    });

    it('is a rhombic dodecahedron when {110} dominates', () => {
        expect(cubicWulff(10, 1, 10).faces).toHaveLength(12);
    });

    it('is a truncated octahedron for γ100/γ111 = 1.15', () => {
        const s = cubicWulff(1.15, 10, 1);
        expect(s.faces).toHaveLength(14);
        expect(s.familyArea[0]).toBeGreaterThan(0);
        expect(s.familyArea[2]).toBeGreaterThan(s.familyArea[0]);
    });
});

import { extents, orthoFamily, orthorhombicWulff } from '../geometry';

describe('orthorhombicWulff', () => {
    const high = { '110': 9, '101': 9, '011': 9, '111': 9 };

    it('family sizes follow mmm: 2, 4, 8', () => {
        expect(orthoFamily(1, 0, 0, 1, 2, 3)).toHaveLength(2);
        expect(orthoFamily(1, 1, 0, 1, 2, 3)).toHaveLength(4);
        expect(orthoFamily(1, 1, 1, 1, 2, 3)).toHaveLength(8);
    });

    it('is a box of side 2γ along each axis', () => {
        const s = orthorhombicWulff({ '100': 1, '010': 2, '001': 3, ...high });
        expect(s.faces).toHaveLength(6);
        const [x, y, z] = extents(s);
        expect(x).toBeCloseTo(2, 9);
        expect(y).toBeCloseTo(4, 9);
        expect(z).toBeCloseTo(6, 9);
    });

    it('makes a needle when the end facets cost far more than the sides', () => {
        const [x, y, z] = extents(orthorhombicWulff({ '100': 0.5, '010': 0.5, '001': 4, ...high }));
        expect(z / Math.max(x, y)).toBeGreaterThan(5);
    });

    it('tilts {110} normals with the cell: b > a pushes them towards x', () => {
        const [n] = orthoFamily(1, 1, 0, 1, 2, 1).filter((v) => v[0] > 0 && v[1] > 0);
        expect(n[0]).toBeGreaterThan(n[1]);
    });
});

import { smoothCubicWulff, smoothWulff2D } from '../geometry';

describe('smooth (cusped) Wulff shapes', () => {
    it('ε = 0 gives a circle in 2D', () => {
        const { shape } = smoothWulff2D(0, 4);
        // Circumscribed 360-gon around the unit circle: perimeter ≈ 2π.
        expect(shape.perimeter).toBeCloseTo(2 * Math.PI, 3);
    });

    it('large ε gives a square in 2D', () => {
        const { shape } = smoothWulff2D(3, 4);
        expect(shape.perimeter).toBeCloseTo(8, 6);
    });

    it('ε = 0 gives a sphere in 3D, and facets grow with ε', () => {
        const sphere = smoothCubicWulff(0);
        expect(sphere.totalArea).toBeGreaterThan(4 * Math.PI);
        expect(sphere.totalArea).toBeLessThan(4 * Math.PI * 1.04);
        const flat = (eps: number) => {
            const s = smoothCubicWulff(eps);
            return s.familyArea[0] / s.totalArea;
        };
        expect(flat(0)).toBeLessThan(0.02);
        expect(flat(0.3)).toBeGreaterThan(flat(0.1));
        expect(flat(3)).toBeGreaterThan(0.95);
    });
});

describe('rectangular 2D lattice', () => {
    it('gives a 2γ10 × 2γ01 rectangle when {11} is expensive', () => {
        const facets = latticeFacets('rectangular').map((f) => ({ ...f, gamma: [1, 3, 10][f.family] }));
        const s = wulff2D(facets);
        expect(s.vertices).toHaveLength(4);
        expect(s.perimeter).toBeCloseTo(2 * (2 + 6), 9);
    });

    it('tilts {11} towards a when b > a', () => {
        const f = latticeFacets('rectangular', 2).filter((x) => x.family === 2 && x.angle < 90)[0];
        expect(f.angle).toBeCloseTo((Math.atan(0.5) * 180) / Math.PI, 9);
    });
});

import { smoothRectWulff2D } from '../geometry';

describe('smooth rectangular model', () => {
    it('is a circle of radius γ̄ at ε = 0', () => {
        expect(smoothRectWulff2D(0, 0.5, 1.5).shape.perimeter).toBeCloseTo(2 * Math.PI, 3);
    });
    it('is the 2γ10 × 2γ01 rectangle at ε = 1', () => {
        expect(smoothRectWulff2D(1, 0.5, 1.5).shape.perimeter).toBeCloseTo(2 * (1 + 3), 6);
    });
    it('has two different flat facets in between', () => {
        const { facets, shape } = smoothRectWulff2D(0.5, 0.5, 1.5);
        const len = (fam: number) => facets.reduce((s, f, i) => s + (f.family === fam ? shape.facetLength[i] : 0), 0);
        expect(len(0)).toBeGreaterThan(0);
        expect(len(1)).toBeGreaterThan(0);
        expect(len(0)).not.toBeCloseTo(len(1), 2);
    });
});
