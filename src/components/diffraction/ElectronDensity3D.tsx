import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { CrystalStructure } from './physics';
import { isAllowedReflection, calculateDSpacing, calculateTwoTheta, atomicFormFactor } from './physics';
import type { ControlTheme } from '../shared/controls';
import { calculateElectronDensityFFT } from './fft3d';
import { interpolateFormFactorSmooth } from './FormFactorEditor';

interface ControlPoint {
    s: number;
    f: number;
}

export interface ElectronDensity3DProps {
    width: number;
    height: number;
    structure: CrystalStructure;
    wavelength: number;
    resolution: number;
    maxHKL: number;
    isoLevel: number;
    renderMode: 'raymarching' | 'isosurface';
    theme: ControlTheme;
    formFactors?: Record<string, ControlPoint[]>;
    bFactor?: number; // Debye-Waller temperature factor in Ų (default ~1.5)
    sliceZ?: number; // Show slice plane indicator at this z position (0-1)
}

interface ReflectionData {
    h: number;
    k: number;
    l: number;
    fRe: number;
    fIm: number;
}

// Vertex shader for ray marching
const rayMarchVertexShader = `
varying vec3 vOrigin;
varying vec3 vDirection;

void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vOrigin = cameraPosition;
    vDirection = position - cameraPosition;
    gl_Position = projectionMatrix * mvPosition;
}
`;

// Fragment shader - ray marching through 3D texture
const rayMarchFragmentShader = `
precision highp float;
precision highp sampler3D;

uniform sampler3D uVolume;
uniform float uIsoLevel;
uniform float uMinDensity;
uniform float uMaxDensity;
uniform vec3 uColor;
uniform float uOpacity;

varying vec3 vOrigin;
varying vec3 vDirection;

vec2 hitBox(vec3 orig, vec3 dir) {
    vec3 boxMin = vec3(-1.0);
    vec3 boxMax = vec3(1.0);
    vec3 invDir = 1.0 / dir;
    vec3 tmin0 = (boxMin - orig) * invDir;
    vec3 tmax0 = (boxMax - orig) * invDir;
    vec3 tmin = min(tmin0, tmax0);
    vec3 tmax = max(tmin0, tmax0);
    float t0 = max(max(tmin.x, tmin.y), tmin.z);
    float t1 = min(min(tmax.x, tmax.y), tmax.z);
    return vec2(t0, t1);
}

float sampleDensity(vec3 p) {
    vec3 uv = p * 0.5 + 0.5;
    return texture(uVolume, uv).r;
}

vec3 calcNormal(vec3 p) {
    float eps = 0.01;
    float d = sampleDensity(p);
    return normalize(vec3(
        sampleDensity(p + vec3(eps, 0, 0)) - d,
        sampleDensity(p + vec3(0, eps, 0)) - d,
        sampleDensity(p + vec3(0, 0, eps)) - d
    ));
}

void main() {
    vec3 rayDir = normalize(vDirection);
    vec2 bounds = hitBox(vOrigin, rayDir);

    if (bounds.x > bounds.y) {
        discard;
    }

    bounds.x = max(bounds.x, 0.0);

    // Use iso level directly (values are in density units)
    float isoThreshold = uIsoLevel;

    // Ray march
    float t = bounds.x;
    float dt = 0.02;
    vec3 hitPos = vec3(0.0);
    bool hit = false;
    float prevDensity = 0.0;

    for (int i = 0; i < 200; i++) {
        if (t > bounds.y) break;

        vec3 p = vOrigin + rayDir * t;
        float density = sampleDensity(p);

        // Check for isosurface crossing
        if (i > 0 && ((prevDensity < isoThreshold && density >= isoThreshold) ||
                      (prevDensity > isoThreshold && density <= isoThreshold))) {
            // Refine hit position
            float tPrev = t - dt;
            for (int j = 0; j < 4; j++) {
                float tMid = (tPrev + t) * 0.5;
                vec3 pMid = vOrigin + rayDir * tMid;
                float dMid = sampleDensity(pMid);
                if ((prevDensity < isoThreshold) == (dMid < isoThreshold)) {
                    tPrev = tMid;
                    prevDensity = dMid;
                } else {
                    t = tMid;
                    density = dMid;
                }
            }
            hitPos = vOrigin + rayDir * t;
            hit = true;
            break;
        }

        prevDensity = density;
        t += dt;
    }

    if (!hit) {
        discard;
    }

    // Calculate normal and lighting
    vec3 normal = calcNormal(hitPos);
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diff = max(dot(normal, lightDir), 0.0) * 0.6 + 0.4;

    // Fresnel-like rim lighting
    float rim = 1.0 - abs(dot(normal, -rayDir));
    rim = pow(rim, 2.0) * 0.3;

    vec3 color = uColor * diff + vec3(1.0) * rim;

    gl_FragColor = vec4(color, uOpacity);
}
`;

