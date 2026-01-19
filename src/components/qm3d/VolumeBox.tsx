import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { vertexShader, fragmentShader } from './shaders';
import type { QuantumState3D, ColorMapType, RenderStyle } from './physics';

export interface VolumeBoxProps {
    activeStates: QuantumState3D[];
    tau: number;
    densityScale: number;
    opacityPower: number;
    threshold: number;
    colorMapType: ColorMapType;
    renderStyle: RenderStyle;
}

export const VolumeBox: React.FC<VolumeBoxProps> = ({
    activeStates,
    tau,
    densityScale,
    opacityPower,
    threshold,
    colorMapType,
    renderStyle,
}) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const { camera } = useThree();

    // Create shader material with uniforms
    const material = useMemo(() => {
        // Convert color map to number
        let colorMapNumber = 0;
        if (colorMapType === 'plasma') colorMapNumber = 1;
        if (colorMapType === 'coolwarm') colorMapNumber = 2;

        // Create states array (vec3 for each state)
        const statesArray: THREE.Vector3[] = [];
        for (let i = 0; i < 10; i++) {
            if (i < activeStates.length) {
                statesArray.push(
                    new THREE.Vector3(
                        activeStates[i].nx,
                        activeStates[i].ny,
                        activeStates[i].nz
                    )
                );
            } else {
                statesArray.push(new THREE.Vector3(1, 1, 1));
            }
        }

        const renderStyleNumber = renderStyle === 'absorption' ? 1 : 0;

        return new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uTau: { value: tau },
                uNumStates: { value: Math.max(1, activeStates.length) },
                uStates: { value: statesArray },
                uDensityScale: { value: densityScale },
                uOpacityPower: { value: opacityPower },
                uThreshold: { value: threshold },
                uColorMap: { value: colorMapNumber },
                uRenderStyle: { value: renderStyleNumber },
                uCameraPosition: { value: camera.position.clone() },
            },
            transparent: true,
            side: THREE.BackSide,
            depthWrite: false,
        });
    }, []);

    // Update uniforms every frame
    useFrame(() => {
        if (!meshRef.current) return;
        const mat = meshRef.current.material as THREE.ShaderMaterial;

        // Update time
        mat.uniforms.uTau.value = tau;

        // Update states
        const numStates = Math.max(1, activeStates.length);
        mat.uniforms.uNumStates.value = numStates;

        for (let i = 0; i < activeStates.length && i < 10; i++) {
            mat.uniforms.uStates.value[i].set(
                activeStates[i].nx,
                activeStates[i].ny,
                activeStates[i].nz
            );
        }

        // Update density scale and transfer function
        mat.uniforms.uDensityScale.value = densityScale;
        mat.uniforms.uOpacityPower.value = opacityPower;
        mat.uniforms.uThreshold.value = threshold;

        // Update color map
        let colorMapNumber = 0;
        if (colorMapType === 'plasma') colorMapNumber = 1;
        if (colorMapType === 'coolwarm') colorMapNumber = 2;
        mat.uniforms.uColorMap.value = colorMapNumber;

        // Update render style
        mat.uniforms.uRenderStyle.value = renderStyle === 'absorption' ? 1 : 0;

        // Update camera position
        mat.uniforms.uCameraPosition.value.copy(camera.position);
    });

    return (
        <mesh ref={meshRef} material={material}>
            <boxGeometry args={[1, 1, 1]} />
        </mesh>
    );
};

/**
 * Box edges wireframe for visual reference
 */
export const BoxEdges: React.FC<{ color?: string }> = ({ color = '#666666' }) => {
    return (
        <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(1, 1, 1)]} />
            <lineBasicMaterial color={color} />
        </lineSegments>
    );
};

/**
 * Axis labels using HTML overlay (requires drei's Html component)
 */
export const AxisLabels: React.FC<{ color?: string }> = ({ color = '#666666' }) => {
    // Simple axis lines
    const axisLength = 0.7;

    return (
        <group>
            {/* X axis */}
            <line>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        count={2}
                        array={new Float32Array([0.5, -0.5, -0.5, 0.5 + axisLength, -0.5, -0.5])}
                        itemSize={3}
                    />
                </bufferGeometry>
                <lineBasicMaterial color="#e53935" />
            </line>

            {/* Y axis */}
            <line>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        count={2}
                        array={new Float32Array([-0.5, 0.5, -0.5, -0.5, 0.5 + axisLength, -0.5])}
                        itemSize={3}
                    />
                </bufferGeometry>
                <lineBasicMaterial color="#43a047" />
            </line>

            {/* Z axis */}
            <line>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        count={2}
                        array={new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5 + axisLength])}
                        itemSize={3}
                    />
                </bufferGeometry>
                <lineBasicMaterial color="#1e88e5" />
            </line>
        </group>
    );
};

export default VolumeBox;
