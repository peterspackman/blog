import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { vertexShader, fragmentShader } from './OrbitalShader';

// This is a browser-only component for Docusaurus
const OrbitalMixer = () => {
  // For Docusaurus, we need to use dynamic imports for browser-only libraries
  const [ready, setReady] = useState(false);
  const [Components, setComponents] = useState(null);

  useEffect(() => {
    // Only import these libraries on the client side
    const loadLibraries = async () => {
      try {
        // Import all required modules
        const THREE = await import('three');
        const ReactThreeFiber = await import('@react-three/fiber');
        const Drei = await import('@react-three/drei');

        // Set the components
        setComponents({
          Canvas: ReactThreeFiber.Canvas,
          OrbitControls: Drei.OrbitControls,
          THREE
        });
        setReady(true);
      } catch (error) {
        console.error("Failed to load Three.js libraries:", error);
      }
    };

    loadLibraries();
  }, []);

  // Show a loading state until libraries are imported
  if (!ready || !Components) {
    return <div>Loading 3D visualization...</div>;
  }

  // Render the actual component once loaded
  return <OrbitalMixerImpl Components={Components} />;
};

// The actual implementation, only rendered on the client side
const OrbitalMixerImpl = ({ Components }) => {
  const { Canvas, OrbitControls, THREE } = Components;
  const [renderMode, setRenderMode] = useState(0);

  // New state to handle multiple orbitals
  const [orbitals, setOrbitals] = useState([
    { n: 2, l: 1, m: 0, weight: 1.0, phase: 0.0, enabled: true }
  ]);
  const [isovalue, setIsovalue] = useState(1e-6);
  const [activeOrbitalIndex, setActiveOrbitalIndex] = useState(0);
  const [maxOrbitals] = useState(6); // Maximum number of orbitals

  // Add a new orbital
  const addOrbital = () => {
    if (orbitals.length < maxOrbitals) {
      const newOrbital = { n: 1, l: 0, m: 0, weight: 1.0, phase: 0.0, enabled: true };
      setOrbitals([...orbitals, newOrbital]);
      setActiveOrbitalIndex(orbitals.length); // Set the new orbital as active
    }
  };

  // Remove an orbital
  const removeOrbital = (index) => {
    if (orbitals.length > 1) {
      const newOrbitals = orbitals.filter((_, i) => i !== index);
      setOrbitals(newOrbitals);

      // Adjust activeOrbitalIndex if needed
      if (activeOrbitalIndex >= newOrbitals.length) {
        setActiveOrbitalIndex(newOrbitals.length - 1);
      } else if (activeOrbitalIndex === index) {
        setActiveOrbitalIndex(Math.max(0, index - 1));
      }
    }
  };

  // Update a specific orbital's properties
  const updateOrbital = (index, property, value) => {
    const newOrbitals = [...orbitals];

    // Handle special case for n and l to maintain valid quantum numbers
    if (property === 'n') {
      const newN = parseInt(value);
      newOrbitals[index].n = newN;

      // Ensure l is valid for the new n value
      if (newOrbitals[index].l >= newN) {
        newOrbitals[index].l = newN - 1;

        // Also ensure m is valid for the new l value
        if (Math.abs(newOrbitals[index].m) > newOrbitals[index].l) {
          newOrbitals[index].m = 0;
        }
      }
    } else if (property === 'l') {
      const newL = parseInt(value);
      newOrbitals[index].l = newL;

      // Ensure m is valid for the new l value
      if (Math.abs(newOrbitals[index].m) > newL) {
        newOrbitals[index].m = 0;
      }
    } else if (property === 'm') {
      newOrbitals[index].m = parseInt(value);
    } else if (property === 'weight') {
      newOrbitals[index].weight = parseFloat(value);
    } else if (property === 'phase') {
      newOrbitals[index].phase = parseFloat(value);
    } else if (property === 'enabled') {
      newOrbitals[index].enabled = value;
    }

    setOrbitals(newOrbitals);
  };

  // Toggle an orbital's enabled state
  const toggleOrbital = (index) => {
    const newOrbitals = [...orbitals];
    newOrbitals[index].enabled = !newOrbitals[index].enabled;
    setOrbitals(newOrbitals);
  };

  // Normalize weights to ensure they sum to 1.0
  const normalizeWeights = () => {
    const enabledOrbitals = orbitals.filter(orbital => orbital.enabled);
    if (enabledOrbitals.length === 0) return;

    const totalWeight = enabledOrbitals.reduce((sum, orbital) => sum + orbital.weight, 0);

    if (totalWeight > 0) {
      const newOrbitals = [...orbitals];
      for (let i = 0; i < newOrbitals.length; i++) {
        if (newOrbitals[i].enabled) {
          newOrbitals[i].weight = newOrbitals[i].weight / totalWeight;
        }
      }
      setOrbitals(newOrbitals);
    }
  };

  // Simple shader-based component
  const ShaderScene = () => {
    const { camera, gl, scene, size } = useThree();
    const meshRef = useRef();

    // Create material with a simple shader to visualize a sphere
    const material = useMemo(() => {
      // Prepare orbital data arrays for shader
      const orbitalData = orbitals.map(orbital => ({
        n: orbital.n,
        l: orbital.l,
        m: orbital.m,
        weight: orbital.enabled ? orbital.weight : 0.0,
        phase: orbital.phase
      }));

      return new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          renderMode: { value: renderMode },
          aspectRatio: { value: 1.0 },
          edgeThreshold: { value: 0.01 },
          edgeWidth: { value: 0.00001 },
          isovalue: { value: isovalue },
          cameraPos: { value: new THREE.Vector3() },
          cameraDirection: { value: new THREE.Vector3() },
          cameraUp: { value: new THREE.Vector3() },
          cameraRight: { value: new THREE.Vector3() },

          // Orbital data arrays
          orbital_n: { value: orbitalData.map(o => o.n) },
          orbital_l: { value: orbitalData.map(o => o.l) },
          orbital_m: { value: orbitalData.map(o => o.m) },
          orbital_weight: { value: orbitalData.map(o => o.weight) },
          orbital_phase: { value: orbitalData.map(o => o.phase) },
          orbital_count: { value: orbitals.length }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        side: THREE.DoubleSide
      });
    }, [THREE, renderMode, isovalue, orbitals]);

    // Function to update all camera-related uniforms
    const updateCameraUniforms = () => {
      if (!material.uniforms) return;

      // Update aspect ratio in case window was resized
      material.uniforms.aspectRatio.value = size.width / size.height;

      // Update camera position
      material.uniforms.cameraPos.value.copy(camera.position);

      // Calculate and update camera vectors
      const direction = new THREE.Vector3(0, 0, -1);
      direction.applyQuaternion(camera.quaternion);
      material.uniforms.cameraDirection.value.copy(direction);

      const up = new THREE.Vector3(0, 1, 0);
      up.applyQuaternion(camera.quaternion);
      material.uniforms.cameraUp.value.copy(up);

      const right = new THREE.Vector3(1, 0, 0);
      right.applyQuaternion(camera.quaternion);
      material.uniforms.cameraRight.value.copy(right);
    };

    // Update uniforms when orbital data changes
    useEffect(() => {
      if (!material.uniforms) return;

      // Update orbital data arrays
      const orbitalData = orbitals.map(orbital => ({
        n: orbital.n,
        l: orbital.l,
        m: orbital.m,
        weight: orbital.enabled ? orbital.weight : 0.0,
        phase: orbital.phase
      }));

      material.uniforms.orbital_n.value = orbitalData.map(o => o.n);
      material.uniforms.orbital_l.value = orbitalData.map(o => o.l);
      material.uniforms.orbital_m.value = orbitalData.map(o => o.m);
      material.uniforms.orbital_weight.value = orbitalData.map(o => o.weight);
      material.uniforms.orbital_phase.value = orbitalData.map(o => o.phase);
      material.uniforms.orbital_count.value = orbitals.length;
      material.uniforms.renderMode.value = renderMode;

      updateCameraUniforms();
    }, [material, orbitals, renderMode]);

    // Update camera uniforms and time in the animation loop
    useFrame((state, delta) => {
      if (meshRef.current) {
        // Update time uniform for animations
        material.uniforms.time.value += delta;

        // Update camera uniforms on every frame to respond to OrbitControls
        updateCameraUniforms();
      }
    });

    return (
      <mesh ref={meshRef} frustumCulled={false}>
        <planeGeometry args={[2, 2]} /> {/* Full screen quad */}
        <primitive object={material} attach="material" />
      </mesh>
    );
  };

  // Generate the orbital label (nl notation)
  const getOrbitalLabel = (n, l, m) => {
    const subshells = ['s', 'p', 'd', 'f', 'g', 'h'];
    return `${n}${subshells[l]}${m !== 0 ? ` (m=${m})` : ''}`;
  };

  return (
    <div style={{ position: 'relative', height: '500px' }}>
      <div style={{
        position: 'absolute',
        zIndex: 10,
        padding: '10px',
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        borderRadius: '5px',
        maxHeight: '500px',
        overflowY: 'auto',
        width: '300px'
      }}>
        <div style={{ marginBottom: '15px' }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Orbital Mixing</h3>
          <div>
            <button
              onClick={addOrbital}
              disabled={orbitals.length >= maxOrbitals}
              style={{
                background: '#4CAF50',
                color: 'white',
                border: 'none',
                padding: '5px 10px',
                marginRight: '10px',
                borderRadius: '3px',
                cursor: orbitals.length >= maxOrbitals ? 'not-allowed' : 'pointer',
                opacity: orbitals.length >= maxOrbitals ? 0.5 : 1
              }}
            >
              Add Orbital
            </button>
            <button
              onClick={normalizeWeights}
              style={{
                background: '#2196F3',
                color: 'white',
                border: 'none',
                padding: '5px 10px',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              Normalize Weights
            </button>
          </div>
        </div>

        {orbitals.map((orbital, index) => (
          <div
            key={index}
            style={{
              marginBottom: '15px',
              padding: '10px',
              background: index === activeOrbitalIndex ? 'rgba(255,255,255,0.1)' : 'transparent',
              borderRadius: '5px',
              border: '1px solid rgba(255,255,255,0.2)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <strong style={{ fontSize: '16px' }}>
                {getOrbitalLabel(orbital.n, orbital.l, orbital.m)}
              </strong>
              <div>
                <button
                  onClick={() => setActiveOrbitalIndex(index)}
                  style={{
                    background: 'transparent',
                    color: 'white',
                    border: '1px solid white',
                    padding: '2px 5px',
                    marginRight: '5px',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleOrbital(index)}
                  style={{
                    background: orbital.enabled ? '#4CAF50' : '#f44336',
                    color: 'white',
                    border: 'none',
                    padding: '2px 5px',
                    marginRight: '5px',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  {orbital.enabled ? 'On' : 'Off'}
                </button>
                {orbitals.length > 1 && (
                  <button
                    onClick={() => removeOrbital(index)}
                    style={{
                      background: '#f44336',
                      color: 'white',
                      border: 'none',
                      padding: '2px 5px',
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {index === activeOrbitalIndex && (
              <div>
                <div>
                  <label>n: </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={orbital.n}
                    onChange={(e) => updateOrbital(index, 'n', e.target.value)}
                  />
                  <span>{orbital.n}</span>
                </div>
                <div>
                  <label>l: </label>
                  <input
                    type="range"
                    min="0"
                    max={orbital.n - 1}
                    value={orbital.l}
                    onChange={(e) => updateOrbital(index, 'l', e.target.value)}
                  />
                  <span>{orbital.l}</span>
                </div>
                <div>
                  <label>m: </label>
                  <input
                    type="range"
                    min={-orbital.l}
                    max={orbital.l}
                    value={orbital.m}
                    onChange={(e) => updateOrbital(index, 'm', e.target.value)}
                  />
                  <span>{orbital.m}</span>
                </div>
                <div>
                  <label>Phase: </label>
                  <input
                    type="range"
                    min="0"
                    max="6.28"
                    step="0.01"
                    value={orbital.phase}
                    onChange={(e) => updateOrbital(index, 'phase', e.target.value)}
                  />
                  <span>{(orbital.phase / Math.PI).toFixed(2)}π</span>
                </div>
              </div>
            )}

            <div>
              <label>Weight: </label>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.01"
                value={orbital.weight}
                disabled={!orbital.enabled}
                onChange={(e) => updateOrbital(index, 'weight', e.target.value)}
              />
              <span>{orbital.weight.toFixed(2)}</span>
            </div>

          </div>
        ))}

        <div style={{ marginTop: '20px' }}>
          <label>Visualization: </label>
          <select
            value={renderMode}
            onChange={(e) => setRenderMode(parseInt(e.target.value))}
            style={{ background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid #555', width: '100%', padding: '5px' }}
          >
            <option value="0">Probability Density</option>
            <option value="1">Real Component</option>
            <option value="2">Imaginary Component</option>
            <option value="3">Phase</option>
            <option value="4">Real/Imaginary Mix</option>
          </select>
          <div>
            <label>Isovalue: </label>
            <input
              type="range"
              min="0.1"
              max="100"
              step="0.1"
              value={(isovalue / 1e-6).toFixed(0)}
              onChange={(e) => setIsovalue(parseFloat(e.target.value) * 1e-6)}
            />
            <span>{(isovalue / 1e-6).toFixed(2)}e-6</span>
          </div>

        </div>
      </div>

      <Canvas
        camera={{
          position: [0, 10, 10],
          zoom: 1.5,
          near: 0.1,
          far: 1000,
          orthographic: true
        }}
        style={{ background: '#111', height: "500px" }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <ShaderScene />
        <OrbitControls />
      </Canvas>

      {/* Information panel */}
      <div style={{
        position: 'absolute',
        right: '10px',
        top: '10px',
        padding: '10px',
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        borderRadius: '5px',
        maxWidth: '250px',
        fontSize: '14px'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Orbital Mixer</h3>
        <p>Mix up to 6 atomic orbitals to visualize quantum superpositions.</p>
        <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
          <li>Use <strong>Edit</strong> to modify orbital parameters</li>
          <li>Adjust <strong>Weight</strong> to control contribution</li>
          <li>Toggle orbitals <strong>On/Off</strong> with the button</li>
          <li>Use <strong>Phase</strong> to control quantum phase</li>
          <li>Click <strong>Normalize</strong> to balance weights</li>
        </ul>
        <p>Try mixing s and p orbitals to create hybrid orbitals, or explore complex superpositions!</p>
      </div>
    </div>
  );
};

export default OrbitalMixer;
