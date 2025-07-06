import React from 'react';
import { UnitCellProvider } from './UnitCellContext';
import UnitCellViewer3D from './UnitCellViewer3D';
import UnitCellControls from './UnitCellControls';
import UnitCellMatrixDisplay from './UnitCellMatrixDisplay';
import { UnitCellState } from './types';

interface UnitCellViewerProps {
  // Layout props
  showControls?: boolean;
  height?: string;
  title?: string;
  description?: string;
  
  // Initial state
  initialState?: Partial<UnitCellState>;
  
  // Quick setup props (for backwards compatibility)
  a?: number;
  b?: number;
  c?: number;
  alpha?: number;
  beta?: number;
  gamma?: number;
  latticeSystem?: any;
  predefinedCell?: any;
  showGrid?: boolean;
  showImages?: boolean;
  showLatticePoints?: boolean;
  showMatrixInfo?: boolean;
  centeringType?: any;
  autoRotate?: boolean;
}

const UnitCellViewer: React.FC<UnitCellViewerProps> = ({
  showControls = false,
  height = '400px',
  title,
  description,
  initialState,
  // Backwards compatibility props
  a = 1,
  b = 1,
  c = 1,
  alpha = 90,
  beta = 90,
  gamma = 90,
  latticeSystem = 'triclinic',
  predefinedCell,
  showGrid = false,
  showImages = false,
  showLatticePoints = false,
  showMatrixInfo = true,
  centeringType = 'P',
  autoRotate = false
}) => {
  
  // Build initial state from props (backwards compatibility)
  const defaultInitialState: Partial<UnitCellState> = {
    params: predefinedCell ? predefinedCell.params : { a, b, c, alpha, beta, gamma },
    latticeSystem: predefinedCell ? predefinedCell.system : latticeSystem,
    centeringType: predefinedCell ? predefinedCell.centering || 'P' : centeringType,
    displayOptions: {
      showGrid,
      showImages,
      showLatticePoints,
      showMatrixInfo,
      autoRotate
    },
    ...initialState
  };

  return (
    <UnitCellProvider initialState={defaultInitialState}>
      <div style={{ marginBottom: '1.5rem' }}>
        {/* Title and description */}
        {(title || description) && (
          <div style={{ marginBottom: '1rem' }}>
            {title && (
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#333' }}>
                {title}
              </h4>
            )}
            {description && (
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
                {description}
              </p>
            )}
          </div>
        )}

        {/* Container for viewer and controls */}
        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          alignItems: 'flex-start',
          flexWrap: 'nowrap'
        }}>
          {/* 3D Viewer */}
          <div style={{
            width: showControls ? '70%' : '100%',
            flexShrink: 0
          }}>
            <UnitCellViewer3D height={height} />
          </div>

          {/* Controls */}
          {showControls && (
            <div style={{ 
              width: '30%',
              flexShrink: 0
            }}>
              <UnitCellControls />
            </div>
          )}
        </div>

        {/* Matrix Display */}
        <UnitCellMatrixDisplay />
      </div>
    </UnitCellProvider>
  );
};

export default UnitCellViewer;