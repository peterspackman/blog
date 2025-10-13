import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Line } from '@react-three/drei';
import * as THREE from 'three';

interface Atom {
  position: [number, number, number];
  element: string;
  color: string;
  radius: number;
}

interface Bond {
  from: number;
  to: number;
}

interface MolecularVisualizationProps {
  atoms: Atom[];
  bonds?: Bond[];
  rotate?: boolean;
  scale?: number;
}

const MolecularVisualization: React.FC<MolecularVisualizationProps> = ({
  atoms,
  bonds = [],
  rotate = true,
  scale = 1
}) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (rotate && groupRef.current) {
      groupRef.current.rotation.y += 0.005;
    }
  });

  return (
    <group ref={groupRef} scale={scale}>
      {/* Render atoms */}
      {atoms.map((atom, index) => (
        <Sphere
          key={index}
          position={atom.position}
          args={[atom.radius, 32, 32]}
        >
          <meshStandardMaterial color={atom.color} />
        </Sphere>
      ))}

      {/* Render bonds */}
      {bonds.map((bond, index) => {
        const fromAtom = atoms[bond.from];
        const toAtom = atoms[bond.to];
        if (!fromAtom || !toAtom) return null;

        const points = [
          new THREE.Vector3(...fromAtom.position),
          new THREE.Vector3(...toAtom.position)
        ];

        return (
          <Line
            key={index}
            points={points}
            color="#666666"
            lineWidth={3}
          />
        );
      })}
    </group>
  );
};

// Example molecules
export const WaterMolecule: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
  const atoms: Atom[] = [
    { position: [0, 0, 0], element: 'O', color: '#ff0000', radius: 0.66 },
    { position: [0.76, 0.59, 0], element: 'H', color: '#ffffff', radius: 0.31 },
    { position: [-0.76, 0.59, 0], element: 'H', color: '#ffffff', radius: 0.31 }
  ];

  const bonds: Bond[] = [
    { from: 0, to: 1 },
    { from: 0, to: 2 }
  ];

  return <MolecularVisualization atoms={atoms} bonds={bonds} scale={scale} />;
};

export const MethaneMolecule: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
  const atoms: Atom[] = [
    { position: [0, 0, 0], element: 'C', color: '#404040', radius: 0.70 },
    { position: [1.09, 0, 0], element: 'H', color: '#ffffff', radius: 0.31 },
    { position: [-0.36, 1.03, 0], element: 'H', color: '#ffffff', radius: 0.31 },
    { position: [-0.36, -0.51, 0.89], element: 'H', color: '#ffffff', radius: 0.31 },
    { position: [-0.36, -0.51, -0.89], element: 'H', color: '#ffffff', radius: 0.31 }
  ];

  const bonds: Bond[] = [
    { from: 0, to: 1 },
    { from: 0, to: 2 },
    { from: 0, to: 3 },
    { from: 0, to: 4 }
  ];

  return <MolecularVisualization atoms={atoms} bonds={bonds} scale={scale} />;
};

export default MolecularVisualization;