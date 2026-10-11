import React, { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useContainerSize, useVizTheme, VizPanel, VizPlotHeader, VizWorkbench } from '../shared/viz';
import { ControlGroup, ControlHint, SliderWithInput, ToggleSwitch, VizButton } from '../shared/controls';
import { ELEMENTS, library, maxCap, symbolSetKey, type FindResult, type Library, type SymbolSet } from './engine';
import { MAX_LENGTH, MIN_LENGTH, type Address, type Item, type Settings } from './protocol';
import { isSlot, lastLength, useMoleculeStream, type Entry } from './useMoleculeStream';
import styles from './EveryMolecule.module.css';

const CARD_MIN_WIDTH = 220;
const CARD_HEIGHT = 250;
const GAP = 12;

/** Compact form for numbers too long to read: 4.31×10²³⁴. */
function Big({ value }: { value: bigint }) {
  const s = value.toString();
  if (s.length <= 15) return <>{value.toLocaleString()}</>;
  return (
    <span title={s}>
      {s[0]}.{s.slice(1, 3)}×10<sup>{s.length - 1}</sup>
    </span>
  );
}

/** Uniform random bigint in [0, n). */
function randomBelow(n: bigint): bigint {
  const bytes = new Uint8Array(Math.ceil(n.toString(16).length / 2) + 8);
  crypto.getRandomValues(bytes);
  let x = 0n;
  for (const b of bytes) x = (x << 8n) | BigInt(b);
  return x % n;
}

const PRESETS: { label: string; symbols: SymbolSet }[] = [
  { label: 'Organic', symbols: { elements: ['C', 'N', 'O', 'S', 'F', 'Cl', 'Br', 'I'], charged: false } },
  { label: 'CNO', symbols: { elements: ['C', 'N', 'O'], charged: false } },
  { label: 'Everything', symbols: { elements: [...ELEMENTS], charged: true } },
];
const DEFAULT_SYMBOLS = PRESETS[0].symbols;

/** Inverse of symbolSetKey, e.g. "CNOCl±". */
function parseSymbolSet(key: string): SymbolSet | null {
  const elements = (key.match(/[A-Z][a-z]?/g) ?? []).filter((e) => (ELEMENTS as readonly string[]).includes(e));
  return elements.length ? { elements, charged: key.includes('±') } : null;
}

const plural = (L: number) => `${L} symbol${L === 1 ? '' : 's'}`;

function parseBig(text: string): bigint | null {
  const t = text.replace(/[,\s_]/g, '');
  return /^\d+$/.test(t) ? BigInt(t) : null;
}

function linkTo(addr: Address, settings: Settings): string {
  const q = new URLSearchParams({ L: String(addr.L), pos: addr.pos.toString() });
  const set = symbolSetKey(settings.symbols);
  if (set !== symbolSetKey(DEFAULT_SYMBOLS)) q.set('set', set);
  return `${window.location.origin}${window.location.pathname}?${q}`;
}

/** Settings and starting address from the URL, if any. */
function fromUrl(): { settings: Partial<Settings>; addr: Address | null } {
  const q = new URLSearchParams(window.location.search);
  const L = Number(q.get('L'));
  const pos = parseBig(q.get('pos') ?? '');
  return {
    settings: (() => {
      const symbols = parseSymbolSet(q.get('set') ?? '');
      return symbols ? { symbols } : {};
    })(),
    addr: Number.isInteger(L) && L >= MIN_LENGTH && pos !== null ? { L, pos } : null,
  };
}

/** Clamp an address into the blocks the settings allow. */
function clampAddress(addr: Address, settings: Settings): Address {
  const L = Math.max(MIN_LENGTH, Math.min(lastLength(settings), Math.floor(addr.L)));
  const size = library(settings.symbols).blockSize(L);
  return { L, pos: addr.pos < 0n ? 0n : addr.pos >= size ? size - 1n : addr.pos };
}

const same = (a: Address | null, b: Address) => !!a && a.L === b.L && a.pos === b.pos;

function MoleculeCard({ item, highlight, settings }: { item: Item; highlight: boolean; settings: Settings }) {
  const [copied, setCopied] = useState('');
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(''), 1200);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text).then(() => setCopied(key), () => {});
  };
  return (
    <article className={clsx(styles.card, highlight && styles.cardHighlight)}>
      <div className={styles.depiction} dangerouslySetInnerHTML={{ __html: item.svg }} />
      <div className={styles.info}>
        <button
          type="button"
          className={styles.address}
          onClick={() => copy('link', linkTo(item, settings))}
          title="Copy a link to this molecule"
        >
          {copied === 'link' ? (
            'Link copied'
          ) : (
            <>
              {item.L} · #<Big value={item.pos} />
            </>
          )}
        </button>
        {(['selfies', 'smiles'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            className={styles.copy}
            onClick={() => copy(kind, item[kind])}
            title={`Copy ${kind.toUpperCase()}`}
          >
            <span className={styles.copyLabel}>{copied === kind ? 'Copied' : kind === 'selfies' ? 'SELFIES' : 'SMILES'}</span>
            <code>{item[kind]}</code>
          </button>
        ))}
      </div>
    </article>
  );
}

