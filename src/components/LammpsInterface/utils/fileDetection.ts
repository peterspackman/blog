/**
 * Utility functions for detecting and classifying LAMMPS input files
 */

export const INPUT_FILE_PATTERNS = [
  /\.lmp$/i,
  /\.in$/i,
  /\.inp$/i,
  /input/i,
  /lammps/i,
];

export const TRAJECTORY_FILE_PATTERNS = [
  /\.xyz$/i,
  /\.dcd$/i,
  /\.lammpstrj$/i,
  /trajectory/i,
];

/**
 * Check if a filename looks like a LAMMPS input file
 */
export const isLikelyInputFile = (filename: string): boolean => {
  return INPUT_FILE_PATTERNS.some(pattern => pattern.test(filename));
};

/**
 * Check if a filename looks like a trajectory file
 */
export const isTrajectoryFile = (filename: string): boolean => {
  return TRAJECTORY_FILE_PATTERNS.some(pattern => pattern.test(filename));
};

/**
 * Get trajectory format from filename
 */
export const getTrajectoryFormat = (filename: string): 'xyz' | 'dcd' | 'lammpstrj' | null => {
  if (/\.dcd$/i.test(filename)) return 'dcd';
  if (/\.lammpstrj$/i.test(filename)) return 'lammpstrj';
  if (/\.xyz$/i.test(filename)) return 'xyz';
  return null;
};

/**
 * Auto-detect the main input file from a list of files
 * Priority order:
 * 1. Any file ending with .inp (most specific LAMMPS input extension)
 * 2. Exact match: input.lmp
 * 3. Contains "input" and ends with .lmp/.in/.inp
 * 4. Any file ending with .lmp or .in
 * 5. Any file containing "input"
 */
export const detectMainInputFile = (filenames: string[]): string | null => {
  // Priority 1: Any file ending with .inp (most specific)
  const inpFile = filenames.find(f => /\.inp$/i.test(f));
  if (inpFile) return inpFile;

  // Priority 2: Exact match "input.lmp"
  const exactMatch = filenames.find(f => f.toLowerCase() === 'input.lmp');
  if (exactMatch) return exactMatch;

  // Priority 3: Contains "input" AND has correct extension
  const inputWithExt = filenames.find(f =>
    /input/i.test(f) && /\.(lmp|in)$/i.test(f)
  );
  if (inputWithExt) return inputWithExt;

  // Priority 4: Any file with .lmp or .in extension
  const withExt = filenames.find(f => /\.(lmp|in)$/i.test(f));
  if (withExt) return withExt;

  // Priority 5: Any file containing "input"
  const withInput = filenames.find(f => /input/i.test(f));
  if (withInput) return withInput;

  return null;
};
