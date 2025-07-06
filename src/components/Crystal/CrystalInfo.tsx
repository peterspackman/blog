import React from 'react';
import { useCrystal } from './CrystalContext';
import { CRYSTAL_STRUCTURES } from './predefinedStructures';

const CrystalInfo: React.FC = () => {
  const { state } = useCrystal();
  
  const currentStructureData = CRYSTAL_STRUCTURES[state.currentStructure];
  
  if (!currentStructureData) return null;

  return (
    <div style={{ 
      marginTop: '1rem',
      padding: '1.2rem',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      border: '1px solid #ddd'
    }}>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Basic Information */}
        <div>
          <div style={{ 
            fontSize: '0.8rem', 
            fontWeight: '500', 
            color: '#666',
            marginBottom: '0.8rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Structure Information
          </div>
          
          <div style={{ marginBottom: '0.6rem', fontSize: '0.85rem' }}>
            <strong>Name:</strong> {currentStructureData.name}
          </div>
          
          {currentStructureData.formula && (
            <div style={{ marginBottom: '0.6rem', fontSize: '0.85rem' }}>
              <strong>Formula:</strong> {currentStructureData.formula}
            </div>
          )}
          
          <div style={{ marginBottom: '0.6rem', fontSize: '0.85rem' }}>
            <strong>Crystal System:</strong> {currentStructureData.system}
          </div>
          
          <div style={{ fontSize: '0.85rem' }}>
            <strong>Description:</strong> {currentStructureData.description}
          </div>
        </div>
        
        {/* Display Settings */}
        <div>
          <div style={{ 
            fontSize: '0.8rem', 
            fontWeight: '500', 
            color: '#666',
            marginBottom: '0.8rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Current Display
          </div>
          
          <div style={{ marginBottom: '0.6rem', fontSize: '0.85rem' }}>
            <strong>Representation:</strong> {state.displayOptions.representation.replace('+', ' & ')}
          </div>
          
          <div style={{ marginBottom: '0.6rem', fontSize: '0.85rem' }}>
            <strong>Color Scheme:</strong> {state.displayOptions.colorScheme}
          </div>
          
          <div style={{ fontSize: '0.85rem' }}>
            <strong>Features:</strong> {[
              state.displayOptions.showUnitCell && 'Unit Cell',
              state.displayOptions.showAxes && 'Crystal Axes'
            ].filter(Boolean).join(', ') || 'None'}
          </div>
        </div>
      </div>
      
      <div style={{ 
        marginTop: '1rem',
        fontSize: '0.7rem',
        color: '#888',
        textAlign: 'center',
        fontStyle: 'italic'
      }}>
        Drag to rotate • Scroll to zoom • Double-click to reset view
      </div>
    </div>
  );
};

export default CrystalInfo;