import React, { useState } from 'react';
import Layout from '@theme/Layout';
import Particle2DBox from '@site/src/components/Particle2DBox';
import styles from './qm-visualizations.module.css';

export default function QMVisualizations() {
  const [activeVisualization, setActiveVisualization] = useState<'1D' | '2D'>('1D');

  return (
    <Layout
      title="Quantum Mechanics Visualizations"
      description="Interactive visualizations of quantum mechanics concepts">
      <main className={styles.mainContainer}>
        <div className={styles.visualizationContainer}>
            <div className={styles.visualization}>
              <h2>2D Particle in a Box</h2>
              <Particle2DBox className={styles.centeredVisualization}/>
            </div>
        </div>
      </main>
    </Layout>
  );
}
