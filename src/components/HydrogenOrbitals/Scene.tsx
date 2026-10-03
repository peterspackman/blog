import React, { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
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
 * profile.dragDpr (4x fewer fragments when dragDpr=0.5). Restore to
 * profile.restDpr 400ms after drag-end — the brief low-res tail during
 * damping is imperceptible. Uses R3F's setDpr (not gl.setPixelRatio) so the
 * store's viewport stays consistent across resizes.
 *
 * Needs the OrbitControls in the scene to use `makeDefault`.
 */
const AdaptiveDpr: React.FC<{ dragDpr: number; restDpr: number }> = ({
    dragDpr,
    restDpr,
}) => {
    const setDpr = useThree((s) => s.setDpr);
    const invalidate = useThree((s) => s.invalidate);
    const controls = useThree((s) => s.controls) as any;

    useEffect(() => {
        if (!controls) return;
        let restoreTimer: ReturnType<typeof setTimeout> | null = null;
        const apply = (dpr: number) => {
            setDpr(dpr);
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
    }, [controls, setDpr, invalidate, dragDpr, restDpr]);
    return null;
};

/**
 * Frame-time watchdog. With frameloop="demand", frames only run back to back
 * while the user is rotating (plus the damping tail), so frame intervals are
 * measured only then. If the median of a window is over budget the GPU can't
 * keep up at this tier and onSlow fires (at most once per tier).
 */
const FrameBudget: React.FC<{ onSlow?: () => void; budgetMs?: number }> = ({ onSlow, budgetMs = 50 }) => {
    const controls = useThree((s) => s.controls) as any;
    const active = useRef(false);
    const last = useRef(0);
    const samples = useRef<number[]>([]);
    const fired = useRef(false);

    useEffect(() => {
        if (!controls) return;
        const start = () => {
            active.current = true;
            last.current = 0;
        };
        const end = () => {
            active.current = false;
        };
        controls.addEventListener('start', start);
        controls.addEventListener('end', end);
        return () => {
            controls.removeEventListener('start', start);
            controls.removeEventListener('end', end);
        };
    }, [controls]);

    useFrame(() => {
        if (!active.current || fired.current || !onSlow) return;
        const now = performance.now();
        if (last.current) samples.current.push(now - last.current);
        last.current = now;
        if (samples.current.length >= 12) {
            const sorted = [...samples.current].sort((a, b) => a - b);
            samples.current = [];
            if (sorted[sorted.length >> 1] > budgetMs) {
                fired.current = true;
                onSlow();
            }
        }
    });
    return null;
};

export interface SceneProps extends OrbitalVolumeProps {
    width: number;
    height: number;
    isDark?: boolean;
    showAxes?: boolean;
    qualityProfile: QualityProfile;
    /** Called when rotation runs below ~20 fps at the current tier. */
    onSlow?: () => void;
    /** Called if the browser drops the WebGL context (GPU reset). */
    onContextLost?: () => void;
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
    onSlow,
    onContextLost,
    ...orbitalProps
}) => {
    const bg = orbitalProps.background;
    // react-three-fiber forces a context loss on the old canvas when it
    // unmounts; ignore that, or each remount would trigger another one.
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    const camR = boundingRadius * 1.6;
    const cameraInit: [number, number, number] = [camR, camR * 0.75, camR];
    const cameraFar = boundingRadius * 20;

    return (
        <div
            style={{
                width,
                height,
                // Same colour as the page, so no frame: the orbital floats on it.
                overflow: 'hidden',
                background: bg,
            }}
        >
            <Canvas
                dpr={qualityProfile.restDpr}
                frameloop="demand"
                gl={{ alpha: false, antialias: true, powerPreference: 'high-performance' }}
                onCreated={({ gl }) => {
                    gl.domElement.addEventListener('webglcontextlost', (e) => {
                        // Allow restoration instead of a permanently dead canvas.
                        e.preventDefault();
                        if (mounted.current) onContextLost?.();
                    });
                }}
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
                    <FrameBudget key={qualityProfile.tier} onSlow={onSlow} />
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
