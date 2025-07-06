import React from 'react';
import { CrystalProvider } from './CrystalContext';
import CrystalViewer3D from './CrystalViewer3D';
import CrystalControls from './CrystalControls';
import CrystalInfo from './CrystalInfo';

interface CrystalWorkshopViewerProps {
  structure?: string;
  showControls?: boolean;
  showInfo?: boolean;
  height?: string;
  showUnitCell?: boolean;
  title?: string;
  description?: string;
}

// Backwards compatibility wrapper
const CrystalWorkshopViewer: React.FC<CrystalWorkshopViewerProps> = ({
  structure = 'diamond.pdb',
  showControls = true,
  showInfo = false,
  height = '400px',
  showUnitCell = true,
  title,
  description
}) => {
  return (
    <div style={{ marginBottom: '2rem' }}>
      {/* Title and description */}
      {(title || description) && (
        <div style={{ marginBottom: '1rem' }}>
          {title && (
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#333' }}>
              {title}
            </h4>
          )}
          {description && (
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
              {description}
            </p>
          )}
        </div>
      )}

      <CrystalProvider initialState={{
        currentStructure: structure,
        displayOptions: {
          showUnitCell,
          showAxes: false,
          representation: 'ball+stick',
          colorScheme: 'element'
        }
      }}>
        {showControls ? (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'nowrap' }}>
            <div style={{ width: '70%', flexShrink: 0 }}>
              <CrystalViewer3D height={height} />
            </div>
            <div style={{ width: '30%', flexShrink: 0 }}>
              <CrystalControls />
            </div>
          </div>
        ) : (
          <CrystalViewer3D height={height} />
        )}
        
        {showInfo && <CrystalInfo />}
      </CrystalProvider>
    </div>
  );
};

export default CrystalWorkshopViewer;