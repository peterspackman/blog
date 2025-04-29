import React, { useState } from 'react';
import Layout from '@theme/Layout';
import MolecularDynamics from '@site/src/components/MolecularDynamics.tsx';
import styles from './qm-visualizations.module.css';

export default function MD(): JSX.Element {
  const [activeVisualization, setActiveVisualization] = useState<'1D' | '2D'>('1D');

  return (
    <Layout
      title="Molecular Dynamics"
      description="Interactive visualizations of molecular dynamics for">
      <main className={styles.mainContainer}>
        <div className={styles.visualizationContainer}>
          <div className={styles.visualization}>
            <MolecularDynamics className={styles.centeredVisualization} />
          </div>
        </div>
      </main>
    </Layout>
  );
}
