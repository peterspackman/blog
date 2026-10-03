import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { WulffShape3D } from './geometry';

export interface Wulff3DProps {
    shape: WulffShape3D;
    /** Colour per facet family. */
    colors: string[];
    edgeColor: string;
    background: string;
    showEdges: boolean;
    /** Families drawn with smooth (radial) normals, e.g. the curved part of a rounded crystal. */
    curvedFamilies?: number[];
    width: number;
    height: number;
}

function Polyhedron({ shape, colors, edgeColor, showEdges, curvedFamilies = [] }: Omit<Wulff3DProps, 'width' | 'height' | 'background'>) {
    const invalidate = useThree((s) => s.invalidate);

    const { mesh, edges } = useMemo(() => {
        const pos: number[] = [];
        const col: number[] = [];
        const nrm: number[] = [];
        const edge: number[] = [];
        const c = new THREE.Color();
        // Normalise size so changing γ changes the shape, not the zoom.
        let rMax = 1e-6;
        for (const f of shape.faces) for (const p of f.vertices) rMax = Math.max(rMax, Math.hypot(p[0], p[1], p[2]));
        const k = 1.3 / rMax;
        const sc = (p: number[]) => [p[0] * k, p[1] * k, p[2] * k];
        for (const f of shape.faces) {
            c.set(f.family >= 0 ? colors[f.family] : '#888888');
            const v = f.vertices;
            for (let i = 1; i < v.length - 1; i++) {
                const curved = curvedFamilies.includes(f.family);
                for (const p of [v[0], v[i], v[i + 1]]) {
                    pos.push(...sc(p));
                    col.push(c.r, c.g, c.b);
                    if (curved) {
                        // Radial normal: a near-sphere shades smoothly instead of showing its sample planes.
                        const r = Math.hypot(p[0], p[1], p[2]) || 1;
                        nrm.push(p[0] / r, p[1] / r, p[2] / r);
                    } else nrm.push(...f.normal);
                }
            }
            for (let i = 0; i < v.length; i++) edge.push(...sc(v[i]), ...sc(v[(i + 1) % v.length]));
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
        const e = new THREE.BufferGeometry();
        e.setAttribute('position', new THREE.Float32BufferAttribute(edge, 3));
        return { mesh: g, edges: e };
    }, [shape, colors, curvedFamilies]);

    useEffect(() => {
        invalidate();
        return () => {
            mesh.dispose();
            edges.dispose();
        };
    }, [mesh, edges, invalidate]);

    // Crystallographic z (c axis) points up the screen.
    return (
        <group rotation={[-Math.PI / 2, 0, 0]}>
            <mesh geometry={mesh}>
                <meshStandardMaterial vertexColors roughness={0.55} metalness={0.05} polygonOffset polygonOffsetFactor={1} />
            </mesh>
            {showEdges && (
                <lineSegments geometry={edges}>
                    <lineBasicMaterial color={edgeColor} transparent opacity={0.6} />
                </lineSegments>
            )}
        </group>
    );
}

/** The 3D equilibrium shape, coloured by facet family. Renders on demand. */
export default function Wulff3D({ width, height, background, ...rest }: Wulff3DProps) {
    return (
        <div style={{ width, height, borderRadius: 'var(--viz-radius)', overflow: 'hidden' }}>
            <Canvas
                frameloop="demand"
                dpr={[1, 2]}
                camera={{ position: [3.2, 2.4, 4.2], fov: 35 }}
                gl={{ antialias: true }}
            >
                <color attach="background" args={[background]} />
                <hemisphereLight args={["#ffffff", "#8a8f99", 0.9]} />
                <directionalLight position={[4, 6, 5]} intensity={1.6} />
                <directionalLight position={[-5, -2, -3]} intensity={0.45} />
                <Polyhedron {...rest} />
                <OrbitControls makeDefault enablePan={false} minDistance={2.5} maxDistance={12} />
            </Canvas>
        </div>
    );
}
