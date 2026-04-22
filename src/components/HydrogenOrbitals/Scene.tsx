import React, { Suspense, useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import OrbitalVolume, { type OrbitalVolumeProps } from './OrbitalVolume';
import { BOUNDING_RADIUS } from './shaders';

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

export interface SceneProps extends OrbitalVolumeProps {
    width: number;
    height: number;
    isDark?: boolean;
    showAxes?: boolean;
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
                dpr={1}
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
                        enableDamping
                        dampingFactor={0.08}
                        minDistance={1}
                        maxDistance={boundingRadius * 8}
                        target={[0, 0, 0]}
                    />
                    {showAxes && <Axes length={boundingRadius * 1.1} isDark={isDark} />}
                    <OrbitalVolume
                        {...orbitalProps}
                        boundingRadius={boundingRadius}
                        background={bg}
                    />
                </Suspense>
            </Canvas>
        </div>
    );
};

export default Scene;
