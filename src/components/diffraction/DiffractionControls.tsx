import React from 'react';
import {
    SliderWithInput,
    CollapsibleSection,
    ToggleSwitch,
    SegmentedControl,
    Select,
    ControlGroup,
    ControlHint,
    type ControlTheme,
} from '../shared/controls';
import type { CrystalStructure, ControlPoint } from './physics';
import { CU_K_ALPHA, MO_K_ALPHA } from './physics';
import { STRUCTURE_LIST } from './structures';
import { FormFactorEditor } from './FormFactorEditor';

export interface DiffractionControlsProps {
    structureId: string;
    onStructureChange: (id: string) => void;
    structure: CrystalStructure;
    wavelength: number;
    onWavelengthChange: (lambda: number) => void;
    twoThetaMax: number;
    onTwoThetaMaxChange: (max: number) => void;
    zoneAxis: [number, number, number];
    onZoneAxisChange: (axis: [number, number, number]) => void;
    maxIndex: number;
    onMaxIndexChange: (max: number) => void;
    showAbsences: boolean;
    onShowAbsencesChange: (show: boolean) => void;
    realSpaceView: '3d' | 'density';
    reciprocalView: 'lattice' | 'detector' | 'pxrd';
    detectorDistance: number;
    onDetectorDistanceChange: (dist: number) => void;
    showIndexingCircles: boolean;
    onShowIndexingCirclesChange: (show: boolean) => void;
    peakWidth: number;
    onPeakWidthChange: (width: number) => void;
    showPeakMarkers: boolean;
    onShowPeakMarkersChange: (show: boolean) => void;
    showBonds: boolean;
    onShowBondsChange: (show: boolean) => void;
    showLabels: boolean;
    onShowLabelsChange: (show: boolean) => void;
    noise: number;
    onNoiseChange: (noise: number) => void;
    bFactor: number;
    onBFactorChange: (b: number) => void;
    formFactors: Record<string, ControlPoint[]>;
    onFormFactorsChange: (formFactors: Record<string, ControlPoint[]>) => void;
    /** Colours for the form-factor canvas editor. */
    theme: ControlTheme;
}

const SOURCES = [
    { value: 'cu', label: 'Cu Kα', title: `${CU_K_ALPHA} Å` },
    { value: 'mo', label: 'Mo Kα', title: `${MO_K_ALPHA} Å` },
];

const MAX_INDEX = [
    { value: 5, label: '5' },
    { value: 8, label: '8' },
    { value: 12, label: '12' },
];

const axisInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.25rem',
    font: 'inherit',
    fontFamily: 'var(--ifm-font-family-monospace)',
    fontSize: 'var(--viz-font-sm)',
    textAlign: 'center',
    color: 'var(--viz-text)',
    background: 'var(--viz-surface-subtle)',
    border: '1px solid var(--viz-border)',
    borderRadius: 'var(--viz-radius-sm)',
};

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
    realSpaceView,
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
    const source = Math.abs(wavelength - CU_K_ALPHA) < 1e-3 ? 'cu' : Math.abs(wavelength - MO_K_ALPHA) < 1e-3 ? 'mo' : '';
    const cell = [
        `a = ${structure.a.toFixed(3)} Å`,
        structure.b && structure.b !== structure.a ? `b = ${structure.b.toFixed(3)} Å` : null,
        structure.c && structure.c !== structure.a ? `c = ${structure.c.toFixed(3)} Å` : null,
    ]
        .filter(Boolean)
        .join(', ');

    return (
        <>
            <ControlGroup label="Crystal">
                <Select
                    aria-label="Structure"
                    value={structureId}
                    onChange={onStructureChange}
                    options={STRUCTURE_LIST.map((s) => ({ value: s.id, label: s.name }))}
                />
                <ControlHint>
                    {structure.spaceGroup} · {cell} · {structure.atoms.length} atoms per cell
                </ControlHint>
            </ControlGroup>

            <ControlGroup label="X-ray beam">
                <SegmentedControl
                    aria-label="X-ray source"
                    value={source}
                    onChange={(v) => onWavelengthChange(v === 'cu' ? CU_K_ALPHA : MO_K_ALPHA)}
                    options={SOURCES}
                />
                <SliderWithInput
                    label="Wavelength λ"
                    value={wavelength}
                    onChange={onWavelengthChange}
                    min={0.5} max={2.5} step={0.001} decimals={4} unit="Å"
                />
                <SliderWithInput
                    label="2θ max"
                    value={twoThetaMax}
                    onChange={onTwoThetaMaxChange}
                    min={30} max={180} step={5} decimals={0} unit="°"
                />
            </ControlGroup>

            <ControlGroup label="Zone axis">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.375rem' }}>
                        {(['u', 'v', 'w'] as const).map((name, idx) => (
                            <input
                                key={name}
                                type="number"
                                aria-label={`Zone axis ${name}`}
                                value={zoneAxis[idx]}
                                onChange={(e) => {
                                    const next = [...zoneAxis] as [number, number, number];
                                    next[idx] = parseInt(e.target.value) || 0;
                                    onZoneAxisChange(next);
                                }}
                                style={axisInputStyle}
                            />
                        ))}
                    </div>
                    <ControlHint>The direction you look down; sets the reciprocal-lattice layer and density slice.</ControlHint>
                </ControlGroup>

            {reciprocalView !== 'pxrd' && (
                <ControlGroup label={reciprocalView === 'detector' ? 'Detector' : 'Reciprocal lattice'}>
                    <div style={{ display: 'grid', gap: '0.25rem' }}>
                        <span style={{ fontSize: 'var(--viz-font-sm)' }}>Max index</span>
                        <SegmentedControl<number> aria-label="Max index" value={maxIndex} onChange={onMaxIndexChange} options={MAX_INDEX} />
                    </div>
                    <ToggleSwitch label="Show systematic absences" checked={showAbsences} onChange={onShowAbsencesChange} />
                    {reciprocalView === 'detector' && (
                        <>
                            <SliderWithInput
                                label="Detector distance"
                                value={detectorDistance}
                                onChange={onDetectorDistanceChange}
                                min={50} max={300} step={10} decimals={0} unit="mm"
                            />
                            <ToggleSwitch label="Indexing circles" checked={showIndexingCircles} onChange={onShowIndexingCirclesChange} />
                        </>
                    )}
                </ControlGroup>
            )}

            {reciprocalView === 'pxrd' && (
                <ControlGroup label="Powder pattern">
                    <SliderWithInput
                        label="Peak width (FWHM)"
                        value={peakWidth}
                        onChange={onPeakWidthChange}
                        min={0.1} max={3} step={0.1} decimals={1} unit="°"
                    />
                    <ToggleSwitch label="Peak markers" checked={showPeakMarkers} onChange={onShowPeakMarkersChange} />
                </ControlGroup>
            )}

            {realSpaceView === '3d' && (
                <ControlGroup label="Structure view">
                    <ToggleSwitch label="Bonds" checked={showBonds} onChange={onShowBondsChange} />
                    <ToggleSwitch label="Axes" checked={showLabels} onChange={onShowLabelsChange} />
                </ControlGroup>
            )}

            <CollapsibleSection title="Sample effects">
                <SliderWithInput
                    label="B-factor"
                    value={bFactor}
                    onChange={onBFactorChange}
                    min={0} max={10} step={0.5} decimals={1} unit="Å²"
                />
                <ControlHint>Thermal motion (Debye–Waller) weakens high-angle reflections.</ControlHint>
                <SliderWithInput
                    label="Noise"
                    value={noise}
                    onChange={onNoiseChange}
                    min={0} max={1} step={0.05} decimals={2}
                />
                <ControlHint>Counting noise on the measured intensities.</ControlHint>
            </CollapsibleSection>

            <CollapsibleSection title="Atomic form factors">
                <FormFactorEditor
                    width={240}
                    height={150}
                    elements={structure.atoms.map((a) => a.element)}
                    theme={theme}
                    formFactors={formFactors}
                    onFormFactorsChange={onFormFactorsChange}
                />
                <ControlHint>Drag points to reshape f(s); click an element to select it.</ControlHint>
            </CollapsibleSection>
        </>
    );
};

export default DiffractionControls;
