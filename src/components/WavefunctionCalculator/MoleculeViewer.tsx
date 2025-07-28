import React, { useEffect, useRef, useState } from 'react';
import * as NGL from 'ngl';
import styles from './MoleculeViewer.module.css';

interface MoleculeViewerProps {
  xyzData: string;
  moleculeName?: string;
}

const MoleculeViewer: React.FC<MoleculeViewerProps> = ({ xyzData, moleculeName = 'Molecule' }) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const nglStageRef = useRef<NGL.Stage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!stageRef.current) return;

    // Initialize NGL Stage
    nglStageRef.current = new NGL.Stage(stageRef.current, {
      backgroundColor: 'white',
      quality: 'medium'
    });

    // Handle resize
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

  useEffect(() => {
    if (!xyzData || !nglStageRef.current) return;

    const loadMolecule = async () => {
      setIsLoading(true);
      setError('');

      try {
        // Clear existing components
        nglStageRef.current!.removeAllComponents();

        // Convert XYZ to SDF
        const sdfData = convertXYZToSDF(xyzData, moleculeName);
        
        // Create blob from SDF data
        const blob = new Blob([sdfData], { type: 'text/plain' });
        
        // Load structure from blob
        const structure = await nglStageRef.current!.loadFile(blob, { 
          ext: 'sdf',
          name: moleculeName 
        });

        // Add representations
        structure.addRepresentation('ball+stick', {
          colorScheme: 'element',
          radiusScale: 0.8,
          bondScale: 0.3
        });

        // Auto view to fit molecule
        nglStageRef.current!.autoView();
        
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
      nglStageRef.current.toggleFullscreen();
    }
  };

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
        <h4>3D Structure</h4>
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
    </div>
  );
};

export default MoleculeViewer;