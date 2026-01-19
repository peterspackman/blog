import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { vertexShader, fragmentShader } from './shaders';
import type { QuantumState2D, DisplayMode, ColorMapType } from './physics';
import type { ControlTheme } from '../shared/controls';

export interface Wavefunction2DCanvasProps {
    width: number;
    height: number;
    activeStates: QuantumState2D[];
    tau: number;
    displayMode: DisplayMode;
    colorMapType: ColorMapType;
    showContours: boolean;
    theme: ControlTheme;
}

export const Wavefunction2DCanvas: React.FC<Wavefunction2DCanvasProps> = ({
    width,
    height,
    activeStates,
    tau,
    displayMode,
    colorMapType,
    showContours,
    theme,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const materialRef = useRef<THREE.ShaderMaterial | null>(null);

    // Get device pixel ratio for crisp rendering
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

    // Aspect ratio of the box (width / height)
    const aspectRatio = width / height;

    // Initialize THREE.js
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Create renderer with pixel ratio
        const renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
        });
        renderer.setPixelRatio(dpr);
        renderer.setSize(width, height);
        rendererRef.current = renderer;

        // Create scene
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Create shader material with all uniforms
        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uTime: { value: 0.0 },
                uActiveStatesCount: { value: activeStates.length },
                uActiveStates: { value: new Float32Array(20) },
                uDisplayMode: { value: 0 },
                uColorMapType: { value: 0 },
                uShowContours: { value: false },
                uAspectRatio: { value: 1.0 },
            },
        });
        materialRef.current = material;

        // Create fullscreen quad
        const geometry = new THREE.PlaneGeometry(2, 2);
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        // Initial render
        renderer.render(scene, new THREE.Camera());

        // Cleanup
        return () => {
            scene.remove(mesh);
            geometry.dispose();
            material.dispose();
            renderer.dispose();
        };
    }, []);

    // Update renderer size when dimensions change
    useEffect(() => {
        const renderer = rendererRef.current;
        if (!renderer) return;

        renderer.setPixelRatio(dpr);
        renderer.setSize(width, height);
    }, [width, height, dpr]);

    // Update shader uniforms and render
    useEffect(() => {
        const material = materialRef.current;
        const renderer = rendererRef.current;
        const scene = sceneRef.current;
        if (!material || !renderer || !scene) return;

        // Convert display mode to number
        let displayModeNumber = 0;
        if (displayMode === 'real') displayModeNumber = 1;
        if (displayMode === 'imaginary') displayModeNumber = 2;

        // Convert color map to number
        let colorMapNumber = 0;
        if (colorMapType === 'plasma') colorMapNumber = 1;
        if (colorMapType === 'coolwarm') colorMapNumber = 2;

        // Update active states array
        const activeStatesArray = new Float32Array(20);
        activeStates.forEach((state, i) => {
            if (i < 10) {
                activeStatesArray[i * 2] = state.nx;
                activeStatesArray[i * 2 + 1] = state.ny;
            }
        });

        // Update all uniforms
        material.uniforms.uTime.value = tau;
        material.uniforms.uActiveStatesCount.value = Math.max(1, activeStates.length);
        material.uniforms.uActiveStates.value = activeStatesArray;
        material.uniforms.uDisplayMode.value = displayModeNumber;
        material.uniforms.uColorMapType.value = colorMapNumber;
        material.uniforms.uShowContours.value = showContours;
        material.uniforms.uAspectRatio.value = aspectRatio;

        // Render
        renderer.render(scene, new THREE.Camera());
    }, [activeStates, tau, displayMode, colorMapType, showContours, aspectRatio]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                display: 'block',
                width: width,
                height: height,
                borderRadius: '4px',
                border: `1px solid ${theme.border}`,
            }}
        />
    );
};

export default Wavefunction2DCanvas;