// Marching cubes tables
const EDGE_TABLE = [
    0x0, 0x109, 0x203, 0x30a, 0x406, 0x50f, 0x605, 0x70c,
    0x80c, 0x905, 0xa0f, 0xb06, 0xc0a, 0xd03, 0xe09, 0xf00,
    0x190, 0x99, 0x393, 0x29a, 0x596, 0x49f, 0x795, 0x69c,
    0x99c, 0x895, 0xb9f, 0xa96, 0xd9a, 0xc93, 0xf99, 0xe90,
    0x230, 0x339, 0x33, 0x13a, 0x636, 0x73f, 0x435, 0x53c,
    0xa3c, 0xb35, 0x83f, 0x936, 0xe3a, 0xf33, 0xc39, 0xd30,
    0x3a0, 0x2a9, 0x1a3, 0xaa, 0x7a6, 0x6af, 0x5a5, 0x4ac,
    0xbac, 0xaa5, 0x9af, 0x8a6, 0xfaa, 0xea3, 0xda9, 0xca0,
    0x460, 0x569, 0x663, 0x76a, 0x66, 0x16f, 0x265, 0x36c,
    0xc6c, 0xd65, 0xe6f, 0xf66, 0x86a, 0x963, 0xa69, 0xb60,
    0x5f0, 0x4f9, 0x7f3, 0x6fa, 0x1f6, 0xff, 0x3f5, 0x2fc,
    0xdfc, 0xcf5, 0xfff, 0xef6, 0x9fa, 0x8f3, 0xbf9, 0xaf0,
    0x650, 0x759, 0x453, 0x55a, 0x256, 0x35f, 0x55, 0x15c,
    0xe5c, 0xf55, 0xc5f, 0xd56, 0xa5a, 0xb53, 0x859, 0x950,
    0x7c0, 0x6c9, 0x5c3, 0x4ca, 0x3c6, 0x2cf, 0x1c5, 0xcc,
    0xfcc, 0xec5, 0xdcf, 0xcc6, 0xbca, 0xac3, 0x9c9, 0x8c0,
    0x8c0, 0x9c9, 0xac3, 0xbca, 0xcc6, 0xdcf, 0xec5, 0xfcc,
    0xcc, 0x1c5, 0x2cf, 0x3c6, 0x4ca, 0x5c3, 0x6c9, 0x7c0,
    0x950, 0x859, 0xb53, 0xa5a, 0xd56, 0xc5f, 0xf55, 0xe5c,
    0x15c, 0x55, 0x35f, 0x256, 0x55a, 0x453, 0x759, 0x650,
    0xaf0, 0xbf9, 0x8f3, 0x9fa, 0xef6, 0xfff, 0xcf5, 0xdfc,
    0x2fc, 0x3f5, 0xff, 0x1f6, 0x6fa, 0x7f3, 0x4f9, 0x5f0,
    0xb60, 0xa69, 0x963, 0x86a, 0xf66, 0xe6f, 0xd65, 0xc6c,
    0x36c, 0x265, 0x16f, 0x66, 0x76a, 0x663, 0x569, 0x460,
    0xca0, 0xda9, 0xea3, 0xfaa, 0x8a6, 0x9af, 0xaa5, 0xbac,
    0x4ac, 0x5a5, 0x6af, 0x7a6, 0xaa, 0x1a3, 0x2a9, 0x3a0,
    0xd30, 0xc39, 0xf33, 0xe3a, 0x936, 0x83f, 0xb35, 0xa3c,
    0x53c, 0x435, 0x73f, 0x636, 0x13a, 0x33, 0x339, 0x230,
    0xe90, 0xf99, 0xc93, 0xd9a, 0xa96, 0xb9f, 0x895, 0x99c,
    0x69c, 0x795, 0x49f, 0x596, 0x29a, 0x393, 0x99, 0x190,
    0xf00, 0xe09, 0xd03, 0xc0a, 0xb06, 0xa0f, 0x905, 0x80c,
    0x70c, 0x605, 0x50f, 0x406, 0x30a, 0x203, 0x109, 0x0
];

