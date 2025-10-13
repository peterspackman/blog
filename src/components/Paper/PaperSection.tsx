import React from 'react';
import styles from './Paper.module.css';

interface PaperSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

const PaperSection: React.FC<PaperSectionProps> = ({
  title,
  children,
  className = ''
}) => {
  return (
    <section className={`${styles.section} ${className}`}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div>{children}</div>
    </section>
  );
};

export default PaperSection;