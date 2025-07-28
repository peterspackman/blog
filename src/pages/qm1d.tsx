import React, { useState } from 'react';
import Layout from '@theme/Layout';
import QMVisualization1D from '@site/src/components/QMVisualization1D';
import Particle2DBox from '@site/src/components/Particle2DBox';
import styles from './qm-visualizations.module.css';

export default function QM1D() {
  const [activeVisualization, setActiveVisualization] = useState<'1D' | '2D'>('1D');

  return (
    <Layout
      title="1D QM Visualizations"
      description="Interactive visualizations of quantum mechanics concepts in 1D">
      <main className={styles.mainContainer}>
        <div className={styles.visualizationContainer}>
            <div className={styles.visualization}>
              <QMVisualization1D className={styles.centeredVisualization}/>
            </div>
        </div>
      </main>
    </Layout>
  );
}
