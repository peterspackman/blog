import React from 'react';
import styles from './CubeSettings.module.css';

export interface CubeGeometrySettings {
  gridSteps: number;
  useAdaptive: boolean;
  bufferDistance: number;
  threshold: number;
  customOrigin: boolean;
  origin: [number, number, number];
  customDirections: boolean;
  directionA: [number, number, number];
  directionB: [number, number, number];
  directionC: [number, number, number];
}

interface CubeSettingsProps {
  settings: CubeGeometrySettings;
  updateSettings: (updates: Partial<CubeGeometrySettings>) => void;
  show: boolean;
  onClose: () => void;
}

const CubeSettings: React.FC<CubeSettingsProps> = ({
  settings,
  updateSettings,
  show,
  onClose
}) => {
  if (!show) return null;

  const handleVectorChange = (
    field: 'origin' | 'directionA' | 'directionB' | 'directionC',
    index: number,
    value: string
  ) => {
    const newVector = [...settings[field]] as [number, number, number];
    newVector[index] = parseFloat(value) || 0;
    updateSettings({ [field]: newVector });
  };

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3>Cube Generation Settings</h3>
          <button
            className={styles.closeButton}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Grid Resolution */}
          <div className={styles.section}>
            <h4>Grid Resolution</h4>
            <div className={styles.field}>
              <label>Grid Steps per Direction</label>
              <input
                type="number"
                min="10"
                max="200"
                value={settings.gridSteps}
                onChange={(e) => updateSettings({ gridSteps: parseInt(e.target.value) || 50 })}
              />
              <small className={styles.fieldDescription}>
                Number of grid points in each direction (default: 50)
              </small>
            </div>
          </div>

          {/* Adaptive Bounds */}
          <div className={styles.section}>
            <h4>Adaptive Bounds</h4>
            <div className={styles.field}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={settings.useAdaptive}
                  onChange={(e) => updateSettings({ useAdaptive: e.target.checked })}
                />
                <span>Use adaptive bounds</span>
              </label>
              <small className={styles.fieldDescription}>
                Automatically determine cube size based on density threshold
              </small>
            </div>

            {settings.useAdaptive && (
              <>
                <div className={styles.field}>
                  <label>Buffer Distance (Å)</label>
                  <input
                    type="number"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={settings.bufferDistance}
                    onChange={(e) => updateSettings({ bufferDistance: parseFloat(e.target.value) || 2.0 })}
                  />
                  <small className={styles.fieldDescription}>
                    Extra space around molecule (default: 2.0 Å)
                  </small>
                </div>

                <div className={styles.field}>
                  <label>Density Threshold</label>
                  <select
                    value={settings.threshold.toString()}
                    onChange={(e) => updateSettings({ threshold: parseFloat(e.target.value) })}
                  >
                    <option value="1e-4">1e-4</option>
                    <option value="1e-5">1e-5 (default)</option>
                    <option value="1e-6">1e-6</option>
                    <option value="1e-7">1e-7</option>
                    <option value="1e-8">1e-8</option>
                  </select>
                  <small className={styles.fieldDescription}>
                    Value threshold for determining bounds
                  </small>
                </div>
              </>
            )}
          </div>

          {/* Custom Origin */}
          <div className={styles.section}>
            <h4>Grid Origin</h4>
            <div className={styles.field}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={settings.customOrigin}
                  onChange={(e) => updateSettings({ customOrigin: e.target.checked })}
                />
                <span>Set custom origin</span>
              </label>
              <small className={styles.fieldDescription}>
                By default, origin is calculated automatically
              </small>
            </div>

            {settings.customOrigin && (
              <div className={styles.vectorInputs}>
                <div className={styles.vectorField}>
                  <label>X</label>
                  <input
                    type="number"
                    step="0.1"
                    value={settings.origin[0]}
                    onChange={(e) => handleVectorChange('origin', 0, e.target.value)}
                  />
                </div>
                <div className={styles.vectorField}>
                  <label>Y</label>
                  <input
                    type="number"
                    step="0.1"
                    value={settings.origin[1]}
                    onChange={(e) => handleVectorChange('origin', 1, e.target.value)}
                  />
                </div>
                <div className={styles.vectorField}>
                  <label>Z</label>
                  <input
                    type="number"
                    step="0.1"
                    value={settings.origin[2]}
                    onChange={(e) => handleVectorChange('origin', 2, e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Custom Directions */}
          <div className={styles.section}>
            <h4>Grid Directions</h4>
            <div className={styles.field}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={settings.customDirections}
                  onChange={(e) => updateSettings({ customDirections: e.target.checked })}
                />
                <span>Set custom grid vectors</span>
              </label>
              <small className={styles.fieldDescription}>
                By default, uses Cartesian axes aligned with molecule
              </small>
            </div>

            {settings.customDirections && (
              <>
                <div className={styles.field}>
                  <label>Direction A (Bohr)</label>
                  <div className={styles.vectorInputs}>
                    <div className={styles.vectorField}>
                      <label>X</label>
                      <input
                        type="number"
                        step="0.1"
                        value={settings.directionA[0]}
                        onChange={(e) => handleVectorChange('directionA', 0, e.target.value)}
                      />
                    </div>
                    <div className={styles.vectorField}>
                      <label>Y</label>
                      <input
                        type="number"
                        step="0.1"
                        value={settings.directionA[1]}
                        onChange={(e) => handleVectorChange('directionA', 1, e.target.value)}
                      />
                    </div>
                    <div className={styles.vectorField}>
                      <label>Z</label>
                      <input
                        type="number"
                        step="0.1"
                        value={settings.directionA[2]}
                        onChange={(e) => handleVectorChange('directionA', 2, e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.field}>
                  <label>Direction B (Bohr)</label>
                  <div className={styles.vectorInputs}>
                    <div className={styles.vectorField}>
                      <label>X</label>
                      <input
                        type="number"
                        step="0.1"
                        value={settings.directionB[0]}
                        onChange={(e) => handleVectorChange('directionB', 0, e.target.value)}
                      />
                    </div>
                    <div className={styles.vectorField}>
                      <label>Y</label>
                      <input
                        type="number"
                        step="0.1"
                        value={settings.directionB[1]}
                        onChange={(e) => handleVectorChange('directionB', 1, e.target.value)}
                      />
                    </div>
                    <div className={styles.vectorField}>
                      <label>Z</label>
                      <input
                        type="number"
                        step="0.1"
                        value={settings.directionB[2]}
                        onChange={(e) => handleVectorChange('directionB', 2, e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.field}>
                  <label>Direction C (Bohr)</label>
                  <div className={styles.vectorInputs}>
                    <div className={styles.vectorField}>
                      <label>X</label>
                      <input
                        type="number"
                        step="0.1"
                        value={settings.directionC[0]}
                        onChange={(e) => handleVectorChange('directionC', 0, e.target.value)}
                      />
                    </div>
                    <div className={styles.vectorField}>
                      <label>Y</label>
                      <input
                        type="number"
                        step="0.1"
                        value={settings.directionC[1]}
                        onChange={(e) => handleVectorChange('directionC', 1, e.target.value)}
                      />
                    </div>
                    <div className={styles.vectorField}>
                      <label>Z</label>
                      <input
                        type="number"
                        step="0.1"
                        value={settings.directionC[2]}
                        onChange={(e) => handleVectorChange('directionC', 2, e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button
            className={styles.secondaryButton}
            onClick={() => {
              // Reset to defaults
              updateSettings({
                gridSteps: 50,
                useAdaptive: true,
                bufferDistance: 2.0,
                threshold: 1e-5,
                customOrigin: false,
                origin: [0, 0, 0],
                customDirections: false,
                directionA: [0, 0, 0],
                directionB: [0, 0, 0],
                directionC: [0, 0, 0]
              });
            }}
          >
            Reset to Defaults
          </button>
          <button
            className={styles.primaryButton}
            onClick={onClose}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default CubeSettings;
