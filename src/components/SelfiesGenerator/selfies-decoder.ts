/**
 * SELFIES (Self-Referencing Embedded Strings) decoder implementation in TypeScript
 * Based on the Python SELFIES library for generating valid molecular structures
 */

// ============================================================================
// Constants and Types
// ============================================================================

// Element sets
export const ORGANIC_SUBSET = new Set(['B', 'C', 'N', 'O', 'S', 'P', 'F', 'Cl', 'Br', 'I']);
const AROMATIC_SUBSET = new Set(['b', 'c', 'n', 'o', 's', 'p']);

// All valid elements
const ELEMENTS = new Set([
  'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne',
  'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca',
  'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
  'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr', 'Y', 'Zr',
  'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn',
  'Sb', 'Te', 'I', 'Xe', 'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd',
  'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb',
  'Lu', 'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg',
  'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn', 'Fr', 'Ra', 'Ac', 'Th',
  'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm',
  'Md', 'No', 'Lr', 'Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt', 'Ds',
  'Rg', 'Cn', 'Nh', 'Fl', 'Mc', 'Lv', 'Ts', 'Og'
]);

// Index encoding alphabet for numeric encoding
export const INDEX_ALPHABET = [
  '[C]', '[Ring1]', '[Ring2]',
  '[Branch1]', '[=Branch1]', '[#Branch1]',
  '[Branch2]', '[=Branch2]', '[#Branch2]',
  '[O]', '[N]', '[=N]', '[=C]', '[#C]', '[S]', '[P]'
];

// Create index code mapping
const INDEX_CODE: Map<string, number> = new Map();
INDEX_ALPHABET.forEach((symbol, index) => {
  INDEX_CODE.set(symbol, index);
});

// Default bonding capacities for common elements
const DEFAULT_CONSTRAINTS: Record<string, number> = {
  'H': 1, 'F': 1, 'Cl': 1, 'Br': 1, 'I': 1, 'At': 1,
  'B': 3, 'B+1': 2, 'B-1': 4,
  'C': 4, 'C+1': 3, 'C-1': 3,
  'N': 3, 'N+1': 4, 'N-1': 2,
  'O': 2, 'O+1': 3, 'O-1': 1,
  'P': 5, 'P+1': 4, 'P-1': 6,
  'S': 6, 'S+1': 5, 'S-1': 5,
  'Se': 6, 'Se+1': 5, 'Se-1': 5,
  'Te': 6, 'Te+1': 5, 'Te-1': 5,
  '?': 8  // default for unlisted atoms
};

// ============================================================================
// Core Classes
// ============================================================================

export class Atom {
  index: number | null = null;
  element: string;
  isAromatic: boolean;
  isotope?: number;
  chirality?: string;
  hCount: number;
  charge: number;
  
  constructor(
    element: string,
    isAromatic: boolean = false,
    isotope?: number,
    chirality?: string,
    hCount: number = 0,
    charge: number = 0
  ) {
    this.element = element;
    this.isAromatic = isAromatic;
    this.isotope = isotope;
    this.chirality = chirality;
    this.hCount = hCount;
    this.charge = charge;
  }
  
  get bondingCapacity(): number {
    const chargeStr = this.charge !== 0 
      ? `${this.charge > 0 ? '+' : ''}${Math.abs(this.charge)}`
      : '';
    const key = `${this.element}${chargeStr}`;
    
    let capacity = DEFAULT_CONSTRAINTS[key] ?? DEFAULT_CONSTRAINTS['?'];
    capacity -= this.hCount;
    return Math.max(0, capacity);
  }
  
  invertChirality(): void {
    if (this.chirality === '@') {
      this.chirality = '@@';
    } else if (this.chirality === '@@') {
      this.chirality = '@';
    }
  }
}

export class DirectedBond {
  src: number;
  dst: number;
  order: number;
  stereo?: string;
  ringBond: boolean;
  
  constructor(
    src: number,
    dst: number,
    order: number,
    stereo?: string,
    ringBond: boolean = false
  ) {
    this.src = src;
    this.dst = dst;
    this.order = order;
    this.stereo = stereo;
    this.ringBond = ringBond;
  }
}

