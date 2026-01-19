import React, { useState, useEffect } from 'react';

export interface ControlTheme {
    text: string;
    textMuted: string;
    border: string;
    inputBg: string;
    surface?: string;
    accent?: string;
    background?: string;
}

export interface SliderWithInputProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step: number;
    unit?: string;
    decimals?: number;
    theme: ControlTheme;
    disabled?: boolean;
}

export const SliderWithInput: React.FC<SliderWithInputProps> = ({
    label,
    value,
    onChange,
    min,
    max,
    step,
    unit = '',
    decimals = 2,
    theme,
    disabled = false,
}) => {
    const [inputValue, setInputValue] = useState(value.toFixed(decimals));
    const [isFocused, setIsFocused] = useState(false);

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        onChange(val);
        setInputValue(val.toFixed(decimals));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    const handleInputBlur = () => {
        setIsFocused(false);
        const val = parseFloat(inputValue);
        if (!isNaN(val)) {
            const clamped = Math.max(min, Math.min(max, val));
            onChange(clamped);
            setInputValue(clamped.toFixed(decimals));
        } else {
            setInputValue(value.toFixed(decimals));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
        }
    };

    // Sync input value when slider changes externally
    useEffect(() => {
        if (!isFocused) {
            setInputValue(value.toFixed(decimals));
        }
    }, [value, decimals, isFocused]);

    return (
        <div style={{ marginBottom: '0.6rem', opacity: disabled ? 0.5 : 1 }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.25rem',
            }}>
                <span style={{ fontSize: '0.8rem', color: theme.text }}>{label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <input
                        type="text"
                        value={isFocused ? inputValue : value.toFixed(decimals)}
                        onChange={handleInputChange}
                        onFocus={() => setIsFocused(true)}
                        onBlur={handleInputBlur}
                        onKeyDown={handleKeyDown}
                        disabled={disabled}
                        style={{
                            width: '4rem',
                            padding: '0.15rem 0.3rem',
                            fontSize: '0.75rem',
                            fontFamily: 'monospace',
                            textAlign: 'right',
                            border: `1px solid ${theme.border}`,
                            borderRadius: '3px',
                            backgroundColor: theme.inputBg,
                            color: theme.text,
                        }}
                    />
                    {unit && (
                        <span style={{ fontSize: '0.7rem', color: theme.textMuted, minWidth: '1.5rem' }}>
                            {unit}
                        </span>
                    )}
                </div>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={handleSliderChange}
                disabled={disabled}
                style={{
                    width: '100%',
                    height: '4px',
                    borderRadius: '2px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                }}
            />
        </div>
    );
};

export default SliderWithInput;
