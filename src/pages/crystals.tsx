
import React, { useState } from 'react';
import Layout from '@theme/Layout';
import CrystalViewer from '@site/src/components/Crystal.tsx';
import styles from './qm-visualizations.module.css';

export default function Crystal2D(): JSX.Element {
  const [activeVisualization, setActiveVisualization] = useState<'1D' | '2D'>('1D');

  return (
    <Layout
      title="Crystal"
      description="Interactive visualizations of molecular dynamics for">
      <main className={styles.mainContainer} style={{ width: '100%' }}>
        <CrystalViewer className={styles.centeredVisualization} />
      </main>
    </Layout>
  );
}
