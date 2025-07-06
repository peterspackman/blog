export interface Atom {
  element: string;
  position: [number, number, number]; // fractional coordinates
  label?: string;
}

export interface UnitCellDefinition {
  a: number;
  b: number;
  c: number;
  alpha: number;
  beta: number;
  gamma: number;
}

export interface CustomCrystalStructure {
  name: string;
  description: string;
  formula?: string;
  unitCell: UnitCellDefinition;
  atoms: Atom[];
  spaceGroup?: string;
}

export interface CrystalStructure {
  id: string;
  name: string;
  description: string;
  system: string;
  formula?: string;
  custom?: CustomCrystalStructure;
}

export interface AtomDisplayOptions {
  mode: 'all' | 'unitCell' | 'custom';
  customRange?: {
    x: [number, number];
    y: [number, number];
    z: [number, number];
  };
  showElements?: string[]; // Show only specific elements
  hideElements?: string[]; // Hide specific elements
}

export interface CrystalState {
  currentStructure: string;
  customStructure?: CustomCrystalStructure;
  displayOptions: {
    showUnitCell: boolean;
    showAxes: boolean;
    representation: 'ball+stick' | 'spacefill' | 'cartoon' | 'surface';
    colorScheme: 'element' | 'residue' | 'chainname' | 'uniform';
  };
  atomDisplay: AtomDisplayOptions;
}

export interface CrystalContextType {
  state: CrystalState;
  updateStructure: (structure: string) => void;
  updateCustomStructure: (structure: CustomCrystalStructure) => void;
  updateDisplayOptions: (options: Partial<CrystalState['displayOptions']>) => void;
  updateAtomDisplay: (options: Partial<AtomDisplayOptions>) => void;
}