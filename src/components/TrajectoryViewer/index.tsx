import React, { useEffect, useRef, useState } from 'react';
import * as NGL from 'ngl';
import { useVizTheme } from '../shared/viz';
import { Select, SliderWithInput, ToggleSwitch, VizButton } from '../shared/controls';
import styles from './TrajectoryViewer.module.css';

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [1, 0.5, 0];
};

// Custom unit cell representation that we can update manually
class CustomUnitCellRepresentation {
  private component: any;
  private stage: any;
  private shapeComponent: any = null;
  private frameUnitcells: any[] = [];
  private color: [number, number, number];
  
  constructor(component: any, stage: any, color: string) {
    this.component = component;
    this.stage = stage;
    this.color = hexToRgb(color);
  }
  
  setFrameUnitcells(frameComments: string[]) {
    this.frameUnitcells = frameComments.map(comment => {
      if (!comment.includes('Lattice=')) return null;
      
      const latticeMatch = comment.match(/Lattice="([^"]+)"/);
      if (!latticeMatch) return null;
      
      const latticeValues = latticeMatch[1].split(/\s+/).map(v => parseFloat(v));
      if (latticeValues.length !== 9) return null;
      
      // Parse lattice vectors: [a1 a2 a3 b1 b2 b3 c1 c2 c3]
      const a = [latticeValues[0], latticeValues[1], latticeValues[2]];
      const b = [latticeValues[3], latticeValues[4], latticeValues[5]];
      const c = [latticeValues[6], latticeValues[7], latticeValues[8]];
      
      return { a, b, c };
    });
  }
  
  updateFrame(frameIndex: number) {
    if (frameIndex < 0 || frameIndex >= this.frameUnitcells.length) return;
    
    const unitcell = this.frameUnitcells[frameIndex];
    if (!unitcell) return;
    
    // Remove existing unit cell visualization
    this.remove();
    
    // Create new unit cell visualization
    this.createUnitCellShape(unitcell);
  }
  
  createUnitCellShape(unitcell: any) {
    const { a, b, c } = unitcell;
    
    // Get structure center for positioning
    const structure = this.component.structure;
    const center = structure.center;
    
    // Calculate the 8 corners of the unit cell
    const corners = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0], 
      [0, 0, 1],
      [1, 1, 0],
      [1, 0, 1],
      [0, 1, 1],
      [1, 1, 1]
    ].map(([na, nb, nc]) => [
      center.x + na * a[0] + nb * b[0] + nc * c[0],
      center.y + na * a[1] + nb * b[1] + nc * c[1], 
      center.z + na * a[2] + nb * b[2] + nc * c[2]
    ]);
    
    // Create shape with unit cell edges
    const shape = new NGL.Shape('unitcell');
    
    // Define the 12 edges of a cube
    const edges = [
      [0, 1], [0, 2], [0, 3], // from origin
      [1, 4], [1, 5], // from (1,0,0)
      [2, 4], [2, 6], // from (0,1,0)
      [3, 5], [3, 6], // from (0,0,1)
      [4, 7], [5, 7], [6, 7] // to (1,1,1)
    ];
    
    // Add thick lines for each edge
    edges.forEach(([i, j]) => {
      shape.addWideline(
        corners[i] as [number, number, number],
        corners[j] as [number, number, number],
        this.color,
        5,
        'cell edge'
      );
    });
    
    // Add the shape to the stage
    this.shapeComponent = this.stage.addComponentFromObject(shape);
    this.shapeComponent.addRepresentation('buffer', {
      linewidth: 5, // Make lines thicker
      opacity: 0.8
    });
  }
  
  remove() {
    if (this.shapeComponent) {
      this.stage.removeComponent(this.shapeComponent);
      this.shapeComponent = null;
    }
  }
  
  setVisible(visible: boolean) {
    if (this.shapeComponent) {
      this.shapeComponent.setVisibility(visible);
    }
  }
}

// File type detection utilities
const getFileExtension = (filename: string): string => {
  return filename.toLowerCase().split('.').pop() || '';
};

const isStructureFormat = (extension: string): boolean => {
  return ['pdb', 'ent', 'pqr', 'mmcif', 'cif', 'mcif', 'gro', 'sdf', 'mol2', 'mmtf'].includes(extension);
};

const isTrajectoryFormat = (extension: string): boolean => {
  return ['dcd', 'nctraj', 'trr', 'xtc'].includes(extension);
};

const isMultiModelStructure = (extension: string): boolean => {
  return ['pdb', 'ent', 'pqr', 'mmcif', 'cif', 'mcif', 'gro', 'sdf', 'mol2', 'mmtf'].includes(extension);
};

// Utility class for converting XYZ trajectory data to PDB format
class PDBConverter {
  /**
   * Convert multiple XYZ frames to a single PDB trajectory file
   */
  static convertXYZTrajToPDB(xyzTrajectory: string, moleculeName = 'MOL'): string {
    const frames = this.parseXYZTrajectory(xyzTrajectory);
    return this.convertFramesToPDB(frames, moleculeName);
  }

