import React from 'react';
import {
    SliderWithInput,
    CollapsibleSection,
    ToggleSwitch,
    type ControlTheme,
} from '../shared/controls';
import type { CrystalStructure } from './physics';
import { CU_K_ALPHA, MO_K_ALPHA } from './physics';
import { STRUCTURE_LIST } from './structures';
import { FormFactorEditor } from './FormFactorEditor';

interface ControlPoint {
    s: number;
    f: number;
}

export interface DiffractionControlsProps {
    // Structure
    structureId: string;
    onStructureChange: (id: string) => void;
    structure: CrystalStructure;

    // X-ray parameters
    wavelength: number;
    onWavelengthChange: (lambda: number) => void;
    twoThetaMax: number;
    onTwoThetaMaxChange: (max: number) => void;

    // Powder pattern
    peakWidth: number;
    onPeakWidthChange: (width: number) => void;
    showPeakLabels: boolean;
    onShowPeakLabelsChange: (show: boolean) => void;

    // Reciprocal space
    reciprocalPlane: 'hk0' | 'h0l' | '0kl';
    onReciprocalPlaneChange: (plane: 'hk0' | 'h0l' | '0kl') => void;
    maxIndex: number;
    onMaxIndexChange: (max: number) => void;
    showAbsences: boolean;
    onShowAbsencesChange: (show: boolean) => void;
    reciprocalView: 'lattice' | 'detector' | 'pxrd';
    oscillationRange: number;
    onOscillationRangeChange: (range: number) => void;
    detectorDistance: number;
    onDetectorDistanceChange: (dist: number) => void;

    // Electron density (2D slice)
    slicePosition: number;
    onSlicePositionChange: (pos: number) => void;
    sliceAxis: 'x' | 'y' | 'z';
    onSliceAxisChange: (axis: 'x' | 'y' | 'z') => void;
    densityResolution: number;
    onDensityResolutionChange: (res: number) => void;
    showContours: boolean;
    onShowContoursChange: (show: boolean) => void;
    noise: number;
    onNoiseChange: (noise: number) => void;
    bFactor: number;
    onBFactorChange: (b: number) => void;

    // Unit cell
    showBonds: boolean;
    onShowBondsChange: (show: boolean) => void;
    showLabels: boolean;
    onShowLabelsChange: (show: boolean) => void;
    supercell: [number, number, number];
    onSupercellChange: (supercell: [number, number, number]) => void;

    // Custom form factors
    formFactors: Record<string, ControlPoint[]>;
    onFormFactorsChange: (formFactors: Record<string, ControlPoint[]>) => void;

    // Theme
    theme: ControlTheme;
}

