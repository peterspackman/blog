import React from 'react';
import styles from './OrbitalItem.module.css';

interface OrbitalItemProps {
  orbital: {
    index: number;
    energy: number; // in eV
    occupation: number;
    isOccupied: boolean;
    spin?: 'alpha' | 'beta';
  };
  isHOMO?: boolean;
  isLUMO?: boolean;
  isSelected?: boolean;
  colorIndicator?: string;
  onColorChange?: (color: string) => void;
  onClick?: () => void;
  className?: string;
}

const OrbitalItem: React.FC<OrbitalItemProps> = ({
  orbital,
  isHOMO = false,
  isLUMO = false,
  isSelected = false,
  colorIndicator,
  onColorChange,
  onClick,
  className = ''
}) => {
  const energyInHartree = orbital.energy / 27.2114;
  const spinLabel = orbital.spin ? ` (${orbital.spin})` : '';

  // Determine styling based on occupation and spin
  let itemClass = styles.orbitalItem;
  if (orbital.spin === 'alpha') {
    itemClass += ` ${orbital.isOccupied ? styles.orbitalAlphaOccupied : styles.orbitalAlphaVirtual}`;
  } else if (orbital.spin === 'beta') {
    itemClass += ` ${orbital.isOccupied ? styles.orbitalBetaOccupied : styles.orbitalBetaVirtual}`;
  } else {
    itemClass += ` ${orbital.isOccupied ? styles.orbitalOccupied : styles.orbitalVirtual}`;
  }
  if (isSelected) itemClass += ` ${styles.orbitalSelected}`;
  if (className) itemClass += ` ${className}`;

  // Determine spin icon
  const getSpinIcon = () => {
    if (orbital.spin === 'alpha') return '↑';
    if (orbital.spin === 'beta') return '↓';
    // For restricted (both spins), show both arrows if occupied
    if (orbital.isOccupied && orbital.occupation >= 2) return '↑↓';
    if (orbital.isOccupied && orbital.occupation >= 1) return '↑';
    return null;
  };

  const spinIcon = getSpinIcon();

  return (
    <div
      className={itemClass}
      onClick={onClick}
      title={`MO ${orbital.index}${spinLabel}: ${orbital.energy.toFixed(4)} eV (occupation: ${orbital.occupation})`}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className={styles.orbitalContent}>
        <div className={styles.orbitalEnergy}>
          {spinIcon && <span className={styles.spinIcon}>{spinIcon}</span>}
          {energyInHartree.toFixed(4)} Eh
        </div>
        <div className={styles.orbitalEnergyEV}>
          {orbital.energy.toFixed(4)} eV
        </div>
        {(isHOMO || isLUMO) && (
          <div className={styles.orbitalLabel}>
            {isHOMO ? 'HOMO' : 'LUMO'}
          </div>
        )}
      </div>
      <div className={styles.orbitalIndicators}>
        {colorIndicator && (
          isSelected ? (
            <input
              type="color"
              value={colorIndicator}
              onChange={(e) => {
                e.stopPropagation();
                onColorChange?.(e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              className={styles.orbitalColorPicker}
              title={`Change color for MO ${orbital.index}`}
            />
          ) : (
            <div
              className={styles.orbitalColorIndicator}
              style={{ backgroundColor: colorIndicator }}
              title={`Last used color: ${colorIndicator}`}
            />
          )
        )}
      </div>
    </div>
  );
};

export default OrbitalItem;