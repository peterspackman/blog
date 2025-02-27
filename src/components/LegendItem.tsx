import React, { useState, useEffect, useRef } from 'react';
import styles from './QMVisualization.module.css';

const LegendItem = ({ color, text, active, onClick }) => {
  return (
    <div 
      className={`${styles.legendItem} ${active ? styles.active : styles.inactive}`}
      onClick={onClick}
    >
      <div 
        className={styles.legendColorSwatch}
        style={{ backgroundColor: color }}
      ></div>
      <span className={styles.legendText}>{text}</span>
    </div>
  );
};


export default LegendItem;
