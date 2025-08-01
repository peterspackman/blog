import React from 'react';
import styles from './OrbitalItem.module.css';

interface OrbitalItemProps {
  orbital: {
    index: number;
    energy: number; // in eV
    occupation: number;
    isOccupied: boolean;
  };
  isHOMO?: boolean;
  isLUMO?: boolean;
  isSelected?: boolean;
  colorIndicator?: string;
  onClick?: () => void;
  className?: string;
}

const OrbitalItem: React.FC<OrbitalItemProps> = ({
  orbital,
  isHOMO = false,
  isLUMO = false,
  isSelected = false,
  colorIndicator,
  onClick,
  className = ''
}) => {
  const energyInHartree = orbital.energy / 27.2114;

  return (
    <div
      className={`${styles.orbitalItem} ${orbital.isOccupied ? styles.orbitalOccupied : styles.orbitalVirtual} ${isSelected ? styles.orbitalSelected : ''} ${className}`}
      onClick={onClick}
      title={`MO ${orbital.index}: ${orbital.energy.toFixed(3)} eV (occupation: ${orbital.occupation})`}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className={styles.orbitalContent}>
        <div className={styles.orbitalEnergy}>
          {energyInHartree.toFixed(6)} Eh
        </div>
        <div className={styles.orbitalEnergyEV}>
          {orbital.energy.toFixed(3)} eV
        </div>
        {(isHOMO || isLUMO) && (
          <div className={styles.orbitalLabel}>
            {isHOMO ? 'HOMO' : 'LUMO'}
          </div>
        )}
      </div>
      <div className={styles.orbitalIndicators}>
        {orbital.occupation > 0 && (
          <div className={styles.occupationBadge}>
            {orbital.occupation === 2.0 ? '↑↓' : orbital.occupation === 1.0 ? '↑' : ''}
          </div>
        )}
        {colorIndicator && (
          <div 
            className={styles.orbitalColorIndicator}
            style={{ backgroundColor: colorIndicator }}
            title={`Plotted in ${colorIndicator}`}
          />
        )}
      </div>
    </div>
  );
};

export default OrbitalItem;