  /**
   * Calculate unit cell volume from lattice parameters
   */
  private static calculateVolume(a: number, b: number, c: number, alpha: number, beta: number, gamma: number): number {
    // Convert angles to radians
    const alphaRad = alpha * Math.PI / 180;
    const betaRad = beta * Math.PI / 180;
    const gammaRad = gamma * Math.PI / 180;
    
    // Calculate volume using the formula for triclinic cells
    const cosAlpha = Math.cos(alphaRad);
    const cosBeta = Math.cos(betaRad);
    const cosGamma = Math.cos(gammaRad);
    
    const volume = a * b * c * Math.sqrt(
      1 + 2 * cosAlpha * cosBeta * cosGamma - 
      cosAlpha * cosAlpha - cosBeta * cosBeta - cosGamma * cosGamma
    );
    
    return volume;
  }

  /**
   * Parse lattice information from extended XYZ comment line
   */
  private static parseLatticeInfo(commentLine: string): { a: number; b: number; c: number; alpha: number; beta: number; gamma: number; volume: number } | null {
    const latticeMatch = commentLine.match(/Lattice="([^"]+)"/);
    if (!latticeMatch) return null;
    
    const latticeValues = latticeMatch[1].split(/\s+/).map(v => parseFloat(v));
    if (latticeValues.length !== 9) return null;
    
    // Parse lattice vectors: [a1 a2 a3 b1 b2 b3 c1 c2 c3]
    const a1 = latticeValues[0], a2 = latticeValues[1], a3 = latticeValues[2];
    const b1 = latticeValues[3], b2 = latticeValues[4], b3 = latticeValues[5];
    const c1 = latticeValues[6], c2 = latticeValues[7], c3 = latticeValues[8];
    
    // Calculate lattice parameters
    const a = Math.sqrt(a1*a1 + a2*a2 + a3*a3);
    const b = Math.sqrt(b1*b1 + b2*b2 + b3*b3);
    const c = Math.sqrt(c1*c1 + c2*c2 + c3*c3);
    
    // Calculate angles
    const alpha = Math.acos((b1*c1 + b2*c2 + b3*c3) / (b * c)) * 180 / Math.PI;
    const beta = Math.acos((a1*c1 + a2*c2 + a3*c3) / (a * c)) * 180 / Math.PI;
    const gamma = Math.acos((a1*b1 + a2*b2 + a3*b3) / (a * b)) * 180 / Math.PI;
    
    // Calculate volume
    const volume = this.calculateVolume(a, b, c, alpha, beta, gamma);
    
