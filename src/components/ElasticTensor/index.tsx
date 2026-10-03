import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useVizTheme, VizPanel, VizPanelSection, VizSectionHeader, VizWorkbench } from '../shared/viz';
import { ControlGroup, Legend, SegmentedControl, Select, ToggleSwitch, VizButton, type LegendEntry } from '../shared/controls';
import styles from './ElasticTensor.module.css';
import {
  AnalysisResult,
  DirectionalData,
  SurfaceData,
  TensorDataset,
  getPropertyTitle,
  hasMinMax,
  tensorColor,
} from './CommonFunctions';
import { DirectionalChart } from './DirectionalChart';
import { PolarChart } from './PolarChart';
import { SurfaceChart } from './SurfaceChart';
import { AddTensorModal } from './AddTensorModal';
import { EXAMPLE_TENSORS, parseTensorInput } from './examples';

interface TensorInfo {
  id: string;
  name: string;
  input: string;
  isSelected: boolean;
}

interface SavedTensor {
  name: string;
  data: string;
  timestamp: Date;
}

interface LogEntry {
  message: string;
  level: string;
}

type View = 'youngs' | 'linear_compressibility' | 'shear' | 'poisson' | 'matrix';

const VIEWS: { value: View; label: string }[] = [
  { value: 'youngs', label: "Young's modulus" },
  { value: 'linear_compressibility', label: 'Linear compressibility' },
  { value: 'shear', label: 'Shear modulus' },
  { value: 'poisson', label: "Poisson's ratio" },
  { value: 'matrix', label: 'Matrix components' },
];

const PLANES = ['xy', 'xz', 'yz'];
const SCHEMES = ['voigt', 'reuss', 'hill'] as const;
const STORAGE_KEY = 'elasticTensors';

/** Upper triangle of a 6×6 matrix in Voigt notation: (i, j, "11"). */
const UPPER = Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 - i }, (_, k) => [i, i + k] as const)).flat();

const LOG_LEVELS = ['debug', 'debug', 'info', 'warning', 'error'];

function readStorage(): SavedTensor[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).map((t: SavedTensor) => ({ ...t, timestamp: new Date(t.timestamp) })) : [];
  } catch {
    return [];
  }
}

function writeStorage(tensors: SavedTensor[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tensors));
  } catch (error) {
    console.error('Failed to save tensors:', error);
  }
}

const fmt = (v: number | null | undefined, digits: number) => (v === null || v === undefined ? 'N/A' : v.toFixed(digits));
const anisotropy = (v: number) => (isFinite(v) ? v.toFixed(2) : '∞');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

interface TableRow {
  key: string;
  name: string;
  color: string;
  cells: string[];
  /** Indices of cells to flag (e.g. non-positive eigenvalues). */
  flagged?: number[];
}

