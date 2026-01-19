import React from 'react';
import Layout from '@theme/Layout';
import QMVisualization1D from '@site/src/components/QMVisualization1D';
import styles from './qm-visualizations.module.css';

export default function QM1D() {
  return (
    <Layout
      title="1D Quantum Mechanics"
      description="Interactive visualization of quantum wavefunctions in 1D potentials">
      <main className={styles.mainContainerWide}>
        <div className={styles.visualizationContainerFull}>
          <QMVisualization1D />
        </div>
      </main>
    </Layout>
  );
}
