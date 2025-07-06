import React from 'react';
import Layout from '@theme/Layout';
import { CrystalProvider, CrystalViewer3D, CrystalControls } from '@site/src/components/Crystal';
import { CustomCrystalStructure } from '@site/src/components/Crystal/types';

// NaCl structure
const testCustomStructure: CustomCrystalStructure = {
  name: 'Sodium Chloride (NaCl)',
  description: 'Rock salt structure - face-centered cubic',
  formula: 'NaCl',
  unitCell: {
    a: 5.64,
    b: 5.64,
    c: 5.64,
    alpha: 90,
    beta: 90,
    gamma: 90
  },
  atoms: [
    // Na atoms at FCC positions
    { element: 'Na', position: [0.0, 0.0, 0.0], label: 'Na1' },
    { element: 'Na', position: [0.0, 0.5, 0.5], label: 'Na2' },
    { element: 'Na', position: [0.5, 0.0, 0.5], label: 'Na3' },
    { element: 'Na', position: [0.5, 0.5, 0.0], label: 'Na4' },
    // Cl atoms at FCC positions offset by (0.5, 0.5, 0.5)
    { element: 'Cl', position: [0.5, 0.5, 0.5], label: 'Cl1' },
    { element: 'Cl', position: [0.5, 0.0, 0.0], label: 'Cl2' },
    { element: 'Cl', position: [0.0, 0.5, 0.0], label: 'Cl3' },
    { element: 'Cl', position: [0.0, 0.0, 0.5], label: 'Cl4' }
  ],
  spaceGroup: 'Fm-3m'
};

export default function CustomCrystalTestPage() {
  return (
    <Layout
      title="Custom Crystal Structure Test"
      description="Testing custom crystal structure functionality">
      <main style={{ padding: '2rem' }}>
        <h1>Custom Crystal Structure Test</h1>
        <p>This page demonstrates the custom crystal structure functionality with atom filtering options.</p>
        
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f0f8ff', borderRadius: '8px' }}>
          <h3>Try these features:</h3>
          <ul>
            <li><strong>Atom Display Mode:</strong> Switch between "All Atoms", "Unit Cell Only", or "Custom Range"</li>
            <li><strong>Element Filtering:</strong> Try showing only Na or Cl atoms by typing the element symbol in "Show Elements"</li>
            <li><strong>Hide Elements:</strong> Hide specific elements by typing them in "Hide Elements"</li>
            <li><strong>Representations:</strong> Switch between ball+stick, spacefill, and other visualization styles</li>
          </ul>
        </div>
        
        <div style={{ margin: '2rem 0' }}>
          <CrystalProvider customStructure={testCustomStructure}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'nowrap' }}>
              <div style={{ width: '70%', flexShrink: 0 }}>
                <CrystalViewer3D height="500px" />
              </div>
              <div style={{ width: '30%', flexShrink: 0 }}>
                <CrystalControls />
                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                  <h4>Custom Structure Info</h4>
                  <p><strong>Name:</strong> {testCustomStructure.name}</p>
                  <p><strong>Formula:</strong> {testCustomStructure.formula}</p>
                  <p><strong>Unit Cell:</strong> a={testCustomStructure.unitCell.a}Å</p>
                  <p><strong>Atoms:</strong> {testCustomStructure.atoms.length}</p>
                </div>
              </div>
            </div>
          </CrystalProvider>
        </div>
      </main>
    </Layout>
  );
}