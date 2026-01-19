import React from 'react';
import type { ControlTheme } from './SliderWithInput';

export interface ToggleSwitchProps {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    theme: ControlTheme;
    disabled?: boolean;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
    label,
    checked,
    onChange,
    theme,
    disabled = false,
}) => {
    return (
        <label
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: '0.8rem',
                color: theme.text,
                marginBottom: '0.4rem',
                opacity: disabled ? 0.5 : 1,
            }}
        >
            <div
                style={{
                    position: 'relative',
                    width: '36px',
                    height: '20px',
                    backgroundColor: checked ? (theme.accent || '#2563eb') : theme.border,
                    borderRadius: '10px',
                    transition: 'background-color 0.2s ease',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        top: '2px',
                        left: checked ? '18px' : '2px',
                        width: '16px',
                        height: '16px',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        transition: 'left 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}
                />
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    disabled={disabled}
                    style={{
                        position: 'absolute',
                        opacity: 0,
                        width: '100%',
                        height: '100%',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        margin: 0,
                    }}
                />
            </div>
            <span>{label}</span>
        </label>
    );
};

export default ToggleSwitch;
