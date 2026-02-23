import React from 'react';
import Layout from '@theme/Layout';
import FourierVisualization from '@site/src/components/FourierVisualization';
import styles from './qm-visualizations.module.css';

export default function FourierPage() {
    return (
        <Layout
            title="Fourier Transform Visualizer"
            description="Interactive 2D Fourier transform visualization for building intuition about spatial frequencies"
        >
            <main className={styles.mainContainerWide}>
                <div className={styles.visualizationContainerFull}>
                    <FourierVisualization />
                </div>
            </main>
        </Layout>
    );
}
