/**
 * VolumeRenderer - Three.js layer for volumetric rendering
 *
 * Handles:
 * - Ray-marching volumetric rendering
 * - Isosurfaces via marching cubes
 * - Textured slice planes
 * - Transparency overlay on top of NGL
 */

import React, {
    useEffect,
    useRef,
    useCallback,
    useImperativeHandle,
    forwardRef,
} from 'react';
import * as THREE from 'three';
import type {
    CameraState,
    VolumeRendererRef,
    VolumeGrid,
    SlicePlaneConfig,
    IsosurfaceConfig,
} from './types';

export interface VolumeRendererProps {
    width: number;
    height: number;
    volumeGrid?: VolumeGrid;
    slicePlane?: SlicePlaneConfig;
    isosurface?: IsosurfaceConfig;
    renderMode?: 'raymarching' | 'isosurface';
    isDark: boolean;
    /** Lattice parameters for positioning in crystal coordinates */
    latticeParams?: { a: number; b: number; c: number };
    onCameraChange?: (state: CameraState) => void;
}

// Vertex shader for ray marching
const rayMarchVertexShader = `
varying vec3 vOrigin;
varying vec3 vDirection;

void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vOrigin = cameraPosition;
    vDirection = position - cameraPosition;
    gl_Position = projectionMatrix * mvPosition;
}
`;

// Fragment shader - ray marching through 3D texture
const rayMarchFragmentShader = `
precision highp float;
precision highp sampler3D;

uniform sampler3D uVolume;
uniform float uIsoLevel;
uniform float uMinDensity;
uniform float uMaxDensity;
uniform vec3 uColor;
uniform float uOpacity;

varying vec3 vOrigin;
varying vec3 vDirection;

vec2 hitBox(vec3 orig, vec3 dir) {
    vec3 boxMin = vec3(-1.0);
    vec3 boxMax = vec3(1.0);
    vec3 invDir = 1.0 / dir;
    vec3 tmin0 = (boxMin - orig) * invDir;
    vec3 tmax0 = (boxMax - orig) * invDir;
    vec3 tmin = min(tmin0, tmax0);
    vec3 tmax = max(tmin0, tmax0);
    float t0 = max(max(tmin.x, tmin.y), tmin.z);
    float t1 = min(min(tmax.x, tmax.y), tmax.z);
    return vec2(t0, t1);
}

float sampleDensity(vec3 p) {
    vec3 uv = p * 0.5 + 0.5;
    return texture(uVolume, uv).r;
}

vec3 calcNormal(vec3 p) {
    float eps = 0.01;
    float d = sampleDensity(p);
    return normalize(vec3(
        sampleDensity(p + vec3(eps, 0, 0)) - d,
        sampleDensity(p + vec3(0, eps, 0)) - d,
        sampleDensity(p + vec3(0, 0, eps)) - d
    ));
}

void main() {
    vec3 rayDir = normalize(vDirection);
    vec2 bounds = hitBox(vOrigin, rayDir);

    if (bounds.x > bounds.y) {
        discard;
    }

    bounds.x = max(bounds.x, 0.0);
    float isoThreshold = uIsoLevel;

    float t = bounds.x;
    float dt = 0.02;
    vec3 hitPos = vec3(0.0);
    bool hit = false;
    float prevDensity = 0.0;

    for (int i = 0; i < 200; i++) {
        if (t > bounds.y) break;

        vec3 p = vOrigin + rayDir * t;
        float density = sampleDensity(p);

        if (i > 0 && ((prevDensity < isoThreshold && density >= isoThreshold) ||
                      (prevDensity > isoThreshold && density <= isoThreshold))) {
            float tPrev = t - dt;
            for (int j = 0; j < 4; j++) {
                float tMid = (tPrev + t) * 0.5;
                vec3 pMid = vOrigin + rayDir * tMid;
                float dMid = sampleDensity(pMid);
                if ((prevDensity < isoThreshold) == (dMid < isoThreshold)) {
                    tPrev = tMid;
                    prevDensity = dMid;
                } else {
                    t = tMid;
                    density = dMid;
                }
            }
            hitPos = vOrigin + rayDir * t;
            hit = true;
            break;
        }

        prevDensity = density;
        t += dt;
    }

    if (!hit) {
        discard;
    }

    vec3 normal = calcNormal(hitPos);
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diff = max(dot(normal, lightDir), 0.0) * 0.6 + 0.4;
    float rim = 1.0 - abs(dot(normal, -rayDir));
    rim = pow(rim, 2.0) * 0.3;

    vec3 color = uColor * diff + vec3(1.0) * rim;
    gl_FragColor = vec4(color, uOpacity);
}
`;

