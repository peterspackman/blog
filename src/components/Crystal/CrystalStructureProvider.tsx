import React, { createContext, useContext, ReactNode } from 'react';
import { CrystalStructure } from './types';
import { EDUCATIONAL_STRUCTURES } from './predefinedStructures';

interface CrystalStructureContextType {
  availableStructures: CrystalStructure[];
  getStructureById: (id: string) => CrystalStructure | undefined;
}

const CrystalStructureContext = createContext<CrystalStructureContextType | undefined>(undefined);

export const useCrystalStructures = () => {
  const context = useContext(CrystalStructureContext);
  if (!context) {
    throw new Error('useCrystalStructures must be used within a CrystalStructureProvider');
  }
  return context;
};

interface CrystalStructureProviderProps {
  children: ReactNode;
  structures?: CrystalStructure[];
}

export const CrystalStructureProvider: React.FC<CrystalStructureProviderProps> = ({ 
  children, 
  structures = EDUCATIONAL_STRUCTURES 
}) => {
  const getStructureById = (id: string) => {
    return structures.find(s => s.id === id);
  };

  const contextValue: CrystalStructureContextType = {
    availableStructures: structures,
    getStructureById
  };

  return (
    <CrystalStructureContext.Provider value={contextValue}>
      {children}
    </CrystalStructureContext.Provider>
  );
};