import React, { useEffect, useMemo, useState } from 'react';
import { useVizTheme, VizPanel } from '../shared/viz';
import { Select, VizButton } from '../shared/controls';
import { moleculeSvg, useRDKit } from '../shared/chem';
import { decoder, selfiesAlphabet, selfiesAtIndex, selfiesCount } from './selfies-wrapper';
import styles from './InfiniteMolecules.module.css';

interface Molecule {
  index: number;
  selfies: string;
  smiles: string;
  svg: string;
}

const LENGTHS = [2, 3, 4, 5, 6].map((m) => ({ value: String(m), label: `${m} symbols` }));

interface InfiniteMoleculesProps {
  /** Molecules per page. */
  batchSize?: number;
}

export function InfiniteMolecules({ batchSize = 12 }: InfiniteMoleculesProps) {
  const theme = useVizTheme();
  const { rdkit, error: loadError } = useRDKit();
  const [symbols, setSymbols] = useState(3);
  const [start, setStart] = useState(0);
  const [jump, setJump] = useState('');
  const [copied, setCopied] = useState('');

  const total = selfiesCount(symbols);
  const lastStart = Math.max(0, total - batchSize);

  const molecules = useMemo(() => {
    if (!rdkit) return [];
    const out: Molecule[] = [];
    for (let index = start; index < Math.min(total, start + batchSize); index++) {
      const selfies = selfiesAtIndex(index, symbols);
      let smiles = '';
      try {
        smiles = decoder(selfies);
      } catch {
        continue;
      }
      const svg = smiles ? moleculeSvg(rdkit, smiles, theme, { width: 260, height: 200, maxFontSize: 26 }) : null;
      if (svg) out.push({ index, selfies, smiles, svg });
    }
    return out;
  }, [rdkit, theme, symbols, start, batchSize, total]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(''), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text).then(() => setCopied(key), () => {});
  };

  const goTo = (i: number) => setStart(Math.max(0, Math.min(lastStart, Math.floor(i))));
  const submitJump = (e: React.FormEvent) => {
    e.preventDefault();
    const i = Number(jump.replace(/[,\s_]/g, ''));
    if (Number.isFinite(i)) {
      goTo(i);
      setJump('');
    }
  };

  const end = Math.min(total, start + batchSize) - 1;
  const fraction = total > 1 ? (start / (total - 1)) * 100 : 0;

  return (
    <div className={styles.explorer}>
      <VizPanel className={styles.toolbar}>
        <div className={styles.toolbarRow}>
          <Select
            label="String length"
            value={String(symbols)}
            onChange={(v) => {
              setSymbols(Number(v));
              setStart(0);
            }}
            options={LENGTHS}
          />
          <div className={styles.range}>
            <span className={styles.rangeMain}>
              #{start.toLocaleString()}–{end.toLocaleString()}
            </span>
            <span className={styles.rangeDetail}>
              of {total.toLocaleString()} strings ({selfiesAlphabet().length}
              <sup>{symbols}</sup>) · {fraction < 0.01 && start > 0 ? '<0.01' : fraction.toFixed(2)}% through
            </span>
          </div>
          <div className={styles.pager}>
            <VizButton size="sm" onClick={() => goTo(start - batchSize)} disabled={start === 0}>
              Previous
            </VizButton>
            <VizButton size="sm" onClick={() => goTo(start + batchSize)} disabled={start >= lastStart}>
              Next
            </VizButton>
            <VizButton size="sm" onClick={() => goTo(Math.random() * total)}>
              Random
            </VizButton>
            <form className={styles.jump} onSubmit={submitJump}>
              <input
                className={styles.jumpInput}
                inputMode="numeric"
                value={jump}
                onChange={(e) => setJump(e.target.value)}
                placeholder="Go to #"
                aria-label="Go to index"
              />
              <VizButton size="sm" type="submit" disabled={!jump.trim()}>
                Go
              </VizButton>
            </form>
          </div>
        </div>
      </VizPanel>

      {loadError ? (
        <p className={styles.status}>{loadError}. Check your connection and reload.</p>
      ) : !rdkit ? (
        <p className={styles.status}>Loading RDKit…</p>
      ) : (
        <div className={styles.grid}>
          {molecules.map((m) => (
            <article key={m.index} className={styles.card}>
              <div className={styles.depiction} dangerouslySetInnerHTML={{ __html: m.svg }} />
              <div className={styles.info}>
                <span className={styles.index}>#{m.index.toLocaleString()}</span>
                {(['selfies', 'smiles'] as const).map((kind) => {
                  const key = `${m.index}-${kind}`;
                  return (
                    <button
                      key={kind}
                      type="button"
                      className={styles.copy}
                      onClick={() => copy(key, m[kind])}
                      title={`Copy ${kind.toUpperCase()}`}
                    >
                      <span className={styles.copyLabel}>{copied === key ? 'Copied' : kind === 'selfies' ? 'SELFIES' : 'SMILES'}</span>
                      <code>{m[kind]}</code>
                    </button>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}
      {rdkit && molecules.length < Math.min(batchSize, total - start) && (
        <p className={styles.status}>
          {Math.min(batchSize, total - start) - molecules.length} of these strings decode to an empty molecule and are
          not shown.
        </p>
      )}
    </div>
  );
}
