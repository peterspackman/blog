/// <reference lib="webworker" />
/**
 * Fills pages of molecules off the main thread. Exact blocks are scanned here
 * (thousands of strings per page); built positions are drawn one at a time,
 * spread over several workers. Work yields every few milliseconds so a newer
 * request (a jump, a setting change) can cancel it.
 */
import type { RDKitModule } from '@rdkit/rdkit';
import { RDKIT_URL, moleculeSvg } from '../shared/chem/rdkit';
import type { VizTheme } from '../shared/viz';
import { builtAt, exactAt, find, library } from './engine';
import { MIN_LENGTH, type Address, type WorkerRequest, type WorkerResponse } from './protocol';

declare const self: DedicatedWorkerGlobalScope & {
  initRDKitModule(options?: { locateFile?: (file: string) => string }): Promise<RDKitModule>;
};

const post = (msg: WorkerResponse) => self.postMessage(msg);

let rdkit: RDKitModule | null = null;
let minGen = 0;

const ready = (async () => {
  try {
    self.importScripts(RDKIT_URL);
    const base = RDKIT_URL.slice(0, RDKIT_URL.lastIndexOf('/') + 1);
    rdkit = await self.initRDKitModule({ locateFile: (file) => base + file });
    post({ type: 'ready' });
  } catch (e) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
})();

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function draw(smiles: string, theme: VizTheme, size: { width: number; height: number }) {
  return moleculeSvg(rdkit!, smiles, theme, { ...size, maxFontSize: 26 });
}

/** Scan an exact block range for canonical strings, never past `maxL`. */
async function scan(msg: Extract<WorkerRequest, { type: 'scan' }>) {
  const { id, gen, forward, count, settings, maxL, theme, size } = msg;
  const lib = library(settings.charged);
  let { L, pos } = msg.from;
  if (!forward) pos -= 1n;
  let found = 0;
  let lastYield = performance.now();
  const done = (end: boolean) => {
    // Cursor: forward, the next position to look at; backward, the exclusive bound.
    const cursor: Address = { L, pos: forward ? pos : pos + 1n };
    post({ type: 'done', id, cursor, end });
  };
  while (found < count) {
    if (forward && pos >= lib.blockSize(L)) {
      L += 1;
      pos = 0n;
    } else if (!forward && pos < 0n) {
      L -= 1;
      if (L < MIN_LENGTH) return done(true);
      pos = lib.blockSize(L) - 1n;
    }
    if (L > maxL) return done(false);
    const mol = exactAt(rdkit!, lib, L, pos);
    if (mol) {
      const svg = draw(mol.smiles, theme, size);
      if (svg) {
        post({ type: 'item', id, item: { L, pos, ...mol, svg } });
        found += 1;
      }
    }
    pos += forward ? 1n : -1n;
    if (performance.now() - lastYield > 12) {
      await tick();
      lastYield = performance.now();
      if (gen < minGen) return;
    }
  }
  done(false);
}

/** Built positions waiting to be drawn, oldest first. */
const queue: Extract<WorkerRequest, { type: 'render' }>[] = [];
let pumping = false;

async function pump() {
  if (pumping) return;
  pumping = true;
  while (queue.length) {
    const msg = queue.shift()!;
    if (msg.gen < minGen) continue;
    const mol = builtAt(library(msg.charged), msg.addr.L, msg.addr.pos);
    const svg = draw(mol.smiles, msg.theme, msg.size);
    post({ type: 'rendered', id: msg.id, item: svg ? { ...msg.addr, ...mol, svg } : null });
    await tick();
  }
  pumping = false;
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type === 'cancel') {
    minGen = Math.max(minGen, msg.gen);
    return;
  }
  await ready;
  if (!rdkit) return;
  if (msg.type === 'scan') {
    if (msg.gen >= minGen) void scan(msg);
  } else if (msg.type === 'render') {
    queue.push(msg);
    void pump();
  } else if (msg.type === 'find') {
    const result = find(rdkit, library(msg.charged), msg.smiles);
    const svg = result.found ? draw(result.smiles, msg.theme, msg.size) : null;
    post({ type: 'found', id: msg.id, result, svg });
  }
};
