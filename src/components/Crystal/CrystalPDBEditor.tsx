import React, { useState, useCallback } from 'react';
import { useCrystal } from './CrystalContext';

// mmCIF structure templates
const CIF_PRESETS = {
  nacl: `data_NaCl

_cell_length_a    5.640
_cell_length_b    5.640
_cell_length_c    5.640
_cell_angle_alpha    90.0
_cell_angle_beta     90.0
_cell_angle_gamma    90.0

_symmetry_space_group_name_H-M    'P 1'

loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_occupancy
Na1  Na  0.0  0.0  0.0  1.0
Na2  Na  0.0  0.5  0.5  1.0
Na3  Na  0.5  0.0  0.5  1.0
Na4  Na  0.5  0.5  0.0  1.0
Cl1  Cl  0.5  0.5  0.5  1.0
Cl2  Cl  0.5  0.0  0.0  1.0
Cl3  Cl  0.0  0.5  0.0  1.0
Cl4  Cl  0.0  0.0  0.5  1.0`,

  diamond: `data_Diamond
#
_cell_length_a                   3.567
_cell_length_b                   3.567
_cell_length_c                   3.567
_cell_angle_alpha                90.0
_cell_angle_beta                 90.0
_cell_angle_gamma                90.0
_symmetry_space_group_name_H-M   'P 1'
#
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
C1  C  0.0     0.0     0.0
C2  C  0.25    0.25    0.25
C3  C  0.5     0.5     0.0
C4  C  0.75    0.75    0.25
C5  C  0.5     0.0     0.5
C6  C  0.0     0.5     0.5
C7  C  0.25    0.75    0.75
C8  C  0.75    0.25    0.75`,

  simple_cubic: `data_SimpleCubic
#
_cell_length_a                   3.0
_cell_length_b                   3.0
_cell_length_c                   3.0
_cell_angle_alpha                90.0
_cell_angle_beta                 90.0
_cell_angle_gamma                90.0
_symmetry_space_group_name_H-M   'P 1'
#
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
X1  X  0.0  0.0  0.0`,

  bcc: `data_BCC_Iron
#
_cell_length_a                   2.866
_cell_length_b                   2.866
_cell_length_c                   2.866
_cell_angle_alpha                90.0
_cell_angle_beta                 90.0
_cell_angle_gamma                90.0
_symmetry_space_group_name_H-M   'P 1'
#
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Fe1  Fe  0.0  0.0  0.0
Fe2  Fe  0.5  0.5  0.5`,

  fcc: `data_FCC_Gold
#
_cell_length_a                   4.078
_cell_length_b                   4.078
_cell_length_c                   4.078
_cell_angle_alpha                90.0
_cell_angle_beta                 90.0
_cell_angle_gamma                90.0
_symmetry_space_group_name_H-M   'P 1'
#
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Au1  Au  0.0  0.0  0.0
Au2  Au  0.5  0.5  0.0
Au3  Au  0.5  0.0  0.5
Au4  Au  0.0  0.5  0.5`,

  hexagonal: `data_HCP_Magnesium
#
_cell_length_a                   3.209
_cell_length_b                   3.209
_cell_length_c                   5.211
_cell_angle_alpha                90.0
_cell_angle_beta                 90.0
_cell_angle_gamma                120.0
_symmetry_space_group_name_H-M   'P 1'
#
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Mg1  Mg  0.0    0.0    0.0
Mg2  Mg  0.333  0.667  0.5`
};

interface CrystalCIFEditorProps {
  height?: string;
}

const CrystalCIFEditor: React.FC<CrystalCIFEditorProps> = ({ height = '400px' }) => {
  const { updateStructure } = useCrystal();
  const [cifContent, setCifContent] = useState(CIF_PRESETS.nacl);
  const [selectedPreset, setSelectedPreset] = useState('nacl');
  const [error, setError] = useState('');

  // Apply CIF content to viewer
  const applyCIF = useCallback(() => {
    try {
      // Basic validation
      if (!cifContent.trim()) {
        setError('CIF content cannot be empty');
        return;
      }
      
      if (!cifContent.includes('_atom_site_')) {
        setError('CIF must contain atom site data');
        return;
      }
      
      // Create a blob and update the structure
      const blob = new Blob([cifContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      // Update to use the blob URL
      updateStructure(url);
      setError('');
      
      // Clean up the URL after a short delay
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      setError(`Error applying CIF: ${err.message}`);
    }
  }, [cifContent, updateStructure]);

  // Load preset
  const loadPreset = (presetKey: string) => {
    setSelectedPreset(presetKey);
    setCifContent(CIF_PRESETS[presetKey]);
    setError('');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      padding: '1rem',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      border: '1px solid #ddd'
    }}>
      {/* Preset selector */}
      <div>
        <div style={{ 
          fontSize: '0.8rem', 
          fontWeight: '500', 
          color: '#666',
          marginBottom: '0.5rem',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Load Preset Structure
        </div>
        <select
          value={selectedPreset}
          onChange={(e) => loadPreset(e.target.value)}
          style={{
            width: '100%',
            padding: '0.4rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '0.75rem',
            backgroundColor: 'white'
          }}
        >
          <option value="nacl">NaCl (Rock Salt)</option>
          <option value="diamond">Diamond</option>
          <option value="simple_cubic">Simple Cubic</option>
          <option value="bcc">Body-Centered Cubic (BCC)</option>
          <option value="fcc">Face-Centered Cubic (FCC)</option>
          <option value="hexagonal">Hexagonal Close-Packed (HCP)</option>
        </select>
      </div>

      {/* CIF Editor */}
      <div>
        <div style={{ 
          fontSize: '0.8rem', 
          fontWeight: '500', 
          color: '#666',
          marginBottom: '0.5rem',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          mmCIF Structure Editor
        </div>
        <textarea
          value={cifContent}
          onChange={(e) => setCifContent(e.target.value)}
          style={{
            width: '100%',
            height: height,
            fontFamily: 'monospace',
            fontSize: '0.7rem',
            padding: '0.5rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: 'white',
            resize: 'vertical'
          }}
          spellCheck={false}
        />
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          padding: '0.5rem',
          backgroundColor: '#fee',
          color: '#c53030',
          borderRadius: '4px',
          fontSize: '0.75rem'
        }}>
          {error}
        </div>
      )}

      {/* Apply button */}
      <button
        onClick={applyCIF}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '0.8rem',
          fontWeight: '500',
          cursor: 'pointer',
          transition: 'background-color 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
      >
        Apply mmCIF Structure
      </button>

      {/* Help text */}
      <div style={{ fontSize: '0.65rem', color: '#666', marginTop: '0.5rem' }}>
        <strong>mmCIF Format:</strong>
        <ul style={{ margin: '0.3rem 0 0 1.2rem', padding: 0 }}>
          <li><strong>_cell_length_*:</strong> unit cell dimensions (a, b, c in Å)</li>
          <li><strong>_cell_angle_*:</strong> unit cell angles (alpha, beta, gamma in degrees)</li>
          <li><strong>_atom_site_fract_*:</strong> fractional coordinates (0-1)</li>
          <li><strong>_atom_site_type_symbol:</strong> element symbol (Na, Cl, etc.)</li>
          <li>Edit fractional coordinates to move atoms, add/remove atom lines</li>
        </ul>
      </div>
    </div>
  );
};

export default CrystalCIFEditor;