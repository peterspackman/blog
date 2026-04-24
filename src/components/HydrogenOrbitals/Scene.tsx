import React, { Suspense, useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import OrbitalVolume, { type OrbitalVolumeProps } from './OrbitalVolume';
import { BOUNDING_RADIUS } from './shaders';
import type { QualityProfile } from './quality';

/**
 * When the bounding radius changes by a large factor (e.g. mode switch
 * angular→full, or n jumps from 1 to 4), rescale the camera distance so
 * the user stays at roughly the same framing. Preserves orbit angle.
 */
const CameraManager: React.FC<{ boundingRadius: number }> = ({ boundingRadius }) => {
    const { camera, invalidate } = useThree();
    const prev = useRef(boundingRadius);
    useEffect(() => {
        const ratio = boundingRadius / prev.current;
        if (Math.abs(Math.log(ratio)) > 0.3) {
            camera.position.multiplyScalar(ratio);
            (camera as any).far = Math.max(200, boundingRadius * 20);
            camera.updateProjectionMatrix();
            invalidate();
        }
        prev.current = boundingRadius;
    }, [boundingRadius, camera, invalidate]);
    return null;
};

/**
 * Adaptive pixel ratio: while OrbitControls is being dragged, render at
 * profile.dragDpr (4× fewer fragments when dragDpr=0.5, 6× when 0.4). Restore
 * to profile.restDpr 400ms after drag-end — the user has already released, so
 * the brief low-res tail during damping is imperceptible.
 *
 * Needs the OrbitControls in the scene to use `makeDefault`.
 */
const AdaptiveDpr: React.FC<{ dragDpr: number; restDpr: number }> = ({
    dragDpr,
    restDpr,
}) => {
    const { gl, size, invalidate } = useThree();
    const controls = useThree((s) => s.controls) as any;

    // Apply the at-rest ratio immediately when tier changes (so upgrading to
    // high on a retina display actually sharpens the output).
    useEffect(() => {
        gl.setPixelRatio(restDpr);
        gl.setSize(size.width, size.height, false);
        invalidate();
    }, [gl, size, invalidate, restDpr]);

    useEffect(() => {
        if (!controls) return;
        let restoreTimer: ReturnType<typeof setTimeout> | null = null;
        const apply = (dpr: number) => {
            gl.setPixelRatio(dpr);
            gl.setSize(size.width, size.height, false);
            invalidate();
        };
        const onStart = () => {
            if (restoreTimer) {
                clearTimeout(restoreTimer);
                restoreTimer = null;
            }
            apply(dragDpr);
        };
        const onEnd = () => {
            if (restoreTimer) clearTimeout(restoreTimer);
            restoreTimer = setTimeout(() => apply(restDpr), 400);
        };
        controls.addEventListener('start', onStart);
        controls.addEventListener('end', onEnd);
        return () => {
            controls.removeEventListener('start', onStart);
            controls.removeEventListener('end', onEnd);
            if (restoreTimer) clearTimeout(restoreTimer);
        };
    }, [controls, gl, size, invalidate, dragDpr, restDpr]);
    return null;
};

export interface SceneProps extends OrbitalVolumeProps {
    width: number;
    height: number;
    isDark?: boolean;
    showAxes?: boolean;
    qualityProfile: QualityProfile;
}

const Axes: React.FC<{ length: number; isDark: boolean }> = ({ length, isDark }) => {
    const dim = isDark ? 0.8 : 0.5;
    const make = (dir: [number, number, number], color: string) => {
        const arr = new Float32Array([0, 0, 0, ...dir.map((d) => d * length)]);
        return (
            <line>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        args={[arr, 3]}
                    />
                </bufferGeometry>
                <lineBasicMaterial color={color} transparent opacity={dim} />
            </line>
        );
    };
    return (
        <group>
            {make([1, 0, 0], '#e53935')}
            {make([0, 1, 0], '#43a047')}
            {make([0, 0, 1], '#1e88e5')}
        </group>
    );
};

export const Scene: React.FC<SceneProps> = ({
    width,
    height,
    isDark = false,
    showAxes = false,
    boundingRadius = BOUNDING_RADIUS,
    qualityProfile,
    ...orbitalProps
}) => {
    const bg = isDark ? '#0e0e12' : '#fafbfc';
    const camR = boundingRadius * 1.6;
    const cameraInit: [number, number, number] = [camR, camR * 0.75, camR];
    const cameraFar = boundingRadius * 20;

    return (
        <div
            style={{
                width,
                height,
                borderRadius: 8,
                overflow: 'hidden',
                border: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
                background: bg,
            }}
        >
            <Canvas
                dpr={qualityProfile.restDpr}
                frameloop="demand"
                gl={{ alpha: false, antialias: true, powerPreference: 'high-performance' }}
                camera={{ position: cameraInit, fov: 45, near: 0.1, far: cameraFar }}
            >
                <Suspense fallback={null}>
                    <color attach="background" args={[bg]} />
                    <CameraManager boundingRadius={boundingRadius} />
                    <PerspectiveCamera
                        makeDefault
                        position={cameraInit}
                        fov={45}
                        near={0.1}
                        far={cameraFar}
                    />
                    <OrbitControls
                        makeDefault
                        enableDamping
                        dampingFactor={0.08}
                        minDistance={1}
                        maxDistance={boundingRadius * 8}
                        target={[0, 0, 0]}
                    />
                    <AdaptiveDpr
                        dragDpr={qualityProfile.dragDpr}
                        restDpr={qualityProfile.restDpr}
                    />
                    {showAxes && <Axes length={boundingRadius * 1.1} isDark={isDark} />}
                    <OrbitalVolume
                        {...orbitalProps}
                        boundingRadius={boundingRadius}
                        background={bg}
                        qualityProfile={qualityProfile}
                    />
                </Suspense>
            </Canvas>
        </div>
    );
};

export default Scene;