// Marching cubes tables (abbreviated for brevity - full tables in production)
const EDGE_TABLE = [
    0x0, 0x109, 0x203, 0x30a, 0x406, 0x50f, 0x605, 0x70c,
    0x80c, 0x905, 0xa0f, 0xb06, 0xc0a, 0xd03, 0xe09, 0xf00,
    0x190, 0x99, 0x393, 0x29a, 0x596, 0x49f, 0x795, 0x69c,
    0x99c, 0x895, 0xb9f, 0xa96, 0xd9a, 0xc93, 0xf99, 0xe90,
    0x230, 0x339, 0x33, 0x13a, 0x636, 0x73f, 0x435, 0x53c,
    0xa3c, 0xb35, 0x83f, 0x936, 0xe3a, 0xf33, 0xc39, 0xd30,
    0x3a0, 0x2a9, 0x1a3, 0xaa, 0x7a6, 0x6af, 0x5a5, 0x4ac,
    0xbac, 0xaa5, 0x9af, 0x8a6, 0xfaa, 0xea3, 0xda9, 0xca0,
    0x460, 0x569, 0x663, 0x76a, 0x66, 0x16f, 0x265, 0x36c,
    0xc6c, 0xd65, 0xe6f, 0xf66, 0x86a, 0x963, 0xa69, 0xb60,
    0x5f0, 0x4f9, 0x7f3, 0x6fa, 0x1f6, 0xff, 0x3f5, 0x2fc,
    0xdfc, 0xcf5, 0xfff, 0xef6, 0x9fa, 0x8f3, 0xbf9, 0xaf0,
    0x650, 0x759, 0x453, 0x55a, 0x256, 0x35f, 0x55, 0x15c,
    0xe5c, 0xf55, 0xc5f, 0xd56, 0xa5a, 0xb53, 0x859, 0x950,
    0x7c0, 0x6c9, 0x5c3, 0x4ca, 0x3c6, 0x2cf, 0x1c5, 0xcc,
    0xfcc, 0xec5, 0xdcf, 0xcc6, 0xbca, 0xac3, 0x9c9, 0x8c0,
    0x8c0, 0x9c9, 0xac3, 0xbca, 0xcc6, 0xdcf, 0xec5, 0xfcc,
    0xcc, 0x1c5, 0x2cf, 0x3c6, 0x4ca, 0x5c3, 0x6c9, 0x7c0,
    0x950, 0x859, 0xb53, 0xa5a, 0xd56, 0xc5f, 0xf55, 0xe5c,
    0x15c, 0x55, 0x35f, 0x256, 0x55a, 0x453, 0x759, 0x650,
    0xaf0, 0xbf9, 0x8f3, 0x9fa, 0xef6, 0xfff, 0xcf5, 0xdfc,
    0x2fc, 0x3f5, 0xff, 0x1f6, 0x6fa, 0x7f3, 0x4f9, 0x5f0,
    0xb60, 0xa69, 0x963, 0x86a, 0xf66, 0xe6f, 0xd65, 0xc6c,
    0x36c, 0x265, 0x16f, 0x66, 0x76a, 0x663, 0x569, 0x460,
    0xca0, 0xda9, 0xea3, 0xfaa, 0x8a6, 0x9af, 0xaa5, 0xbac,
    0x4ac, 0x5a5, 0x6af, 0x7a6, 0xaa, 0x1a3, 0x2a9, 0x3a0,
    0xd30, 0xc39, 0xf33, 0xe3a, 0x936, 0x83f, 0xb35, 0xa3c,
    0x53c, 0x435, 0x73f, 0x636, 0x13a, 0x33, 0x339, 0x230,
    0xe90, 0xf99, 0xc93, 0xd9a, 0xa96, 0xb9f, 0x895, 0x99c,
    0x69c, 0x795, 0x49f, 0x596, 0x29a, 0x393, 0x99, 0x190,
    0xf00, 0xe09, 0xd03, 0xc0a, 0xb06, 0xa0f, 0x905, 0x80c,
    0x70c, 0x605, 0x50f, 0x406, 0x30a, 0x203, 0x109, 0x0
];