export class MolecularGraph {
  private roots: number[] = [];
  private atoms: Atom[] = [];
  private bondDict: Map<string, DirectedBond> = new Map();
  private adjList: DirectedBond[][] = [];
  private bondCounts: number[] = [];
  private ringBondFlags: boolean[] = [];
  
  get length(): number {
    return this.atoms.length;
  }
  
  hasBond(a: number, b: number): boolean {
    const key = a < b ? `${a},${b}` : `${b},${a}`;
    return this.bondDict.has(key);
  }
  
  hasOutRingBond(src: number): boolean {
    return this.ringBondFlags[src] || false;
  }
  
  getRoots(): number[] {
    return this.roots;
  }
  
  getAtom(idx: number): Atom {
    return this.atoms[idx];
  }
  
  getAtoms(): Atom[] {
    return this.atoms;
  }
  
  getDirBond(src: number, dst: number): DirectedBond | undefined {
    return this.bondDict.get(`${src},${dst}`);
  }
  
  getOutDirBonds(src: number): DirectedBond[] {
    return this.adjList[src] || [];
  }
  
  getBondCount(idx: number): number {
    return this.bondCounts[idx] || 0;
  }
  
  addAtom(atom: Atom, markRoot: boolean = false): Atom {
    atom.index = this.atoms.length;
    
    if (markRoot) {
      this.roots.push(atom.index);
    }
    
    this.atoms.push(atom);
    this.adjList.push([]);
    this.bondCounts.push(0);
    this.ringBondFlags.push(false);
    
    return atom;
  }
  
  addBond(
    src: Atom,
    dst: Atom,
    order: number,
    stereo?: string,
    isRingBond: boolean = false
  ): void {
    if (src.index === null || dst.index === null) {
      throw new Error('Atoms must be added to graph before bonding');
    }
    
    const srcIdx = src.index;
    const dstIdx = dst.index;
    
    // Create directed bonds in both directions
    const forwardBond = new DirectedBond(srcIdx, dstIdx, order, stereo, isRingBond);
    const backwardBond = new DirectedBond(dstIdx, srcIdx, order, stereo, isRingBond);
    
    this.bondDict.set(`${srcIdx},${dstIdx}`, forwardBond);
    this.bondDict.set(`${dstIdx},${srcIdx}`, backwardBond);
    
    this.adjList[srcIdx].push(forwardBond);
    this.adjList[dstIdx].push(backwardBond);
    
    this.bondCounts[srcIdx] += order;
    this.bondCounts[dstIdx] += order;
    
    if (isRingBond) {
      this.ringBondFlags[srcIdx] = true;
      this.ringBondFlags[dstIdx] = true;
    }
  }
  
  kekulize(): void {
    // Find aromatic atoms
    const aromaticAtoms: number[] = [];
    for (let i = 0; i < this.atoms.length; i++) {
      if (this.atoms[i].isAromatic) {
        aromaticAtoms.push(i);
      }
    }
    
    if (aromaticAtoms.length === 0) return;
    
    // Build delocalization subgraph
    const delocalSubgraph: Map<number, number[]> = new Map();
    for (const idx of aromaticAtoms) {
      delocalSubgraph.set(idx, []);
    }
    
    // Find aromatic bonds (order 1.5)
    for (const [key, bond] of this.bondDict) {
      if (bond.order === 1.5 && 
          aromaticAtoms.includes(bond.src) && 
          aromaticAtoms.includes(bond.dst)) {
        const srcNeighbors = delocalSubgraph.get(bond.src) || [];
        if (!srcNeighbors.includes(bond.dst)) {
          srcNeighbors.push(bond.dst);
          delocalSubgraph.set(bond.src, srcNeighbors);
        }
      }
    }
    
    // Find perfect matching (simplified - just alternate bonds)
    const visited = new Set<number>();
    for (const [src, neighbors] of delocalSubgraph) {
      if (visited.has(src)) continue;
      
      for (const dst of neighbors) {
        if (visited.has(dst)) continue;
        
        // Set this bond to double
        const bond1 = this.bondDict.get(`${src},${dst}`);
        const bond2 = this.bondDict.get(`${dst},${src}`);
        if (bond1) bond1.order = 2;
        if (bond2) bond2.order = 2;
        
        visited.add(src);
        visited.add(dst);
        break;
      }
    }
    
    // Set remaining aromatic bonds to single
    for (const [key, bond] of this.bondDict) {
      if (bond.order === 1.5) {
        bond.order = 1;
      }
    }
    
    // Un-aromatize atoms
    for (const atom of this.atoms) {
      atom.isAromatic = false;
    }
  }
}

