import Layout from '@theme/Layout';
import OrbitalVisualizer from '@site/src/components/OrbitalVisualizer';
import styles from './qm-visualizations.module.css';

export default function QMVisualizations(): JSX.Element {
  return (
    <Layout
      title="Quantum Mechanics Visualizations"
      description="Interactive visualizations of quantum mechanics concepts">
      <main>
        <h2>Hydrogenic orbitals</h2>
        <OrbitalVisualizer />
      </main>
    </Layout>
  );
}