export const DiffractionControls: React.FC<DiffractionControlsProps> = ({
    structureId,
    onStructureChange,
    structure,
    wavelength,
    onWavelengthChange,
    twoThetaMax,
    onTwoThetaMaxChange,
    peakWidth,
    onPeakWidthChange,
    showPeakLabels,
    onShowPeakLabelsChange,
    reciprocalPlane,
    onReciprocalPlaneChange,
    maxIndex,
    onMaxIndexChange,
    showAbsences,
    onShowAbsencesChange,
    reciprocalView,
    oscillationRange,
    onOscillationRangeChange,
    detectorDistance,
    onDetectorDistanceChange,
    slicePosition,
    onSlicePositionChange,
    sliceAxis,
    onSliceAxisChange,
    densityResolution,
    onDensityResolutionChange,
    showContours,
    onShowContoursChange,
    noise,
    onNoiseChange,
    bFactor,
    onBFactorChange,
    showBonds,
    onShowBondsChange,
    showLabels,
    onShowLabelsChange,
    supercell,
    onSupercellChange,
    formFactors,
    onFormFactorsChange,
    theme,
}) => {
    return (
        <div
            style={{
                backgroundColor: theme.surface || theme.inputBg,
                padding: '1rem',
                borderRadius: '8px',
                border: `1px solid ${theme.border}`,
                color: theme.text,
            }}
        >
            {/* Crystal Structure */}
            <CollapsibleSection
                title="Crystal Structure"
                defaultExpanded={true}
                theme={theme}
            >
                <div style={{ marginBottom: '0.5rem' }}>
                    <label
                        style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            color: theme.textMuted,
                            marginBottom: '0.25rem',
                        }}
                    >
                        Structure
                    </label>
                    <select
                        value={structureId}
                        onChange={(e) => onStructureChange(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.4rem',
                            fontSize: '0.8rem',
                            border: `1px solid ${theme.border}`,
                            borderRadius: '4px',
                            backgroundColor: theme.inputBg,
                            color: theme.text,
                            cursor: 'pointer',
                        }}
                    >
                        {STRUCTURE_LIST.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div
                    style={{
                        fontSize: '0.7rem',
                        color: theme.textMuted,
                        marginTop: '0.5rem',
                    }}
                >
                    <div>Space group: {structure.spaceGroup}</div>
                    <div>a = {structure.a.toFixed(3)} Å</div>
                    <div>Atoms: {structure.atoms.length}</div>
                </div>
            </CollapsibleSection>

            {/* X-ray Parameters */}
            <CollapsibleSection
                title="X-ray Source"
                defaultExpanded={true}
                theme={theme}
            >
                <SliderWithInput
                    label="Wavelength (λ)"
                    value={wavelength}
                    onChange={onWavelengthChange}
                    min={0.5}
                    max={2.5}
                    step={0.001}
                    decimals={4}
                    unit="Å"
                    theme={theme}
                />
                <div
                    style={{
                        display: 'flex',
                        gap: '0.4rem',
                        marginBottom: '0.5rem',
                    }}
                >
                    <button
                        onClick={() => onWavelengthChange(CU_K_ALPHA)}
                        style={{
                            flex: 1,
                            padding: '0.25rem',
                            fontSize: '0.65rem',
                            border: `1px solid ${theme.border}`,
                            borderRadius: '4px',
                            backgroundColor:
                                Math.abs(wavelength - CU_K_ALPHA) < 0.001
                                    ? theme.accent || '#2563eb'
                                    : theme.inputBg,
                            color:
                                Math.abs(wavelength - CU_K_ALPHA) < 0.001
                                    ? '#fff'
                                    : theme.text,
                            cursor: 'pointer',
                        }}
                    >
                        Cu Kα
                    </button>
                    <button
                        onClick={() => onWavelengthChange(MO_K_ALPHA)}
                        style={{
                            flex: 1,
                            padding: '0.25rem',
                            fontSize: '0.65rem',
                            border: `1px solid ${theme.border}`,
                            borderRadius: '4px',
                            backgroundColor:
                                Math.abs(wavelength - MO_K_ALPHA) < 0.001
                                    ? theme.accent || '#2563eb'
                                    : theme.inputBg,
                            color:
                                Math.abs(wavelength - MO_K_ALPHA) < 0.001
                                    ? '#fff'
                                    : theme.text,
                            cursor: 'pointer',
                        }}
                    >
                        Mo Kα
                    </button>
                </div>
                <SliderWithInput
                    label="2θ max"
                    value={twoThetaMax}
                    onChange={onTwoThetaMaxChange}
                    min={30}
                    max={180}
                    step={5}
                    decimals={0}
                    unit="°"
                    theme={theme}
                />
            </CollapsibleSection>

            {/* Atomic Form Factors */}
            <CollapsibleSection
                title="Atomic Form Factors"
                defaultExpanded={false}
                theme={theme}
            >
                <FormFactorEditor
                    width={220}
                    height={160}
                    elements={structure.atoms.map(a => a.element)}
                    theme={theme}
                    formFactors={formFactors}
                    onFormFactorsChange={onFormFactorsChange}
                />
                <div
                    style={{
                        marginTop: '0.5rem',
                        padding: '0.4rem',
                        backgroundColor: theme.inputBg,
                        borderRadius: '4px',
                        fontSize: '0.65rem',
                        color: theme.textMuted,
                    }}
                >
                    <div style={{ fontWeight: 'bold', marginBottom: '0.2rem', color: theme.text }}>
                        f(s) = atomic scattering factor
                    </div>
                    <div>Drag points to customize. Click element to select.</div>
                </div>
            </CollapsibleSection>

            {/* Powder Pattern */}
            <CollapsibleSection
                title="Powder Pattern"
                defaultExpanded={false}
                theme={theme}
            >
                <SliderWithInput
                    label="Peak width"
                    value={peakWidth}
                    onChange={onPeakWidthChange}
                    min={0.1}
                    max={3}
                    step={0.1}
                    decimals={1}
                    unit="°"
                    theme={theme}
                />
                <ToggleSwitch
                    label="Show (hkl) labels"
                    checked={showPeakLabels}
                    onChange={onShowPeakLabelsChange}
                    theme={theme}
                />
            </CollapsibleSection>

            {/* Reciprocal Space */}
            <CollapsibleSection
                title="Reciprocal Space"
                defaultExpanded={false}
                theme={theme}
            >
                <div style={{ marginBottom: '0.5rem' }}>
                    <label
                        style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            color: theme.textMuted,
                            marginBottom: '0.25rem',
                        }}
                    >
                        Plane
                    </label>
                    <select
                        value={reciprocalPlane}
                        onChange={(e) =>
                            onReciprocalPlaneChange(
                                e.target.value as 'hk0' | 'h0l' | '0kl'
                            )
                        }
                        style={{
                            width: '100%',
                            padding: '0.4rem',
                            fontSize: '0.8rem',
                            border: `1px solid ${theme.border}`,
                            borderRadius: '4px',
                            backgroundColor: theme.inputBg,
                            color: theme.text,
                            cursor: 'pointer',
                        }}
                    >
                        <option value="hk0">hk0 (l = 0)</option>
                        <option value="h0l">h0l (k = 0)</option>
                        <option value="0kl">0kl (h = 0)</option>
                    </select>
                </div>
                <SliderWithInput
                    label="Max index"
                    value={maxIndex}
                    onChange={(v) => onMaxIndexChange(Math.round(v))}
                    min={3}
                    max={15}
                    step={1}
                    decimals={0}
                    unit=""
                    theme={theme}
                />
                {reciprocalView === 'detector' && (
                    <>
                        <SliderWithInput
                            label="Oscillation"
                            value={oscillationRange}
                            onChange={onOscillationRangeChange}
                            min={0.5}
                            max={30}
                            step={0.5}
                            decimals={1}
                            unit="°"
                            theme={theme}
                        />
                        <SliderWithInput
                            label="Detector dist."
                            value={detectorDistance}
                            onChange={onDetectorDistanceChange}
                            min={50}
                            max={300}
                            step={10}
                            decimals={0}
                            unit="mm"
                            theme={theme}
                        />
                    </>
                )}
                <ToggleSwitch
                    label="Show absences"
                    checked={showAbsences}
                    onChange={onShowAbsencesChange}
                    theme={theme}
                />
            </CollapsibleSection>

            {/* Electron Density (simplified - slice controls only) */}
            <CollapsibleSection
                title="Electron Density"
                defaultExpanded={false}
                theme={theme}
            >
                <div style={{ marginBottom: '0.5rem' }}>
                    <label
                        style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            color: theme.textMuted,
                            marginBottom: '0.25rem',
                        }}
                    >
                        Slice Axis
                    </label>
                    <div
                        style={{
                            display: 'flex',
                            gap: '0.4rem',
                        }}
                    >
                        {(['x', 'y', 'z'] as const).map((axis) => (
                            <button
                                key={axis}
                                onClick={() => onSliceAxisChange(axis)}
                                style={{
                                    flex: 1,
                                    padding: '0.25rem',
                                    fontSize: '0.65rem',
                                    border: `1px solid ${theme.border}`,
                                    borderRadius: '4px',
                                    backgroundColor:
                                        sliceAxis === axis
                                            ? theme.accent || '#2563eb'
                                            : theme.inputBg,
                                    color:
                                        sliceAxis === axis
                                            ? '#fff'
                                            : theme.text,
                                    cursor: 'pointer',
                                }}
                            >
                                {axis}
                            </button>
                        ))}
                    </div>
                </div>
                <SliderWithInput
                    label={`${sliceAxis}-slice`}
                    value={slicePosition}
                    onChange={onSlicePositionChange}
                    min={0}
                    max={1}
                    step={0.01}
                    decimals={2}
                    unit=""
                    theme={theme}
                />
                <div
                    style={{
                        display: 'flex',
                        gap: '0.4rem',
                        marginBottom: '0.5rem',
                    }}
                >
                    <button
                        onClick={() => onSlicePositionChange(0)}
                        style={{
                            flex: 1,
                            padding: '0.25rem',
                            fontSize: '0.65rem',
                            border: `1px solid ${theme.border}`,
                            borderRadius: '4px',
                            backgroundColor:
                                slicePosition === 0
                                    ? theme.accent || '#2563eb'
                                    : theme.inputBg,
                            color: slicePosition === 0 ? '#fff' : theme.text,
                            cursor: 'pointer',
                        }}
                    >
                        0
                    </button>
                    <button
                        onClick={() => onSlicePositionChange(0.25)}
                        style={{
                            flex: 1,
                            padding: '0.25rem',
                            fontSize: '0.65rem',
                            border: `1px solid ${theme.border}`,
                            borderRadius: '4px',
                            backgroundColor:
                                Math.abs(slicePosition - 0.25) < 0.01
                                    ? theme.accent || '#2563eb'
                                    : theme.inputBg,
                            color:
                                Math.abs(slicePosition - 0.25) < 0.01
                                    ? '#fff'
                                    : theme.text,
                            cursor: 'pointer',
                        }}
                    >
                        ¼
                    </button>
                    <button
                        onClick={() => onSlicePositionChange(0.5)}
                        style={{
                            flex: 1,
                            padding: '0.25rem',
                            fontSize: '0.65rem',
                            border: `1px solid ${theme.border}`,
                            borderRadius: '4px',
                            backgroundColor:
                                Math.abs(slicePosition - 0.5) < 0.01
                                    ? theme.accent || '#2563eb'
                                    : theme.inputBg,
                            color:
                                Math.abs(slicePosition - 0.5) < 0.01
                                    ? '#fff'
                                    : theme.text,
                            cursor: 'pointer',
                        }}
                    >
                        ½
                    </button>
                </div>

                <SliderWithInput
                    label="Max HKL"
                    value={densityResolution}
                    onChange={(v) => onDensityResolutionChange(Math.round(v))}
                    min={4}
                    max={16}
                    step={1}
                    decimals={0}
                    unit=""
                    theme={theme}
                />
                <SliderWithInput
                    label="Noise"
                    value={noise}
                    onChange={onNoiseChange}
                    min={0}
                    max={1}
                    step={0.05}
                    decimals={2}
                    unit=""
                    theme={theme}
                />
                <SliderWithInput
                    label="B-factor"
                    value={bFactor}
                    onChange={onBFactorChange}
                    min={0}
                    max={10}
                    step={0.5}
                    decimals={1}
                    unit="Ų"
                    theme={theme}
                />
                <div
                    style={{
                        marginTop: '0.5rem',
                        padding: '0.4rem',
                        backgroundColor: theme.inputBg,
                        borderRadius: '4px',
                        fontSize: '0.65rem',
                        color: theme.textMuted,
                    }}
                >
                    <div><strong>Noise:</strong> Adds random error to reflection intensities</div>
                    <div><strong>B-factor:</strong> Thermal motion damping (Debye-Waller)</div>
                </div>
            </CollapsibleSection>

            {/* Display Options */}
            <CollapsibleSection
                title="Display Options"
                defaultExpanded={false}
                theme={theme}
            >
                <ToggleSwitch
                    label="Show bonds"
                    checked={showBonds}
                    onChange={onShowBondsChange}
                    theme={theme}
                />
                <ToggleSwitch
                    label="Show axis labels"
                    checked={showLabels}
                    onChange={onShowLabelsChange}
                    theme={theme}
                />
                <div style={{ marginTop: '0.5rem' }}>
                    <label
                        style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            color: theme.textMuted,
                            marginBottom: '0.25rem',
                        }}
                    >
                        Supercell
                    </label>
                    <div
                        style={{
                            display: 'flex',
                            gap: '0.4rem',
                        }}
                    >
                        {[1, 2, 3].map((n) => (
                            <button
                                key={n}
                                onClick={() => onSupercellChange([n, n, n])}
                                style={{
                                    flex: 1,
                                    padding: '0.25rem',
                                    fontSize: '0.65rem',
                                    border: `1px solid ${theme.border}`,
                                    borderRadius: '4px',
                                    backgroundColor:
                                        supercell[0] === n
                                            ? theme.accent || '#2563eb'
                                            : theme.inputBg,
                                    color:
                                        supercell[0] === n
                                            ? '#fff'
                                            : theme.text,
                                    cursor: 'pointer',
                                }}
                            >
                                {n}×{n}×{n}
                            </button>
                        ))}
                    </div>
                </div>
            </CollapsibleSection>

            {/* Help text */}
            <div
                style={{
                    marginTop: '1rem',
                    padding: '0.5rem',
                    backgroundColor: theme.inputBg,
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    color: theme.textMuted,
                }}
            >
                <strong>Tips:</strong>
                <ul style={{ margin: '0.3rem 0 0 1rem', padding: 0 }}>
                    <li>Use tabs to switch between 3D/Density views</li>
                    <li>Click peaks in PXRD to highlight reflections</li>
                    <li>Empty circles show systematic absences</li>
                    <li>Adjust z-slice to scan electron density</li>
                </ul>
            </div>
        </div>
    );
};

export default DiffractionControls;
