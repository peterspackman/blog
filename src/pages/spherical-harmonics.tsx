import Layout from '@theme/Layout';
import SphericalHarmonicsViewer from '@site/src/components/SphericalHarmonicsViewer';
import styles from './qm-visualizations.module.css';

export default function QMVisualizations(): JSX.Element {
  return (
    <Layout
      title="Quantum Mechanics Visualizations"
      description="Interactive visualizations of quantum mechanics concepts">
      <main className={styles.mainContainer}>
        <div className={styles.visualizationContainer}>
          <div className={styles.visualization}>
            <SphericalHarmonicsViewer className={styles.centeredVisualization} />
          </div>
        </div>
      </main>
    </Layout>

  );
}
