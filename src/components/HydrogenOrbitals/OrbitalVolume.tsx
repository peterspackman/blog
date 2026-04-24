import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { buildFragmentShader, vertexShader, BOUNDING_RADIUS, MAX_ORBITAL_TERMS } from './shaders';
import { cartesianNorm } from './codegen';
import type { DisplayMode, RenderMode, Term } from './types';
import type { QualityProfile } from './quality';

export interface OrbitalVolumeProps {
    /** All summands of the wavefunction. Angular/full modes sum over them.
     *  Radial mode uses (radN, radL) instead — see below. */
    terms: Term[];
    /** (n, l) for radial mode's single-term rendering. */
    radN: number;
    radL: number;
    Z?: number;
    isoValue: number;
    renderMode: RenderMode;
    displayMode: DisplayMode;
    sliceAxis: 0 | 1 | 2;
    slicePosition: number;
    clipEnabled: boolean;
    envelopeScale: number;
    colorPositive: string;
    colorNegative: string;
    background: string;
    boundingRadius?: number;
    /** 1 / max|field| for auto-scaling slice and density modes. */
    normScale: number;
    /** Quality tier — drives shader step counts, bisection iters, and lighting
     *  complexity. Changing tier recompiles the shader (keyed via shaderVariant). */
    qualityProfile: QualityProfile;
}

const MODE_INDEX: Record<RenderMode, number> = {
    isosurface: 0,
    density: 1,
    slice: 2,
};

const DISPLAY_INDEX: Record<DisplayMode, number> = {
    angular: 0,
    radial: 1,
    full: 2,
};

interface PackedTerms {
    kinds: number[];
    ns: number[];
    p1s: number[];
    p2s: number[];
    p3s: number[];
    coeffs: number[];
    count: number;
}

/** Flatten the Term[] into GLSL-friendly fixed-size arrays. Cartesian
 *  coefficients absorb the unit-sphere normalisation so the shader just
 *  multiplies coeff · x^a y^b z^c without needing a norm lookup. */
function packTerms(terms: Term[]): PackedTerms {
    const kinds = new Array<number>(MAX_ORBITAL_TERMS).fill(0);
    const ns = new Array<number>(MAX_ORBITAL_TERMS).fill(1);
    const p1s = new Array<number>(MAX_ORBITAL_TERMS).fill(0);
    const p2s = new Array<number>(MAX_ORBITAL_TERMS).fill(0);
    const p3s = new Array<number>(MAX_ORBITAL_TERMS).fill(0);
    const coeffs = new Array<number>(MAX_ORBITAL_TERMS).fill(0);

    const bounded = terms.slice(0, MAX_ORBITAL_TERMS);
    bounded.forEach((t, i) => {
        ns[i] = t.n;
        if (t.kind === 'spherical') {
            kinds[i] = 0;
            p1s[i] = t.l;
            p2s[i] = t.m;
            p3s[i] = 0;
            coeffs[i] = t.coeff;
        } else {
            kinds[i] = 1;
            p1s[i] = t.a;
            p2s[i] = t.b;
            p3s[i] = t.c;
            coeffs[i] = t.coeff * cartesianNorm(t.a, t.b, t.c);
        }
    });

    return { kinds, ns, p1s, p2s, p3s, coeffs, count: bounded.length };
}

