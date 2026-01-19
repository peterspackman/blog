import React from 'react';
import Layout from '@theme/Layout';
import DiffractionVisualization from '@site/src/components/DiffractionVisualization';
import styles from './qm-visualizations.module.css';

export default function DiffractionPage() {
    return (
        <Layout
            title="X-ray Diffraction Simulator"
            description="Interactive visualization of X-ray diffraction patterns and crystal structures"
        >
            <main className={styles.mainContainerWide}>
                <div className={styles.visualizationContainerFull}>
                    <DiffractionVisualization />
                </div>
            </main>
        </Layout>
    );
}
