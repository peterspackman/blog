/**
 * Wrapper for the @peterspackman/selfies v0.2.0 library
 */

import { 
  decoder as selfiesDecoder, 
  encoder as selfiesEncoder,
  getSemanticRobustAlphabet,
  splitSelfies as splitSelfiesFunction,
  lenSelfies,
  getAlphabetFromSelfies
} from '@peterspackman/selfies';

// Direct re-exports - v0.2.0 API is much cleaner
export const decoder = selfiesDecoder;
export const encoder = selfiesEncoder;
export { getSemanticRobustAlphabet };

// Wrapper for splitSelfies to return array
export function splitSelfies(selfies: string): string[] {
  return splitSelfiesFunction(selfies);
}

// Additional utility functions from v0.2.0
export { lenSelfies, getAlphabetFromSelfies };

// Utility function to analyze SELFIES strings
export function getSelfiesStats(selfies: string) {
  const symbols = splitSelfies(selfies);
  const totalSymbols = symbols.length;
  
  // Count different types of symbols
  let atomCount = 0;
  let branchCount = 0;
  let ringCount = 0;
  const uniqueElements = new Set<string>();
  
  for (const symbol of symbols) {
    if (symbol.includes('Branch')) {
      branchCount++;
    } else if (symbol.includes('Ring')) {
      ringCount++;
    } else if (/^\[[A-Z]/.test(symbol)) {
      atomCount++;
      // Extract element symbol (first capital letter + optional lowercase)
      const match = symbol.match(/\[([A-Z][a-z]?)/);
      if (match) {
        uniqueElements.add(match[1]);
      }
    }
  }
  
  return {
    totalSymbols,
    atomCount,
    branchCount,
    ringCount,
    uniqueElements
  };
}

// Generate random SELFIES using the safe alphabet from the package
export function generateRandomSelfies(length: number = 10): string {
  const alphabet = Array.from(getSelfiesAlphabet());
  
  // Filter out complex symbols for simpler molecules
  const safeSymbols = alphabet.filter(s => 
    !s.includes('Branch') && 
    !s.includes('Ring') && 
    s !== '[epsilon]'
  );
  
  const symbols: string[] = [];
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * safeSymbols.length);
    symbols.push(safeSymbols[randomIndex]);
  }
  
  return symbols.join('');
}

// Common organic building blocks as SELFIES (using v0.2.0 syntax)
const BUILDING_BLOCKS = {
  // Core structures
  benzene: '[C][=C][C][=C][C][=C][Ring1][Ring1]', // C1=CC=CC=C1
  cyclohexane: '[C][C][C][C][C][C][Ring1][Ring1]', // C1CCCCC1
  pyridine: '[C][=C][C][=C][N][=C][Ring1][Ring1]', // c1ccncc1
  
  // Functional groups
  methyl: '[C]',
  ethyl: '[C][C]',
  propyl: '[C][C][C]',
  alcohol: '[O]',
  ketone: '[=O]',
  amine: '[N]',
  carboxyl: '[C][=O][O]',
  
  // Linkers
  alkyl_chain_3: '[C][C][C]',
  alkyl_chain_4: '[C][C][C][C]',
  alkyl_chain_5: '[C][C][C][C][C]',
  double_bond: '[=C]',
  
  // Branches (using correct v0.2.0 syntax)
  isobutane: '[C][C][Branch1][C][C][C]',           // CC(C)C - working pattern
  methylbutane: '[C][C][C][Branch1][C][C][C]',     // CCC(C)C
  isopropanol: '[C][C][Branch1][C][C][O]',         // CC(C)O
  tertbutane: '[C][C][Branch1][C][C][Branch1][C][C][C]', // CC(C)(C)C
  
  // Simple branches
  methyl_branch: '[Branch1][C][C]',                // (C) branch
  ethyl_branch: '[Branch1][C][C][C]',              // (CC) branch
  hydroxyl_branch: '[Branch1][C][O]',              // (O) branch
};

// Base molecules to perturb (known good SELFIES)
const BASE_MOLECULES = [
  // Simple molecules
  '[C][C]',                                    // ethane
  '[C][C][C]',                                 // propane
  '[C][C][C][C]',                              // butane
  '[C][C][O]',                                 // ethanol
  '[C][=C]',                                   // ethylene
  
  // Branched molecules  
  '[C][C][Branch1][C][C][C]',                  // CC(C)C - isobutane
  '[C][C][C][Branch1][C][C][C]',               // CCC(C)C - 2-methylbutane
  '[C][C][Branch1][C][C][O]',                  // CC(C)O - isopropanol
  '[C][C][Branch1][C][C][Branch1][C][C][C]',   // CC(C)(C)C - tert-butane
  
  // Ring molecules
  '[C][Branch1][Branch2][C][C][C][C][C][Ring1][=Branch1]', // cyclohexane
  '[C][=C][C][=C][C][=C][Ring1][Ring1]',       // benzene
];

