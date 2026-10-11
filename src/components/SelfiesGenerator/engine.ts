/**
 * Addressing every molecule SELFIES can describe.
 *
 * An address is a string length L plus a position in that length's block. Each
 * block holds every string whose first symbol is a plain atom, so it has
 * F·N^(L-1) positions (N symbols in the alphabet, F of them plain atoms).
 * Positions are scrambled by a keyed Feistel permutation, so neighbours look
 * unrelated, and the permutation can be run backwards to find a molecule.
 *
 * Exact blocks show a string only if it is its molecule's canonical SELFIES,
 * so every molecule appears exactly once. That gets exponentially sparser
 * with length, so past the cap blocks are built instead: a generator seeded
 * by the position grows a molecule one atom, ring or branch at a time,
 * keeping only steps that change it, so all L symbols count.
 */
import { decoder, encoder, getSemanticRobustAlphabet, splitSelfies } from '@peterspackman/selfies';
import type { RDKitModule } from '@rdkit/rdkit';

const ALL_SYMBOLS: string[] = Array.from(getSemanticRobustAlphabet());

/** One alphabet's address space. */
export class Library {
  readonly alphabet: string[];
  /** Symbols allowed first: atoms with no bond prefix, as the encoder writes them. */
  readonly first: string[];
  private readonly N: bigint;
  private readonly F: bigint;
  private readonly symbolIndex: Map<string, bigint>;
  private readonly firstIndex: Map<string, bigint>;
  private readonly key: number;
  readonly charged: boolean;

  constructor(charged: boolean) {
    this.charged = charged;
    this.alphabet = charged ? ALL_SYMBOLS : ALL_SYMBOLS.filter((s) => !/[+-]\d\]$/.test(s));
    this.first = this.alphabet.filter((s) => /^\[[A-Z][a-z]?([+-]\d)?\]$/.test(s));
    this.N = BigInt(this.alphabet.length);
    this.F = BigInt(this.first.length);
    this.symbolIndex = new Map(this.alphabet.map((s, i) => [s, BigInt(i)]));
    this.firstIndex = new Map(this.first.map((s, i) => [s, BigInt(i)]));
    this.key = charged ? 0x51ed : 0x0a7e;
  }

  /** Number of positions in the block of strings with L symbols. */
  blockSize(L: number): bigint {
    return this.F * this.N ** BigInt(L - 1);
  }

  /** The string at (unscrambled) index i of block L. */
  stringAt(L: number, i: bigint): string {
    let out = this.first[Number(i % this.F)];
    i /= this.F;
    for (let k = 1; k < L; k++) {
      out += this.alphabet[Number(i % this.N)];
      i /= this.N;
    }
    return out;
  }

  /** Inverse of stringAt, or null if the string isn't in any block. */
  indexOfString(symbols: string[]): bigint | null {
    const first = this.firstIndex.get(symbols[0]);
    if (first === undefined) return null;
    let i = 0n;
    for (let k = symbols.length - 1; k >= 1; k--) {
      const d = this.symbolIndex.get(symbols[k]);
      if (d === undefined) return null;
      i = i * this.N + d;
    }
    return i * this.F + first;
  }

  has(symbol: string): boolean {
    return this.symbolIndex.has(symbol);
  }

  /** Index of the string shown at a position. */
  scramble(L: number, pos: bigint): bigint {
    return feistel(pos, this.blockSize(L), this.key + L * 31, false);
  }

  /** Position at which a string index is shown. */
  unscramble(L: number, i: bigint): bigint {
    return feistel(i, this.blockSize(L), this.key + L * 31, true);
  }
}

const libraries = new Map<boolean, Library>();
export function library(charged: boolean): Library {
  let lib = libraries.get(charged);
  if (!lib) libraries.set(charged, (lib = new Library(charged)));
  return lib;
}

// --- Scrambling -------------------------------------------------------------

/** murmur3's 32-bit finaliser. */
function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Keyed hash of x into `bits` bits (the Feistel round function). */
function roundHash(x: bigint, key: number, bits: number): bigint {
  let h = fmix32(key);
  for (let rest = x; ; rest >>= 32n) {
    h = fmix32(h ^ Number(rest & 0xffffffffn));
    if (rest < 0x100000000n) break;
  }
  let out = 0n;
  for (let have = 0; have < bits; have += 32) {
    h = fmix32(h + 0x9e3779b9);
    out = (out << 32n) | BigInt(h);
  }
  return out & ((1n << BigInt(bits)) - 1n);
}

const ROUNDS = 4;

