import React from 'react';
import { FieldPreset, FieldShape, VectorField } from './VectorField';
import { ElectricFieldPreset, ElectricField } from './ElectricField';

interface DrawToolbarProps {
    // Drawing state
    isDrawMode: boolean;
    setIsDrawMode: (mode: boolean) => void;
    brushRadius: number;
    setBrushRadius: (radius: number) => void;
    fieldStrength: number;
    setFieldStrength: (strength: number) => void;
    showField: boolean;
    setShowField: (show: boolean) => void;
    fieldChargeMode: boolean;
    setFieldChargeMode: (mode: boolean) => void;

    // Callbacks
    onClear: () => void;

    // Theme
    isDark: boolean;
}

// Floating toolbar for draw mode - sits at bottom of canvas
export const DrawToolbar: React.FC<DrawToolbarProps> = ({
    isDrawMode,
    setIsDrawMode,
    brushRadius,
    setBrushRadius,
    fieldStrength,
    setFieldStrength,
    showField,
    setShowField,
    fieldChargeMode,
    setFieldChargeMode,
    onClear,
    isDark,
}) => {
    const theme = {
        bg: isDark ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        border: isDark ? '#444' : '#ddd',
        text: isDark ? '#e0e0e0' : '#333',
        textMuted: isDark ? '#888' : '#666',
        accent: isDark ? '#60a5fa' : '#2563eb',
        buttonBg: isDark ? '#3d3d3d' : '#f0f0f0',
        buttonHover: isDark ? '#4d4d4d' : '#e0e0e0',
    };

    const sliderThumbStyle = `
        input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            height: 14px;
            width: 14px;
            border-radius: 50%;
            background: ${theme.accent};
            cursor: pointer;
            margin-top: -5px;
        }
    `;

    return (
        <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.5rem 0.75rem',
            backgroundColor: theme.bg,
            borderRadius: '8px',
            border: `1px solid ${theme.border}`,
            backdropFilter: 'blur(8px)',
            boxShadow: isDark
                ? '0 4px 12px rgba(0, 0, 0, 0.4)'
                : '0 4px 12px rgba(0, 0, 0, 0.1)',
            fontSize: '0.8rem',
            zIndex: 10,
        }}>
            <style>{sliderThumbStyle}</style>

            {/* Draw toggle */}
            <button
                onClick={() => setIsDrawMode(!isDrawMode)}
                title="Toggle draw mode"
                style={{
                    padding: '0.35rem 0.6rem',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: isDrawMode ? theme.accent : theme.buttonBg,
                    color: isDrawMode ? '#fff' : theme.text,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    transition: 'all 0.15s ease',
                }}
            >
                Draw
            </button>

            {isDrawMode && (
                <>
                    {/* Instructions */}
                    <span style={{
                        color: theme.textMuted,
                        fontSize: '0.7rem',
                        whiteSpace: 'nowrap',
                    }}>
                        L=attract R=repel
                    </span>

                    {/* Size slider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{ color: theme.textMuted, fontSize: '0.7rem' }}>Size</span>
                        <input
                            type="range"
                            min="2"
                            max="30"
                            step="1"
                            value={brushRadius}
                            onChange={(e) => setBrushRadius(parseFloat(e.target.value))}
                            style={{
                                width: '50px',
                                height: '4px',
                                borderRadius: '2px',
                                cursor: 'pointer',
                                accentColor: theme.accent,
                            }}
                        />
                    </div>

                    {/* Strength slider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{ color: theme.textMuted, fontSize: '0.7rem' }}>Str</span>
                        <input
                            type="range"
                            min="10"
                            max="200"
                            step="10"
                            value={fieldStrength}
                            onChange={(e) => setFieldStrength(parseFloat(e.target.value))}
                            style={{
                                width: '50px',
                                height: '4px',
                                borderRadius: '2px',
                                cursor: 'pointer',
                                accentColor: theme.accent,
                            }}
                        />
                    </div>

                    {/* Show field toggle */}
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        cursor: 'pointer',
                        color: theme.textMuted,
                        fontSize: '0.7rem',
                    }}>
                        <input
                            type="checkbox"
                            checked={showField}
                            onChange={(e) => setShowField(e.target.checked)}
                            style={{ margin: 0, accentColor: theme.accent }}
                        />
                        Show
                    </label>

                    {/* Charge mode toggle */}
                    <label
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            cursor: 'pointer',
                            color: theme.textMuted,
                            fontSize: '0.7rem',
                        }}
                        title="Particles interact with field based on type (+ or -)"
                    >
                        <input
                            type="checkbox"
                            checked={fieldChargeMode}
                            onChange={(e) => setFieldChargeMode(e.target.checked)}
                            style={{ margin: 0, accentColor: theme.accent }}
                        />
                        ±
                    </label>

                    {/* Clear button */}
                    <button
                        onClick={onClear}
                        title="Clear all drawn fields"
                        style={{
                            padding: '0.25rem 0.5rem',
                            border: `1px solid ${theme.border}`,
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            backgroundColor: theme.buttonBg,
                            color: theme.textMuted,
                        }}
                    >
                        Clear
                    </button>
                </>
            )}
        </div>
    );
};