// Global counter for enumerating all possible molecules
let moleculeCounter = 0;

// Generate SELFIES by enumerating all N^M combinations systematically
export function generateSmartRandomSelfies(maxLength: number = 15, startPosition?: number): string {
  const alphabet = Array.from(getSemanticRobustAlphabet());
  const alphabetSize = alphabet.length;
  
  // Calculate how many symbols to use based on maxLength
  let symbolCount;
  if (maxLength <= 6) {
    symbolCount = 2;
  } else if (maxLength <= 10) {
    symbolCount = 3;
  } else if (maxLength <= 20) {
    symbolCount = 4;
  } else if (maxLength <= 50) {
    symbolCount = 5;
  } else {
    symbolCount = 6; // For 100+ maxLength, use 6 symbols
  }
  
  // Use provided position or increment the global counter
  const currentPosition = startPosition !== undefined ? startPosition : moleculeCounter;
  
  // Convert position to base-N representation
  const symbols = [];
  let remaining = currentPosition;
  
  for (let position = 0; position < symbolCount; position++) {
    const symbolIndex = remaining % alphabetSize;
    symbols.push(alphabet[symbolIndex]);
    remaining = Math.floor(remaining / alphabetSize);
  }
  
  // Only increment global counter if we're not using a specific position
  if (startPosition === undefined) {
    moleculeCounter++;
    // Calculate total possible combinations for this symbol count
    const totalCombinations = Math.pow(alphabetSize, symbolCount);
    // Reset counter if we've exhausted all combinations
    if (moleculeCounter >= totalCombinations) {
      moleculeCounter = 0;
    }
  }
  
  const totalCombinations = Math.pow(alphabetSize, symbolCount);
  
  const result = symbols.join('');
  
  // Debug info for complex molecules
  if (maxLength >= 50) {
    console.log(`Combination ${currentPosition}/${totalCombinations} (${symbolCount} symbols):`, result);
    console.log(`Total possible molecules with ${symbolCount} symbols: ${totalCombinations.toLocaleString()}`);
  }
  
  // Validate the result
  try {
    const testSmiles = decoder(result);
    if (testSmiles && testSmiles.length >= 1) {
      if (maxLength >= 50) {
        console.log('SMILES:', testSmiles);
        console.log('Has branching:', /\(/.test(testSmiles));
      }
      return result;
    }
  } catch (e) {
    // If validation fails, just return it anyway - let the filter handle it
  }
  
  return result;
}

// Get total number of possible molecules for a given complexity
export function getTotalMoleculeCount(maxLength: number): number {
  const alphabet = Array.from(getSemanticRobustAlphabet());
  const alphabetSize = alphabet.length;
  
  let symbolCount;
  if (maxLength <= 6) {
    symbolCount = 2;
  } else if (maxLength <= 10) {
    symbolCount = 3;
  } else if (maxLength <= 20) {
    symbolCount = 4;
  } else if (maxLength <= 50) {
    symbolCount = 5;
  } else {
    symbolCount = 6;
  }
  
  return Math.pow(alphabetSize, symbolCount);
}

// Generate a specific molecule by its index in chemical space
export function generateMoleculeByIndex(index: number, maxLength: number): { selfies: string; position: number; total: number } {
  const total = getTotalMoleculeCount(maxLength);
  // Clamp to valid range instead of wrapping around
  const normalizedIndex = Math.max(0, Math.min(index, total - 1));
  
  const selfies = generateSmartRandomSelfies(maxLength, normalizedIndex);
  
  return {
    selfies,
    position: normalizedIndex,
    total
  };
}

// Helper function to get random atoms
function getRandomAtoms(count: number): string[] {
  const atoms = ['[C]', '[C]', '[C]', '[N]', '[O]', '[S]', '[F]', '[Cl]', '[Br]', '[=C]', '[=N]', '[=O]'];
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(atoms[Math.floor(Math.random() * atoms.length)]);
  }
  return result;
}

// Random alphabet sampling
export function generateRandomSampleSelfies(sampleSize: number = 9): string {
  const alphabet = Array.from(getSelfiesAlphabet());
  
  const safeSymbols = alphabet.filter(s => 
    !s.includes('Branch') && 
    !s.includes('Ring') && 
    s !== '[epsilon]' &&
    /^\[(=|#)?[A-Z][a-z]?(\+\d|\-\d)?\]$/.test(s) // Only basic atoms
  );
  
  // Random sampling without replacement
  const sampled: string[] = [];
  const usedIndices = new Set<number>();
  
  const actualSampleSize = Math.min(sampleSize, safeSymbols.length);
  
  while (sampled.length < actualSampleSize) {
    const idx = Math.floor(Math.random() * safeSymbols.length);
    if (!usedIndices.has(idx)) {
      usedIndices.add(idx);
      sampled.push(safeSymbols[idx]);
    }
  }
  
  return sampled.join('');
}

// Note: selfies-utils import removed due to missing file