import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Bounds, Gltf, Environment } from '@react-three/drei';
import BrowserOnly from '@docusaurus/BrowserOnly';

interface PaperGLTFSceneSimpleProps {
  modelUrl: string;
  width?: number | string;
  height?: number | string;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  enableZoom?: boolean;
  enablePan?: boolean;
  enableRotate?: boolean;
  lighting?: string;
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

const PaperGLTFSceneSimple: React.FC<PaperGLTFSceneSimpleProps> = ({
  modelUrl,
  width = '100%',
  height = 400,
  autoRotate = true,
  autoRotateSpeed = 1,
  enableZoom = true,
  enablePan = true,
  enableRotate = true,
  lighting = 'studio',
  className = ''
}) => {
  const canvasStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: '0.5rem'
  };

  return (
    <div className={className} style={canvasStyle}>
      <BrowserOnly fallback={<LoadingFallback />}>
        {() => (
          <Canvas
            orthographic
            camera={{ zoom: 100 }}
            scene={{ background: 'var(--ifm-background-color)' }}
          >
            <OrbitControls
              autoRotate={autoRotate}
              autoRotateSpeed={autoRotateSpeed}
              enableZoom={enableZoom}
              enablePan={enablePan}
              enableRotate={enableRotate}
              enableDamping
              dampingFactor={0.05}
            />

            <Environment preset={lighting} />

            <Bounds fit margin={0.8} maxDuration={0}>
              <Gltf src={modelUrl} />
            </Bounds>
          </Canvas>
        )}
      </BrowserOnly>
    </div>
  );
};

export default PaperGLTFSceneSimple;
