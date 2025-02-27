import React, { useState, useEffect, useRef } from 'react';
import _ from 'lodash';
import Button from './Button';
import LegendItem from './LegendItem';
import MathFormula from './MathFormula';
import styles from './QMVisualization.module.css';
import katex from 'katex';

const QuantumSystemsVisualization = () => {
  // State variables
  const [activeStates, setActiveStates] = useState([0]); // Array of active quantum numbers
  const [isAnimating, setIsAnimating] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [showReal, setShowReal] = useState(true);
  const [showImaginary, setShowImaginary] = useState(true);
  const [showProbability, setShowProbability] = useState(true);
  const [showPotential, setShowPotential] = useState(true);
  const [showIndividualStates, setShowIndividualStates] = useState(true);
  const [potentialType, setPotentialType] = useState('harmonic'); // 'harmonic' or 'infinite_well'
  
  // Canvas references
  const canvasRef = useRef(null);
  const phasorCanvasRef = useRef(null);
  const animationRef = useRef(null);
  const timeRef = useRef(0);
  
  // Constants
  const width = 800;
  const height = 400;
  const phasorHeight = 150;
  const xMin = -6;
  const xMax = 6;
  const yRange = 2;
  
  // Maximum number of available states
  const maxStates = 8;
  
  // Physics functions
  const factorial = (n) => {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
  };
  
  const hermite = (x, n) => {
    if (n === 0) return 1;
    if (n === 1) return 2 * x;
    if (n === 2) return 4 * x * x - 2;
    if (n === 3) return 8 * x * x * x - 12 * x;
    if (n === 4) return 16 * x * x * x * x - 48 * x * x + 12;
    if (n === 5) return 32 * x * x * x * x * x - 160 * x * x * x + 120 * x;
    if (n === 6) return 64 * Math.pow(x, 6) - 480 * Math.pow(x, 4) + 720 * x * x - 120;
    if (n === 7) return 128 * Math.pow(x, 7) - 1344 * Math.pow(x, 5) + 3360 * Math.pow(x, 3) - 1680 * x;
    // Higher states would need more terms
    return 0;
  };
  
  // Standard harmonic oscillator wavefunctions
  const psiHarmonic = (x, n) => {
    const prefactor = 1.0 / Math.sqrt(Math.pow(2, n) * factorial(n) * Math.sqrt(Math.PI));
    return prefactor * hermite(x, n) * Math.exp(-x * x / 2);
  };
  
  // Infinite square well (particle in a box) wavefunctions
  const psiInfiniteWell = (x, n) => {
    // Convert to the [0, L] domain for the well
    const L = xMax - xMin;
    const xNormalized = (x - xMin) / L;
    
    // Check if within the well boundaries (add a small buffer for numerical stability)
    if (xNormalized < -0.01 || xNormalized > 1.01) {
      return 0;
    }
    
    // n+1 because we start from n=0 but the quantum number in formulas is traditionally 1-based
    const nWell = n + 1;
    
    // Wavefunction for infinite square well: sqrt(2/L) * sin(n*pi*x/L)
    return Math.sqrt(2/L) * Math.sin(nWell * Math.PI * xNormalized);
  };
  
  // Potential functions
  const harmonicPotential = (x) => 0.5 * x * x;
  
  // Infinite square well potential
  const infiniteWellPotential = (x) => {
    // Handle the potential at the boundaries of the well
    const L = xMax - xMin;
    const xNormalized = (x - xMin) / L;
    
    // Return very high values at boundaries to represent "infinity"
    if (xNormalized < 0 || xNormalized > 1) {
      return 10; // High enough to be off the scale
    }
    
    // Inside the well, potential is zero
    return 0;
  };
  
  const potential = (x) => {
    switch(potentialType) {
      case 'harmonic': return harmonicPotential(x);
      case 'infinite_well': return infiniteWellPotential(x);
      default: return harmonicPotential(x);
    }
  };
  
  const energy = (n) => {
    // For harmonic potential, energy is n + 0.5
    switch(potentialType) {
      case 'harmonic': 
        return n + 0.5;
      case 'infinite_well': 
        // For infinite well: E_n = (n+1)^2 * π^2 / (2L^2) where L is the well width
        // We'll normalize to make it comparable to the harmonic oscillator energy scale
        const nWell = n + 1; // Because we start from n=0 but the formula uses n=1,2,3...
        const L = xMax - xMin;
        return (nWell * nWell) / (8 * L * L);
      default:
        return n + 0.5;
    }
  };

  // Energy label function that returns formatted math
  const getEnergyLabel = (n: number): React.ReactNode => {
    switch(potentialType) {
      case 'harmonic':
        return <MathFormula math={`n=${n},E=(${n} + \\frac{1}{2})\\hbar\\omega`} />;
      case 'infinite_well': {
        // For the infinite well with normalized energies
        // n+1 because we index from 0 but quantum numbers start at 1
        const nWell = n + 1;
        return <MathFormula math={`n=${n},E=\\frac{${nWell}^2 h}{8mL^2}`} />;
      }
      default:
        return `${(n + 0.5).toFixed(1)}`;
    }
  };
  
  // Get the appropriate wavefunction based on potential type
  const psi = (x, n) => {
    switch(potentialType) {
      case 'infinite_well':
        return psiInfiniteWell(x, n);
      case 'harmonic':
      default:
        return psiHarmonic(x, n);
    }
  };
  
  const psiT = (x, n, t) => {
    const staticPsi = psi(x, n);
    const E = energy(n);
    const phase = -E * t;
    return {
      real: staticPsi * Math.cos(phase),
      imag: staticPsi * Math.sin(phase),
      phase: phase
    };
  };
  
  // Calculate superposition of states
  const superpositionPsiT = (x, states, t) => {
    let realSum = 0;
    let imagSum = 0;
    
    // Equal weight to all states (could be modified to have coefficients)
    const normalization = 1 / Math.sqrt(states.length);
    
    states.forEach(n => {
      const waveFn = psiT(x, n, t);
      realSum += waveFn.real * normalization;
      imagSum += waveFn.imag * normalization;
    });
    
    return {
      real: realSum,
      imag: imagSum,
      prob: realSum * realSum + imagSum * imagSum
    };
  };
  
  // Define color scheme for quantum states
  const getStateColor = (n) => {
    const stateColors = [
      '#0048BA', // Blue
      '#DC143C', // Crimson
      '#228B22', // Forest Green
      '#FF8C00', // Dark Orange
      '#8A2BE2', // Blue Violet
      '#008B8B', // Teal
      '#FF1493', // Deep Pink
      '#8B4513'  // Saddle Brown
    ];
    return stateColors[n % stateColors.length];
  };
  
  // Toggle a quantum state on/off
  const toggleState = (n) => {
    if (activeStates.includes(n)) {
      if (activeStates.length > 1) { // Prevent having no states
        setActiveStates(activeStates.filter(state => state !== n));
      }
    } else {
      setActiveStates([...activeStates, n]);
    }
  };
  
  const cyclePotentialType = () => {
    const types = ['harmonic', 'infinite_well'];
    const currentIndex = types.indexOf(potentialType);
    const nextIndex = (currentIndex + 1) % types.length;
    setPotentialType(types[nextIndex]);
  };
  
  // Drawing main canvas
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    
    // Draw coordinate axes
    ctx.strokeStyle = '#ccc';
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();
    
    // Current time
    const t = timeRef.current;
    
    // Sample points for x-axis
    const points = _.range(0, width, 2).map(px => {
      const x = xMin + (xMax - xMin) * (px / width);
      return {
        x,
        px,
        py: height / 2
      };
    });
    
    // Calculate individual state wavefunctions
    const stateWavefunctions = activeStates.map(n => {
      return points.map(p => {
        const wave = psiT(p.x, n, t);
        return {
          ...p,
          real: wave.real,
          imag: wave.imag,
          prob: wave.real * wave.real + wave.imag * wave.imag,
          phase: wave.phase
        };
      });
    });
    
    // Calculate superposition wavefunction
    const superpositionPoints = points.map(p => {
      const wave = superpositionPsiT(p.x, activeStates, t);
      return {
        ...p,
        real: wave.real,
        imag: wave.imag,
        prob: wave.prob,
        pot: potential(p.x)
      };
    });
    
    // Scale for visualization
    const maxProb = Math.max(...superpositionPoints.map(p => p.prob), 0.1);
    const maxAmp = Math.max(...superpositionPoints.map(p => Math.max(Math.abs(p.real), Math.abs(p.imag))), 0.1);
    const maxPot = Math.max(...superpositionPoints.map(p => p.pot));
    
    const scale = (height / 2) / Math.max(yRange, maxAmp);
    const probScale = (height / 3) / maxProb;
    const potScale = (height / 3) / maxPot;
    
    // Draw potential
    if (showPotential) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      superpositionPoints.forEach((p, i) => {
        const y = p.py - p.pot * potScale;
        if (i === 0) ctx.moveTo(p.px, y);
        else ctx.lineTo(p.px, y);
      });
      ctx.stroke();
    }
    
    // Draw individual state wavefunctions if enabled
    if (showIndividualStates) {
      stateWavefunctions.forEach((statePoints, idx) => {
        const n = activeStates[idx];
        const color = getStateColor(n);
        
        if (showReal) {
          ctx.strokeStyle = `${color}50`; // 50 is hex for ~30% opacity
          ctx.lineWidth = 2;
          ctx.beginPath();
          statePoints.forEach((p, i) => {
            const y = p.py - p.real * scale;
            if (i === 0) ctx.moveTo(p.px, y);
            else ctx.lineTo(p.px, y);
          });
          ctx.stroke();
        }
      });
    }
    
    // Draw superposition real part
    if (showReal) {
      ctx.strokeStyle = 'rgba(0, 72, 186, 0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      superpositionPoints.forEach((p, i) => {
        const y = p.py - p.real * scale;
        if (i === 0) ctx.moveTo(p.px, y);
        else ctx.lineTo(p.px, y);
      });
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    
    // Draw superposition imaginary part
    if (showImaginary) {
      ctx.strokeStyle = 'rgba(220, 20, 60, 0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      superpositionPoints.forEach((p, i) => {
        const y = p.py - p.imag * scale;
        if (i === 0) ctx.moveTo(p.px, y);
        else ctx.lineTo(p.px, y);
      });
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    
    // Draw superposition probability density
    if (showProbability) {
      ctx.strokeStyle = 'rgba(34, 139, 34, 0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      superpositionPoints.forEach((p, i) => {
        const y = p.py - p.prob * probScale;
        if (i === 0) ctx.moveTo(p.px, y);
        else ctx.lineTo(p.px, y);
      });
      ctx.stroke();
      ctx.lineWidth = 1;
      
      // Fill area under probability curve
      ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
      ctx.lineTo(superpositionPoints[superpositionPoints.length - 1].px, height / 2);
      ctx.lineTo(superpositionPoints[0].px, height / 2);
      ctx.fill();
    }
    
    // Add labels with improved styling
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px "Segoe UI", Helvetica, sans-serif';
    ctx.fillText(`Active states: ${activeStates.join(', ')}`, 15, 25);
    
    // Time indicator with slightly nicer styling
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px "Segoe UI", Helvetica, sans-serif';
    ctx.fillText(`t = ${t.toFixed(1)}`, width - 85, 25);
  };
  
  // Draw phasor diagram
  const drawPhasors = () => {
    const canvas = phasorCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, phasorHeight);
    
    // Current time
    const t = timeRef.current;
    
    // Draw phasor circles
    const centerY = phasorHeight / 2;
    const radius = 20;
    const spacing = width / (maxStates + 1);
    
    // Draw grid line
    ctx.strokeStyle = '#eee';
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    
    // Draw phasor circles and phasors with improved styling
    for (let n = 0; n < maxStates; n++) {
      const centerX = spacing * (n + 1);
      
      // Use consistent color scheme
      const stateColor = getStateColor(n);
      const isActive = activeStates.includes(n);
      
      // Draw circle with light fill for inactive states
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = isActive ? stateColor : '#ccc';
      ctx.lineWidth = isActive ? 2 : 1;
      
      // Add subtle fill
      if (isActive) {
        ctx.fillStyle = `${stateColor}20`; // 20 is hex for 12% opacity
      } else {
        ctx.fillStyle = '#f5f5f5';
      }
      ctx.fill();
      ctx.stroke();
      
      // Label the state with improved font
      ctx.fillStyle = isActive ? '#333' : '#999';
      ctx.font = isActive ? 'bold 14px "Segoe UI", Helvetica, sans-serif' : '14px "Segoe UI", Helvetica, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`n=${n}`, centerX, centerY + radius + 16);
      
      // Draw phasor arrow for active states
      if (isActive) {
        const E = energy(n);
        const Elabel = getEnergyLabel(n);
        const phase = -E * t;
        
        const arrowX = centerX + radius * Math.cos(phase);
        const arrowY = centerY - radius * Math.sin(phase);
        
        // Draw track circle (faded)
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = `${stateColor}40`; // 40 is hex for 25% opacity
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Draw phasor line
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(arrowX, arrowY);
        ctx.strokeStyle = stateColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        
        ctx.fillStyle = stateColor;
        ctx.fill();
        
        // Show energy text with improved styling
        ctx.fillStyle = stateColor;
        ctx.font = 'bold 14px "Segoe UI", Helvetica, sans-serif';
        ctx.textAlign = 'center';
        
        // Add subtle text shadow for better contrast
        ctx.shadowColor = 'white';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        if(E < 0.1) {
          ctx.fillText(`E=${E.toExponential(2)}`, centerX, centerY - radius - 7);
        }
        else {
          ctx.fillText(`E=${E.toFixed(2)}`, centerX, centerY - radius - 7);
        }
        
        // Reset shadow
        ctx.shadowBlur = 0;
      }
    }
  };
  
  // Animation loop
  const animate = () => {
    if (isAnimating) {
      timeRef.current += 0.1 * speed;
      draw();
      drawPhasors();
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
  }, [isAnimating, speed, showReal, showImaginary, showProbability, showPotential, 
      activeStates, showIndividualStates, potentialType]);
  
  // Add click handler to the phasor canvas
  useEffect(() => {
    const canvas = phasorCanvasRef.current;
    if (!canvas) return;
    
    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      // Adjust for the scale factor when canvas is rendered on screen
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      // Get mouse coordinates within the canvas
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      // Check if click is within any state circle
      const centerY = phasorHeight / 2;
      const radius = 20;
      const spacing = width / (maxStates + 1);
      
      for (let n = 0; n < maxStates; n++) {
        const centerX = spacing * (n + 1);
        const distance = Math.sqrt((x - centerX)**2 + (y - centerY)**2);
        
        if (distance <= radius * 1.2) { // Slightly larger hit area for better UX
          toggleState(n);
          break;
        }
      }
    };
    
    canvas.addEventListener('click', handleClick);
    return () => canvas.removeEventListener('click', handleClick);
  }, [activeStates, maxStates]);
  
  const getPotentialTypeDisplayName = () => {
    switch(potentialType) {
      case 'harmonic': return 'Harmonic Oscillator';
      case 'infinite_well': return 'Infinite Square Well (1D Box)';
      default: return 'Harmonic Oscillator';
    }
  };
  
