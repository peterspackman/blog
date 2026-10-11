import { useCallback, useEffect, useRef, useState } from 'react';
import type { VizTheme } from '../shared/viz';
import { library, type FindResult } from './engine';
import { MAX_LENGTH, MIN_LENGTH, type Address, type Item, type Settings, type Slot, type WorkerRequest, type WorkerResponse } from './protocol';

/** Depiction size drawn by the workers. */
export const DEPICTION = { width: 220, height: 160 };

/** Items kept either side of the view before the far end is dropped. */
const KEEP = 240;

export type Entry = Item | Slot;
export const isSlot = (e: Entry): e is Slot => 'pending' in e;

/** Longest block the settings allow. */
export const lastLength = (settings: Settings) => (settings.infinite ? MAX_LENGTH : settings.cap);

/**
 * A window of consecutive molecules around the current position.
 *
 * Exact blocks are scanned by the first worker, which streams items as it
 * finds them. Built blocks have one molecule per position, so their slots are
 * laid out straight away and drawn by the whole pool in parallel. Each end
 * keeps a cursor (where to look next) so ranges are never scanned twice.
 */
export function useMoleculeStream(settings: Settings, theme: VizTheme, visible: number, cols: number) {
  const pool = useRef<Worker[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [, setVersion] = useState(0);

  const s = useRef({
    items: [] as Entry[],
    top: 0,
    anchor: { L: MIN_LENGTH, pos: 0n } as Address,
    /** Next position to look at going forward. */
    cursorForward: { L: MIN_LENGTH, pos: 0n } as Address,
    /** Positions before this one haven't been looked at going backward. */
    cursorBackward: { L: MIN_LENGTH, pos: 0n } as Address,
    endForward: false,
    endBackward: false,
    scanForward: 0,
    scanBackward: 0,
    /** Slots waiting on a worker, by request id. */
    slots: new Map<number, Slot>(),
    nextWorker: 0,
    gen: 0,
    nextId: 1,
    finds: new Map<number, (r: { result: FindResult; svg: string | null }) => void>(),
  }).current;
  const frame = useRef(0);
  const bump = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      setVersion((v) => v + 1);
    });
  }, []);

  const live = useRef({ settings, theme, visible, cols });
  live.current = { settings, theme, visible, cols };

  const blockSize = (L: number) => library(live.current.settings.symbols).blockSize(L);
  const after = (a: Address): Address => (a.pos + 1n < blockSize(a.L) ? { L: a.L, pos: a.pos + 1n } : { L: a.L + 1, pos: 0n });
  const before = (a: Address): Address => (a.pos > 0n ? { L: a.L, pos: a.pos - 1n } : { L: a.L - 1, pos: a.L > 1 ? blockSize(a.L - 1) - 1n : 0n });

  const render = (slot: Slot) => {
    const workers = pool.current;
    const id = s.nextId++;
    s.slots.set(id, slot);
    const { settings, theme } = live.current;
    const worker = workers[s.nextWorker++ % workers.length];
    worker.postMessage({ type: 'render', id, gen: s.gen, addr: { L: slot.L, pos: slot.pos }, symbols: settings.symbols, theme, size: DEPICTION } satisfies WorkerRequest);
  };

  /** Lay out built slots from the cursor; returns how many were added. */
  const addSlots = (forward: boolean, count: number) => {
    const { settings } = live.current;
    let added = 0;
    while (added < count) {
      const at = forward ? s.cursorForward : before(s.cursorBackward);
      if (at.L <= settings.cap || at.L > lastLength(settings)) break;
      const slot: Slot = { ...at, pending: true };
      if (forward) {
        s.items.push(slot);
        s.cursorForward = after(at);
      } else {
        s.items.unshift(slot);
        s.top += 1;
        s.cursorBackward = at;
      }
      render(slot);
      added += 1;
    }
    if (added) bump();
    return added;
  };

  const scan = (forward: boolean, count: number) => {
    const id = s.nextId++;
    if (forward) s.scanForward = id;
    else s.scanBackward = id;
    const { settings, theme } = live.current;
    pool.current[0].postMessage({
      type: 'scan',
      id,
      gen: s.gen,
      forward,
      from: forward ? s.cursorForward : s.cursorBackward,
      count,
      settings,
      maxL: settings.cap,
      theme,
      size: DEPICTION,
    } satisfies WorkerRequest);
  };

  /** Top up whichever end the view is close to: visible rows first, then behind. */
  const ensure = () => {
    if (!ready) return;
    const { settings, visible, cols } = live.current;
    const batch = Math.max(12, cols * 4);
    const ahead = s.items.length - s.top;
    if (!s.scanForward && !s.endForward && ahead < visible + cols * 3) {
      const at = s.cursorForward;
      if (at.L > lastLength(settings)) s.endForward = true;
      else if (at.L > settings.cap) addSlots(true, batch);
      else scan(true, batch);
    }
    if (ahead < visible && !s.endForward) return;
    if (!s.scanBackward && !s.endBackward && s.top < cols * 2) {
      const at = before(s.cursorBackward);
      if (at.L < MIN_LENGTH) s.endBackward = true;
      else if (at.L > settings.cap) addSlots(false, batch);
      else scan(false, batch);
    }
  };

  /** Drop entries far from the view (only at ends with no scan running). */
  const trim = () => {
    if (!s.scanBackward && s.top > KEEP * 2) {
      const drop = s.top - KEEP;
      s.items.splice(0, drop);
      s.top -= drop;
      s.cursorBackward = s.items[0];
      s.endBackward = false;
    }
    if (!s.scanForward && s.items.length - s.top > KEEP * 2) {
      s.items.length = s.top + KEEP;
      s.cursorForward = after(s.items[s.items.length - 1]);
      s.endForward = false;
    }
  };

  useEffect(() => {
    const size = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
    const workers = Array.from({ length: size }, () => new Worker(new URL('./molecules.worker.ts', import.meta.url)));
    pool.current = workers;
    const onMessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === 'ready') {
        if (e.target === workers[0]) setReady(true);
      } else if (msg.type === 'error') setError(msg.message);
      else if (msg.type === 'found') {
        s.finds.get(msg.id)?.({ result: msg.result, svg: msg.svg });
        s.finds.delete(msg.id);
      } else if (msg.type === 'rendered') {
        const slot = s.slots.get(msg.id);
        if (!slot) return;
        s.slots.delete(msg.id);
        const i = s.items.indexOf(slot);
        if (i < 0) return;
        s.items[i] = msg.item ?? { ...slot, failed: true };
        bump();
      } else if (msg.type === 'item') {
        if (s.scanForward === msg.id) {
          s.items.push(msg.item);
          s.cursorForward = after(msg.item);
        } else if (s.scanBackward === msg.id) {
          s.items.unshift(msg.item);
          s.top += 1;
          s.cursorBackward = msg.item;
        } else return;
        bump();
      } else if (msg.type === 'done') {
        if (s.scanForward === msg.id) {
          s.scanForward = 0;
          s.cursorForward = msg.cursor;
          s.endForward = msg.end;
        } else if (s.scanBackward === msg.id) {
          s.scanBackward = 0;
          s.cursorBackward = msg.cursor;
          s.endBackward = msg.end;
        } else return;
        bump();
      }
    };
    for (const w of workers) {
      w.onmessage = onMessage;
      w.onerror = (e) => setError(e.message || 'The molecule worker failed to start.');
    }
    return () => {
      for (const w of workers) w.terminate();
      pool.current = [];
      cancelAnimationFrame(frame.current);
    };
  }, [bump]);

  const jump = useCallback(
    (to: Address) => {
      s.gen += 1;
      for (const w of pool.current) w.postMessage({ type: 'cancel', gen: s.gen } satisfies WorkerRequest);
      s.items = [];
      s.top = 0;
      s.slots.clear();
      s.anchor = s.cursorForward = s.cursorBackward = to;
      s.endForward = s.endBackward = false;
      s.scanForward = s.scanBackward = 0;
      bump();
    },
    [bump],
  );

  /** Move the view by whole rows; stops at what has been laid out so far. */
  const scroll = useCallback(
    (rows: number) => {
      const { visible, cols } = live.current;
      const max = Math.max(0, s.endForward ? s.items.length - visible : s.items.length - cols);
      const top = Math.max(0, Math.min(max, s.top + rows * cols));
      if (top === s.top) return;
      s.top = top;
      bump();
    },
    [bump],
  );

  const findMolecule = useCallback(
    (smiles: string) =>
      new Promise<{ result: FindResult; svg: string | null }>((resolve) => {
        const id = s.nextId++;
        s.finds.set(id, resolve);
        const { settings, theme } = live.current;
        pool.current[0]?.postMessage({ type: 'find', id, smiles, symbols: settings.symbols, theme, size: DEPICTION } satisfies WorkerRequest);
      }),
    [],
  );

  // After every render: top up whichever end is short, then trim.
  useEffect(() => {
    ensure();
    trim();
  });

  const items = s.items.slice(s.top, s.top + visible);
  return {
    ready,
    error,
    items,
    /** Address of the first molecule in view (or where the view is headed). */
    current: (items[0] as Address | undefined) ?? s.anchor,
    loading: !!s.scanForward && items.length < visible,
    atStart: s.top === 0 && s.endBackward,
    atEnd: s.endForward && s.top + visible >= s.items.length,
    jump,
    scroll,
    findMolecule,
  };
}
