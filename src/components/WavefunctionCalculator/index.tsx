import React, { useState, useEffect } from 'react';
import styles from './WavefunctionCalculator.module.css';
import FileUploader from './FileUploader';
import CalculationSettings from './CalculationSettings';
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

const WavefunctionCalculator: React.FC = () => {
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
  const [activeTab, setActiveTab] = useState<'output' | 'results' | 'structure' | 'properties' | 'optimization' | 'settings' | 'about'>('structure');
  const [validationError, setValidationError] = useState<string>('');
  const [isXYZValid, setIsXYZValid] = useState<boolean>(true);

  // Collapsible sections
  const [isInputExpanded, setIsInputExpanded] = useState(true);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(true);

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
  const [isTrajectoryControlsExpanded, setIsTrajectoryControlsExpanded] = useState<boolean>(true);


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

    // Restore full calculation results
    restoreSession(savedSession.results);
    setActiveTab('results');
    setSavedSession(null);
  };

  const dismissSavedSession = () => {
    setSavedSession(null);
    try { localStorage.removeItem('wfn-calc-session'); } catch {}
  };

  return (
    <div className={styles.container}>
      {savedSession && !results && (
        <div className={styles.resumeBanner}>
          <p>
            Previous session found: <strong>{savedSession.formula || 'molecule'}</strong> ({savedSession.method}/{savedSession.basis},
            E = {savedSession.results.energy.toFixed(6)} Ha
            {savedSession.results.optimization ? ', optimised' : ''}
            {savedSession.results.frequencies ? `, ${savedSession.results.frequencies.frequencies.length} modes` : ''}
            ). Resume?
          </p>
          <button className={styles.resumeButton} onClick={handleResumeSession}>Resume</button>
          <button className={styles.dismissButton} onClick={dismissSavedSession}>Dismiss</button>
        </div>
      )}
      <div className={styles.layout}>
        <div className={styles.sidebar}>
          <div className={`${styles.status} ${styles.statusReady}`}>
            ✓ Ready
          </div>

          <div className={styles.scrollableContent}>
            <div className={styles.collapsibleSection}>
            <button 
              className={styles.sectionHeader}
              onClick={() => setIsInputExpanded(!isInputExpanded)}
            >
              <span className={styles.sectionTitle}>Molecule Input</span>
              <span className={`${styles.chevron} ${isInputExpanded ? styles.chevronExpanded : ''}`}>
                ▼
              </span>
            </button>
            {isInputExpanded && (
              <div className={styles.sectionContent}>
                <FileUploader 
              onFileLoad={handleFileLoad} 
              onValidationChange={handleValidationChange}
            />
                {moleculeInfo && (
                  <div className={styles.moleculeInfo}>
                    <div><strong>{moleculeInfo.formula}</strong> ({moleculeInfo.numAtoms} atoms)</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {currentXYZData && (
            <div className={styles.collapsibleSection}>
              <button 
                className={styles.sectionHeader}
                onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
              >
                <span className={styles.sectionTitle}>Calculation Settings</span>
                <span className={`${styles.chevron} ${isSettingsExpanded ? styles.chevronExpanded : ''}`}>
                  ▼
                </span>
              </button>
              {isSettingsExpanded && (
                <div className={styles.sectionContent}>
                  <CalculationSettings
                    settings={settings}
                    updateSettings={updateSettings}
                  />
                </div>
              )}
            </div>
          )}
          </div>

          {currentXYZData && (
            <div className={styles.stickyButtons}>
              <button
                className={`${styles.button} ${styles.buttonPrimary}`}
                onClick={handleRunCalculation}
                disabled={isCalculating || !isXYZValid}
              >
                {isCalculating ? 'Calculating...' : 'Run Calculation'}
              </button>
              {isCalculating && (
                <button
                  className={`${styles.button} ${styles.buttonDanger}`}
                  onClick={cancelCalculation}
                >
                  Cancel
                </button>
              )}
              {isWorking && (
                <span className={styles.workingIndicator}>
                  {isCubeComputing ? 'Computing cube...' : 'Running SCF...'}
                </span>
              )}
            </div>
          )}
        </div>

        <div className={styles.content}>
          {currentXYZData && (
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${activeTab === 'output' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('output')}
              >
                Output
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'results' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('results')}
              >
                Results
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'structure' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('structure')}
              >
                Structure
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'properties' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('properties')}
              >
                Properties
              </button>
              {results?.optimization && (
                <button
                  className={`${styles.tab} ${activeTab === 'optimization' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('optimization')}
                >
                  Optimization
                </button>
              )}
              <button
                className={`${styles.tab} ${activeTab === 'settings' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                Settings
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'about' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('about')}
              >
                About
              </button>
            </div>
          )}

          <div className={styles.tabContent}>
            {activeTab === 'output' && <LogOutput logs={logs} />}
            {activeTab === 'results' && <ResultsDisplay results={results} />}
            {activeTab === 'structure' && (
              <div className={styles.structureTab}>
                {currentXYZData ? (
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
                  <div className={styles.noStructure}>
                    <h3>No Structure Loaded</h3>
                    <p>Load a molecule to see its 3D structure visualization.</p>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'properties' && results && (
              <div className={styles.propertiesTab}>
                {results.orbitalEnergies && results.orbitalOccupations && (() => {
                    const orbitals = getOrbitalList(results.orbitalEnergies!, results.orbitalOccupations!);
                    const isUnrestr = isUnrestrictedOrbitals(results.orbitalEnergies!);
                    const alphaOrbitals = orbitals.filter(o => o.spin === 'alpha');
                    const betaOrbitals = orbitals.filter(o => o.spin === 'beta');
                    const restrictedOrbitals = orbitals.filter(o => !o.spin);
                    const HA_TO_EV = 27.2114;

                    return (
                  <div className={styles.orbitalsCard}>
                    <h4>Orbital Energies</h4>

                    {isUnrestr ? (
                      <>
                        <h5 style={{ marginTop: '1rem', color: '#3b82f6' }}>Alpha Orbitals (↑)</h5>
                        <div className={styles.orbitalGrid}>
                          {alphaOrbitals.slice(0, 10).map((o) => (
                            <OrbitalItem key={`alpha-${o.index}`} orbital={{ ...o, energy: o.energy * HA_TO_EV }} />
                          ))}
                        </div>
                        {alphaOrbitals.length > 10 && (
                          <div className={styles.moreOrbitals}>... and {alphaOrbitals.length - 10} more alpha orbitals</div>
                        )}

                        <h5 style={{ marginTop: '1.5rem', color: '#f97316' }}>Beta Orbitals (↓)</h5>
                        <div className={styles.orbitalGrid}>
                          {betaOrbitals.slice(0, 10).map((o) => (
                            <OrbitalItem key={`beta-${o.index}`} orbital={{ ...o, energy: o.energy * HA_TO_EV }} />
                          ))}
                        </div>
                        {betaOrbitals.length > 10 && (
                          <div className={styles.moreOrbitals}>... and {betaOrbitals.length - 10} more beta orbitals</div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className={styles.orbitalGrid}>
                          {restrictedOrbitals.slice(0, 20).map((o) => (
                            <OrbitalItem key={o.index} orbital={{ ...o, energy: o.energy * HA_TO_EV }} />
                          ))}
                        </div>
                        {restrictedOrbitals.length > 20 && (
                          <div className={styles.moreOrbitals}>... and {restrictedOrbitals.length - 20} more orbitals</div>
                        )}
                      </>
                    )}
                  </div>
                    );
                })()}

                {results.matrices && Object.keys(results.matrices).length > 0 ? (
                  <div className={styles.matricesSection}>
                    {Object.entries(results.matrices).map(([name, matrix]) => 
                      matrix ? (
                        <MatrixDisplay
                          key={name}
                          matrix={matrix}
                          title={`${name.charAt(0).toUpperCase()}${name.slice(1)} Matrix`}
                          precision={6}
                          maxDisplaySize={6}
                        />
                      ) : null
                    )}
                  </div>
                ) : (
                  <div className={styles.noMatrices}>
                    <p>No matrix data available. Matrices are generated during SCF calculations and may depend on the calculation method and settings.</p>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'optimization' && results?.optimization && (
              <div className={styles.optimizationTab}>
                <div className={styles.optimizationHeader}>
                  <div className={styles.optimizationSummary}>
                    <h4>Optimization Summary</h4>
                    <div className={styles.summaryGrid}>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Converged:</span>
                        <span className={`${styles.summaryValue} ${results.optimization.trajectory.converged ? styles.converged : styles.notConverged}`}>
                          {results.optimization.trajectory.converged ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Steps:</span>
                        <span className={styles.summaryValue}>{results.optimization.steps}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Final Energy:</span>
                        <span className={styles.summaryValue}>{results.energy.toFixed(8)} Ha</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Final Energy:</span>
                        <span className={styles.summaryValue}>{results.energyInEV.toFixed(4)} eV</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.optimizationLayout}>
                  {/* Left side - Trajectory Viewer */}
                  <div className={styles.trajectoryViewerSection}>
                    <div className={styles.trajectoryViewerContainer}>
                      <TrajectoryViewer
                        trajectoryData={getCurrentTrajectoryData()}
                        moleculeName={getCurrentTrajectoryName()}
                        autoPlay={trajectoryMode === 'normal_mode'}
                        initialSpeed={trajectoryMode === 'normal_mode' ? 60 : 20}
                      />
                    </div>
                  </div>

                  {/* Right side - Controls */}
                  <div className={styles.trajectoryControlsPanel}>
                    <div className={styles.trajectoryControlsHeader}>
                      <h4>Trajectory Controls</h4>
                    </div>

                    {/* Mode Selection */}
                    <div className={styles.trajectoryModeSection}>
                      <button
                        onClick={() => {
                          setTrajectoryMode('optimization');
                          setSelectedNormalMode(null);
                        }}
                        className={`${styles.modeButton} ${trajectoryMode === 'optimization' ? styles.active : ''}`}
                      >
                        Optimization Path
                      </button>
                    </div>

                    {/* Frequencies Section */}
                    {results.frequencies && results.frequencies.frequencies.length > 0 && (
                      <div className={styles.frequenciesControlSection}>
                        <div className={styles.frequenciesSectionHeader}>
                          <h5>Normal Modes</h5>
                          <div className={styles.frequencySettings}>
                            <label className={styles.checkboxLabel}>
                              <input
                                type="checkbox"
                                checked={hideLowModes}
                                onChange={(e) => {
                                  setHideLowModes(e.target.checked);
                                  // Reset selection if currently selected mode is being hidden
                                  if (e.target.checked && selectedNormalMode !== null && results.frequencies.frequencies[selectedNormalMode] && Math.abs(results.frequencies.frequencies[selectedNormalMode]) < 50) {
                                    setSelectedNormalMode(null);
                                    setTrajectoryMode('optimization');
                                  }
                                }}
                                className={styles.checkbox}
                              />
                              Hide low modes (&lt; 50 cm⁻¹)
                            </label>
                          </div>
                        </div>
                        
                        <div className={styles.modesList}>
                          {getFilteredFrequencies().map(({ freq, index }) => {
                            const isSelected = trajectoryMode === 'normal_mode' && selectedNormalMode === index;
                            return (
                              <div 
                                key={index} 
                                className={`${styles.modeItem} ${isSelected ? styles.modeSelected : ''}`}
                                onClick={() => {
                                  setTrajectoryMode('normal_mode');
                                  setSelectedNormalMode(index);
                                }}
                                style={{ cursor: 'pointer' }}
                                title={`Click to visualize mode ${index + 1}`}
                              >
                                <div className={styles.modeInfo}>
                                  <div className={styles.modeNumber}>Mode {index + 1}</div>
                                  <div className={styles.modeValue}>
                                    {freq < 0 ? `${Math.abs(freq).toFixed(1)}i` : freq.toFixed(1)} cm⁻¹
                                  </div>
                                  {freq < 0 && <div className={styles.imaginaryBadge}>imag</div>}
                                </div>
                                {isSelected && (
                                  <div className={styles.modeSelectedIndicator}>
                                    ▶ Playing
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        
                        <div className={styles.frequencySummary}>
                          Showing {getFilteredFrequencies().length} of {results.frequencies.frequencies.length} modes
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'settings' && (
              <div className={styles.settingsTab}>
                <div className={styles.aboutSection}>
                  <h3>Calculation Parameters</h3>
                  <div className={styles.settingsGrid}>
                    <div className={styles.settingsField}>
                      <label>Charge</label>
                      <input type="number" min="-5" max="5" step="1" value={settings.charge}
                        onChange={(e) => updateSettings({ charge: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div className={styles.settingsField}>
                      <label>Multiplicity</label>
                      <input type="number" min="1" max="7" step="1" value={settings.multiplicity}
                        onChange={(e) => updateSettings({ multiplicity: parseInt(e.target.value) || 1 })} />
                      <small>2S+1: 1=singlet, 2=doublet, 3=triplet</small>
                    </div>
                    <div className={styles.settingsField}>
                      <label>SCF Max Iterations</label>
                      <input type="number" min="10" max="500" value={settings.maxIterations}
                        onChange={(e) => updateSettings({ maxIterations: parseInt(e.target.value) })} />
                    </div>
                    <div className={styles.settingsField}>
                      <label>Energy Tolerance</label>
                      <select value={settings.energyTolerance.toString()}
                        onChange={(e) => updateSettings({ energyTolerance: parseFloat(e.target.value) })}>
                        <option value="1e-6">1e-6</option>
                        <option value="1e-7">1e-7</option>
                        <option value="1e-8">1e-8</option>
                        <option value="1e-9">1e-9</option>
                        <option value="1e-10">1e-10</option>
                      </select>
                    </div>
                    <div className={styles.settingsField}>
                      <label>Threads</label>
                      <input type="number" min="1" max="16" value={settings.threads}
                        onChange={(e) => updateSettings({ threads: parseInt(e.target.value) || 1 })} />
                    </div>
                    <div className={styles.settingsField}>
                      <label>Log Level</label>
                      <select value={settings.logLevel} onChange={(e) => updateSettings({ logLevel: parseInt(e.target.value) })}>
                        <option value="0">Trace</option>
                        <option value="1">Debug</option>
                        <option value="2">Info</option>
                        <option value="3">Warning</option>
                        <option value="4">Error</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className={styles.aboutSection}>
                  <h3>Defaults</h3>
                  <div className={styles.settingsGrid}>
                    <div className={styles.settingsField}>
                      <label>Default Basis Set</label>
                      <select value={settings.basisSet}
                        onChange={(e) => {
                          updateSettings({ basisSet: e.target.value });
                          try { localStorage.setItem('wfn-calc-default-basis', e.target.value); } catch {}
                        }}>
                        <option value="sto-3g">STO-3G</option>
                        <option value="3-21g">3-21G</option>
                        <option value="6-31g">6-31G</option>
                        <option value="6-31g(d,p)">6-31G(d,p)</option>
                        <option value="def2-svp">def2-SVP</option>
                        <option value="def2-tzvp">def2-TZVP</option>
                        <option value="cc-pvdz">cc-pVDZ</option>
                      </select>
                      <small>Changing here also sets it as the default for future sessions</small>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'about' && (
              <div className={styles.aboutTab}>
                <div className={styles.aboutSection}>
                  <h3>About this calculator</h3>
                  <p>
                    This wavefunction calculator runs <strong>entirely in your web browser</strong> using
                    WebAssembly. Your molecular data never leaves your computer &mdash; there is no server
                    involved. All quantum-chemical calculations (SCF, geometry optimisation, frequency
                    analysis, cube generation) are performed locally on your machine using the OCC library
                    compiled to WASM.
                  </p>
                </div>

                <div className={styles.aboutSection}>
                  <h3>Privacy</h3>
                  <p>
                    No molecular structures, calculation inputs, or results are transmitted over the
                    network. The only external request made is when you use the PubChem search to fetch
                    a structure by name &mdash; that query goes directly to the
                    NIH&rsquo;s <a href="https://pubchem.ncbi.nlm.nih.gov/" target="_blank" rel="noopener noreferrer">PubChem</a> public
                    API. Everything else stays on your device.
                  </p>
                </div>

                <div className={styles.aboutSection}>
                  <h3>Powered by OCC</h3>
                  <p>
                    The computational engine is <a href="https://github.com/peterspackman/occ" target="_blank" rel="noopener noreferrer">OCC
                    (Open Computational Chemistry)</a>, an open-source quantum chemistry library.
                    If you use this tool in your work, please cite:
                  </p>
                  <blockquote className={styles.citation}>
                    Spackman, P. R. (2026). Open Computational Chemistry (OCC) &ndash; A portable
                    software library and program for quantum chemistry and crystallography.
                    <em> Journal of Open Source Software</em>, 11(117), 9609.
                    <a href="https://doi.org/10.21105/joss.09609" target="_blank" rel="noopener noreferrer" style={{ marginLeft: '0.3em' }}>
                      doi:10.21105/joss.09609
                    </a>
                  </blockquote>
                </div>

                <div className={styles.aboutSection}>
                  <h3>Capabilities</h3>
                  <ul>
                    <li><strong>Methods:</strong> Hartree-Fock, B3LYP, PBE, PBE0, BLYP, wB97X</li>
                    <li><strong>Basis sets:</strong> STO-3G, 3-21G, 6-31G, 6-31G(d,p), def2-SVP, def2-TZVP, cc-pVDZ</li>
                    <li><strong>Geometry optimisation</strong> with trajectory visualisation</li>
                    <li><strong>Harmonic frequency analysis</strong> with animated normal modes</li>
                    <li><strong>Volumetric data:</strong> electron density, electrostatic potential, and molecular orbital isosurfaces</li>
                    <li><strong>Matrix export:</strong> overlap, kinetic, nuclear attraction, Fock, density, and MO coefficients</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && !validationError && (
        <div className={styles.errorModal}>
          <div className={styles.errorContent}>
            <h3>Error</h3>
            <p>{error}</p>
            <button onClick={() => setError('')}>Close</button>
          </div>
        </div>
      )}

      <CubeSettings
        settings={cubeSettings}
        updateSettings={updateCubeSettings}
        show={showCubeSettings}
        onClose={() => setShowCubeSettings(false)}
      />
    </div>
  );
};

export default WavefunctionCalculator;