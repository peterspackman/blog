import React from 'react';
import styles from './CalculationSettings.module.css';

interface CalculationSettingsProps {
  method: string;
  setMethod: (method: string) => void;
  basisSet: string;
  setBasisSet: (basis: string) => void;
  maxIterations: number;
  setMaxIterations: (iterations: number) => void;
  energyTolerance: number;
  setEnergyTolerance: (tolerance: number) => void;
  logLevel: number;
  setLogLevel: (level: number) => void;
  optimize: boolean;
  setOptimize: (optimize: boolean) => void;
  computeFrequencies: boolean;
  setComputeFrequencies: (compute: boolean) => void;
}

const CalculationSettings: React.FC<CalculationSettingsProps> = ({
  method,
  setMethod,
  basisSet,
  setBasisSet,
  maxIterations,
  setMaxIterations,
  energyTolerance,
  setEnergyTolerance,
  logLevel,
  setLogLevel,
  optimize,
  setOptimize,
  computeFrequencies,
  setComputeFrequencies
}) => {
  return (
    <>
      <div className={styles.section}>
        <h3>Calculation Method</h3>
        
        <div className={styles.field}>
          <label>Theory Level</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="hf">Hartree-Fock (HF)</option>
            <option value="dft-b3lyp">DFT (B3LYP)</option>
            <option value="dft-pbe">DFT (PBE)</option>
            <option value="dft-pbe0">DFT (PBE0)</option>
            <option value="dft-blyp">DFT (BLYP)</option>
            <option value="dft-wb97x">DFT (ωB97X)</option>
          </select>
        </div>
        
        <div className={styles.field}>
          <label>Basis Set</label>
          <select value={basisSet} onChange={(e) => setBasisSet(e.target.value)}>
            <option value="sto-3g">STO-3G</option>
            <option value="3-21g">3-21G</option>
            <option value="6-31g">6-31G</option>
            <option value="6-31g(d,p)">6-31G(d,p)</option>
            <option value="6-311g(d,p)">6-311G(d,p)</option>
            <option value="def2-svp">def2-SVP</option>
            <option value="def2-tzvp">def2-TZVP</option>
            <option value="cc-pvdz">cc-pVDZ</option>
            <option value="cc-pvtz">cc-pVTZ</option>
            <option value="cc-pvqz">cc-pVQZ</option>
            <option value="pcseg-0">pc-0</option>
            <option value="pcseg-1">pc-1</option>
            <option value="pcseg-2">pc-2</option>
            <option value="pcseg-3">pc-3</option>
            <option value="aug-pcseg-1">aug-pc-1</option>
            <option value="aug-pcseg-2">aug-pc-2</option>
          </select>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Calculation Options</h3>
        
        <div className={styles.field}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={optimize}
              onChange={(e) => setOptimize(e.target.checked)}
            />
            <span>Geometry Optimization</span>
          </label>
          <small className={styles.fieldDescription}>
            Optimize molecular geometry to find minimum energy structure
          </small>
        </div>
        
        <div className={styles.field}>
          <label className={`${styles.checkboxLabel} ${!optimize ? styles.disabled : ''}`}>
            <input
              type="checkbox"
              checked={computeFrequencies}
              onChange={(e) => setComputeFrequencies(e.target.checked)}
              disabled={!optimize}
            />
            <span>Vibrational Frequencies</span>
          </label>
          <small className={styles.fieldDescription}>
            Calculate vibrational frequencies after optimization (requires optimization)
          </small>
        </div>
      </div>

      <div className={styles.section}>
        <h3>SCF Settings</h3>
        
        <div className={styles.field}>
          <label>Max Iterations</label>
          <input
            type="number"
            min="10"
            max="500"
            value={maxIterations}
            onChange={(e) => setMaxIterations(parseInt(e.target.value))}
          />
        </div>
        
        <div className={styles.field}>
          <label>Energy Tolerance</label>
          <select 
            value={energyTolerance.toString()} 
            onChange={(e) => setEnergyTolerance(parseFloat(e.target.value))}
          >
            <option value="1e-6">1e-6</option>
            <option value="1e-7">1e-7</option>
            <option value="1e-8">1e-8</option>
            <option value="1e-9">1e-9</option>
            <option value="1e-10">1e-10</option>
          </select>
        </div>
        
        <div className={styles.field}>
          <label>Log Level</label>
          <select value={logLevel} onChange={(e) => setLogLevel(parseInt(e.target.value))}>
            <option value="0">Trace</option>
            <option value="1">Debug</option>
            <option value="2">Info</option>
            <option value="3">Warning</option>
            <option value="4">Error</option>
            <option value="5">Critical</option>
          </select>
        </div>
      </div>
    </>
  );
};

export default CalculationSettings;