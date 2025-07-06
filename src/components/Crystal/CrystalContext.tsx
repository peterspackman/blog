import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CrystalState, CrystalContextType, CustomCrystalStructure, AtomDisplayOptions } from './types';

const CrystalContext = createContext<CrystalContextType | undefined>(undefined);

export const useCrystal = () => {
  const context = useContext(CrystalContext);
  if (!context) {
    throw new Error('useCrystal must be used within a CrystalProvider');
  }
  return context;
};

interface CrystalProviderProps {
  children: ReactNode;
  initialState?: Partial<CrystalState>;
  customStructure?: CustomCrystalStructure;
}

export const CrystalProvider: React.FC<CrystalProviderProps> = ({ 
  children, 
  initialState,
  customStructure
}) => {
  const [state, setState] = useState<CrystalState>({
    currentStructure: customStructure ? 'custom' : '',
    customStructure,
    displayOptions: {
      showUnitCell: true,
      showAxes: false,
      representation: 'ball+stick',
      colorScheme: 'element'
    },
    atomDisplay: {
      mode: 'all',
      showElements: undefined,
      hideElements: undefined
    },
    ...initialState
  });

  const updateStructure = useCallback((structure: string) => {
    setState(prev => ({ 
      ...prev, 
      currentStructure: structure,
      customStructure: structure === 'custom' ? prev.customStructure : undefined
    }));
  }, []);

  const updateCustomStructure = useCallback((structure: CustomCrystalStructure) => {
    setState(prev => ({
      ...prev,
      currentStructure: 'custom',
      customStructure: structure
    }));
  }, []);

  const updateDisplayOptions = useCallback((options: Partial<CrystalState['displayOptions']>) => {
    setState(prev => ({
      ...prev,
      displayOptions: { ...prev.displayOptions, ...options }
    }));
  }, []);

  const updateAtomDisplay = useCallback((options: Partial<AtomDisplayOptions>) => {
    setState(prev => ({
      ...prev,
      atomDisplay: { ...prev.atomDisplay, ...options }
    }));
  }, []);

  const contextValue: CrystalContextType = {
    state,
    updateStructure,
    updateCustomStructure,
    updateDisplayOptions,
    updateAtomDisplay
  };

  return (
    <CrystalContext.Provider value={contextValue}>
      {children}
    </CrystalContext.Provider>
  );
};