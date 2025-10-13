import React, { useEffect, useRef, useState } from 'react';
import * as NGL from 'ngl';
import styles from './MoleculeViewer.module.css';
import OrbitalItem from './OrbitalItem';

interface MoleculeViewerProps {
  xyzData: string;
  moleculeName?: string;
  wavefunctionResults?: any;
  cubeResults?: Map<string, string>;
  cubeGridInfo?: any;
  cubeSettings?: any;
  onRequestCubeComputation?: (cubeType: string, orbitalIndex?: number, gridSteps?: number, spin?: 'alpha' | 'beta') => void;
  onOpenCubeSettings?: () => void;
}

type RepresentationType = 'ball+stick' | 'line' | 'spacefill' | 'surface' | 'cartoon' | 'licorice';

const MoleculeViewer: React.FC<MoleculeViewerProps> = ({
  xyzData,
  moleculeName = 'Molecule',
  wavefunctionResults,
  cubeResults,
  cubeGridInfo,
  cubeSettings,
  onRequestCubeComputation,
  onOpenCubeSettings
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const nglStageRef = useRef<NGL.Stage | null>(null);
  const componentRef = useRef<any>(null);
  const moComponentRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [representation, setRepresentation] = useState<RepresentationType>('ball+stick');
  const [showHydrogens, setShowHydrogens] = useState(true);
  const [colorScheme, setColorScheme] = useState('element');
  const [selectedOrbitals, setSelectedOrbitals] = useState<Set<number>>(new Set());
  const [isosurfaceValue, setIsosurfaceValue] = useState<number>(0.01);
  const [showBothPhases, setShowBothPhases] = useState<boolean>(false);
  const [opacity, setOpacity] = useState<number>(1.0);
  const [isComputingMO, setIsComputingMO] = useState(false);
  // Initialize orbital colors from localStorage
  const [orbitalColors, setOrbitalColors] = useState<Map<number, string>>(() => {
    try {
      const savedColors = localStorage.getItem('orbitalColors');
      if (savedColors) {
        const parsed = JSON.parse(savedColors);
        return new Map(Object.entries(parsed).map(([k, v]) => [parseInt(k), v as string]));
      }
    } catch (error) {
      console.warn('Failed to load orbital colors from localStorage:', error);
    }
    return new Map();
  });
  const [gridSteps, setGridSteps] = useState<number>(cubeSettings?.gridSteps || 50);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const colorChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMOSettingsExpanded, setIsMOSettingsExpanded] = useState<boolean>(true);
  const [showGridBounds, setShowGridBounds] = useState<boolean>(false);
  const gridBoundsComponentRef = useRef<any>(null);
  const [lastGridInfo, setLastGridInfo] = useState<any>(null);
  const [orbitalRenderStyle, setOrbitalRenderStyle] = useState<'surface' | 'wireframe' | 'dot' | 'slice'>('surface');
  const [isOrbitalPanelOpen, setIsOrbitalPanelOpen] = useState<boolean>(false);
  const [sliceDirection, setSliceDirection] = useState<'x' | 'y' | 'z'>('z');
  const [slicePosition, setSlicePosition] = useState<number>(0);
  const [colorScale, setColorScale] = useState<string>('rwb');
  const [colorRange, setColorRange] = useState<[number, number]>([0, 0.05]);
  const [isColorRangeExpanded, setIsColorRangeExpanded] = useState<boolean>(false);

  // Sync gridSteps with cubeSettings when it changes
  useEffect(() => {
    if (cubeSettings?.gridSteps) {
      setGridSteps(cubeSettings.gridSteps);
    }
  }, [cubeSettings?.gridSteps]);

  // Get theme-aware background color
  const getBackgroundColor = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return isDark ? '#1b1b1d' : '#ffffff';
  };

  useEffect(() => {
    if (!stageRef.current) return;

    // Initialize NGL Stage with more tolerant clipping planes
    nglStageRef.current = new NGL.Stage(stageRef.current, {
      backgroundColor: getBackgroundColor(),
      quality: 'medium',
      clipNear: 0.000001,  // Very small near clipping plane
      clipFar: 100,
      clipDist: 10,
      fogNear: 100,
      fogFar: 100
    });

    // Handle resize
    const handleResize = () => {
      if (nglStageRef.current) {
        nglStageRef.current.handleResize();
      }
    };

    window.addEventListener('resize', handleResize);

    // Listen for theme changes
    const handleThemeChange = () => {
      if (nglStageRef.current) {
        nglStageRef.current.setParameters({ backgroundColor: getBackgroundColor() });
      }
    };

    // Use MutationObserver to watch for theme changes
    const observer = new MutationObserver(handleThemeChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      if (nglStageRef.current) {
        nglStageRef.current.dispose();
      }
    };
  }, []);

  // Convert XYZ format to SDF format with bond guessing
  const convertXYZToSDF = (xyzData: string, moleculeName: string): string => {
    const lines = xyzData.trim().split('\n');
    const numAtoms = parseInt(lines[0]);
    const title = lines[1] || moleculeName;
    
    // Parse atoms
    const atoms: Array<{element: string, x: number, y: number, z: number}> = [];
    for (let i = 2; i < 2 + numAtoms; i++) {
      const parts = lines[i].trim().split(/\s+/);
      atoms.push({
        element: parts[0],
        x: parseFloat(parts[1]),
        y: parseFloat(parts[2]),
        z: parseFloat(parts[3])
      });
    }
    
    // Typical bond lengths (in Angstroms) - approximate values
    const bondLengths: {[key: string]: number} = {
      'H-H': 0.74, 'H-C': 1.09, 'H-N': 1.01, 'H-O': 0.96, 'H-S': 1.34,
      'C-C': 1.54, 'C-N': 1.47, 'C-O': 1.43, 'C-S': 1.82,
      'N-N': 1.45, 'N-O': 1.40, 'N-S': 1.68,
      'O-O': 1.48, 'O-S': 1.66,
      'S-S': 2.05
    };
    
    // Function to get bond length between two elements
    const getBondLength = (elem1: string, elem2: string): number => {
      const key1 = `${elem1}-${elem2}`;
      const key2 = `${elem2}-${elem1}`;
      return bondLengths[key1] || bondLengths[key2] || 2.0; // default fallback
    };
    
    // Function to calculate distance between two atoms
    const getDistance = (atom1: typeof atoms[0], atom2: typeof atoms[0]): number => {
      const dx = atom1.x - atom2.x;
      const dy = atom1.y - atom2.y;
      const dz = atom1.z - atom2.z;
      return Math.sqrt(dx*dx + dy*dy + dz*dz);
    };
    
    // Guess bonds based on distances
    const bonds: Array<{atom1: number, atom2: number, order: number}> = [];
    const tolerance = 0.3; // Allow 30% tolerance on bond lengths
    
    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const distance = getDistance(atoms[i], atoms[j]);
        const expectedLength = getBondLength(atoms[i].element, atoms[j].element);
        
        if (distance <= expectedLength * (1 + tolerance)) {
          // Guess bond order based on distance (very simplified)
          let bondOrder = 1;
          if (distance < expectedLength * 0.85) {
            bondOrder = 2; // Possibly double bond
          }
          if (distance < expectedLength * 0.75) {
            bondOrder = 3; // Possibly triple bond
          }
          
          bonds.push({
            atom1: i + 1, // SDF uses 1-based indexing
            atom2: j + 1,
            order: bondOrder
          });
        }
      }
    }
    
    // SDF header
    let sdf = `${title}\n`;
    sdf += '  Generated from XYZ with bond guessing\n';
    sdf += '\n';
    
    // Counts line: aaabbblllfffcccsssxxxrrrpppiiimmmvvvvvv
    // aaa = number of atoms, bbb = number of bonds
    sdf += `${numAtoms.toString().padStart(3, ' ')}${bonds.length.toString().padStart(3, ' ')}  0  0  0  0  0  0  0  0999 V2000\n`;
    
    // Atom block
    atoms.forEach(atom => {
      const x = atom.x.toFixed(4).padStart(10, ' ');
      const y = atom.y.toFixed(4).padStart(10, ' ');
      const z = atom.z.toFixed(4).padStart(10, ' ');
      
      sdf += `${x}${y}${z} ${atom.element.padEnd(3, ' ')} 0  0  0  0  0  0  0  0  0  0  0  0\n`;
    });
    
    // Bond block
    bonds.forEach(bond => {
      sdf += `${bond.atom1.toString().padStart(3, ' ')}${bond.atom2.toString().padStart(3, ' ')}${bond.order.toString().padStart(3, ' ')}  0  0  0  0\n`;
    });
    
    // End of molecule
    sdf += 'M  END\n$$$$\n';
    
    return sdf;
  };

  // Update representation when settings change
  const updateRepresentation = () => {
    if (!componentRef.current) return;

    // Remove all existing representations
    componentRef.current.removeAllRepresentations();

    // Selection string for hydrogen visibility
    const selection = showHydrogens ? 'all' : 'not hydrogen';

    // Add new representation based on current settings
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
      case 'surface':
        repParams.opacity = 0.8;
        repParams.surfaceType = 'vws';
        break;
    }

    componentRef.current.addRepresentation(representation, repParams);
    
    // Auto view to fit molecule
    nglStageRef.current?.autoView();
  };

  useEffect(() => {
    updateRepresentation();
  }, [representation, showHydrogens, colorScheme]);


  // Function to load molecule geometry
  const loadGeometry = async (xyzDataToLoad: string) => {
    if (!nglStageRef.current) return;
    
    try {
      // Clear existing components
      nglStageRef.current.removeAllComponents();

      // Convert XYZ to SDF
      const sdfData = convertXYZToSDF(xyzDataToLoad, moleculeName);
      
      // Create blob from SDF data
      const blob = new Blob([sdfData], { type: 'text/plain' });
      
      // Load structure from blob
      const structure = await nglStageRef.current.loadFile(blob, { 
        ext: 'sdf',
        name: moleculeName
      });

      // Store component reference
      componentRef.current = structure;

      // Apply initial representation
      updateRepresentation();
      
    } catch (err) {
      console.error('Error loading geometry:', err);
      throw err;
    }
  };

  useEffect(() => {
    if (!xyzData || !nglStageRef.current) return;

    const loadMolecule = async () => {
      setIsLoading(true);
      setError('');

      try {
        // Load single molecule
        await loadGeometry(xyzData);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading molecule:', err);
        setError('Failed to load molecule structure');
        setIsLoading(false);
      }
    };

    loadMolecule();
  }, [xyzData, moleculeName]);

  const resetView = () => {
    if (nglStageRef.current) {
      nglStageRef.current.autoView();
    }
  };

  const toggleFullscreen = () => {
    if (nglStageRef.current) {
      nglStageRef.current.toggleFullscreen(stageRef.current);
    }
  };

  // Get available orbitals from wavefunction results
  const availableOrbitals = React.useMemo(() => {
    if (!wavefunctionResults?.orbitalEnergies || !wavefunctionResults?.orbitalOccupations) {
      return [];
    }

    const orbitals = [];

    // Check if this is an unrestricted calculation
    const isUnrestricted = typeof wavefunctionResults.orbitalEnergies === 'object' &&
                           'isUnrestricted' in wavefunctionResults.orbitalEnergies;

    if (isUnrestricted) {
      const energies = wavefunctionResults.orbitalEnergies;
      const occupations = wavefunctionResults.orbitalOccupations;

      // Add alpha orbitals
      for (let i = 0; i < energies.alpha.length; i++) {
        const energy = energies.alpha[i];
        const occupation = occupations.alpha[i] || 0;
        orbitals.push({
          index: i,
          energy: energy * 27.2114, // Convert to eV
          occupation,
          isOccupied: occupation > 0,
          spin: 'alpha' as const
        });
      }

      // Add beta orbitals
      for (let i = 0; i < energies.beta.length; i++) {
        const energy = energies.beta[i];
        const occupation = occupations.beta[i] || 0;
        orbitals.push({
          index: i,
          energy: energy * 27.2114, // Convert to eV
          occupation,
          isOccupied: occupation > 0,
          spin: 'beta' as const
        });
      }
    } else {
      // Restricted calculation
      const energies = wavefunctionResults.orbitalEnergies as number[];
      const occupations = wavefunctionResults.orbitalOccupations as number[];

      for (let i = 0; i < energies.length; i++) {
        const energy = energies[i];
        const occupation = occupations[i] || 0;
        orbitals.push({
          index: i,
          energy: energy * 27.2114, // Convert to eV
          occupation,
          isOccupied: occupation > 0
        });
      }
    }

    return orbitals;
  }, [wavefunctionResults]);

  // Show all available orbitals
  const displayedOrbitals = availableOrbitals;

  // Don't select any orbitals by default - user chooses which to plot

  // Request new cube data when orbitals change or when grid settings change
  useEffect(() => {
    if (availableOrbitals.length > 0 && onRequestCubeComputation && selectedOrbitals.size > 0) {
      const missingOrbitals = [];

      for (const orbitalIndex of selectedOrbitals) {
        const orbital = availableOrbitals[orbitalIndex];
        const spin = orbital.spin;
        const cubeKey = spin
          ? `molecular_orbital_${orbital.index}_${spin}_${gridSteps}`
          : `molecular_orbital_${orbital.index}_${gridSteps}`;
        const existingCube = cubeResults?.get(cubeKey);
        if (!existingCube) {
          missingOrbitals.push(orbitalIndex);
        }
      }

      if (missingOrbitals.length > 0) {
        // Clear existing timeout
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }

        // Set new timeout for debounced update
        updateTimeoutRef.current = setTimeout(() => {
          computeAndVisualizeMOs(missingOrbitals);
        }, 300); // Longer delay for grid setting changes
      }
    }

    // Cleanup timeouts on unmount
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      if (colorChangeTimeoutRef.current) {
        clearTimeout(colorChangeTimeoutRef.current);
      }
    };
  }, [selectedOrbitals, availableOrbitals.length, cubeResults, gridSteps]);

  // Handle orbital color changes
  const handleOrbitalColorChange = (orbitalIndex: number, color: string) => {
    setOrbitalColors(prev => {
      const newColors = new Map(prev);
      newColors.set(orbitalIndex, color);
      return newColors;
    });
    
    // Clear any pending color change timeout
    if (colorChangeTimeoutRef.current) {
      clearTimeout(colorChangeTimeoutRef.current);
    }
    
    // If this orbital is currently visible, re-render all MOs to update the color
    if (selectedOrbitals.has(orbitalIndex)) {
      colorChangeTimeoutRef.current = setTimeout(() => {
        visualizeAllSelectedMOs();
        colorChangeTimeoutRef.current = null;
      }, 50);
    }
  };

  const computeAndVisualizeMOs = async (orbitalIndices: number[]) => {
    if (!onRequestCubeComputation || !nglStageRef.current) {
      return;
    }

    setIsComputingMO(true);
    setError('');

    try {
      // Validate orbital indices before requesting computation
      const maxOrbitalIndex = availableOrbitals.length - 1;

      for (const orbitalIndex of orbitalIndices) {
        if (orbitalIndex < 0 || orbitalIndex > maxOrbitalIndex) {
          throw new Error(`Invalid orbital index ${orbitalIndex}. Valid range: 0-${maxOrbitalIndex}`);
        }

        // Get the orbital to determine spin
        const orbital = availableOrbitals[orbitalIndex];
        const spin = orbital.spin; // undefined for restricted, 'alpha' or 'beta' for unrestricted

        onRequestCubeComputation('molecular_orbital', orbital.index, gridSteps, spin);
      }
    } catch (error) {
      console.error('Error requesting MO computation:', error);
      setError('Failed to request molecular orbital computation: ' + error.message);
      setIsComputingMO(false);
    }
  };

  // Watch for cube results and visualize them
  useEffect(() => {
    console.log('MO visualization effect triggered:', { 
      selectedOrbitals: selectedOrbitals.size, 
      cubeResults: cubeResults.size, 
      orbitalRenderStyle, 
      sliceDirection, 
      slicePosition 
    });
    
    // Clear any pending color change timeout when orbital selection changes
    if (colorChangeTimeoutRef.current) {
      clearTimeout(colorChangeTimeoutRef.current);
      colorChangeTimeoutRef.current = null;
    }
    
    if (!nglStageRef.current) return;

    // If no orbitals selected, clear visualizations
    if (selectedOrbitals.size === 0) {
      visualizeAllSelectedMOs();
      return;
    }

    // Only proceed if we have cube results
    if (!cubeResults) return;

    // Check if all selected orbitals have cube data
    const allCubesAvailable = Array.from(selectedOrbitals).every(orbitalIndex => {
      const orbital = availableOrbitals[orbitalIndex];
      const spin = orbital?.spin;
      const cubeKey = spin
        ? `molecular_orbital_${orbital.index}_${spin}_${gridSteps}`
        : `molecular_orbital_${orbital.index}_${gridSteps}`;
      return cubeResults.get(cubeKey);
    });

    if (allCubesAvailable) {
      visualizeAllSelectedMOs();
      if (isComputingMO) {
        setIsComputingMO(false);
      }
    }
  }, [cubeResults, selectedOrbitals, isosurfaceValue, showBothPhases, opacity, orbitalRenderStyle, sliceDirection, slicePosition, colorScale, colorRange]);

  // Simple slice position - use the actual position value
  const calculateSlicePosition = (cubeComponent: any, direction: 'x' | 'y' | 'z', position: number) => {
    console.log(`Slice position: direction=${direction}, position=${position}`);
    return position;
  };

  // Extract grid bounds from NGL volume object
  const extractGridBoundsFromVolume = (volumeComponent: any) => {
    try {
      if (!volumeComponent || !volumeComponent.structure || !volumeComponent.structure.volume) {
        return null;
      }

      const volume = volumeComponent.structure.volume;
      
      // NGL volume objects typically have these properties
      const header = volume.header;
      if (!header) return null;

      // Grid dimensions
      const nx = header.nx || header.gridDimensions?.[0];
      const ny = header.ny || header.gridDimensions?.[1]; 
      const nz = header.nz || header.gridDimensions?.[2];

      // Grid vectors (step sizes and directions)
      const vx = header.vx || header.gridVectors?.[0];
      const vy = header.vy || header.gridVectors?.[1];
      const vz = header.vz || header.gridVectors?.[2];

      // Origin point
      const origin = header.origin || header.gridOrigin;

      if (!nx || !ny || !nz || !vx || !vy || !vz || !origin) {
        console.log('Missing grid data in volume header:', header);
        return null;
      }

      // Calculate bounds
      const min = [origin[0], origin[1], origin[2]];
      const max = [
        origin[0] + (nx - 1) * vx[0] + (ny - 1) * vy[0] + (nz - 1) * vz[0],
        origin[1] + (nx - 1) * vx[1] + (ny - 1) * vy[1] + (nz - 1) * vz[1],
        origin[2] + (nx - 1) * vx[2] + (ny - 1) * vy[2] + (nz - 1) * vz[2]
      ];

      return { min, max };
    } catch (error) {
      console.error('Error extracting grid bounds from volume:', error);
      return null;
    }
  };

  const visualizeAllSelectedMOs = async () => {
    if (!nglStageRef.current) return;

    try {
      // Remove existing MO surfaces
      if (moComponentRef.current) {
        if (Array.isArray(moComponentRef.current)) {
          moComponentRef.current.forEach(component => {
            if (component && nglStageRef.current) {
              nglStageRef.current.removeComponent(component);
            }
          });
        } else if (nglStageRef.current) {
          nglStageRef.current.removeComponent(moComponentRef.current);
        }
        moComponentRef.current = null;
      }

      const moComponents = [];
      const colors = ['#4A90E2', '#FF8C42', '#7B68EE', '#32CD32', '#FF6B6B', '#9B59B6'];

      // If no orbitals selected, clear everything and return
      if (selectedOrbitals.size === 0) {
        moComponentRef.current = [];
        // Don't clear orbitalColors - keep color preferences for when orbitals are reselected
        // Force a re-render by resetting the stage view
        nglStageRef.current.autoView();
        return;
      }

      // Load and visualize each selected orbital
      for (const [index, orbitalIndex] of Array.from(selectedOrbitals).entries()) {
        const orbital = availableOrbitals[orbitalIndex];
        const spin = orbital?.spin;
        const cubeKey = spin
          ? `molecular_orbital_${orbital.index}_${spin}_${gridSteps}`
          : `molecular_orbital_${orbital.index}_${gridSteps}`;
        const cubeData = cubeResults?.get(cubeKey);

        if (cubeData) {
          // Create blob from cube data and load it
          const blob = new Blob([cubeData], { type: 'text/plain' });
          const cubeComponent = await nglStageRef.current.loadFile(blob, {
            ext: 'cube',
            name: `MO_${orbitalIndex}`
          });

          if (cubeComponent) {
            // Use stored color if available, otherwise assign next default color
            let color = orbitalColors.get(orbitalIndex);
            if (!color) {
              color = colors[index % colors.length];
              // Store the new default color assignment
              setOrbitalColors(prev => {
                const updated = new Map(prev);
                updated.set(orbitalIndex, color);
                return updated;
              });
            }

            // Add representation based on selected style
            if (orbitalRenderStyle === 'surface') {
              // Add positive isosurface
              cubeComponent.addRepresentation('surface', {
                visible: true,
                isolevelType: 'value',
                isolevel: isosurfaceValue,
                color: color,
                opacity: opacity,
                opaqueBack: false
              });

              // Add negative isosurface if showing both phases
              if (showBothPhases) {
                cubeComponent.addRepresentation('surface', {
                  visible: true,
                  isolevelType: 'value',
                  isolevel: -isosurfaceValue,
                  color: 'red',
                  opacity: opacity,
                  opaqueBack: false
                });
              }
            } else if (orbitalRenderStyle === 'wireframe') {
              // Add wireframe representation
              cubeComponent.addRepresentation('surface', {
                visible: true,
                isolevelType: 'value',
                isolevel: isosurfaceValue,
                color: color,
                opacity: opacity,
                wireframe: true,
                linewidth: 2
              });

              if (showBothPhases) {
                cubeComponent.addRepresentation('surface', {
                  visible: true,
                  isolevelType: 'value',
                  isolevel: -isosurfaceValue,
                  color: 'red',
                  opacity: opacity,
                  wireframe: true,
                  linewidth: 2
                });
              }
            } else if (orbitalRenderStyle === 'dot') {
              // Add dot volume rendering
              cubeComponent.addRepresentation('dot', {
                visible: true,
                color: color,
                opacity: opacity,
                dotType: 'square',
                dotSpacing: 2,
                threshold: 0.001
              });
            } else if (orbitalRenderStyle === 'slice') {
              // Add slice volume rendering using proper NGL API
              const slicePos = calculateSlicePosition(cubeComponent, sliceDirection, slicePosition);
              console.log(`Adding slice representation: direction=${sliceDirection}, normalizedPos=${slicePosition}, coordinatePos=${slicePos}`);
              
              cubeComponent.addRepresentation('slice', {
                visible: true,
                opacity: opacity,
                dimension: sliceDirection,
                positionType: "coordinate",
                position: slicePos,
                thresholdMin: colorRange[0],
                thresholdMax: colorRange[1],
                thresholdType: 'value',
                colorScheme: colorScale,
                colorDomain: colorRange
              });
            }

            moComponents.push(cubeComponent);
          }
        }
      }

      moComponentRef.current = moComponents;
      nglStageRef.current.autoView();
    } catch (error) {
      console.error('Error visualizing molecular orbitals:', error);
      setError('Failed to visualize molecular orbitals: ' + error.message);
    }
  };


  const toggleOrbitalSelection = (orbitalIndex: number) => {
    setSelectedOrbitals(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orbitalIndex)) {
        newSet.delete(orbitalIndex);
      } else {
        newSet.add(orbitalIndex);
      }
      return newSet;
    });
  };


  // Create and display grid bounds visualization
  const updateGridBoundsVisualization = async () => {
    if (!nglStageRef.current) return;

    // Remove existing bounds visualization
    if (gridBoundsComponentRef.current) {
      nglStageRef.current.removeComponent(gridBoundsComponentRef.current);
      gridBoundsComponentRef.current = null;
    }

    if (!showGridBounds) return;

    // Use the gridInfo from the worker if available
    let bounds = null;
    
    if (cubeGridInfo) {
      // Calculate bounds from the worker's grid info
      const origin = cubeGridInfo.origin;
      const steps = cubeGridInfo.steps;
      const nx = cubeGridInfo.nx;
      const ny = cubeGridInfo.ny;
      const nz = cubeGridInfo.nz;
      const basis = cubeGridInfo.basis; // 3x3 matrix as flat array
      
      if (origin && steps && nx && ny && nz && basis) {
        // Convert basis from flat array to 3x3 matrix
        const basisMatrix = [
          [basis[0], basis[1], basis[2]],
          [basis[3], basis[4], basis[5]], 
          [basis[6], basis[7], basis[8]]
        ];
        
        // Calculate grid extents (in Bohr)
        const minBohr = [origin[0], origin[1], origin[2]];
        const maxBohr = [
          origin[0] + (nx - 1) * basisMatrix[0][0] + (ny - 1) * basisMatrix[1][0] + (nz - 1) * basisMatrix[2][0],
          origin[1] + (nx - 1) * basisMatrix[0][1] + (ny - 1) * basisMatrix[1][1] + (nz - 1) * basisMatrix[2][1],
          origin[2] + (nx - 1) * basisMatrix[0][2] + (ny - 1) * basisMatrix[1][2] + (nz - 1) * basisMatrix[2][2]
        ];
        
        // Convert from Bohr to Angstrom (1 Bohr = 0.529177 Angstrom)
        const bohrToAngstrom = 0.529177;
        const min = [minBohr[0] * bohrToAngstrom, minBohr[1] * bohrToAngstrom, minBohr[2] * bohrToAngstrom];
        const max = [maxBohr[0] * bohrToAngstrom, maxBohr[1] * bohrToAngstrom, maxBohr[2] * bohrToAngstrom];
        
        bounds = { min, max };
        console.log('Grid bounds (converted to Angstrom):', bounds);
      }
    }
    
    // If no grid info available, we can't show accurate bounds
    if (!bounds) {
      console.log('No cube grid info available - cannot show accurate grid bounds');
      return;
    }
    

    try {
      const [minX, minY, minZ] = bounds.min;
      const [maxX, maxY, maxZ] = bounds.max;
      
      // Create a simple cube wireframe using line representation
      // Generate 8 vertices of the bounding box
      const vertices = [
        [minX, minY, minZ], [maxX, minY, minZ], [maxX, maxY, minZ], [minX, maxY, minZ], // bottom face
        [minX, minY, maxZ], [maxX, minY, maxZ], [maxX, maxY, maxZ], [minX, maxY, maxZ]  // top face
      ];
      
      // Create edges connecting the vertices
      const edges = [
        // Bottom face edges
        [0, 1], [1, 2], [2, 3], [3, 0],
        // Top face edges  
        [4, 5], [5, 6], [6, 7], [7, 4],
        // Vertical edges
        [0, 4], [1, 5], [2, 6], [3, 7]
      ];
      
      // Create a simple MOL format string for the wireframe
      let molString = `Grid Bounds
  Generated
  
${vertices.length.toString().padStart(3, ' ')}${edges.length.toString().padStart(3, ' ')}  0  0  0  0  0  0  0  0999 V2000
`;
      
      // Add vertices (atoms)
      vertices.forEach(([x, y, z]) => {
        molString += `${x.toFixed(4).padStart(10, ' ')}${y.toFixed(4).padStart(10, ' ')}${z.toFixed(4).padStart(10, ' ')} C   0  0  0  0  0  0  0  0  0  0  0  0
`;
      });
      
      // Add edges (bonds)
      edges.forEach(([i, j]) => {
        molString += `${(i + 1).toString().padStart(3, ' ')}${(j + 1).toString().padStart(3, ' ')}  1  0  0  0  0
`;
      });
      
      molString += 'M  END\n$$$$\n';
      
      // Load the wireframe structure
      const blob = new Blob([molString], { type: 'text/plain' });
      const boundsComponent = await nglStageRef.current.loadFile(blob, {
        ext: 'mol',
        name: 'Grid_Bounds'
      });
      
      if (boundsComponent) {
        // Add wireframe representation
        boundsComponent.addRepresentation('line', {
          colorScheme: 'uniform',
          colorValue: '#ff6b6b',
          linewidth: 2,
          opacity: 0.7
        });
        
        gridBoundsComponentRef.current = boundsComponent;
      }
      
    } catch (error) {
      console.error('Error creating grid bounds visualization:', error);
      setError('Failed to create grid bounds visualization: ' + error.message);
    }
  };

  // Update bounds when grid settings change or when cube grid info is available
  useEffect(() => {
    updateGridBoundsVisualization();
  }, [showGridBounds, cubeGridInfo]);

  // Save orbital colors to localStorage whenever they change
  useEffect(() => {
    try {
      const colorsObject = Object.fromEntries(orbitalColors);
      localStorage.setItem('orbitalColors', JSON.stringify(colorsObject));
    } catch (error) {
      console.warn('Failed to save orbital colors to localStorage:', error);
    }
  }, [orbitalColors]);

  if (!xyzData) {
    return (
      <div className={styles.container}>
        <div className={styles.placeholder}>
          <h4>Molecule Viewer</h4>
          <p>Load a molecule to see its 3D structure</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h4>3D Structure & Molecular Orbitals</h4>
        <div className={styles.controls}>
          <button 
            className={styles.controlButton}
            onClick={resetView}
            title="Reset view"
          >
            ⌂
          </button>
          <button 
            className={styles.controlButton}
            onClick={toggleFullscreen}
            title="Toggle fullscreen"
          >
            ⛶
          </button>
        </div>
      </div>
      
      <div className={styles.representationControls}>
        {/* Structure Controls */}
        <div className={styles.inlineControlGroup}>
          <label className={styles.controlLabel}>Style</label>
          <select 
            value={representation} 
            onChange={(e) => setRepresentation(e.target.value as RepresentationType)}
            className={styles.controlSelect}
          >
            <option value="ball+stick">Ball & Stick</option>
            <option value="line">Line</option>
            <option value="spacefill">Space Fill</option>
            <option value="licorice">Licorice</option>
            <option value="surface">Surface</option>
          </select>
        </div>
        
        <div className={styles.inlineControlGroup}>
          <label className={styles.controlLabel}>Color</label>
          <select 
            value={colorScheme} 
            onChange={(e) => setColorScheme(e.target.value)}
            className={styles.controlSelect}
          >
            <option value="element">By Element</option>
            <option value="uniform">Uniform</option>
            <option value="chainname">By Chain</option>
            <option value="random">Random</option>
          </select>
        </div>
      </div>


      <div className={styles.mainContent}>
        <div className={styles.viewerContainer}>
          {error && (
            <div className={styles.error}>
              <p>{error}</p>
            </div>
          )}
          
          {isLoading && (
            <div className={styles.loading}>
              <p>Loading molecule...</p>
            </div>
          )}
          
          <div 
            ref={stageRef} 
            className={styles.viewer}
            style={{ opacity: isLoading ? 0.5 : 1 }}
          />

          {/* Toggle button for mobile */}
          {wavefunctionResults && availableOrbitals.length > 0 && (
            <button 
              className={styles.orbitalToggleButton}
              onClick={() => setIsOrbitalPanelOpen(!isOrbitalPanelOpen)}
            >
              {isOrbitalPanelOpen ? 'Hide' : 'Orbitals'}
            </button>
          )}
        </div>

        {/* Orbital Sidebar - shown when wavefunction results are available */}
        {wavefunctionResults && availableOrbitals.length > 0 && (
          <div className={`${styles.orbitalSidebar} ${isOrbitalPanelOpen ? styles.open : ''}`}>
            <div className={styles.orbitalSidebarHeader}>
              <h5>Molecular Orbitals</h5>
              <button 
                className={styles.orbitalCloseButton}
                onClick={() => setIsOrbitalPanelOpen(false)}
                title="Close orbital panel"
              >
                ×
              </button>
            </div>

            {/* Settings - Collapsible */}
            <div className={styles.collapsibleSection}>
              <button 
                className={styles.lightSectionHeader}
                onClick={() => setIsMOSettingsExpanded(!isMOSettingsExpanded)}
              >
                <span>Settings</span>
                <span className={`${styles.chevron} ${isMOSettingsExpanded ? styles.chevronExpanded : ''}`}>
                  ▼
                </span>
              </button>
              {isMOSettingsExpanded && (
                <div className={styles.sectionContent}>
                  <div className={styles.moControls}>
                  <div className={styles.controlGroup}>
                    <label className={styles.controlLabel}>Style</label>
                    <select 
                      value={orbitalRenderStyle}
                      onChange={(e) => setOrbitalRenderStyle(e.target.value as 'surface' | 'wireframe' | 'dot' | 'slice')}
                      className={styles.controlSelect}
                    >
                      <option value="surface">Surface</option>
                      <option value="wireframe">Wireframe</option>
                      <option value="dot">Dot Volume</option>
                      <option value="slice">Slice Volume</option>
                    </select>
                  </div>

                  {(orbitalRenderStyle === 'surface' || orbitalRenderStyle === 'wireframe') && (
                    <div className={styles.controlGroup}>
                      <label className={styles.controlLabel}>Isovalue</label>
                      <input 
                        type="number" 
                        min="0.001" 
                        max="0.2" 
                        step="0.001" 
                        value={isosurfaceValue}
                        onChange={(e) => setIsosurfaceValue(parseFloat(e.target.value) || 0.01)}
                        className={styles.numberInput}
                      />
                    </div>
                  )}

                  {orbitalRenderStyle === 'slice' && (
                    <>
                      <div className={styles.controlGroup}>
                        <label className={styles.controlLabel}>Slice Direction</label>
                        <select 
                          value={sliceDirection}
                          onChange={(e) => setSliceDirection(e.target.value as 'x' | 'y' | 'z')}
                          className={styles.controlSelect}
                        >
                          <option value="x">X-axis</option>
                          <option value="y">Y-axis</option>
                          <option value="z">Z-axis</option>
                        </select>
                      </div>
                      <div className={styles.controlGroup}>
                        <label className={styles.controlLabel}>Slice Position</label>
                        <div className={styles.slicePositionControls}>
                          <button 
                            onClick={() => setSlicePosition(slicePosition - 0.5)}
                            className={styles.controlButton}
                            title="Move slice by -0.5"
                          >
                            -
                          </button>
                          <input 
                            type="number" 
                            step="0.1" 
                            value={slicePosition}
                            onChange={(e) => setSlicePosition(parseFloat(e.target.value) || 0)}
                            className={styles.numberInput}
                            title="Slice position in Angstroms"
                          />
                          <button 
                            onClick={() => setSlicePosition(slicePosition + 0.5)}
                            className={styles.controlButton}
                            title="Move slice by +0.5"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className={styles.collapsibleControl}>
                        <button 
                          className={styles.controlToggle}
                          onClick={() => setIsColorRangeExpanded(!isColorRangeExpanded)}
                        >
                          <span className={styles.controlLabel}>Color Range</span>
                          <span className={`${styles.chevron} ${isColorRangeExpanded ? styles.chevronExpanded : ''}`}>
                            ▼
                          </span>
                        </button>
                        {isColorRangeExpanded && (
                          <div className={styles.controlContent}>
                            <div className={styles.colorRangeGrid}>
                              <div className={styles.controlGroup}>
                                <label className={styles.controlLabel}>Minimum</label>
                                <input 
                                  type="number" 
                                  step="0.01" 
                                  value={colorRange[0]}
                                  onChange={(e) => setColorRange([parseFloat(e.target.value) || 0, colorRange[1]])}
                                  className={styles.numberInput}
                                  title="Minimum value for color scale"
                                />
                              </div>
                              <div className={styles.controlGroup}>
                                <label className={styles.controlLabel}>Maximum</label>
                                <input 
                                  type="number" 
                                  step="0.01" 
                                  value={colorRange[1]}
                                  onChange={(e) => setColorRange([colorRange[0], parseFloat(e.target.value) || 0.05])}
                                  className={styles.numberInput}
                                  title="Maximum value for color scale"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div className={styles.controlGroup}>
                    <label className={styles.controlLabel}>Opacity</label>
                    <input 
                      type="number" 
                      min="0" 
                      max="1" 
                      step="0.05" 
                      value={opacity}
                      onChange={(e) => setOpacity(parseFloat(e.target.value) || 1.0)}
                      className={styles.numberInput}
                      title="Orbital surface opacity (0 = transparent, 1 = opaque)"
                    />
                  </div>

                  <div className={styles.controlGroup}>
                    <label className={styles.controlLabel}>Grid Steps</label>
                    <input
                      type="number"
                      min="20"
                      max="60"
                      step="5"
                      value={gridSteps}
                      onChange={(e) => setGridSteps(parseInt(e.target.value) || 40)}
                      className={styles.numberInput}
                      title="Number of grid points per dimension (higher = more detail, slower)"
                    />
                    {cubeGridInfo && (
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={showGridBounds}
                          onChange={(e) => setShowGridBounds(e.target.checked)}
                          className={styles.checkbox}
                        />
                        Bounds
                      </label>
                    )}
                  </div>

                  {onOpenCubeSettings && (
                    <div className={styles.controlGroup}>
                      <button
                        className={styles.cubeSettingsButton}
                        onClick={onOpenCubeSettings}
                        title="Advanced cube generation settings"
                      >
                        ⚙ Cube Settings...
                      </button>
                    </div>
                  )}

                  {isComputingMO && (
                    <div className={styles.controlGroup}>
                      <span className={styles.computingIndicator}>Computing MO...</span>
                    </div>
                  )}
                  </div>
                </div>
              )}
            </div>


            {/* Orbital List */}
            {(() => {
              // Check if this is an unrestricted calculation
              const isUnrestricted = availableOrbitals.length > 0 && availableOrbitals[0].spin !== undefined;

              if (isUnrestricted) {
                // Separate alpha and beta orbitals
                const alphaOrbitals = availableOrbitals.filter(orb => orb.spin === 'alpha');
                const betaOrbitals = availableOrbitals.filter(orb => orb.spin === 'beta');
                const maxLength = Math.max(alphaOrbitals.length, betaOrbitals.length);

                // Find HOMO/LUMO for alpha and beta separately
                const alphaHOMOIdx = availableOrbitals.findIndex(orb =>
                  orb.spin === 'alpha' && orb.isOccupied && !availableOrbitals.find((o, i) => i > availableOrbitals.indexOf(orb) && o.spin === 'alpha' && o.isOccupied)
                );
                const alphaLUMOIdx = alphaHOMOIdx >= 0 ? availableOrbitals.findIndex((orb, i) => orb.spin === 'alpha' && i > alphaHOMOIdx && !orb.isOccupied) : -1;

                const betaHOMOIdx = availableOrbitals.findIndex(orb =>
                  orb.spin === 'beta' && orb.isOccupied && !availableOrbitals.find((o, i) => i > availableOrbitals.indexOf(orb) && o.spin === 'beta' && o.isOccupied)
                );
                const betaLUMOIdx = betaHOMOIdx >= 0 ? availableOrbitals.findIndex((orb, i) => orb.spin === 'beta' && i > betaHOMOIdx && !orb.isOccupied) : -1;

                return (
                  <div className={styles.twoColumnOrbitalContainer}>
                    <div>
                      {/* Alpha column */}
                      <div className={styles.orbitalColumn}>
                        <div className={styles.columnHeader} title="Alpha spin (spin up)">↑</div>
                        <div>
                          {alphaOrbitals.map((orbital) => {
                            const idx = availableOrbitals.indexOf(orbital);
                            const isHOMO = idx === alphaHOMOIdx;
                            const isLUMO = idx === alphaLUMOIdx;
                            const isSelected = selectedOrbitals.has(idx);
                            const orbitalColor = orbitalColors.get(idx);

                            return (
                              <OrbitalItem
                                key={`alpha-${orbital.index}`}
                                orbital={orbital}
                                isHOMO={isHOMO}
                                isLUMO={isLUMO}
                                isSelected={isSelected}
                                colorIndicator={orbitalColor}
                                onColorChange={(color) => handleOrbitalColorChange(idx, color)}
                                onClick={() => toggleOrbitalSelection(idx)}
                              />
                            );
                          })}
                        </div>
                      </div>

                      {/* Beta column */}
                      <div className={styles.orbitalColumn}>
                        <div className={styles.columnHeader} title="Beta spin (spin down)">↓</div>
                        <div>
                          {betaOrbitals.map((orbital) => {
                            const idx = availableOrbitals.indexOf(orbital);
                            const isHOMO = idx === betaHOMOIdx;
                            const isLUMO = idx === betaLUMOIdx;
                            const isSelected = selectedOrbitals.has(idx);
                            const orbitalColor = orbitalColors.get(idx);

                            return (
                              <OrbitalItem
                                key={`beta-${orbital.index}`}
                                orbital={orbital}
                                isHOMO={isHOMO}
                                isLUMO={isLUMO}
                                isSelected={isSelected}
                                colorIndicator={orbitalColor}
                                onColorChange={(color) => handleOrbitalColorChange(idx, color)}
                                onClick={() => toggleOrbitalSelection(idx)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              } else {
                // Restricted calculation - single column
                return (
                  <div className={styles.orbitalList}>
                    {displayedOrbitals.map((orbital, idx) => {
                      // Find HOMO/LUMO in the full orbital set
                      const homoIndex = availableOrbitals.findIndex((orb, i) =>
                        orb.isOccupied && (!availableOrbitals[i + 1] || !availableOrbitals[i + 1].isOccupied)
                      );
                      const lumoIndex = homoIndex >= 0 ? homoIndex + 1 : -1;
                      const isHOMO = idx === homoIndex;
                      const isLUMO = idx === lumoIndex;
                      const isSelected = selectedOrbitals.has(idx);
                      const orbitalColor = orbitalColors.get(idx);

                      return (
                        <OrbitalItem
                          key={orbital.index}
                          orbital={orbital}
                          isHOMO={isHOMO}
                          isLUMO={isLUMO}
                          isSelected={isSelected}
                          colorIndicator={orbitalColor}
                          onColorChange={(color) => handleOrbitalColorChange(idx, color)}
                          onClick={() => toggleOrbitalSelection(idx)}
                        />
                      );
                    })}
                  </div>
                );
              }
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default MoleculeViewer;