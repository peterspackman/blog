import React from 'react';
import styles from './Paper.module.css';

interface PaperAbstractProps {
  children: React.ReactNode;
  keywords?: string[];
  className?: string;
}

const PaperAbstract: React.FC<PaperAbstractProps> = ({
  children,
  keywords,
  className = ''
}) => {
  return (
    <section className={`${styles.abstract} ${className}`}>
      <h2 className={styles.abstractTitle}>Abstract</h2>
      <div className={styles.abstractText}>{children}</div>
      {keywords && keywords.length > 0 && (
        <div className={styles.keywords}>
          <strong>Keywords:</strong>
          <div className={styles.keywordList}>
            {keywords.map((keyword, index) => (
              <span key={index} className={styles.keyword}>
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default PaperAbstract;