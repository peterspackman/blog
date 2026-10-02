import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { clampQuality, fragmentShader, vertexShader, BOUNDING_RADIUS } from './shaders';
import { ANG_SLOTS, MAX_TERMS, packOrbital } from './packing';
import type { DisplayMode, RenderMode, Term } from './types';
import { scaledSteps, type QualityProfile } from './quality';

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
     *  complexity (all uniforms; no recompile). */
    qualityProfile: QualityProfile;
}

const MODE_INDEX: Record<RenderMode, number> = {
    isosurface: 0,
    density: 1,
    slice: 2,
};

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
    const { camera, gl, scene, invalidate } = useThree();

    const packed = useMemo(() => packOrbital(terms, displayMode, radN, radL, Z), [terms, displayMode, radN, radL, Z]);

    // Mode, term count and quality are uniforms, so one program serves every
    // setting. Ray-march steps shrink with superposition size because each
    // step evaluates every term.
    const numTerms = Math.max(1, packed.numTerms);
    const costTerms = numTerms;
    const q = clampQuality({
        stepsIso: scaledSteps(qualityProfile.stepsIso, costTerms),
        stepsDensity: scaledSteps(qualityProfile.stepsDensity, costTerms),
        bisectionIters: qualityProfile.bisectionIters,
    });

    // Created once. Initial uniform values are placeholders; the effect below
    // fills them before the first frame.
    const material = useMemo(
        () =>
            new THREE.ShaderMaterial({
                vertexShader,
                fragmentShader,
                side: THREE.BackSide,
                transparent: true,
                depthWrite: false,
                uniforms: {
                    uRenderMode: { value: 0 },
                    uUseEnvelope: { value: 0 },
                    uNumTerms: { value: 1 },
                    uStepsIso: { value: 32 },
                    uStepsDensity: { value: 32 },
                    uBisectionIters: { value: 4 },
                    uLightingComplex: { value: 1 },
                    uDegree: { value: new Array<number>(MAX_TERMS).fill(0) },
                    uAng: { value: new Array<number>(MAX_TERMS * ANG_SLOTS).fill(0) },
                    uRadPoly: { value: Array.from({ length: MAX_TERMS }, () => new THREE.Vector4()) },
                    uRadPower: { value: new Array<number>(MAX_TERMS).fill(0) },
                    uRadInvN: { value: new Array<number>(MAX_TERMS).fill(1) },
                    uZ: { value: 1 },
                    uIsoValue: { value: 0.05 },
                    uSliceAxis: { value: 2 },
                    uSlicePosition: { value: 0 },
                    uClipEnabled: { value: 0 },
                    uEnvelopeScale: { value: 2 },
                    uColorPositive: { value: new THREE.Color() },
                    uColorNegative: { value: new THREE.Color() },
                    uBackground: { value: new THREE.Color() },
                    uCameraPos: { value: new THREE.Vector3() },
                    uBoundingRadius: { value: BOUNDING_RADIUS },
                    uNormScale: { value: 1 },
                },
            }),
        [],
    );
    useEffect(() => () => material.dispose(), [material]);

    // Compile off the main thread where the browser supports
    // KHR_parallel_shader_compile; the mesh stays hidden until ready, so the
    // tab never blocks on the first draw.
    const [ready, setReady] = useState(false);
    useEffect(() => {
        let cancelled = false;
        const probe = new THREE.Mesh(new THREE.SphereGeometry(1, 4, 2), material);
        const done = () => {
            probe.geometry.dispose();
            if (cancelled) return;
            setReady(true);
            invalidate();
        };
        const compile = (gl as THREE.WebGLRenderer).compileAsync?.(probe, camera, scene);
        if (compile) compile.then(done, done);
        else done();
        return () => {
            cancelled = true;
        };
    }, [material, gl, camera, scene, invalidate]);

    // Push prop changes into uniforms and request one redraw.
    useEffect(() => {
        const u = material.uniforms;
        u.uRenderMode.value = MODE_INDEX[renderMode];
        u.uUseEnvelope.value = packed.useEnvelope ? 1 : 0;
        u.uNumTerms.value = numTerms;
        u.uStepsIso.value = q.stepsIso;
        u.uStepsDensity.value = q.stepsDensity;
        u.uBisectionIters.value = q.bisectionIters;
        u.uLightingComplex.value = qualityProfile.lightingComplex ? 1 : 0;
        u.uZ.value = Z;
        (u.uDegree.value as number[]).splice(0, MAX_TERMS, ...packed.degree);
        (u.uAng.value as number[]).splice(0, MAX_TERMS * ANG_SLOTS, ...packed.angCoeffs);
        (u.uRadPower.value as number[]).splice(0, MAX_TERMS, ...packed.radPower);
        (u.uRadInvN.value as number[]).splice(0, MAX_TERMS, ...packed.radInvN);
        (u.uRadPoly.value as THREE.Vector4[]).forEach((v, i) => v.fromArray(packed.radPoly, i * 4));
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
        renderMode,
        numTerms,
        q.stepsIso,
        q.stepsDensity,
        q.bisectionIters,
        qualityProfile.lightingComplex,
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
        <mesh ref={meshRef} material={material} visible={ready}>
            <sphereGeometry args={[boundingRadius, 48, 24]} />
        </mesh>
    );
};

export default OrbitalVolume;
