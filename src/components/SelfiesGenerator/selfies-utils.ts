/**
 * SELFIES utility functions for alphabet generation and random molecule creation
 */

import { ORGANIC_SUBSET, INDEX_ALPHABET } from './selfies-decoder';

/**
 * Get the semantic robust alphabet - all valid SELFIES symbols
 * Based on the official Python SELFIES implementation
 */
export function getSemanticRobustAlphabet(): Set<string> {
  // This matches the exact alphabet from Python SELFIES
  const validSymbols = [
    '[#B-1]', '[#B]', '[#Branch1]', '[#Branch2]', '[#Branch3]', '[#C+1]',
    '[#C-1]', '[#C]', '[#N+1]', '[#N]', '[#O+1]', '[#P+1]',
    '[#P-1]', '[#P]', '[#S+1]', '[#S-1]', '[#S]', '[=B+1]',
    '[=B-1]', '[=B]', '[=Branch1]', '[=Branch2]', '[=Branch3]', '[=C+1]',
    '[=C-1]', '[=C]', '[=N+1]', '[=N-1]', '[=N]', '[=O+1]',
    '[=O]', '[=P+1]', '[=P-1]', '[=P]', '[=Ring1]', '[=Ring2]',
    '[=Ring3]', '[=S+1]', '[=S-1]', '[=S]', '[B+1]', '[B-1]',
    '[B]', '[Br]', '[Branch1]', '[Branch2]', '[Branch3]', '[C+1]',
    '[C-1]', '[C]', '[Cl]', '[F]', '[H]', '[I]',
    '[N+1]', '[N-1]', '[N]', '[O+1]', '[O-1]', '[O]',
    '[P+1]', '[P-1]', '[P]', '[Ring1]', '[Ring2]', '[Ring3]',
    '[S+1]', '[S-1]', '[S]'
  ];
  
  return new Set(validSymbols);
}

/**
 * Generate a random SELFIES string from the alphabet
 */
export function generateRandomSelfies(length: number = 10): string {
  const alphabet = Array.from(getSemanticRobustAlphabet());
  
  // Remove index symbols and epsilon from random generation
  // as they need special context
  const validSymbols = alphabet.filter(s => 
    !INDEX_ALPHABET.includes(s) && s !== '[epsilon]'
  );
  
  const symbols: string[] = [];
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * validSymbols.length);
    symbols.push(validSymbols[randomIndex]);
  }
  
  return symbols.join('');
}

/**
 * Generate a more chemically sensible random SELFIES string
 */
export function generateSmartRandomSelfies(maxLength: number = 15): string {
  const symbols: string[] = [];
  
  // Common starting atoms
  const startAtoms = ['[C]', '[N]', '[O]', '[S]', '[c]', '[n]'];
  symbols.push(startAtoms[Math.floor(Math.random() * startAtoms.length)]);
  
  // Atom symbols with weights (more common atoms have higher weight)
  const atomWeights = [
    { symbol: '[C]', weight: 10 },
    { symbol: '[=C]', weight: 3 },
    { symbol: '[#C]', weight: 1 },
    { symbol: '[N]', weight: 5 },
    { symbol: '[=N]', weight: 2 },
    { symbol: '[O]', weight: 5 },
    { symbol: '[=O]', weight: 3 },
    { symbol: '[S]', weight: 2 },
    { symbol: '[=S]', weight: 1 },
    { symbol: '[F]', weight: 2 },
    { symbol: '[Cl]', weight: 2 },
    { symbol: '[Br]', weight: 1 },
    { symbol: '[c]', weight: 4 }, // aromatic carbon
    { symbol: '[n]', weight: 2 }, // aromatic nitrogen
    { symbol: '[o]', weight: 1 }, // aromatic oxygen
  ];
  
  // Branch and ring symbols with weights
  const structureWeights = [
    { symbol: '[Branch1]', weight: 5 },
    { symbol: '[Branch2]', weight: 2 },
    { symbol: '[Ring1]', weight: 4 },
    { symbol: '[Ring2]', weight: 1 },
  ];
  
  // Calculate total weights
  const atomTotalWeight = atomWeights.reduce((sum, item) => sum + item.weight, 0);
  const structureTotalWeight = structureWeights.reduce((sum, item) => sum + item.weight, 0);
  
  // Generate rest of the molecule
  let currentLength = 1;
  let openBranches = 0;
  
  while (currentLength < maxLength) {
    const r = Math.random();
    
    // 70% chance to add an atom, 20% for structure, 10% to close branch
    if (r < 0.7 || openBranches === 0) {
      // Add atom
      const weightRandom = Math.random() * atomTotalWeight;
      let cumWeight = 0;
      
      for (const item of atomWeights) {
        cumWeight += item.weight;
        if (weightRandom < cumWeight) {
          symbols.push(item.symbol);
          break;
        }
      }
      currentLength++;
      
    } else if (r < 0.9 && currentLength < maxLength - 3) {
      // Add structure (branch or ring)
      const weightRandom = Math.random() * structureTotalWeight;
      let cumWeight = 0;
      
      for (const item of structureWeights) {
        cumWeight += item.weight;
        if (weightRandom < cumWeight) {
          symbols.push(item.symbol);
          
          // Add index for branch/ring length
          if (item.symbol.includes('Branch')) {
            openBranches++;
            // Add a small branch length (1-3 atoms)
            const branchLength = Math.floor(Math.random() * 3) + 1;
            if (branchLength === 1) {
              symbols.push('[C]'); // Most common index symbol
            } else if (branchLength === 2) {
              symbols.push('[Ring1]');
            } else {
              symbols.push('[Ring2]');
            }
            currentLength += 2;
          } else if (item.symbol.includes('Ring')) {
            // Add ring index (typically small)
            symbols.push('[C]'); // Encodes to 0, meaning immediate ring closure
            currentLength += 2;
          }
          break;
        }
      }
      
    } else if (openBranches > 0) {
      // Close a branch with epsilon
      symbols.push('[epsilon]');
      openBranches--;
      currentLength++;
    }
    
    // Safety: don't make molecule too long
    if (currentLength >= maxLength) {
      break;
    }
  }
  
  // Close any remaining branches
  while (openBranches > 0) {
    symbols.push('[epsilon]');
    openBranches--;
  }
  
  return symbols.join('');
}