    return { a, b, c, alpha, beta, gamma, volume };
  }

  /**
   * Convert array of XYZ frame strings to PDB format
   * @param frames - Array of XYZ frame strings
   * @param moleculeName - Name for the molecule
   * @param bonds - Optional array of [atom1, atom2] pairs (1-indexed) for CONECT records
   */
  static convertFramesToPDB(frames: string[], moleculeName = 'MOL', bonds?: [number, number][]): string {
    let pdbContent = '';

    // Build CONECT records string if bonds provided
    let conectRecords = '';
    if (bonds && bonds.length > 0) {
      // Build connectivity map (atom -> list of bonded atoms)
      const connectivity = new Map<number, number[]>();
      for (const [a1, a2] of bonds) {
        if (!connectivity.has(a1)) connectivity.set(a1, []);
        if (!connectivity.has(a2)) connectivity.set(a2, []);
        connectivity.get(a1)!.push(a2);
        connectivity.get(a2)!.push(a1);
      }

      // Generate CONECT records
      for (const [atomIdx, bonded] of connectivity) {
        const sortedBonded = [...bonded].sort((a, b) => a - b);
        for (let i = 0; i < sortedBonded.length; i += 4) {
          const chunk = sortedBonded.slice(i, i + 4);
          let conectLine = `CONECT${atomIdx.toString().padStart(5)}`;
          for (const b of chunk) {
            conectLine += b.toString().padStart(5);
          }
          conectRecords += conectLine + '\n';
        }
      }
    }
    
    frames.forEach((xyzFrame, frameIndex) => {
      pdbContent += `MODEL     ${(frameIndex + 1).toString().padStart(4, ' ')}\n`;
      
      const lines = xyzFrame.trim().split('\n');
      const numAtoms = parseInt(lines[0]);
      const commentLine = lines[1] || '';
      
      // Parse lattice information if present
      const latticeInfo = this.parseLatticeInfo(commentLine);
      if (latticeInfo) {
        // Add CRYST1 record for unit cell information
        const a = latticeInfo.a.toFixed(3).padStart(9, ' ');
        const b = latticeInfo.b.toFixed(3).padStart(9, ' ');
        const c = latticeInfo.c.toFixed(3).padStart(9, ' ');
        const alpha = latticeInfo.alpha.toFixed(2).padStart(7, ' ');
        const beta = latticeInfo.beta.toFixed(2).padStart(7, ' ');
        const gamma = latticeInfo.gamma.toFixed(2).padStart(7, ' ');
        
        pdbContent += `CRYST1${a}${b}${c}${alpha}${beta}${gamma} P 1           1\n`;
      }
      
      for (let i = 0; i < numAtoms; i++) {
        const atomLine = lines[i + 2];
        const parts = atomLine.trim().split(/\s+/);
        const element = parts[0];
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        const z = parseFloat(parts[3]);
        
        const atomNum = (i + 1).toString().padStart(5, ' ');
        const atomName = element.padEnd(4, ' ');
        const resName = moleculeName.substring(0, 3).padEnd(3, ' ');
        const chainID = 'A';
        const resSeq = '1'.padStart(4, ' ');
        
        // Format coordinates to PDB standard
        const xStr = x.toFixed(3).padStart(8, ' ');
        const yStr = y.toFixed(3).padStart(8, ' ');
        const zStr = z.toFixed(3).padStart(8, ' ');
        
        // Create ATOM record following PDB format
        pdbContent += `ATOM  ${atomNum} ${atomName} ${resName} ${chainID}${resSeq}    ${xStr}${yStr}${zStr}  1.00  0.00           ${element.padEnd(2, ' ')}\n`;
      }

      // Add CONECT records (for first frame, NGL applies to all)
      if (frameIndex === 0 && conectRecords) {
        pdbContent += conectRecords;
      }

      pdbContent += 'ENDMDL\n';
    });

    pdbContent += 'END\n';
    return pdbContent;
  }

  /**
   * Parse multi-frame XYZ trajectory string into individual frames
   */
  private static parseXYZTrajectory(trajectory: string): string[] {
    const frames: string[] = [];
    const lines = trajectory.trim().split('\n');
    let i = 0;
    
    while (i < lines.length) {
      if (!lines[i] || lines[i].trim() === '') {
        i++;
        continue;
      }
      
      const numAtoms = parseInt(lines[i]);
      if (isNaN(numAtoms) || numAtoms <= 0) {
        i++;
        continue;
      }
      
      // Check if we have enough lines for this frame
      if (i + numAtoms + 1 >= lines.length) {
        break;
      }
      
      // Extract this frame
      const frameLines = lines.slice(i, i + numAtoms + 2);
      frames.push(frameLines.join('\n'));
      
      i += numAtoms + 2;
    }
    
    return frames;
  }
}

// Atom type info for LAMMPS-style simulations
interface AtomTypeInfo {
  type: number;
  mass: number;
}

// Element data from static JSON
interface ElementInfo {
  name: string;
  symbol: string;
  covalentRadius: number;
  vdwRadius: number;
  mass: number;
}

interface TrajectoryViewerProps {
  trajectoryData?: string;     // Multi-frame XYZ data
  xyzFrames?: string[];        // Or already parsed frames
  structureFile?: File;        // Structure file (PDB, GRO, etc.)
  trajectoryFile?: File;       // Trajectory file (DCD, TRR, XTC, etc.)
  structureUrl?: string;       // Or structure URL
  trajectoryUrl?: string;      // Or trajectory URL
  moleculeName?: string;
  autoPlay?: boolean;
  initialSpeed?: number;
  autoBond?: boolean;          // Whether NGL should calculate bonds (default: true)
  bonds?: [number, number][];  // Optional explicit bonds as [atom1, atom2] pairs (1-indexed)
  // Atom type mapping for LAMMPS-style simulations
  atomTypes?: AtomTypeInfo[];
  elementMapping?: Map<number, string>;
  onElementMappingChange?: (mapping: Map<number, string>) => void;
}