const TRI_TABLE = [
    [-1], [0, 8, 3, -1], [0, 1, 9, -1], [1, 8, 3, 9, 8, 1, -1],
    [1, 2, 10, -1], [0, 8, 3, 1, 2, 10, -1], [9, 2, 10, 0, 2, 9, -1],
    [2, 8, 3, 2, 10, 8, 10, 9, 8, -1], [3, 11, 2, -1], [0, 11, 2, 8, 11, 0, -1],
    [1, 9, 0, 2, 3, 11, -1], [1, 11, 2, 1, 9, 11, 9, 8, 11, -1],
    [3, 10, 1, 11, 10, 3, -1], [0, 10, 1, 0, 8, 10, 8, 11, 10, -1],
    [3, 9, 0, 3, 11, 9, 11, 10, 9, -1], [9, 8, 10, 10, 8, 11, -1],
    [4, 7, 8, -1], [4, 3, 0, 7, 3, 4, -1], [0, 1, 9, 8, 4, 7, -1],
    [4, 1, 9, 4, 7, 1, 7, 3, 1, -1], [1, 2, 10, 8, 4, 7, -1],
    [3, 4, 7, 3, 0, 4, 1, 2, 10, -1], [9, 2, 10, 9, 0, 2, 8, 4, 7, -1],
    [2, 10, 9, 2, 9, 7, 2, 7, 3, 7, 9, 4, -1], [8, 4, 7, 3, 11, 2, -1],
    [11, 4, 7, 11, 2, 4, 2, 0, 4, -1], [9, 0, 1, 8, 4, 7, 2, 3, 11, -1],
    [4, 7, 11, 9, 4, 11, 9, 11, 2, 9, 2, 1, -1], [3, 10, 1, 3, 11, 10, 7, 8, 4, -1],
    [1, 11, 10, 1, 4, 11, 1, 0, 4, 7, 11, 4, -1], [4, 7, 8, 9, 0, 11, 9, 11, 10, 11, 0, 3, -1],
    [4, 7, 11, 4, 11, 9, 9, 11, 10, -1], [9, 5, 4, -1], [9, 5, 4, 0, 8, 3, -1],
    [0, 5, 4, 1, 5, 0, -1], [8, 5, 4, 8, 3, 5, 3, 1, 5, -1], [1, 2, 10, 9, 5, 4, -1],
    [3, 0, 8, 1, 2, 10, 4, 9, 5, -1], [5, 2, 10, 5, 4, 2, 4, 0, 2, -1],
    [2, 10, 5, 3, 2, 5, 3, 5, 4, 3, 4, 8, -1], [9, 5, 4, 2, 3, 11, -1],
    [0, 11, 2, 0, 8, 11, 4, 9, 5, -1], [0, 5, 4, 0, 1, 5, 2, 3, 11, -1],
    [2, 1, 5, 2, 5, 8, 2, 8, 11, 4, 8, 5, -1], [10, 3, 11, 10, 1, 3, 9, 5, 4, -1],
    [4, 9, 5, 0, 8, 1, 8, 10, 1, 8, 11, 10, -1], [5, 4, 0, 5, 0, 11, 5, 11, 10, 11, 0, 3, -1],
    [5, 4, 8, 5, 8, 10, 10, 8, 11, -1], [9, 7, 8, 5, 7, 9, -1],
    [9, 3, 0, 9, 5, 3, 5, 7, 3, -1], [0, 7, 8, 0, 1, 7, 1, 5, 7, -1],
    [1, 5, 3, 3, 5, 7, -1], [9, 7, 8, 9, 5, 7, 10, 1, 2, -1],
    [10, 1, 2, 9, 5, 0, 5, 3, 0, 5, 7, 3, -1], [8, 0, 2, 8, 2, 5, 8, 5, 7, 10, 5, 2, -1],
    [2, 10, 5, 2, 5, 3, 3, 5, 7, -1], [7, 9, 5, 7, 8, 9, 3, 11, 2, -1],
    [9, 5, 7, 9, 7, 2, 9, 2, 0, 2, 7, 11, -1], [2, 3, 11, 0, 1, 8, 1, 7, 8, 1, 5, 7, -1],
    [11, 2, 1, 11, 1, 7, 7, 1, 5, -1], [9, 5, 8, 8, 5, 7, 10, 1, 3, 10, 3, 11, -1],
    [5, 7, 0, 5, 0, 9, 7, 11, 0, 1, 0, 10, 11, 10, 0, -1],
    [11, 10, 0, 11, 0, 3, 10, 5, 0, 8, 0, 7, 5, 7, 0, -1], [11, 10, 5, 7, 11, 5, -1],
    [10, 6, 5, -1], [0, 8, 3, 5, 10, 6, -1], [9, 0, 1, 5, 10, 6, -1],
    [1, 8, 3, 1, 9, 8, 5, 10, 6, -1], [1, 6, 5, 2, 6, 1, -1],
    [1, 6, 5, 1, 2, 6, 3, 0, 8, -1], [9, 6, 5, 9, 0, 6, 0, 2, 6, -1],
    [5, 9, 8, 5, 8, 2, 5, 2, 6, 3, 2, 8, -1], [2, 3, 11, 10, 6, 5, -1],
    [11, 0, 8, 11, 2, 0, 10, 6, 5, -1], [0, 1, 9, 2, 3, 11, 5, 10, 6, -1],
    [5, 10, 6, 1, 9, 2, 9, 11, 2, 9, 8, 11, -1], [6, 3, 11, 6, 5, 3, 5, 1, 3, -1],
    [0, 8, 11, 0, 11, 5, 0, 5, 1, 5, 11, 6, -1], [3, 11, 6, 0, 3, 6, 0, 6, 5, 0, 5, 9, -1],
    [6, 5, 9, 6, 9, 11, 11, 9, 8, -1], [5, 10, 6, 4, 7, 8, -1],
    [4, 3, 0, 4, 7, 3, 6, 5, 10, -1], [1, 9, 0, 5, 10, 6, 8, 4, 7, -1],
    [10, 6, 5, 1, 9, 7, 1, 7, 3, 7, 9, 4, -1], [6, 1, 2, 6, 5, 1, 4, 7, 8, -1],
    [1, 2, 5, 5, 2, 6, 3, 0, 4, 3, 4, 7, -1], [8, 4, 7, 9, 0, 5, 0, 6, 5, 0, 2, 6, -1],
    [7, 3, 9, 7, 9, 4, 3, 2, 9, 5, 9, 6, 2, 6, 9, -1], [3, 11, 2, 7, 8, 4, 10, 6, 5, -1],
    [5, 10, 6, 4, 7, 2, 4, 2, 0, 2, 7, 11, -1], [0, 1, 9, 4, 7, 8, 2, 3, 11, 5, 10, 6, -1],
    [9, 2, 1, 9, 11, 2, 9, 4, 11, 7, 11, 4, 5, 10, 6, -1], [8, 4, 7, 3, 11, 5, 3, 5, 1, 5, 11, 6, -1],
    [5, 1, 11, 5, 11, 6, 1, 0, 11, 7, 11, 4, 0, 4, 11, -1],
    [0, 5, 9, 0, 6, 5, 0, 3, 6, 11, 6, 3, 8, 4, 7, -1], [6, 5, 9, 6, 9, 11, 4, 7, 9, 7, 11, 9, -1],
    [10, 4, 9, 6, 4, 10, -1], [4, 10, 6, 4, 9, 10, 0, 8, 3, -1],
    [10, 0, 1, 10, 6, 0, 6, 4, 0, -1], [8, 3, 1, 8, 1, 6, 8, 6, 4, 6, 1, 10, -1],
    [1, 4, 9, 1, 2, 4, 2, 6, 4, -1], [3, 0, 8, 1, 2, 9, 2, 4, 9, 2, 6, 4, -1],
    [0, 2, 4, 4, 2, 6, -1], [8, 3, 2, 8, 2, 4, 4, 2, 6, -1],
    [10, 4, 9, 10, 6, 4, 11, 2, 3, -1], [0, 8, 2, 2, 8, 11, 4, 9, 10, 4, 10, 6, -1],
    [3, 11, 2, 0, 1, 6, 0, 6, 4, 6, 1, 10, -1], [6, 4, 1, 6, 1, 10, 4, 8, 1, 2, 1, 11, 8, 11, 1, -1],
    [9, 6, 4, 9, 3, 6, 9, 1, 3, 11, 6, 3, -1], [8, 11, 1, 8, 1, 0, 11, 6, 1, 9, 1, 4, 6, 4, 1, -1],
    [3, 11, 6, 3, 6, 0, 0, 6, 4, -1], [6, 4, 8, 11, 6, 8, -1],
    [7, 10, 6, 7, 8, 10, 8, 9, 10, -1], [0, 7, 3, 0, 10, 7, 0, 9, 10, 6, 7, 10, -1],
    [10, 6, 7, 1, 10, 7, 1, 7, 8, 1, 8, 0, -1], [10, 6, 7, 10, 7, 1, 1, 7, 3, -1],
    [1, 2, 6, 1, 6, 8, 1, 8, 9, 8, 6, 7, -1], [2, 6, 9, 2, 9, 1, 6, 7, 9, 0, 9, 3, 7, 3, 9, -1],
    [7, 8, 0, 7, 0, 6, 6, 0, 2, -1], [7, 3, 2, 6, 7, 2, -1],
    [2, 3, 11, 10, 6, 8, 10, 8, 9, 8, 6, 7, -1], [2, 0, 7, 2, 7, 11, 0, 9, 7, 6, 7, 10, 9, 10, 7, -1],
    [1, 8, 0, 1, 7, 8, 1, 10, 7, 6, 7, 10, 2, 3, 11, -1], [11, 2, 1, 11, 1, 7, 10, 6, 1, 6, 7, 1, -1],
    [8, 9, 6, 8, 6, 7, 9, 1, 6, 11, 6, 3, 1, 3, 6, -1], [0, 9, 1, 11, 6, 7, -1],
    [7, 8, 0, 7, 0, 6, 3, 11, 0, 11, 6, 0, -1], [7, 11, 6, -1],
    [7, 6, 11, -1], [3, 0, 8, 11, 7, 6, -1], [0, 1, 9, 11, 7, 6, -1],
    [8, 1, 9, 8, 3, 1, 11, 7, 6, -1], [10, 1, 2, 6, 11, 7, -1],
    [1, 2, 10, 3, 0, 8, 6, 11, 7, -1], [2, 9, 0, 2, 10, 9, 6, 11, 7, -1],
    [6, 11, 7, 2, 10, 3, 10, 8, 3, 10, 9, 8, -1], [7, 2, 3, 6, 2, 7, -1],
    [7, 0, 8, 7, 6, 0, 6, 2, 0, -1], [2, 7, 6, 2, 3, 7, 0, 1, 9, -1],
    [1, 6, 2, 1, 8, 6, 1, 9, 8, 8, 7, 6, -1], [10, 7, 6, 10, 1, 7, 1, 3, 7, -1],
    [10, 7, 6, 1, 7, 10, 1, 8, 7, 1, 0, 8, -1], [0, 3, 7, 0, 7, 10, 0, 10, 9, 6, 10, 7, -1],
    [7, 6, 10, 7, 10, 8, 8, 10, 9, -1], [6, 8, 4, 11, 8, 6, -1],
    [3, 6, 11, 3, 0, 6, 0, 4, 6, -1], [8, 6, 11, 8, 4, 6, 9, 0, 1, -1],
    [9, 4, 6, 9, 6, 3, 9, 3, 1, 11, 3, 6, -1], [6, 8, 4, 6, 11, 8, 2, 10, 1, -1],
    [1, 2, 10, 3, 0, 11, 0, 6, 11, 0, 4, 6, -1], [4, 11, 8, 4, 6, 11, 0, 2, 9, 2, 10, 9, -1],
    [10, 9, 3, 10, 3, 2, 9, 4, 3, 11, 3, 6, 4, 6, 3, -1], [8, 2, 3, 8, 4, 2, 4, 6, 2, -1],
    [0, 4, 2, 4, 6, 2, -1], [1, 9, 0, 2, 3, 4, 2, 4, 6, 4, 3, 8, -1],
    [1, 9, 4, 1, 4, 2, 2, 4, 6, -1], [8, 1, 3, 8, 6, 1, 8, 4, 6, 6, 10, 1, -1],
    [10, 1, 0, 10, 0, 6, 6, 0, 4, -1], [4, 6, 3, 4, 3, 8, 6, 10, 3, 0, 3, 9, 10, 9, 3, -1],
    [10, 9, 4, 6, 10, 4, -1], [4, 9, 5, 7, 6, 11, -1], [0, 8, 3, 4, 9, 5, 11, 7, 6, -1],
    [5, 0, 1, 5, 4, 0, 7, 6, 11, -1], [11, 7, 6, 8, 3, 4, 3, 5, 4, 3, 1, 5, -1],
    [9, 5, 4, 10, 1, 2, 7, 6, 11, -1], [6, 11, 7, 1, 2, 10, 0, 8, 3, 4, 9, 5, -1],
    [7, 6, 11, 5, 4, 10, 4, 2, 10, 4, 0, 2, -1], [3, 4, 8, 3, 5, 4, 3, 2, 5, 10, 5, 2, 11, 7, 6, -1],
    [7, 2, 3, 7, 6, 2, 5, 4, 9, -1], [9, 5, 4, 0, 8, 6, 0, 6, 2, 6, 8, 7, -1],
    [3, 6, 2, 3, 7, 6, 1, 5, 0, 5, 4, 0, -1], [6, 2, 8, 6, 8, 7, 2, 1, 8, 4, 8, 5, 1, 5, 8, -1],
    [9, 5, 4, 10, 1, 6, 1, 7, 6, 1, 3, 7, -1], [1, 6, 10, 1, 7, 6, 1, 0, 7, 8, 7, 0, 9, 5, 4, -1],
    [4, 0, 10, 4, 10, 5, 0, 3, 10, 6, 10, 7, 3, 7, 10, -1], [7, 6, 10, 7, 10, 8, 5, 4, 10, 4, 8, 10, -1],
    [6, 9, 5, 6, 11, 9, 11, 8, 9, -1], [3, 6, 11, 0, 6, 3, 0, 5, 6, 0, 9, 5, -1],
    [0, 11, 8, 0, 5, 11, 0, 1, 5, 5, 6, 11, -1], [6, 11, 3, 6, 3, 5, 5, 3, 1, -1],
    [1, 2, 10, 9, 5, 11, 9, 11, 8, 11, 5, 6, -1], [0, 11, 3, 0, 6, 11, 0, 9, 6, 5, 6, 9, 1, 2, 10, -1],
    [11, 8, 5, 11, 5, 6, 8, 0, 5, 10, 5, 2, 0, 2, 5, -1], [6, 11, 3, 6, 3, 5, 2, 10, 3, 10, 5, 3, -1],
    [5, 8, 9, 5, 2, 8, 5, 6, 2, 3, 8, 2, -1], [9, 5, 6, 9, 6, 0, 0, 6, 2, -1],
    [1, 5, 8, 1, 8, 0, 5, 6, 8, 3, 8, 2, 6, 2, 8, -1], [1, 5, 6, 2, 1, 6, -1],
    [1, 3, 6, 1, 6, 10, 3, 8, 6, 5, 6, 9, 8, 9, 6, -1], [10, 1, 0, 10, 0, 6, 9, 5, 0, 5, 6, 0, -1],
    [0, 3, 8, 5, 6, 10, -1], [10, 5, 6, -1], [11, 5, 10, 7, 5, 11, -1],
    [11, 5, 10, 11, 7, 5, 8, 3, 0, -1], [5, 11, 7, 5, 10, 11, 1, 9, 0, -1],
    [10, 7, 5, 10, 11, 7, 9, 8, 1, 8, 3, 1, -1], [11, 1, 2, 11, 7, 1, 7, 5, 1, -1],
    [0, 8, 3, 1, 2, 7, 1, 7, 5, 7, 2, 11, -1], [9, 7, 5, 9, 2, 7, 9, 0, 2, 2, 11, 7, -1],
    [7, 5, 2, 7, 2, 11, 5, 9, 2, 3, 2, 8, 9, 8, 2, -1], [2, 5, 10, 2, 3, 5, 3, 7, 5, -1],
    [8, 2, 0, 8, 5, 2, 8, 7, 5, 10, 2, 5, -1], [9, 0, 1, 5, 10, 3, 5, 3, 7, 3, 10, 2, -1],
    [9, 8, 2, 9, 2, 1, 8, 7, 2, 10, 2, 5, 7, 5, 2, -1], [1, 3, 5, 3, 7, 5, -1],
    [0, 8, 7, 0, 7, 1, 1, 7, 5, -1], [9, 0, 3, 9, 3, 5, 5, 3, 7, -1], [9, 8, 7, 5, 9, 7, -1],
    [5, 8, 4, 5, 10, 8, 10, 11, 8, -1], [5, 0, 4, 5, 11, 0, 5, 10, 11, 11, 3, 0, -1],
    [0, 1, 9, 8, 4, 10, 8, 10, 11, 10, 4, 5, -1], [10, 11, 4, 10, 4, 5, 11, 3, 4, 9, 4, 1, 3, 1, 4, -1],
    [2, 5, 1, 2, 8, 5, 2, 11, 8, 4, 5, 8, -1], [0, 4, 11, 0, 11, 3, 4, 5, 11, 2, 11, 1, 5, 1, 11, -1],
    [0, 2, 5, 0, 5, 9, 2, 11, 5, 4, 5, 8, 11, 8, 5, -1], [9, 4, 5, 2, 11, 3, -1],
    [2, 5, 10, 3, 5, 2, 3, 4, 5, 3, 8, 4, -1], [5, 10, 2, 5, 2, 4, 4, 2, 0, -1],
    [3, 10, 2, 3, 5, 10, 3, 8, 5, 4, 5, 8, 0, 1, 9, -1], [5, 10, 2, 5, 2, 4, 1, 9, 2, 9, 4, 2, -1],
    [8, 4, 5, 8, 5, 3, 3, 5, 1, -1], [0, 4, 5, 1, 0, 5, -1],
    [8, 4, 5, 8, 5, 3, 9, 0, 5, 0, 3, 5, -1], [9, 4, 5, -1],
    [4, 11, 7, 4, 9, 11, 9, 10, 11, -1], [0, 8, 3, 4, 9, 7, 9, 11, 7, 9, 10, 11, -1],
    [1, 10, 11, 1, 11, 4, 1, 4, 0, 7, 4, 11, -1], [3, 1, 4, 3, 4, 8, 1, 10, 4, 7, 4, 11, 10, 11, 4, -1],
    [4, 11, 7, 9, 11, 4, 9, 2, 11, 9, 1, 2, -1], [9, 7, 4, 9, 11, 7, 9, 1, 11, 2, 11, 1, 0, 8, 3, -1],
    [11, 7, 4, 11, 4, 2, 2, 4, 0, -1], [11, 7, 4, 11, 4, 2, 8, 3, 4, 3, 2, 4, -1],
    [2, 9, 10, 2, 7, 9, 2, 3, 7, 7, 4, 9, -1], [9, 10, 7, 9, 7, 4, 10, 2, 7, 8, 7, 0, 2, 0, 7, -1],
    [3, 7, 10, 3, 10, 2, 7, 4, 10, 1, 10, 0, 4, 0, 10, -1], [1, 10, 2, 8, 7, 4, -1],
    [4, 9, 1, 4, 1, 7, 7, 1, 3, -1], [4, 9, 1, 4, 1, 7, 0, 8, 1, 8, 7, 1, -1],
    [4, 0, 3, 7, 4, 3, -1], [4, 8, 7, -1], [9, 10, 8, 10, 11, 8, -1],
    [3, 0, 9, 3, 9, 11, 11, 9, 10, -1], [0, 1, 10, 0, 10, 8, 8, 10, 11, -1],
    [3, 1, 10, 11, 3, 10, -1], [1, 2, 11, 1, 11, 9, 9, 11, 8, -1],
    [3, 0, 9, 3, 9, 11, 1, 2, 9, 2, 11, 9, -1], [0, 2, 11, 8, 0, 11, -1], [3, 2, 11, -1],
    [2, 3, 8, 2, 8, 10, 10, 8, 9, -1], [9, 10, 2, 0, 9, 2, -1],
    [2, 3, 8, 2, 8, 10, 0, 1, 8, 1, 10, 8, -1], [1, 10, 2, -1],
    [1, 3, 8, 9, 1, 8, -1], [0, 9, 1, -1], [0, 3, 8, -1], [-1]
];

