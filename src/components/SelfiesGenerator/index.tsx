import React, { useState, useCallback, useEffect } from 'react';
import { 
  decoder, 
  splitSelfies,
  getSemanticRobustAlphabet,
  generateRandomSelfies,
  generateSmartRandomSelfies,
  generateRandomSampleSelfies,
  getSelfiesStats
} from './selfies-wrapper';
import styles from './SelfiesGenerator.module.css';

interface RDKitModule {
  get_mol: (smiles: string) => any;
  prefer_coordgen: (prefer: boolean) => void;
}

declare global {
  interface Window {
    initRDKitModule: () => Promise<RDKitModule>;
  }
}

export function SelfiesGenerator() {
  const [selfies, setSelfies] = useState<string>('[C][=C][C][Branch1][C][F][=C][C][=C][Ring1][#Branch1]');
  const [smiles, setSmiles] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [rdkit, setRdkit] = useState<RDKitModule | null>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showAlphabet, setShowAlphabet] = useState(false);
  const [history, setHistory] = useState<Array<{selfies: string, smiles: string}>>([]);
  
  // Initialize RDKit
  useEffect(() => {
    const initRDKit = async () => {
      try {
        if (window.initRDKitModule) {
          const RDKitModule = await window.initRDKitModule();
          RDKitModule.prefer_coordgen(true);
          setRdkit(RDKitModule);
          setLoading(false);
          
          // Decode initial SELFIES
          const initialSmiles = decoder(selfies);
          setSmiles(initialSmiles);
          if (initialSmiles) {
            updateMoleculeVisualization(RDKitModule, initialSmiles);
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
  
  // Update molecule visualization
  const updateMoleculeVisualization = (rdkitModule: RDKitModule, smilesStr: string) => {
    try {
      if (!smilesStr) {
        setSvgContent('');
        return;
      }
      
      const mol = rdkitModule.get_mol(smilesStr);
      if (mol) {
        const svg = mol.get_svg();
        setSvgContent(svg);
        mol.delete();
      } else {
        setSvgContent('');
      }
    } catch (err) {
      console.error('Failed to generate molecule visualization:', err);
      setSvgContent('');
    }
  };
  
  // Decode SELFIES to SMILES
  const decodeSelfies = useCallback(() => {
    try {
      const result = decoder(selfies);
      setSmiles(result);
      setError('');
      
      if (rdkit && result) {
        updateMoleculeVisualization(rdkit, result);
        
        // Add to history
        setHistory(prev => [{selfies, smiles: result}, ...prev.slice(0, 9)]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decoding failed');
      setSmiles('');
      setSvgContent('');
    }
  }, [selfies, rdkit]);
  
  // Generate random SELFIES
  const generateRandom = useCallback(() => {
    const randomSelfies = generateSmartRandomSelfies(Math.floor(Math.random() * 10) + 10);
    setSelfies(randomSelfies);
    
    try {
      const randomSmiles = decoder(randomSelfies);
      setSmiles(randomSmiles);
      setError('');
      
      if (rdkit && randomSmiles) {
        updateMoleculeVisualization(rdkit, randomSmiles);
        setHistory(prev => [{selfies: randomSelfies, smiles: randomSmiles}, ...prev.slice(0, 9)]);
      }
    } catch (err) {
      setError('Generated invalid SELFIES - try again');
      setSmiles('');
      setSvgContent('');
    }
  }, [rdkit]);
  
  // Generate from random alphabet sampling (Python-style)
  const generateFromAlphabet = useCallback(() => {
    const newSelfies = generateRandomSampleSelfies(9);
    setSelfies(newSelfies);
    
    try {
      const newSmiles = decoder(newSelfies);
      setSmiles(newSmiles);
      setError('');
      
      if (rdkit && newSmiles) {
        updateMoleculeVisualization(rdkit, newSmiles);
        setHistory(prev => [{selfies: newSelfies, smiles: newSmiles}, ...prev.slice(0, 9)]);
      }
    } catch (err) {
      setError('Generated invalid SELFIES - try again');
      setSmiles('');
      setSvgContent('');
    }
  }, [rdkit]);
  
  // Load from history
  const loadFromHistory = (item: {selfies: string, smiles: string}) => {
    setSelfies(item.selfies);
    setSmiles(item.smiles);
    setError('');
    if (rdkit && item.smiles) {
      updateMoleculeVisualization(rdkit, item.smiles);
    }
  };
  
  const alphabet = Array.from(getSemanticRobustAlphabet());
  
  return (
    <div className={styles.container}>
      <div className={styles.mainContent}>
        <div className={styles.inputSection}>
          <div className={styles.card}>
            <h3>Input SELFIES String</h3>
            <textarea
              value={selfies}
              onChange={(e) => setSelfies(e.target.value)}
              className={styles.textarea}
              placeholder="Enter SELFIES string (e.g., [C][=C][C][Branch1][C][F])"
              rows={3}
            />
            
            <div className={styles.buttonGroup}>
              <button 
                onClick={decodeSelfies} 
                className="button button--primary"
                disabled={loading || !selfies}
              >
                Decode to SMILES
              </button>
              <button 
                onClick={generateRandom} 
                className="button button--secondary"
                disabled={loading}
              >
                Random SELFIES
              </button>
              <button 
                onClick={generateFromAlphabet} 
                className="button button--secondary"
                disabled={loading}
              >
                Random Sample
              </button>
              <button 
                onClick={() => setShowAlphabet(!showAlphabet)}
                className="button button--outline button--secondary"
              >
                {showAlphabet ? 'Hide' : 'Show'} Alphabet ({alphabet.length})
              </button>
            </div>
          </div>
          
          {selfies && (
            <div className={styles.card}>
              <h3>SELFIES Tokens</h3>
              <div className={styles.tokenContainer}>
                {splitSelfies(selfies).map((symbol, idx) => (
                  <span key={idx} className={styles.token}>
                    {symbol}
                  </span>
                ))}
              </div>
              <div className={styles.info}>
                {(() => {
                  const stats = getSelfiesStats(selfies);
                  return (
                    <>
                      <div>{stats.totalSymbols} symbols</div>
                      <div>{stats.atomCount} atoms • {stats.branchCount} branches • {stats.ringCount} rings</div>
                      <div>Elements: {Array.from(stats.uniqueElements).join(', ')}</div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
          
          {smiles && (
            <div className={styles.card}>
              <h3>SMILES Output</h3>
              <div className={styles.smilesOutput}>
                {smiles}
              </div>
            </div>
          )}
          
          {error && (
            <div className="alert alert--danger" role="alert">
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>
        
        <div className={styles.visualizationSection}>
          <div className={styles.card}>
            <h3>Molecule Visualization</h3>
            {loading ? (
              <div className={styles.loadingMessage}>Loading RDKit...</div>
            ) : svgContent ? (
              <div 
                className={styles.moleculeViewer}
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            ) : (
              <div className={styles.placeholder}>
                {smiles ? 'Unable to visualize molecule' : 'Generate a molecule to visualize'}
              </div>
            )}
          </div>
          
          {history.length > 0 && (
            <div className={styles.card}>
              <h3>Recent Molecules</h3>
              <div className={styles.historyList}>
                {history.map((item, idx) => (
                  <button
                    key={idx}
                    className={styles.historyItem}
                    onClick={() => loadFromHistory(item)}
                    title={`SELFIES: ${item.selfies}`}
                  >
                    <span className={styles.historySmiles}>{item.smiles}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {showAlphabet && (
        <div className={styles.card}>
          <h3>Semantic Robust Alphabet ({alphabet.length} symbols)</h3>
          <div className={styles.alphabetGrid}>
            {alphabet.map((symbol, idx) => (
              <button
                key={idx}
                className={styles.alphabetSymbol}
                onClick={() => setSelfies(prev => prev + symbol)}
                title="Click to append to SELFIES string"
              >
                {symbol}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}