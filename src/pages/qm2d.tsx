import React from 'react';
import Layout from '@theme/Layout';
import QM2DVisualization from '@site/src/components/QM2DVisualization';
import styles from './qm-visualizations.module.css';

export default function QM2D() {
  return (
    <Layout
      title="2D Quantum Mechanics"
      description="Interactive visualization of a 2D quantum particle in a box">
      <main className={styles.mainContainerWide}>
        <div className={styles.visualizationContainerFull}>
          <QM2DVisualization />
        </div>
      </main>
    </Layout>
  );
}