return (
  <div className={styles.container}>
    <h2 className={styles.title}>
      Quantum {getPotentialTypeDisplayName()} Visualization
    </h2>
    
    {/* Canvas and Legend container with flex */}
    <div className={styles.flexContainer}>
      {/* Main Canvas */}
      <div className={styles.canvasContainer}>
        <canvas 
          ref={canvasRef} 
          width={width} 
          height={height}
          className={styles.canvas}
        />
      </div>
      
      {/* Right side legend */}
      <div className={styles.legendContainer}>
        <h3 className={styles.legendTitle}>Legend</h3>
        <div className={styles.legendItems}>
          <LegendItem 
            color="rgba(0, 72, 186, 0.9)" 
            text="Real" 
            active={showReal}
            onClick={() => setShowReal(!showReal)}
          />
          <LegendItem 
            color="rgba(220, 20, 60, 0.9)" 
            text="Imaginary" 
            active={showImaginary}
            onClick={() => setShowImaginary(!showImaginary)}
          />
          <LegendItem 
            color="rgba(34, 139, 34, 0.9)" 
            text="Density" 
            active={showProbability}
            onClick={() => setShowProbability(!showProbability)}
          />
          <LegendItem 
            color="rgba(0, 0, 0, 0.6)" 
            text="Potential" 
            active={showPotential}
            onClick={() => setShowPotential(!showPotential)}
          />
          <LegendItem 
            color="rgba(255, 0, 0, 0.3)" 
            text="Individual States" 
            active={showIndividualStates}
            onClick={() => setShowIndividualStates(!showIndividualStates)}
          />
        </div>
      </div>
    </div>
    
    {/* Phasor Canvas */}
    <div className={styles.phasorContainer}>
      <canvas 
        ref={phasorCanvasRef} 
        width={width} 
        height={phasorHeight}
        className={styles.canvas}
      />
      <div className={styles.phasorMessage}>
        <span>Click on any phasor circle to toggle that quantum state on/off</span>
      </div>
    </div>
    
    {/* Animation Controls */}
    <div className={styles.controlsContainer}>
      <div className={styles.controlsRow}>
        <Button
          onClick={() => setIsAnimating(!isAnimating)}
          variant={isAnimating ? "danger" : "success"}
        >
          {isAnimating ? 'Pause' : 'Play'}
        </Button>
        
        <div className={styles.rangeContainer}>
          <label className={styles.rangeLabel}>Speed:</label>
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
      <Button
        onClick={cyclePotentialType}
        variant="primary"
      >
        Switch to {potentialType === 'harmonic' ? 'Particle in a Box' : 'Harmonic oscillator'}
      </Button>

      </div>
    </div>

    <div className={styles.explanation}>
      <h3 className={styles.explanationTitle}>{getPotentialTypeDisplayName()}</h3>
      {potentialType === 'harmonic' && (
        <div>
          <p className={styles.explanationText}>
            This visualization demonstrates the quantum harmonic oscillator, which models a particle in a parabolic potential well (like a mass on a spring). 
          </p>
          <p>
            Each quantum state has energy <MathFormula math="E_n = (n + \frac{1}{2})\hbar\omega" inline={true} /> where <MathFormula math="n = 0, 1, 2\ldots"/>
          </p>
          <p className={styles.explanationText}>
            The harmonic oscillator is one of the most important quantum systems because many potentials can be approximated as harmonic near their minimum. 
            The wavefunctions involve Hermite polynomials multiplied by a Gaussian envelope.
          </p>
          <p className={styles.explanationText}>
            Active states and their energies:
            <ul>
              {activeStates.map(n => (
                <li key={n}>
                  {getEnergyLabel(n)}
                </li>
              ))}
            </ul>
          </p>
        </div>
      )}

      {/* For the infinite well explanation */}
      {potentialType === 'infinite_well' && (
        <div>
          <p className={styles.explanationText}>
            The infinite square well (particle in a box) describes a particle confined to a region with infinitely high barriers at the boundaries. 
          </p>
          <p>
            The energy levels are <MathFormula math="E_n = \frac{n^2 h}{8mL^2}" /> where n = 1, 2, 3... and L is the box width.
          </p>
          <p className={styles.explanationText}>
            Unlike the harmonic oscillator, the energy levels grow quadratically with n, resulting in unique interference patterns when states are superimposed.
            The wavefunctions are sinusoidal with nodes that correspond to the quantum number.
          </p>

          <p className={styles.explanationText}>
            Active states and their energies:
            <ul>
              {activeStates.map(n => (
                <li key={n}>
                  {getEnergyLabel(n)}
                </li>
              ))}
            </ul>
          </p>

        </div>
      )}
      
      <p className={styles.explanationText}>
        Quantum superposition allows multiple states to exist simultaneously, with each evolving at its own phase velocity proportional to its energy. 
        The phasor diagram shows the phase of each active state as time progresses.
      </p>
      
      <div className={styles.explanationNote}>
        Try activating multiple states and observe how they combine to form complex probability distributions!
        Click directly on the phasor circles to toggle states on and off.
      </div>
    </div>
  </div>
);
};

export default QuantumSystemsVisualization;
