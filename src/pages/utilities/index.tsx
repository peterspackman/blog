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
        
        <div className="row margin-top--lg">
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
                <h3>More Tools Coming Soon</h3>
              </div>
              <div className="card__body">
                <p>
                  Additional quantum chemistry utilities and visualization tools 
                  will be added here. Stay tuned for molecular orbital viewers, 
                  basis set explorers, and more!
                </p>
              </div>
              <div className="card__footer">
                <button className="button button--secondary button--block" disabled>
                  Coming Soon
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="margin-top--xl">
          <h2>About These Tools</h2>
          <p>
            All utilities are powered by <a href="https://github.com/peterspackman/occ" target="_blank" rel="noopener noreferrer">
            OCC (Open Computational Chemistry)</a>, an open-source quantum chemistry 
            library compiled to WebAssembly. Calculations run entirely in your browser 
            with no data sent to any server.
          </p>
        </div>
      </main>
    </Layout>
  );
}