import React, { useState, useCallback, useEffect } from 'react';
import { useCrystal } from './CrystalContext';

interface Atom {
  id: string;
  element: string;
  x: number;
  y: number;
  z: number;
  label: string;
}

interface UnitCell {
  a: number;
  b: number;
  c: number;
  alpha: number;
  beta: number;
  gamma: number;
}

// Predefined structure data
const STRUCTURE_PRESETS = {
  nacl: {
    name: "Sodium Chloride (NaCl)",
    unitCell: { a: 5.64, b: 5.64, c: 5.64, alpha: 90, beta: 90, gamma: 90 },
    atoms: [
      { id: "1", element: "Na", x: 0.0, y: 0.0, z: 0.0, label: "Na1" },
      { id: "2", element: "Na", x: 0.0, y: 0.5, z: 0.5, label: "Na2" },
      { id: "3", element: "Na", x: 0.5, y: 0.0, z: 0.5, label: "Na3" },
      { id: "4", element: "Na", x: 0.5, y: 0.5, z: 0.0, label: "Na4" },
      { id: "5", element: "Cl", x: 0.5, y: 0.5, z: 0.5, label: "Cl1" },
      { id: "6", element: "Cl", x: 0.5, y: 0.0, z: 0.0, label: "Cl2" },
      { id: "7", element: "Cl", x: 0.0, y: 0.5, z: 0.0, label: "Cl3" },
      { id: "8", element: "Cl", x: 0.0, y: 0.0, z: 0.5, label: "Cl4" }
    ]
  },
  bcc: {
    name: "Body-Centered Cubic (BCC)",
    unitCell: { a: 2.866, b: 2.866, c: 2.866, alpha: 90, beta: 90, gamma: 90 },
    atoms: [
      { id: "1", element: "Fe", x: 0.0, y: 0.0, z: 0.0, label: "Fe1" },
      { id: "2", element: "Fe", x: 0.5, y: 0.5, z: 0.5, label: "Fe2" }
    ]
  },
  fcc: {
    name: "Face-Centered Cubic (FCC)",
    unitCell: { a: 4.078, b: 4.078, c: 4.078, alpha: 90, beta: 90, gamma: 90 },
    atoms: [
      { id: "1", element: "Au", x: 0.0, y: 0.0, z: 0.0, label: "Au1" },
      { id: "2", element: "Au", x: 0.5, y: 0.5, z: 0.0, label: "Au2" },
      { id: "3", element: "Au", x: 0.5, y: 0.0, z: 0.5, label: "Au3" },
      { id: "4", element: "Au", x: 0.0, y: 0.5, z: 0.5, label: "Au4" }
    ]
  },
  simple: {
    name: "Simple Cubic",
    unitCell: { a: 3.0, b: 3.0, c: 3.0, alpha: 90, beta: 90, gamma: 90 },
    atoms: [
      { id: "1", element: "X", x: 0.0, y: 0.0, z: 0.0, label: "X1" }
    ]
  }
};

// Convert fractional to Cartesian coordinates
const fractionalToCartesian = (fract: [number, number, number], unitCell: UnitCell): [number, number, number] => {
  const { a, b, c, alpha, beta, gamma } = unitCell;
  const [x, y, z] = fract;
  
  // Convert angles to radians
  const alphaRad = (alpha * Math.PI) / 180;
  const betaRad = (beta * Math.PI) / 180;
  const gammaRad = (gamma * Math.PI) / 180;
  
  const cosAlpha = Math.cos(alphaRad);
  const cosBeta = Math.cos(betaRad);
  const cosGamma = Math.cos(gammaRad);
  const sinAlpha = Math.sin(alphaRad);
  const sinBeta = Math.sin(betaRad);
  const sinGamma = Math.sin(gammaRad);
  
  // Volume calculation
  const volume = a * b * c * Math.sqrt(
    1 + 2 * cosAlpha * cosBeta * cosGamma - 
    cosAlpha * cosAlpha - cosBeta * cosBeta - cosGamma * cosGamma
  );
  
  // Transformation matrix for fractional to Cartesian
  const cartX = a * x + b * cosGamma * y + c * cosBeta * z;
  const cartY = b * sinGamma * y + c * (cosAlpha - cosBeta * cosGamma) / sinGamma * z;
  const cartZ = (volume / (a * b * sinGamma)) * z;
  
  return [cartX, cartY, cartZ];
};

