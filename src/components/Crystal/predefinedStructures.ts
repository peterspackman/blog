import { CrystalStructure } from './types';

export const CRYSTAL_STRUCTURES: Record<string, CrystalStructure> = {
  'NaCl.pdb': {
    id: 'NaCl.pdb',
    name: 'Sodium Chloride (Salt)',
    description: 'Rock salt structure - two interpenetrating FCC lattices',
    system: 'Cubic',
    formula: 'NaCl'
  },
  'diamond.pdb': {
    id: 'diamond.pdb',
    name: 'Diamond',
    description: 'Face-centered cubic structure with tetrahedral coordination',
    system: 'Cubic',
    formula: 'C'
  },
  'calcite.pdb': {
    id: 'calcite.pdb',
    name: 'Calcite',
    description: 'Calcium carbonate with trigonal symmetry',
    system: 'Trigonal',
    formula: 'CaCO₃'
  },
  'graphite.pdb': {
    id: 'graphite.pdb',
    name: 'Graphite',
    description: 'Layered structure with hexagonal symmetry',
    system: 'Hexagonal',
    formula: 'C'
  }
};

export const EDUCATIONAL_STRUCTURES = Object.values(CRYSTAL_STRUCTURES);