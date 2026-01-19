import React, { useState } from 'react';
import type { ControlTheme } from './SliderWithInput';

export interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    defaultExpanded?: boolean;
    theme: ControlTheme;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
    title,
    children,
    defaultExpanded = false,
    theme,
}) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <div style={{ marginBottom: '0.75rem' }}>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    width: '100%',
                    padding: '0.5rem 0.6rem',
                    border: `1px solid ${theme.border}`,
                    borderRadius: '4px',
                    backgroundColor: theme.surface || theme.inputBg,
                    color: theme.text,
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    textAlign: 'left',
                }}
            >
                <span>{title}</span>
                <span
                    style={{
                        transform: isExpanded ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s ease',
                        fontSize: '0.7rem',
                    }}
                >
                    ▼
                </span>
            </button>
            <div
                style={{
                    maxHeight: isExpanded ? '500px' : '0',
                    overflow: 'hidden',
                    transition: 'max-height 0.2s ease-out',
                }}
            >
                <div
                    style={{
                        marginTop: '0.5rem',
                        padding: '0.6rem',
                        backgroundColor: theme.surface || theme.inputBg,
                        borderRadius: '4px',
                        border: `1px solid ${theme.border}`,
                    }}
                >
                    {children}
                </div>
            </div>
        </div>
    );
};

export default CollapsibleSection;