// Marching cubes
function marchingCubes(
    grid: Float32Array,
    nx: number, ny: number, nz: number,
    isoLevel: number
): { positions: number[]; normals: number[] } {
    const positions: number[] = [];
    const normals: number[] = [];

    const getVal = (x: number, y: number, z: number) => {
        if (x < 0 || x >= nx || y < 0 || y >= ny || z < 0 || z >= nz) return 0;
        return grid[x + y * nx + z * nx * ny];
    };

    const lerp = (v1: number, v2: number, t: number) => v1 + t * (v2 - v1);

    const vertexInterp = (
        x1: number, y1: number, z1: number, v1: number,
        x2: number, y2: number, z2: number, v2: number
    ): [number, number, number] => {
        if (Math.abs(isoLevel - v1) < 0.00001) return [x1, y1, z1];
        if (Math.abs(isoLevel - v2) < 0.00001) return [x2, y2, z2];
        if (Math.abs(v1 - v2) < 0.00001) return [x1, y1, z1];
        const t = (isoLevel - v1) / (v2 - v1);
        return [lerp(x1, x2, t), lerp(y1, y2, t), lerp(z1, z2, t)];
    };

    for (let z = 0; z < nz - 1; z++) {
        for (let y = 0; y < ny - 1; y++) {
            for (let x = 0; x < nx - 1; x++) {
                const vals = [
                    getVal(x, y, z), getVal(x + 1, y, z),
                    getVal(x + 1, y + 1, z), getVal(x, y + 1, z),
                    getVal(x, y, z + 1), getVal(x + 1, y, z + 1),
                    getVal(x + 1, y + 1, z + 1), getVal(x, y + 1, z + 1),
                ];

                let cubeIndex = 0;
                for (let i = 0; i < 8; i++) {
                    if (vals[i] > isoLevel) cubeIndex |= (1 << i);
                }

                if (EDGE_TABLE[cubeIndex] === 0) continue;

                const corners: [number, number, number][] = [
                    [x, y, z], [x + 1, y, z], [x + 1, y + 1, z], [x, y + 1, z],
                    [x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]
                ];

                const edges: ([number, number, number] | null)[] = new Array(12).fill(null);
                const edgeVerts: [number, number][] = [
                    [0, 1], [1, 2], [2, 3], [3, 0],
                    [4, 5], [5, 6], [6, 7], [7, 4],
                    [0, 4], [1, 5], [2, 6], [3, 7]
                ];

                for (let i = 0; i < 12; i++) {
                    if (EDGE_TABLE[cubeIndex] & (1 << i)) {
                        const [a, b] = edgeVerts[i];
                        edges[i] = vertexInterp(
                            corners[a][0], corners[a][1], corners[a][2], vals[a],
                            corners[b][0], corners[b][1], corners[b][2], vals[b]
                        );
                    }
                }

                const triTable = TRI_TABLE[cubeIndex];
                for (let i = 0; triTable[i] !== -1; i += 3) {
                    const v0 = edges[triTable[i]]!;
                    const v1 = edges[triTable[i + 1]]!;
                    const v2 = edges[triTable[i + 2]]!;

                    const ax = v1[0] - v0[0], ay = v1[1] - v0[1], az = v1[2] - v0[2];
                    const bx = v2[0] - v0[0], by = v2[1] - v0[1], bz = v2[2] - v0[2];
                    let nx = ay * bz - az * by;
                    let ny = az * bx - ax * bz;
                    let nzz = ax * by - ay * bx;
                    const len = Math.sqrt(nx * nx + ny * ny + nzz * nzz) || 1;
                    nx /= len; ny /= len; nzz /= len;

                    positions.push(...v0, ...v1, ...v2);
                    normals.push(nx, ny, nzz, nx, ny, nzz, nx, ny, nzz);
                }
            }
        }
    }

    return { positions, normals };
}

