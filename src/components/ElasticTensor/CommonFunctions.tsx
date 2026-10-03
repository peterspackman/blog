import type { VizTheme } from '../shared/viz';

export interface DirectionalData {
  angle: number;
  angleRad: number;
  value: number;
  valueMin?: number;
  valueMax?: number;
  x?: number;
  y?: number;
}

export interface SurfaceData {
  surfaceData: number[][];
  minValue: number;
  maxValue: number;
  property: string;
  numU: number;
  numV: number;
}

/** One tensor's data for a chart, with its position in the selection (for colour). */
export interface TensorDataset<T> {
  data: T;
  tensorId: string;
  name: string;
  colorIndex: number;
}

export type ElasticProperty = 'youngs' | 'linear_compressibility' | 'shear' | 'poisson';

const TITLES: Record<string, string> = {
  youngs: "Young's modulus",
  linear_compressibility: 'Linear compressibility',
  shear: 'Shear modulus',
  poisson: "Poisson's ratio",
};

const UNITS: Record<string, string> = {
  youngs: 'GPa',
  linear_compressibility: 'TPa⁻¹',
  shear: 'GPa',
  poisson: '',
};

export function getPropertyTitle(property: string): string {
  return TITLES[property] ?? property;
}

export function getPropertyUnit(property: string): string {
  return UNITS[property] ?? '';
}

/** Shear modulus and Poisson's ratio depend on a second direction, so they have a min and a max. */
export function hasMinMax(property: string): boolean {
  return property === 'shear' || property === 'poisson';
}

/** Colour of the i-th selected tensor, from the site's categorical series. */
export function tensorColor(theme: VizTheme, colorIndex: number): string {
  return theme.series[colorIndex % theme.series.length];
}

/** Axis labels for a plane name such as 'xz'. */
export function planeAxes(plane: string): { x: string; y: string } {
  return { x: plane[0].toUpperCase(), y: plane[1].toUpperCase() };
}

/** Toolbox with a theme-aware "save as PNG" button. */
export function saveImageToolbox(theme: VizTheme) {
  return {
    show: true,
    right: 0,
    top: 0,
    itemSize: 14,
    iconStyle: { borderColor: theme.muted },
    emphasis: { iconStyle: { borderColor: theme.accent } },
    feature: {
      saveAsImage: {
        title: 'Save as PNG',
        backgroundColor: theme.surface,
        pixelRatio: 2,
        excludeComponents: ['toolbox'],
      },
    },
  };
}

type VRH = { voigt: number; reuss: number; hill: number };
type Extremum = { min: number; max: number; anisotropy: number };

/** One tensor's result from the worker's analyzeAll. */
export interface AnalysisResult {
  id: string;
  properties: {
    bulkModulus: VRH;
    shearModulus: VRH;
    youngsModulus: VRH;
    poissonRatio: VRH;
  };
  eigenvalues: number[] | null;
  eigenvalueError?: string;
  isPositiveDefinite: boolean;
  extrema: {
    youngsModulus: Extremum;
    linearCompressibility: Extremum;
    shearModulus: Extremum;
    poissonRatio: Extremum;
  };
  stiffnessMatrix?: number[][];
  complianceMatrix?: number[][];
  directionalData?: Record<string, Record<string, DirectionalData[]>>;
  surfaceData?: Record<string, SurfaceData>;
}