const TrajectoryViewer: React.FC<TrajectoryViewerProps> = ({
  trajectoryData,
  xyzFrames,
  structureFile,
  trajectoryFile,
  structureUrl,
  trajectoryUrl,
  moleculeName = 'Trajectory',
  autoPlay = false,
  initialSpeed = 100,
  autoBond = true,
  bonds,
  atomTypes,
  elementMapping,
  onElementMappingChange
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
  const [hasLattice, setHasLattice] = useState<boolean>(false);
  const [showUnitCell, setShowUnitCell] = useState<boolean>(false);
  const [supercellX, setSupercellX] = useState<number>(1);
  const [supercellY, setSupercellY] = useState<number>(1);
  const [supercellZ, setSupercellZ] = useState<number>(1);
  const [frameVolumes, setFrameVolumes] = useState<(number | null)[]>([]);
  const [customUnitCell, setCustomUnitCell] = useState<CustomUnitCellRepresentation | null>(null);
  const [elementData, setElementData] = useState<ElementInfo[]>([]);

  // Load element data from static JSON
  useEffect(() => {
    fetch('/data/elements.json')
      .then(res => res.json())
      .then((data: ElementInfo[]) => setElementData(data))
      .catch(err => console.warn('Failed to load element data:', err));
  }, []);

  const theme = useVizTheme();
  const inferBonds = autoBond ? 'auto' : 'none';

  // Initialize NGL Stage
  useEffect(() => {
    if (!stageRef.current) return;

    nglStageRef.current = new NGL.Stage(stageRef.current, {
      backgroundColor: theme.canvas,
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

    // Handle fullscreen changes — clear stale dimensions and let NGL recalculate
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && stageRef.current) {
        // Three.js / NGL sets explicit pixel dimensions on the container and
        // canvas during fullscreen (both inline styles AND HTML attributes).
        // Strip everything so the CSS flex layout drives sizing again.
        stageRef.current.style.width = '';
        stageRef.current.style.height = '';
        const canvas = stageRef.current.querySelector('canvas');
        if (canvas) {
          canvas.style.width = '';
          canvas.style.height = '';
          canvas.removeAttribute('width');
          canvas.removeAttribute('height');
        }
      }
      // Let the container reflow to its CSS size, then tell NGL to recalculate
      requestAnimationFrame(() => {
        handleResize();
        requestAnimationFrame(handleResize);
      });
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      if (nglStageRef.current) {
        nglStageRef.current.dispose();
      }
    };
  }, []);

  useEffect(() => {
    nglStageRef.current?.setParameters({ backgroundColor: theme.canvas });
  }, [theme.canvas]);

  // Parse energy from extended XYZ comment line
  const parseExtendedXYZEnergy = (comment: string): number | null => {
    // Extended XYZ format: Energy=value or E=value in the comment line
    const energyPatterns = [
      /Energy\s*=\s*(-?\d+\.?\d*)/i,
      /E\s*=\s*(-?\d+\.?\d*)/i,
      /energy:\s*(-?\d+\.?\d*)/i
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

  // Parse energy from ORCA trajectory comment line
  const parseORCAEnergy = (comment: string): number | null => {
    // ORCA format: "ORCA...blah... E -1431.486658226695"
    if (comment.toUpperCase().includes('ORCA')) {
      const match = comment.match(/E\s+(-?\d+\.?\d*)/i);
      if (match) {
        const energy = parseFloat(match[1]);
        if (!isNaN(energy)) {
          return energy;
        }
      }
    }
    return null;
  };

  // Parse energy from comment line using appropriate format
  const parseEnergyFromComment = (comment: string): number | null => {
    // Skip normal mode comments entirely
    if (comment.includes('cm⁻¹') || comment.includes('cm-1') || comment.toLowerCase().includes('mode')) {
      return null;
    }
    
    // Skip Frame= metadata lines
    if (comment.includes('Frame=')) {
      return null;
    }
    
    // Try ORCA format first (more specific)
    if (comment.toUpperCase().includes('ORCA')) {
      return parseORCAEnergy(comment);
    }
    
    // Try extended XYZ format if it contains energy-related keywords
    if (comment.includes('Energy=') || comment.includes('E=') || comment.includes('energy:')) {
      return parseExtendedXYZEnergy(comment);
    }
    
    // For lattice-containing lines, only parse energy if explicit energy keywords are present
    if (comment.includes('Lattice=')) {
      return parseExtendedXYZEnergy(comment);
    }
    
    // Default: don't try to parse energy from arbitrary lines
    return null;
  };

  // Parse volume from comment line if lattice information is present
  const parseVolumeFromComment = (comment: string): number | null => {
    // Parse lattice information directly
    const latticeMatch = comment.match(/Lattice="([^"]+)"/);
    if (!latticeMatch) return null;
    
    const latticeValues = latticeMatch[1].split(/\s+/).map(v => parseFloat(v));
    if (latticeValues.length !== 9) return null;
    
    // Parse lattice vectors: [a1 a2 a3 b1 b2 b3 c1 c2 c3]
    const a1 = latticeValues[0], a2 = latticeValues[1], a3 = latticeValues[2];
    const b1 = latticeValues[3], b2 = latticeValues[4], b3 = latticeValues[5];
    const c1 = latticeValues[6], c2 = latticeValues[7], c3 = latticeValues[8];
    
    // Calculate lattice parameters
    const a = Math.sqrt(a1*a1 + a2*a2 + a3*a3);
    const b = Math.sqrt(b1*b1 + b2*b2 + b3*b3);
    const c = Math.sqrt(c1*c1 + c2*c2 + c3*c3);
    
    // Calculate angles
    const alpha = Math.acos((b1*c1 + b2*c2 + b3*c3) / (b * c)) * 180 / Math.PI;
    const beta = Math.acos((a1*c1 + a2*c2 + a3*c3) / (a * c)) * 180 / Math.PI;
    const gamma = Math.acos((a1*b1 + a2*b2 + a3*b3) / (a * b)) * 180 / Math.PI;
    
    // Calculate volume using the formula for triclinic cells
    const alphaRad = alpha * Math.PI / 180;
    const betaRad = beta * Math.PI / 180;
    const gammaRad = gamma * Math.PI / 180;
    
    const cosAlpha = Math.cos(alphaRad);
    const cosBeta = Math.cos(betaRad);
    const cosGamma = Math.cos(gammaRad);
    
    const volume = a * b * c * Math.sqrt(
      1 + 2 * cosAlpha * cosBeta * cosGamma - 
      cosAlpha * cosAlpha - cosBeta * cosBeta - cosGamma * cosGamma
    );
    
    return volume;
  };

  // Parse XYZ frames from multi-frame string
  const parseXYZFrames = (xyzText: string): { frames: string[], comments: string[], hasLattice: boolean } => {
    const lines = xyzText.trim().split('\n');
    const frames: string[] = [];
    const energies: (number | null)[] = [];
    const comments: string[] = [];
    const volumes: (number | null)[] = [];
    let latticeDetected = false;
    let i = 0;
    
    while (i < lines.length) {
      const numAtoms = parseInt(lines[i]);
      if (isNaN(numAtoms)) {
        i++;
        continue;
      }
      
      const frameLines = lines.slice(i, i + numAtoms + 2);
      frames.push(frameLines.join('\n'));
      
      // Extract comment line and parse energy and volume
      const commentLine = lines[i + 1] || '';
      comments.push(commentLine);
      const energy = parseEnergyFromComment(commentLine);
      energies.push(energy);
      
      // Parse volume if lattice information is present
      const volume = parseVolumeFromComment(commentLine);
      volumes.push(volume);
      
      // Check for lattice information in the comment line
      if (commentLine.includes('Lattice=')) {
        latticeDetected = true;
      }
      
      i += numAtoms + 2;
    }
    
    // Store parsed data
    setFrameEnergies(energies);
    setFrameComments(comments);
    setFrameVolumes(volumes);
    setHasLattice(latticeDetected);
    
    // Find minimum energy for relative calculations
    const validEnergies = energies.filter(e => e !== null) as number[];
    if (validEnergies.length > 0) {
      setMinEnergy(Math.min(...validEnergies));
    } else {
      setMinEnergy(null);
    }
    
    return { frames, comments, hasLattice: latticeDetected };
  };

  // Load structure/trajectory files using NGL's native support
  const loadNativeTrajectory = async (structFile: File | string, trajFile?: File | string) => {
    if (!nglStageRef.current) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      // Clear existing components
      nglStageRef.current.removeAllComponents();
      trajectoryRef.current = null;
      playerRef.current = null;
      
      // Load structure file
      let structure: any;
      if (typeof structFile === 'string') {
        // URL
        structure = await nglStageRef.current.loadFile(structFile, {
          name: moleculeName,
          inferBonds
        }) as any;
      } else {
        // File object
        const ext = getFileExtension(structFile.name);
        structure = await nglStageRef.current.loadFile(structFile, {
          ext: ext,
          name: moleculeName,
          inferBonds
        }) as any;
      }
      
      componentRef.current = structure;
      
      // Apply initial representation
      updateRepresentation();
      
      // Load trajectory file if provided
      if (trajFile) {
        let frames: any;
        if (typeof trajFile === 'string') {
          // URL
          frames = await NGL.autoLoad(trajFile);
        } else {
          // File object - create blob URL
          const blobUrl = URL.createObjectURL(trajFile);
          try {
            frames = await NGL.autoLoad(blobUrl, {
              ext: getFileExtension(trajFile.name)
            });
          } finally {
            URL.revokeObjectURL(blobUrl);
          }
        }
        
        // Add trajectory to structure
        const trajComp = structure.addTrajectory(frames);
        trajectoryRef.current = trajComp;
        
        // Set up trajectory player
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
        
        // Set total frames from trajectory
        if (frames && frames.frameCount !== undefined) {
          setTotalFrames(frames.frameCount);
        } else if (trajComp.trajectory && trajComp.trajectory.frameCount !== undefined) {
          setTotalFrames(trajComp.trajectory.frameCount);
        }
      } else if (isMultiModelStructure(typeof structFile === 'string' ? 
                   getFileExtension(structFile) : 
                   getFileExtension(structFile.name))) {
        // Load as trajectory (multi-model structure)
        const trajComp = structure.addTrajectory();
        trajectoryRef.current = trajComp;
        
        // Set up trajectory player for multi-model structure
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
        
        // Set total frames from structure models
        if (structure.structure && structure.structure.modelStore && structure.structure.modelStore.count !== undefined) {
          setTotalFrames(structure.structure.modelStore.count);
        }
      }
      
      // Auto view
      nglStageRef.current.autoView();
      
      // Auto play if requested
      if (autoPlay && playerRef.current && totalFrames > 1) {
        setTimeout(() => {
          if (playerRef.current && typeof playerRef.current.play === 'function') {
            playerRef.current.play();
          }
        }, 500);
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading trajectory:', err);
      setError(`Failed to load trajectory: ${err.message}`);
      setIsLoading(false);
    }
  };

  // Load trajectory
  const loadTrajectory = async (frames: string[], comments: string[] = [], latticeDetected: boolean = false) => {
    if (!nglStageRef.current) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      // Clear existing components
      nglStageRef.current.removeAllComponents();
      trajectoryRef.current = null;
      playerRef.current = null;
      
      // Convert to PDB format using the new PDBConverter
      // Pass bonds if provided (from topology file)
      const pdbData = PDBConverter.convertFramesToPDB(frames, moleculeName, bonds);
      const blob = new Blob([pdbData], { type: 'text/plain' });
      
      // Load with trajectory support
      const structure = await nglStageRef.current.loadFile(blob, {
        ext: 'pdb',
        name: moleculeName,
        asTrajectory: true,
        inferBonds
      }) as any;
      
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
      
      // Create custom unit cell representation if we have lattice data
      if (latticeDetected && comments.length > 0) {
        const unitCell = new CustomUnitCellRepresentation(structure, nglStageRef.current, theme.series[1]);
        unitCell.setFrameUnitcells(comments);
        setCustomUnitCell(unitCell);
        setHasLattice(true);
      } else {
        setHasLattice(false);
      }
      
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
        repParams.aspectRatio = 1.5;
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

  // Generate supercell by replicating atoms with lattice translations
  const generateSupercell = (xyzFrames: string[]): string[] => {
    if (supercellX === 1 && supercellY === 1 && supercellZ === 1) {
      return xyzFrames; // No supercell needed
    }

    return xyzFrames.map(frame => {
      const lines = frame.trim().split('\n');
      const numAtoms = parseInt(lines[0]);
      const commentLine = lines[1] || '';
      
      // Parse lattice information
      const latticeMatch = commentLine.match(/Lattice="([^"]+)"/);
      if (!latticeMatch) {
        return frame; // No lattice info, return original
      }
      
      const latticeValues = latticeMatch[1].split(/\s+/).map(v => parseFloat(v));
      if (latticeValues.length !== 9) {
        return frame; // Invalid lattice, return original
      }
      
      // Lattice vectors: [a1 a2 a3 b1 b2 b3 c1 c2 c3]
      const a = [latticeValues[0], latticeValues[1], latticeValues[2]];
      const b = [latticeValues[3], latticeValues[4], latticeValues[5]];
      const c = [latticeValues[6], latticeValues[7], latticeValues[8]];
      
      // Parse original atoms
      const originalAtoms = [];
      for (let i = 0; i < numAtoms; i++) {
        const atomLine = lines[i + 2];
        const parts = atomLine.trim().split(/\s+/);
        originalAtoms.push({
          element: parts[0],
          x: parseFloat(parts[1]),
          y: parseFloat(parts[2]),
          z: parseFloat(parts[3])
        });
      }
      
      // Generate supercell atoms
      const supercellAtoms = [];
      for (let nx = 0; nx < supercellX; nx++) {
        for (let ny = 0; ny < supercellY; ny++) {
          for (let nz = 0; nz < supercellZ; nz++) {
            // Calculate translation vector
            const translation = [
              nx * a[0] + ny * b[0] + nz * c[0],
              nx * a[1] + ny * b[1] + nz * c[1],
              nx * a[2] + ny * b[2] + nz * c[2]
            ];
            
            // Add translated atoms
            originalAtoms.forEach(atom => {
              supercellAtoms.push({
                element: atom.element,
                x: atom.x + translation[0],
                y: atom.y + translation[1],
                z: atom.z + translation[2]
              });
            });
          }
        }
      }
      
      // Build supercell frame
      const supercellLines = [supercellAtoms.length.toString()];
      
      // Update comment line to reflect supercell
      const updatedComment = commentLine.replace(
        /Lattice="([^"]+)"/,
        (match, latticeStr) => {
          // Scale lattice vectors by supercell dimensions
          const scaledLattice = [
            a[0] * supercellX, a[1] * supercellX, a[2] * supercellX,
            b[0] * supercellY, b[1] * supercellY, b[2] * supercellY,
            c[0] * supercellZ, c[1] * supercellZ, c[2] * supercellZ
          ];
          return `Lattice="${scaledLattice.join(' ')}"`;
        }
      );
      supercellLines.push(updatedComment);
      
      // Add atom lines
      supercellAtoms.forEach(atom => {
        supercellLines.push(`${atom.element}  ${atom.x.toFixed(6)}  ${atom.y.toFixed(6)}  ${atom.z.toFixed(6)}`);
      });
      
      return supercellLines.join('\n');
    });
  };

  // Update unit cell visualization using our custom representation
  const updateCellVisualization = () => {
    if (!customUnitCell || !hasLattice) return;
    
    if (showUnitCell) {
      // Update the custom unit cell for the current frame
      customUnitCell.updateFrame(currentFrame);
      customUnitCell.setVisible(true);
    } else {
      customUnitCell.setVisible(false);
    }
  };

  // Remove unit cell visualization
  const removeCellVisualization = () => {
    if (customUnitCell) {
      customUnitCell.remove();
    }
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

    // Priority 1: Native structure/trajectory files
    if ((structureFile || structureUrl) && (trajectoryFile || trajectoryUrl || isMultiModelStructure(
      structureFile ? getFileExtension(structureFile.name) : 
      structureUrl ? getFileExtension(structureUrl) : ''
    ))) {
      cleanup();
      const structSource = structureFile || structureUrl!;
      const trajSource = trajectoryFile || trajectoryUrl;
      setTimeout(() => loadNativeTrajectory(structSource, trajSource), 50);
    }
    // Priority 2: XYZ trajectory data (legacy support)
    else if (trajectoryData) {
      const parsed = parseXYZFrames(trajectoryData);
      if (parsed.frames.length > 0) {
        cleanup();
        // Apply supercell generation if needed
        const processedFrames = generateSupercell(parsed.frames);
        // Small delay to ensure cleanup is complete
        setTimeout(() => loadTrajectory(processedFrames, parsed.comments, parsed.hasLattice), 50);
      }
    } 
    // Priority 3: Pre-parsed XYZ frames
    else if (xyzFrames && xyzFrames.length > 0) {
      cleanup();
      // For xyzFrames, we need to parse comments from the frames themselves
      // Convert frames back to text and parse
      const xyzText = xyzFrames.join('\n\n');
      const parsed = parseXYZFrames(xyzText);
      // Apply supercell generation if needed
      const processedFrames = generateSupercell(parsed.frames);
      setTimeout(() => loadTrajectory(processedFrames, parsed.comments, parsed.hasLattice), 50);
    }

    // Return cleanup function for component unmount
    return cleanup;
  }, [trajectoryData, xyzFrames, structureFile, trajectoryFile, structureUrl, trajectoryUrl, supercellX, supercellY, supercellZ]);

  // Update representation when settings change
  useEffect(() => {
    updateRepresentation();
  }, [representation, showHydrogens, colorScheme]);

  // Update cell visualization when settings change
  useEffect(() => {
    if (showUnitCell) {
      updateCellVisualization();
    } else {
      removeCellVisualization();
    }
  }, [showUnitCell, supercellX, supercellY, supercellZ, hasLattice, customUnitCell]);

  // Update unit cell when frame changes (if enabled)
  useEffect(() => {
    if (showUnitCell && hasLattice) {
      updateCellVisualization();
    }
  }, [currentFrame, showUnitCell, hasLattice, customUnitCell]);

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
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
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

  const energyText = (() => {
    const e = frameEnergies[currentFrame];
    if (e === null || e === undefined || minEnergy === null) return null;
    const relativeKJ = (e - minEnergy) * 2625.5; // Ha to kJ/mol
    return `${relativeKJ >= 0 ? '+' : ''}${relativeKJ.toFixed(2)} kJ/mol`;
  })();
  const volume = frameVolumes[currentFrame];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h4>{moleculeName}</h4>
        <div className={styles.controls}>
          <VizButton
            size="sm"
            variant={showOverlayControls ? 'primary' : 'secondary'}
            onClick={() => setShowOverlayControls(!showOverlayControls)}
            aria-pressed={showOverlayControls}
          >
            Options
          </VizButton>
          <VizButton size="sm" onClick={resetView}>Reset view</VizButton>
          <VizButton size="sm" onClick={toggleFullscreen}>Fullscreen</VizButton>
        </div>
      </div>

      {/* Viewer */}
      <div className={styles.viewer} ref={stageRef}>
        {isLoading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingSpinner}>Loading trajectory…</div>
          </div>
        )}
        {error && (
          <div className={styles.errorOverlay}>
            <div className={styles.errorMessage}>{error}</div>
          </div>
        )}

        {totalFrames > 0 && (
          <div className={styles.frameInfoOverlay}>
            <div className={styles.frameNumber}>
              Frame {currentFrame + 1} / {totalFrames}
            </div>
            {frameComments[currentFrame] && (
              <div className={styles.frameComment}>{frameComments[currentFrame]}</div>
            )}
            {energyText && <div className={styles.frameValue}>{energyText}</div>}
            {volume !== null && volume !== undefined && (
              <div className={styles.frameValue}>V = {volume.toFixed(2)} Å³</div>
            )}
          </div>
        )}

        {showOverlayControls && (
          <div className={styles.displayControlsOverlay}>
            <Select
              label="Style"
              value={representation}
              onChange={setRepresentation}
              options={[
                { value: 'ball+stick', label: 'Ball and stick' },
                { value: 'line', label: 'Line' },
                { value: 'spacefill', label: 'Spacefill' },
                { value: 'licorice', label: 'Licorice' },
                { value: 'cartoon', label: 'Cartoon' },
              ]}
            />
            <Select
              label="Colour"
              value={colorScheme}
              onChange={setColorScheme}
              options={[
                { value: 'element', label: 'Element' },
                { value: 'chainname', label: 'Chain' },
                { value: 'residueindex', label: 'Residue' },
                { value: 'bfactor', label: 'B-factor' },
              ]}
            />
            <ToggleSwitch label="Show hydrogens" checked={showHydrogens} onChange={setShowHydrogens} />
            <SliderWithInput
              label="Playback"
              value={playbackFPS}
              onChange={(v) => updateFPS(Math.round(v))}
              min={10} max={60} step={5} decimals={0} unit="fps"
            />

            {/* Atom type mapping - only show when atom types are available */}
            {atomTypes && atomTypes.length > 0 && elementMapping && onElementMappingChange && (
              <div className={styles.overlaySection}>
                <div className={styles.overlaySectionHeader}>Atom types</div>
                {atomTypes.map(({ type, mass }) => (
                  <div key={type} className={styles.overlayRow}>
                    <label className={styles.overlayLabel} htmlFor={`element-${type}`}>
                      Type {type}{mass > 0 ? ` (${mass.toFixed(1)})` : ''}
                    </label>
                    <input
                      id={`element-${type}`}
                      type="text"
                      list={`elements-list-${type}`}
                      value={elementMapping.get(type) || ''}
                      onChange={(e) => {
                        const newMapping = new Map(elementMapping);
                        newMapping.set(type, e.target.value);
                        onElementMappingChange(newMapping);
                      }}
                      placeholder="Element"
                      className={styles.overlayTextInput}
                    />
                    <datalist id={`elements-list-${type}`}>
                      {elementData.map(el => (
                        <option key={el.symbol} value={el.symbol}>
                          {el.name} ({el.mass.toFixed(2)})
                        </option>
                      ))}
                    </datalist>
                  </div>
                ))}
              </div>
            )}

            {/* Unit cell controls - only show when lattice is available */}
            {hasLattice && (
              <div className={styles.overlaySection}>
                <ToggleSwitch label="Show unit cell" checked={showUnitCell} onChange={setShowUnitCell} />
                {showUnitCell && (
                  <>
                    <SliderWithInput label="Supercell a" value={supercellX} onChange={(v) => setSupercellX(Math.round(v))} min={1} max={5} step={1} decimals={0} />
                    <SliderWithInput label="Supercell b" value={supercellY} onChange={(v) => setSupercellY(Math.round(v))} min={1} max={5} step={1} decimals={0} />
                    <SliderWithInput label="Supercell c" value={supercellZ} onChange={(v) => setSupercellZ(Math.round(v))} min={1} max={5} step={1} decimals={0} />
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.trajectoryControls}>
        <div className={styles.playerControls}>
          <button
            onClick={() => setFrame(Math.max(0, currentFrame - 1))}
            className={styles.playerButton}
            disabled={totalFrames <= 1 || currentFrame === 0}
            title="Previous frame (←)"
            aria-label="Previous frame"
          >
            <svg viewBox="0 0 16 16" aria-hidden><path d="M4 3h1.5v10H4zM13 3v10L6.5 8z" /></svg>
          </button>
          <button
            onClick={isPlaying ? pause : play}
            className={`${styles.playerButton} ${styles.playPauseButton}`}
            disabled={totalFrames <= 1}
            title={isPlaying ? 'Pause (space)' : 'Play (space)'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg viewBox="0 0 16 16" aria-hidden><path d="M4 3h3v10H4zM9 3h3v10H9z" /></svg>
            ) : (
              <svg viewBox="0 0 16 16" aria-hidden><path d="M4.5 2.5v11L13 8z" /></svg>
            )}
          </button>
          <button
            onClick={() => setFrame(Math.min(totalFrames - 1, currentFrame + 1))}
            className={styles.playerButton}
            disabled={totalFrames <= 1 || currentFrame === totalFrames - 1}
            title="Next frame (→)"
            aria-label="Next frame"
          >
            <svg viewBox="0 0 16 16" aria-hidden><path d="M10.5 3H12v10h-1.5zM3 3v10l6.5-5z" /></svg>
          </button>
        </div>
        <input
          type="range"
          min="0"
          max={Math.max(totalFrames - 1, 0)}
          value={currentFrame}
          onChange={(e) => setFrame(parseInt(e.target.value))}
          className={styles.frameSlider}
          disabled={totalFrames <= 1}
          aria-label="Frame"
        />
      </div>
    </div>
  );
};
export default TrajectoryViewer;