import React from 'react';
import Layout from '@theme/Layout';
import BandStructureVisualization from '@site/src/components/BandStructureVisualization';
import styles from './qm-visualizations.module.css';

export default function BandStructure() {
  return (
    <Layout
      title="Band Structure Emergence"
      description="Interactive visualization showing how molecular orbital levels merge into energy bands">
      <main className={styles.mainContainerWide}>
        <div className={styles.visualizationContainerFull}>
          <BandStructureVisualization />
        </div>
      </main>
    </Layout>
  );
}
