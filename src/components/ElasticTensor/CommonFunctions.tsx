
interface ElasticProperties {
  bulkModulus: { voigt: number; reuss: number; hill: number };
  shearModulus: { voigt: number; reuss: number; hill: number };
  youngsModulus: { voigt: number; reuss: number; hill: number };
  poissonRatio: { voigt: number; reuss: number; hill: number };
  linearCompressibility: { voigt: number; reuss: number; hill: number };
}

interface DirectionalData {
  angle: number;
  angleRad: number;
  value: number;
  valueMin?: number;
  valueMax?: number;
  x?: number;
  y?: number;
}

interface SurfaceData {
  surfaceData: number[][];
  minValue: number;
  maxValue: number;
  property: string;
  numU: number;
  numV: number;
}


interface AnalysisResult {
  properties: ElasticProperties;
  eigenvalues: number[] | null;
  eigenvalueError?: string;
  isPositiveDefinite: boolean;
  extrema: {
    shearModulus: { min: number; max: number; anisotropy: number };
    youngsModulus: { min: number; max: number; anisotropy: number };
    poissonRatio: { min: number; max: number; anisotropy: number };
    linearCompressibility: { min: number; max: number; anisotropy: number };
  };
  stiffnessMatrix: number[][];
  complianceMatrix: number[][];
}
// Calculate differences between test and reference data
const calculateDirectionalDifferences = (testData: DirectionalData[], referenceData: DirectionalData[]): DirectionalData[] => {
  if (!testData || !referenceData || testData.length !== referenceData.length) {
    return [];
  }

  return testData.map((testPoint, i) => {
    const refPoint = referenceData[i];
    return {
      angle: testPoint.angle,
      angleRad: testPoint.angleRad,
      value: testPoint.value - refPoint.value,
      valueMin: (testPoint.valueMin || 0) - (refPoint.valueMin || 0),
      valueMax: (testPoint.valueMax || 0) - (refPoint.valueMax || 0),
      x: testPoint.x !== undefined && refPoint.x !== undefined ? testPoint.x - refPoint.x : undefined,
      y: testPoint.y !== undefined && refPoint.y !== undefined ? testPoint.y - refPoint.y : undefined
    };
  });
};

// Utility functions for displaying differences
const getDifferenceColor = (diff: number): string => {
  if (Math.abs(diff) < 0.001) return 'var(--ifm-color-emphasis-600)'; // Gray for no change
  return diff > 0 ? '#28a745' : '#dc3545'; // Green for positive, red for negative
};

const getDifferenceSign = (diff: number): string => {
  if (Math.abs(diff) < 0.001) return '±';
  return diff > 0 ? '+' : '-';
};

// Copy to clipboard function
const copyTableToClipboard = (tableType: string, data: any) => {
  let text = '';

  if (tableType === 'averages') {
    text = `Averaging scheme\tBulk modulus (GPa)\tYoung's modulus (GPa)\tShear modulus (GPa)\tPoisson's ratio\n`;
    text += `Voigt\t${data.properties.bulkModulus.voigt.toFixed(3)}\t${data.properties.youngsModulus.voigt.toFixed(3)}\t${data.properties.shearModulus.voigt.toFixed(3)}\t${data.properties.poissonRatio.voigt.toFixed(5)}\n`;
    text += `Reuss\t${data.properties.bulkModulus.reuss.toFixed(3)}\t${data.properties.youngsModulus.reuss.toFixed(3)}\t${data.properties.shearModulus.reuss.toFixed(3)}\t${data.properties.poissonRatio.reuss.toFixed(5)}\n`;
    text += `Hill\t${data.properties.bulkModulus.hill.toFixed(3)}\t${data.properties.youngsModulus.hill.toFixed(3)}\t${data.properties.shearModulus.hill.toFixed(3)}\t${data.properties.poissonRatio.hill.toFixed(5)}`;
  } else if (tableType === 'eigenvalues') {
    text = `Eigenvalue\tValue (GPa)\n`;
    data.eigenvalues.forEach((val: number, i: number) => {
      text += `λ${i + 1}\t${val.toFixed(3)}\n`;
    });
    text = text.trim();
  } else if (tableType === 'variations') {
    text = `Property\tMinimum\tMaximum\tAnisotropy\n`;
    text += `Young's modulus (GPa)\t${data.extrema.youngsModulus.min.toFixed(3)}\t${data.extrema.youngsModulus.max.toFixed(3)}\t${data.extrema.youngsModulus.anisotropy.toFixed(2)}\n`;
    text += `Linear compressibility (TPa⁻¹)\t${data.extrema.linearCompressibility.min.toFixed(3)}\t${data.extrema.linearCompressibility.max.toFixed(3)}\t${data.extrema.linearCompressibility.anisotropy.toFixed(4)}\n`;
    text += `Shear modulus (GPa)\t${data.extrema.shearModulus.min.toFixed(3)}\t${data.extrema.shearModulus.max.toFixed(3)}\t${data.extrema.shearModulus.anisotropy.toFixed(2)}\n`;
    text += `Poisson's ratio\t${data.extrema.poissonRatio.min.toFixed(5)}\t${data.extrema.poissonRatio.max.toFixed(5)}\t${isFinite(data.extrema.poissonRatio.anisotropy) ? data.extrema.poissonRatio.anisotropy.toFixed(2) : '∞'}`;
  }

  navigator.clipboard.writeText(text).then(() => {
    console.log('Table copied to clipboard');
  }).catch(err => {
    console.error('Failed to copy table: ', err);
  });
};


