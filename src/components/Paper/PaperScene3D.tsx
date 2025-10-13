import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, useGLTF } from '@react-three/drei';
import BrowserOnly from '@docusaurus/BrowserOnly';

interface PaperScene3DProps {
  children: React.ReactNode;
  width?: number | string;
  height?: number | string;
  cameraPosition?: [number, number, number];
  cameraTarget?: [number, number, number];
  enableZoom?: boolean;
  enablePan?: boolean;
  enableRotate?: boolean;
  background?: string;
  lighting?: 'ambient' | 'studio' | 'city' | 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment' | 'park' | 'sunset' | 'lobby';
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
    borderRadius: '0.5rem'
  }}>
    <div style={{ color: 'var(--ifm-color-emphasis-600)' }}>
      Loading 3D scene...
    </div>
  </div>
);

const PaperScene3D: React.FC<PaperScene3DProps> = ({
  children,
  width = '100%',
  height = 400,
  cameraPosition = [0, 0, 5],
  cameraTarget = [0, 0, 0],
  enableZoom = true,
  enablePan = true,
  enableRotate = true,
  background,
  lighting = 'studio',
  className = ''
}) => {
  const canvasStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: '0.5rem',
    background: background || 'var(--ifm-color-emphasis-100)'
  };

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
          >
            <Suspense fallback={null}>
              <PerspectiveCamera
                makeDefault
                position={cameraPosition}
                fov={50}
              />

              <OrbitControls
                target={cameraTarget}
                enableZoom={enableZoom}
                enablePan={enablePan}
                enableRotate={enableRotate}
                enableDamping
                dampingFactor={0.05}
                minDistance={1}
                maxDistance={20}
                maxPolarAngle={Math.PI}
              />

              {lighting && (
                <Environment preset={lighting} />
              )}

              {!lighting && (
                <>
                  <ambientLight intensity={0.4} />
                  <directionalLight
                    position={[5, 5, 5]}
                    intensity={0.8}
                    castShadow
                    shadow-mapSize-width={1024}
                    shadow-mapSize-height={1024}
                  />
                  <directionalLight
                    position={[-5, 5, -5]}
                    intensity={0.4}
                  />
                </>
              )}

              {children}
            </Suspense>
          </Canvas>
        )}
      </BrowserOnly>
    </div>
  );
};

export default PaperScene3D;