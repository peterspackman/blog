import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { VolumeBox, BoxEdges, AxisLabels } from './VolumeBox';
import type { QuantumState3D, ColorMapType, RenderStyle } from './physics';

export interface QM3DSceneProps {
    activeStates: QuantumState3D[];
    tau: number;
    densityScale: number;
    opacityPower: number;
    threshold: number;
    colorMapType: ColorMapType;
    renderStyle: RenderStyle;
    width: number;
    height: number;
    isDark?: boolean;
}

export const QM3DScene: React.FC<QM3DSceneProps> = ({
    activeStates,
    tau,
    densityScale,
    opacityPower,
    threshold,
    colorMapType,
    renderStyle,
    width,
    height,
    isDark = false,
}) => {
    // Background color depends on render style
    const bgColor = renderStyle === 'absorption'
        ? '#ffffff'  // White for absorption mode
        : (isDark ? '#1a1a1a' : '#f8f9fa');
    const edgeColor = renderStyle === 'absorption'
        ? '#cccccc'  // Light gray edges on white
        : (isDark ? '#555555' : '#999999');

    return (
        <div
            style={{
                width,
                height,
                borderRadius: '8px',
                overflow: 'hidden',
                border: `1px solid ${isDark ? '#444' : '#e0e0e0'}`,
            }}
        >
            <Canvas
                dpr={[1, 2]}
                gl={{ alpha: false, antialias: true }}
                onCreated={({ scene }) => {
                    scene.background = new THREE.Color(bgColor);
                }}
                style={{ background: bgColor }}
            >
                <Suspense fallback={null}>
                    {/* Set scene background color dynamically */}
                    <color attach="background" args={[bgColor]} />
                    <PerspectiveCamera
                        makeDefault
                        position={[1.8, 1.5, 1.8]}
                        fov={50}
                        near={0.1}
                        far={100}
                    />
                    <OrbitControls
                        enableDamping
                        dampingFactor={0.05}
                        minDistance={1}
                        maxDistance={5}
                    />

                    {/* Ambient light for general illumination */}
                    <ambientLight intensity={0.5} />

                    {/* Box wireframe outline */}
                    <BoxEdges color={edgeColor} />

                    {/* Axis indicators */}
                    <AxisLabels />

                    {/* Ray-marched volume */}
                    <VolumeBox
                        activeStates={activeStates}
                        tau={tau}
                        densityScale={densityScale}
                        opacityPower={opacityPower}
                        threshold={threshold}
                        colorMapType={colorMapType}
                        renderStyle={renderStyle}
                    />
                </Suspense>
            </Canvas>
        </div>
    );
};

export default QM3DScene;
