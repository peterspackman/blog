import React, { Suspense, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, useGLTF, Center, Bounds } from '@react-three/drei';
import BrowserOnly from '@docusaurus/BrowserOnly';
import * as THREE from 'three';

interface GLTFModelProps {
  url: string;
  scale?: number;
  rotation?: [number, number, number];
  position?: [number, number, number];
  autoRotate?: boolean;
  autoRotateSpeed?: number;
}

const GLTFModel: React.FC<GLTFModelProps> = ({
  url,
  scale = 1,
  rotation = [0, 0, 0],
  position = [0, 0, 0],
  autoRotate = false,
  autoRotateSpeed = 0.005
}) => {
  const { scene } = useGLTF(url);

  return (
    <Center>
      <group position={position} rotation={rotation} scale={scale}>
        <primitive object={scene.clone()} />
      </group>
    </Center>
  );
};

interface PaperGLTFSceneProps {
  modelUrl: string;
  width?: number | string;
  height?: number | string;
  cameraPosition?: [number, number, number];
  cameraTarget?: [number, number, number];
  modelScale?: number;
  modelRotation?: [number, number, number];
  modelPosition?: [number, number, number];
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  enableZoom?: boolean;
  enablePan?: boolean;
  enableRotate?: boolean;
  background?: string;
  lighting?: 'ambient' | 'studio' | 'city' | 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment' | 'park' | 'lobby';
  fitToView?: boolean;
  className?: string;
}

const LoadingFallback: React.FC = () => (
  <div style={{
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--ifm-color-emphasis-100)',
    borderRadius: '0.5rem',
    color: 'var(--ifm-color-emphasis-600)'
  }}>
    Loading 3D model...
  </div>
);

const ErrorFallback: React.FC<{ error: string }> = ({ error }) => (
  <div style={{
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--ifm-color-emphasis-100)',
    borderRadius: '0.5rem',
    color: 'var(--ifm-color-danger)',
    padding: '1rem',
    textAlign: 'center'
  }}>
    <div style={{ marginBottom: '0.5rem' }}>Failed to load 3D model</div>
    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{error}</div>
  </div>
);

const PaperGLTFScene: React.FC<PaperGLTFSceneProps> = ({
  modelUrl,
  width = '100%',
  height = 400,
  cameraPosition = [0, 0, 5],
  cameraTarget = [0, 0, 0],
  modelScale = 1,
  modelRotation = [0, 0, 0],
  modelPosition = [0, 0, 0],
  autoRotate = false,
  autoRotateSpeed = 0.005,
  enableZoom = true,
  enablePan = true,
  enableRotate = true,
  background,
  lighting = 'studio',
  fitToView = true,
  className = ''
}) => {
  const canvasStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: '0.5rem',
    background: background || 'var(--ifm-color-emphasis-100)'
  };

  const ModelWithBounds: React.FC = () => (
    <>
      {fitToView ? (
        <Bounds fit clip observe margin={1.2} damping={0}>
          <GLTFModel
            url={modelUrl}
            scale={modelScale}
            rotation={modelRotation}
            position={modelPosition}
            autoRotate={autoRotate}
            autoRotateSpeed={autoRotateSpeed}
          />
        </Bounds>
      ) : (
        <GLTFModel
          url={modelUrl}
          scale={modelScale}
          rotation={modelRotation}
          position={modelPosition}
          autoRotate={autoRotate}
          autoRotateSpeed={autoRotateSpeed}
        />
      )}
    </>
  );

  return (
    <div className={className} style={canvasStyle}>
      <BrowserOnly fallback={<LoadingFallback />}>
        {() => (
          <Canvas
            style={{ width: '100%', height: '100%' }}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: 'high-performance'
            }}
            dpr={Math.min(window.devicePixelRatio, 2)}
            scene={{ background: 'var(--ifm-background-color)' }}
          >
            <Suspense fallback={null}>
              <PerspectiveCamera
                makeDefault
                position={fitToView ? undefined : cameraPosition}
                fov={50}
              />

              <OrbitControls
                target={[0, 0, 0]}
                enableZoom={enableZoom}
                enablePan={enablePan}
                enableRotate={enableRotate}
                enableDamping
                dampingFactor={0.05}
                minDistance={0.1}
                maxDistance={100}
                minPolarAngle={Math.PI / 4}
                maxPolarAngle={3 * Math.PI / 4}
                rotateSpeed={0.5}
                autoRotate={autoRotate}
                autoRotateSpeed={autoRotateSpeed * 100}
              />

              <Environment preset={lighting || 'studio'} />

              <ModelWithBounds />
            </Suspense>
          </Canvas>
        )}
      </BrowserOnly>
    </div>
  );
};

export default PaperGLTFScene;