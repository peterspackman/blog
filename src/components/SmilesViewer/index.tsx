import React, { useState, useCallback, useEffect } from 'react';
import styles from './SmilesViewer.module.css';

interface RDKitModule {
  get_mol: (smiles: string) => any;
  prefer_coordgen: (prefer: boolean) => void;
}

declare global {
  interface Window {
    initRDKitModule: () => Promise<RDKitModule>;
  }
}

interface MoleculeHistory {
  smiles: string;
  timestamp: Date;
  formula?: string;
}

export function SmilesViewer() {
  const [smiles, setSmiles] = useState<string>('CC(=O)O');
  const [error, setError] = useState<string>('');
  const [rdkit, setRdkit] = useState<RDKitModule | null>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<MoleculeHistory[]>([]);
  const [molecularFormula, setMolecularFormula] = useState<string>('');
  
  // Initialize RDKit
  useEffect(() => {
    const initRDKit = async () => {
      try {
        if (window.initRDKitModule) {
          const RDKitModule = await window.initRDKitModule();
          RDKitModule.prefer_coordgen(true);
          setRdkit(RDKitModule);
          setLoading(false);
          
          // Visualize initial SMILES
          if (smiles) {
            visualizeMolecule(RDKitModule, smiles);
          }
        }
      } catch (err) {
        console.error('Failed to initialize RDKit:', err);
        setLoading(false);
      }
    };
    
    // Load RDKit script
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@rdkit/rdkit/dist/RDKit_minimal.js';
    script.onload = () => {
      initRDKit();
    };
    document.head.appendChild(script);
    
    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);
  
  // Visualize molecule from SMILES
  const visualizeMolecule = (rdkitModule: RDKitModule, smilesStr: string) => {
    try {
      if (!smilesStr) {
        setSvgContent('');
        setMolecularFormula('');
        return;
      }
      
      const mol = rdkitModule.get_mol(smilesStr);
      if (mol) {
        const svg = mol.get_svg();
        setSvgContent(svg);
        
        // Get molecular formula - using descriptors
        try {
          const descriptors = JSON.parse(mol.get_descriptors());
          setMolecularFormula(descriptors.MolecularFormula || '');
        } catch {
          // If descriptors fail, just skip the formula
          setMolecularFormula('');
        }
        
        mol.delete();
        setError('');
      } else {
        setSvgContent('');
        setMolecularFormula('');
        setError('Invalid SMILES string');
      }
    } catch (err) {
      console.error('Failed to generate molecule visualization:', err);
      setSvgContent('');
      setMolecularFormula('');
      setError('Failed to parse SMILES string');
    }
  };
  
  // Handle SMILES visualization
  const handleVisualize = useCallback(() => {
    if (!rdkit) {
      setError('RDKit is still loading...');
      return;
    }
    
    visualizeMolecule(rdkit, smiles);
    
    // Add to history if successful
    if (smiles && !error) {
      const newEntry: MoleculeHistory = {
        smiles,
        timestamp: new Date(),
        formula: molecularFormula
      };
      setHistory(prev => [newEntry, ...prev.filter(h => h.smiles !== smiles).slice(0, 9)]);
    }
  }, [smiles, rdkit, error, molecularFormula]);
  
  // Load from history
  const loadFromHistory = (item: MoleculeHistory) => {
    setSmiles(item.smiles);
    setError('');
    if (rdkit) {
      visualizeMolecule(rdkit, item.smiles);
    }
  };
  
  // Example molecules
  const examples = [
    { name: 'Aspirin', smiles: 'CC(=O)Oc1ccccc1C(=O)O' },
    { name: 'Caffeine', smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C' },
    { name: 'Glucose', smiles: 'C([C@@H]1[C@H]([C@@H]([C@H](C(O1)O)O)O)O)O' },
    { name: 'Ibuprofen', smiles: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O' },
    { name: 'Penicillin G', smiles: 'CC1(C)S[C@@H]2[C@H](NC(=O)Cc3ccccc3)C(=O)N2[C@H]1C(=O)O' },
    { name: 'Vitamin C', smiles: 'C([C@@H]([C@@H]1C(=C(C(=O)O1)O)O)O)O' }
  ];
  
  return (
    <div className={styles.container}>
      <div className={styles.mainContent}>
        <div className={styles.inputSection}>
          <div className={styles.card}>
            <h3>Input SMILES String</h3>
            <textarea
              value={smiles}
              onChange={(e) => setSmiles(e.target.value)}
              className={styles.textarea}
              placeholder="Enter SMILES string (e.g., CC(=O)O for acetic acid)"
              rows={3}
            />
            
            <div className={styles.buttonGroup}>
              <button 
                onClick={handleVisualize} 
                className="button button--primary"
                disabled={loading || !smiles}
              >
                Visualize Molecule
              </button>
            </div>
            
            {error && (
              <div className={styles.error}>
                {error}
              </div>
            )}
          </div>
          
          <div className={styles.card}>
            <h3>Example Molecules</h3>
            <div className={styles.exampleGrid}>
              {examples.map((example) => (
                <button
                  key={example.name}
                  onClick={() => {
                    setSmiles(example.smiles);
                    if (rdkit) {
                      visualizeMolecule(rdkit, example.smiles);
                    }
                  }}
                  className={styles.exampleButton}
                  disabled={loading}
                >
                  {example.name}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className={styles.outputSection}>
          <div className={styles.card}>
            <h3>Molecule Visualization</h3>
            
            {loading ? (
              <div className={styles.loading}>Loading RDKit...</div>
            ) : svgContent ? (
              <>
                <div className={styles.moleculeDisplay}>
                  <div dangerouslySetInnerHTML={{ __html: svgContent }} />
                </div>
                {molecularFormula && (
                  <div className={styles.moleculeInfo}>
                    <strong>Molecular Formula:</strong> {molecularFormula}
                  </div>
                )}
                <div className={styles.moleculeInfo}>
                  <strong>SMILES:</strong> <code>{smiles}</code>
                </div>
              </>
            ) : (
              <div className={styles.placeholder}>
                Enter a SMILES string and click "Visualize Molecule" to see the structure
              </div>
            )}
          </div>
          
          {history.length > 0 && (
            <div className={styles.card}>
              <h3>Recent Molecules</h3>
              <div className={styles.historyList}>
                {history.map((item, index) => (
                  <div 
                    key={`${item.smiles}-${index}`}
                    className={styles.historyItem}
                    onClick={() => loadFromHistory(item)}
                  >
                    <code className={styles.historySmiles}>{item.smiles}</code>
                    {item.formula && (
                      <span className={styles.historyFormula}>{item.formula}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}