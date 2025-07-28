import React, { useState } from 'react';
import Layout from '@theme/Layout';
import WulffConstruction from '@site/src/components/wulff2d';
import styles from './qm-visualizations.module.css';

export default function Crystal2D() {
  return (
    <Layout
      title="Wulff construction in 2D"
      description="Wulff">
      <main className={styles.mainContainer} style={{ width: '100%' }}>
        <WulffConstruction className={styles.centeredVisualization} />
      </main>
    </Layout>
  );
}
