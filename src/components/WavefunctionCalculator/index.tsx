import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './WavefunctionCalculator.module.css';
import { VizPanel, VizPanelSection, VizPlotHeader, VizWorkbench } from '../shared/viz';
import { ControlGroup, ControlHint, Select, SliderWithInput, ToggleSwitch, VizButton } from '../shared/controls';
import FileUploader from './FileUploader';
import CalculationSettings, { BASIS_SETS, METHODS } from './CalculationSettings';
import CubeSettings from './CubeSettings';
import ResultsDisplay from './ResultsDisplay';
import LogOutput from './LogOutput';
import MatrixDisplay from './MatrixDisplay';
import MoleculeViewer from './MoleculeViewer';
import OrbitalItem from './OrbitalItem';
import TrajectoryViewer from '@site/src/components/TrajectoryViewer';
import { NormalModeTrajectory } from './NormalModeTrajectory';
import { useCalculation } from './useCalculation';
import {
  isUnrestrictedOrbitals,
  getOrbitalList,
} from './types';
import type {
  CalculationResult,
  SCFSettings,
  CubeGeometrySettings,
  MoleculeInfo,
} from './types';

type Tab = 'output' | 'results' | 'structure' | 'properties' | 'optimization' | 'settings' | 'about';

const TOLERANCES = ['1e-6', '1e-7', '1e-8', '1e-9', '1e-10'].map((v) => ({ value: v, label: v }));

const LOG_LEVELS = [
  { value: '0', label: 'Trace' },
  { value: '1', label: 'Debug' },
  { value: '2', label: 'Info' },
  { value: '3', label: 'Warning' },
  { value: '4', label: 'Error' },
];

/** Versions and runtime details for the About tab. */
const EngineInfo: React.FC = () => {
  const { siteConfig } = useDocusaurusContext();
  const occVersion = siteConfig.customFields?.occVersion as string | undefined;
  // Browser-only facts; read after mount so the static render matches.
  const [runtime, setRuntime] = useState<{ isolated: boolean; cores: number } | null>(null);
  useEffect(() => {
    setRuntime({
      isolated: typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated,
      cores: navigator.hardwareConcurrency || 1,
    });
  }, []);

  return (
    <table>
      <tbody>
        <tr>
          <th scope="row">OCC</th>
          <td>
            {occVersion ? (
              <a href={`https://www.npmjs.com/package/@peterspackman/occjs/v/${occVersion}`} target="_blank" rel="noopener noreferrer">
                v{occVersion}
              </a>
            ) : 'unknown'}
            {' '}(<code>@peterspackman/occjs</code>, the <code>occ</code> program compiled to WebAssembly)
          </td>
        </tr>
        <tr>
          <th scope="row">Runs in</th>
          <td>a Web Worker, started fresh for each calculation</td>
        </tr>
        <tr>
          <th scope="row">Threads</th>
          <td>
            {runtime === null
              ? '…'
              : runtime.isolated
                ? `up to ${runtime.cores} (this page is cross-origin isolated, so shared memory is available)`
                : '1 (this page is not cross-origin isolated, so shared memory is unavailable)'}
          </td>
        </tr>
      </tbody>
    </table>
  );
};