/** Bijection on [0, size): balanced Feistel on the next even bit width, cycle-walked. */
function feistel(x: bigint, size: bigint, key: number, inverse: boolean): bigint {
  const half = Math.max(1, Math.ceil((size - 1n).toString(2).length / 2));
  const h = BigInt(half);
  const mask = (1n << h) - 1n;
  do {
    let left = x >> h;
    let right = x & mask;
    for (let r = 0; r < ROUNDS; r++) {
      const k = key * 7 + (inverse ? ROUNDS - 1 - r : r);
      if (inverse) [left, right] = [right ^ roundHash(left, k, half), left];
      else [left, right] = [right, left ^ roundHash(right, k, half)];
    }
    x = (left << h) | right;
  } while (x >= size);
  return x;
}

// --- Exact blocks ---------------------------------------------------------------

/** Canonical SMILES (no stereo), or null if RDKit rejects it. */
export function canonicalSmiles(rdkit: RDKitModule, smiles: string): string | null {
  const flat = smiles.replace(/@+/g, '').replace(/[/\\]/g, '');
  const mol = flat ? rdkit.get_mol(flat) : null;
  if (!mol) return null;
  try {
    return mol.is_valid() ? mol.get_smiles() : null;
  } finally {
    mol.delete();
  }
}

/** The one SELFIES string that stands for this molecule. */
export function canonicalSelfies(rdkit: RDKitModule, smiles: string): string | null {
  const canon = canonicalSmiles(rdkit, smiles);
  if (!canon) return null;
  try {
    return encoder(canon);
  } catch {
    return null;
  }
}

export interface Molecule {
  selfies: string;
  smiles: string;
}

/** The molecule at an exact position, or null if that string isn't canonical. */
export function exactAt(rdkit: RDKitModule, lib: Library, L: number, pos: bigint): Molecule | null {
  const selfies = lib.stringAt(L, lib.scramble(L, pos));
  const smiles = decoder(selfies) as string;
  if (!smiles || canonicalSelfies(rdkit, smiles) !== selfies) return null;
  return { selfies, smiles };
}

export type FindResult =
  | { found: true; L: number; pos: bigint; selfies: string; smiles: string }
  | { found: false; reason: string };

/** Where a molecule lives in the exact blocks. */
export function find(rdkit: RDKitModule, lib: Library, smiles: string): FindResult {
  const canon = canonicalSmiles(rdkit, smiles.trim());
  if (!canon) return { found: false, reason: "RDKit couldn't read that SMILES." };
  if (canon.includes('.')) return { found: false, reason: 'Only single connected molecules have addresses.' };
  let selfies: string;
  try {
    selfies = encoder(canon);
  } catch {
    return { found: false, reason: "SELFIES can't encode that molecule." };
  }
  const symbols = Array.from(splitSelfies(selfies));
  const i = lib.indexOfString(symbols);
  if (i === null) {
    const odd = symbols.find((s) => !lib.has(s)) ?? symbols[0];
    return { found: false, reason: `It needs ${odd}, which isn't in the alphabet.` };
  }
  // Atoms SELFIES can't represent without changes (e.g. H counts) would land elsewhere.
  if (canonicalSelfies(rdkit, decoder(selfies) as string) !== selfies) {
    return { found: false, reason: "SELFIES can't represent that molecule exactly." };
  }
  return { found: true, L: symbols.length, pos: lib.unscramble(symbols.length, i), selfies, smiles: canon };
}

// --- Built blocks ---------------------------------------------------------------

/** Small seeded generator (sfc32), seeded from a block and position. */
function rng(L: number, pos: bigint): () => number {
  let a = fmix32(L * 0x2545f491);
  let b = 0x9e3779b9;
  let c = 0x243f6a88;
  let d = 1;
  for (let rest = pos; ; rest >>= 32n) {
    a = fmix32(a ^ Number(rest & 0xffffffffn));
    b = fmix32(b + a);
    if (rest < 0x100000000n) break;
  }
  const next = () => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let k = 0; k < 12; k++) next();
  return next;
}

/** Order items by weighted sampling without replacement. */
function weightedOrder<T>(items: [T, number][], rand: () => number): T[] {
  return items
    .map(([item, w]) => [item, -Math.log(rand()) / w] as const)
    .sort((x, y) => x[1] - y[1])
    .map(([item]) => item);
}

const INDEX_ALPHABET = [
  '[C]', '[Ring1]', '[Ring2]', '[Branch1]', '[=Branch1]', '[#Branch1]', '[Branch2]', '[=Branch2]',
  '[#Branch2]', '[O]', '[N]', '[=N]', '[=C]', '[#C]', '[S]', '[P]',
];

