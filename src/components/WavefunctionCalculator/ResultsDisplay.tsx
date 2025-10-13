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
    owfJson?: string;
    numBasisFunctions: number;
    numAtoms: number;
  };
  matrices?: any;
  orbitalEnergies?: number[];
  optimization?: {
    trajectory: {
      energies: number[];
      gradientNorms: number[];
      geometries: string[];
      converged: boolean;
      steps: number;
      finalEnergy: number;
      finalMolecule: any;
    };
    finalXYZ: string;
    steps: number;
    energies: number[];
    gradientNorms: number[];
  };
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

  const downloadWavefunction = (format: 'owf' | 'fchk' | 'summary') => {
    if (!results.wavefunctionData) return;

    let content: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case 'owf':
        if (!results.wavefunctionData.owfJson) {
          alert('Wavefunction data not available.');
          return;
        }
        content = results.wavefunctionData.owfJson;
        filename = 'wavefunction.owf.json';
        mimeType = 'application/json';
        break;
      case 'fchk':
        if (!results.wavefunctionData.fchk) {
          alert('FCHK data not available.');
          return;
        }
        content = results.wavefunctionData.fchk;
        filename = 'wavefunction.fchk';
        mimeType = 'text/plain';
        break;
      case 'summary':
        content = JSON.stringify({
          energy: results.energy,
          energyInEV: results.energyInEV,
          properties: results.properties,
          numBasisFunctions: results.wavefunctionData.numBasisFunctions,
          numAtoms: results.wavefunctionData.numAtoms,
          calculationTime: results.elapsedMs,
          orbitalEnergies: results.orbitalEnergies?.slice(0, 20) // First 20 orbitals
        }, null, 2);
        filename = 'calculation_summary.json';
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

  const downloadOptimizedXYZ = () => {
    if (!results.optimization?.finalXYZ) return;

    const content = results.optimization.finalXYZ;
    const filename = 'optimized_geometry.xyz';
    const mimeType = 'text/plain';

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
      {/* Debug info */}
      <details style={{ marginBottom: '1rem', fontSize: '0.8rem', opacity: 0.7 }}>
        <summary style={{ cursor: 'pointer' }}>Debug Info</summary>
        <pre style={{ fontSize: '0.7rem', overflow: 'auto', maxHeight: '200px' }}>
          {JSON.stringify({
            hasWavefunctionData: !!results.wavefunctionData,
            hasOwfJson: !!results.wavefunctionData?.owfJson,
            owfJsonLength: results.wavefunctionData?.owfJson?.length,
            hasFchk: !!results.wavefunctionData?.fchk,
            hasProperties: !!results.properties,
            hasOrbitalEnergies: !!results.orbitalEnergies,
            orbitalEnergiesCount: results.orbitalEnergies?.length,
            hasOrbitalOccupations: !!results.orbitalOccupations
          }, null, 2)}
        </pre>
      </details>

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
              className={results.wavefunctionData.owfJson ? styles.exportButton : `${styles.exportButton} ${styles.exportButtonDisabled}`}
              onClick={() => results.wavefunctionData.owfJson ? downloadWavefunction('owf') : null}
              disabled={!results.wavefunctionData.owfJson}
              title="Download full wavefunction in OCC format"
            >
              ↓ OWF.JSON
            </button>
            <button
              className={styles.exportButton}
              onClick={() => downloadWavefunction('summary')}
              title="Download calculation summary (energy, orbitals, properties)"
            >
              ↓ Summary
            </button>
            <button
              className={results.wavefunctionData.fchk ? styles.exportButton : `${styles.exportButton} ${styles.exportButtonDisabled}`}
              onClick={() => results.wavefunctionData.fchk ? downloadWavefunction('fchk') : alert('FCHK data not available. Check the calculation logs for details.')}
              disabled={!results.wavefunctionData.fchk}
              title={results.wavefunctionData.fchk ? 'Download FCHK file' : 'FCHK generation not yet implemented via CLI'}
            >
              ↓ FCHK {!results.wavefunctionData.fchk && '(N/A)'}
            </button>
          </div>
        </div>
      )}
      
      {results.optimization && (
        <div className={styles.exportSection}>
          <h4>Export Optimized Geometry</h4>
          <div className={styles.exportButtons}>
            <button 
              className={styles.exportButton}
              onClick={downloadOptimizedXYZ}
              title="Download optimized geometry in XYZ format"
            >
              ↓ Optimized XYZ
            </button>
          </div>
          <div className={styles.optimizationInfo}>
            <div className={styles.infoItem}>
              <span>Status:</span>
              <span className={`${styles.convergenceStatus} ${results.optimization.trajectory.converged ? styles.converged : styles.notConverged}`}>
                {results.optimization.trajectory.converged ? '✓ Converged' : '✗ Not Converged'}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span>Steps:</span>
              <span>{results.optimization.steps}</span>
            </div>
            <div className={styles.infoItem}>
              <span>Final Energy:</span>
              <span>{results.energy.toFixed(8)} Eh</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsDisplay;