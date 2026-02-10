import React from 'react';
import {
    SliderWithInput,
    CollapsibleSection,
    ToggleSwitch,
    type ControlTheme,
} from '../shared/controls';
import type { CrystalStructure, ControlPoint } from './physics';
import { CU_K_ALPHA, MO_K_ALPHA } from './physics';
import { STRUCTURE_LIST } from './structures';
import { FormFactorEditor } from './FormFactorEditor';

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

    // Reciprocal space
    zoneAxis: [number, number, number];
    onZoneAxisChange: (axis: [number, number, number]) => void;
    maxIndex: number;
    onMaxIndexChange: (max: number) => void;
    showAbsences: boolean;
    onShowAbsencesChange: (show: boolean) => void;
    reciprocalView: 'lattice' | 'detector' | 'pxrd';
    detectorDistance: number;
    onDetectorDistanceChange: (dist: number) => void;
    showIndexingCircles: boolean;
    onShowIndexingCirclesChange: (show: boolean) => void;

    // Display options
    peakWidth: number;
    onPeakWidthChange: (width: number) => void;
    showPeakMarkers: boolean;
    onShowPeakMarkersChange: (show: boolean) => void;
    showBonds: boolean;
    onShowBondsChange: (show: boolean) => void;
    showLabels: boolean;
    onShowLabelsChange: (show: boolean) => void;

    // Advanced (move to collapsed section)
    noise: number;
    onNoiseChange: (noise: number) => void;
    bFactor: number;
    onBFactorChange: (b: number) => void;

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
    zoneAxis,
    onZoneAxisChange,
    maxIndex,
    onMaxIndexChange,
    showAbsences,
    onShowAbsencesChange,
    reciprocalView,
    detectorDistance,
    onDetectorDistanceChange,
    showIndexingCircles,
    onShowIndexingCirclesChange,
    peakWidth,
    onPeakWidthChange,
    showPeakMarkers,
    onShowPeakMarkersChange,
    showBonds,
    onShowBondsChange,
    showLabels,
    onShowLabelsChange,
    noise,
    onNoiseChange,
    bFactor,
    onBFactorChange,
    formFactors,
    onFormFactorsChange,
    theme,
}) => {
    const buttonStyle = (isActive: boolean) => ({
        flex: 1,
        padding: '0.25rem',
        fontSize: '0.65rem',
        border: `1px solid ${theme.border}`,
        borderRadius: '4px',
        backgroundColor: isActive ? theme.accent || '#2563eb' : theme.inputBg,
        color: isActive ? '#fff' : theme.text,
        cursor: 'pointer',
    });

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
            {/* Section 1: Crystal Structure */}
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
                    {structure.b && structure.b !== structure.a && (
                        <div>b = {structure.b.toFixed(3)} Å</div>
                    )}
                    {structure.c && structure.c !== structure.a && (
                        <div>c = {structure.c.toFixed(3)} Å</div>
                    )}
                    <div>Atoms: {structure.atoms.length}</div>
                </div>
            </CollapsibleSection>

            {/* Section 2: X-ray & Viewing */}
            <CollapsibleSection
                title="X-ray & Viewing"
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
                        style={buttonStyle(Math.abs(wavelength - CU_K_ALPHA) < 0.001)}
                    >
                        Cu Kα
                    </button>
                    <button
                        onClick={() => onWavelengthChange(MO_K_ALPHA)}
                        style={buttonStyle(Math.abs(wavelength - MO_K_ALPHA) < 0.001)}
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

                {/* Zone axis text input */}
                <div style={{ marginBottom: '0.5rem' }}>
                    <label
                        style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            color: theme.textMuted,
                            marginBottom: '0.25rem',
                        }}
                    >
                        Zone Axis [uvw]
                    </label>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                        {[0, 1, 2].map((idx) => (
                            <input
                                key={idx}
                                type="number"
                                value={zoneAxis[idx]}
                                onChange={(e) => {
                                    const newAxis = [...zoneAxis] as [number, number, number];
                                    newAxis[idx] = parseInt(e.target.value) || 0;
                                    onZoneAxisChange(newAxis);
                                }}
                                style={{
                                    flex: 1,
                                    width: '100%',
                                    padding: '0.3rem',
                                    fontSize: '0.8rem',
                                    textAlign: 'center',
                                    border: `1px solid ${theme.border}`,
                                    borderRadius: '4px',
                                    backgroundColor: theme.inputBg,
                                    color: theme.text,
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* Max index preset buttons */}
                <div style={{ marginBottom: '0.5rem' }}>
                    <label
                        style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            color: theme.textMuted,
                            marginBottom: '0.25rem',
                        }}
                    >
                        Max index
                    </label>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {[5, 8, 12].map((n) => (
                            <button
                                key={n}
                                onClick={() => onMaxIndexChange(n)}
                                style={buttonStyle(maxIndex === n)}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                </div>

                <ToggleSwitch
                    label="Show absences"
                    checked={showAbsences}
                    onChange={onShowAbsencesChange}
                    theme={theme}
                />

                {/* Detector-specific controls */}
                {reciprocalView === 'detector' && (
                    <>
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
                        <ToggleSwitch
                            label="Indexing circles"
                            checked={showIndexingCircles}
                            onChange={onShowIndexingCirclesChange}
                            theme={theme}
                        />
                    </>
                )}
            </CollapsibleSection>

            {/* Section 3: Display Options */}
            <CollapsibleSection
                title="Display Options"
                defaultExpanded={false}
                theme={theme}
            >
                <SliderWithInput
                    label="Peak FWHM"
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
                    label="Show peak markers"
                    checked={showPeakMarkers}
                    onChange={onShowPeakMarkersChange}
                    theme={theme}
                />
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
            </CollapsibleSection>

            {/* Section 4: Advanced */}
            <CollapsibleSection
                title="Advanced"
                defaultExpanded={false}
                theme={theme}
            >
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

                {/* Form Factor Editor */}
                <div style={{ marginTop: '0.75rem' }}>
                    <label
                        style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            color: theme.textMuted,
                            marginBottom: '0.25rem',
                        }}
                    >
                        Atomic Form Factors
                    </label>
                    <FormFactorEditor
                        width={220}
                        height={140}
                        elements={structure.atoms.map(a => a.element)}
                        theme={theme}
                        formFactors={formFactors}
                        onFormFactorsChange={onFormFactorsChange}
                    />
                    <div
                        style={{
                            marginTop: '0.25rem',
                            fontSize: '0.6rem',
                            color: theme.textMuted,
                        }}
                    >
                        Drag points to customize f(s). Click element to select.
                    </div>
                </div>
            </CollapsibleSection>
        </div>
    );
};

export default DiffractionControls;
