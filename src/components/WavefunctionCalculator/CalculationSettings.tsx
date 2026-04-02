import React from 'react';
import styles from './CalculationSettings.module.css';
import type { SCFSettings } from './types';

interface CalculationSettingsProps {
  settings: SCFSettings;
  updateSettings: (updates: Partial<SCFSettings>) => void;
}

const CalculationSettings: React.FC<CalculationSettingsProps> = ({
  settings,
  updateSettings,
}) => {
  return (
    <>
      <div className={styles.section}>
        <div className={styles.field}>
          <label>Method</label>
          <select value={settings.method} onChange={(e) => updateSettings({ method: e.target.value })}>
            <option value="hf">Hartree-Fock</option>
            <option value="b3lyp">B3LYP</option>
            <option value="pbe">PBE</option>
            <option value="pbe0">PBE0</option>
            <option value="blyp">BLYP</option>
            <option value="wb97x">wB97X</option>
          </select>
        </div>

        <div className={styles.field}>
          <label>Basis Set</label>
          <select value={settings.basisSet} onChange={(e) => updateSettings({ basisSet: e.target.value })}>
            <option value="sto-3g">STO-3G</option>
            <option value="3-21g">3-21G</option>
            <option value="6-31g">6-31G</option>
            <option value="6-31g(d,p)">6-31G(d,p)</option>
            <option value="def2-svp">def2-SVP</option>
            <option value="def2-tzvp">def2-TZVP</option>
            <option value="cc-pvdz">cc-pVDZ</option>
          </select>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.field}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={settings.optimize}
              onChange={(e) => updateSettings({ optimize: e.target.checked })}
            />
            <span>Optimize Geometry</span>
          </label>
        </div>

        <div className={styles.field}>
          <label className={`${styles.checkboxLabel} ${!settings.optimize ? styles.disabled : ''}`}>
            <input
              type="checkbox"
              checked={settings.computeFrequencies}
              onChange={(e) => updateSettings({ computeFrequencies: e.target.checked })}
              disabled={!settings.optimize}
            />
            <span>Calculate Frequencies</span>
          </label>
        </div>
      </div>
    </>
  );
};

export default CalculationSettings;
