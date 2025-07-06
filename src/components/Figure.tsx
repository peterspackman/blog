import React from 'react';
import styles from './Figure.module.css';

interface FigureProps {
  src: string;
  alt: string;
  caption?: string;
  width?: string;
  float?: 'left' | 'right' | 'none';
  className?: string;
}

const Figure: React.FC<FigureProps> = ({ 
  src, 
  alt, 
  caption, 
  width = '100%', 
  float = 'none',
  className = ''
}) => {
  const figureStyle = {
    width,
    float: float !== 'none' ? float : undefined,
    marginLeft: float === 'right' ? '1rem' : undefined,
    marginRight: float === 'left' ? '1rem' : undefined,
    marginBottom: '1rem',
    clear: float !== 'none' ? 'both' : undefined
  };

  return (
    <figure className={`${styles.figure} ${className}`} style={figureStyle}>
      <img 
        src={src} 
        alt={alt} 
        style={{ width: '100%', height: 'auto', display: 'block' }}
      />
      {caption && (
        <figcaption className={styles.caption}>{caption}</figcaption>
      )}
    </figure>
  );
};

export default Figure;