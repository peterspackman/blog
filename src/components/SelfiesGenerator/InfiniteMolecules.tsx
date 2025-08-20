import React, { useState, useEffect, useCallback, useRef } from 'react';
import { decoder, generateMoleculeByIndex, getTotalMoleculeCount } from './selfies-wrapper';
import styles from './InfiniteMolecules.module.css';

interface RDKitModule {
  get_mol: (smiles: string) => any;
  prefer_coordgen: (prefer: boolean) => void;
}

declare global {
  interface Window {
    initRDKitModule: () => Promise<RDKitModule>;
  }
}

interface Molecule {
  id: string;
  selfies: string;
  smiles: string;
  svg?: string;
  position: number;
}

interface InfiniteMoleculesProps {
  symbolLength?: number;
  batchSize?: number;
}

export function InfiniteMolecules({ 
  symbolLength = 12, 
  batchSize = 8  // Show 8 molecules for nice grid layout
}: InfiniteMoleculesProps) {
  const [molecules, setMolecules] = useState<Molecule[]>([]);
  const [rdkit, setRdkit] = useState<RDKitModule | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rdkitLoading, setRdkitLoading] = useState(true);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [totalMolecules, setTotalMolecules] = useState(0);
  const [jumpToPosition, setJumpToPosition] = useState('');

  // Initialize RDKit
  useEffect(() => {
    const initRDKit = async () => {
      try {
        if (window.initRDKitModule) {
          const RDKitModule = await window.initRDKitModule();
          RDKitModule.prefer_coordgen(true);
          setRdkit(RDKitModule);
          setRdkitLoading(false);
        }
      } catch (err) {
        console.error('Failed to initialize RDKit:', err);
        setRdkitLoading(false);
      }
    };

    // Load RDKit script if not already loaded
    if (!window.initRDKitModule) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@rdkit/rdkit/dist/RDKit_minimal.js';
      script.onload = () => {
        initRDKit();
      };
      document.head.appendChild(script);
    } else {
      initRDKit();
    }
  }, []);

  // Generate molecule SVG and validate that it works
  const generateMoleculeSvg = useCallback((smiles: string): string | undefined => {
    if (!rdkit || !smiles) return undefined;
    
    try {
      const mol = rdkit.get_mol(smiles);
      if (mol) {
        const svg = mol.get_svg();
        mol.delete();
        
        // Basic validation that we got a real SVG
        if (svg && svg.includes('<svg') && svg.includes('</svg>')) {
          return svg;
        }
      }
    } catch (err) {
      // Silently skip invalid molecules
      return undefined;
    }
    return undefined;
  }, [rdkit]);

  // Generate a batch of molecules starting from specific position
  const generateMolecules = useCallback(async (count: number, startPos: number): Promise<Molecule[]> => {
    const newMolecules: Molecule[] = [];
    
    console.log(`Generating ${count} molecules starting from position ${startPos}`);
    
    for (let i = 0; i < count; i++) {
      try {
        const requestedPosition = startPos + i;
        const moleculeData = generateMoleculeByIndex(requestedPosition, symbolLength);
        const { selfies, position } = moleculeData;
        const smiles = decoder(selfies);
        
        console.log(`Requested position ${requestedPosition}, got position ${position}, SELFIES: ${selfies.slice(0, 50)}...`);
        
        // Only proceed if we got a valid SMILES
        if (smiles && smiles.trim() && !smiles.includes('ERROR')) {
          const svg = generateMoleculeSvg(smiles);
          
          // Only include if we can generate a valid SVG visualization
          if (svg) {
            const molecule: Molecule = {
              id: `mol-${position}`,
              selfies,
              smiles,
              svg,
              position
            };
            newMolecules.push(molecule);
          }
        }
      } catch (err) {
        // Silently skip failed molecules and continue
        continue;
      }
    }
    
    return newMolecules;
  }, [symbolLength, generateMoleculeSvg]);

  // Load molecules at a specific position (replaces loadMoreMolecules)
  const loadMoleculesAtPosition = useCallback(async (position: number) => {
    setIsLoading(true);
    try {
      const newMolecules = await generateMolecules(batchSize, position);
      setMolecules(newMolecules);
      setCurrentPosition(position);
    } finally {
      setIsLoading(false);
    }
  }, [batchSize, generateMolecules]);
  
  // Jump to a specific position in chemical space
  const handleJumpToPosition = useCallback(async (position: number) => {
    await loadMoleculesAtPosition(position);
  }, [loadMoleculesAtPosition]);

  // Initialize total count when component mounts
  useEffect(() => {
    const total = getTotalMoleculeCount(symbolLength);
    setTotalMolecules(total);
  }, []);

  // Initial load
  useEffect(() => {
    if (molecules.length === 0 && !isLoading && totalMolecules > 0) {
      loadMoleculesAtPosition(0);
    }
  }, [totalMolecules, loadMoleculesAtPosition]);

  // Update total count and reset when symbolLength changes
  useEffect(() => {
    const total = getTotalMoleculeCount(symbolLength);
    setTotalMolecules(total);
    
    // Reset to beginning of chemical space
    handleJumpToPosition(0);
  }, [symbolLength, handleJumpToPosition]);

  // Copy to clipboard
  const copyToClipboard = useCallback((text: string, type: 'selfies' | 'smiles') => {
    navigator.clipboard.writeText(text).then(() => {
      // Show brief feedback (you could add a toast notification here)
      const button = document.activeElement as HTMLButtonElement;
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.style.background = 'var(--ifm-color-success)';
        setTimeout(() => {
          button.textContent = originalText;
          button.style.background = '';
        }, 1000);
      }
    });
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Chemical Space Explorer</h2>
        <p>Browse molecules systematically • Click to copy SELFIES or SMILES</p>
        
        {/* Navigation Controls */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: 'var(--ifm-color-emphasis-100)',
          padding: '0.5rem 1rem',
          borderRadius: '0.5rem',
          margin: '1rem 0',
          fontSize: '0.9rem'
        }}>
          <div>
            <strong>Range:</strong> {currentPosition.toLocaleString()} - {(currentPosition + molecules.length - 1).toLocaleString()} 
            <span style={{ marginLeft: '1rem', color: 'var(--ifm-color-emphasis-600)' }}>
              of {totalMolecules.toLocaleString()} total molecules
            </span>
            {molecules.length > 0 && (
              <div style={{ fontSize: '0.8rem', color: 'var(--ifm-color-emphasis-500)' }}>
                Showing {molecules.length} molecules
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button 
              onClick={() => handleJumpToPosition(Math.max(0, currentPosition - batchSize * 5))}
              disabled={isLoading || currentPosition === 0}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
            >
              ⬅️ -{batchSize * 5}
            </button>
            <button 
              onClick={() => handleJumpToPosition(Math.max(0, currentPosition - batchSize))}
              disabled={isLoading || currentPosition === 0}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
            >
              ⬅️ -{batchSize}
            </button>
            
            <input 
              type="text"
              value={jumpToPosition}
              onChange={(e) => setJumpToPosition(e.target.value)}
              placeholder="Jump to..."
              style={{ 
                width: '80px', 
                padding: '0.25rem', 
                fontSize: '0.8rem',
                textAlign: 'center'
              }}
            />
            <button 
              onClick={() => {
                const pos = parseInt(jumpToPosition);
                if (!isNaN(pos) && pos >= 0 && pos < totalMolecules) {
                  handleJumpToPosition(Math.min(pos, totalMolecules - batchSize));
                  setJumpToPosition('');
                }
              }}
              disabled={isLoading}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
            >
              Go
            </button>
            
            <button 
              onClick={() => handleJumpToPosition(Math.min(totalMolecules - batchSize, currentPosition + batchSize))}
              disabled={isLoading || currentPosition >= totalMolecules - batchSize}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
            >
              +{batchSize} ➡️
            </button>
            <button 
              onClick={() => handleJumpToPosition(Math.min(totalMolecules - batchSize, currentPosition + batchSize * 5))}
              disabled={isLoading || currentPosition >= totalMolecules - batchSize}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
            >
              +{batchSize * 5} ➡️
            </button>
          </div>
        </div>
      </div>

      <div className={styles.moleculeGrid}>
        {molecules.map((molecule) => (
          <div key={molecule.id} className={styles.moleculeCard}>
            <div className={styles.moleculeViewer}>
              {molecule.svg ? (
                <div 
                  className={styles.svgContainer}
                  dangerouslySetInnerHTML={{ __html: molecule.svg }}
                />
              ) : (
                <div className={styles.placeholder}>
                  {rdkitLoading ? 'Loading RDKit...' : 'No visualization'}
                </div>
              )}
            </div>
            
            <div className={styles.moleculeInfo}>
              <div className={styles.infoRow}>
                <span className={styles.label}>#{molecule.position}:</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--ifm-color-emphasis-600)' }}>
                  Molecule {molecule.position.toLocaleString()}
                </span>
              </div>
              
              <div className={styles.infoRow}>
                <span className={styles.label}>SELFIES:</span>
                <button 
                  className={styles.copyButton}
                  onClick={() => copyToClipboard(molecule.selfies, 'selfies')}
                  title={molecule.selfies}
                >
                  <code className={styles.code}>{molecule.selfies}</code>
                </button>
              </div>
              
              <div className={styles.infoRow}>
                <span className={styles.label}>SMILES:</span>
                <button 
                  className={styles.copyButton}
                  onClick={() => copyToClipboard(molecule.smiles, 'smiles')}
                  title={molecule.smiles}
                >
                  <code className={styles.code}>{molecule.smiles}</code>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div style={{ 
          textAlign: 'center', 
          padding: '2rem',
          color: 'var(--ifm-color-emphasis-600)'
        }}>
          <span>Loading molecules...</span>
        </div>
      )}

      {/* Stats footer */}
      <div className={styles.footer}>
        <p>
          Showing {molecules.length} molecules from position {currentPosition.toLocaleString()}
          {molecules.length > 0 && (
            <span style={{ marginLeft: '1rem', fontSize: '0.9rem' }}>
              ({((currentPosition / totalMolecules) * 100).toFixed(4)}% through chemical space)
            </span>
          )}
        </p>
      </div>
    </div>
  );
}