/** A results table in its own card; the copy button puts it on the clipboard as TSV. */
function ResultTable({
  title,
  detail,
  groups,
  columns,
  copyColumns,
  rows,
  onCopied,
  compact,
}: {
  title: string;
  detail?: string;
  groups?: { label: React.ReactNode; span: number }[];
  columns: React.ReactNode[];
  copyColumns: string[];
  rows: TableRow[];
  onCopied: (what: string) => void;
  compact?: boolean;
}) {
  const copy = () => {
    const text = [['Tensor', ...copyColumns], ...rows.map((r) => [r.name, ...r.cells])].map((r) => r.join('\t')).join('\n');
    navigator.clipboard.writeText(text).then(
      () => onCopied(title),
      (err) => console.error('Failed to copy table:', err),
    );
  };
  return (
    <VizPanel
      title={title}
      subtitle={detail}
      actions={
        <VizButton variant="ghost" size="sm" onClick={copy} title="Copy table as tab-separated text">
          <CopyIcon /> Copy
        </VizButton>
      }
      flush
    >
      <div className={styles.tableScroll}>
        <table className={clsx(styles.table, compact && styles.tableCompact)}>
          <thead>
            {groups && (
              <tr>
                <th />
                {groups.map((g, i) => (
                  <th key={i} colSpan={g.span} className={styles.groupHeader}>
                    {g.label}
                  </th>
                ))}
              </tr>
            )}
            <tr>
              <th>Tensor</th>
              {columns.map((c, i) => (
                <th key={i}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className={styles.tensorCell} style={{ '--tensor-color': r.color } as React.CSSProperties}>
                  {r.name}
                </td>
                {r.cells.map((c, i) => (
                  <td key={i} className={r.flagged?.includes(i) ? styles.flagged : undefined}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </VizPanel>
  );
}

export const ElasticTensor: React.FC = () => {
  const theme = useVizTheme();
  const workerRef = useRef<Worker | null>(null);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const [tensors, setTensors] = useState<TensorInfo[]>([]);
  const [savedTensors, setSavedTensors] = useState<SavedTensor[]>([]);
  const [results, setResults] = useState<Record<string, AnalysisResult>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddTensorModal, setShowAddTensorModal] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [view, setView] = useState<View>('youngs');
  const [show3D, setShow3D] = useState(false);
  const [use3DScatter, setUse3DScatter] = useState(true);
  const [showShading, setShowShading] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [showGridLines, setShowGridLines] = useState(true);

  const addLog = useCallback((message: string, level: string) => {
    setLogs((prev) => [...prev, { message, level }]);
  }, []);

  // Saved tensors from localStorage, or the examples on a first visit.
  useEffect(() => {
    const saved = readStorage();
    setSavedTensors(saved);
    const initial = saved.length
      ? saved.map((t, i) => ({ id: `saved-${i}-${Date.now()}`, name: t.name, input: t.data, isSelected: false }))
      : EXAMPLE_TENSORS.map((t) => ({
          id: `example-${t.name.toLowerCase()}`,
          name: `${t.name} (Example)`,
          input: t.input,
          isSelected: false,
        }));
    setTensors(initial);
  }, []);

  useEffect(() => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./elastic-worker.js', import.meta.url), { type: 'module' });
    } catch (err) {
      setError('Failed to initialize Web Worker: ' + (err as Error).message);
      return;
    }
    worker.onmessage = (e: MessageEvent) => {
      const { type, ...data } = e.data;
      switch (type) {
        case 'initialized':
          setIsWorkerReady(!!data.success);
          if (data.success) addLog('Worker initialized successfully', 'info');
          else setError('Worker initialization failed: ' + data.error);
          break;
        case 'log':
          addLog(data.message, LOG_LEVELS[data.level] ?? 'error');
          break;
        case 'analyzeAllResult':
          if (data.success) {
            const byId: Record<string, AnalysisResult> = {};
            for (const r of data.data as AnalysisResult[]) byId[r.id] = r;
            setResults(byId);
            addLog(`Analysis complete for ${data.data.length} tensor(s)`, 'info');
          } else {
            setError('Analysis failed: ' + data.error);
          }
          setIsCalculating(false);
          break;
        case 'error':
          console.error('Worker error:', data.error);
          setError('Calculation error: ' + data.error);
          setIsCalculating(false);
          break;
      }
    };
    worker.onerror = (e) => {
      console.error('Worker error:', e);
      setError('Worker error: ' + e.message);
      setIsWorkerReady(false);
    };
    worker.postMessage({ type: 'init', data: {} });
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [addLog]);

  const selected = tensors.filter((t) => t.isSelected);
  const colorOf = (id: string) => tensorColor(theme, Math.max(0, selected.findIndex((t) => t.id === id)));
  const analysed = selected.filter((t) => results[t.id]);

  const handleAddTensors = (added: { name: string; input: string }[]) => {
    const names = new Set(added.map((t) => t.name.trim()));
    const saved = [
      ...added.map((t) => ({ name: t.name.trim(), data: t.input.trim(), timestamp: new Date() })),
      ...savedTensors.filter((t) => !names.has(t.name)),
    ];
    setSavedTensors(saved);
    writeStorage(saved);
    setTensors((prev) => [
      ...prev,
      ...added.map((t) => ({
        id: `tensor-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        name: t.name,
        input: t.input,
        isSelected: false,
      })),
    ]);
    addLog(`Added and saved ${added.length} tensor(s)`, 'info');
  };

  const removeTensor = (tensor: TensorInfo) => {
    if (tensor.name) {
      const saved = savedTensors.filter((t) => t.name !== tensor.name);
      setSavedTensors(saved);
      writeStorage(saved);
    }
    setTensors((prev) => prev.filter((t) => t.id !== tensor.id));
  };

  const renameTensor = (tensor: TensorInfo) => {
    const name = prompt('Enter tensor name:', tensor.name);
    if (name !== null) setTensors((prev) => prev.map((t) => (t.id === tensor.id ? { ...t, name } : t)));
  };

  const toggleSelected = (id: string) =>
    setTensors((prev) => prev.map((t) => (t.id === id ? { ...t, isSelected: !t.isSelected } : t)));

  const clearSelection = () => setTensors((prev) => prev.map((t) => ({ ...t, isSelected: false })));

  const clearAllTensors = () => {
    if (!window.confirm(`Remove all ${tensors.length} tensors? This also clears them from storage and cannot be undone.`)) return;
    setTensors([]);
    setResults({});
    setSavedTensors([]);
    writeStorage([]);
    addLog('Cleared all tensors and storage', 'info');
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const added: { name: string; input: string }[] = [];
    for (const file of Array.from(e.dataTransfer.files)) {
      if (file.type !== 'text/plain' && !file.name.endsWith('.txt')) continue;
      try {
        added.push({ name: file.name.replace(/\.(txt|dat)$/i, ''), input: (await file.text()).trim() });
      } catch (err) {
        console.error(`Failed to read file ${file.name}:`, err);
      }
    }
    if (added.length) handleAddTensors(added);
  };

  const analyze = () => {
    const worker = workerRef.current;
    if (!worker || !isWorkerReady) {
      setError('Worker not ready. Please wait for initialization.');
      return;
    }
    if (selected.length === 0) {
      setError('No tensors selected. Click tensors in the list to select them.');
      return;
    }
    setError('');
    setLogs([]);
    const toAnalyze: { id: string; data: number[][] }[] = [];
    for (const t of selected) {
      const name = t.name || 'Unnamed';
      if (!t.input.trim()) {
        addLog(`Skipping tensor "${name}" - no input data`, 'warning');
        continue;
      }
      try {
        toAnalyze.push({ id: t.id, data: parseTensorInput(t.input) });
      } catch (err) {
        addLog(`Failed to parse tensor "${name}": ${(err as Error).message}`, 'error');
      }
    }
    if (toAnalyze.length === 0) {
      setError('No valid tensors to analyze. Check tensor input data.');
      return;
    }
    setIsCalculating(true);
    addLog(`Analysing ${toAnalyze.length} tensor(s)...`, 'info');
    worker.postMessage({
      type: 'analyzeAll',
      data: { tensors: toAnalyze, properties: ['youngs', 'linear_compressibility', 'shear', 'poisson'] },
    });
  };

  // Per-plane and 3D datasets for the selected property, in selection order.
  const chartData = useMemo(() => {
    const planes: Record<string, TensorDataset<DirectionalData[]>[]> = { xy: [], xz: [], yz: [] };
    const surfaces: TensorDataset<SurfaceData>[] = [];
    if (view === 'matrix') return { planes, surfaces };
    tensors.filter((t) => t.isSelected).forEach((t, colorIndex) => {
      const r = results[t.id];
      if (!r) return;
      const base = { tensorId: t.id, name: t.name || 'Unnamed', colorIndex };
      for (const plane of PLANES) {
        const data = r.directionalData?.[plane]?.[view];
        if (data?.length) planes[plane].push({ ...base, data });
      }
      const surface = r.surfaceData?.[view];
      if (surface) surfaces.push({ ...base, data: surface });
    });
    return { planes, surfaces };
  }, [tensors, results, view]);

  const notPositiveDefinite = analysed.some((t) => results[t.id].eigenvalues && !results[t.id].isPositiveDefinite);
  const eigenvalueError = analysed.some((t) => results[t.id].eigenvalueError);
  const onCopied = (what: string) => addLog(`${what} table copied to clipboard`, 'info');

  const legendItems: LegendEntry[] = analysed.map((t) => ({ key: t.id, label: t.name || 'Unnamed', color: colorOf(t.id) }));
  if (view !== 'matrix' && hasMinMax(view) && !show3D) {
    legendItems.push(
      { key: 'max', label: 'max', color: theme.muted, shape: 'line' },
      { key: 'min', label: 'min', color: theme.muted, shape: 'dashed' },
    );
  }

  const filtered = searchQuery.trim()
    ? tensors.filter((t) => t.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : tensors;

  const sidebar = (
    <>
      <VizPanel
        title="Tensors"
        subtitle={tensors.length ? `${selected.length} of ${tensors.length} selected` : undefined}
        actions={
          <span className={clsx(styles.status, isWorkerReady && styles.statusReady)}>
            {isWorkerReady ? 'Ready' : 'Loading…'}
          </span>
        }
        stack
      >
        <button
          type="button"
          onClick={() => setShowAddTensorModal(true)}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={clsx(styles.dropZone, dragActive && styles.dragActive)}
        >
          <strong>{dragActive ? 'Drop tensor files here' : 'Add tensors'}</strong>
          <span>{dragActive ? 'Release to upload' : 'Paste a 6×6 matrix, or drop .txt files'}</span>
        </button>

        {tensors.length > 0 ? (
          <div className={styles.listBlock}>
            {tensors.length > 4 && (
              <input
                type="search"
                placeholder="Search tensors…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.input}
                aria-label="Search tensors"
              />
            )}
            <ul className={styles.tensorList}>
              {filtered.map((t) => (
                <li
                  key={t.id}
                  className={clsx(styles.tensorItem, t.isSelected && styles.selected)}
                  style={t.isSelected ? ({ '--tensor-color': colorOf(t.id) } as React.CSSProperties) : undefined}
                >
                  <button
                    type="button"
                    className={styles.tensorToggle}
                    aria-pressed={t.isSelected}
                    onClick={() => toggleSelected(t.id)}
                  >
                    <span className={styles.tensorSwatch} aria-hidden />
                    <span className={clsx(styles.tensorName, !t.name && styles.unnamed)}>{t.name || 'Unnamed tensor'}</span>
                  </button>
                  <button type="button" className={styles.iconButton} onClick={() => renameTensor(t)} title="Rename tensor">
                    Edit
                  </button>
                  <button
                    type="button"
                    className={clsx(styles.iconButton, styles.iconDanger)}
                    onClick={() => removeTensor(t)}
                    title="Remove tensor and delete it from storage"
                    aria-label={`Remove ${t.name || 'tensor'}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className={styles.listActions}>
              <VizButton variant="ghost" size="sm" onClick={clearSelection} disabled={selected.length === 0}>
                Deselect all
              </VizButton>
              <VizButton variant="ghost" size="sm" className={styles.dangerText} onClick={clearAllTensors} title="Remove all tensors and clear storage">
                Remove all
              </VizButton>
            </div>
          </div>
        ) : (
          <p className={styles.empty}>No tensors yet. Add one to get started.</p>
        )}

        <VizButton variant="primary" block onClick={analyze} disabled={!isWorkerReady || isCalculating}>
          {isCalculating ? 'Analysing…' : 'Analyse'}
        </VizButton>

        {error && (
          <div className={styles.errorMessage} role="alert">
            {error}
          </div>
        )}
        {logs.length > 0 && (
          <div className={styles.log} aria-live="polite">
            {logs.slice(-3).map((log, i) => (
              <div key={i} className={styles[log.level]}>
                {log.message}
              </div>
            ))}
          </div>
        )}
      </VizPanel>

      <VizPanel title="Display" stack>
        <Select<View> label="Show" value={view} onChange={setView} options={VIEWS} />
        {view !== 'matrix' && (
          <ControlGroup label="Plots">
            <ToggleSwitch label="3D surface" checked={show3D} onChange={setShow3D} />
            {show3D ? (
              <SegmentedControl<string>
                aria-label="3D style"
                value={use3DScatter ? 'points' : 'mesh'}
                onChange={(v) => setUse3DScatter(v === 'points')}
                options={[
                  { value: 'points', label: 'Points' },
                  { value: 'mesh', label: 'Mesh' },
                ]}
              />
            ) : (
              <>
                <ToggleSwitch label="Area shading" checked={showShading} onChange={setShowShading} />
                <ToggleSwitch label="Grid lines" checked={showGridLines} onChange={setShowGridLines} />
              </>
            )}
            <ToggleSwitch label="Legend" checked={showLegend} onChange={setShowLegend} />
          </ControlGroup>
        )}
      </VizPanel>
    </>
  );

  const banner = (title: string, body: string) => (
    <div className={styles.banner} role="alert">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );

  const rowFor = (t: TensorInfo, key: string, cells: string[], flagged?: number[]): TableRow => ({
    key,
    name: t.name || 'Unnamed',
    color: colorOf(t.id),
    cells,
    flagged,
  });

  const matrixTable = (which: 'stiffnessMatrix' | 'complianceMatrix') => {
    const letter = which === 'stiffnessMatrix' ? 'C' : 'S';
    const labels = UPPER.map(([i, j]) => `${letter}${i + 1}${j + 1}`);
    return (
      <ResultTable
        title={which === 'stiffnessMatrix' ? 'Stiffness matrix C' : 'Compliance matrix S'}
        detail={which === 'stiffnessMatrix' ? 'GPa' : 'GPa⁻¹'}
        columns={UPPER.map(([i, j]) => (
          <>
            {letter}
            <sub>{`${i + 1}${j + 1}`}</sub>
          </>
        ))}
        copyColumns={labels}
        rows={analysed.map((t) =>
          rowFor(
            t,
            t.id,
            UPPER.map(([i, j]) => fmt(results[t.id][which]?.[i]?.[j], which === 'stiffnessMatrix' ? 1 : 6)),
          ),
        )}
        onCopied={onCopied}
        compact
      />
    );
  };

  const charts =
    view === 'matrix' ? (
      <>
        {matrixTable('stiffnessMatrix')}
        {matrixTable('complianceMatrix')}
      </>
    ) : (
      <VizPanel flush>
        <VizPanelSection>
          <VizSectionHeader
            title={getPropertyTitle(view)}
            detail={show3D ? 'directional surface' : 'cuts through the xy, xz and yz planes'}
            actions={showLegend && legendItems.length > 0 ? <Legend items={legendItems} /> : undefined}
          />
          {show3D ? (
            notPositiveDefinite ? (
              <p className={styles.empty}>3D view is disabled: a selected tensor is not positive definite.</p>
            ) : (
              <SurfaceChart multiSurfaceData={chartData.surfaces} property={view} useScatter={use3DScatter} />
            )
          ) : (
            <div className={styles.chartGrid}>
              {PLANES.map((plane) => (
                <figure key={plane} className={styles.chart}>
                  <figcaption>{plane} plane</figcaption>
                  <PolarChart
                    property={view}
                    plane={plane}
                    multiTensorData={chartData.planes[plane]}
                    showShading={showShading}
                    showGridLines={showGridLines}
                  />
                </figure>
              ))}
            </div>
          )}
        </VizPanelSection>
        {!show3D && (
          <VizPanelSection>
            <VizSectionHeader title="Angular variation" detail="value against angle within each plane" />
            <div className={styles.chartGrid}>
              {PLANES.map((plane) => (
                <figure key={plane} className={styles.chart}>
                  <figcaption>{plane} plane</figcaption>
                  <DirectionalChart
                    property={view}
                    multiTensorData={chartData.planes[plane]}
                    showShading={showShading}
                    showGridLines={showGridLines}
                  />
                </figure>
              ))}
            </div>
          </VizPanelSection>
        )}
      </VizPanel>
    );

  return (
    <>
      <VizWorkbench sidebarSide="left" className={styles.workbench} sidebar={sidebar}>
        {analysed.length === 0 ? (
          <VizPanel>
            <div className={styles.placeholder}>
              <strong>{isCalculating ? 'Analysing…' : 'No results yet'}</strong>
              <span>
                Select one or more tensors in the Tensors panel and press Analyse. Selected tensors are compared side by side,
                each in its own colour.
              </span>
            </div>
          </VizPanel>
        ) : (
          <>
            {notPositiveDefinite &&
              banner(
                'Not positive definite',
                'One or more tensors have non-positive eigenvalues, so they are not mechanically stable. Their properties and plots are not physically meaningful.',
              )}
            {eigenvalueError && banner('Cannot calculate eigenvalues', 'Eigenvalue calculation failed for some tensors.')}

            <ResultTable
              title="Averaged properties"
              detail="Voigt, Reuss and Hill bounds"
              columns={[
                'Scheme',
                <>Bulk modulus <em>K</em> (GPa)</>,
                <>Young's modulus <em>E</em> (GPa)</>,
                <>Shear modulus <em>G</em> (GPa)</>,
                <>Poisson's ratio <em>ν</em></>,
                ...[1, 2, 3, 4, 5, 6].map((i) => <>λ<sub>{i}</sub></>),
              ]}
              copyColumns={[
                'Averaging scheme',
                'Bulk modulus (GPa)',
                "Young's modulus (GPa)",
                'Shear modulus (GPa)',
                "Poisson's ratio",
                ...[1, 2, 3, 4, 5, 6].map((i) => `λ${i}`),
              ]}
              rows={analysed.flatMap((t) => {
                const r = results[t.id];
                const eig = (r.eigenvalues ?? Array(6).fill(null)).slice(0, 6);
                return SCHEMES.map((s, k) => {
                  const p = r.properties;
                  const cells = [cap(s), fmt(p.bulkModulus[s], 3), fmt(p.youngsModulus[s], 3), fmt(p.shearModulus[s], 3), fmt(p.poissonRatio[s], 5)];
                  // Eigenvalues of C belong to the tensor, not the scheme: show them once.
                  const eigCells = k === 0 ? eig.map((v) => fmt(v, 2)) : Array(6).fill('');
                  const flagged = k === 0 ? eig.flatMap((v, i) => (v !== null && v <= 0 ? [5 + i] : [])) : [];
                  return rowFor(t, `${t.id}-${s}`, [...cells, ...eigCells], flagged);
                });
              })}
              onCopied={onCopied}
            />

            <ResultTable
              title="Variations of the elastic moduli"
              detail="extremes over all directions"
              groups={[
                { label: "Young's modulus (GPa)", span: 3 },
                { label: <>Linear compressibility (TPa<sup>−1</sup>)</>, span: 3 },
                { label: 'Shear modulus (GPa)', span: 3 },
                { label: "Poisson's ratio", span: 3 },
              ]}
              columns={(['E', 'β', 'G', 'ν'] as const).flatMap((sym) =>
                ['min', 'max', 'aniso'].map((k) => (
                  <>
                    {sym === 'E' || sym === 'G' ? <em>{sym}</em> : sym}
                    <sub>{k}</sub>
                  </>
                )),
              )}
              copyColumns={['E', 'β', 'G', 'ν'].flatMap((sym) => ['min', 'max', 'aniso'].map((k) => `${sym}_${k}`))}
              rows={analysed.map((t) => {
                const x = results[t.id].extrema;
                return rowFor(t, t.id, [
                  fmt(x.youngsModulus.min, 3), fmt(x.youngsModulus.max, 3), anisotropy(x.youngsModulus.anisotropy),
                  fmt(x.linearCompressibility.min, 3), fmt(x.linearCompressibility.max, 3), anisotropy(x.linearCompressibility.anisotropy),
                  fmt(x.shearModulus.min, 3), fmt(x.shearModulus.max, 3), anisotropy(x.shearModulus.anisotropy),
                  fmt(x.poissonRatio.min, 5), fmt(x.poissonRatio.max, 5), anisotropy(x.poissonRatio.anisotropy),
                ]);
              })}
              onCopied={onCopied}
            />

            {charts}
          </>
        )}
      </VizWorkbench>

      <AddTensorModal
        isOpen={showAddTensorModal}
        onClose={() => setShowAddTensorModal(false)}
        onAddTensors={handleAddTensors}
      />
    </>
  );
};