// Generate PDB content from structure data
const generatePDB = (name: string, unitCell: UnitCell, atoms: Atom[]): string => {
  let pdb = `HEADER    CUSTOM CRYSTAL STRUCTURE                     ${new Date().toISOString().slice(0, 10)}\n`;
  pdb += `TITLE     ${name}\n`;
  
  // Unit cell information
  const { a, b, c, alpha, beta, gamma } = unitCell;
  pdb += `CRYST1${a.toFixed(3).padStart(9)}${b.toFixed(3).padStart(9)}${c.toFixed(3).padStart(9)}`;
  pdb += `${alpha.toFixed(2).padStart(7)}${beta.toFixed(2).padStart(7)}${gamma.toFixed(2).padStart(7)} P 1           1\n`;
  
  // Atoms
  atoms.forEach((atom, index) => {
    const [cartX, cartY, cartZ] = fractionalToCartesian([atom.x, atom.y, atom.z], unitCell);
    const atomNum = (index + 1).toString().padStart(5);
    const atomName = atom.element.padEnd(4);
    const resName = 'CRY'.padEnd(3);
    const chainId = 'A';
    const resNum = '1'.padStart(4);
    
    pdb += `ATOM  ${atomNum} ${atomName} ${resName} ${chainId}${resNum}    `;
    pdb += `${cartX.toFixed(3).padStart(8)}${cartY.toFixed(3).padStart(8)}${cartZ.toFixed(3).padStart(8)}`;
    pdb += `  1.00 20.00           ${atom.element.padStart(2)}\n`;
  });
  
  pdb += 'END\n';
  
  return pdb;
};

interface CrystalGUIEditorProps {
  height?: string;
}