const WavefunctionCalculator: React.FC<{ title: string }> = ({ title }) => {
  // Calculation state via hook
  const calc = useCalculation();
  const {
    isCalculating, isCubeComputing, isWorking,
    results, logs, error, setError,
    cubeResults, cubeGridInfo,
    precomputedTrajectories,
    runCalculation, cancelCalculation, clearResults, restoreSession,
    requestCubeComputation, addLog,
  } = calc;

  // UI-only state (not calculation logic)
  const [currentXYZData, setCurrentXYZData] = useState<string>('');
  const [moleculeInfo, setMoleculeInfo] = useState<MoleculeInfo | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('structure');
  const [validationError, setValidationError] = useState<string>('');
  const [isXYZValid, setIsXYZValid] = useState<boolean>(true);

  // Resume banner
  interface SavedSession {
    xyzData: string;
    formula: string;
    method: string;
    basis: string;
    results: CalculationResult;
  }
  const [savedSession, setSavedSession] = useState<SavedSession | null>(null);

  // Load saved session on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('wfn-calc-session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.xyzData && parsed.results?.energy != null) {
          setSavedSession(parsed);
        }
      }
    } catch {}
  }, []);

  // Save full results to localStorage when calculation completes
  useEffect(() => {
    if (!results || !currentXYZData) return;
    try {
      const session: SavedSession = {
        xyzData: currentXYZData,
        formula: moleculeInfo?.formula || '',
        method: settings.method,
        basis: settings.basisSet,
        results,
      };
      localStorage.setItem('wfn-calc-session', JSON.stringify(session));
    } catch (e) {
      // Quota exceeded -- save minimal version without matrices/owfJson
      try {
        const lite = { ...results };
        if (lite.matrices) lite.matrices = undefined;
        if (lite.wavefunctionData?.owfJson) {
          lite.wavefunctionData = { ...lite.wavefunctionData, owfJson: undefined };
        }
        localStorage.setItem('wfn-calc-session', JSON.stringify({
          xyzData: currentXYZData,
          formula: moleculeInfo?.formula || '',
          method: settings.method,
          basis: settings.basisSet,
          results: lite,
        }));
      } catch {}
    }
  }, [results]);

  // Load default basis from localStorage
  const getDefaultBasis = (): string => {
    try {
      return localStorage.getItem('wfn-calc-default-basis') || '3-21g';
    } catch {
      return '3-21g';
    }
  };

  // Calculation settings
  const [settings, setSettings] = useState<SCFSettings>({
    method: 'hf',
    basisSet: getDefaultBasis(),
    charge: 0,
    multiplicity: 1,
    optimize: false,
    computeFrequencies: false,
    maxIterations: 100,
    energyTolerance: 1e-8,
    threads: 1,
    logLevel: 2,
  });

  const updateSettings = (updates: Partial<SCFSettings>) => {
    setSettings(prev => {
      const newSettings = { ...prev, ...updates };
      if ('optimize' in updates && !updates.optimize) {
        newSettings.computeFrequencies = false;
      }
      return newSettings;
    });
  };

  // Cube settings
  const [cubeSettings, setCubeSettings] = useState<CubeGeometrySettings>({
    gridSteps: 50,
    useAdaptive: true,
    bufferDistance: 2.0,
    threshold: 1e-5,
    customOrigin: false,
    origin: [0, 0, 0],
    customDirections: false,
    directionA: [0, 0, 0],
    directionB: [0, 0, 0],
    directionC: [0, 0, 0],
  });
  const [showCubeSettings, setShowCubeSettings] = useState(false);

  const updateCubeSettings = (updates: Partial<CubeGeometrySettings>) => {
    setCubeSettings(prev => ({ ...prev, ...updates }));
  };

  // Trajectory viewing
  const [trajectoryMode, setTrajectoryMode] = useState<'optimization' | 'normal_mode'>('optimization');
  const [selectedNormalMode, setSelectedNormalMode] = useState<number | null>(null);
  const [hideLowModes, setHideLowModes] = useState<boolean>(true);


  const handleFileLoad = (xyzContent: string) => {
    setCurrentXYZData(xyzContent);
    clearResults();
    setError('');
    
    // Switch to structure tab when XYZ file is modified
    setActiveTab('structure');
    setValidationError('');
    
    try {
      // Parse XYZ to get basic info
      const lines = xyzContent.trim().split('\n');
      const numAtoms = parseInt(lines[0]);
      const moleculeName = lines[1] || 'Loaded Molecule';
      
      // Count atoms by element
      const elementCounts = new Map<string, number>();
      for (let i = 2; i < 2 + numAtoms; i++) {
        const parts = lines[i].trim().split(/\s+/);
        const element = parts[0];
        elementCounts.set(element, (elementCounts.get(element) || 0) + 1);
      }
      
      // Create formula
      const formula = Array.from(elementCounts.entries())
        .map(([elem, count]) => count > 1 ? `${elem}${count}` : elem)
        .join('');
      
      setMoleculeInfo({ name: moleculeName, formula, numAtoms });
      addLog(`Molecule loaded: ${formula} (${numAtoms} atoms) - cleared orbital cache`, 'info');
    } catch (error) {
      console.error('Error parsing XYZ:', error);
      // Don't set error here, as validation will handle it
    }
  };
  
  const handleValidationChange = (isValid: boolean, error?: string) => {
    setIsXYZValid(isValid);
    if (!isValid && error) {
      setValidationError(error);
    } else {
      setValidationError('');
    }
  };


  const handleRunCalculation = () => {
    if (!currentXYZData) {
      setError('Please load a molecule first.');
      return;
    }
    if (!isXYZValid) return;

    setActiveTab('output');
    runCalculation(currentXYZData, settings);
  };

  const handleRequestCubeComputation = (cubeType: string, orbitalIndex?: number, gridStepsOverride?: number, spin?: 'alpha' | 'beta') => {
    requestCubeComputation(cubeType, cubeSettings, orbitalIndex, gridStepsOverride, spin);
  };

  // Convert optimization trajectory to XYZ format for TrajectoryViewer
  const convertTrajectoryToXYZ = (trajectory: any): string => {
    if (!trajectory || !trajectory.geometries || !trajectory.energies) {
      return '';
    }

    const xyzFrames: string[] = [];
    
    trajectory.geometries.forEach((geometry: string, index: number) => {
      const energy = trajectory.energies[index];
      const lines = geometry.trim().split('\n');
      
      if (lines.length >= 2) {
        const numAtoms = lines[0];
        const comment = `Step ${index} Energy=${energy.toFixed(9)}`;
        const atomLines = lines.slice(2).join('\n');
        
        xyzFrames.push(`${numAtoms}\n${comment}\n${atomLines}`);
      }
    });
    
    return xyzFrames.join('\n');
  };

  // Get the appropriate XYZ data for structure display
  const getStructureXYZ = (): string => {
    // If optimization was performed and completed, use the final optimized geometry
    if (results?.optimization?.finalXYZ) {
      return results.optimization.finalXYZ;
    }
    // Otherwise, use the original input geometry
    return currentXYZData;
  };

  // Generate normal mode trajectory by sampling along the normal mode vector
  const generateNormalModeTrajectory = (modeIndex: number): string => {
    // First check if we have a pre-computed trajectory
    const precomputed = precomputedTrajectories.get(modeIndex);
    if (precomputed) {
      return precomputed;
    }
    // Fallback to real-time generation using utility class
    if (!results?.optimization?.finalXYZ || !results?.frequencies?.frequencies) {
      return '';
    }

    const normalMode = results.frequencies.normalModes?.[modeIndex];
    const frequency = results.frequencies.frequencies[modeIndex];
    
    if (!normalMode || normalMode.length === 0) {
      return NormalModeTrajectory.createPlaceholderTrajectory(
        results.optimization.finalXYZ, 
        frequency, 
        modeIndex
      );
    }

    return NormalModeTrajectory.generateTrajectory(
      results.optimization.finalXYZ,
      normalMode,
      frequency,
      modeIndex
    );
  };

  // Get trajectory data based on current mode
  const getCurrentTrajectoryData = (): string => {
    if (trajectoryMode === 'normal_mode' && selectedNormalMode !== null) {
      return generateNormalModeTrajectory(selectedNormalMode);
    } else if (trajectoryMode === 'optimization' && results?.optimization?.trajectory) {
      return convertTrajectoryToXYZ(results.optimization.trajectory);
    }
    return '';
  };


  // Get trajectory name based on current mode
  const getCurrentTrajectoryName = (): string => {
    if (trajectoryMode === 'normal_mode' && selectedNormalMode !== null && results?.frequencies?.frequencies) {
      const freq = results.frequencies.frequencies[selectedNormalMode];
      return `Mode ${selectedNormalMode + 1}: ${Math.abs(freq).toFixed(2)} cm⁻¹`;
    } else if (trajectoryMode === 'optimization') {
      return `${moleculeInfo?.formula || 'Molecule'} Optimization`;
    }
    return 'Trajectory';
  };

  // Filter frequencies based on hideLowModes setting
  const getFilteredFrequencies = () => {
    if (!results?.frequencies?.frequencies) return [];
    
    return results.frequencies.frequencies
      .map((freq, index) => ({ freq, index }))
      .filter(({ freq }) => !hideLowModes || Math.abs(freq) >= 50);
  };

  const handleResumeSession = () => {
    if (!savedSession) return;
    setCurrentXYZData(savedSession.xyzData);
    updateSettings({ method: savedSession.method, basisSet: savedSession.basis });

    // Parse molecule info
    try {
      const lines = savedSession.xyzData.trim().split('\n');
      const numAtoms = parseInt(lines[0]);
      const name = lines[1] || 'Resumed';
      const elementCounts = new Map<string, number>();
      for (let i = 2; i < 2 + numAtoms; i++) {
        const elem = lines[i]?.trim().split(/\s+/)[0];
        if (elem) elementCounts.set(elem, (elementCounts.get(elem) || 0) + 1);
      }
      const formula = Array.from(elementCounts.entries())
        .map(([e, c]) => c > 1 ? `${e}${c}` : e).join('');
      setMoleculeInfo({ name, formula, numAtoms });
    } catch {}

    // Reconstruct wavefunction binary from saved owfJson string
    let wfnData: Uint8Array | undefined;
    if (savedSession.results.wavefunctionData?.owfJson) {
      wfnData = new TextEncoder().encode(savedSession.results.wavefunctionData.owfJson);
    }

    restoreSession(savedSession.results, wfnData);
    setActiveTab('results');
    setSavedSession(null);
  };

  const dismissSavedSession = () => {
    setSavedSession(null);
    try { localStorage.removeItem('wfn-calc-session'); } catch {}
  };

  const methodLabel = METHODS.find((m) => m.value === settings.method)?.label ?? settings.method;
  const basisLabel = BASIS_SETS.find((b) => b.value === settings.basisSet)?.label ?? settings.basisSet;
  const readout = !moleculeInfo
    ? 'Load a molecule to begin'
    : [
        `${moleculeInfo.formula} · ${moleculeInfo.numAtoms} atoms`,
        `${methodLabel}/${basisLabel}`,
        results ? `E = ${results.energy.toFixed(6)} Ha` : isCalculating ? 'running…' : null,
      ].filter(Boolean).join(' · ');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'structure', label: 'Structure' },
    { id: 'output', label: 'Output' },
    { id: 'results', label: 'Results' },
    { id: 'properties', label: 'Properties' },
    ...(results?.optimization ? [{ id: 'optimization' as const, label: 'Optimisation' }] : []),
    { id: 'settings', label: 'Settings' },
    { id: 'about', label: 'About' },
  ];

  const sidebar = (
    <VizPanel stack>
      <ControlGroup label="Molecule">
        <FileUploader onFileLoad={handleFileLoad} onValidationChange={handleValidationChange} />
        {moleculeInfo && (
          <ControlHint>
            <strong>{moleculeInfo.formula}</strong>, {moleculeInfo.numAtoms} atoms
          </ControlHint>
        )}
      </ControlGroup>

      {currentXYZData && (
        <ControlGroup label="Calculation">
          <CalculationSettings settings={settings} updateSettings={updateSettings} />
          <VizButton variant="primary" block onClick={handleRunCalculation} disabled={isCalculating || !isXYZValid}>
            {isCalculating ? 'Calculating…' : 'Run calculation'}
          </VizButton>
          {isCalculating && (
            <VizButton variant="danger" block onClick={cancelCalculation}>
              Cancel
            </VizButton>
          )}
          {isWorking && (
            <span className={styles.workingIndicator}>
              {isCubeComputing ? 'Computing cube…' : 'Running SCF…'}
            </span>
          )}
        </ControlGroup>
      )}
    </VizPanel>
  );

  return (
    <>
      {savedSession && !results && (
        <div className={styles.resumeBanner}>
          <p>
            Previous session: <strong>{savedSession.formula || 'molecule'}</strong> ({savedSession.method}/{savedSession.basis},
            E = {savedSession.results.energy.toFixed(6)} Ha
            {savedSession.results.optimization ? ', optimised' : ''}
            {savedSession.results.frequencies ? `, ${savedSession.results.frequencies.frequencies.length} modes` : ''}
            ).
          </p>
          <VizButton size="sm" variant="primary" onClick={handleResumeSession}>Resume</VizButton>
          <VizButton size="sm" variant="ghost" onClick={dismissSavedSession}>Dismiss</VizButton>
        </div>
      )}

      <VizWorkbench sidebarSide="left" sidebar={sidebar} className={styles.workbench}>
        <VizPanel flush className={styles.mainPanel}>
          <VizPanelSection className={styles.headerSection}>
            <VizPlotHeader title={title} readout={readout} />
          </VizPanelSection>

          {currentXYZData && (
            <div className={styles.tabs} role="tablist">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={clsx(styles.tab, activeTab === tab.id && styles.tabActive)}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div className={clsx(styles.tabContent, (activeTab === 'structure' || activeTab === 'output') && styles.tabContentFlush)}>
            {activeTab === 'output' && <LogOutput logs={logs} />}
            {activeTab === 'results' && <ResultsDisplay results={results} />}
            {activeTab === 'structure' && (
              currentXYZData ? (
                <MoleculeViewer
                  xyzData={getStructureXYZ()}
                  moleculeName={`${moleculeInfo?.name || 'Molecule'}${results?.optimization ? ' (Optimized)' : ''}`}
                  wavefunctionResults={results}
                  cubeResults={cubeResults}
                  cubeGridInfo={cubeGridInfo}
                  cubeSettings={cubeSettings}
                  onRequestCubeComputation={handleRequestCubeComputation}
                  onOpenCubeSettings={() => setShowCubeSettings(true)}
                />
              ) : (
                <div className={styles.empty}>
                  <p>Choose an example, search PubChem or paste XYZ coordinates to see the structure.</p>
                </div>
              )
            )}
            {activeTab === 'properties' && !results && (
              <div className={styles.empty}>
                <p>Run a calculation to see orbital energies and matrices.</p>
              </div>
            )}
            {activeTab === 'properties' && results && (
              <div className={styles.stack}>
                {results.orbitalEnergies && results.orbitalOccupations && (() => {
                  const orbitals = getOrbitalList(results.orbitalEnergies!, results.orbitalOccupations!);
                  const isUnrestr = isUnrestrictedOrbitals(results.orbitalEnergies!);
                  const alphaOrbitals = orbitals.filter(o => o.spin === 'alpha');
                  const betaOrbitals = orbitals.filter(o => o.spin === 'beta');
                  const restrictedOrbitals = orbitals.filter(o => !o.spin);
                  const HA_TO_EV = 27.2114;

                  const list = (items: typeof orbitals, limit: number, key: string, noun: string) => (
                    <>
                      <div className={styles.orbitalGrid}>
                        {items.slice(0, limit).map((o) => (
                          <OrbitalItem key={`${key}-${o.index}`} orbital={{ ...o, energy: o.energy * HA_TO_EV }} />
                        ))}
                      </div>
                      {items.length > limit && (
                        <p className={styles.more}>… and {items.length - limit} more {noun}</p>
                      )}
                    </>
                  );

                  return (
                    <section>
                      <h3 className={styles.heading}>Orbital energies</h3>
                      {isUnrestr ? (
                        <>
                          <h4 className={clsx(styles.subheading, styles.alpha)}>α orbitals (↑)</h4>
                          {list(alphaOrbitals, 10, 'alpha', 'α orbitals')}
                          <h4 className={clsx(styles.subheading, styles.beta)}>β orbitals (↓)</h4>
                          {list(betaOrbitals, 10, 'beta', 'β orbitals')}
                        </>
                      ) : (
                        list(restrictedOrbitals, 20, 'mo', 'orbitals')
                      )}
                    </section>
                  );
                })()}

                {results.matrices && Object.keys(results.matrices).length > 0 ? (
                  <section>
                    {Object.entries(results.matrices).map(([name, matrix]) =>
                      matrix ? (
                        <MatrixDisplay
                          key={name}
                          matrix={matrix}
                          title={`${name.charAt(0).toUpperCase()}${name.slice(1)} matrix`}
                          precision={6}
                          maxDisplaySize={6}
                        />
                      ) : null
                    )}
                  </section>
                ) : (
                  <p className={styles.note}>
                    No matrix data available. Matrices are generated during SCF calculations and may depend on the
                    method and settings.
                  </p>
                )}
              </div>
            )}

            {activeTab === 'optimization' && results?.optimization && (
              <div className={styles.stack}>
                <dl className={styles.summaryGrid}>
                  <div>
                    <dt>Converged</dt>
                    <dd className={results.optimization.trajectory.converged ? styles.converged : styles.notConverged}>
                      {results.optimization.trajectory.converged ? 'Yes' : 'No'}
                    </dd>
                  </div>
                  <div>
                    <dt>Steps</dt>
                    <dd>{results.optimization.steps}</dd>
                  </div>
                  <div>
                    <dt>Final energy</dt>
                    <dd>{results.energy.toFixed(8)} Ha</dd>
                  </div>
                  <div>
                    <dt>Final energy</dt>
                    <dd>{results.energyInEV.toFixed(4)} eV</dd>
                  </div>
                </dl>

                <div className={styles.optimizationLayout}>
                  <div className={styles.trajectoryViewer}>
                    <TrajectoryViewer
                      trajectoryData={getCurrentTrajectoryData()}
                      moleculeName={getCurrentTrajectoryName()}
                      autoPlay={trajectoryMode === 'normal_mode'}
                      initialSpeed={trajectoryMode === 'normal_mode' ? 60 : 20}
                    />
                  </div>

                  <div className={styles.trajectoryControls}>
                    <VizButton
                      block
                      variant={trajectoryMode === 'optimization' ? 'primary' : 'secondary'}
                      onClick={() => {
                        setTrajectoryMode('optimization');
                        setSelectedNormalMode(null);
                      }}
                    >
                      Optimisation path
                    </VizButton>

                    {results.frequencies && results.frequencies.frequencies.length > 0 && (
                      <>
                        <h4 className={styles.subheading}>Normal modes</h4>
                        <ToggleSwitch
                          label="Hide modes below 50 cm⁻¹"
                          checked={hideLowModes}
                          onChange={(checked) => {
                            setHideLowModes(checked);
                            // Reset selection if the selected mode is being hidden
                            const f = selectedNormalMode !== null ? results.frequencies.frequencies[selectedNormalMode] : undefined;
                            if (checked && f !== undefined && Math.abs(f) < 50) {
                              setSelectedNormalMode(null);
                              setTrajectoryMode('optimization');
                            }
                          }}
                        />
                        <div className={styles.modesList}>
                          {getFilteredFrequencies().map(({ freq, index }) => {
                            const isSelected = trajectoryMode === 'normal_mode' && selectedNormalMode === index;
                            return (
                              <button
                                key={index}
                                type="button"
                                className={clsx(styles.modeItem, isSelected && styles.modeSelected)}
                                onClick={() => {
                                  setTrajectoryMode('normal_mode');
                                  setSelectedNormalMode(index);
                                }}
                                title={`Animate mode ${index + 1}`}
                              >
                                <span className={styles.modeNumber}>Mode {index + 1}</span>
                                <span className={styles.modeValue}>
                                  {freq < 0 ? `${Math.abs(freq).toFixed(1)}i` : freq.toFixed(1)} cm⁻¹
                                </span>
                                {freq < 0 && <span className={styles.imaginaryBadge}>imaginary</span>}
                              </button>
                            );
                          })}
                        </div>
                        <ControlHint>
                          Showing {getFilteredFrequencies().length} of {results.frequencies.frequencies.length} modes
                        </ControlHint>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className={styles.settingsGrid}>
                <ControlGroup label="Electronic state">
                  <SliderWithInput
                    label="Charge"
                    value={settings.charge}
                    onChange={(v) => updateSettings({ charge: Math.round(v) })}
                    min={-5} max={5} step={1} decimals={0}
                  />
                  <SliderWithInput
                    label="Multiplicity"
                    value={settings.multiplicity}
                    onChange={(v) => updateSettings({ multiplicity: Math.round(v) })}
                    min={1} max={7} step={1} decimals={0}
                  />
                  <ControlHint>2S + 1: 1 = singlet, 2 = doublet, 3 = triplet.</ControlHint>
                </ControlGroup>
                <ControlGroup label="SCF">
                  <SliderWithInput
                    label="Max iterations"
                    value={settings.maxIterations}
                    onChange={(v) => updateSettings({ maxIterations: Math.round(v) })}
                    min={10} max={500} step={10} decimals={0}
                  />
                  <Select
                    label="Energy tolerance"
                    value={TOLERANCES.find((o) => parseFloat(o.value) === settings.energyTolerance)?.value ?? '1e-8'}
                    onChange={(v) => updateSettings({ energyTolerance: parseFloat(v) })}
                    options={TOLERANCES}
                  />
                </ControlGroup>
                <ControlGroup label="Runtime">
                  <SliderWithInput
                    label="Threads"
                    value={settings.threads}
                    onChange={(v) => updateSettings({ threads: Math.round(v) })}
                    min={1} max={16} step={1} decimals={0}
                  />
                  <Select
                    label="Log level"
                    value={String(settings.logLevel)}
                    onChange={(v) => updateSettings({ logLevel: parseInt(v) })}
                    options={LOG_LEVELS}
                  />
                </ControlGroup>
                <ControlGroup label="Defaults">
                  <Select
                    label="Default basis set"
                    value={settings.basisSet}
                    onChange={(v) => {
                      updateSettings({ basisSet: v });
                      try { localStorage.setItem('wfn-calc-default-basis', v); } catch {}
                    }}
                    options={BASIS_SETS}
                  />
                  <ControlHint>Also used as the default for future sessions.</ControlHint>
                </ControlGroup>
              </div>
            )}

            {activeTab === 'about' && (
              <div className={clsx('markdown', styles.prose)}>
                <h3>About this calculator</h3>
                <p>
                  This wavefunction calculator runs <strong>entirely in your web browser</strong> using
                  WebAssembly. Your molecular data never leaves your computer &mdash; there is no server
                  involved. All quantum-chemical calculations (SCF, geometry optimisation, frequency
                  analysis, cube generation) are performed locally on your machine using the OCC library
                  compiled to WASM.
                </p>

                <h3>Version</h3>
                <EngineInfo />

                <h3>Privacy</h3>
                <p>
                  No molecular structures, calculation inputs, or results are transmitted over the
                  network. The only external request made is when you use the PubChem search to fetch
                  a structure by name &mdash; that query goes directly to the
                  NIH&rsquo;s <a href="https://pubchem.ncbi.nlm.nih.gov/" target="_blank" rel="noopener noreferrer">PubChem</a> public
                  API. Everything else stays on your device.
                </p>

                <h3>Powered by OCC</h3>
                <p>
                  The computational engine is <a href="https://github.com/peterspackman/occ" target="_blank" rel="noopener noreferrer">OCC
                  (Open Computational Chemistry)</a>, an open-source quantum chemistry library.
                  If you use this tool in your work, please cite:
                </p>
                <blockquote>
                  Spackman, P. R. (2026). Open Computational Chemistry (OCC) &ndash; A portable
                  software library and program for quantum chemistry and crystallography.
                  <em> Journal of Open Source Software</em>, 11(117), 9609.{' '}
                  <a href="https://doi.org/10.21105/joss.09609" target="_blank" rel="noopener noreferrer">
                    doi:10.21105/joss.09609
                  </a>
                </blockquote>

                <h3>Capabilities</h3>
                <ul>
                  <li><strong>Methods:</strong> {METHODS.map((m) => m.label).join(', ')}</li>
                  <li><strong>Basis sets:</strong> {BASIS_SETS.map((b) => b.label).join(', ')}</li>
                  <li><strong>Geometry optimisation</strong> with trajectory visualisation</li>
                  <li><strong>Harmonic frequency analysis</strong> with animated normal modes</li>
                  <li><strong>Volumetric data:</strong> electron density, electrostatic potential, and molecular orbital isosurfaces</li>
                  <li><strong>Matrix export:</strong> overlap, kinetic, nuclear attraction, Fock, density, and MO coefficients</li>
                </ul>
              </div>
            )}
          </div>
        </VizPanel>
      </VizWorkbench>

      {error && !validationError && (
        <div className={styles.errorModal} role="alertdialog" aria-labelledby="wfn-error-title">
          <div className={styles.errorContent}>
            <h3 id="wfn-error-title">Error</h3>
            <p>{error}</p>
            <VizButton onClick={() => setError('')}>Close</VizButton>
          </div>
        </div>
      )}

      <CubeSettings
        settings={cubeSettings}
        updateSettings={updateCubeSettings}
        show={showCubeSettings}
        onClose={() => setShowCubeSettings(false)}
      />
    </>
  );
};

export default WavefunctionCalculator;
