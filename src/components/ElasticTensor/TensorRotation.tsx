interface RotationParams {
  angle: number; // in degrees
  axis: [number, number, number]; // [x, y, z] unit vector
}

export function createRotationMatrix(angle: number, axis: [number, number, number]): number[][] {
  const angleRad = angle * Math.PI / 180;
  const [x, y, z] = normalizeVector(axis);
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const oneMinusCos = 1 - cos;

  // Rodrigues' rotation formula for 3x3 rotation matrix
  return [
    [cos + x*x*oneMinusCos,     x*y*oneMinusCos - z*sin, x*z*oneMinusCos + y*sin],
    [y*x*oneMinusCos + z*sin,   cos + y*y*oneMinusCos,   y*z*oneMinusCos - x*sin],
    [z*x*oneMinusCos - y*sin,   z*y*oneMinusCos + x*sin, cos + z*z*oneMinusCos]
  ];
}

function normalizeVector(vec: [number, number, number]): [number, number, number] {
  const [x, y, z] = vec;
  const length = Math.sqrt(x*x + y*y + z*z);
  if (length === 0) {
    return [0, 0, 1]; // Default to z-axis if zero vector
  }
  return [x/length, y/length, z/length];
}

function multiplyMatrices(a: number[][], b: number[][]): number[][] {
  const rows = a.length;
  const cols = b[0].length;
  const result = Array(rows).fill(0).map(() => Array(cols).fill(0));
  
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      for (let k = 0; k < a[0].length; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

function transposeMatrix(matrix: number[][]): number[][] {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const transposed = Array(cols).fill(0).map(() => Array(rows).fill(0));
  
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      transposed[j][i] = matrix[i][j];
    }
  }
  return transposed;
}

function voigtMatrixFromTensor(C: number[][][][]): number[][] {
  const voigt = Array(6).fill(0).map(() => Array(6).fill(0));
  
  // Voigt notation mapping: (i,j) -> p
  const voigtMap = [
    [0, 0], // 1 -> 11
    [1, 1], // 2 -> 22  
    [2, 2], // 3 -> 33
    [1, 2], // 4 -> 23
    [0, 2], // 5 -> 13
    [0, 1]  // 6 -> 12
  ];
  
  for (let p = 0; p < 6; p++) {
    for (let q = 0; q < 6; q++) {
      const [i, j] = voigtMap[p];
      const [k, l] = voigtMap[q];
      voigt[p][q] = C[i][j][k][l];
    }
  }
  
  return voigt;
}

function tensorFromVoigtMatrix(voigt: number[][]): number[][][][] {
  // Initialize 3x3x3x3 tensor
  const C = Array(3).fill(0).map(() => 
    Array(3).fill(0).map(() => 
      Array(3).fill(0).map(() => 
        Array(3).fill(0))));
  
  // Voigt notation mapping: p -> (i,j)
  const voigtMap = [
    [0, 0], // 1 -> 11
    [1, 1], // 2 -> 22
    [2, 2], // 3 -> 33
    [1, 2], // 4 -> 23
    [0, 2], // 5 -> 13
    [0, 1]  // 6 -> 12
  ];
  
  for (let p = 0; p < 6; p++) {
    for (let q = 0; q < 6; q++) {
      const [i, j] = voigtMap[p];
      const [k, l] = voigtMap[q];
      
      // Fill tensor with symmetry
      C[i][j][k][l] = voigt[p][q];
      C[j][i][k][l] = voigt[p][q]; // symmetry in first pair
      C[i][j][l][k] = voigt[p][q]; // symmetry in second pair  
      C[j][i][l][k] = voigt[p][q]; // both symmetries
    }
  }
  
  return C;
}

export function rotateTensor(voigtMatrix: number[][], rotationMatrix: number[][]): number[][] {
  // Convert Voigt matrix to full 4th order tensor
  const C = tensorFromVoigtMatrix(voigtMatrix);
  
  // Perform tensor basis transformation: C'_ijkl = R_im R_jn R_ko R_lp C_mnop
  const rotatedC = Array(3).fill(0).map(() => 
    Array(3).fill(0).map(() => 
      Array(3).fill(0).map(() => 
        Array(3).fill(0))));
  
  const R = rotationMatrix;
  
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        for (let l = 0; l < 3; l++) {
          let sum = 0;
          for (let m = 0; m < 3; m++) {
            for (let n = 0; n < 3; n++) {
              for (let o = 0; o < 3; o++) {
                for (let p = 0; p < 3; p++) {
                  sum += R[i][m] * R[j][n] * R[k][o] * R[l][p] * C[m][n][o][p];
                }
              }
            }
          }
          rotatedC[i][j][k][l] = sum;
        }
      }
    }
  }
  
  // Convert back to Voigt notation
  return voigtMatrixFromTensor(rotatedC);
}

export interface TensorRotationResult {
  rotatedMatrix: number[][];
  rotationMatrix: number[][];
  params: RotationParams;
}

export function applyRotationToTensor(
  originalMatrix: number[][],
  angle: number,
  axis: [number, number, number]
): TensorRotationResult {
  const rotationMatrix = createRotationMatrix(angle, axis);
  const rotatedMatrix = rotateTensor(originalMatrix, rotationMatrix);
  
  return {
    rotatedMatrix,
    rotationMatrix,
    params: { angle, axis }
  };
}

// Predefined rotation axes
export const COMMON_AXES = {
  X: [1, 0, 0] as [number, number, number],
  Y: [0, 1, 0] as [number, number, number], 
  Z: [0, 0, 1] as [number, number, number],
  BODY_DIAGONAL: [1, 1, 1] as [number, number, number],
  FACE_DIAGONAL_XY: [1, 1, 0] as [number, number, number],
  FACE_DIAGONAL_XZ: [1, 0, 1] as [number, number, number],
  FACE_DIAGONAL_YZ: [0, 1, 1] as [number, number, number]
};

export { RotationParams };