// Calculate structure factor with custom form factors, resolution cutoff, and Debye-Waller factor
function calculateStructureFactorCustom(
    h: number,
    k: number,
    l: number,
    structure: CrystalStructure,
    wavelength: number,
    formFactors?: Record<string, ControlPoint[]>,
    bFactor: number = 1.5
): { re: number; im: number } | null {
    const d = calculateDSpacing(h, k, l, structure);

    // Resolution cutoff: d_min = λ/2 (Bragg limit)
    const dMin = wavelength / 2;
    if (d < dMin) {
        return null; // Beyond observable resolution
    }

    const twoTheta = calculateTwoTheta(d, wavelength);
    if (isNaN(twoTheta)) {
        return null;
    }

    // sin(θ)/λ for form factor calculation
    const sinTheta_lambda = Math.sin((twoTheta * Math.PI) / 360) / wavelength;

    // Debye-Waller factor: exp(-B * sin²θ/λ²)
    // B is typically 1-3 Ų for atoms at room temperature
    const debyeWaller = Math.exp(-bFactor * sinTheta_lambda * sinTheta_lambda);

    let F = { re: 0, im: 0 };

    for (const atom of structure.atoms) {
        const [x, y, z] = atom.position;
        const phase = 2 * Math.PI * (h * x + k * y + l * z);

        // Get atomic form factor - use custom if provided, otherwise use Cromer-Mann
        let f: number;
        if (formFactors && formFactors[atom.element] && formFactors[atom.element].length > 0) {
            f = interpolateFormFactorSmooth(formFactors[atom.element], sinTheta_lambda);
        } else {
            f = atomicFormFactor(atom.element, sinTheta_lambda);
        }

        // Apply Debye-Waller damping
        f *= debyeWaller;

        // exp(i·phase) = cos(phase) + i·sin(phase)
        F.re += f * Math.cos(phase);
        F.im += f * Math.sin(phase);
    }

    return F;
}

