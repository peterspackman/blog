import React from 'react';
import styles from './Paper.module.css';

interface PaperFigureProps {
  children: React.ReactNode;
  caption?: string;
  number?: number;
  className?: string;
}

const PaperFigure: React.FC<PaperFigureProps> = ({
  children,
  caption,
  number,
  className = ''
}) => {
  return (
    <figure className={`${styles.figure} ${className}`}>
      <div className={styles.figureContent}>
        {children}
      </div>
      {caption && (
        <figcaption className={styles.figureCaption}>
          {number && <strong>Figure {number}: </strong>}
          {caption}
        </figcaption>
      )}
    </figure>
  );
};

export default PaperFigure;