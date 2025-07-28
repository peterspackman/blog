
import React, { useState } from 'react';
import Layout from '@theme/Layout';
import WaveInterferenceVisualization from '@site/src/components/Bragg';
import styles from './qm-visualizations.module.css';

export default function QM1D() {
  const [activeVisualization, setActiveVisualization] = useState<'1D' | '2D'>('1D');

  return (
    <Layout
      title="Bragg scattering"
      description="Interactive visualizations of Bragg interference">
      <main className={styles.mainContainer}>
        <div className={styles.visualizationContainer}>
          <div className={styles.visualization}>
            <WaveInterferenceVisualization className={styles.centeredVisualization} />
          </div>
        </div>
      </main>
    </Layout>
  );
}
