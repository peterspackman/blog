import React, { useEffect, useRef, useState } from 'react';
import * as NGL from 'ngl';
import { useCrystal } from './CrystalContext';
import { CustomCrystalStructure, UnitCellDefinition, Atom, AtomDisplayOptions } from './types';

// Helper function to convert fractional coordinates to Cartesian
const fractionalToCartesian = (
  fractional: [number, number, number],
  unitCell: UnitCellDefinition
): [number, number, number] => {
  const { a, b, c, alpha, beta, gamma } = unitCell;
  const [x, y, z] = fractional;
  
  // Convert angles to radians
  const alphaRad = (alpha * Math.PI) / 180;
  const betaRad = (beta * Math.PI) / 180;
  const gammaRad = (gamma * Math.PI) / 180;
  
  // Calculate transformation matrix elements
  const cosAlpha = Math.cos(alphaRad);
  const cosBeta = Math.cos(betaRad);
  const cosGamma = Math.cos(gammaRad);
  const sinGamma = Math.sin(gammaRad);
  
  const volume = a * b * c * Math.sqrt(
    1 + 2 * cosAlpha * cosBeta * cosGamma - 
    cosAlpha * cosAlpha - cosBeta * cosBeta - cosGamma * cosGamma
  );
  
  // Cartesian coordinates
  const cartX = a * x + b * cosGamma * y + c * cosBeta * z;
  const cartY = b * sinGamma * y + c * (cosAlpha - cosBeta * cosGamma) / sinGamma * z;
  const cartZ = volume / (a * b * sinGamma) * z;
  
  return [cartX, cartY, cartZ];
};

// Helper function to build NGL selection string from atom display options
const buildSelectionString = (atomDisplay: AtomDisplayOptions): string => {
  const selectors: string[] = [];
  
  // Handle element filters
  if (atomDisplay.showElements && atomDisplay.showElements.length > 0) {
    const elementSel = atomDisplay.showElements.map(el => `_${el}`).join(' or ');
    selectors.push(`(${elementSel})`);
  }
  
  if (atomDisplay.hideElements && atomDisplay.hideElements.length > 0) {
    const elementSel = atomDisplay.hideElements.map(el => `_${el}`).join(' or ');
    selectors.push(`not (${elementSel})`);
  }
  
  // For unit cell mode, select only the central unit cell (residue 111)
  if (atomDisplay.mode === 'unitCell') {
    selectors.push(':111'); // Central unit cell has residue number 111
  }
  
  // Combine all selectors
  if (selectors.length === 0) return '*'; // Select all
  return selectors.join(' and ');
};

