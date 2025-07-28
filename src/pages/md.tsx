import React, { useState } from 'react';
import Layout from '@theme/Layout';
import MolecularDynamics from '@site/src/components/MolecularDynamics';
import styles from './qm-visualizations.module.css';

export default function MD() {
  const [activeVisualization, setActiveVisualization] = useState<'1D' | '2D'>('1D');

  return (
    <Layout
      title="Molecular Dynamics"
      description="Interactive visualizations of molecular dynamics for">
      <main style={{ width: '100%', maxWidth: 'none', padding: 0 }}>
        <MolecularDynamics />
      </main>
    </Layout>
  );
}
