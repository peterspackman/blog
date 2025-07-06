import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { UnitCellState, LatticeParameters, LatticeSystem, CenteringType, DisplayOptions, LatticeVectors } from './types';
import * as THREE from 'three';

interface UnitCellContextType {
  state: UnitCellState;
  updateParams: (params: Partial<LatticeParameters>) => void;
  updateLatticeSystem: (system: LatticeSystem) => void;
  updateCenteringType: (centering: CenteringType) => void;
  updateDisplayOptions: (options: Partial<DisplayOptions>) => void;
  calculateLatticeVectors: () => LatticeVectors;
  applyLatticeConstraints: () => void;
}

const UnitCellContext = createContext<UnitCellContextType | undefined>(undefined);

export const useUnitCell = () => {
  const context = useContext(UnitCellContext);
  if (!context) {
    throw new Error('useUnitCell must be used within a UnitCellProvider');
  }
  return context;
};

interface UnitCellProviderProps {
  children: ReactNode;
  initialState?: Partial<UnitCellState>;
}

export const UnitCellProvider: React.FC<UnitCellProviderProps> = ({ 
  children, 
  initialState 
}) => {
  const providerId = React.useRef(Math.random().toString(36).substring(7));
  
  const [state, setState] = useState<UnitCellState>({
    params: { a: 1, b: 1, c: 1, alpha: 90, beta: 90, gamma: 90 },
    latticeSystem: 'triclinic',
    centeringType: 'P',
    displayOptions: {
      showGrid: false,
      showImages: false,
      showLatticePoints: false,
      showMatrixInfo: true,
      autoRotate: false
    },
    ...initialState
  });

  const updateParams = useCallback((newParams: Partial<LatticeParameters>) => {
    setState(prev => ({
      ...prev,
      params: { ...prev.params, ...newParams }
    }));
  }, []);

  const updateLatticeSystem = useCallback((system: LatticeSystem) => {
    setState(prev => ({ ...prev, latticeSystem: system }));
  }, []);

  const updateCenteringType = useCallback((centering: CenteringType) => {
    setState(prev => ({ ...prev, centeringType: centering }));
  }, []);

  const updateDisplayOptions = useCallback((options: Partial<DisplayOptions>) => {
    console.log(`Provider ${providerId.current}: updateDisplayOptions`, options);
    setState(prev => ({
      ...prev,
      displayOptions: { ...prev.displayOptions, ...options }
    }));
  }, []);

  const calculateLatticeVectors = useCallback((): LatticeVectors => {
    const { a, b, c, alpha, beta, gamma } = state.params;
    console.log(`Provider ${providerId.current}: calculateLatticeVectors`, { a, b, c, alpha, beta, gamma });
    console.log(`Provider ${providerId.current}: state object:`, state);
    
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
    const alphaRad = toRadians(alpha);
    const betaRad = toRadians(beta);
    const gammaRad = toRadians(gamma);

    const cosAlpha = Math.cos(alphaRad);
    const cosBeta = Math.cos(betaRad);
    const cosGamma = Math.cos(gammaRad);
    const sinGamma = Math.sin(gammaRad);

    // Vector a along x-axis
    const vectorA = new THREE.Vector3(a, 0, 0);

    // Vector b in xy-plane  
    const vectorB = new THREE.Vector3(
      b * cosGamma,
      b * sinGamma,
      0
    );

    // Vector c calculation
    const cx = c * cosBeta;
    const cy = c * (cosAlpha - cosBeta * cosGamma) / sinGamma;
    const czSquared = 1 - cosBeta * cosBeta - Math.pow((cosAlpha - cosBeta * cosGamma) / sinGamma, 2);
    const cz = c * Math.sqrt(Math.max(0, czSquared));

    const vectorC = new THREE.Vector3(cx, cy, cz);

    return { vectorA, vectorB, vectorC };
  }, [state.params.a, state.params.b, state.params.c, state.params.alpha, state.params.beta, state.params.gamma]);

  const applyLatticeConstraints = useCallback(() => {
    const latticeSystem = state.latticeSystem;
    const params = state.params;
    let constrainedParams = { ...params };
    let hasChanges = false;

    // Helper function to check if values are approximately equal
    const approxEqual = (a: number, b: number, tolerance = 1e-6) => Math.abs(a - b) < tolerance;

    switch (latticeSystem) {
      case 'cubic':
        if (!approxEqual(constrainedParams.b, constrainedParams.a)) {
          constrainedParams.b = constrainedParams.a;
          hasChanges = true;
        }
        if (!approxEqual(constrainedParams.c, constrainedParams.a)) {
          constrainedParams.c = constrainedParams.a;
          hasChanges = true;
        }
        if (!approxEqual(constrainedParams.alpha, 90)) {
          constrainedParams.alpha = 90;
          hasChanges = true;
        }
        if (!approxEqual(constrainedParams.beta, 90)) {
          constrainedParams.beta = 90;
          hasChanges = true;
        }
        if (!approxEqual(constrainedParams.gamma, 90)) {
          constrainedParams.gamma = 90;
          hasChanges = true;
        }
        break;
      case 'tetragonal':
        if (!approxEqual(constrainedParams.b, constrainedParams.a)) {
          constrainedParams.b = constrainedParams.a;
          hasChanges = true;
        }
        if (!approxEqual(constrainedParams.alpha, 90)) {
          constrainedParams.alpha = 90;
          hasChanges = true;
        }
        if (!approxEqual(constrainedParams.beta, 90)) {
          constrainedParams.beta = 90;
          hasChanges = true;
        }
        if (!approxEqual(constrainedParams.gamma, 90)) {
          constrainedParams.gamma = 90;
          hasChanges = true;
        }
        break;
      case 'orthorhombic':
        if (!approxEqual(constrainedParams.alpha, 90)) {
          constrainedParams.alpha = 90;
          hasChanges = true;
        }
        if (!approxEqual(constrainedParams.beta, 90)) {
          constrainedParams.beta = 90;
          hasChanges = true;
        }
        if (!approxEqual(constrainedParams.gamma, 90)) {
          constrainedParams.gamma = 90;
          hasChanges = true;
        }
        break;
      case 'hexagonal':
        if (!approxEqual(constrainedParams.b, constrainedParams.a)) {
          constrainedParams.b = constrainedParams.a;
          hasChanges = true;
        }
        if (!approxEqual(constrainedParams.alpha, 90)) {
          constrainedParams.alpha = 90;
          hasChanges = true;
        }
        if (!approxEqual(constrainedParams.beta, 90)) {
          constrainedParams.beta = 90;
          hasChanges = true;
        }
        if (!approxEqual(constrainedParams.gamma, 120)) {
          constrainedParams.gamma = 120;
          hasChanges = true;
        }
        break;
      case 'trigonal':
        if (!approxEqual(constrainedParams.b, constrainedParams.a)) {
          constrainedParams.b = constrainedParams.a;
          hasChanges = true;
        }
        if (!approxEqual(constrainedParams.c, constrainedParams.a)) {
          constrainedParams.c = constrainedParams.a;
          hasChanges = true;
        }
        if (!approxEqual(constrainedParams.beta, constrainedParams.alpha)) {
          constrainedParams.beta = constrainedParams.alpha;
          hasChanges = true;
        }
        if (!approxEqual(constrainedParams.gamma, constrainedParams.alpha)) {
          constrainedParams.gamma = constrainedParams.alpha;
          hasChanges = true;
        }
        break;
      case 'monoclinic':
        if (!approxEqual(constrainedParams.alpha, 90)) {
          constrainedParams.alpha = 90;
          hasChanges = true;
        }
        if (!approxEqual(constrainedParams.gamma, 90)) {
          constrainedParams.gamma = 90;
          hasChanges = true;
        }
        break;
      case 'triclinic':
      default:
        // No constraints
        break;
    }

    // Only update state if there are actual changes
    if (hasChanges) {
      setState(prev => ({
        ...prev,
        params: constrainedParams
      }));
    }
  }, [state.latticeSystem, state.params]);

  const contextValue: UnitCellContextType = {
    state,
    updateParams,
    updateLatticeSystem,
    updateCenteringType,
    updateDisplayOptions,
    calculateLatticeVectors,
    applyLatticeConstraints
  };

  return (
    <UnitCellContext.Provider value={contextValue}>
      {children}
    </UnitCellContext.Provider>
  );
};