const CrystalGUIEditor: React.FC<CrystalGUIEditorProps> = ({ height = '500px' }) => {
  const { updateCustomStructure } = useCrystal();
  const [selectedPreset, setSelectedPreset] = useState('');
  const [structureName, setStructureName] = useState('New Crystal Structure');
  const [unitCell, setUnitCell] = useState<UnitCell>({ a: 3.0, b: 3.0, c: 3.0, alpha: 90, beta: 90, gamma: 90 });
  const [atoms, setAtoms] = useState<Atom[]>([]);
  const [error, setError] = useState('');

  // Load preset
  const loadPreset = (presetKey: string) => {
    const preset = STRUCTURE_PRESETS[presetKey];
    setSelectedPreset(presetKey);
    setStructureName(preset.name);
    setUnitCell(preset.unitCell);
    setAtoms(preset.atoms);
    setError('');
  };

  // Update unit cell parameter
  const updateUnitCellParam = (param: keyof UnitCell, value: number) => {
    setUnitCell(prev => ({ ...prev, [param]: value }));
  };

  // Update atom
  const updateAtom = (id: string, field: keyof Atom, value: string | number) => {
    setAtoms(prev => prev.map(atom => 
      atom.id === id ? { ...atom, [field]: value } : atom
    ));
  };

  // Add new atom
  const addAtom = () => {
    const newId = (Math.max(...atoms.map(a => parseInt(a.id))) + 1).toString();
    setAtoms(prev => [...prev, {
      id: newId,
      element: 'H',
      x: 0.0,
      y: 0.0,
      z: 0.0,
      label: `H${newId}`
    }]);
  };

  // Remove atom
  const removeAtom = (id: string) => {
    setAtoms(prev => prev.filter(atom => atom.id !== id));
  };

  // Apply structure
  const applyStructure = useCallback(() => {
    try {
      if (atoms.length === 0) {
        setError('Structure must contain at least one atom');
        return;
      }

      // Convert to the CustomCrystalStructure format
      const customStructure = {
        name: structureName,
        description: `Custom structure with ${atoms.length} atoms`,
        unitCell: {
          a: unitCell.a,
          b: unitCell.b,
          c: unitCell.c,
          alpha: unitCell.alpha,
          beta: unitCell.beta,
          gamma: unitCell.gamma
        },
        atoms: atoms.map(atom => ({
          element: atom.element,
          position: [atom.x, atom.y, atom.z] as [number, number, number]
        }))
      };
      
      updateCustomStructure(customStructure);
      setError('');
    } catch (err) {
      setError(`Error applying structure: ${err.message}`);
    }
  }, [structureName, unitCell, atoms, updateCustomStructure]);

  // Auto-update structure when data changes (with debouncing)
  useEffect(() => {
    // Only auto-update if we have atoms to display
    if (atoms.length === 0) return;

    const timeoutId = setTimeout(() => {
      applyStructure();
    }, 100); // 100ms debounce

    return () => clearTimeout(timeoutId);
  }, [unitCell, atoms, structureName, applyStructure]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.8rem',
      padding: '1rem',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      border: '1px solid #ddd',
      height: height,
      overflow: 'auto'
    }}>
      {/* Top section - compact layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
        {/* Preset selector */}
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#666', marginBottom: '0.2rem' }}>
            Load Preset
          </label>
          <select
            value={selectedPreset}
            onChange={(e) => e.target.value && loadPreset(e.target.value)}
            style={{
              width: '100%',
              padding: '0.3rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '0.7rem'
            }}
          >
            <option value="">-- Select preset --</option>
            <option value="nacl">NaCl (Rock Salt)</option>
            <option value="bcc">BCC Iron</option>
            <option value="fcc">FCC Gold</option>
            <option value="simple">Simple Cubic</option>
          </select>
        </div>

        {/* Structure name */}
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#666', marginBottom: '0.2rem' }}>
            Structure Name
          </label>
          <input
            type="text"
            value={structureName}
            onChange={(e) => setStructureName(e.target.value)}
            style={{
              width: '100%',
              padding: '0.3rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '0.7rem'
            }}
            placeholder="Crystal name"
          />
        </div>
      </div>

      {/* Unit cell parameters - compact layout */}
      <div>
        <div style={{ fontSize: '0.8rem', fontWeight: '500', color: '#666', marginBottom: '0.4rem' }}>
          Unit Cell Parameters
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '0.4rem' }}>
          {['a', 'b', 'c'].map(param => (
            <div key={param}>
              <label style={{ fontSize: '0.65rem', color: '#666', display: 'block' }}>{param} (Å)</label>
              <input
                type="number"
                step="0.1"
                value={unitCell[param]}
                onChange={(e) => updateUnitCellParam(param as keyof UnitCell, parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '0.25rem',
                  border: '1px solid #ddd',
                  borderRadius: '3px',
                  fontSize: '0.7rem'
                }}
              />
            </div>
          ))}
          {['alpha', 'beta', 'gamma'].map(param => (
            <div key={param}>
              <label style={{ fontSize: '0.65rem', color: '#666', display: 'block' }}>{param} (°)</label>
              <input
                type="number"
                step="0.5"
                value={unitCell[param]}
                onChange={(e) => updateUnitCellParam(param as keyof UnitCell, parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '0.25rem',
                  border: '1px solid #ddd',
                  borderRadius: '3px',
                  fontSize: '0.7rem'
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Atoms - expanded layout */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '500', color: '#666' }}>
            Atoms (Fractional Coordinates)
          </div>
          <button
            onClick={addAtom}
            style={{
              padding: '0.3rem 0.6rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}
          >
            + Add Atom
          </button>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 80px 35px', gap: '0.3rem', fontSize: '0.65rem', color: '#666', marginBottom: '0.3rem', fontWeight: '500' }}>
          <div>Element</div>
          <div>X</div>
          <div>Y</div>
          <div>Z</div>
          <div>Label</div>
          <div></div>
        </div>
        
        <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e5e5e5', borderRadius: '4px', padding: '0.2rem' }}>
          {atoms.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '2rem', 
              color: '#999', 
              fontSize: '0.8rem',
              fontStyle: 'italic'
            }}>
              No atoms yet. Click "Add Atom" to start building your crystal.
            </div>
          ) : (
            atoms.map(atom => (
              <div key={atom.id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 80px 35px', gap: '0.3rem', marginBottom: '0.3rem', alignItems: 'center' }}>
                <input
                  type="text"
                  value={atom.element}
                  onChange={(e) => updateAtom(atom.id, 'element', e.target.value)}
                  style={{
                    padding: '0.25rem',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    fontSize: '0.7rem',
                    textAlign: 'center'
                  }}
                  placeholder="H"
                />
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={atom.x}
                  onChange={(e) => updateAtom(atom.id, 'x', parseFloat(e.target.value) || 0)}
                  style={{
                    padding: '0.25rem',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    fontSize: '0.7rem'
                  }}
                  placeholder="0.0"
                />
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={atom.y}
                  onChange={(e) => updateAtom(atom.id, 'y', parseFloat(e.target.value) || 0)}
                  style={{
                    padding: '0.25rem',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    fontSize: '0.7rem'
                  }}
                  placeholder="0.0"
                />
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={atom.z}
                  onChange={(e) => updateAtom(atom.id, 'z', parseFloat(e.target.value) || 0)}
                  style={{
                    padding: '0.25rem',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    fontSize: '0.7rem'
                  }}
                  placeholder="0.0"
                />
                <input
                  type="text"
                  value={atom.label}
                  onChange={(e) => updateAtom(atom.id, 'label', e.target.value)}
                  style={{
                    padding: '0.25rem',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    fontSize: '0.7rem'
                  }}
                  placeholder="Label"
                />
                <button
                  onClick={() => removeAtom(atom.id)}
                  style={{
                    padding: '0.25rem',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    fontSize: '0.65rem',
                    cursor: 'pointer',
                    width: '100%'
                  }}
                  title="Remove atom"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
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

      {/* Auto-update info and manual apply button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ 
          fontSize: '0.7rem', 
          color: '#10b981', 
          backgroundColor: '#ecfdf5', 
          padding: '0.3rem 0.5rem', 
          borderRadius: '4px',
          flex: 1
        }}>
          ✓ Auto-updating (100ms delay)
        </div>
        <button
          onClick={applyStructure}
          style={{
            padding: '0.4rem 0.8rem',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '0.75rem',
            cursor: 'pointer'
          }}
          title="Manually apply structure immediately"
        >
          Apply Now
        </button>
      </div>
    </div>
  );
};

export default CrystalGUIEditor;