function PendingCard({ slot }: { slot: Entry & { failed?: boolean } }) {
  return (
    <article className={clsx(styles.card, styles.cardPending)} aria-busy={!slot.failed}>
      <div className={styles.depiction}>
        <span className={styles.pendingText}>{slot.failed ? "RDKit couldn't draw this one" : 'Growing…'}</span>
      </div>
      <div className={styles.info}>
        <span className={styles.address}>
          {slot.L} · #<Big value={slot.pos} />
        </span>
      </div>
    </article>
  );
}

/** Track for the current block: position within it, drag or click to jump. */
function BlockScrollbar({ addr, lib, onJump }: { addr: Address; lib: Library; onJump: (a: Address) => void }) {
  const size = lib.blockSize(addr.L);
  const fraction = size > 1n ? Number((addr.pos * 1_000_000n) / (size - 1n)) / 1_000_000 : 0;
  const track = useRef<HTMLDivElement>(null);
  const last = useRef(0);
  const jumpTo = (clientY: number, force: boolean) => {
    const now = performance.now();
    if (!force && now - last.current < 80) return;
    last.current = now;
    const r = track.current!.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
    onJump({ L: addr.L, pos: ((size - 1n) * BigInt(Math.round(f * 1e9))) / 1_000_000_000n });
  };
  return (
    <div
      ref={track}
      className={styles.track}
      role="scrollbar"
      aria-orientation="vertical"
      aria-label={`Position in the ${addr.L}-symbol block`}
      aria-valuenow={Math.round(fraction * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        jumpTo(e.clientY, true);
      }}
      onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && jumpTo(e.clientY, false)}
      onPointerUp={(e) => jumpTo(e.clientY, true)}
    >
      <div className={styles.thumb} style={{ top: `calc(${fraction} * (100% - 2rem))` }} />
    </div>
  );
}

