import * as THREE from 'three';

export type LatticeSystem = 'cubic' | 'tetragonal' | 'orthorhombic' | 'hexagonal' | 'trigonal' | 'monoclinic' | 'triclinic';
export type CenteringType = 'P' | 'I' | 'F' | 'A' | 'B' | 'C';

export interface LatticeParameters {
  a: number;
  b: number;
  c: number;
  alpha: number;
  beta: number;
  gamma: number;
}

export interface PredefinedUnitCell {
  name: string;
  description?: string;
  system: LatticeSystem;
  centering?: CenteringType;
  params: LatticeParameters;
}

export interface DisplayOptions {
  showGrid: boolean;
  showImages: boolean;
  showLatticePoints: boolean;
  showMatrixInfo: boolean;
  autoRotate: boolean;
}

export interface UnitCellState {
  params: LatticeParameters;
  latticeSystem: LatticeSystem;
  centeringType: CenteringType;
  displayOptions: DisplayOptions;
}

export interface LatticeVectors {
  vectorA: THREE.Vector3;
  vectorB: THREE.Vector3;
  vectorC: THREE.Vector3;
}