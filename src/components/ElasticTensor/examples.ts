/** Example stiffness tensors (Voigt notation, GPa). */
export const EXAMPLE_TENSORS = [
  {
    name: 'Silicon',
    input: `166  64  64   0   0   0
 64 166  64   0   0   0
 64  64 166   0   0   0
  0   0   0  80   0   0
  0   0   0   0  80   0
  0   0   0   0   0  80`,
  },
  {
    name: 'Quartz',
    input: `48.137 11.411 12.783  0.000 -3.654  0.000
11.411 34.968 14.749  0.000 -0.094  0.000
12.783 14.749 26.015  0.000 -4.528  0.000
 0.000  0.000  0.000 14.545  0.000  0.006
-3.654 -0.094 -4.528  0.000 10.771  0.000
 0.000  0.000  0.000  0.006  0.000 11.947`,
  },
];

/** Parse a full 6×6 or upper-triangular stiffness matrix into a full 6×6. */
export function parseTensorInput(input: string): number[][] {
  const lines = input.trim().split('\n').filter((line) => line.trim());
  if (lines.length !== 6) throw new Error('Elastic tensor must have exactly 6 rows');

  const matrix = lines.map((line) => line.trim().split(/\s+/).map(parseFloat));
  if (matrix.some((row) => row.some(isNaN))) throw new Error('All values must be valid numbers');

  if (matrix.every((row) => row.length === 6)) return matrix;
  if (!matrix.every((row, i) => row.length === 6 - i)) {
    throw new Error('Matrix must be either full 6x6 or upper triangular format');
  }
  const full = Array.from({ length: 6 }, () => Array(6).fill(0));
  matrix.forEach((row, i) =>
    row.forEach((value, j) => {
      full[i][i + j] = value;
      full[i + j][i] = value;
    }),
  );
  return full;
}
