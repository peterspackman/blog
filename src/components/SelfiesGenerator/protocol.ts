import type { VizTheme } from '../shared/viz';
import type { FindResult } from './engine';

/** Shortest strings listed: single atoms (hydrides) aren't worth a block. */
export const MIN_LENGTH = 2;

/** Longest string the built blocks go up to; past this a page takes seconds. */
export const MAX_LENGTH = 400;

/** Longest exact block allowed, with and without charged atoms (pages get slow past these). */
export const MAX_CAP = { neutral: 6, charged: 8 };

/** A position in the block of strings with L symbols. */
export interface Address {
  L: number;
  pos: bigint;
}

export interface Settings {
  /** Include charged atom symbols. */
  charged: boolean;
  /** Blocks up to this length show each molecule exactly once. */
  cap: number;
  /** Keep going past the cap with built molecules. */
  infinite: boolean;
}

export interface Item extends Address {
  selfies: string;
  smiles: string;
  svg: string;
}

/** A built position still being drawn (or one RDKit couldn't draw). */
export interface Slot extends Address {
  pending: true;
  failed?: boolean;
}

type Size = { width: number; height: number };

export type WorkerRequest =
  | {
      type: 'scan';
      id: number;
      /** Requests from before the latest cancel are dropped. */
      gen: number;
      forward: boolean;
      /** Forward scans include this address; backward scans start just before it. */
      from: Address;
      count: number;
      settings: Settings;
      /** Stop on reaching a longer block than this. */
      maxL: number;
      theme: VizTheme;
      size: Size;
    }
  | { type: 'render'; id: number; gen: number; addr: Address; charged: boolean; theme: VizTheme; size: Size }
  | { type: 'cancel'; gen: number }
  | { type: 'find'; id: number; smiles: string; charged: boolean; theme: VizTheme; size: Size };

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'item'; id: number; item: Item }
  | { type: 'done'; id: number; cursor: Address; end: boolean }
  | { type: 'rendered'; id: number; item: Item | null }
  | { type: 'found'; id: number; result: FindResult; svg: string | null };