/** How often each atom symbol is tried: mostly organic, the rest occasionally. */
function atomWeight(symbol: string): number {
  const m = /^\[([=#]?)([A-Z][a-z]?)([+-]\d)?\]$/.exec(symbol);
  if (!m) return 0;
  const [, bond, el, charge] = m;
  const base: Record<string, number> = { C: 12, N: 4, O: 4, S: 1.5, F: 1, Cl: 1, Br: 0.5, I: 0.3, P: 0.5, B: 0.2, H: 0 };
  const order = bond === '' ? 1 : bond === '=' ? 0.35 : 0.1;
  return (base[el] ?? 0.1) * order * (charge ? 0.05 : 1);
}

const atomTables = new Map<Library, [string, number][]>();
function atomsOf(lib: Library): [string, number][] {
  let table = atomTables.get(lib);
  if (!table) {
    table = lib.alphabet.map((s) => [s, atomWeight(s)] as [string, number]).filter(([, w]) => w > 0);
    atomTables.set(lib, table);
  }
  return table;
}

/** Ring closures: ring symbol plus index q closes a ring of q + 2 atoms. */
const RING_SIZE_WEIGHT: Record<number, number> = { 3: 0.2, 4: 0.2, 5: 2, 6: 3, 7: 0.4, 8: 0.2 };
const RINGS: [string, number][] = [];
for (const [ring, w] of [['[Ring1]', 1], ['[=Ring1]', 0.4]] as const) {
  for (const [size, sw] of Object.entries(RING_SIZE_WEIGHT)) RINGS.push([ring + INDEX_ALPHABET[Number(size) - 2], w * sw]);
}

const BRANCHES: [string, number][] = [
  ['[Branch1]', 1],
  ['[=Branch1]', 0.35],
  ['[#Branch1]', 0.08],
];

/** Does appending this symbol sequence change the decoded molecule? */
function effective(prefix: string, add: string, prev: string): string | null {
  const smiles = decoder(prefix + add) as string;
  return smiles && smiles !== prev ? smiles : null;
}

/** Can the chain still grow after `s`? */
function alive(s: string, smiles: string): boolean {
  return decoder(s + '[C]') !== smiles;
}

/**
 * Grow `budget` symbols onto `s`. Returns the new string and SMILES, or null
 * if no step that changes the molecule could be found.
 */
function grow(
  atoms: [string, number][],
  s: string,
  smiles: string,
  budget: number,
  rand: () => number,
  depth: number,
): [string, string] | null {
  while (budget > 0) {
    const last = budget === 1;
    const kinds = weightedOrder<'atom' | 'ring' | 'branch'>(
      [
        ['atom', 6],
        ['ring', budget >= 2 ? 1.2 : 0],
        ['branch', budget >= 3 && depth < 3 ? 1.5 : 0],
      ],
      rand,
    );
    let step: [string, string, number] | null = null;
    for (const kind of kinds) {
      if (kind === 'atom') {
        for (const a of weightedOrder(atoms, rand)) {
          const next = effective(s, a, smiles);
          if (next && (last || alive(s + a, next))) {
            step = [s + a, next, 1];
            break;
          }
        }
      } else if (kind === 'ring' && budget >= 2) {
        for (const r of weightedOrder(RINGS, rand).slice(0, 6)) {
          const next = effective(s, r, smiles);
          if (next && (budget === 2 || alive(s + r, next))) {
            step = [s + r, next, 2];
            break;
          }
        }
      } else if (kind === 'branch' && budget >= 3 && depth < 3) {
        const maxLen = Math.min(16, budget - 2 - (budget > 3 ? 1 : 0));
        const lengths: [number, number][] = [];
        for (let n = 1; n <= maxLen; n++) lengths.push([n, 1 / n]);
        const [n] = weightedOrder(lengths, rand);
        for (const b of weightedOrder(BRANCHES, rand)) {
          const head = s + b + INDEX_ALPHABET[n - 1];
          const inner = grow(atoms, head, smiles, n, rand, depth + 1);
          if (inner && inner[1] !== smiles && (budget === n + 2 || alive(inner[0], inner[1]))) {
            step = [inner[0], inner[1], n + 2];
            break;
          }
        }
      }
      if (step) break;
    }
    if (!step) return null;
    [s, smiles] = step;
    budget -= step[2];
  }
  return [s, smiles];
}

/** The molecule at a built position: always L symbols, all of them used. */
export function builtAt(lib: Library, L: number, pos: bigint): Molecule {
  const rand = rng(L + (lib.charged ? 7919 : 0), pos);
  const atoms = atomsOf(lib);
  const first = weightedOrder(
    atoms.filter(([a]) => lib.first.includes(a)),
    rand,
  );
  // Fall back to fewer symbols on the rare dead end, so there is always a molecule.
  for (let budget = L; budget >= 1; budget--) {
    for (const a of first.slice(0, 4)) {
      const smiles = decoder(a) as string;
      const grown = grow(atoms, a, smiles, budget - 1, rand, 0);
      if (grown) return { selfies: grown[0], smiles: grown[1] };
    }
  }
  return { selfies: first[0], smiles: decoder(first[0]) as string };
}
