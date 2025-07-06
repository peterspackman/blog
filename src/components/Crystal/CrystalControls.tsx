import React from 'react';
import { useCrystal } from './CrystalContext';

const CrystalControls: React.FC = () => {
  const { state, updateDisplayOptions, updateAtomDisplay } = useCrystal();

  return (
    <div style={{ 
      padding: '1rem',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      border: '1px solid #ddd'
    }}>
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
            { key: 'showUnitCell', label: 'Unit Cell' },
            { key: 'showAxes', label: 'Axes' }
          ].map(option => (
            <label key={option.key} style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem', color: '#666' }}>
              <input
                type="checkbox"
                checked={state.displayOptions[option.key as keyof typeof state.displayOptions] as boolean}
                onChange={(e) => updateDisplayOptions({ [option.key]: e.target.checked })}
                style={{ marginRight: '0.4rem' }}
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      {/* Representation */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ 
          fontSize: '0.8rem', 
          fontWeight: '500', 
          color: '#666',
          marginBottom: '0.5rem',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Representation
        </div>
        <select
          value={state.displayOptions.representation}
          onChange={(e) => updateDisplayOptions({ representation: e.target.value as any })}
          style={{
            width: '100%',
            padding: '0.4rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '0.75rem',
            backgroundColor: 'white'
          }}
        >
          <option value="ball+stick">Ball & Stick</option>
          <option value="spacefill">Space Filling</option>
          <option value="cartoon">Cartoon</option>
          <option value="surface">Surface</option>
        </select>
      </div>

      {/* Color Scheme */}
      <div>
        <div style={{ 
          fontSize: '0.8rem', 
          fontWeight: '500', 
          color: '#666',
          marginBottom: '0.5rem',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Color Scheme
        </div>
        <select
          value={state.displayOptions.colorScheme}
          onChange={(e) => updateDisplayOptions({ colorScheme: e.target.value as any })}
          style={{
            width: '100%',
            padding: '0.4rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '0.75rem',
            backgroundColor: 'white'
          }}
        >
          <option value="element">By Element</option>
          <option value="residue">By Residue</option>
          <option value="chainname">By Chain</option>
          <option value="uniform">Uniform</option>
        </select>
      </div>

      {/* Atom Display */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ 
          fontSize: '0.8rem', 
          fontWeight: '500', 
          color: '#666',
          marginBottom: '0.5rem',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Atom Display
        </div>
        
        {/* Display Mode */}
        <div style={{ marginBottom: '0.5rem' }}>
          <select
            value={state.atomDisplay.mode}
            onChange={(e) => updateAtomDisplay({ mode: e.target.value as any })}
            style={{
              width: '100%',
              padding: '0.4rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '0.75rem',
              backgroundColor: 'white',
              marginBottom: '0.3rem'
            }}
          >
            <option value="all">All Atoms (3x3x3)</option>
            <option value="unitCell">Unit Cell Only</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {/* Element Filters */}
        <div style={{ fontSize: '0.7rem', color: '#666', marginBottom: '0.3rem' }}>
          Show Elements (comma-separated):
        </div>
        <input
          type="text"
          placeholder="e.g., Na,Cl"
          value={state.atomDisplay.showElements?.join(',') || ''}
          onChange={(e) => {
            const elements = e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(s => s) : undefined;
            updateAtomDisplay({ showElements: elements });
          }}
          style={{
            width: '100%',
            padding: '0.3rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '0.7rem',
            marginBottom: '0.3rem'
          }}
        />

        <div style={{ fontSize: '0.7rem', color: '#666', marginBottom: '0.3rem' }}>
          Hide Elements (comma-separated):
        </div>
        <input
          type="text"
          placeholder="e.g., H"
          value={state.atomDisplay.hideElements?.join(',') || ''}
          onChange={(e) => {
            const elements = e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(s => s) : undefined;
            updateAtomDisplay({ hideElements: elements });
          }}
          style={{
            width: '100%',
            padding: '0.3rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '0.7rem'
          }}
        />
      </div>
    </div>
  );
};

export default CrystalControls;