// Helper function to generate PDB content from custom structure
const generatePDBFromCustomStructure = (
  structure: CustomCrystalStructure,
  atomDisplay?: AtomDisplayOptions
): string => {
  let pdbContent = '';
  
  // PDB header
  pdbContent += `HEADER    CUSTOM CRYSTAL STRUCTURE                     ${new Date().toISOString().slice(0, 10)}\n`;
  pdbContent += `TITLE     ${structure.name}\n`;
  if (structure.formula) {
    pdbContent += `COMPND    ${structure.formula}\n`;
  }
  
  // Unit cell information
  const { a, b, c, alpha, beta, gamma } = structure.unitCell;
  pdbContent += `CRYST1${a.toFixed(3).padStart(9)}${b.toFixed(3).padStart(9)}${c.toFixed(3).padStart(9)}`;
  pdbContent += `${alpha.toFixed(2).padStart(7)}${beta.toFixed(2).padStart(7)}${gamma.toFixed(2).padStart(7)} P 1           1\n`;
  
  // Determine how many unit cells to generate based on display mode
  let cellRanges = [[0, 0], [0, 0], [0, 0]]; // Default: just the unit cell
  
  if (!atomDisplay || atomDisplay.mode === 'all') {
    // Generate a 3x3x3 grid of unit cells
    cellRanges = [[-1, 1], [-1, 1], [-1, 1]];
  } else if (atomDisplay.mode === 'custom' && atomDisplay.customRange) {
    // Generate cells based on custom range
    const { customRange } = atomDisplay;
    cellRanges = [
      [Math.floor(customRange.x[0]), Math.ceil(customRange.x[1])],
      [Math.floor(customRange.y[0]), Math.ceil(customRange.y[1])],
      [Math.floor(customRange.z[0]), Math.ceil(customRange.z[1])]
    ];
  }
  
  // Generate atoms
  let atomIndex = 0;
  for (let i = cellRanges[0][0]; i <= cellRanges[0][1]; i++) {
    for (let j = cellRanges[1][0]; j <= cellRanges[1][1]; j++) {
      for (let k = cellRanges[2][0]; k <= cellRanges[2][1]; k++) {
        structure.atoms.forEach((atom) => {
          const fractionalPos: [number, number, number] = [
            atom.position[0] + i,
            atom.position[1] + j,
            atom.position[2] + k
          ];
          const [x, y, z] = fractionalToCartesian(fractionalPos, structure.unitCell);
          
          atomIndex++;
          const atomNum = atomIndex.toString().padStart(5);
          const atomName = atom.element.padEnd(4);
          const resName = 'CRY'.padEnd(3);
          const chainId = 'A';
          // Use different residue numbers for different cells
          const resNum = ((i + 1) * 100 + (j + 1) * 10 + (k + 1)).toString().padStart(4);
          
          pdbContent += `ATOM  ${atomNum} ${atomName} ${resName} ${chainId}${resNum}    `;
          pdbContent += `${x.toFixed(3).padStart(8)}${y.toFixed(3).padStart(8)}${z.toFixed(3).padStart(8)}`;
          pdbContent += `  1.00 20.00           ${atom.element.padStart(2)}\n`;
        });
      }
    }
  }
  
  pdbContent += 'END\n';
  
  return pdbContent;
};

interface CrystalViewer3DProps {
  height?: string;
  structure?: string; // Override context structure
}

