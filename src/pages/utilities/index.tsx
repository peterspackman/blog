import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import styles from './utilities.module.css';

export default function Utilities() {
  return (
    <Layout
      title="Utilities"
      description="Quantum Chemistry Utilities and Calculators">
      <main className="container margin-vert--lg">
        <h1>Quantum Chemistry Utilities</h1>
        <p className="lead">
          Interactive tools and calculators for quantum chemistry calculations, 
          running entirely in your browser using WebAssembly.
        </p>
        
        <div className={`row margin-top--lg ${styles.row}`}>
          <div className="col col--6">
            <div className="card">
              <div className="card__header">
                <h3>Wavefunction Calculator</h3>
              </div>
              <div className="card__body">
                <p>
                  Perform quantum chemistry calculations (HF, DFT) on molecules 
                  directly in your browser. Upload XYZ files and compute energies, 
                  orbitals, and molecular properties.
                </p>
              </div>
              <div className="card__footer">
                <Link
                  className="button button--primary button--block"
                  to="/utilities/wavefunction-calculator">
                  Open Calculator
                </Link>
              </div>
            </div>
          </div>
          
          <div className="col col--6">
            <div className="card">
              <div className="card__header">
                <h3>Elastic Tensor Calculator</h3>
              </div>
              <div className="card__body">
                <p>
                  Analyze elastic tensors and calculate mechanical properties.
                  Visualize directional dependencies of elastic properties with 
                  interactive 2D plots and 3D surfaces.
                </p>
              </div>
              <div className="card__footer">
                <Link
                  className="button button--primary button--block"
                  to="/utilities/elastic-tensor">
                  Open Calculator
                </Link>
              </div>
            </div>
          </div>
          
          <div className="col col--6">
            <div className="card">
              <div className="card__header">
                <h3>SMILES Molecule Viewer</h3>
              </div>
              <div className="card__body">
                <p>
                  Visualize molecular structures from SMILES strings.
                  Enter SMILES notation to instantly see 2D molecular
                  structures and properties using RDKit.
                </p>
              </div>
              <div className="card__footer">
                <Link
                  className="button button--primary button--block"
                  to="/utilities/smiles-viewer">
                  Open Viewer
                </Link>
              </div>
            </div>
          </div>
        </div>
        
        <div className="margin-top--xl">
          <h2>About These Tools</h2>
          <p>
            The quantum chemistry calculators are powered by <a href="https://github.com/peterspackman/occ" target="_blank" rel="noopener noreferrer">
            OCC (Open Computational Chemistry)</a>, an open-source quantum chemistry 
            library compiled to WebAssembly. Molecular visualization uses <a href="https://www.rdkit.org/docs/JSMol.html" target="_blank" rel="noopener noreferrer">RDKit.js</a>. 
            All calculations and visualizations run entirely in your browser with no data sent to any server.
          </p>
        </div>
      </main>
    </Layout>
  );
}