/**
 * Parser for LAMMPS data files (coord.lmp format)
 * Converts LAMMPS data files to PDB format that NGL.js can display
 */

export interface LammpsAtom {
  id: number;
  moleculeId: number;
  type: number;
  charge: number;
  x: number;
  y: number;
  z: number;
}

export interface LammpsBond {
  id: number;
  type: number;
  atom1: number;
  atom2: number;
}

export interface LammpsMass {
  type: number;
  mass: number;
}

export interface LammpsDataFile {
  atoms: LammpsAtom[];
  bonds: LammpsBond[];
  masses: LammpsMass[];
  atomTypes: number;
  box: {
    xlo: number; xhi: number;
    ylo: number; yhi: number;
    zlo: number; zhi: number;
  };
}

/**
 * Check if a file is likely a LAMMPS data/coord file
 */
export const isLammpsDataFile = (filename: string): boolean => {
  // Common patterns for LAMMPS data files
  return /coord\.lmp$/i.test(filename) ||
         /data\.lmp$/i.test(filename) ||
         /\.data$/i.test(filename) ||
         (/\.lmp$/i.test(filename) && !/input|forcefield/i.test(filename));
};

/**
 * Guess element symbol from atomic mass
 */
const massToElement = (mass: number): string => {
  // Common elements and their masses
  const elements: [number, string][] = [
    [1.008, 'H'],
    [12.01, 'C'],
    [14.01, 'N'],
    [16.00, 'O'],
    [19.00, 'F'],
    [28.09, 'Si'],
    [32.06, 'S'],
    [35.45, 'Cl'],
    [39.95, 'Ar'],
    [79.90, 'Br'],
    [126.9, 'I'],
  ];

  // Find closest match
  let closest = 'X';
  let minDiff = Infinity;

  for (const [m, el] of elements) {
    const diff = Math.abs(mass - m);
    if (diff < minDiff) {
      minDiff = diff;
      closest = el;
    }
  }

  // Only accept if reasonably close (within 1 amu)
  return minDiff < 1.5 ? closest : 'X';
};

/**
 * Parse a LAMMPS data file
 */
export const parseLammpsDataFile = (content: string): LammpsDataFile | null => {
  const lines = content.split('\n');
  const result: LammpsDataFile = {
    atoms: [],
    bonds: [],
    masses: [],
    atomTypes: 0,
    box: { xlo: 0, xhi: 0, ylo: 0, yhi: 0, zlo: 0, zhi: 0 }
  };

  let section = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) continue;

    // Parse header info
    if (line.includes('atom types')) {
      const match = line.match(/(\d+)\s+atom types/);
      if (match) result.atomTypes = parseInt(match[1]);
      continue;
    }

    if (line.includes('xlo xhi')) {
      const match = line.match(/([-\d.]+)\s+([-\d.]+)\s+xlo xhi/);
      if (match) {
        result.box.xlo = parseFloat(match[1]);
        result.box.xhi = parseFloat(match[2]);
      }
      continue;
    }

    if (line.includes('ylo yhi')) {
      const match = line.match(/([-\d.]+)\s+([-\d.]+)\s+ylo yhi/);
      if (match) {
        result.box.ylo = parseFloat(match[1]);
        result.box.yhi = parseFloat(match[2]);
      }
      continue;
    }

    if (line.includes('zlo zhi')) {
      const match = line.match(/([-\d.]+)\s+([-\d.]+)\s+zlo zhi/);
      if (match) {
        result.box.zlo = parseFloat(match[1]);
        result.box.zhi = parseFloat(match[2]);
      }
      continue;
    }

    // Detect section headers
    if (line === 'Masses') {
      section = 'masses';
      continue;
    }
    if (line === 'Atoms') {
      section = 'atoms';
      continue;
    }
    if (line === 'Bonds') {
      section = 'bonds';
      continue;
    }
    if (line === 'Angles' || line === 'Dihedrals' || line === 'Impropers') {
      section = '';  // Stop parsing
      continue;
    }

    // Parse section content
    if (section === 'masses') {
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        const type = parseInt(parts[0]);
        const mass = parseFloat(parts[1]);
        if (!isNaN(type) && !isNaN(mass)) {
          result.masses.push({ type, mass });
        }
      }
    }

    if (section === 'atoms') {
      const parts = line.split(/\s+/);
      // Format: atom_id molecule_id type charge x y z
      if (parts.length >= 7) {
        const atom: LammpsAtom = {
          id: parseInt(parts[0]),
          moleculeId: parseInt(parts[1]),
          type: parseInt(parts[2]),
          charge: parseFloat(parts[3]),
          x: parseFloat(parts[4]),
          y: parseFloat(parts[5]),
          z: parseFloat(parts[6])
        };
        if (!isNaN(atom.id) && !isNaN(atom.x)) {
          result.atoms.push(atom);
        }
      }
    }

    if (section === 'bonds') {
      const parts = line.split(/\s+/);
      // Format: bond_id bond_type atom1 atom2
      if (parts.length >= 4) {
        const bond: LammpsBond = {
          id: parseInt(parts[0]),
          type: parseInt(parts[1]),
          atom1: parseInt(parts[2]),
          atom2: parseInt(parts[3])
        };
        if (!isNaN(bond.id) && !isNaN(bond.atom1) && !isNaN(bond.atom2)) {
          result.bonds.push(bond);
        }
      }
    }
  }

  return result.atoms.length > 0 ? result : null;
};