export function EveryMolecule({ title }: { title: string }) {
  const theme = useVizTheme();
  const [settings, setSettings] = useState<Settings>({ symbols: DEFAULT_SYMBOLS, cap: 5, infinite: false });
  const lib = library(settings.symbols);
  const [gridRef, gridSize] = useContainerSize();
  const [rows, setRows] = useState(3);
  useEffect(() => {
    const fit = () => setRows(Math.max(2, Math.min(4, Math.floor((window.innerHeight * 0.8) / (CARD_HEIGHT + GAP)))));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  const cols = Math.max(1, Math.floor((gridSize.width + GAP) / (CARD_MIN_WIDTH + GAP)));
  const visible = cols * rows;

  const stream = useMoleculeStream(settings, theme, visible, cols);
  const { ready, jump, scroll, current } = stream;
  const [highlight, setHighlight] = useState<Address | null>(null);

  const go = useCallback(
    (addr: Address, s: Settings = settings, mark = false) => {
      const to = clampAddress(addr, s);
      setHighlight(mark ? to : null);
      jump(to);
    },
    [jump, settings],
  );

  // Start from the URL's address once the worker is ready.
  const started = useRef(false);
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    const { settings: fromQuery, addr } = fromUrl();
    const s = { ...settings, ...fromQuery };
    s.cap = Math.min(s.cap, maxCap(library(s.symbols)));
    if (addr && addr.L > s.cap) s.infinite = true;
    setSettings(s);
    go(addr ?? { L: MIN_LENGTH, pos: 0n }, s, !!addr);
  }, [ready]);

  // Redraw in place when the colour mode changes.
  const themeKey = theme.isDark;
  const firstTheme = useRef(themeKey);
  useEffect(() => {
    if (firstTheme.current === themeKey) return;
    firstTheme.current = themeKey;
    jump(current);
  }, [themeKey]);

  const update = (patch: Partial<Settings>) => {
    const s = { ...settings, ...patch };
    s.cap = Math.min(s.cap, maxCap(library(s.symbols)));
    setSettings(s);
    // A different alphabet is a different library: start its block from the top.
    go(patch.symbols ? { L: current.L, pos: 0n } : current, s);
  };

  // Wheel, touch and keys move whole rows; the page scrolls once past either end.
  const viewport = useRef<HTMLDivElement>(null);
  const edges = useRef({ atStart: false, atEnd: false });
  edges.current = { atStart: stream.atStart, atEnd: stream.atEnd };
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    let acc = 0;
    const step = CARD_HEIGHT * 0.5;
    const move = (dy: number, e: Event) => {
      if ((dy < 0 && edges.current.atStart) || (dy > 0 && edges.current.atEnd)) return;
      e.preventDefault();
      acc += dy;
      const rowsMoved = Math.trunc(acc / step);
      if (rowsMoved) {
        acc -= rowsMoved * step;
        scroll(rowsMoved);
      }
    };
    const onWheel = (e: WheelEvent) => move(e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * 600 : e.deltaY, e);
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0].clientY;
      move(touchY - y, e);
      touchY = y;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [scroll]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => scroll(1),
      ArrowUp: () => scroll(-1),
      PageDown: () => scroll(rows),
      PageUp: () => scroll(-rows),
      ' ': () => scroll(e.shiftKey ? -rows : rows),
      Home: () => go({ L: current.L, pos: 0n }),
      End: () => go({ L: current.L, pos: lib.blockSize(current.L) - 1n }),
    };
    const action = keys[e.key];
    if (action) {
      e.preventDefault();
      action();
    }
  };

  // Keep the address in the URL so a view can be shared.
  useEffect(() => {
    if (!started.current || !stream.items.length) return;
    const t = setTimeout(() => window.history.replaceState(null, '', linkTo(current, settings)), 300);
    return () => clearTimeout(t);
  }, [current.L, current.pos, settings.symbols]);

  // Go to: length and position.
  const [goL, setGoL] = useState('');
  const [goPos, setGoPos] = useState('');
  const submitGo = (e: React.FormEvent) => {
    e.preventDefault();
    const L = goL.trim() ? Number(goL) : current.L;
    const pos = goPos.trim() ? parseBig(goPos) : 0n;
    if (!Number.isInteger(L) || L < MIN_LENGTH || pos === null) return;
    const s = L > settings.cap && !settings.infinite ? { ...settings, infinite: true } : settings;
    if (s !== settings) setSettings(s);
    go({ L, pos }, s, true);
  };

  // Find a molecule by SMILES.
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ result: FindResult; svg: string | null } | null>(null);
  const submitFind = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setFound(await stream.findMolecule(query));
  };

  const blockSize = lib.blockSize(current.L);
  const exact = current.L <= settings.cap;
  const toggleElement = (e: string) => {
    const has = settings.symbols.elements.includes(e);
    if (has && settings.symbols.elements.length === 1) return;
    const elements = has ? settings.symbols.elements.filter((x) => x !== e) : [...settings.symbols.elements, e];
    update({ symbols: { ...settings.symbols, elements } });
  };
  const setKey = symbolSetKey(settings.symbols);

  const sidebar = (
    <VizPanel stack>
      <ControlGroup label="Find a molecule" hint="Paste a SMILES string to see where it lives.">
        <form className={styles.form} onSubmit={submitFind}>
          <input
            className={styles.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. c1ccccc1O"
            aria-label="SMILES"
            spellCheck={false}
          />
          <VizButton size="sm" type="submit" disabled={!ready || !query.trim()}>
            Find
          </VizButton>
        </form>
        {found && 'reason' in found.result && <p className={styles.note}>{found.result.reason}</p>}
        {found?.result.found && (
          <div className={styles.found}>
            {found.svg && <div className={styles.foundDepiction} dangerouslySetInnerHTML={{ __html: found.svg }} />}
            <p className={styles.note}>
              {plural(found.result.L)} · #<Big value={found.result.pos} />
            </p>
            {found.result.L <= settings.cap ? (
              <VizButton
                size="sm"
                onClick={() => found.result.found && go({ L: found.result.L, pos: found.result.pos }, settings, true)}
              >
                Show it
              </VizButton>
            ) : (
              <p className={styles.note}>
                That's past the exact listing ({settings.cap} symbols), where molecules are too sparse to page through.
              </p>
            )}
          </div>
        )}
      </ControlGroup>

      <ControlGroup label="Go to">
        <form className={styles.goForm} onSubmit={submitGo}>
          <label className={styles.field}>
            <span>Length</span>
            <input
              className={styles.input}
              inputMode="numeric"
              value={goL}
              onChange={(e) => setGoL(e.target.value)}
              placeholder={String(current.L)}
            />
          </label>
          <label className={styles.field}>
            <span>Position</span>
            <input
              className={styles.input}
              inputMode="numeric"
              value={goPos}
              onChange={(e) => setGoPos(e.target.value)}
              placeholder="0"
            />
          </label>
          <VizButton size="sm" type="submit" disabled={!ready}>
            Go
          </VizButton>
        </form>
        <div className={styles.buttons}>
          <VizButton size="sm" disabled={!ready} onClick={() => go({ L: current.L, pos: randomBelow(blockSize) })}>
            Random
          </VizButton>
          <VizButton size="sm" disabled={!ready || current.L <= MIN_LENGTH} onClick={() => go({ L: current.L - 1, pos: 0n })}>
            Shorter
          </VizButton>
          <VizButton
            size="sm"
            disabled={!ready || current.L >= lastLength(settings)}
            onClick={() => go({ L: current.L + 1, pos: 0n })}
          >
            Longer
          </VizButton>
        </div>
      </ControlGroup>

      <ControlGroup label={`Alphabet · ${lib.alphabet.length} symbols`}>
        <div className={styles.chips} role="group" aria-label="Elements">
          {ELEMENTS.map((e) => (
            <button
              key={e}
              type="button"
              className={styles.chip}
              aria-pressed={settings.symbols.elements.includes(e)}
              onClick={() => toggleElement(e)}
            >
              {e}
            </button>
          ))}
        </div>
        <ToggleSwitch
          label="Charged forms"
          checked={settings.symbols.charged}
          onChange={(v) => update({ symbols: { ...settings.symbols, charged: v } })}
        />
        <div className={styles.buttons}>
          {PRESETS.map((p) => (
            <VizButton
              key={p.label}
              size="sm"
              variant={symbolSetKey(p.symbols) === setKey ? 'primary' : 'secondary'}
              onClick={() => update({ symbols: p.symbols })}
            >
              {p.label}
            </VizButton>
          ))}
        </div>
        <ControlHint>Bonds, rings and branches are always in. Each alphabet numbers its molecules differently.</ControlHint>
      </ControlGroup>

      <ControlGroup label="Listing">
        <SliderWithInput
          label="Exactly once, up to (symbols)"
          value={settings.cap}
          onChange={(v) => update({ cap: v })}
          min={1}
          max={maxCap(lib)}
          step={1}
          decimals={0}
        />
        <ToggleSwitch label="Keep going past that" checked={settings.infinite} onChange={(v) => update({ infinite: v })} />
        <ControlHint>
          {settings.infinite
            ? `Past ${settings.cap} symbols molecules are grown from their address instead, up to ${MAX_LENGTH} symbols.`
            : `Every molecule up to ${settings.cap} symbols, each exactly once.`}
        </ControlHint>
      </ControlGroup>
    </VizPanel>
  );

  return (
    <VizWorkbench sidebar={sidebar}>
      <VizPanel flush>
        <div className={styles.head}>
          <VizPlotHeader
            title={title}
            readout={
              <>
                {plural(current.L)} · #<Big value={current.pos} /> of <Big value={blockSize} />
              </>
            }
          />
          <p className={styles.mode}>
            {exact ? 'Exact: each molecule appears once' : 'Grown from the address: any length, every symbol used'}
          </p>
        </div>
        <div className={styles.body}>
          <div
            ref={viewport}
            className={styles.viewport}
            tabIndex={0}
            onKeyDown={onKeyDown}
            aria-label="Molecules; use the arrow keys or the wheel to move"
            style={{ height: rows * CARD_HEIGHT + (rows - 1) * GAP }}
          >
            <div ref={gridRef} className={styles.grid} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {stream.items.map((item) =>
                isSlot(item) ? (
                  <PendingCard key={`${item.L}:${item.pos}`} slot={item} />
                ) : (
                  <MoleculeCard key={`${item.L}:${item.pos}`} item={item} settings={settings} highlight={same(highlight, item)} />
                ),
              )}
            </div>
            {stream.error ? (
              <p className={styles.status}>{stream.error}. Check your connection and reload.</p>
            ) : !ready ? (
              <p className={styles.status}>Loading RDKit…</p>
            ) : stream.loading ? (
              <p className={styles.status}>{exact ? 'Looking for molecules…' : 'Growing molecules…'}</p>
            ) : stream.atEnd ? (
              <p className={styles.status}>
                That's the lot: every molecule up to {settings.cap} symbols.{' '}
                <button type="button" className={styles.link} onClick={() => update({ infinite: true })}>
                  Keep going?
                </button>
              </p>
            ) : null}
          </div>
          <BlockScrollbar addr={current} lib={lib} onJump={(a) => go(a)} />
        </div>
      </VizPanel>
    </VizWorkbench>
  );
}
