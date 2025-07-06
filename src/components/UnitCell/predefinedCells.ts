import { PredefinedUnitCell, LatticeSystem } from './types';

// Predefined unit cells for each crystal system
export const CRYSTAL_SYSTEMS: Record<LatticeSystem, PredefinedUnitCell> = {
  cubic: {
    name: 'Cubic',
    description: 'a = b = c, α = β = γ = 90°',
    system: 'cubic',
    centering: 'P',
    params: { a: 1, b: 1, c: 1, alpha: 90, beta: 90, gamma: 90 }
  },
  tetragonal: {
    name: 'Tetragonal', 
    description: 'a = b ≠ c, α = β = γ = 90°',
    system: 'tetragonal',
    centering: 'P',
    params: { a: 1, b: 1, c: 1.4, alpha: 90, beta: 90, gamma: 90 }
  },
  orthorhombic: {
    name: 'Orthorhombic',
    description: 'a ≠ b ≠ c, α = β = γ = 90°', 
    system: 'orthorhombic',
    centering: 'P',
    params: { a: 1, b: 1.3, c: 0.8, alpha: 90, beta: 90, gamma: 90 }
  },
  hexagonal: {
    name: 'Hexagonal',
    description: 'a = b ≠ c, α = β = 90°, γ = 120°',
    system: 'hexagonal',
    centering: 'P',
    params: { a: 1, b: 1, c: 1.6, alpha: 90, beta: 90, gamma: 120 }
  },
  trigonal: {
    name: 'Trigonal (Rhombohedral)',
    description: 'a = b = c, α = β = γ ≠ 90°',
    system: 'trigonal',
    centering: 'P',
    params: { a: 1, b: 1, c: 1, alpha: 70, beta: 70, gamma: 70 }
  },
  monoclinic: {
    name: 'Monoclinic', 
    description: 'a ≠ b ≠ c, α = γ = 90°, β ≠ 90°',
    system: 'monoclinic',
    centering: 'P',
    params: { a: 1, b: 1.2, c: 0.9, alpha: 90, beta: 110, gamma: 90 }
  },
  triclinic: {
    name: 'Triclinic',
    description: 'a ≠ b ≠ c, α ≠ β ≠ γ ≠ 90°',
    system: 'triclinic',
    centering: 'P',
    params: { a: 1, b: 1.2, c: 0.8, alpha: 85, beta: 95, gamma: 100 }
  }
};

// Predefined Bravais lattices with centering
export const BRAVAIS_LATTICES = {
  // Cubic
  'cubic-P': { ...CRYSTAL_SYSTEMS.cubic, centering: 'P' as const, name: 'Primitive Cubic' },
  'cubic-I': { ...CRYSTAL_SYSTEMS.cubic, centering: 'I' as const, name: 'Body-Centered Cubic' },
  'cubic-F': { ...CRYSTAL_SYSTEMS.cubic, centering: 'F' as const, name: 'Face-Centered Cubic' },
  
  // Tetragonal
  'tetragonal-P': { ...CRYSTAL_SYSTEMS.tetragonal, centering: 'P' as const, name: 'Primitive Tetragonal' },
  'tetragonal-I': { ...CRYSTAL_SYSTEMS.tetragonal, centering: 'I' as const, name: 'Body-Centered Tetragonal' },
  
  // Orthorhombic
  'orthorhombic-P': { ...CRYSTAL_SYSTEMS.orthorhombic, centering: 'P' as const, name: 'Primitive Orthorhombic' },
  'orthorhombic-I': { ...CRYSTAL_SYSTEMS.orthorhombic, centering: 'I' as const, name: 'Body-Centered Orthorhombic' },
  'orthorhombic-F': { ...CRYSTAL_SYSTEMS.orthorhombic, centering: 'F' as const, name: 'Face-Centered Orthorhombic' },
  'orthorhombic-C': { ...CRYSTAL_SYSTEMS.orthorhombic, centering: 'C' as const, name: 'Base-Centered Orthorhombic' },
  
  // Monoclinic
  'monoclinic-P': { ...CRYSTAL_SYSTEMS.monoclinic, centering: 'P' as const, name: 'Primitive Monoclinic' },
  'monoclinic-C': { ...CRYSTAL_SYSTEMS.monoclinic, centering: 'C' as const, name: 'Base-Centered Monoclinic' },
  
  // Others (only primitive)
  'hexagonal-P': { ...CRYSTAL_SYSTEMS.hexagonal, centering: 'P' as const, name: 'Hexagonal' },
  'trigonal-P': { ...CRYSTAL_SYSTEMS.trigonal, centering: 'P' as const, name: 'Trigonal' },
  'triclinic-P': { ...CRYSTAL_SYSTEMS.triclinic, centering: 'P' as const, name: 'Triclinic' }
};