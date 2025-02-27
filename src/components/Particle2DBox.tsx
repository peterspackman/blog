import React, { useState, useEffect, useRef } from 'react';
import _ from 'lodash';
import Button from './Button';
import MathFormula from './MathFormula';
import clsx from 'clsx';
import styles from './QMVisualization.module.css';

const Particle2DBox = () => {
  // State variables
  const [activeStates, setActiveStates] = useState([{nx: 1, ny: 1}]); // Array of active quantum states (nx, ny)
  const [isAnimating, setIsAnimating] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [showProbability, setShowProbability] = useState(true);
  const [showRealPart, setShowRealPart] = useState(false);
  const [showImaginaryPart, setShowImaginaryPart] = useState(false);
  const [showPhaseInfo, setShowPhaseInfo] = useState(true);
  const [colorMapType, setColorMapType] = useState('blue-white-orange'); // 'blue-white-orange', 'blue-white-red', 'rainbow'
  const [showGridLines, setShowGridLines] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [maxValue, setMaxValue] = useState(1);
  
  // Canvas references
  const mainCanvasRef = useRef(null);
  const phasorGridRef = useRef(null);
  const colorScaleRef = useRef(null);
  const animationRef = useRef(null);
  const timeRef = useRef(0);
  
  // Constants
  const boxSize = 512; // Main visualization size
  const phasorGridSize = 400; // Phasor grid size
  const colorScaleWidth = 512; // Color scale width
  const colorScaleHeight = 40; // Color scale height
  const maxQuantumNumber = 5; // Maximum quantum number for nx and ny
  
  // Define color maps
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
  
  // Get color from value (0-1) using selected color map
  const getColor = (value, alpha = 1) => {
    const colorMap = colorMaps[colorMapType];
    const pos = value * (colorMap.length - 1);
    const index = Math.floor(pos);
    const fraction = pos - index;
    
    if (index >= colorMap.length - 1) {
      const [r, g, b] = colorMap[colorMap.length - 1];
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    const [r1, g1, b1] = colorMap[index];
    const [r2, g2, b2] = colorMap[index + 1];
    
    const r = Math.round(r1 + fraction * (r2 - r1));
    const g = Math.round(g1 + fraction * (g2 - g1));
    const b = Math.round(b1 + fraction * (b2 - b1));
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  
  // Calculate the energy of a state
  const calcEnergy = (nx, ny) => {
    // E = (π²ℏ²)/(2mL²) * (nx² + ny²)
    // Using normalized units where π²ℏ²/(2mL²) = 1
    return nx * nx + ny * ny;
  };
  
  // Get the energy label as a math formula
  const getEnergyLabel = (nx, ny) => {
    return <MathFormula math={`\\frac{\\pi^2\\hbar^2}{2mL^2}(${nx}^2 + ${ny}^2) = ${calcEnergy(nx, ny)}`} />;
  };
  
  // Calculate wavefunction value at a point
  const calcWaveFunction = (x, y, nx, ny, t) => {
    // ψ(x,y,t) = ψ(x,y) * exp(-iEt/ℏ)
    // ψ(x,y) = (2/L) * sin(nxπx/L) * sin(nyπy/L)
    // Using normalized units where L = 1
    
    // Spatial part
    const psiSpace = 2 * Math.sin(nx * Math.PI * x) * Math.sin(ny * Math.PI * y);
    
    // Time evolution
    const energy = calcEnergy(nx, ny);
    const phase = -energy * t; // Negative for exp(-iEt/ℏ)
    
    return {
      real: psiSpace * Math.cos(phase),
      imag: psiSpace * Math.sin(phase),
      prob: psiSpace * psiSpace // Probability is |ψ|²
    };
  };
  
  // Calculate superposition wavefunction
  const calcSuperposition = (x, y, t) => {
    let realSum = 0;
    let imagSum = 0;
    
    // Normalization factor
    const norm = 1 / Math.sqrt(activeStates.length);
    
    activeStates.forEach(state => {
      const { nx, ny } = state;
      const waveFunc = calcWaveFunction(x, y, nx, ny, t);
      
      realSum += waveFunc.real * norm;
      imagSum += waveFunc.imag * norm;
    });
    
    return {
      real: realSum,
      imag: imagSum,
      prob: realSum * realSum + imagSum * imagSum
    };
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
      // Add state if it doesn't exist
      setActiveStates([...activeStates, { nx, ny }]);
    }
  };
  
  // Get color for states based on energy
  const getStateColor = (nx, ny) => {
    const energy = calcEnergy(nx, ny);
    const maxEnergy = 2 * maxQuantumNumber * maxQuantumNumber;
    return getColor(Math.min(energy / maxEnergy, 1), 1);
  };
  
  // Draw the main visualization
  const drawMainViz = () => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, boxSize, boxSize);
    
    // Current time
    const t = timeRef.current;
    setCurrentTime(t.toFixed(1));
    
    // Create image data
    const imageData = ctx.createImageData(boxSize, boxSize);
    const data = imageData.data;
    
    // Draw probability density map
    let maxProb = 0;
    let maxReal = 0;
    let maxImag = 0;
    
    // Pre-compute all values to find max for scaling
    const values = [];
    for (let py = 0; py < boxSize; py++) {
      const y = py / boxSize; // Normalize to [0, 1]
      
      for (let px = 0; px < boxSize; px++) {
        const x = px / boxSize; // Normalize to [0, 1]
        
        const wave = calcSuperposition(x, y, t);
        values.push({ px, py, ...wave });
        
        maxProb = Math.max(maxProb, wave.prob);
        maxReal = Math.max(maxReal, Math.abs(wave.real));
        maxImag = Math.max(maxImag, Math.abs(wave.imag));
      }
    }
    
    // Update the max value for the color scale
    let currentMax = 0;
    if (showProbability) {
      currentMax = maxProb;
    } else if (showRealPart) {
      currentMax = maxReal;
    } else if (showImaginaryPart) {
      currentMax = maxImag;
    }
    
    // Smooth max value transitions
    setMaxValue(prev => {
      const smoothingFactor = 0.1;
      return prev * (1 - smoothingFactor) + currentMax * smoothingFactor;
    });
    
    // Draw the selected visualization
    for (const val of values) {
      const { px, py, real, imag, prob } = val;
      const i = (py * boxSize + px) * 4;
      
      let color;
      if (showProbability) {
        const scaledProb = prob / maxProb;
        color = getColor(scaledProb);
      } else if (showRealPart || showImaginaryPart) {
        // For real and imaginary parts, use bipolar mapping centered at 0.5
        let value;
        if (showRealPart) {
          value = (real / maxReal) * 0.5 + 0.5; // Map [-max, max] to [0, 1]
        } else {
          value = (imag / maxImag) * 0.5 + 0.5; // Map [-max, max] to [0, 1]
        }
        color = getColor(value);
      } else {
        // Default to probability if nothing is selected
        const scaledProb = prob / maxProb;
        color = getColor(scaledProb);
      }
      
      // Parse the rgba color
      const rgba = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([.\d]+)\)/);
      if (rgba) {
        data[i] = parseInt(rgba[1]);     // R
        data[i + 1] = parseInt(rgba[2]); // G
        data[i + 2] = parseInt(rgba[3]); // B
        data[i + 3] = 255;               // A (fixed at 255 for full opacity)
      }
    }
    
    // Put the image data back
    ctx.putImageData(imageData, 0, 0);
    
    // Draw box border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, boxSize, boxSize);
    
    // Draw grid lines
    if (showGridLines) {
      const numLines = 10; // Number of grid lines in each direction
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      
      for (let i = 1; i < numLines; i++) {
        const pos = (i / numLines) * boxSize;
        
        // Vertical line
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, boxSize);
        ctx.stroke();
        
        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(0, pos);
        ctx.lineTo(boxSize, pos);
        ctx.stroke();
      }
    }
    
    // Draw the color scale
    drawColorScale();
  };
  
  // Draw the phasor grid
  const drawPhasorGrid = () => {
    const canvas = phasorGridRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, phasorGridSize, phasorGridSize);
    
    // Current time
    const t = timeRef.current;
    
    // Calculate cell size
    const cellSize = phasorGridSize / maxQuantumNumber;
    const phasorRadius = cellSize * 0.3; // Size of phasor circle
    
    // Add background grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= maxQuantumNumber; i++) {
      const pos = i * cellSize;
      
      // Vertical grid line
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, phasorGridSize);
      ctx.stroke();
      
      // Horizontal grid line
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(phasorGridSize, pos);
      ctx.stroke();
    }
    
    // Add quantum number labels
    ctx.fillStyle = '#fff';
    ctx.font = '14px "Segoe UI", Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // nx labels (top)
    for (let nx = 1; nx <= maxQuantumNumber; nx++) {
      const x = (nx - 0.5) * cellSize;
      ctx.fillText(`nx=${nx}`, x, 15);
    }
    
    // ny labels (left side)
    ctx.textAlign = 'right';
    for (let ny = 1; ny <= maxQuantumNumber; ny++) {
      const y = (ny - 0.5) * cellSize;
      ctx.fillText(`ny=${ny}`, 25, y);
    }
    
    // Draw title for the phasor grid
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px "Segoe UI", Helvetica, sans-serif';
    ctx.fillText('Quantum State Phasors', phasorGridSize / 2, phasorGridSize - 15);
    ctx.font = '14px "Segoe UI", Helvetica, sans-serif';
    ctx.fillText('(Click to Toggle States)', phasorGridSize / 2, phasorGridSize - 36);
    
    // Draw phasors for each quantum state
    for (let nx = 1; nx <= maxQuantumNumber; nx++) {
      for (let ny = 1; ny <= maxQuantumNumber; ny++) {
        const centerX = (nx - 0.5) * cellSize;
        const centerY = (ny - 0.5) * cellSize;
        
        // Determine if this state is active
        const isActive = activeStates.some(s => s.nx === nx && s.ny === ny);
        
        // Get state color based on energy
        const stateColor = getStateColor(nx, ny);
        
        // Draw phasor circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, phasorRadius, 0, 2 * Math.PI);
        ctx.strokeStyle = isActive ? stateColor : '#555';
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.fillStyle = isActive ? `${stateColor}30` : '#222'; // 30 is hex for ~20% opacity
        ctx.fill();
        ctx.stroke();
        
        // Draw energy value
        const energy = calcEnergy(nx, ny);
        ctx.fillStyle = isActive ? stateColor : '#777';
        ctx.font = isActive ? 'bold 12px "Segoe UI", Helvetica, sans-serif' : '12px "Segoe UI", Helvetica, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`E=${energy}`, centerX, centerY + phasorRadius + 15);
        
        // For active states, draw phasor arrow
        if (isActive && showPhaseInfo) {
          const phase = -energy * t; // Phase = -Et/ℏ (using normalized units)
          
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
  };
  
  // Draw color scale (horizontal)
  const drawColorScale = () => {
    const canvas = colorScaleRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, colorScaleWidth, colorScaleHeight);
    
    // Draw the gradient bar
    for (let i = 0; i < colorScaleWidth; i++) {
      const value = i / colorScaleWidth;
      ctx.fillStyle = getColor(value);
      ctx.fillRect(i, 0, 1, colorScaleHeight);
    }
    
    // Draw border around the bar
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, colorScaleWidth, colorScaleHeight);
    
    // Add labels based on visualization mode
    ctx.fillStyle = '#fff';
    ctx.font = '14px "Segoe UI", Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    if (showProbability) {
      ctx.fillText('0', 20, colorScaleHeight + 5);
      ctx.fillText('Probability Density', colorScaleWidth / 2, colorScaleHeight + 5);
      ctx.fillText('Max', colorScaleWidth - 20, colorScaleHeight + 5);
    } else if (showRealPart) {
      ctx.fillText('Min', 20, colorScaleHeight + 5);
      ctx.fillText('Real Part', colorScaleWidth / 2, colorScaleHeight + 5);
      ctx.fillText('Max', colorScaleWidth - 20, colorScaleHeight + 5);
      
      // Add zero marker in the middle
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(colorScaleWidth / 2, 0);
      ctx.lineTo(colorScaleWidth / 2, colorScaleHeight);
      ctx.stroke();
      ctx.fillText('0', colorScaleWidth / 2, colorScaleHeight + 5);
    } else if (showImaginaryPart) {
      ctx.fillText('Min', 20, colorScaleHeight + 5);
      ctx.fillText('Imaginary Part', colorScaleWidth / 2, colorScaleHeight + 5);
      ctx.fillText('Max', colorScaleWidth - 20, colorScaleHeight + 5);
      
      // Add zero marker in the middle
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(colorScaleWidth / 2, 0);
      ctx.lineTo(colorScaleWidth / 2, colorScaleHeight);
      ctx.stroke();
      ctx.fillText('0', colorScaleWidth / 2, colorScaleHeight + 5);
    }
  };

  // Animation loop
  const animate = () => {
    if (isAnimating) {
      timeRef.current += 0.05 * speed;
      drawMainViz();
      drawPhasorGrid();
    }
    animationRef.current = requestAnimationFrame(animate);
  };
  
  // Set up and clean up animation
  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating, speed, showProbability, showRealPart, showImaginaryPart, 
      activeStates, colorMapType, showGridLines, showPhaseInfo]);
  
  // Add click handler for the phasor grid
  useEffect(() => {
    const canvas = phasorGridRef.current;
    if (!canvas) return;
    
    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      // Adjust for the scale factor when canvas is rendered on screen
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      // Get mouse coordinates within the canvas
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      // Calculate cell size
      const cellSize = phasorGridSize / maxQuantumNumber;
      
      // Determine which cell was clicked
      const nx = Math.ceil(x / cellSize);
      const ny = Math.ceil(y / cellSize);
      
      // Toggle the state if it's within bounds and not in the label areas
      if (nx >= 1 && nx <= maxQuantumNumber && ny >= 1 && ny <= maxQuantumNumber) {
        toggleState(nx, ny);
      }
    };
    
    canvas.addEventListener('click', handleClick);
    return () => canvas.removeEventListener('click', handleClick);
  }, [activeStates, maxQuantumNumber]);
  
  // Cycle through colormaps
  const cycleColorMap = () => {
    const maps = Object.keys(colorMaps);
    const currentIndex = maps.indexOf(colorMapType);
    const nextIndex = (currentIndex + 1) % maps.length;
    setColorMapType(maps[nextIndex]);
  };
  
  // Toggle visualization mode (ensure only one is active)
  const setVisMode = (mode) => {
    setShowProbability(mode === 'probability');
    setShowRealPart(mode === 'real');
    setShowImaginaryPart(mode === 'imaginary');
  };
  
  // Get active states for display
  const getActiveStatesString = () => {
    let stateText = '';
    activeStates.forEach((state, idx) => {
      stateText += `(${state.nx},${state.ny})`;
      if (idx < activeStates.length - 1) stateText += ', ';
    });
    return stateText;
  };
  
  // Get current display mode name
  const getDisplayMode = () => {
    return showProbability ? 'Density' : 
           showRealPart ? 'Real Part' : 
           showImaginaryPart ? 'Imaginary Part' : 'Density';
  };
  
  return (
  <div className="container margin-bottom--xl">
    {/* Top section with main visualization and phasor grid side by side */}
    <div className="row">
      {/* Main visualization (2/3 width) */}
      <div className="col col--8">
        <div className="card margin-bottom--md">
          <div className="card__body">
            <canvas 
              ref={mainCanvasRef} 
              width={boxSize} 
              height={boxSize}
              style={{ width: '100%', display: 'block' }}
            />
          </div>
        </div>
        
        {/* Horizontal color scale */}
        <div className="card margin-bottom--md">
          <div className="card__body">
            <canvas
              ref={colorScaleRef}
              width={colorScaleWidth}
              height={colorScaleHeight}
              style={{ width: '100%', display: 'block' }}
            />
            <div className="text--center padding-top--sm">
              <span className="badge badge--primary">{getDisplayMode()}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Phasor grid (1/3 width) */}
      <div className="col col--4">
        <div className="card margin-bottom--md">
          <div className="card__body">
            <canvas 
              ref={phasorGridRef} 
              width={phasorGridSize} 
              height={phasorGridSize}
              style={{ width: '100%', display: 'block' }}
            />
          </div>
          <div className="card__footer">
            <small className="text--center">
              Click on a phasor circle to toggle quantum states
            </small>
          </div>
        </div>
        
        {/* Info panel */}
        <div className="card">
          <div className="card__header">
            <h3>Current Settings</h3>
          </div>
          <div className="card__body">
            <div className="row">
              <div className="col col--6">
                <p>
                  <strong>Mode:</strong> {getDisplayMode()}
                </p>
                <p>
                  <strong>t:</strong> {currentTime}&nbsp;
                </p>
              </div>
              <div className="col col--6">
                <p>
                  <strong>Active States:</strong> {getActiveStatesString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    {/* Controls section */}
    <div className="row margin-top--lg">
      {/* Animation controls */}
      <div className="col col--4">
        <div className="card">
          <div className="card__header">
            <h3>Animation</h3>
          </div>
          <div className="card__body">
            <div className="button-group button-group--block margin-bottom--sm">
              <button 
                onClick={() => setIsAnimating(!isAnimating)}
                className={clsx('button', isAnimating ? 'button--danger' : 'button--success')}
              >
                {isAnimating ? 'Pause' : 'Play'}
              </button>
            </div>
            
            <div className="margin-top--md">
              <label className="margin-bottom--sm">Speed: {speed.toFixed(1)}x</label>
              <input 
                type="range" 
                min="0.1" 
                max="3" 
                step="0.1"
                value={speed} 
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Display mode controls */}
      <div className="col col--4">
        <div className="card">
          <div className="card__header">
            <h3>Display Mode</h3>
          </div>
          <div className="card__body">
            <div className="checkbox-group">
              <div className="margin-bottom--sm">
                <input 
                  type="radio" 
                  id="probability" 
                  checked={showProbability} 
                  onChange={() => setVisMode('probability')}
                />
                <label htmlFor="probability" className="margin-left--sm">
                  Probability Density
                </label>
              </div>
              
              <div className="margin-bottom--sm">
                <input 
                  type="radio" 
                  id="real" 
                  checked={showRealPart} 
                  onChange={() => setVisMode('real')}
                />
                <label htmlFor="real" className="margin-left--sm">
                  Real Part
                </label>
              </div>
              
              <div className="margin-bottom--sm">
                <input 
                  type="radio" 
                  id="imaginary" 
                  checked={showImaginaryPart} 
                  onChange={() => setVisMode('imaginary')}
                />
                <label htmlFor="imaginary" className="margin-left--sm">
                  Imaginary Part
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Visualization options */}
      <div className="col col--4">
        <div className="card">
          <div className="card__header">
            <h3>Visualization Options</h3>
          </div>
          <div className="card__body">
            <div className="button-group button-group--block margin-bottom--sm">
              <button
                onClick={cycleColorMap}
                className="button button--primary"
              >
                Cycle Colormap
              </button>
            </div>
            
            <div className="checkbox-group margin-top--md">
              <div className="margin-bottom--sm">
                <input 
                  type="checkbox" 
                  id="gridLines"
                  checked={showGridLines} 
                  onChange={(e) => setShowGridLines(e.target.checked)}
                />
                <label htmlFor="gridLines" className="margin-left--sm">
                  Grid Lines
                </label>
              </div>
              
              <div className="margin-bottom--sm">
                <input 
                  type="checkbox" 
                  id="phaseInfo"
                  checked={showPhaseInfo} 
                  onChange={(e) => setShowPhaseInfo(e.target.checked)}
                />
                <label htmlFor="phaseInfo" className="margin-left--sm">
                  Show Phasors
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    {/* Explanation */}
    <div className="admonition admonition-info margin-top--lg">
      <div className="admonition-heading">
        <h3>About 2D Quantum Particle in a Box</h3>
      </div>
      <div className="admonition-content">
        <p>
          This visualization shows a quantum particle confined to a two-dimensional square box with infinite potential walls.
          The system has eigenstates characterized by two quantum numbers (nx, ny), corresponding to the number of nodes in each dimension.
        </p>
        <p>
          The energy of each state is <MathFormula math="E = \frac{\pi^2\hbar^2}{2mL^2}(n_x^2 + n_y^2)" />, meaning higher quantum numbers have higher energies.
          Each quantum state evolves in time with a phase factor <MathFormula math="e^{-iEt/\hbar}" />, with faster rotation for higher energy states.
        </p>
        <h4>Key features to observe:</h4>
        <ul>
          <li>Probability densities show characteristic nodal patterns based on quantum numbers</li>
          <li>Superposition of states creates interference patterns that evolve in time</li>
          <li>States with different energies evolve at different rates, creating complex dynamics</li>
          <li>The phasor grid shows the phase evolution of each active quantum state</li>
        </ul>
        <div className="alert alert--primary">
          <strong>Tip:</strong> Try activating multiple states with different quantum numbers to see interference effects
          and observe how the pattern evolves over time!
        </div>
        
        {/* Active states and energies */}
        {activeStates.length > 0 && (
          <div className="margin-top--md">
            <h4>Active States and Their Energies</h4>
            <ul>
              {activeStates.map((state) => (
                <li key={`${state.nx}-${state.ny}`}>
                  State (nx={state.nx}, ny={state.ny}): E = {getEnergyLabel(state.nx, state.ny)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  </div>
);
};

export default Particle2DBox;