// ============================================================================
// Grammar Rules
// ============================================================================

const SELFIES_ATOM_PATTERN = /^\[([=#\/\\]?)(\d*)([A-Z][a-z]?)([@]{0,2})(H\d)?((?:[+-]\d+)?)\]$/;

interface ProcessedAtom {
  bondInfo: [number, string?];
  atom: Atom;
}

function processAtomSymbol(symbol: string): ProcessedAtom | null {
  const match = symbol.match(SELFIES_ATOM_PATTERN);
  if (!match) return null;
  
  const [, bondChar, isotopeStr, element, chirality, hCountStr, chargeStr] = match;
  
  // Parse bond order
  let bondOrder = 1;
  let stereo: string | undefined;
  if (bondChar === '=') bondOrder = 2;
  else if (bondChar === '#') bondOrder = 3;
  else if (bondChar === '/') stereo = '/';
  else if (bondChar === '\\') stereo = '\\';
  
  // Check if it's a simple organic element
  if (ORGANIC_SUBSET.has(element) && !isotopeStr && !chirality && !hCountStr && !chargeStr) {
    const atom = new Atom(element, false);
    return { bondInfo: [bondOrder, stereo], atom };
  }
  
  // Parse isotope
  const isotope = isotopeStr ? parseInt(isotopeStr, 10) : undefined;
  
  // Check element validity
  if (!ELEMENTS.has(element)) return null;
  
  // Parse H count
  let hCount = 0;
  if (hCountStr) {
    hCount = parseInt(hCountStr.substring(1), 10);
  }
  
  // Parse charge
  let charge = 0;
  if (chargeStr) {
    if (chargeStr === '+') charge = 1;
    else if (chargeStr === '-') charge = -1;
    else {
      charge = parseInt(chargeStr.substring(1), 10);
      if (chargeStr[0] === '-') charge = -charge;
    }
  }
  
  const atom = new Atom(element, false, isotope, chirality || undefined, hCount, charge);
  
  // Check if bonding capacity is valid
  if (atom.bondingCapacity < 0) return null;
  
  return { bondInfo: [bondOrder, stereo], atom };
}

function processBranchSymbol(symbol: string): [number, number] | null {
  const match = symbol.match(/^\[([=#]?)Branch(\d)\]$/);
  if (!match) return null;
  
  const [, bondChar, typeStr] = match;
  let bondOrder = 1;
  if (bondChar === '=') bondOrder = 2;
  else if (bondChar === '#') bondOrder = 3;
  
  const branchType = parseInt(typeStr, 10);
  if (branchType < 1 || branchType > 3) return null;
  
  return [bondOrder, branchType];
}

function processRingSymbol(symbol: string): [number, number, string?] | null {
  const match = symbol.match(/^\[([=#\/\\]?)Ring(\d)\]$/);
  if (!match) return null;
  
  const [, bondChar, typeStr] = match;
  let bondOrder = 1;
  let stereo: string | undefined;
  
  if (bondChar === '=') bondOrder = 2;
  else if (bondChar === '#') bondOrder = 3;
  else if (bondChar === '/') stereo = '/';
  else if (bondChar === '\\') stereo = '\\';
  
  const ringType = parseInt(typeStr, 10);
  if (ringType < 1 || ringType > 3) return null;
  
  return [bondOrder, ringType, stereo];
}

function nextAtomState(bondOrder: number, bondCap: number, state: number): [number, number | null] {
  if (state === 0) {
    bondOrder = 0;
  }
  
  bondOrder = Math.min(bondOrder, state, bondCap);
  const bondsLeft = bondCap - bondOrder;  // Remaining capacity of the NEW atom
  const nextState = bondsLeft === 0 ? null : bondsLeft;
  
  return [bondOrder, nextState];
}

function nextBranchState(branchType: number, state: number): [number, number] {
  const branchInitState = Math.min(state - 1, branchType);
  const nextState = state - branchInitState;
  return [branchInitState, nextState];
}

function nextRingState(ringType: number, state: number): [number, number | null] {
  const bondOrder = Math.min(ringType, state);
  const bondsLeft = state - bondOrder;
  const nextState = bondsLeft === 0 ? null : bondsLeft;
  return [bondOrder, nextState];
}

// ============================================================================
// Helper Functions
// ============================================================================

export function splitSelfies(selfies: string): string[] {
  const symbols: string[] = [];
  let i = 0;
  
  while (i < selfies.length) {
    if (selfies[i] === '[') {
      const end = selfies.indexOf(']', i);
      if (end === -1) {
        throw new Error('Unclosed bracket in SELFIES string');
      }
      symbols.push(selfies.slice(i, end + 1));
      i = end + 1;
    } else if (selfies[i] === '.') {
      symbols.push('.');
      i++;
    } else {
      i++; // Skip unexpected characters
    }
  }
  
  return symbols;
}

function getIndexFromSelfies(symbols: string[]): number {
  let index = 0;
  const base = INDEX_ALPHABET.length;
  
  for (let i = 0; i < symbols.length; i++) {
    const code = INDEX_CODE.get(symbols[symbols.length - 1 - i]) ?? 0;
    index += code * Math.pow(base, i);
  }
  
  return index;
}

// ============================================================================
// Main Decoder
// ============================================================================

interface RingInfo {
  atomIdx: number;
  bondOrder: number;
  stereo?: string;
  targetDistance: number;
}

function deriveMolFromSymbols(
  symbols: string[],
  mol: MolecularGraph,
  maxDerive: number,
  initState: number,
  rootAtom: Atom | null,
  rings: RingInfo[]
): number {
  let nDerived = 0;
  let state: number | null = initState;
  let prevAtom = rootAtom;
  
  let i = 0;
  while (state !== null && i < symbols.length && nDerived < maxDerive) {
    const symbol = symbols[i];
    nDerived++;
    
    // Handle branch symbols
    if (symbol.includes('Branch')) {
      const branchResult = processBranchSymbol(symbol);
      if (!branchResult) {
        throw new Error(`Invalid branch symbol: ${symbol}`);
      }
      
      const [branchBondOrder, branchType] = branchResult;
      
      if (state === null || state <= 1) {
        // Can't branch with 0 or 1 bonds
        i++;
        continue;
      }
      
      const [branchInitState, nextState] = nextBranchState(branchType, state);
      
      // Read index symbols to get branch length
      const indexSymbols: string[] = [];
      i++;
      while (i < symbols.length && INDEX_ALPHABET.includes(symbols[i])) {
        indexSymbols.push(symbols[i]);
        i++;
        nDerived++;
      }
      
      const branchLength = getIndexFromSelfies(indexSymbols);
      
      if (branchLength > 0 && prevAtom) {
        // Recursively derive branch
        const branchSymbols = symbols.slice(i, i + branchLength + 1);
        const branchProcessed = deriveMolFromSymbols(
          branchSymbols,
          mol,
          branchLength + 1,
          branchInitState,
          prevAtom,
          rings
        );
        nDerived += branchProcessed;
        i += branchLength + 1;
      }
      
      state = nextState;
      continue;
    }
    
    // Handle ring symbols  
    if (symbol.includes('Ring')) {
      const ringResult = processRingSymbol(symbol);
      if (!ringResult) {
        throw new Error(`Invalid ring symbol: ${symbol}`);
      }
      
      const [ringOrder, ringType, stereo] = ringResult;
      
      if (state === null || state === 0 || !prevAtom) {
        state = state === 0 ? null : state;
        i++;
        continue;
      }
      
      const [bondOrder, nextState] = nextRingState(ringType, state);
      
      // Read index symbols to get ring distance
      const indexSymbols: string[] = [];
      i++;
      while (i < symbols.length && INDEX_ALPHABET.includes(symbols[i])) {
        indexSymbols.push(symbols[i]);
        i++;
        nDerived++;
      }
      
      const ringDistance = getIndexFromSelfies(indexSymbols);
      
      if (ringDistance > 0 && prevAtom.index !== null) {
        rings.push({
          atomIdx: prevAtom.index,
          bondOrder,
          stereo,
          targetDistance: ringDistance + 1
        });
      }
      
      state = nextState;
      continue;
    }
    
    // Handle epsilon (end) symbol
    if (symbol === '[epsilon]') {
      state = state === 0 ? null : 0;
      i++;
      continue;
    }
    
    // Handle regular atom symbols
    const atomResult = processAtomSymbol(symbol);
    if (atomResult) {
      const { bondInfo, atom } = atomResult;
      const [bondOrder, stereo] = bondInfo;
      const cap = atom.bondingCapacity;
      
      const [actualBondOrder, nextState] = nextAtomState(bondOrder, cap, state || 0);
      
      if (actualBondOrder === 0) {
        // Add as root atom if state == 0, otherwise just add atom
        const addedAtom = mol.addAtom(atom, state === 0 || state === null);
        prevAtom = addedAtom;
      } else {
        // Add atom and bond to previous
        const addedAtom = mol.addAtom(atom, false);
        if (prevAtom && prevAtom.index !== null && addedAtom.index !== null) {
          mol.addBond(prevAtom, addedAtom, actualBondOrder, stereo);
        }
        prevAtom = addedAtom;
      }
      
      // Update state - this determines if we continue processing
      state = nextState;
      
      i++;
      
      // Break if no more bonds available (like Python implementation)
      if (state === null) {
        break;
      }
      
      continue;
    }
    
    // Unknown symbol - throw error
    throw new Error(`Invalid SELFIES symbol: ${symbol}`);
  }
  
  // Consume any remaining tokens (like Python implementation)
  while (i < symbols.length && nDerived < maxDerive) {
    i++;
    nDerived++;
  }
  
  return nDerived;
}

function formRingsBilocally(mol: MolecularGraph, rings: RingInfo[]): void {
  for (const ring of rings) {
    const srcIdx = ring.atomIdx;
    const dstIdx = Math.max(0, srcIdx - ring.targetDistance);
    
    if (dstIdx >= mol.length) continue;
    
    const srcAtom = mol.getAtom(srcIdx);
    const dstAtom = mol.getAtom(dstIdx);
    
    // Check if bond already exists
    if (mol.hasBond(srcIdx, dstIdx)) continue;
    
    // Calculate available bonds
    const srcUsed = mol.getBondCount(srcIdx);
    const dstUsed = mol.getBondCount(dstIdx);
    
    const srcAvailable = srcAtom.bondingCapacity - srcUsed;
    const dstAvailable = dstAtom.bondingCapacity - dstUsed;
    
    const maxBondOrder = Math.min(ring.bondOrder, srcAvailable, dstAvailable);
    
    if (maxBondOrder > 0) {
      mol.addBond(srcAtom, dstAtom, maxBondOrder, ring.stereo, true);
    }
  }
}

export function decoder(selfies: string): string {
  if (!selfies) return '';
  
  const fragments = selfies.split('.');
  const smilesFragments: string[] = [];
  
  for (const fragment of fragments) {
    if (!fragment) continue;
    
    const mol = new MolecularGraph();
    const rings: RingInfo[] = [];
    const symbols = splitSelfies(fragment);
    
    deriveMolFromSymbols(
      symbols,
      mol,
      Infinity,
      0,
      null,
      rings
    );
    
    formRingsBilocally(mol, rings);
    
    // Convert to SMILES
    const smiles = molToSmiles(mol);
    if (smiles) {
      smilesFragments.push(smiles);
    }
  }
  
  return smilesFragments.join('.');
}

// ============================================================================
// SMILES Generation
// ============================================================================

function molToSmiles(mol: MolecularGraph): string {
  if (mol.length === 0) return '';
  
  // Kekulize aromatic systems
  mol.kekulize();
  
  const visited = new Set<number>();
  const smiles: string[] = [];
  const ringClosures = new Map<string, number>();
  let nextRingNumber = 1;
  
  function dfs(atomIdx: number, parentIdx: number = -1): void {
    if (visited.has(atomIdx)) return;
    visited.add(atomIdx);
    
    const atom = mol.getAtom(atomIdx);
    
    // Generate atom SMILES
    let atomStr = '';
    const needsBrackets = 
      atom.isotope !== undefined ||
      atom.charge !== 0 ||
      atom.hCount > 0 ||
      atom.chirality !== undefined ||
      !ORGANIC_SUBSET.has(atom.element) ||
      atom.isAromatic;
    
    if (needsBrackets) {
      atomStr = '[';
      if (atom.isotope) atomStr += atom.isotope;
      atomStr += atom.isAromatic ? atom.element.toLowerCase() : atom.element;
      if (atom.chirality) atomStr += atom.chirality;
      if (atom.hCount > 0) {
        atomStr += 'H';
        if (atom.hCount > 1) atomStr += atom.hCount;
      }
      if (atom.charge !== 0) {
        const sign = atom.charge > 0 ? '+' : '-';
        const absCharge = Math.abs(atom.charge);
        atomStr += `${sign}${absCharge}`;
      }
      atomStr += ']';
    } else {
      atomStr = atom.element;
    }
    
    smiles.push(atomStr);
    
    // Get outgoing bonds
    const bonds = mol.getOutDirBonds(atomIdx);
    const unvisitedBonds: DirectedBond[] = [];
    
    // Handle ring closures first
    for (const bond of bonds) {
      if (visited.has(bond.dst) && bond.dst !== parentIdx) {
        // Ring closure
        const ringKey = atomIdx < bond.dst 
          ? `${atomIdx},${bond.dst}` 
          : `${bond.dst},${atomIdx}`;
        
        if (!ringClosures.has(ringKey)) {
          const ringNum = nextRingNumber++;
          ringClosures.set(ringKey, ringNum);
          
          let bondSymbol = '';
          if (bond.order === 2) bondSymbol = '=';
          else if (bond.order === 3) bondSymbol = '#';
          else if (bond.stereo === '/') bondSymbol = '/';
          else if (bond.stereo === '\\') bondSymbol = '\\';
          
          const ringStr = ringNum < 10 ? ringNum.toString() : `%${ringNum}`;
          smiles.push(bondSymbol + ringStr);
        }
      } else if (!visited.has(bond.dst)) {
        unvisitedBonds.push(bond);
      }
    }
    
    // Traverse unvisited neighbors
    for (let i = 0; i < unvisitedBonds.length; i++) {
      const bond = unvisitedBonds[i];
      
      // Add branch notation if needed
      if (i > 0) {
        smiles.push('(');
      }
      
      // Add bond symbol
      if (bond.order === 2) smiles.push('=');
      else if (bond.order === 3) smiles.push('#');
      else if (bond.stereo === '/') smiles.push('/');
      else if (bond.stereo === '\\') smiles.push('\\');
      
      // Recursively visit
      dfs(bond.dst, atomIdx);
      
      // Close branch
      if (i > 0) {
        smiles.push(')');
      }
    }
  }
  
  // Start DFS from each root
  const roots = mol.getRoots();
  if (roots.length === 0 && mol.length > 0) {
    // No explicit roots, start from first atom
    dfs(0);
  } else {
    for (let i = 0; i < roots.length; i++) {
      if (i > 0) smiles.push('.');
      dfs(roots[i]);
    }
  }
  
  // Handle any unvisited atoms (disconnected components)
  for (let i = 0; i < mol.length; i++) {
    if (!visited.has(i)) {
      if (smiles.length > 0) smiles.push('.');
      dfs(i);
    }
  }
  
  return smiles.join('');
}