export const OrbitalVolume: React.FC<OrbitalVolumeProps> = ({
    terms,
    radN,
    radL,
    Z = 1,
    isoValue,
    renderMode,
    displayMode,
    sliceAxis,
    slicePosition,
    clipEnabled,
    envelopeScale,
    colorPositive,
    colorNegative,
    background,
    boundingRadius = BOUNDING_RADIUS,
    normScale,
    qualityProfile,
}) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const { camera, invalidate } = useThree();

    const packed = useMemo(() => packTerms(terms), [terms]);

    // Structural knobs that require a shader recompile (NUM_TERMS / DISPLAY_MODE /
    // RENDER_MODE + tier-controlled defines). Keyed on primitives so re-derivation
    // is cheap; recompile only fires on real variant change.
    const shaderVariant = useMemo(
        () => ({
            numTerms: Math.max(1, packed.count),
            displayMode: DISPLAY_INDEX[displayMode] as 0 | 1 | 2,
            renderMode: MODE_INDEX[renderMode] as 0 | 1 | 2,
            stepsIso: qualityProfile.stepsIso,
            stepsDensity: qualityProfile.stepsDensity,
            bisectionIters: qualityProfile.bisectionIters,
            lightingComplex: qualityProfile.lightingComplex,
        }),
        [
            packed.count,
            displayMode,
            renderMode,
            qualityProfile.stepsIso,
            qualityProfile.stepsDensity,
            qualityProfile.bisectionIters,
            qualityProfile.lightingComplex,
        ],
    );

    const material = useMemo(() => {
        return new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader: buildFragmentShader(shaderVariant),
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false,
            uniforms: {
                uRadN: { value: radN },
                uRadL: { value: radL },
                uZ: { value: Z },
                uTermKind: { value: packed.kinds.slice() },
                uTermN: { value: packed.ns.slice() },
                uTermP1: { value: packed.p1s.slice() },
                uTermP2: { value: packed.p2s.slice() },
                uTermP3: { value: packed.p3s.slice() },
                uTermCoeff: { value: packed.coeffs.slice() },
                uIsoValue: { value: isoValue },
                uSliceAxis: { value: sliceAxis },
                uSlicePosition: { value: slicePosition },
                uClipEnabled: { value: clipEnabled ? 1 : 0 },
                uEnvelopeScale: { value: envelopeScale },
                uColorPositive: { value: new THREE.Color(colorPositive) },
                uColorNegative: { value: new THREE.Color(colorNegative) },
                uBackground: { value: new THREE.Color(background) },
                uCameraPos: { value: camera.position.clone() },
                uBoundingRadius: { value: boundingRadius },
                uNormScale: { value: normScale },
            },
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shaderVariant]);

    // Dispose old program/material when a variant change recreates it.
    useEffect(() => () => material.dispose(), [material]);

    // Push prop changes into uniforms and request one redraw.
    useEffect(() => {
        const u = material.uniforms;
        u.uRadN.value = radN;
        u.uRadL.value = radL;
        u.uZ.value = Z;
        const assign = (dst: number[], src: number[]) => {
            for (let i = 0; i < MAX_ORBITAL_TERMS; i++) dst[i] = src[i];
        };
        assign(u.uTermKind.value as number[], packed.kinds);
        assign(u.uTermN.value as number[], packed.ns);
        assign(u.uTermP1.value as number[], packed.p1s);
        assign(u.uTermP2.value as number[], packed.p2s);
        assign(u.uTermP3.value as number[], packed.p3s);
        assign(u.uTermCoeff.value as number[], packed.coeffs);
        u.uIsoValue.value = isoValue;
        u.uSliceAxis.value = sliceAxis;
        u.uSlicePosition.value = slicePosition;
        u.uClipEnabled.value = clipEnabled ? 1 : 0;
        u.uEnvelopeScale.value = envelopeScale;
        (u.uColorPositive.value as THREE.Color).set(colorPositive);
        (u.uColorNegative.value as THREE.Color).set(colorNegative);
        (u.uBackground.value as THREE.Color).set(background);
        u.uBoundingRadius.value = boundingRadius;
        u.uNormScale.value = normScale;
        invalidate();
    }, [
        material,
        packed,
        radN,
        radL,
        Z,
        isoValue,
        sliceAxis,
        slicePosition,
        clipEnabled,
        envelopeScale,
        colorPositive,
        colorNegative,
        background,
        boundingRadius,
        normScale,
        invalidate,
    ]);

    useFrame(() => {
        (material.uniforms.uCameraPos.value as THREE.Vector3).copy(camera.position);
    });

    return (
        <mesh ref={meshRef} material={material}>
            <sphereGeometry args={[boundingRadius, 48, 24]} />
        </mesh>
    );
};

export default OrbitalVolume;
