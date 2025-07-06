import React, { useEffect, useCallback } from 'react';
import { useUnitCell } from './UnitCellContext';
import { LatticeSystem, CenteringType } from './types';

// Debounce hook
const useDebounce = (callback: Function, delay: number) => {
  const [debounceTimer, setDebounceTimer] = React.useState<NodeJS.Timeout>();

  const debouncedCallback = useCallback((...args: any[]) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    const newTimer = setTimeout(() => {
      callback(...args);
    }, delay);
    setDebounceTimer(newTimer);
  }, [callback, delay, debounceTimer]);

  return debouncedCallback;
};

const UnitCellControls: React.FC = () => {
  const { 
    state, 
    updateParams, 
    updateLatticeSystem, 
    updateCenteringType,
    updateDisplayOptions,
    applyLatticeConstraints 
  } = useUnitCell();

  // Debounce parameter updates to reduce re-renders
  const debouncedUpdateParams = useDebounce(updateParams, 100);

  // Apply constraints when lattice system changes
  useEffect(() => {
    applyLatticeConstraints();
  }, [state.latticeSystem, applyLatticeConstraints]);

  // Get lattice constraints for current system
  const getLatticeConstraints = (system: LatticeSystem) => {
    const constraints = {
      editable: { a: true, b: true, c: true, alpha: true, beta: true, gamma: true }
    };

    switch (system) {
      case 'cubic':
        constraints.editable = { a: true, b: false, c: false, alpha: false, beta: false, gamma: false };
        break;
      case 'tetragonal':
        constraints.editable = { a: true, b: false, c: true, alpha: false, beta: false, gamma: false };
        break;
      case 'orthorhombic':
        constraints.editable = { a: true, b: true, c: true, alpha: false, beta: false, gamma: false };
        break;
      case 'hexagonal':
        constraints.editable = { a: true, b: false, c: true, alpha: false, beta: false, gamma: false };
        break;
      case 'trigonal':
        constraints.editable = { a: true, b: false, c: false, alpha: true, beta: false, gamma: false };
        break;
      case 'monoclinic':
        constraints.editable = { a: true, b: true, c: true, alpha: false, beta: true, gamma: false };
        break;
      case 'triclinic':
      default:
        constraints.editable = { a: true, b: true, c: true, alpha: true, beta: true, gamma: true };
        break;
    }

    return constraints;
  };

  // Get valid centering types for current lattice system
  const getValidCenteringTypes = (system: LatticeSystem): CenteringType[] => {
    switch (system) {
      case 'cubic':
        return ['P', 'I', 'F'];
      case 'tetragonal':
        return ['P', 'I'];
      case 'orthorhombic':
        return ['P', 'I', 'F', 'C'];
      case 'monoclinic':
        return ['P', 'C'];
      case 'hexagonal':
        return ['P']; // Only primitive hexagonal is a true Bravais lattice
      case 'trigonal':
      case 'triclinic':
      default:
        return ['P'];
    }
  };

  const constraints = getLatticeConstraints(state.latticeSystem);
  const validCenteringTypes = getValidCenteringTypes(state.latticeSystem);

  return (
    <div style={{ 
      padding: '1rem',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      border: '1px solid #ddd'
    }}>
      
      {/* Lattice System Selector */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ 
          fontSize: '0.8rem', 
          fontWeight: '500', 
          color: '#666',
          marginBottom: '0.5rem',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Lattice System
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
          {[
            { value: 'cubic', label: 'Cubic', color: '#e3f2fd' },
            { value: 'tetragonal', label: 'Tetragonal', color: '#f3e5f5' },
            { value: 'orthorhombic', label: 'Orthorhombic', color: '#e8f5e8' },
            { value: 'hexagonal', label: 'Hexagonal', color: '#fff3e0' },
            { value: 'trigonal', label: 'Trigonal', color: '#fce4ec' },
            { value: 'monoclinic', label: 'Monoclinic', color: '#e0f2f1' },
            { value: 'triclinic', label: 'Triclinic', color: '#f1f8e9' }
          ].map(system => (
            <button
              key={system.value}
              onClick={() => updateLatticeSystem(system.value as LatticeSystem)}
              style={{
                padding: '0.2rem 0.5rem',
                fontSize: '0.65rem',
                border: state.latticeSystem === system.value ? '2px solid #333' : '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: state.latticeSystem === system.value ? system.color : 'white',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontWeight: state.latticeSystem === system.value ? '600' : '500',
                color: state.latticeSystem === system.value ? '#333' : '#666'
              }}
              onMouseOver={(e) => {
                if (state.latticeSystem !== system.value) {
                  e.currentTarget.style.backgroundColor = system.color;
                  e.currentTarget.style.borderColor = '#999';
                }
              }}
              onMouseOut={(e) => {
                if (state.latticeSystem !== system.value) {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#ddd';
                }
              }}
            >
              {system.label}
            </button>
          ))}
        </div>
      </div>

      {/* Centering Type Selector */}
      {validCenteringTypes.length > 1 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ 
            fontSize: '0.8rem', 
            fontWeight: '500', 
            color: '#666',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Centering Type
          </div>
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            {validCenteringTypes.map(centering => (
              <button
                key={centering}
                onClick={() => updateCenteringType(centering)}
                style={{
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.7rem',
                  border: state.centeringType === centering ? '2px solid #333' : '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: state.centeringType === centering ? '#e3f2fd' : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontWeight: state.centeringType === centering ? '600' : '500'
                }}
              >
                {centering}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Display Options */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ 
          fontSize: '0.8rem', 
          fontWeight: '500', 
          color: '#666',
          marginBottom: '0.5rem',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Display Options
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
          {[
            { key: 'showGrid', label: 'Grid' },
            { key: 'showImages', label: 'Images' },
            { key: 'showLatticePoints', label: 'Lattice Points' },
            { key: 'showMatrixInfo', label: 'Matrix' },
            { key: 'autoRotate', label: 'Auto Rotate' }
          ].map(option => (
            <label key={option.key} style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem', color: '#666' }}>
              <input
                type="checkbox"
                checked={state.displayOptions[option.key as keyof typeof state.displayOptions]}
                onChange={(e) => updateDisplayOptions({ [option.key]: e.target.checked })}
                style={{ marginRight: '0.4rem' }}
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      {/* Length Parameters */}
      {(() => {
        const lengthParams = [
          { key: 'a' as const, label: 'a', color: '#e74c3c', min: 0.5, max: 2.0, step: 0.05 },
          { key: 'b' as const, label: 'b', color: '#2980b9', min: 0.5, max: 2.0, step: 0.05 },
          { key: 'c' as const, label: 'c', color: '#f39c12', min: 0.5, max: 2.0, step: 0.05 }
        ].filter(param => constraints.editable[param.key]);
        
        if (lengthParams.length === 0) return null;
        
        return (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ 
              fontSize: '0.8rem', 
              fontWeight: '500', 
              color: '#666',
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Edge Lengths
            </div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: `repeat(${lengthParams.length}, 1fr)`, 
              gap: '0.6rem' 
            }}>
              {lengthParams.map(({ key, label, color, min, max, step }) => (
                <div key={key}>
                  <label style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: '600', 
                    color: color,
                    display: 'block',
                    marginBottom: '0.2rem'
                  }}>
                    {label}
                  </label>
                  <input
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={state.params[key].toFixed(2)}
                    onChange={(e) => debouncedUpdateParams({ [key]: parseFloat(e.target.value) || min })}
                    style={{
                      width: '100%',
                      padding: '0.3rem',
                      border: `2px solid ${color}20`,
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      textAlign: 'center',
                      backgroundColor: 'white',
                      outline: 'none'
                    }}
                    onFocus={(e) => e.target.style.borderColor = color}
                    onBlur={(e) => e.target.style.borderColor = `${color}20`}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Angle Parameters */}
      {(() => {
        const angleParams = [
          { key: 'alpha' as const, label: 'α', color: '#ff6b6b', min: 60, max: 120, step: 1 },
          { key: 'beta' as const, label: 'β', color: '#4ecdc4', min: 60, max: 120, step: 1 },
          { key: 'gamma' as const, label: 'γ', color: '#45b7d1', min: 60, max: 120, step: 1 }
        ].filter(param => constraints.editable[param.key]);
        
        if (angleParams.length === 0) return null;
        
        return (
          <div>
            <div style={{ 
              fontSize: '0.8rem', 
              fontWeight: '500', 
              color: '#666',
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Angles
            </div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: `repeat(${angleParams.length}, 1fr)`, 
              gap: '0.6rem' 
            }}>
              {angleParams.map(({ key, label, color, min, max, step }) => (
                <div key={key}>
                  <label style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: '600', 
                    color: color,
                    display: 'block',
                    marginBottom: '0.2rem'
                  }}>
                    {label}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      min={min}
                      max={max}
                      step={step}
                      value={state.params[key].toFixed(0)}
                      onChange={(e) => debouncedUpdateParams({ [key]: parseFloat(e.target.value) || min })}
                      style={{
                        width: '100%',
                        padding: '0.3rem',
                        paddingRight: '1.2rem',
                        border: `2px solid ${color}20`,
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        textAlign: 'center',
                        backgroundColor: 'white',
                        outline: 'none'
                      }}
                      onFocus={(e) => e.target.style.borderColor = color}
                      onBlur={(e) => e.target.style.borderColor = `${color}20`}
                    />
                    <span style={{
                      position: 'absolute',
                      right: '0.3rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '0.6rem',
                      color: '#999',
                      pointerEvents: 'none'
                    }}>
                      °
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default UnitCellControls;