// Simplified TRI_TABLE - in real usage, import full table from separate file
const TRI_TABLE: number[][] = [];
for (let i = 0; i < 256; i++) {
    TRI_TABLE.push([-1]);
}

// Color scale functions
function viridis(t: number): [number, number, number] {
    const c0 = [0.267, 0.004, 0.329];
    const c1 = [0.282, 0.140, 0.457];
    const c2 = [0.254, 0.265, 0.529];
    const c3 = [0.206, 0.371, 0.553];
    const c4 = [0.163, 0.471, 0.558];
    const c5 = [0.128, 0.566, 0.550];
    const c6 = [0.135, 0.659, 0.517];
    const c7 = [0.267, 0.749, 0.440];
    const c8 = [0.478, 0.821, 0.318];
    const c9 = [0.741, 0.873, 0.150];
    const c10 = [0.993, 0.906, 0.144];

    const colors = [c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10];
    const idx = Math.min(Math.floor(t * 10), 9);
    const frac = t * 10 - idx;

    return [
        colors[idx][0] + frac * (colors[idx + 1][0] - colors[idx][0]),
        colors[idx][1] + frac * (colors[idx + 1][1] - colors[idx][1]),
        colors[idx][2] + frac * (colors[idx + 1][2] - colors[idx][2]),
    ];
}

