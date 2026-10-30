import { describe, expect, it } from 'vitest';
import type { IsosurfaceResult } from '@peterspackman/ce-chem/compute/surface-types.js';
import { colourableProperties } from '../useSurfaces';

const mesh = (properties: Record<string, number[]>) =>
    ({
        vertices: new Float32Array(),
        faces: new Uint32Array(),
        normals: new Float32Array(),
        properties: Object.fromEntries(Object.entries(properties).map(([k, v]) => [k, Float32Array.from(v)])),
    }) as IsosurfaceResult;

describe('colourableProperties', () => {
    it('offers a property that varies over the surface', () => {
        expect(colourableProperties(mesh({ esp: [-0.1, 0.2] }))).toEqual(['esp']);
    });

    it('hides a property that is constant, as de is with no surrounding atoms', () => {
        expect(colourableProperties(mesh({ esp: [-0.1, 0.2], de: [0, 0] }))).toEqual(['esp']);
    });

    it('offers nothing before the mesh exists', () => {
        expect(colourableProperties(undefined)).toEqual([]);
    });
});
