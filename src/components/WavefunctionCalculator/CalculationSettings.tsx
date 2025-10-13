import React from 'react';
import styles from './CalculationSettings.module.css';

interface SCFSettings {
  method: string;
  basisSet: string;
  charge: number;
  multiplicity: number;
  optimize: boolean;
  computeFrequencies: boolean;
  maxIterations: number;
  energyTolerance: number;
  threads: number;
  logLevel: number;
}

interface CalculationSettingsProps {
  settings: SCFSettings;
  updateSettings: (updates: Partial<SCFSettings>) => void;
  showAdvancedSettings: boolean;
  setShowAdvancedSettings: (show: boolean) => void;
}

const CalculationSettings: React.FC<CalculationSettingsProps> = ({
  settings,
  updateSettings,
  showAdvancedSettings,
  setShowAdvancedSettings
}) => {
  return (
    <>
      {/* Simple main settings */}
      <div className={styles.section}>
        <div className={styles.field}>
          <label>Method</label>
          <select value={settings.method} onChange={(e) => updateSettings({ method: e.target.value })}>
            <option value="hf">Hartree-Fock</option>
            <option value="b3lyp">B3LYP</option>
            <option value="pbe">PBE</option>
            <option value="pbe0">PBE0</option>
            <option value="blyp">BLYP</option>
            <option value="wb97x">ωB97X</option>
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

      {/* Advanced settings button */}
      <div className={styles.section}>
        <button
          className={styles.advancedButton}
          onClick={() => setShowAdvancedSettings(true)}
        >
          Advanced Settings...
        </button>
      </div>

      {/* Advanced settings modal */}
      {showAdvancedSettings && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Advanced Settings</h3>
              <button
                className={styles.closeButton}
                onClick={() => setShowAdvancedSettings(false)}
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label>Charge</label>
                <input
                  type="number"
                  min="-5"
                  max="5"
                  step="1"
                  value={settings.charge}
                  onChange={(e) => updateSettings({ charge: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className={styles.field}>
                <label>Multiplicity</label>
                <input
                  type="number"
                  min="1"
                  max="7"
                  step="1"
                  value={settings.multiplicity}
                  onChange={(e) => updateSettings({ multiplicity: parseInt(e.target.value) || 1 })}
                />
                <small className={styles.fieldDescription}>
                  Spin multiplicity (2S+1): 1=singlet, 2=doublet, 3=triplet
                </small>
              </div>

              <div className={styles.field}>
                <label>SCF Max Iterations</label>
                <input
                  type="number"
                  min="10"
                  max="500"
                  value={settings.maxIterations}
                  onChange={(e) => updateSettings({ maxIterations: parseInt(e.target.value) })}
                />
              </div>

              <div className={styles.field}>
                <label>Energy Tolerance</label>
                <select
                  value={settings.energyTolerance.toString()}
                  onChange={(e) => updateSettings({ energyTolerance: parseFloat(e.target.value) })}
                >
                  <option value="1e-6">1e-6</option>
                  <option value="1e-7">1e-7</option>
                  <option value="1e-8">1e-8</option>
                  <option value="1e-9">1e-9</option>
                  <option value="1e-10">1e-10</option>
                </select>
              </div>

              <div className={styles.field}>
                <label>Threads</label>
                <input
                  type="number"
                  min="1"
                  max="16"
                  value={settings.threads}
                  onChange={(e) => updateSettings({ threads: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div className={styles.field}>
                <label>Log Level</label>
                <select value={settings.logLevel} onChange={(e) => updateSettings({ logLevel: parseInt(e.target.value) })}>
                  <option value="0">Trace</option>
                  <option value="1">Debug</option>
                  <option value="2">Info</option>
                  <option value="3">Warning</option>
                  <option value="4">Error</option>
                </select>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.primaryButton}
                onClick={() => setShowAdvancedSettings(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CalculationSettings;