/**
 * Generate random SELFIES by sampling from alphabet (Python example style)
 */
export function generateRandomSampleSelfies(sampleSize: number = 9): string {
  const alphabet = Array.from(getSemanticRobustAlphabet());
  
  // Filter out special symbols that need context
  const validSymbols = alphabet.filter(s => 
    !INDEX_ALPHABET.includes(s) && 
    s !== '[epsilon]' &&
    !s.includes('Branch') &&
    !s.includes('Ring')
  );
  
  // Random sampling without replacement
  const sampled: string[] = [];
  const usedIndices = new Set<number>();
  
  const actualSampleSize = Math.min(sampleSize, validSymbols.length);
  
  while (sampled.length < actualSampleSize) {
    const idx = Math.floor(Math.random() * validSymbols.length);
    if (!usedIndices.has(idx)) {
      usedIndices.add(idx);
      sampled.push(validSymbols[idx]);
    }
  }
  
  return sampled.join('');
}

/**
 * Validate if a SELFIES string is well-formed
 */
export function isValidSelfies(selfies: string): boolean {
  try {
    // Check for balanced brackets
    let bracketCount = 0;
    for (const char of selfies) {
      if (char === '[') bracketCount++;
      else if (char === ']') bracketCount--;
      if (bracketCount < 0) return false;
    }
    if (bracketCount !== 0) return false;
    
    // Check that all symbols are valid
    const symbols = selfies.split(/(?=\[)|(?<=\])/).filter(s => s && s !== '.' && s.trim());
    for (const symbol of symbols) {
      if (!symbol.startsWith('[') || !symbol.endsWith(']')) {
        if (symbol !== '.') return false;
      }
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Get statistics about a SELFIES string
 */
export interface SelfiesStats {
  totalSymbols: number;
  atomCount: number;
  branchCount: number;
  ringCount: number;
  uniqueElements: Set<string>;
}

export function getSelfiesStats(selfies: string): SelfiesStats {
  const symbols = selfies.split(/(?=\[)/).filter(s => s && s !== '.');
  
  let atomCount = 0;
  let branchCount = 0;
  let ringCount = 0;
  const uniqueElements = new Set<string>();
  
  for (const symbol of symbols) {
    if (symbol.includes('Branch')) {
      branchCount++;
    } else if (symbol.includes('Ring')) {
      ringCount++;
    } else if (symbol.startsWith('[') && symbol.endsWith(']')) {
      // Extract element from atom symbol
      const match = symbol.match(/\[(?:[=#\/\\])?(?:\d+)?([A-Z][a-z]?)(?:[@]{0,2})?(?:H\d)?(?:[+-]\d+)?\]/);
      if (match) {
        atomCount++;
        uniqueElements.add(match[1]);
      }
    }
  }
  
  return {
    totalSymbols: symbols.length,
    atomCount,
    branchCount,
    ringCount,
    uniqueElements
  };
}