export const ElectronDensity3D: React.FC<ElectronDensity3DProps> = React.memo(({
    width,
    height,
    structure,
    wavelength,
    resolution,
    maxHKL,
    isoLevel,
    renderMode,
    theme,
    formFactors,
    bFactor = 1.5,
    sliceZ,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const materialRef = useRef<THREE.ShaderMaterial | THREE.MeshStandardMaterial | THREE.LineBasicMaterial | null>(null);
    const meshRef = useRef<THREE.Mesh | THREE.LineSegments | null>(null);
    const volumeTextureRef = useRef<THREE.Data3DTexture | null>(null);
    const slicePlaneRef = useRef<THREE.Mesh | null>(null);
    const frameRef = useRef<number>(0);
    const isDraggingRef = useRef(false);
    const lastMouseRef = useRef({ x: 0, y: 0 });
    const sphericalRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 4, radius: 4 });

    const isDark = theme.text.startsWith('#e') || theme.text.startsWith('#f');

    // Pre-compute reflections (depends on wavelength via atomic form factors)
    const reflections = useMemo(() => {
        const data: ReflectionData[] = [];
        for (let h = -maxHKL; h <= maxHKL; h++) {
            for (let k = -maxHKL; k <= maxHKL; k++) {
                for (let l = -maxHKL; l <= maxHKL; l++) {
                    if (h === 0 && k === 0 && l === 0) continue;
                    if (!isAllowedReflection(Math.abs(h), Math.abs(k), Math.abs(l), structure)) continue;
                    const F = calculateStructureFactorCustom(h, k, l, structure, wavelength, formFactors, bFactor);
                    if (F && (Math.abs(F.re) > 0.01 || Math.abs(F.im) > 0.01)) {
                        data.push({ h, k, l, fRe: F.re, fIm: F.im });
                    }
                }
            }
        }
        return data;
    }, [structure, maxHKL, wavelength, formFactors, bFactor]);

    // Compute 3D electron density grid using FFT
    const { grid, minDensity, maxDensity, actualResolution } = useMemo(() => {
        // Use FFT-based calculation (much faster and handles larger grids)
        // Apply Gaussian damping with sigma = maxHKL to reduce Gibbs ringing
        const sigma = maxHKL * 0.8; // Smooth high-frequency oscillations
        const result = calculateElectronDensityFFT(reflections, resolution, sigma);

        // Get actual resolution (rounded up to power of 2)
        const n = Math.pow(2, Math.ceil(Math.log2(resolution)));

        return {
            grid: result.grid,
            minDensity: result.minDensity,
            maxDensity: result.maxDensity,
            actualResolution: n
        };
    }, [reflections, resolution, maxHKL]);

    // Initialize Three.js scene
    useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;

        // Create renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Create scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(isDark ? '#1a1a2e' : '#f0f0f0');
        sceneRef.current = scene;

        // Add lights for isosurface mode
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 5, 5);
        scene.add(dirLight);

        // Create camera
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        camera.position.set(3, 2, 3);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        // Add wireframe box
        const wireGeo = new THREE.BufferGeometry();
        const wireVerts = new Float32Array([
            -1, -1, -1,  1, -1, -1,   1, -1, -1,  1, 1, -1,
            1, 1, -1,  -1, 1, -1,    -1, 1, -1,  -1, -1, -1,
            -1, -1, 1,  1, -1, 1,    1, -1, 1,  1, 1, 1,
            1, 1, 1,  -1, 1, 1,     -1, 1, 1,  -1, -1, 1,
            -1, -1, -1,  -1, -1, 1,  1, -1, -1,  1, -1, 1,
            1, 1, -1,  1, 1, 1,     -1, 1, -1,  -1, 1, 1,
        ]);
        wireGeo.setAttribute('position', new THREE.BufferAttribute(wireVerts, 3));
        const wireMat = new THREE.LineBasicMaterial({ color: isDark ? '#666' : '#999' });
        const wireframe = new THREE.LineSegments(wireGeo, wireMat);
        scene.add(wireframe);

        // Add slice plane indicator (semi-transparent plane with border)
        const slicePlaneGeo = new THREE.PlaneGeometry(2, 2);
        const slicePlaneMat = new THREE.MeshBasicMaterial({
            color: isDark ? 0x6b9eff : 0x2563eb,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        const slicePlane = new THREE.Mesh(slicePlaneGeo, slicePlaneMat);
        slicePlane.rotation.x = Math.PI / 2; // Rotate to be horizontal (XY plane)
        slicePlane.visible = false; // Hidden by default
        scene.add(slicePlane);
        slicePlaneRef.current = slicePlane;

        // Add slice plane border
        const borderGeo = new THREE.BufferGeometry();
        const borderVerts = new Float32Array([
            -1, 0, -1,  1, 0, -1,
            1, 0, -1,   1, 0, 1,
            1, 0, 1,   -1, 0, 1,
            -1, 0, 1,  -1, 0, -1,
        ]);
        borderGeo.setAttribute('position', new THREE.BufferAttribute(borderVerts, 3));
        const borderMat = new THREE.LineBasicMaterial({
            color: isDark ? 0x6b9eff : 0x2563eb,
            transparent: true,
            opacity: 0.6,
        });
        const border = new THREE.LineSegments(borderGeo, borderMat);
        slicePlane.add(border); // Attach to slice plane so it moves together

        // Mouse controls
        const onMouseDown = (e: MouseEvent) => {
            isDraggingRef.current = true;
            lastMouseRef.current = { x: e.clientX, y: e.clientY };
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            const dx = e.clientX - lastMouseRef.current.x;
            const dy = e.clientY - lastMouseRef.current.y;
            sphericalRef.current.theta -= dx * 0.01;
            sphericalRef.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, sphericalRef.current.phi + dy * 0.01));
            lastMouseRef.current = { x: e.clientX, y: e.clientY };
        };

        const onMouseUp = () => {
            isDraggingRef.current = false;
        };

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            sphericalRef.current.radius = Math.max(2, Math.min(10, sphericalRef.current.radius + e.deltaY * 0.01));
        };

        container.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        container.addEventListener('wheel', onWheel, { passive: false });

        // Animation loop
        const animate = () => {
            frameRef.current = requestAnimationFrame(animate);

            if (!isDraggingRef.current) {
                sphericalRef.current.theta += 0.003;
            }

            const { theta, phi, radius } = sphericalRef.current;
            camera.position.x = radius * Math.sin(phi) * Math.cos(theta);
            camera.position.y = radius * Math.cos(phi);
            camera.position.z = radius * Math.sin(phi) * Math.sin(theta);
            camera.lookAt(0, 0, 0);

            renderer.render(scene, camera);
        };
        animate();

        return () => {
            cancelAnimationFrame(frameRef.current);
            container.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            container.removeEventListener('wheel', onWheel);
            renderer.dispose();
            wireGeo.dispose();
            wireMat.dispose();
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
        };
    }, [width, height, isDark]);

    // Update visualization based on render mode and data
    useEffect(() => {
        if (!sceneRef.current) return;
        const scene = sceneRef.current;

        // Remove old mesh
        if (meshRef.current) {
            scene.remove(meshRef.current);
            if (meshRef.current.geometry) meshRef.current.geometry.dispose();
            meshRef.current = null;
        }
        if (materialRef.current) {
            materialRef.current.dispose();
            materialRef.current = null;
        }
        if (volumeTextureRef.current) {
            volumeTextureRef.current.dispose();
            volumeTextureRef.current = null;
        }

        const color = new THREE.Color(isDark ? '#6b9eff' : '#2563eb');

        if (renderMode === 'raymarching') {
            // Create volume texture
            const texture = new THREE.Data3DTexture(grid, actualResolution, actualResolution, actualResolution);
            texture.format = THREE.RedFormat;
            texture.type = THREE.FloatType;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.wrapR = THREE.ClampToEdgeWrapping;
            texture.needsUpdate = true;
            volumeTextureRef.current = texture;

            // Create shader material
            // isoLevel comes as 0-100 percentage, convert to 0-1
            const material = new THREE.ShaderMaterial({
                uniforms: {
                    uVolume: { value: texture },
                    uIsoLevel: { value: isoLevel / 100 },
                    uMinDensity: { value: minDensity },
                    uMaxDensity: { value: maxDensity },
                    uColor: { value: color },
                    uOpacity: { value: 0.9 },
                },
                vertexShader: rayMarchVertexShader,
                fragmentShader: rayMarchFragmentShader,
                side: THREE.BackSide,
                transparent: true,
            });
            materialRef.current = material;

            const boxGeo = new THREE.BoxGeometry(2, 2, 2);
            const mesh = new THREE.Mesh(boxGeo, material);
            scene.add(mesh);
            meshRef.current = mesh;
        } else {
            // Isosurface mode - marching cubes (isoLevel is 0-100, convert to 0-1)
            const { positions, normals } = marchingCubes(grid, actualResolution, actualResolution, actualResolution, isoLevel / 100);

            if (positions.length > 0) {
                const geo = new THREE.BufferGeometry();
                geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

                // Center and scale
                geo.translate(-actualResolution / 2, -actualResolution / 2, -actualResolution / 2);
                geo.scale(2 / actualResolution, 2 / actualResolution, 2 / actualResolution);

                // Create wireframe from edges
                const edgesGeo = new THREE.EdgesGeometry(geo, 15);
                const lineMat = new THREE.LineBasicMaterial({ color: color });
                const wireframe = new THREE.LineSegments(edgesGeo, lineMat);
                scene.add(wireframe);
                meshRef.current = wireframe;
                materialRef.current = lineMat;
            }
        }
    }, [grid, actualResolution, renderMode, minDensity, maxDensity, isoLevel, isDark]);

    // Fast iso level update for ray marching mode
    useEffect(() => {
        if (renderMode === 'raymarching' && materialRef.current && 'uniforms' in materialRef.current) {
            (materialRef.current as THREE.ShaderMaterial).uniforms.uIsoLevel.value = isoLevel / 100;
        }
    }, [isoLevel, renderMode]);

    // Update background color
    useEffect(() => {
        if (sceneRef.current) {
            sceneRef.current.background = new THREE.Color(isDark ? '#1a1a2e' : '#f0f0f0');
        }
    }, [isDark]);

    // Update slice plane position
    useEffect(() => {
        if (slicePlaneRef.current) {
            if (sliceZ !== undefined) {
                // Convert sliceZ (0-1) to position in box (-1 to 1)
                const zPos = sliceZ * 2 - 1;
                slicePlaneRef.current.position.y = zPos;
                slicePlaneRef.current.visible = true;
            } else {
                slicePlaneRef.current.visible = false;
            }
        }
    }, [sliceZ]);

    return (
        <div
            ref={containerRef}
            style={{
                width,
                height,
                borderRadius: '4px',
                border: `1px solid ${theme.border}`,
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: 8,
                    left: 10,
                    color: theme.text,
                    fontSize: '11px',
                    fontWeight: 'bold',
                    pointerEvents: 'none',
                }}
            >
                Electron Density 3D
            </div>

            <div
                style={{
                    position: 'absolute',
                    bottom: 8,
                    left: 10,
                    color: theme.textMuted,
                    fontSize: '9px',
                    pointerEvents: 'none',
                }}
            >
                Drag to rotate, scroll to zoom
            </div>
        </div>
    );
});

ElectronDensity3D.displayName = 'ElectronDensity3D';

export default ElectronDensity3D;
