import React, { useState } from 'react';
import styles from './MatrixDisplay.module.css';

interface MatrixData {
  rows: number;
  cols: number;
  data: number[][];
}

interface MatrixDisplayProps {
  matrix: MatrixData;
  title: string;
  precision?: number;
  maxDisplaySize?: number;
}

const MatrixDisplay: React.FC<MatrixDisplayProps> = ({ 
  matrix, 
  title, 
  precision = 6,
  maxDisplaySize = 8 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullMatrix, setShowFullMatrix] = useState(false);

  if (!matrix || !matrix.data) {
    return (
      <div className={styles.matrixContainer}>
        <h4>{title}</h4>
        <p>Matrix data not available</p>
      </div>
    );
  }

  const { rows, cols, data } = matrix;
  const isLarge = rows > maxDisplaySize || cols > maxDisplaySize;
  
  // Determine what portion of the matrix to show
  const displayRows = showFullMatrix ? rows : Math.min(rows, maxDisplaySize);
  const displayCols = showFullMatrix ? cols : Math.min(cols, maxDisplaySize);

  const formatNumber = (num: number) => {
    if (Math.abs(num) < 1e-10) return '0.000000';
    return num.toFixed(precision);
  };

  const downloadMatrix = () => {
    const csvContent = data.map(row => 
      row.map(val => formatNumber(val)).join(',')
    ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '_')}_matrix.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.matrixContainer}>
      <div className={styles.header}>
        <h4>{title}</h4>
        <div className={styles.controls}>
          <span className={styles.dimensions}>{rows} × {cols}</span>
          {isLarge && (
            <button 
              className={styles.toggleButton}
              onClick={() => setShowFullMatrix(!showFullMatrix)}
            >
              {showFullMatrix ? 'Show Preview' : 'Show Full'}
            </button>
          )}
          <button 
            className={styles.downloadButton}
            onClick={downloadMatrix}
            title="Download as CSV"
          >
            ↓ CSV
          </button>
        </div>
      </div>

      <div className={styles.matrixWrapper}>
        <div 
          className={`${styles.matrix} ${showFullMatrix ? styles.fullMatrix : ''}`}
          style={{
            gridTemplateColumns: `repeat(${displayCols}, 1fr)`
          }}
        >
          {Array.from({ length: displayRows }, (_, i) =>
            Array.from({ length: displayCols }, (_, j) => (
              <div 
                key={`${i}-${j}`} 
                className={styles.matrixElement}
                title={`[${i+1},${j+1}] = ${data[i]?.[j] || 0}`}
              >
                {formatNumber(data[i]?.[j] || 0)}
              </div>
            ))
          )}
        </div>
        
        {isLarge && !showFullMatrix && (
          <div className={styles.truncationNotice}>
            Showing {displayRows} × {displayCols} of {rows} × {cols} matrix
          </div>
        )}
      </div>

      <div className={styles.matrixInfo}>
        <button 
          className={styles.infoToggle}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '▼' : '▶'} Matrix Information
        </button>
        
        {isExpanded && (
          <div className={styles.infoContent}>
            <div><strong>Dimensions:</strong> {rows} rows × {cols} columns</div>
            <div><strong>Total elements:</strong> {rows * cols}</div>
            {data.length > 0 && data[0] && (
              <>
                <div><strong>Max value:</strong> {Math.max(...data.flat()).toFixed(precision)}</div>
                <div><strong>Min value:</strong> {Math.min(...data.flat()).toFixed(precision)}</div>
                <div><strong>Trace (diagonal sum):</strong> {
                  data.reduce((sum, row, i) => sum + (row[i] || 0), 0).toFixed(precision)
                }</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MatrixDisplay;