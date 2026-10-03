import React from 'react';
import { Select, ToggleSwitch } from '../shared/controls';
import type { SCFSettings } from './types';

export const METHODS = [
  { value: 'hf', label: 'Hartree–Fock' },
  { value: 'b3lyp', label: 'B3LYP' },
  { value: 'pbe', label: 'PBE' },
  { value: 'pbe0', label: 'PBE0' },
  { value: 'blyp', label: 'BLYP' },
  { value: 'wb97x', label: 'ωB97X' },
];

export const BASIS_SETS = [
  { value: 'sto-3g', label: 'STO-3G' },
  { value: '3-21g', label: '3-21G' },
  { value: '6-31g', label: '6-31G' },
  { value: '6-31g(d,p)', label: '6-31G(d,p)' },
  { value: 'def2-svp', label: 'def2-SVP' },
  { value: 'def2-tzvp', label: 'def2-TZVP' },
  { value: 'cc-pvdz', label: 'cc-pVDZ' },
];

interface CalculationSettingsProps {
  settings: SCFSettings;
  updateSettings: (updates: Partial<SCFSettings>) => void;
}

const CalculationSettings: React.FC<CalculationSettingsProps> = ({ settings, updateSettings }) => (
  <>
    <Select label="Method" value={settings.method} onChange={(method) => updateSettings({ method })} options={METHODS} />
    <Select label="Basis set" value={settings.basisSet} onChange={(basisSet) => updateSettings({ basisSet })} options={BASIS_SETS} />
    <ToggleSwitch label="Optimise geometry" checked={settings.optimize} onChange={(optimize) => updateSettings({ optimize })} />
    <ToggleSwitch
      label="Frequencies"
      checked={settings.computeFrequencies}
      onChange={(computeFrequencies) => updateSettings({ computeFrequencies })}
      disabled={!settings.optimize}
    />
  </>
);

export default CalculationSettings;
