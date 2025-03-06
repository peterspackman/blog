import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { vertexShader, fragmentShader } from './Particle2DBoxShader';
import Button from './Button';
import MathFormula from './MathFormula';
import styles from './QMVisualization.module.css';

const Particle2DBox = () => {
  // State variables
  const [activeStates, setActiveStates] = useState([{ nx: 1, ny: 1 }]);
  const [isAnimating, setIsAnimating] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [displayMode, setDisplayMode] = useState('probability');
  const [colorMapType, setColorMapType] = useState('blue-white-orange');
  const [showGridLines, setShowGridLines] = useState(false);
  const [showPhaseInfo, setShowPhaseInfo] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);

  // Constants
  const maxQuantumNumber = 5;
  const mainCanvasSize = 512;
  const phasorGridSize = 400;

  // Refs
  const mainCanvasRef = useRef(null);
  const phasorCanvasRef = useRef(null);
  const colorScaleRef = useRef(null);
  const timeRef = useRef(0);
  const animationRef = useRef(null);

  // THREE.js objects for the main visualization
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const materialRef = useRef(null);

  // Calculate the energy of a state
  const calcEnergy = (nx, ny) => nx * nx + ny * ny;

  // Get color based on energy level (for phasor)
  const getEnergyColor = (nx, ny) => {
    const energy = calcEnergy(nx, ny);
    const maxEnergy = 2 * maxQuantumNumber * maxQuantumNumber;
    const normalizedEnergy = Math.min(energy / maxEnergy, 1);

    if (normalizedEnergy < 0.5) {
      const t = normalizedEnergy * 2;
      return `rgb(${Math.round(77 + t * 178)}, ${Math.round(128 + t * 127)}, 255)`;
    } else {
      const t = (normalizedEnergy - 0.5) * 2;
      return `rgb(255, ${Math.round(255 - t * 153)}, ${Math.round(255 - t * 204)})`;
    }
  };

  // Toggle a quantum state
  const toggleState = (nx, ny) => {
    const stateIndex = activeStates.findIndex(s => s.nx === nx && s.ny === ny);

    if (stateIndex >= 0) {
      // Remove state if it exists (but prevent removing the last state)
      if (activeStates.length > 1) {
        setActiveStates(activeStates.filter((_, i) => i !== stateIndex));
      }
    } else {
      // Add state if it doesn't exist (limit to 10 states)
      if (activeStates.length < 10) {
        setActiveStates([...activeStates, { nx, ny }]);
      }
    }
  };

  // Cycle through colormaps
  const cycleColorMap = () => {
    const maps = ['blue-white-orange', 'blue-white-red', 'rainbow'];
    const currentIndex = maps.indexOf(colorMapType);
    const nextIndex = (currentIndex + 1) % maps.length;
    setColorMapType(maps[nextIndex]);
  };

  // Get active states as a string
  const getActiveStatesString = () => {
    return activeStates.map(state => `(${state.nx},${state.ny})`).join(', ');
  };

  // Get display mode name
  const getDisplayModeName = () => {
    if (displayMode === 'probability') return 'Probability Density';
    if (displayMode === 'real') return 'Real Part';
    if (displayMode === 'imaginary') return 'Imaginary Part';
    return 'Probability Density';
  };

  // Initialize the main visualization with THREE.js
  useEffect(() => {
    if (!mainCanvasRef.current) return;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: mainCanvasRef.current,
      antialias: true
    });
    rendererRef.current = renderer;

    // Create scene with a simple fullscreen quad
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Create shader material
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uActiveStatesCount: { value: activeStates.length },
        uActiveStates: { value: new Float32Array(20) }, // 10 states x 2 values (nx, ny)
        uDisplayMode: { value: 0 },
        uColorMapType: { value: 0 },
        uShowGridLines: { value: false }
      }
    });
    materialRef.current = material;

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Clean up on unmount
    return () => {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  // Update shader uniforms
  useEffect(() => {
    if (!materialRef.current) return;

    // Convert display mode to number
    let displayModeNumber = 0;
    if (displayMode === 'real') displayModeNumber = 1;
    if (displayMode === 'imaginary') displayModeNumber = 2;

    // Convert color map to number
    let colorMapNumber = 0;
    if (colorMapType === 'blue-white-red') colorMapNumber = 1;
    if (colorMapType === 'rainbow') colorMapNumber = 2;

    // Update active states array
    const activeStatesArray = new Float32Array(20);
    activeStates.forEach((state, i) => {
      if (i < 10) {
        activeStatesArray[i * 2] = state.nx;
        activeStatesArray[i * 2 + 1] = state.ny;
      }
    });

    // Update uniforms
    materialRef.current.uniforms.uActiveStatesCount.value = activeStates.length;
    materialRef.current.uniforms.uActiveStates.value = activeStatesArray;
    materialRef.current.uniforms.uDisplayMode.value = displayModeNumber;
    materialRef.current.uniforms.uColorMapType.value = colorMapNumber;
    materialRef.current.uniforms.uShowGridLines.value = showGridLines;
  }, [activeStates, displayMode, colorMapType, showGridLines]);

  // Draw color scale
  useEffect(() => {
    if (!colorScaleRef.current) return;

    const canvas = colorScaleRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Color maps
    const colorMaps = {
      'blue-white-orange': [
        [0, 50, 150], [30, 100, 200], [100, 160, 255], [200, 220, 255],
        [255, 255, 255],
        [255, 220, 180], [255, 170, 100], [230, 120, 30], [180, 60, 0]
      ],
      'blue-white-red': [
        [0, 0, 180], [50, 70, 220], [100, 120, 255], [170, 190, 255],
        [255, 255, 255],
        [255, 170, 170], [255, 110, 110], [220, 50, 50], [160, 0, 0]
      ],
      'rainbow': [
        [80, 0, 140], [0, 0, 255], [0, 180, 255], [0, 210, 140],
        [0, 220, 0], [180, 220, 0], [255, 180, 0], [255, 120, 0], [255, 0, 0]
      ]
    };

    // Get color from value
    const getColor = (value) => {
      const colorMap = colorMaps[colorMapType];
      const pos = value * (colorMap.length - 1);
      const index = Math.floor(pos);
      const fraction = pos - index;

      if (index >= colorMap.length - 1) {
        const [r, g, b] = colorMap[colorMap.length - 1];
        return `rgb(${r}, ${g}, ${b})`;
      }

      const [r1, g1, b1] = colorMap[index];
      const [r2, g2, b2] = colorMap[index + 1];

      const r = Math.round(r1 + fraction * (r2 - r1));
      const g = Math.round(g1 + fraction * (g2 - g1));
      const b = Math.round(b1 + fraction * (b2 - b1));

      return `rgb(${r}, ${g}, ${b})`;
    };

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw gradient
    for (let i = 0; i < width; i++) {
      const value = i / width;
      ctx.fillStyle = getColor(value);
      ctx.fillRect(i, 0, 1, height);
    }

    // Draw border
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);

    // Draw zero marker for real/imaginary parts
    if (displayMode === 'real' || displayMode === 'imaginary') {
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();
    }
  }, [colorMapType, displayMode]);

  // Draw phasor grid with HTML5 Canvas
  useEffect(() => {
    if (!phasorCanvasRef.current) return;

    const canvas = phasorCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Calculate cell size
    const cellSize = width / maxQuantumNumber;
    const phasorRadius = cellSize * 0.35;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;

    for (let i = 0; i <= maxQuantumNumber; i++) {
      const pos = i * cellSize;

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, height);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(width, pos);
      ctx.stroke();
    }

    // Draw quantum number labels
    ctx.fillStyle = '#000';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // nx labels (top)
    for (let nx = 1; nx <= maxQuantumNumber; nx++) {
      const x = (nx - 0.9) * cellSize;
      ctx.fillText(`${nx}`, x, 15);
    }

    // ny labels (left side)
    ctx.textAlign = 'right';
    for (let ny = 2; ny <= maxQuantumNumber; ny++) {
      const y = (ny - 0.75) * cellSize;
      ctx.fillText(`${ny}`, 15, y);
    }

    // Draw phasors for each quantum state
    for (let nx = 1; nx <= maxQuantumNumber; nx++) {
      for (let ny = 1; ny <= maxQuantumNumber; ny++) {
        const centerX = (nx - 0.5) * cellSize;
        const centerY = (ny - 0.5) * cellSize;

        // Determine if this state is active
        const isActive = activeStates.some(s => s.nx === nx && s.ny === ny);

        // Get state color based on energy
        const stateColor = getEnergyColor(nx, ny);

        // Draw phasor circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, phasorRadius, 0, 2 * Math.PI);
        ctx.strokeStyle = isActive ? stateColor : '#ddd';
        ctx.lineWidth = isActive ? 4 : 3;
        ctx.fillStyle = isActive ? stateColor + '30' : '#fff'; // 30 is hex for ~20% opacity
        ctx.fill();
        ctx.stroke();

        // Draw energy value
        const energy = calcEnergy(nx, ny);
        ctx.fillStyle = isActive ? stateColor : '#000';
        ctx.font = isActive ? 'bold 12px Arial' : '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`E=${energy}`, centerX, centerY + 0.5 * phasorRadius);

        // For active states, draw phasor arrow
        if (isActive && showPhaseInfo) {
          const phase = -energy * timeRef.current; // Phase = -Et/ℏ

          // Calculate arrow endpoint
          const arrowX = centerX + phasorRadius * Math.cos(phase);
          const arrowY = centerY - phasorRadius * Math.sin(phase);

          // Draw arrow line
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(arrowX, arrowY);
          ctx.strokeStyle = stateColor;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Draw arrowhead
          const headSize = phasorRadius * 0.25;
          const angle = Math.atan2(arrowY - centerY, arrowX - centerX);

          ctx.beginPath();
          ctx.moveTo(arrowX, arrowY);
          ctx.lineTo(
            arrowX - headSize * Math.cos(angle - Math.PI / 6),
            arrowY - headSize * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            arrowX - headSize * Math.cos(angle + Math.PI / 6),
            arrowY - headSize * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fillStyle = stateColor;
          ctx.fill();
        }
      }
    }
  }, [activeStates, showPhaseInfo, timeRef.current]);

  // Add click handler for phasor grid
  useEffect(() => {
    if (!phasorCanvasRef.current) return;

    const canvas = phasorCanvasRef.current;

    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      const cellSize = canvas.width / maxQuantumNumber;

      const nx = Math.ceil(x / cellSize);
      const ny = Math.ceil(y / cellSize);

      if (nx >= 1 && nx <= maxQuantumNumber && ny >= 1 && ny <= maxQuantumNumber) {
        toggleState(nx, ny);
      }
    };

    canvas.addEventListener('click', handleClick);
    return () => canvas.removeEventListener('click', handleClick);
  }, [activeStates]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      if (isAnimating) {
        timeRef.current += 0.005 * speed;
        setCurrentTime(timeRef.current.toFixed(1));

        // Update time uniform
        if (materialRef.current) {
          materialRef.current.uniforms.uTime.value = timeRef.current;
        }

        // Render main visualization
        if (rendererRef.current && sceneRef.current) {
          rendererRef.current.render(sceneRef.current, new THREE.Camera());
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating, speed]);

  return (
    <div className={styles.container}>
      {/* Main visualization row */}
      <div className={styles.visualizationRow}>
        {/* Main visualization column */}
        <div className={styles.mainVisualizationColumn}>
          <div className={styles.canvasContainer}>
            <canvas
              ref={mainCanvasRef}
              width={mainCanvasSize}
              height={mainCanvasSize}
              className={styles.canvas}
            />
          </div>

          {/* Color scale */}
          <div className={styles.colorScaleContainer}>
            <canvas
              ref={colorScaleRef}
              width={512}
              height={40}
              className="colorScaleCanvas"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '8px' }}>
              {displayMode === 'probability' ? (
                <>
                  <span className="colorScaleLabel">0</span>
                  <span className="colorScaleLabel">Probability Density</span>
                  <span className="colorScaleLabel">Max</span>
                </>
              ) : displayMode === 'real' ? (
                <>
                  <span className="colorScaleLabel">Min</span>
                  <span className="colorScaleLabel">0</span>
                  <span className="colorScaleLabel">Max</span>
                </>
              ) : (
                <>
                  <span className="colorScaleLabel">Min</span>
                  <span className="colorScaleLabel">0</span>
                  <span className="colorScaleLabel">Max</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Phasor grid column */}
        <div className={styles.phasorColumn}>
          <div className={styles.phasorWrapper}>
            <div className={styles.canvasContainer}>
              <canvas
                ref={phasorCanvasRef}
                width={phasorGridSize}
                height={phasorGridSize}
                className="canvas"
              />
            </div>
            <p className={styles.phasorHint}>Click on a phasor circle to toggle quantum states</p>
          </div>

          {/* Info panel */}
          <div className={styles.infoPanel}>
            <h3 className={styles.infoTitle}>Current Settings</h3>
            <div className={styles.infoGrid}>
              <div>
                <p className={styles.infoValue}>
                  <span className={styles.infoLabel}>Mode:</span> {getDisplayModeName()}
                </p>
                <p className={styles.infoValue}>
                  <span className={styles.infoLabel}>Time:</span> {currentTime}
                </p>
              </div>
              <div>
                <p className={styles.infoValue}>
                  <span className={styles.infoLabel}>Active States:</span> {getActiveStatesString()}
                </p>
                <p className={styles.infoValue}>
                  <span className={styles.infoLabel}>Color Map:</span> {colorMapType}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls section */}
      <div className={styles.controlsSection}>
        <div className={styles.controlsRow}>
          {/* Animation controls */}
          <div className={styles.controlGroup}>
            <h3 className={styles.controlGroupTitle}>Animation</h3>
            <div className={styles.controlOptions}>
              <Button
                onClick={() => setIsAnimating(!isAnimating)}
                variant={isAnimating ? "danger" : "success"}
              >
                {isAnimating ? 'Pause' : 'Play'}
              </Button>

              <div className={styles.rangeContainer}>
                <span className={styles.rangeLabel}>Speed:</span>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className={styles.rangeInput}
                />
                <span className={styles.rangeValue}>{speed.toFixed(1)}x</span>
              </div>
            </div>
          </div>

          {/* Display mode controls */}
          <div className={styles.controlGroup}>
            <h3 className={styles.controlGroupTitle}>Display Mode</h3>
            <div className={styles.controlOptions}>
              <div className={styles.controlOption}>
                <input
                  type="radio"
                  id="probability"
                  checked={displayMode === 'probability'}
                  onChange={() => setDisplayMode('probability')}
                />
                <label htmlFor="probability" className={styles.controlOptionLabel}>
                  Probability Density
                </label>
              </div>

              <div className={styles.controlOption}>
                <input
                  type="radio"
                  id="real"
                  checked={displayMode === 'real'}
                  onChange={() => setDisplayMode('real')}
                />
                <label htmlFor="real" className={styles.controlOptionLabel}>
                  Real Part
                </label>
              </div>

              <div className={styles.controlOption}>
                <input
                  type="radio"
                  id="imaginary"
                  checked={displayMode === 'imaginary'}
                  onChange={() => setDisplayMode('imaginary')}
                />
                <label htmlFor="imaginary" className={styles.controlOptionLabel}>
                  Imaginary Part
                </label>
              </div>
            </div>
          </div>

          {/* Visualization options */}
          <div className={styles.controlGroup}>
            <h3 className={styles.controlGroupTitle}>Visualization Options</h3>
            <div className={styles.controlOptions}>
              <Button
                onClick={cycleColorMap}
                variant="primary"
              >
                Cycle Color Map
              </Button>

              <div className={styles.controlOption}>
                <input
                  type="checkbox"
                  id="gridLines"
                  checked={showGridLines}
                  onChange={(e) => setShowGridLines(e.target.checked)}
                />
                <label htmlFor="gridLines" className={styles.controlOptionLabel}>
                  Grid Lines
                </label>
              </div>

              <div className={styles.controlOption}>
                <input
                  type="checkbox"
                  id="phaseInfo"
                  checked={showPhaseInfo}
                  onChange={(e) => setShowPhaseInfo(e.target.checked)}
                />
                <label htmlFor="phaseInfo" className={styles.controlOptionLabel}>
                  Show Phasors
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className={styles.explanationContainer}>
        <h3 className={styles.explanationTitle}>About 2D Quantum Particle in a Box</h3>
        <p className={styles.explanationText}>
          This visualization shows a quantum particle confined to a two-dimensional square box with infinite potential walls.
          The system has eigenstates characterized by two quantum numbers (nx, ny), corresponding to the number of nodes in each dimension.
        </p>
        <p className={styles.explanationText}>
          The energy of each state is <MathFormula math="E = \frac{\pi^2 \hbar^2}{2 m L^2} (nx^2 + ny^2)" inline={true} />, meaning higher quantum numbers have higher energies.
          Each quantum state evolves in time with a phase factor <MathFormula math="e^{\frac{-i E t}{\hbar}}" inline={true} />, with faster rotation for higher energy states.
        </p>

        <h4>Key features to observe:</h4>
        <ul className={styles.explanationList}>
          <li className={styles.explanationListItem}>
            Probability densities show characteristic nodal patterns based on quantum numbers
          </li>
          <li className={styles.explanationListItem}>
            Superposition of states creates interference patterns that evolve in time
          </li>
          <li className={styles.explanationListItem}>
            States with different energies evolve at different rates, creating complex dynamics
          </li>
          <li className={styles.explanationListItem}>
            The phasor grid shows the phase evolution of each active quantum state
          </li>
        </ul>

        <div className={styles.explanationNote}>
          <strong>Tip:</strong> Try activating multiple states with different quantum numbers to see interference effects
          and observe how the pattern evolves over time!
        </div>

        {/* Active states and energies */}
        {activeStates.length > 0 && (
          <div className={styles.stateEnergiesContainer}>
            <h4>Active States and Their Energies</h4>
            <ul className={styles.stateEnergiesList}>
              {activeStates.map((state) => (
                <li key={`${state.nx}-${state.ny}`} className={styles.stateEnergiesItem}>
                  State (nx={state.nx}, ny={state.ny}): E = {calcEnergy(state.nx, state.ny)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Particle2DBox;
