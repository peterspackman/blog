import React, { useEffect, useId, useState } from 'react';
import clsx from 'clsx';
import styles from './Controls.module.css';

/**
 * @deprecated Colours now come from --viz-* CSS tokens; the `theme` prop on
 * shared controls is ignored. Use useVizTheme() for imperative drawing.
 */
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
    label: React.ReactNode;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step: number;
    unit?: string;
    decimals?: number;
    /** @deprecated ignored */
    theme?: ControlTheme;
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
    disabled = false,
}) => {
    const id = useId();
    const [inputValue, setInputValue] = useState(value.toFixed(decimals));
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (!isFocused) setInputValue(value.toFixed(decimals));
    }, [value, decimals, isFocused]);

    const commit = () => {
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

    return (
        <div className={clsx(styles.slider, disabled && styles.disabled)}>
            <div className={styles.sliderHead}>
                <label htmlFor={id}>{label}</label>
                <span className={styles.sliderValue}>
                    <input
                        type="text"
                        inputMode="decimal"
                        aria-label={typeof label === 'string' ? `${label} value` : 'value'}
                        className={styles.numberInput}
                        value={isFocused ? inputValue : value.toFixed(decimals)}
                        onChange={(e) => setInputValue(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={commit}
                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        disabled={disabled}
                    />
                    {unit && <span className={styles.unit}>{unit}</span>}
                </span>
            </div>
            <input
                id={id}
                type="range"
                className={styles.range}
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                disabled={disabled}
            />
        </div>
    );
};

export default SliderWithInput;
