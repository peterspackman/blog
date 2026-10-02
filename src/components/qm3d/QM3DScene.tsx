import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
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
    /** Page background (emissive mode sits flush on the page). */
    background: string;
    /** Box edge colour. */
    edgeColor: string;
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
    background,
    edgeColor: themeEdge,
}) => {
    // Absorption darkens a white backdrop (like ink), so it needs white in
    // both themes; emission glows on the page colour.
    const absorption = renderStyle === 'absorption';
    const bgColor = absorption ? '#ffffff' : background;
    const edgeColor = absorption ? '#c4c9d1' : themeEdge;

    return (
        <div
            style={{
                width,
                height,
                overflow: 'hidden',
                borderRadius: absorption ? 'var(--viz-radius)' : undefined,
            }}
        >
            <Canvas
                dpr={[1, 2]}
                gl={{ alpha: false, antialias: true }}
                style={{ background: bgColor }}
            >
                <Suspense fallback={null}>
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
