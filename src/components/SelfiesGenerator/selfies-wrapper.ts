/**
 * Enumerating SELFIES strings with @peterspackman/selfies.
 *
 * Every string over the semantically robust alphabet decodes to a valid
 * molecule, so index i in [0, N^M) names one molecule: write i in base N
 * and read each digit as a symbol.
 */
import { decoder as selfiesDecoder, getSemanticRobustAlphabet } from '@peterspackman/selfies';

let alphabetCache: string[] | null = null;

/** The semantically robust alphabet, in a fixed order. */
export function selfiesAlphabet(): string[] {
  alphabetCache ??= Array.from(getSemanticRobustAlphabet());
  return alphabetCache;
}

/** SELFIES → SMILES. Without attribution the decoder returns a plain string. */
export function decoder(selfies: string): string {
  return selfiesDecoder(selfies) as string;
}

/** Number of distinct strings with this many symbols. */
export function selfiesCount(symbols: number): number {
  return selfiesAlphabet().length ** symbols;
}

/** The index-th string of `symbols` symbols (least significant symbol first). */
export function selfiesAtIndex(index: number, symbols: number): string {
  const alphabet = selfiesAlphabet();
  const n = alphabet.length;
  let rest = Math.max(0, Math.min(Math.floor(index), selfiesCount(symbols) - 1));
  let out = '';
  for (let k = 0; k < symbols; k++) {
    out += alphabet[rest % n];
    rest = Math.floor(rest / n);
  }
  return out;
}
