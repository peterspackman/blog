import React from 'react';
import {
    SliderWithInput,
    CollapsibleSection,
    ToggleSwitch,
    type ControlTheme,
} from '../shared/controls';
import { MIN_ATOMS, MAX_ATOMS } from './physics';

export interface BandControlsProps {
    // Chain length
    N: number;
    onNChange: (n: number) => void;

    // Electron filling
    electronCount: number;
    onElectronCountChange: (count: number) => void;

    // Peierls distortion
    alternation: number;
    onAlternationChange: (delta: number) => void;

    // Orbital selection
    selectedK: number | null;
    onSelectedKChange: (k: number | null) => void;

    // Model parameters
    beta: number;
    onBetaChange: (beta: number) => void;

    // DOS options
    showSmoothedDOS: boolean;
    onShowSmoothedDOSChange: (show: boolean) => void;
    dosSigma: number;
    onDosSigmaChange: (sigma: number) => void;

    // Display options
    showAtomLabels: boolean;
    onShowAtomLabelsChange: (show: boolean) => void;
    showCoefficients: boolean;
    onShowCoefficientsChange: (show: boolean) => void;

    // Computed values for display
    bandGap?: number;

    // Theme
    theme: ControlTheme;
}

export const BandControls: React.FC<BandControlsProps> = ({
    N,
    onNChange,
    electronCount,
    onElectronCountChange,
    alternation,
    onAlternationChange,
    selectedK,
    onSelectedKChange,
    beta,
    onBetaChange,
    showSmoothedDOS,
    onShowSmoothedDOSChange,
    dosSigma,
    onDosSigmaChange,
    showAtomLabels,
    onShowAtomLabelsChange,
    showCoefficients,
    onShowCoefficientsChange,
    bandGap,
    theme,
}) => {
    // Generate k options for orbital selector
    const kOptions = Array.from({ length: N }, (_, i) => i + 1);

    // Max electrons = 2N (2 per orbital with spin)
    const maxElectrons = 2 * N;

    // Doping level relative to half-filling
    const dopingLevel = electronCount - N;
    const dopingLabel = dopingLevel === 0
        ? 'half-filled (neutral)'
        : dopingLevel > 0
            ? `+${dopingLevel} (n-doped)`
            : `${dopingLevel} (p-doped)`;

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
            {/* Chain Length */}
            <CollapsibleSection
                title="Chain Length"
                defaultExpanded={true}
                theme={theme}
            >
                <SliderWithInput
                    label="N atoms"
                    value={N}
                    onChange={(val) => {
                        const newN = Math.round(val);
                        onNChange(newN);
                        // Adjust electron count to maintain relative filling
                        const newElectrons = Math.min(electronCount, 2 * newN);
                        onElectronCountChange(newElectrons);
                        // Adjust selected k if needed
                        if (selectedK !== null && selectedK > newN) {
                            onSelectedKChange(newN);
                        }
                    }}
                    min={MIN_ATOMS}
                    max={MAX_ATOMS}
                    step={1}
                    decimals={0}
                    unit=""
                    theme={theme}
                />
                <div
                    style={{
                        fontSize: '0.7rem',
                        color: theme.textMuted,
                        marginTop: '0.25rem',
                    }}
                >
                    Band width: {Math.abs(4 * beta).toFixed(1)} eV
                </div>
            </CollapsibleSection>

            {/* Model Parameters - includes beta, electrons, alternation */}
            <CollapsibleSection
                title="Model Parameters"
                defaultExpanded={true}
                theme={theme}
            >
                {/* Hopping integral */}
                <SliderWithInput
                    label="Hopping (β)"
                    value={beta}
                    onChange={onBetaChange}
                    min={-4}
                    max={-1}
                    step={0.1}
                    decimals={1}
                    unit="eV"
                    theme={theme}
                />

                {/* Electron count */}
                <SliderWithInput
                    label="Electrons"
                    value={electronCount}
                    onChange={(val) => onElectronCountChange(Math.round(val))}
                    min={0}
                    max={maxElectrons}
                    step={1}
                    decimals={0}
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
                        onClick={() => onElectronCountChange(0)}
                        style={{
                            flex: 1,
                            padding: '0.25rem',
                            fontSize: '0.65rem',
                            border: `1px solid ${theme.border}`,
                            borderRadius: '4px',
                            backgroundColor: electronCount === 0 ? (theme.accent || '#2563eb') : theme.inputBg,
                            color: electronCount === 0 ? '#fff' : theme.text,
                            cursor: 'pointer',
                        }}
                    >
                        Empty
                    </button>
                    <button
                        onClick={() => onElectronCountChange(N)}
                        style={{
                            flex: 1,
                            padding: '0.25rem',
                            fontSize: '0.65rem',
                            border: `1px solid ${theme.border}`,
                            borderRadius: '4px',
                            backgroundColor: electronCount === N ? (theme.accent || '#2563eb') : theme.inputBg,
                            color: electronCount === N ? '#fff' : theme.text,
                            cursor: 'pointer',
                        }}
                    >
                        Half
                    </button>
                    <button
                        onClick={() => onElectronCountChange(maxElectrons)}
                        style={{
                            flex: 1,
                            padding: '0.25rem',
                            fontSize: '0.65rem',
                            border: `1px solid ${theme.border}`,
                            borderRadius: '4px',
                            backgroundColor: electronCount === maxElectrons ? (theme.accent || '#2563eb') : theme.inputBg,
                            color: electronCount === maxElectrons ? '#fff' : theme.text,
                            cursor: 'pointer',
                        }}
                    >
                        Full
                    </button>
                </div>
                <div
                    style={{
                        fontSize: '0.7rem',
                        color: theme.textMuted,
                        marginBottom: '0.5rem',
                    }}
                >
                    {dopingLabel}
                </div>

                {/* Bond alternation (Peierls) */}
                <SliderWithInput
                    label="Bond alternation (δ)"
                    value={alternation}
                    onChange={onAlternationChange}
                    min={0}
                    max={0.5}
                    step={0.01}
                    decimals={2}
                    unit=""
                    theme={theme}
                />
                <div
                    style={{
                        fontSize: '0.7rem',
                        color: theme.textMuted,
                    }}
                >
                    {alternation > 0 ? (
                        <>Gap: {bandGap?.toFixed(2) || '?'} eV (Peierls)</>
                    ) : (
                        'δ=0: uniform chain'
                    )}
                </div>
            </CollapsibleSection>

            {/* Orbital Selection */}
            <CollapsibleSection
                title="Selected Orbital"
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
                        MO index (k)
                    </label>
                    <select
                        value={selectedK ?? ''}
                        onChange={(e) => {
                            const val = e.target.value;
                            onSelectedKChange(val === '' ? null : parseInt(val, 10));
                        }}
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
                        <option value="">None</option>
                        {kOptions.map((k) => (
                            <option key={k} value={k}>
                                k = {k} ({k <= N / 3 ? 'bonding' : k <= (2 * N) / 3 ? 'nonbonding' : 'antibonding'})
                            </option>
                        ))}
                    </select>
                </div>
                <div
                    style={{
                        fontSize: '0.7rem',
                        color: theme.textMuted,
                    }}
                >
                    Click energy levels to select
                </div>
            </CollapsibleSection>

            {/* Display Options */}
            <CollapsibleSection
                title="Display Options"
                defaultExpanded={false}
                theme={theme}
            >
                <ToggleSwitch
                    label="Smoothed DOS"
                    checked={showSmoothedDOS}
                    onChange={onShowSmoothedDOSChange}
                    theme={theme}
                />
                {showSmoothedDOS && (
                    <SliderWithInput
                        label="DOS broadening"
                        value={dosSigma}
                        onChange={onDosSigmaChange}
                        min={0.05}
                        max={0.5}
                        step={0.01}
                        decimals={2}
                        unit="eV"
                        theme={theme}
                    />
                )}
                <ToggleSwitch
                    label="Atom labels"
                    checked={showAtomLabels}
                    onChange={onShowAtomLabelsChange}
                    theme={theme}
                />
                <ToggleSwitch
                    label="MO coefficients"
                    checked={showCoefficients}
                    onChange={onShowCoefficientsChange}
                    theme={theme}
                />
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
                    <li>Increase N to see band formation</li>
                    <li>Add δ to open a Peierls gap</li>
                    <li>Change electrons to dope</li>
                </ul>
            </div>
        </div>
    );
};

export default BandControls;
