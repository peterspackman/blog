import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import styles from './utilities.module.css';

const utilities = [
  {
    title: 'Wavefunction Calculator',
    description: 'Perform quantum chemistry calculations (HF, DFT) directly in your browser. Compute energies, orbitals, and molecular properties.',
    href: '/utilities/wavefunction-calculator'
  },
  {
    title: 'XYZ Trajectory Viewer',
    description: 'Visualize molecular trajectories and animations. Support for optimization paths, MD simulations, and unit cell visualization.',
    href: '/utilities/xyz-trajectory'
  },
  {
    title: 'Elastic Tensor Analysis',
    description: 'Analyze elastic tensors and mechanical properties. Interactive 2D/3D visualizations of directional dependencies.',
    href: '/utilities/elastic-tensor'
  },
  {
    title: 'SMILES Viewer',
    description: 'Convert SMILES strings to molecular structures. Instant 2D visualization powered by RDKit.js.',
    href: '/utilities/smiles-viewer'
  },
  {
    title: 'LAMMPS Interface',
    description: 'Run LAMMPS molecular dynamics simulations directly in your browser. Upload input files and run simulations using WebAssembly.',
    href: '/utilities/lammps-interface'
  }
];

function UtilityCard({ utility }: { utility: typeof utilities[0] }) {
  return (
    <div className="col col--6 margin-bottom--lg">
      <div className={`card ${styles.utilityCard}`}>
        <div className={`card__header ${styles.cardHeader}`}>
          <h3 className={styles.cardTitle}>{utility.title}</h3>
        </div>
        <div className={`card__body ${styles.cardBody}`}>
          <p className={styles.cardDescription}>{utility.description}</p>
        </div>
        <div className={`card__footer ${styles.cardFooter}`}>
          <Link
            className="button button--primary button--block"
            to={utility.href}>
            Open Tool
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Utilities() {
  return (
    <Layout
      title="Utilities"
      description="Interactive Quantum Chemistry Tools and Calculators">
      <main className={styles.utilitiesMain}>
        <div className="container">
          <div className={styles.heroSection}>
            <h1 className={styles.heroTitle}>
              Quantum Chemistry Utilities
            </h1>
            <p className={styles.heroSubtitle}>
              Interactive tools and calculators running entirely in your browser using WebAssembly
            </p>
          </div>

          <div className={styles.utilitiesSection}>
            <div className="row">
              {utilities.map((utility, idx) => (
                <UtilityCard key={idx} utility={utility} />
              ))}
            </div>
          </div>

          <div className={styles.infoSection}>
            <h2>Technologies</h2>
            <p>
              These tools are powered by <a href="https://github.com/peterspackman/occ" target="_blank" rel="noopener noreferrer">OCC (Open Computational Chemistry)</a> for quantum chemistry calculations, 
              <a href="https://www.rdkit.org/" target="_blank" rel="noopener noreferrer"> RDKit.js</a> for molecular structure manipulation, 
              and <a href="https://nglviewer.org/" target="_blank" rel="noopener noreferrer"> NGL Viewer</a> for 3D visualization.
              All computations run locally in your browser.
            </p>
          </div>
        </div>
      </main>
    </Layout>
  );
}