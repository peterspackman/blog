import React from 'react';
import { FieldPreset, FieldShape, VectorField } from './VectorField';
import { ElectricFieldPreset, ElectricField } from './ElectricField';

interface FieldControlsProps {
    // Vector field (potential)
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

    // Electric field (unused but kept for interface compatibility)
    eFieldPreset?: ElectricFieldPreset;
    setEFieldPreset?: (preset: ElectricFieldPreset) => void;
    eFieldStrength?: number;
    setEFieldStrength?: (strength: number) => void;
    showEField?: boolean;
    setShowEField?: (show: boolean) => void;

    // Field refs for clearing
    vectorFieldRef: React.RefObject<VectorField | null>;
    electricFieldRef?: React.RefObject<ElectricField | null>;

    // Callbacks
    onVectorFieldUpdate: () => void;
    applyFieldPreset?: (preset: FieldPreset, strength: number) => void;

    // Theme
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
    const theme = {
        surface: isDark ? '#2d2d2d' : '#f8f9fa',
        border: isDark ? '#444' : '#ccc',
        text: isDark ? '#e0e0e0' : '#333',
        textMuted: isDark ? '#888' : '#666',
        selectBg: isDark ? '#3d3d3d' : '#fff',
    };

    const isDrawing = fieldPreset === 'draw';

    return (
        <div style={{
            display: 'flex',
            gap: '0.75rem',
            marginTop: '0.5rem',
            fontSize: '0.85rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: '0.5rem 0.75rem',
            backgroundColor: theme.surface,
            borderRadius: '6px',
            border: `1px solid ${theme.border}`,
        }}>
            {/* Toggle draw mode */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                    type="checkbox"
                    checked={isDrawing}
                    onChange={(e) => setFieldPreset(e.target.checked ? 'draw' : 'none')}
                />
                Draw Potential
            </label>

            {isDrawing && (
                <>
                    <span style={{ color: theme.textMuted, fontSize: '0.75rem' }}>
                        L=attract R=repel M=erase
                    </span>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        Size:
                        <input
                            type="range"
                            min="2"
                            max="20"
                            step="1"
                            value={brushRadius}
                            onChange={(e) => setBrushRadius(parseFloat(e.target.value))}
                            style={{ width: '60px' }}
                        />
                        <span style={{ minWidth: '1.5rem', fontFamily: 'monospace' }}>{brushRadius}</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        Strength:
                        <input
                            type="range"
                            min="10"
                            max="200"
                            step="10"
                            value={fieldStrength}
                            onChange={(e) => setFieldStrength(parseFloat(e.target.value))}
                            style={{ width: '60px' }}
                        />
                        <span style={{ minWidth: '2rem', fontFamily: 'monospace' }}>{fieldStrength}</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={showField}
                            onChange={(e) => setShowField(e.target.checked)}
                        />
                        Show
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}
                           title="If checked, orange (+) and blue (-) particles interact differently with drawn potentials">
                        <input
                            type="checkbox"
                            checked={fieldChargeMode}
                            onChange={(e) => setFieldChargeMode(e.target.checked)}
                        />
                        Charge
                    </label>

                    <button
                        onClick={() => {
                            if (vectorFieldRef.current) {
                                vectorFieldRef.current.clear();
                                onVectorFieldUpdate();
                            }
                        }}
                        style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            border: `1px solid ${theme.border}`,
                            backgroundColor: theme.selectBg,
                            color: theme.text,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                        }}
                    >
                        Clear
                    </button>
                </>
            )}
        </div>
    );
};

// Simplified version for scenario mode (just show/hide and strength)
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
        surface: isDark ? '#2d2d2d' : '#f8f9fa',
        border: isDark ? '#444' : '#ccc',
        text: isDark ? '#e0e0e0' : '#333',
        textMuted: isDark ? '#888' : '#666',
    };

    const hasField = fieldPreset !== 'none';
    const hasEField = eFieldPreset !== 'none';

    if (!hasField && !hasEField) return null;

    return (
        <div style={{
            display: 'flex',
            gap: '1rem',
            marginTop: '0.5rem',
            fontSize: '0.85rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: '0.5rem 0.75rem',
            backgroundColor: theme.surface,
            borderRadius: '6px',
            border: `1px solid ${theme.border}`,
        }}>
            {hasField && (
                <>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={showField}
                            onChange={(e) => setShowField(e.target.checked)}
                        />
                        Barriers
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
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
                            style={{ width: '60px' }}
                        />
                    </label>
                </>
            )}

            {hasEField && (
                <>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={showEField}
                            onChange={(e) => setShowEField(e.target.checked)}
                        />
                        E-Field
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
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
                            style={{ width: '60px' }}
                        />
                    </label>
                </>
            )}
        </div>
    );
};