const CrystalViewer3D: React.FC<CrystalViewer3DProps> = ({ 
  height = '400px',
  structure 
}) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<any>(null);
  const [currentStructure, setCurrentStructure] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { state } = useCrystal();
  
  // Use provided structure or context structure
  const activeStructure = structure || state.currentStructure;

  // Initialize NGL Viewer
  useEffect(() => {
    if (!viewerRef.current) return;

    try {
      const stageObj = new NGL.Stage(viewerRef.current, {
        backgroundColor: 'white',
        quality: 'medium',
      });

      const handleResize = () => {
        stageObj.handleResize();
      };

      window.addEventListener('resize', handleResize);
      setStage(stageObj);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (stageObj) stageObj.dispose();
      };
    } catch (error) {
      console.error('Error initializing NGL Stage:', error);
      setError('Failed to initialize viewer. Please refresh the page.');
    }
  }, []);

  // Load structure when it changes
  useEffect(() => {
    if (stage && activeStructure) {
      if (activeStructure === 'custom' && state.customStructure) {
        // Only load custom structure if it's not already loaded
        if (!currentStructure || !currentStructure._isCustom) {
          loadCustomStructure(state.customStructure);
        }
      } else if (activeStructure !== '') {
        loadStructure(activeStructure);
      } else {
        // Clear any existing structure when activeStructure is empty
        if (currentStructure) {
          stage.removeComponent(currentStructure);
          setCurrentStructure(null);
        }
      }
    }
  }, [stage, activeStructure]);

  // Handle custom structure changes - just reload
  useEffect(() => {
    if (stage && activeStructure === 'custom' && state.customStructure && currentStructure) {
      loadCustomStructure(state.customStructure);
    }
  }, [state.customStructure]);

  // Update representations when display options change
  useEffect(() => {
    if (currentStructure) {
      updateRepresentations();
    }
  }, [state.displayOptions, currentStructure]);

  // Handle atom display changes for custom structures - just reload
  useEffect(() => {
    if (currentStructure && state.currentStructure === 'custom' && state.customStructure) {
      loadCustomStructure(state.customStructure);
    }
  }, [state.atomDisplay]);

  // Load structure
  const loadStructure = async (filename: string) => {
    if (!stage) return;

    setIsLoading(true);
    setError('');

    // Clear previous structure
    if (currentStructure) {
      stage.removeComponent(currentStructure);
      setCurrentStructure(null);
    }

    try {
      let structureComponent;
      
      // Check if it's a blob URL or regular filename
      if (filename.startsWith('blob:')) {
        // For blob URLs, assume PDB format since that's what we generate from GUI
        structureComponent = await stage.loadFile(filename, {
          ext: 'pdb',
          defaultRepresentation: false
        });
      } else {
        // Load from public directory
        const url = `/pdb/${filename}`;
        structureComponent = await stage.loadFile(url, {
          defaultRepresentation: false
        });
      }

      setCurrentStructure(structureComponent);
      updateRepresentations(structureComponent);

      // Auto center and zoom
      stage.autoView();
      setIsLoading(false);
    } catch (err: any) {
      console.error('Structure loading error:', err);
      setError(`Failed to load structure: ${err.message || 'Unknown error'}`);
      setIsLoading(false);
    }
  };


  // Load custom structure
  const loadCustomStructure = async (customStructure: CustomCrystalStructure) => {
    if (!stage) return;

    setIsLoading(true);
    setError('');

    // Clear previous structure
    if (currentStructure) {
      stage.removeComponent(currentStructure);
      setCurrentStructure(null);
    }

    try {
      // Generate PDB content from custom structure
      const pdbContent = generatePDBFromCustomStructure(customStructure, state.atomDisplay);
      
      // Create a blob with the PDB content
      const blob = new Blob([pdbContent], { type: 'text/plain' });
      const file = new File([blob], 'custom.pdb', { type: 'text/plain' });

      // Load the structure from the generated PDB data
      const structureComponent = await stage.loadFile(file, {
        defaultRepresentation: false
      });

      // Mark this as a custom structure using a custom property
      structureComponent._isCustom = true;
      
      setCurrentStructure(structureComponent);
      updateRepresentations(structureComponent);

      // Auto center and zoom
      stage.autoView();
      setIsLoading(false);
    } catch (err: any) {
      console.error('Custom structure loading error:', err);
      setError(`Failed to load custom structure: ${err.message || 'Unknown error'}`);
      setIsLoading(false);
    }
  };


  // Update representations based on display options
  const updateRepresentations = (structureComponent = currentStructure) => {
    if (!structureComponent) return;

    // Clear all representations
    structureComponent.removeAllRepresentations();

    // Build selection string from atom display options
    const selectionString = buildSelectionString(state.atomDisplay);

    // Add main representation with selection
    const repParams: any = {
      colorScheme: state.displayOptions.colorScheme,
      sele: selectionString
    };

    if (state.displayOptions.representation === 'ball+stick') {
      repParams.multipleBond = true;
      repParams.bondScale = 0.3;
      repParams.radius = 0.3;
    }

    structureComponent.addRepresentation(state.displayOptions.representation, repParams);

    // Add unit cell if enabled
    if (state.displayOptions.showUnitCell) {
      structureComponent.addRepresentation('unitcell', {
        name: 'unitcell_box',
        color: 'darkgray',
        linewidth: 3,
        opacity: 0.9
      });
    }

    // Add axes if enabled
    if (state.displayOptions.showAxes) {
      structureComponent.addRepresentation('axes', {
        name: 'crystal_axes',
        scale: 2.5,
        showAxes: ['x', 'y', 'z'],
        showBox: false
      });
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        border: '1px solid #ddd',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#f8f9fa'
      }}
    >
      <div
        ref={viewerRef}
        style={{
          width: '100%',
          height: '100%'
        }}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            fontSize: '0.9rem',
            color: '#666'
          }}
        >
          Loading crystal structure...
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            right: '10px',
            padding: '0.8rem',
            backgroundColor: '#fee',
            color: '#c53030',
            borderRadius: '6px',
            fontSize: '0.85rem'
          }}
        >
          {error}
        </div>
      )}

      {/* No structure loaded message */}
      {!isLoading && !error && !currentStructure && activeStructure === '' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(248, 249, 250, 0.95)',
            fontSize: '0.9rem',
            color: '#666'
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', color: '#444' }}>
              No crystal structure loaded
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrystalViewer3D;