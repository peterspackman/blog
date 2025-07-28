import React from 'react';
import styles from './ResultsDisplay.module.css';

interface CalculationResult {
  energy: number;
  energyInEV: number;
  elapsedMs: number;
  converged: boolean;
  properties?: {
    homo?: number;
    lumo?: number;
    gap?: number;
  };
  wavefunctionData?: {
    fchk?: string;
    numBasisFunctions: number;
    numAtoms: number;
  };
  matrices?: any;
  orbitalEnergies?: number[];
}

interface ResultsDisplayProps {
  results: CalculationResult | null;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ results }) => {
  if (!results) {
    return (
      <div className={styles.noResults}>
        <h3>No Results Yet</h3>
        <p>Run a calculation to see results here.</p>
      </div>
    );
  }

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const milliseconds = Math.round(ms % 1000);
    return `${seconds}s ${milliseconds}ms`;
  };

  const downloadWavefunction = (format: 'fchk' | 'json') => {
    if (!results.wavefunctionData) return;

    let content: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case 'fchk':
        if (!results.wavefunctionData.fchk) {
          alert('FCHK data not available.');
          return;
        }
        content = results.wavefunctionData.fchk;
        filename = 'wavefunction.fchk';
        mimeType = 'text/plain';
        break;
      case 'json':
        content = JSON.stringify({
          energy: results.energy,
          energyInEV: results.energyInEV,
          properties: results.properties,
          numBasisFunctions: results.wavefunctionData.numBasisFunctions,
          numAtoms: results.wavefunctionData.numAtoms,
          calculationTime: results.elapsedMs
        }, null, 2);
        filename = 'wavefunction.json';
        mimeType = 'application/json';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      <div className={styles.summaryGrid}>
        <div className={styles.energyCard}>
          <h4>Total Energy</h4>
          <div className={styles.energyValues}>
            <div className={styles.primaryEnergy}>{results.energy.toFixed(8)} Eh</div>
            <div className={styles.secondaryEnergy}>{results.energyInEV.toFixed(6)} eV</div>
          </div>
        </div>
        
        <div className={styles.statusCard}>
          <h4>Status</h4>
          <div className={styles.statusInfo}>
            <div className={`${styles.convergenceStatus} ${results.converged ? styles.converged : styles.notConverged}`}>
              {results.converged ? '✓ Converged' : '✗ Not Converged'}
            </div>
            <div className={styles.timing}>{formatTime(results.elapsedMs)}</div>
          </div>
        </div>

        {results.properties && (
          <div className={styles.propertiesCard}>
            <h4>Key Properties</h4>
            <div className={styles.propertyList}>
              {results.properties.homo !== undefined && (
                <div className={styles.propertyItem}>
                  <span className={styles.propertyLabel}>HOMO:</span>
                  <span className={styles.propertyValue}>{results.properties.homo.toFixed(6)} Eh</span>
                </div>
              )}
              {results.properties.lumo !== undefined && (
                <div className={styles.propertyItem}>
                  <span className={styles.propertyLabel}>LUMO:</span>
                  <span className={styles.propertyValue}>{results.properties.lumo.toFixed(6)} Eh</span>
                </div>
              )}
              {results.properties.gap !== undefined && (
                <div className={styles.propertyItem}>
                  <span className={styles.propertyLabel}>Gap:</span>
                  <span className={styles.propertyValue}>{results.properties.gap.toFixed(6)} Eh</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {results.wavefunctionData && (
        <div className={styles.exportSection}>
          <h4>Export Wavefunction</h4>
          <div className={styles.exportButtons}>
            <button 
              className={styles.exportButton}
              onClick={() => downloadWavefunction('json')}
            >
              ↓ JSON
            </button>
            {results.wavefunctionData.fchk && (
              <button 
                className={styles.exportButton}
                onClick={() => downloadWavefunction('fchk')}
              >
                ↓ FCHK
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsDisplay;