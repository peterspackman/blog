import React from 'react';
import Layout from '@theme/Layout';
import { SmilesViewer } from '../../components/SmilesViewer';

export default function SmilesViewerPage(): React.JSX.Element {
  return (
    <Layout
      title="Molecule Viewer"
      description="Visualize molecular structures from SMILES strings"
    >
      <main style={{ minHeight: 'calc(100vh - 60px)' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          padding: '0.5rem 1rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
          margin: '1rem',
          marginBottom: '1.5rem'
        }}>
          <small style={{ color: 'var(--ifm-color-emphasis-600)', marginLeft: 'auto' }}>
            Powered by <a href="https://www.rdkit.org/docs/JSMol.html" target="_blank" rel="noopener noreferrer">RDKit.js</a>
          </small>
        </div>
        <SmilesViewer />
      </main>
    </Layout>
  );
}