// Legacy exports for backwards compatibility during transition
interface FieldControlsProps {
    fieldPreset: FieldPreset;
    setFieldPreset: (preset: FieldPreset) => void;
    fieldStrength: number;
    setFieldStrength: (strength: number) => void;
    fieldShape: FieldShape;
    setFieldShape: (shape: FieldShape) => void;
    showField: boolean;
    setShowField: (show: boolean) => void;
    brushRadius: number;
    setBrushRadius: (radius: number) => void;
    fieldChargeMode: boolean;
    setFieldChargeMode: (mode: boolean) => void;
    eFieldPreset?: ElectricFieldPreset;
    setEFieldPreset?: (preset: ElectricFieldPreset) => void;
    eFieldStrength?: number;
    setEFieldStrength?: (strength: number) => void;
    showEField?: boolean;
    setShowEField?: (show: boolean) => void;
    vectorFieldRef: React.RefObject<VectorField | null>;
    electricFieldRef?: React.RefObject<ElectricField | null>;
    onVectorFieldUpdate: () => void;
    applyFieldPreset?: (preset: FieldPreset, strength: number) => void;
    isDark: boolean;
}

export const FieldControls: React.FC<FieldControlsProps> = ({
    fieldPreset, setFieldPreset,
    fieldStrength, setFieldStrength,
    showField, setShowField,
    brushRadius, setBrushRadius,
    fieldChargeMode, setFieldChargeMode,
    vectorFieldRef,
    onVectorFieldUpdate,
    isDark
}) => {
    return (
        <DrawToolbar
            isDrawMode={fieldPreset === 'draw'}
            setIsDrawMode={(mode) => setFieldPreset(mode ? 'draw' : 'none')}
            brushRadius={brushRadius}
            setBrushRadius={setBrushRadius}
            fieldStrength={fieldStrength}
            setFieldStrength={setFieldStrength}
            showField={showField}
            setShowField={setShowField}
            fieldChargeMode={fieldChargeMode}
            setFieldChargeMode={setFieldChargeMode}
            onClear={() => {
                if (vectorFieldRef.current) {
                    vectorFieldRef.current.clear();
                    onVectorFieldUpdate();
                }
            }}
            isDark={isDark}
        />
    );
};

// Simplified version for scenario mode
interface SimplifiedFieldControlsProps {
    fieldPreset: FieldPreset;
    fieldStrength: number;
    setFieldStrength: (strength: number) => void;
    eFieldPreset: ElectricFieldPreset;
    eFieldStrength: number;
    setEFieldStrength: (strength: number) => void;
    showField: boolean;
    setShowField: (show: boolean) => void;
    showEField: boolean;
    setShowEField: (show: boolean) => void;
    onFieldStrengthChange: (strength: number) => void;
    onEFieldStrengthChange: (strength: number) => void;
    isDark: boolean;
}

export const SimplifiedFieldControls: React.FC<SimplifiedFieldControlsProps> = ({
    fieldPreset,
    fieldStrength, setFieldStrength,
    eFieldPreset,
    eFieldStrength, setEFieldStrength,
    showField, setShowField,
    showEField, setShowEField,
    onFieldStrengthChange,
    onEFieldStrengthChange,
    isDark
}) => {
    const theme = {
        bg: isDark ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        border: isDark ? '#444' : '#ddd',
        text: isDark ? '#e0e0e0' : '#333',
        textMuted: isDark ? '#888' : '#666',
        accent: isDark ? '#60a5fa' : '#2563eb',
    };

    const hasField = fieldPreset !== 'none';
    const hasEField = eFieldPreset !== 'none';

    if (!hasField && !hasEField) return null;

    return (
        <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '0.5rem 0.75rem',
            backgroundColor: theme.bg,
            borderRadius: '8px',
            border: `1px solid ${theme.border}`,
            backdropFilter: 'blur(8px)',
            boxShadow: isDark
                ? '0 4px 12px rgba(0, 0, 0, 0.4)'
                : '0 4px 12px rgba(0, 0, 0, 0.1)',
            fontSize: '0.8rem',
            zIndex: 10,
        }}>
            {hasField && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', color: theme.textMuted, fontSize: '0.75rem' }}>
                        <input
                            type="checkbox"
                            checked={showField}
                            onChange={(e) => setShowField(e.target.checked)}
                            style={{ margin: 0, accentColor: theme.accent }}
                        />
                        Barriers
                    </label>
                    <input
                        type="range"
                        min="10"
                        max="200"
                        step="10"
                        value={fieldStrength}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setFieldStrength(val);
                            onFieldStrengthChange(val);
                        }}
                        style={{ width: '50px', accentColor: theme.accent }}
                    />
                </div>
            )}

            {hasEField && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', color: theme.textMuted, fontSize: '0.75rem' }}>
                        <input
                            type="checkbox"
                            checked={showEField}
                            onChange={(e) => setShowEField(e.target.checked)}
                            style={{ margin: 0, accentColor: theme.accent }}
                        />
                        E-Field
                    </label>
                    <input
                        type="range"
                        min="10"
                        max="200"
                        step="10"
                        value={eFieldStrength}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setEFieldStrength(val);
                            onEFieldStrengthChange(val);
                        }}
                        style={{ width: '50px', accentColor: theme.accent }}
                    />
                </div>
            )}
        </div>
    );
};
