import React from 'react';
import type { VizTheme } from '../viz';

/** Small square swatches showing a pair of particle types, e.g. "A–B". */
export function TypePair({ colors }: { colors: string[] }) {
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', verticalAlign: 'middle' }}>
            {colors.map((c, i) => (
                <React.Fragment key={i}>
                    {i > 0 && <span style={{ color: 'var(--viz-muted)', fontSize: 'var(--viz-font-xs)' }}>–</span>}
                    <span style={{ width: '0.625rem', height: '0.625rem', borderRadius: '50%', background: c, display: 'inline-block' }} />
                </React.Fragment>
            ))}
        </span>
    );
}

/** Pick a palette slot for a particle type. */
export function SlotPicker({
    theme,
    value,
    onChange,
    label,
}: {
    theme: VizTheme;
    value: number;
    onChange: (slot: number) => void;
    label: string;
}) {
    return (
        <div role="radiogroup" aria-label={label} style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {theme.series.map((c, i) => (
                <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={i === value}
                    aria-label={`Colour ${i + 1}`}
                    onClick={() => onChange(i)}
                    style={{
                        width: '1.125rem',
                        height: '1.125rem',
                        padding: 0,
                        borderRadius: '50%',
                        background: c,
                        border: '2px solid var(--viz-surface)',
                        boxShadow: i === value ? '0 0 0 2px var(--viz-text)' : '0 0 0 1px var(--viz-border)',
                        cursor: 'pointer',
                    }}
                />
            ))}
        </div>
    );
}
