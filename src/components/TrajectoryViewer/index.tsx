import React, { useEffect, useRef, useState } from 'react';
import * as NGL from 'ngl';
import styles from './TrajectoryViewer.module.css';

interface TrajectoryViewerProps {
  trajectoryData?: string;  // Multi-frame XYZ data
  xyzFrames?: string[];     // Or already parsed frames
  moleculeName?: string;
  autoPlay?: boolean;
  initialSpeed?: number;
}

const TrajectoryViewer: React.FC<TrajectoryViewerProps> = ({ 
  trajectoryData,
  xyzFrames,
  moleculeName = 'Trajectory',
  autoPlay = false,
  initialSpeed = 100
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const nglStageRef = useRef<NGL.Stage | null>(null);
  const componentRef = useRef<any>(null);
  const trajectoryRef = useRef<any>(null);
  const playerRef = useRef<any>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [totalFrames, setTotalFrames] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackFPS, setPlaybackFPS] = useState<number>(30); // 30 FPS default
  const [representation, setRepresentation] = useState<string>('ball+stick');
  const [showHydrogens, setShowHydrogens] = useState(true);
  const [colorScheme, setColorScheme] = useState('element');
  const [frameEnergies, setFrameEnergies] = useState<(number | null)[]>([]);
  const [frameComments, setFrameComments] = useState<string[]>([]);
  const [minEnergy, setMinEnergy] = useState<number | null>(null);
  const [showOverlayControls, setShowOverlayControls] = useState<boolean>(false);

  // Initialize NGL Stage
  useEffect(() => {
    if (!stageRef.current) return;

    nglStageRef.current = new NGL.Stage(stageRef.current, {
      backgroundColor: 'white',
      quality: 'medium',
      clipNear: 0.000001,
      clipFar: 100,
      clipDist: 10
    });

    const handleResize = () => {
      if (nglStageRef.current) {
        nglStageRef.current.handleResize();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (nglStageRef.current) {
        nglStageRef.current.dispose();
      }
    };
  }, []);

  // Parse energy from comment line
  const parseEnergyFromComment = (comment: string): number | null => {
    // Skip normal mode comments entirely
    if (comment.includes('cm⁻¹') || comment.includes('cm-1') || comment.toLowerCase().includes('mode')) {
      return null;
    }
    
    // Look for patterns like "Energy=-228.523534709", "E = -150.234", or "E -1431.486658226695"
    const energyPatterns = [
      /Energy\s*=\s*(-?\d+\.?\d*)/i,
      /E\s*=\s*(-?\d+\.?\d*)/i,
      /E\s+(-?\d+\.?\d*)/i,  // ORCA format: "E -1431.486658226695"
      /energy:\s*(-?\d+\.?\d*)/i,
      /(-?\d+\.\d+)\s*(?:hartree|ha|au)/i
    ];
    
    for (const pattern of energyPatterns) {
      const match = comment.match(pattern);
      if (match) {
        const energy = parseFloat(match[1]);
        if (!isNaN(energy)) {
          return energy;
        }
      }
    }
    
    return null;
  };

  // Parse XYZ frames from multi-frame string
  const parseXYZFrames = (xyzText: string): string[] => {
    const lines = xyzText.trim().split('\n');
    const frames: string[] = [];
    const energies: (number | null)[] = [];
    const comments: string[] = [];
    let i = 0;
    
    while (i < lines.length) {
      const numAtoms = parseInt(lines[i]);
      if (isNaN(numAtoms)) {
        i++;
        continue;
      }
      
      const frameLines = lines.slice(i, i + numAtoms + 2);
      frames.push(frameLines.join('\n'));
      
      // Extract comment line and parse energy
      const commentLine = lines[i + 1] || '';
      comments.push(commentLine);
      const energy = parseEnergyFromComment(commentLine);
      console.log(`Comment: "${commentLine}" -> Energy: ${energy}`);
      energies.push(energy);
      
      i += numAtoms + 2;
    }
    
    // Debug logging
    console.log('Parsed energies:', energies);
    console.log('Comments:', comments);
    
    // Store parsed data
    setFrameEnergies(energies);
    setFrameComments(comments);
    
    // Find minimum energy for relative calculations
    const validEnergies = energies.filter(e => e !== null) as number[];
    console.log('Valid energies:', validEnergies);
    if (validEnergies.length > 0) {
      setMinEnergy(Math.min(...validEnergies));
      console.log('Set minEnergy to:', Math.min(...validEnergies));
    } else {
      setMinEnergy(null);
      console.log('Set minEnergy to: null');
    }
    
    return frames;
  };

  // Convert XYZ frames to multi-model PDB format
  const convertXYZToPDB = (frames: string[]): string => {
    let pdbContent = '';
    
    frames.forEach((xyzFrame, frameIndex) => {
      pdbContent += `MODEL     ${(frameIndex + 1).toString().padStart(4, ' ')}\n`;
      
      const lines = xyzFrame.trim().split('\n');
      const numAtoms = parseInt(lines[0]);
      
      for (let i = 0; i < numAtoms; i++) {
        const atomLine = lines[i + 2];
        const parts = atomLine.trim().split(/\s+/);
        const element = parts[0];
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        const z = parseFloat(parts[3]);
        
        const atomNum = (i + 1).toString().padStart(5, ' ');
        const atomName = element.padEnd(4, ' ');
        const resName = 'MOL';
        const chainID = 'A';
        const resNum = '1'.padStart(4, ' ');
        const xCoord = x.toFixed(3).padStart(8, ' ');
        const yCoord = y.toFixed(3).padStart(8, ' ');
        const zCoord = z.toFixed(3).padStart(8, ' ');
        const occupancy = '1.00'.padStart(6, ' ');
        const tempFactor = '0.00'.padStart(6, ' ');
        const elementSymbol = element.padStart(2, ' ');
        
        pdbContent += `ATOM  ${atomNum} ${atomName} ${resName} ${chainID}${resNum}    ${xCoord}${yCoord}${zCoord}${occupancy}${tempFactor}          ${elementSymbol}\n`;
      }
      
      pdbContent += 'ENDMDL\n';
    });
    
    pdbContent += 'END\n';
    return pdbContent;
  };

  // Load trajectory
  const loadTrajectory = async (frames: string[]) => {
    if (!nglStageRef.current) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      // Clear existing components
      nglStageRef.current.removeAllComponents();
      trajectoryRef.current = null;
      playerRef.current = null;
      
      // Convert to PDB format
      const pdbData = convertXYZToPDB(frames);
      const blob = new Blob([pdbData], { type: 'text/plain' });
      
      // Load with trajectory support
      const structure = await nglStageRef.current.loadFile(blob, { 
        ext: 'pdb',
        name: moleculeName,
        asTrajectory: true
      });
      
      componentRef.current = structure;
      setTotalFrames(frames.length);
      
      // Apply initial representation
      updateRepresentation();
      
      // Add trajectory controller
      const trajComp = structure.addTrajectory();
      trajectoryRef.current = trajComp;
      
      // Access the built-in player via trajectory.player
      if (trajComp.trajectory && trajComp.trajectory.player) {
        const player = trajComp.trajectory.player;
        playerRef.current = player;
        
        // Configure player settings
        const timeoutMs = Math.round(1000 / playbackFPS);
        if (player.parameters) {
          player.parameters.timeout = timeoutMs;
          player.parameters.mode = 'loop';
          player.parameters.step = 1;
          player.parameters.direction = 'forward';
        }
        
        // Listen for player events
        if (player.signals) {
          if (player.signals.startedRunning) {
            player.signals.startedRunning.add(() => {
              setIsPlaying(true);
            });
          }
          if (player.signals.haltedRunning) {
            player.signals.haltedRunning.add(() => {
              setIsPlaying(false);
            });
          }
        }
      }
      
      // Listen for frame changes
      if (trajComp.trajectory && trajComp.trajectory.signals && trajComp.trajectory.signals.frameChanged) {
        trajComp.trajectory.signals.frameChanged.add((frameIndex: number) => {
          setCurrentFrame(frameIndex);
        });
      }
      
      // Auto view
      nglStageRef.current.autoView();
      
      // Auto play if requested
      if (autoPlay && playerRef.current) {
        setTimeout(() => playerRef.current.play(), 500);
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading trajectory:', err);
      setError(`Failed to load trajectory: ${err.message}`);
      setIsLoading(false);
    }
  };

  // Update representation
  const updateRepresentation = () => {
    if (!componentRef.current) return;

    componentRef.current.removeAllRepresentations();

    const selection = showHydrogens ? 'all' : 'not hydrogen';
    const repParams: any = {
      colorScheme: colorScheme,
      sele: selection
    };

    switch (representation) {
      case 'ball+stick':
        repParams.radiusScale = 0.8;
        repParams.bondScale = 0.3;
        break;
      case 'line':
        repParams.linewidth = 2;
        break;
      case 'spacefill':
        repParams.radiusScale = 1.0;
        break;
      case 'licorice':
        repParams.bondScale = 0.5;
        repParams.multipleBond = true;
        break;
      case 'cartoon':
        // For proteins
        break;
    }

    componentRef.current.addRepresentation(representation, repParams);
    nglStageRef.current?.autoView();
  };

  // Load trajectory when data changes
  useEffect(() => {
    // Cleanup function to stop any ongoing operations
    const cleanup = () => {
      // Stop any playing trajectory
      if (playerRef.current) {
        if (typeof playerRef.current.pause === 'function') {
          try {
            playerRef.current.pause();
          } catch (e) {
            // Ignore errors if trajectory is already disposed
          }
        } else if (playerRef.current.intervalId) {
          clearInterval(playerRef.current.intervalId);
        }
      }
      setIsPlaying(false);
    };

    if (trajectoryData) {
      const frames = parseXYZFrames(trajectoryData);
      if (frames.length > 0) {
        cleanup();
        // Small delay to ensure cleanup is complete
        setTimeout(() => loadTrajectory(frames), 50);
      }
    } else if (xyzFrames && xyzFrames.length > 0) {
      cleanup();
      setTimeout(() => loadTrajectory(xyzFrames), 50);
    }

    // Return cleanup function for component unmount
    return cleanup;
  }, [trajectoryData, xyzFrames]);

  // Update representation when settings change
  useEffect(() => {
    updateRepresentation();
  }, [representation, showHydrogens, colorScheme]);

  // Playback controls
  const play = () => {
    if (playerRef.current && typeof playerRef.current.play === 'function') {
      playerRef.current.play();
    } else if (trajectoryRef.current && trajectoryRef.current.trajectory && totalFrames > 1) {
      setIsPlaying(true);
      
      // Store interval in playerRef for cleanup
      let frameIndex = currentFrame;
      const intervalId = setInterval(() => {
        try {
          if (trajectoryRef.current && trajectoryRef.current.trajectory) {
            frameIndex = (frameIndex + 1) % totalFrames;
            trajectoryRef.current.trajectory.setFrame(frameIndex);
            setCurrentFrame(frameIndex);
          } else {
            // If trajectory is disposed, stop the interval
            clearInterval(intervalId);
            setIsPlaying(false);
          }
        } catch (e) {
          // If we get an error (trajectory disposed), stop playing
          console.warn('Trajectory disposed during playback, stopping:', e.message);
          clearInterval(intervalId);
          setIsPlaying(false);
        }
      }, Math.round(1000 / playbackFPS));
      
      // Store interval for cleanup
      playerRef.current = { intervalId };
    }
  };

  const pause = () => {
    if (playerRef.current) {
      if (typeof playerRef.current.pause === 'function') {
        playerRef.current.pause();
      } else if (playerRef.current.intervalId) {
        clearInterval(playerRef.current.intervalId);
        playerRef.current = null;
      }
    }
    setIsPlaying(false);
  };

  const setFrame = (frame: number) => {
    try {
      if (trajectoryRef.current && trajectoryRef.current.trajectory) {
        trajectoryRef.current.trajectory.setFrame(frame);
      }
    } catch (e) {
      // Silently ignore errors from disposed trajectories
      console.warn('Cannot set frame on disposed trajectory:', e.message);
    }
  };

  const updateFPS = (newFPS: number) => {
    setPlaybackFPS(newFPS);
    
    if (playerRef.current && playerRef.current.parameters) {
      const timeoutMs = Math.round(1000 / newFPS);
      playerRef.current.parameters.timeout = timeoutMs;
      
      // Restart player with new speed if currently playing
      if (isPlaying && typeof playerRef.current.pause === 'function' && typeof playerRef.current.play === 'function') {
        playerRef.current.pause();
        playerRef.current.play();
      }
    }
  };

  const resetView = () => {
    if (nglStageRef.current) {
      nglStageRef.current.autoView(1000); // Add animation duration
    }
  };

  const toggleFullscreen = () => {
    if (nglStageRef.current) {
      nglStageRef.current.toggleFullscreen(stageRef.current);
    }
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if we have trajectory data and the viewer is visible
      if (totalFrames <= 1) return;
      
      // Ignore if user is typing in an input field
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement || 
          event.target instanceof HTMLSelectElement) {
        return;
      }

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          if (isPlaying) {
            pause();
          } else {
            play();
          }
          break;
        case 'ArrowLeft':
          event.preventDefault();
          setFrame(Math.max(0, currentFrame - 1));
          break;
        case 'ArrowRight':
          event.preventDefault();
          setFrame(Math.min(totalFrames - 1, currentFrame + 1));
          break;
        case 'Home':
          event.preventDefault();
          setFrame(0);
          break;
        case 'End':
          event.preventDefault();
          setFrame(totalFrames - 1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [totalFrames, currentFrame, isPlaying]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h4>{moleculeName}</h4>
        <div className={styles.controls}>
          <button 
            onClick={() => setShowOverlayControls(!showOverlayControls)} 
            className={styles.controlButton}
            title="Toggle display options"
          >
            Options
          </button>
          <button onClick={resetView} className={styles.controlButton}>
            Reset View
          </button>
          <button onClick={toggleFullscreen} className={styles.controlButton}>
            Fullscreen
          </button>
        </div>
      </div>

      {/* Viewer */}
      <div className={styles.viewer} ref={stageRef}>
        {isLoading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingSpinner}>Loading trajectory...</div>
          </div>
        )}
        {error && (
          <div className={styles.errorOverlay}>
            <div className={styles.errorMessage}>{error}</div>
          </div>
        )}
        
        {/* Frame info overlay */}
        {totalFrames > 0 && (
          <div className={styles.frameInfoOverlay}>
            <div className={styles.frameNumber}>
              Frame {currentFrame + 1}/{totalFrames}
            </div>
            {frameComments[currentFrame] && (
              <div className={styles.frameComment}>
                {frameComments[currentFrame]}
              </div>
            )}
            {(() => {
              console.log('Energy display check:', {
                currentFrameEnergy: frameEnergies[currentFrame],
                minEnergy,
                shouldShow: frameEnergies[currentFrame] !== null && frameEnergies[currentFrame] !== undefined && minEnergy !== null
              });
              return frameEnergies[currentFrame] !== null && frameEnergies[currentFrame] !== undefined && minEnergy !== null;
            })() && (
              <div className={styles.frameEnergy}>
                {(() => {
                  const currentEnergy = frameEnergies[currentFrame]!;
                  const relativeEnergy = currentEnergy - minEnergy;
                  const relativeKJ = relativeEnergy * 2625.5; // Convert Ha to kJ/mol
                  const sign = relativeEnergy >= 0 ? '+' : '';
                  return `${sign}${relativeKJ.toFixed(2)} kJ/mol`;
                })()}
              </div>
            )}
          </div>
        )}

        {/* Display controls overlay */}
        {showOverlayControls && (
          <div className={styles.displayControlsOverlay}>
            <div className={styles.overlayControls}>
              <div className={styles.overlayControlGroup}>
                <label className={styles.overlayLabel}>Style:</label>
                <select 
                  value={representation} 
                  onChange={(e) => setRepresentation(e.target.value)}
                  className={styles.overlaySelect}
                >
                  <option value="ball+stick">Ball & Stick</option>
                  <option value="line">Line</option>
                  <option value="spacefill">Spacefill</option>
                  <option value="licorice">Licorice</option>
                  <option value="cartoon">Cartoon</option>
                </select>
              </div>
              
              <div className={styles.overlayControlGroup}>
                <label className={styles.overlayLabel}>Color:</label>
                <select 
                  value={colorScheme}
                  onChange={(e) => setColorScheme(e.target.value)}
                  className={styles.overlaySelect}
                >
                  <option value="element">Element</option>
                  <option value="chainname">Chain</option>
                  <option value="residueindex">Residue</option>
                  <option value="bfactor">B-factor</option>
                </select>
              </div>
              
              <div className={styles.overlayControlGroup}>
                <input 
                  type="checkbox" 
                  checked={showHydrogens}
                  onChange={(e) => setShowHydrogens(e.target.checked)}
                  id="showH-overlay"
                  className={styles.overlayCheckbox}
                />
                <label htmlFor="showH-overlay" className={styles.overlayLabel}>
                  Show Hydrogens
                </label>
              </div>
              
              <div className={styles.overlayControlGroup}>
                <label className={styles.overlayLabel}>FPS:</label>
                <input
                  type="range"
                  min="10"
                  max="60"
                  step="5"
                  value={playbackFPS}
                  onChange={(e) => updateFPS(parseInt(e.target.value))}
                  className={styles.overlaySlider}
                />
                <span className={styles.overlayValue}>{playbackFPS}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Trajectory controls - horizontal layout */}
      {totalFrames > 1 && (
        <div className={styles.trajectoryControls}>
          <div className={styles.compactControls}>
            {/* Left side - Player controls */}
            <div className={styles.playerControls}>
              <button 
                onClick={() => setFrame(Math.max(0, currentFrame - 1))}
                className={styles.playerButton}
                disabled={currentFrame === 0}
                title="Previous frame"
              >
                ⏮
              </button>
              <button 
                onClick={isPlaying ? pause : play}
                className={`${styles.playerButton} ${styles.playPauseButton}`}
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? '⏸' : '⏵'}
              </button>
              <button 
                onClick={() => setFrame(Math.min(totalFrames - 1, currentFrame + 1))}
                className={styles.playerButton}
                disabled={currentFrame === totalFrames - 1}
                title="Next frame"
              >
                ⏭
              </button>
            </div>
            
            {/* Center/Right - Frame slider */}
            <div className={styles.frameControls}>
              <input
                type="range"
                min="0"
                max={totalFrames - 1}
                value={currentFrame}
                onChange={(e) => setFrame(parseInt(e.target.value))}
                className={styles.frameSlider}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrajectoryViewer;