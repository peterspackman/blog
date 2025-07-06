
import React from 'react';
import Layout from '@theme/Layout';
import { CrystalProvider, CrystalStructureProvider, CrystalViewer3D, CrystalControlsWithStructures } from '@site/src/components/Crystal';
import styles from './qm-visualizations.module.css';

export default function CrystalPage() {
  return (
    <Layout
      title="Crystal Structures"
      description="Interactive visualizations of crystal structures">
      <main className={styles.mainContainer} style={{ width: '100%' }}>
        <div className={styles.centeredVisualization}>
          <CrystalStructureProvider>
            <CrystalProvider>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'nowrap' }}>
                <div style={{ width: '70%', flexShrink: 0 }}>
                  <CrystalViewer3D height="600px" />
                </div>
                <div style={{ width: '30%', flexShrink: 0 }}>
                  <CrystalControlsWithStructures />
                </div>
              </div>
            </CrystalProvider>
          </CrystalStructureProvider>
        </div>
      </main>
    </Layout>
  );
}