function getPropertyTitle(property: string): string {
  const titles = {
    'youngs': "Young's Modulus",
    'linear_compressibility': 'Linear Compressibility',
    'shear': 'Shear Modulus',
    'poisson': "Poisson's Ratio"
  };
  return titles[property] || property;
}

function getPropertyUnit(property: string): string {
  const units = {
    'youngs': 'GPa',
    'linear_compressibility': 'TPa⁻¹',
    'shear': 'GPa',
    'poisson': ''
  };
  return units[property] || '';
}

// Consistent color scheme for tensor visualizations using CSS variables
const TENSOR_COLORS = {
  // Primary tensor colors (CSS variables)
  TEST_TENSOR: 'var(--tensor-test-color)',
  REFERENCE_TENSOR: 'var(--tensor-reference-color)',
  
  // Matrix visualization colors
  MATRIX: {
    // Single tensor matrix colors
    SINGLE_LOW: 'var(--tensor-matrix-single-low)',
    SINGLE_MID: 'var(--tensor-matrix-single-mid)',
    SINGLE_HIGH: 'var(--tensor-matrix-single-high)',
    
    // Overlay matrix colors (same as single)
    OVERLAY_LOW: 'var(--tensor-matrix-single-low)',
    OVERLAY_MID: 'var(--tensor-matrix-single-mid)',
    OVERLAY_HIGH: 'var(--tensor-matrix-single-high)',
    
    // Difference matrix colors
    DIFF_NEGATIVE: 'var(--tensor-matrix-diff-negative)',
    DIFF_ZERO: 'var(--tensor-matrix-diff-zero)',
    DIFF_POSITIVE: 'var(--tensor-matrix-diff-positive)',
  },
  
  // Text colors
  TEXT: {
    TEST_VALUE: 'var(--tensor-test-color)',
    REFERENCE_VALUE: 'var(--tensor-reference-color)',
    DIFFERENCE_LIGHT: 'var(--tensor-text-light)',
    DIFFERENCE_DARK: 'var(--tensor-text-dark)',
    SMALL_DIFF: 'var(--tensor-text-small-diff)',
  }
};

// Helper function to get tensor color
function getTensorColor(tensorType: 'test' | 'reference'): string {
  return tensorType === 'test' ? TENSOR_COLORS.TEST_TENSOR : TENSOR_COLORS.REFERENCE_TENSOR;
}

// Helper function to get computed CSS color values for charts
function getComputedTensorColors() {
  const computedStyle = getComputedStyle(document.documentElement);
  return {
    testColor: computedStyle.getPropertyValue('--tensor-test-color').trim() || '#ff6600',
    referenceColor: computedStyle.getPropertyValue('--tensor-reference-color').trim() || '#0066cc', 
    differenceColor: computedStyle.getPropertyValue('--tensor-difference-color').trim() || '#cc0066',
    diffNegativeColor: computedStyle.getPropertyValue('--tensor-matrix-diff-negative').trim() || '#2196f3',
    diffZeroColor: computedStyle.getPropertyValue('--tensor-matrix-diff-zero').trim() || '#ffffff',
    diffPositiveColor: computedStyle.getPropertyValue('--tensor-matrix-diff-positive').trim() || '#f44336',
    singleLowColor: computedStyle.getPropertyValue('--tensor-matrix-single-low').trim() || '#ffffff',
    singleMidColor: computedStyle.getPropertyValue('--tensor-matrix-single-mid').trim() || '#9e9e9e',
    singleHighColor: computedStyle.getPropertyValue('--tensor-matrix-single-high').trim() || '#757575',
  };
}

// Helper function to get text color based on background intensity
function getMatrixTextColor(value: number, minValue: number, maxValue: number, isDifference: boolean = false): string {
  if (isDifference) {
    // For difference matrices, use black on light colors, white on dark colors
    const normalizedValue = Math.abs(value) / Math.max(Math.abs(minValue), Math.abs(maxValue));
    return normalizedValue > 0.5 ? TENSOR_COLORS.TEXT.DIFFERENCE_DARK : TENSOR_COLORS.TEXT.DIFFERENCE_LIGHT;
  }
  // For regular matrices, always use black text
  return TENSOR_COLORS.TEXT.DIFFERENCE_LIGHT;
}

export {
  ElasticProperties,
  DirectionalData,
  SurfaceData,
  AnalysisResult,
  calculateDirectionalDifferences,
  getDifferenceColor,
  getDifferenceSign,
  copyTableToClipboard,
  getPropertyTitle,
  getPropertyUnit,
  TENSOR_COLORS,
  getTensorColor,
  getMatrixTextColor,
  getComputedTensorColors
};
