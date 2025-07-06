import React from 'react';
import { useCrystal } from './CrystalContext';
import { useCrystalStructures } from './CrystalStructureProvider';
import CrystalControls from './CrystalControls';

const CrystalControlsWithStructures: React.FC = () => {
  const { state, updateStructure } = useCrystal();
  const { availableStructures } = useCrystalStructures();

  return (
    <div>
      {/* Structure Selector */}
      <div style={{ 
        marginBottom: '1rem',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #ddd'
      }}>
        <div style={{ 
          fontSize: '0.8rem', 
          fontWeight: '500', 
          color: '#666',
          marginBottom: '0.5rem',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Crystal Structure
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.4rem'
        }}>
          {availableStructures.map(struct => (
            <button
              key={struct.id}
              onClick={() => updateStructure(struct.id)}
              style={{
                padding: '0.5rem',
                backgroundColor: struct.id === state.currentStructure ? '#e3f2fd' : 'white',
                border: '1px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                if (struct.id !== state.currentStructure) {
                  e.currentTarget.style.backgroundColor = '#f5f5f5';
                }
              }}
              onMouseOut={(e) => {
                if (struct.id !== state.currentStructure) {
                  e.currentTarget.style.backgroundColor = 'white';
                }
              }}
            >
              <div style={{ fontWeight: '500', marginBottom: '0.2rem' }}>
                {struct.name}
              </div>
              {struct.formula && (
                <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.2rem' }}>
                  {struct.formula}
                </div>
              )}
              <div style={{ 
                fontSize: '0.65rem', 
                color: '#666',
                fontStyle: 'italic'
              }}>
                {struct.system} System
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Regular Controls */}
      <CrystalControls />
    </div>
  );
};

export default CrystalControlsWithStructures;