/**
 * Convert LAMMPS data file to PDB format string with CONECT records for bonds
 */
export const lammpsDataToPDB = (
  data: LammpsDataFile,
  elementMap?: Map<number, string>
): string => {
  // Build element map from masses if not provided
  const elements = new Map<number, string>();

  if (elementMap) {
    elementMap.forEach((el, type) => elements.set(type, el));
  } else {
    for (const { type, mass } of data.masses) {
      elements.set(type, massToElement(mass));
    }
  }

  // Sort atoms by ID and create ID to index mapping
  const sortedAtoms = [...data.atoms].sort((a, b) => a.id - b.id);
  const atomIdToIndex = new Map<number, number>();
  sortedAtoms.forEach((atom, idx) => {
    atomIdToIndex.set(atom.id, idx + 1); // PDB uses 1-based indexing
  });

  const lines: string[] = [];

  // Add CRYST1 record for box dimensions
  const a = data.box.xhi - data.box.xlo;
  const b = data.box.yhi - data.box.ylo;
  const c = data.box.zhi - data.box.zlo;
  lines.push(
    `CRYST1${a.toFixed(3).padStart(9)}${b.toFixed(3).padStart(9)}${c.toFixed(3).padStart(9)}` +
    `  90.00  90.00  90.00 P 1           1`
  );

  // Add atoms
  for (let i = 0; i < sortedAtoms.length; i++) {
    const atom = sortedAtoms[i];
    const element = elements.get(atom.type) || 'X';
    const atomNum = ((i + 1) % 100000).toString().padStart(5);
    const atomName = element.padEnd(4);
    const resName = 'MOL';
    const chainID = String.fromCharCode(65 + (atom.moleculeId % 26)); // A-Z based on molecule
    const resSeq = (atom.moleculeId % 10000).toString().padStart(4);
    const x = atom.x.toFixed(3).padStart(8);
    const y = atom.y.toFixed(3).padStart(8);
    const z = atom.z.toFixed(3).padStart(8);

    lines.push(
      `ATOM  ${atomNum} ${atomName} ${resName} ${chainID}${resSeq}    ${x}${y}${z}  1.00  0.00           ${element.padStart(2)}`
    );
  }

  // Build connectivity map (atom -> list of bonded atoms)
  const connectivity = new Map<number, number[]>();
  for (const bond of data.bonds) {
    const idx1 = atomIdToIndex.get(bond.atom1);
    const idx2 = atomIdToIndex.get(bond.atom2);
    if (idx1 && idx2) {
      if (!connectivity.has(idx1)) connectivity.set(idx1, []);
      if (!connectivity.has(idx2)) connectivity.set(idx2, []);
      connectivity.get(idx1)!.push(idx2);
      connectivity.get(idx2)!.push(idx1);
    }
  }

  // Add CONECT records (PDB format allows up to 4 bonds per line)
  for (const [atomIdx, bonded] of connectivity) {
    // Sort bonded atoms for consistent output
    const sortedBonded = [...bonded].sort((a, b) => a - b);

    // Split into chunks of 4 (PDB CONECT format limit)
    for (let i = 0; i < sortedBonded.length; i += 4) {
      const chunk = sortedBonded.slice(i, i + 4);
      let conectLine = `CONECT${atomIdx.toString().padStart(5)}`;
      for (const b of chunk) {
        conectLine += b.toString().padStart(5);
      }
      lines.push(conectLine);
    }
  }

  lines.push('END');
  return lines.join('\n');
};
