import React from 'react';
import Layout from '@theme/Layout';
import QM3DVisualization from '@site/src/components/QM3DVisualization';
import styles from './qm-visualizations.module.css';

export default function QM3D() {
  return (
    <Layout
      title="3D Quantum Mechanics"
      description="Interactive visualization of a 3D quantum particle in a box with volume ray marching">
      <main className={styles.mainContainerWide}>
        <div className={styles.visualizationContainerFull}>
          <QM3DVisualization />
        </div>
      </main>
    </Layout>
  );
}
