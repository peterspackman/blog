import React from 'react';
import styles from './Paper.module.css';

interface PaperAcknowledgementsProps {
  children: React.ReactNode;
  className?: string;
}

const PaperAcknowledgements: React.FC<PaperAcknowledgementsProps> = ({
  children,
  className = ''
}) => {
  return (
    <section className={`${styles.section} ${className}`}>
      <h3 className={styles.sectionTitle}>Acknowledgements</h3>
      <div className={styles.acknowledgements}>
        {children}
      </div>
    </section>
  );
};

export default PaperAcknowledgements;