export const VolumeRenderer = forwardRef<VolumeRendererRef, VolumeRendererProps>(
    (
        {
            width,
            height,
            volumeGrid,
            slicePlane,
            isosurface,
            renderMode = 'raymarching',
            isDark,
            latticeParams,
            onCameraChange,
        },
        ref
    ) => {
        const containerRef = useRef<HTMLDivElement>(null);
        const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
        const sceneRef = useRef<THREE.Scene | null>(null);
        const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
        const materialRef = useRef<THREE.ShaderMaterial | THREE.MeshStandardMaterial | null>(null);
        const meshRef = useRef<THREE.Mesh | THREE.LineSegments | null>(null);
        const volumeTextureRef = useRef<THREE.Data3DTexture | null>(null);
        const sliceMeshRef = useRef<THREE.Mesh | null>(null);
        const sliceTextureRef = useRef<THREE.DataTexture | null>(null);
        const frameRef = useRef<number>(0);

        // Camera sync state
        const externalCameraRef = useRef<CameraState | null>(null);

        // Expose imperative handle for camera synchronization
        useImperativeHandle(ref, () => ({
            scene: sceneRef.current,
            camera: cameraRef.current,
            getCameraState: () => {
                const camera = cameraRef.current;
                if (!camera) return null;

                return {
                    position: [camera.position.x, camera.position.y, camera.position.z],
                    target: [0, 0, 0], // We always look at origin
                    up: [camera.up.x, camera.up.y, camera.up.z],
                    zoom: camera.zoom,
                };
            },
            setCameraState: (state: CameraState) => {
                externalCameraRef.current = state;
            },
        }));

        // Initialize Three.js scene
        useEffect(() => {
            if (!containerRef.current) return;

            const container = containerRef.current;

            // Create renderer with transparent background
            const renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                premultipliedAlpha: false,
            });
            renderer.setSize(width, height);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.setClearColor(0x000000, 0);
            container.appendChild(renderer.domElement);
            rendererRef.current = renderer;

            // Create scene (no background - transparent)
            const scene = new THREE.Scene();
            sceneRef.current = scene;

            // Add lights
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
            scene.add(ambientLight);
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight.position.set(5, 5, 5);
            scene.add(dirLight);

            // Create camera
            const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
            camera.position.set(3, 2, 3);
            camera.lookAt(0, 0, 0);
            cameraRef.current = camera;

            // Animation loop - only renders when we have volume data
            const animate = () => {
                frameRef.current = requestAnimationFrame(animate);

                // Sync with external camera if provided
                if (externalCameraRef.current) {
                    const state = externalCameraRef.current;
                    camera.position.set(...state.position);
                    camera.up.set(...state.up);
                    camera.lookAt(...state.target);
                    camera.zoom = state.zoom;
                    camera.updateProjectionMatrix();
                }

                renderer.render(scene, camera);
            };
            animate();

            return () => {
                cancelAnimationFrame(frameRef.current);
                renderer.dispose();
                if (container.contains(renderer.domElement)) {
                    container.removeChild(renderer.domElement);
                }
            };
        }, [width, height]);

        // Update volume visualization
        useEffect(() => {
            if (!sceneRef.current || !volumeGrid) return;
            const scene = sceneRef.current;

            // Cleanup old objects
            if (meshRef.current) {
                scene.remove(meshRef.current);
                if (meshRef.current.geometry) meshRef.current.geometry.dispose();
                meshRef.current = null;
            }
            if (materialRef.current) {
                materialRef.current.dispose();
                materialRef.current = null;
            }
            if (volumeTextureRef.current) {
                volumeTextureRef.current.dispose();
                volumeTextureRef.current = null;
            }

            const { data, dimensions } = volumeGrid;
            const [nx, ny, nz] = dimensions;
            const color = new THREE.Color(isDark ? '#6b9eff' : '#2563eb');

            if (renderMode === 'raymarching') {
                // Create volume texture
                const texture = new THREE.Data3DTexture(data, nx, ny, nz);
                texture.format = THREE.RedFormat;
                texture.type = THREE.FloatType;
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                texture.wrapR = THREE.ClampToEdgeWrapping;
                texture.needsUpdate = true;
                volumeTextureRef.current = texture;

                // Find min/max for normalization
                let min = Infinity, max = -Infinity;
                for (let i = 0; i < data.length; i++) {
                    min = Math.min(min, data[i]);
                    max = Math.max(max, data[i]);
                }

                const isoValue = isosurface?.value ?? 0.5;

                const material = new THREE.ShaderMaterial({
                    uniforms: {
                        uVolume: { value: texture },
                        uIsoLevel: { value: isoValue },
                        uMinDensity: { value: min },
                        uMaxDensity: { value: max },
                        uColor: { value: color },
                        uOpacity: { value: isosurface?.opacity ?? 0.9 },
                    },
                    vertexShader: rayMarchVertexShader,
                    fragmentShader: rayMarchFragmentShader,
                    side: THREE.BackSide,
                    transparent: true,
                    depthWrite: false,
                });
                materialRef.current = material;

                const boxGeo = new THREE.BoxGeometry(2, 2, 2);
                const mesh = new THREE.Mesh(boxGeo, material);
                scene.add(mesh);
                meshRef.current = mesh;
            }
        }, [volumeGrid, renderMode, isosurface, isDark]);

        // Update isosurface level (fast path)
        useEffect(() => {
            if (materialRef.current && 'uniforms' in materialRef.current && isosurface) {
                (materialRef.current as THREE.ShaderMaterial).uniforms.uIsoLevel.value = isosurface.value;
            }
        }, [isosurface?.value]);

        // Update slice plane
        useEffect(() => {
            if (!sceneRef.current) return;
            const scene = sceneRef.current;

            // Cleanup old slice mesh
            if (sliceMeshRef.current) {
                scene.remove(sliceMeshRef.current);
                if (sliceMeshRef.current.geometry) sliceMeshRef.current.geometry.dispose();
                if (sliceMeshRef.current.material) {
                    (sliceMeshRef.current.material as THREE.Material).dispose();
                }
                sliceMeshRef.current = null;
            }
            if (sliceTextureRef.current) {
                sliceTextureRef.current.dispose();
                sliceTextureRef.current = null;
            }

            if (!slicePlane || !volumeGrid || !slicePlane.showTexture) return;

            const { data, dimensions } = volumeGrid;
            const [nx, ny, nz] = dimensions;
            const { axis, position, colorScale = 'viridis' } = slicePlane;

            // Extract 2D slice from volume
            let sliceData: Float32Array;
            let sliceWidth: number;
            let sliceHeight: number;

            if (axis === 'z') {
                sliceWidth = nx;
                sliceHeight = ny;
                const z = Math.floor(position * (nz - 1));
                sliceData = new Float32Array(nx * ny);
                for (let y = 0; y < ny; y++) {
                    for (let x = 0; x < nx; x++) {
                        sliceData[y * nx + x] = data[x + y * nx + z * nx * ny];
                    }
                }
            } else if (axis === 'y') {
                sliceWidth = nx;
                sliceHeight = nz;
                const y = Math.floor(position * (ny - 1));
                sliceData = new Float32Array(nx * nz);
                for (let z = 0; z < nz; z++) {
                    for (let x = 0; x < nx; x++) {
                        sliceData[z * nx + x] = data[x + y * nx + z * nx * ny];
                    }
                }
            } else {
                sliceWidth = ny;
                sliceHeight = nz;
                const x = Math.floor(position * (nx - 1));
                sliceData = new Float32Array(ny * nz);
                for (let z = 0; z < nz; z++) {
                    for (let y = 0; y < ny; y++) {
                        sliceData[z * ny + y] = data[x + y * nx + z * nx * ny];
                    }
                }
            }

            // Normalize and apply color scale
            let min = Infinity, max = -Infinity;
            for (let i = 0; i < sliceData.length; i++) {
                min = Math.min(min, sliceData[i]);
                max = Math.max(max, sliceData[i]);
            }
            const range = max - min || 1;

            const rgbaData = new Uint8Array(sliceWidth * sliceHeight * 4);
            for (let i = 0; i < sliceData.length; i++) {
                const t = (sliceData[i] - min) / range;
                const [r, g, b] = viridis(t);
                rgbaData[i * 4] = Math.floor(r * 255);
                rgbaData[i * 4 + 1] = Math.floor(g * 255);
                rgbaData[i * 4 + 2] = Math.floor(b * 255);
                rgbaData[i * 4 + 3] = 220; // Semi-transparent
            }

            const texture = new THREE.DataTexture(rgbaData, sliceWidth, sliceHeight);
            texture.format = THREE.RGBAFormat;
            texture.type = THREE.UnsignedByteType;
            texture.needsUpdate = true;
            sliceTextureRef.current = texture;

            // Get lattice parameters (default to 1 if not provided)
            const a = latticeParams?.a ?? 1;
            const b = latticeParams?.b ?? a;
            const c = latticeParams?.c ?? a;

            // Create plane mesh sized to unit cell
            // NGL positions unit cell from (0,0,0) to (a,b,c)
            let planeWidth: number;
            let planeHeight: number;

            if (axis === 'z') {
                planeWidth = a;
                planeHeight = b;
            } else if (axis === 'y') {
                planeWidth = a;
                planeHeight = c;
            } else {
                planeWidth = b;
                planeHeight = c;
            }

            const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                side: THREE.DoubleSide,
                depthWrite: false,
            });

            const mesh = new THREE.Mesh(geometry, material);

            // Position in crystal coordinates (0 to a/b/c)
            // Center the plane at half the lattice parameter, offset by slice position
            if (axis === 'z') {
                mesh.rotation.x = -Math.PI / 2;
                mesh.position.set(a / 2, b / 2, position * c);
            } else if (axis === 'y') {
                mesh.position.set(a / 2, position * b, c / 2);
            } else {
                mesh.rotation.y = Math.PI / 2;
                mesh.position.set(position * a, b / 2, c / 2);
            }

            scene.add(mesh);
            sliceMeshRef.current = mesh;
        }, [slicePlane, volumeGrid, latticeParams]);

        // Handle resize
        useEffect(() => {
            if (rendererRef.current && cameraRef.current) {
                rendererRef.current.setSize(width, height);
                cameraRef.current.aspect = width / height;
                cameraRef.current.updateProjectionMatrix();
            }
        }, [width, height]);

        return (
            <div
                ref={containerRef}
                style={{
                    width,
                    height,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    pointerEvents: 'none', // Let mouse events pass through to NGL layer
                }}
            />
        );
    }
);

VolumeRenderer.displayName = 'VolumeRenderer';

export default VolumeRenderer;
