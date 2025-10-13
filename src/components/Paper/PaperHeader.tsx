import React from 'react';
import styles from './Paper.module.css';

interface PaperHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

const PaperHeader: React.FC<PaperHeaderProps> = ({
  title,
  subtitle,
  className = ''
}) => {
  return (
    <header className={`${styles.header} ${className}`}>
      <h1 className={styles.title}>{title}</h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </header>
  );
};

export default PaperHeader;