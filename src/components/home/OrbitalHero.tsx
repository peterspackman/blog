import React from 'react';
import { ORBITAL_CONTOURS } from './orbitalContours';
import styles from './Home.module.css';

/**
 * Naphthalene's HOMO as nested, shaded contours. Each level is a closed path
 * filled at low opacity, so the stacking shades towards the maxima; colours
 * are the site's positive/negative tokens so it follows the colour mode.
 */
export default function OrbitalHero({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 600 420"
            className={className}
            role="img"
            aria-label="Contour plot of the highest occupied molecular orbital of naphthalene, positive lobes in orange and negative in blue"
        >
            {(['positive', 'negative'] as const).map((sign) => (
                <g key={sign} className={sign === 'positive' ? styles.lobePositive : styles.lobeNegative}>
                    {ORBITAL_CONTOURS[sign].map((d, i) => (
                        <path key={i} d={d} style={{ '--i': i } as React.CSSProperties} />
                    ))}
                </g>
            ))}
        </svg>
    );
}
