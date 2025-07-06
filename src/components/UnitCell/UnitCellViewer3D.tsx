import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useUnitCell } from './UnitCellContext';
import { CenteringType } from './types';

interface UnitCellViewer3DProps {
  height?: string;
}

const UnitCellViewer3D: React.FC<UnitCellViewer3DProps> = ({ height = '400px' }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameIdRef = useRef<number>();
  const autoRotateEnabled = useRef<boolean>(false);

  const { state, calculateLatticeVectors } = useUnitCell();

  // Get centering points based on centering type
  const getCenteringPoints = (centeringType: CenteringType): THREE.Vector3[] => {
    const points: THREE.Vector3[] = [];
    
    switch (centeringType) {
      case 'I': // Body-centered
        points.push(new THREE.Vector3(0.5, 0.5, 0.5));
        break;
      case 'F': // Face-centered
        points.push(
          new THREE.Vector3(0.5, 0.5, 0),   // xy face centers
          new THREE.Vector3(0.5, 0.5, 1),
          new THREE.Vector3(0.5, 0, 0.5),   // xz face centers
          new THREE.Vector3(0.5, 1, 0.5),
          new THREE.Vector3(0, 0.5, 0.5),   // yz face centers
          new THREE.Vector3(1, 0.5, 0.5)
        );
        break;
      case 'A': // A-centered (bc faces)
        points.push(
          new THREE.Vector3(0, 0.5, 0.5),
          new THREE.Vector3(1, 0.5, 0.5)
        );
        break;
      case 'B': // B-centered (ac faces)
        points.push(
          new THREE.Vector3(0.5, 0, 0.5),
          new THREE.Vector3(0.5, 1, 0.5)
        );
        break;
      case 'C': // C-centered (ab faces)
        points.push(
          new THREE.Vector3(0.5, 0.5, 0),
          new THREE.Vector3(0.5, 0.5, 1)
        );
        break;
      case 'P': // Primitive
      default:
        // No additional points
        break;
    }
    
    return points;
  };

  // Create grid
  const createGrid = (scene: THREE.Scene) => {
    const gridObjects = scene.children.filter(child => child.userData.grid);
    gridObjects.forEach(obj => scene.remove(obj));

    if (!state.displayOptions.showGrid) return;

    const size = 8;
    const divisions = 32;
    const grid = new THREE.GridHelper(size, divisions, 0x90c695, 0xb8d4bb);
    grid.userData.grid = true;
    grid.position.set(0, -0.01, 0);
    grid.material.transparent = true;
    grid.material.opacity = 0.6;
    scene.add(grid);
  };

  // Create unit cell images (3x3x3 grid)
  const createUnitCellImages = (scene: THREE.Scene, vectors: any) => {
    const imageObjects = scene.children.filter(child => child.userData.unitCellImage);
    imageObjects.forEach(obj => scene.remove(obj));

    if (!state.displayOptions.showImages) return;

    const { vectorA, vectorB, vectorC } = vectors;

    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (let k = -1; k <= 1; k++) {
          if (i === 0 && j === 0 && k === 0) continue;

          const offset = vectorA.clone().multiplyScalar(i)
            .add(vectorB.clone().multiplyScalar(j))
            .add(vectorC.clone().multiplyScalar(k));

          const distance = Math.sqrt(i*i + j*j + k*k);
          const opacity = Math.max(0.1, 0.4 - distance * 0.1);

          const edges = [
            [offset.clone(), offset.clone().add(vectorA)],
            [offset.clone(), offset.clone().add(vectorB)],
            [offset.clone().add(vectorA), offset.clone().add(vectorA).add(vectorB)],
            [offset.clone().add(vectorB), offset.clone().add(vectorA).add(vectorB)],
            [offset.clone().add(vectorC), offset.clone().add(vectorA).add(vectorC)],
            [offset.clone().add(vectorC), offset.clone().add(vectorB).add(vectorC)],
            [offset.clone().add(vectorA).add(vectorC), offset.clone().add(vectorA).add(vectorB).add(vectorC)],
            [offset.clone().add(vectorB).add(vectorC), offset.clone().add(vectorA).add(vectorB).add(vectorC)],
            [offset.clone(), offset.clone().add(vectorC)],
            [offset.clone().add(vectorA), offset.clone().add(vectorA).add(vectorC)],
            [offset.clone().add(vectorB), offset.clone().add(vectorB).add(vectorC)],
            [offset.clone().add(vectorA).add(vectorB), offset.clone().add(vectorA).add(vectorB).add(vectorC)]
          ];

          edges.forEach(([start, end]) => {
            const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
            const material = new THREE.LineBasicMaterial({ 
              color: 0x888888, 
              transparent: true,
              opacity: opacity
            });
            const line = new THREE.Line(geometry, material);
            line.userData.unitCellImage = true;
            scene.add(line);
          });
        }
      }
    }
  };

  // Create lattice points
  const createLatticePoints = (scene: THREE.Scene, vectors: any) => {
    const pointObjects = scene.children.filter(child => child.userData.latticePoint);
    pointObjects.forEach(obj => scene.remove(obj));

    if (!state.displayOptions.showLatticePoints) return;

    const { vectorA, vectorB, vectorC } = vectors;

    // Corner lattice points
    const cornerPoints = [
      new THREE.Vector3(0, 0, 0),
      vectorA.clone(),
      vectorB.clone(),
      vectorC.clone(),
      vectorA.clone().add(vectorB),
      vectorA.clone().add(vectorC),
      vectorB.clone().add(vectorC),
      vectorA.clone().add(vectorB).add(vectorC)
    ];

    cornerPoints.forEach((point, index) => {
      const sphereGeometry = new THREE.SphereGeometry(0.06, 16, 16);
      const sphereMaterial = new THREE.MeshBasicMaterial({ 
        color: index === 0 ? 0xff4444 : 0x4466ff,
        transparent: true,
        opacity: 0.8
      });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.position.copy(point);
      sphere.userData.latticePoint = true;
      scene.add(sphere);
    });

    // Add centering points
    const centeringPoints = getCenteringPoints(state.centeringType);
    centeringPoints.forEach(fractionalPos => {
      const cartesianPos = vectorA.clone().multiplyScalar(fractionalPos.x)
        .add(vectorB.clone().multiplyScalar(fractionalPos.y))
        .add(vectorC.clone().multiplyScalar(fractionalPos.z));

      const sphereGeometry = new THREE.SphereGeometry(0.06, 16, 16);
      const sphereMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x44ff44, // Green for centering points
        transparent: true,
        opacity: 0.8
      });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.position.copy(cartesianPos);
      sphere.userData.latticePoint = true;
      scene.add(sphere);
    });
  };

  // Create unit cell edges
  const createUnitCell = (scene: THREE.Scene, vectors: any) => {
    const objectsToRemove = scene.children.filter(child => child.userData.unitCell);
    objectsToRemove.forEach(obj => scene.remove(obj));

    createGrid(scene);
    createUnitCellImages(scene, vectors);
    createLatticePoints(scene, vectors);

    const { vectorA, vectorB, vectorC } = vectors;

    const edges = [
      [new THREE.Vector3(0, 0, 0), vectorA],
      [new THREE.Vector3(0, 0, 0), vectorB],
      [vectorA, vectorA.clone().add(vectorB)],
      [vectorB, vectorA.clone().add(vectorB)],
      [vectorC, vectorA.clone().add(vectorC)],
      [vectorC, vectorB.clone().add(vectorC)],
      [vectorA.clone().add(vectorC), vectorA.clone().add(vectorB).add(vectorC)],
      [vectorB.clone().add(vectorC), vectorA.clone().add(vectorB).add(vectorC)],
      [new THREE.Vector3(0, 0, 0), vectorC],
      [vectorA, vectorA.clone().add(vectorC)],
      [vectorB, vectorB.clone().add(vectorC)],
      [vectorA.clone().add(vectorB), vectorA.clone().add(vectorB).add(vectorC)]
    ];

    // Create thick edges using cylindrical geometry
    edges.forEach(([start, end]) => {
      const radius = 0.008;
      const length = start.distanceTo(end);
      const tubeGeometry = new THREE.CylinderGeometry(radius, radius, length, 8);
      const material = new THREE.MeshBasicMaterial({ color: 0x333333 });
      const tube = new THREE.Mesh(tubeGeometry, material);
      
      const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      tube.position.copy(midpoint);
      tube.lookAt(end);
      tube.rotateX(Math.PI / 2);
      
      tube.userData.unitCell = true;
      scene.add(tube);
    });

    // Create colored axis vectors
    const axisColors = [0xe74c3c, 0x2980b9, 0xf39c12];
    const axes = [vectorA, vectorB, vectorC];

    axes.forEach((axis, index) => {
      const axisRadius = 0.012;
      const axisLength = axis.length();
      const axisTubeGeometry = new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8);
      const axisMaterial = new THREE.MeshBasicMaterial({ color: axisColors[index] });
      const axisTube = new THREE.Mesh(axisTubeGeometry, axisMaterial);
      
      const axisMidpoint = axis.clone().multiplyScalar(0.5);
      axisTube.position.copy(axisMidpoint);
      axisTube.lookAt(axis);
      axisTube.rotateX(Math.PI / 2);
      
      axisTube.userData.unitCell = true;
      scene.add(axisTube);

      // Axis endpoint spheres
      const sphereGeometry = new THREE.SphereGeometry(0.04, 16, 16);
      const sphereMaterial = new THREE.MeshBasicMaterial({ color: axisColors[index] });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.position.copy(axis);
      sphere.userData.unitCell = true;
      scene.add(sphere);
    });
  };

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    const aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
    const frustumSize = 3; // Reduced from 6 to zoom in more
    const camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );
    camera.position.set(2, 2, 2);
    camera.lookAt(0.5, 0.5, 0.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 10;
    controls.target.set(0.5, 0.5, 0.5);
    controlsRef.current = controls;

    const animate = (time: number = 0) => {
      frameIdRef.current = requestAnimationFrame(animate);
      
      // Auto-rotate using OrbitControls built-in autoRotate
      if (autoRotateEnabled.current !== controls.autoRotate) {
        controls.autoRotate = autoRotateEnabled.current;
        controls.autoRotateSpeed = 2.0; // degrees per second
      }
      
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !camera || !renderer) return;
      const aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      const frustumSize = 3; // Keep consistent with initial setup
      (camera as THREE.OrthographicCamera).left = (frustumSize * aspect) / -2;
      (camera as THREE.OrthographicCamera).right = (frustumSize * aspect) / 2;
      (camera as THREE.OrthographicCamera).top = frustumSize / 2;
      (camera as THREE.OrthographicCamera).bottom = frustumSize / -2;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update auto-rotate ref when option changes
  useEffect(() => {
    autoRotateEnabled.current = state.displayOptions.autoRotate;
  }, [state.displayOptions.autoRotate]);

  // Update unit cell when parameters change (throttled)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (sceneRef.current) {
        const vectors = calculateLatticeVectors();
        createUnitCell(sceneRef.current, vectors);
      }
    }, 16); // ~60fps throttling

    return () => clearTimeout(timeoutId);
  }, [state.params, state.centeringType, state.displayOptions.showGrid, state.displayOptions.showImages, state.displayOptions.showLatticePoints, calculateLatticeVectors]);

  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height: height,
        border: '1px solid #ddd',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#f8f9fa'
      }}
    />
  );
};

export default UnitCellViewer3D;