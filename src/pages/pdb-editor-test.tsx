import React from 'react';
import Layout from '@theme/Layout';
import { CrystalProvider, CrystalViewer3D, CrystalControls, CrystalGUIEditor } from '@site/src/components/Crystal';

export default function CrystalGUIEditorTestPage() {
  return (
    <Layout
      title="Crystal Structure GUI Editor"
      description="Testing the intuitive GUI crystal editor">
      <main style={{ padding: '2rem' }}>
        <h1>Crystal Structure GUI Editor</h1>
        <p>Build crystal structures using an intuitive graphical interface with number inputs and atom tables.</p>
        
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#e7f3ff', borderRadius: '8px' }}>
          <h3>How to use:</h3>
          <ul>
            <li>Select a preset structure or start from scratch</li>
            <li>Adjust unit cell parameters (a, b, c, α, β, γ) using number inputs</li>
            <li>Edit atom positions using fractional coordinates (0.0 to 1.0)</li>
            <li>Add/remove atoms using the table interface</li>
            <li>Click "Apply Structure" to visualize your crystal</li>
          </ul>
        </div>
        
        <div style={{ margin: '2rem 0' }}>
          <CrystalProvider>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Top row: 3D viewer and display controls */}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: '1' }}>
                  <CrystalViewer3D height="500px" />
                </div>
                <div style={{ width: '250px', flexShrink: 0 }}>
                  <CrystalControls />
                </div>
              </div>
              
              {/* Bottom row: Full-width crystal editor */}
              <div style={{ width: '100%' }}>
                <div style={{ 
                  padding: '1rem', 
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '8px', 
                  border: '1px solid #ddd' 
                }}>
                  <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#333' }}>
                    Crystal Structure Builder
                  </h3>
                  <CrystalGUIEditor height="400px" />
                </div>
              </div>
            </div>
          </CrystalProvider>
        </div>

        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
          <h3>Features demonstrated:</h3>
          <ul>
            <li><strong>GUI-based editing:</strong> Number inputs for precise coordinate control</li>
            <li><strong>Unit cell parameters:</strong> Easy adjustment of lattice dimensions and angles</li>
            <li><strong>Atom table:</strong> Add/remove atoms with element and position controls</li>
            <li><strong>Fractional coordinates:</strong> Intuitive 0-1 coordinate system</li>
            <li><strong>Real-time updates:</strong> Instant visualization of structural changes</li>
            <li><strong>Preset structures:</strong> NaCl, BCC, FCC, Simple Cubic starting points</li>
            <li><strong>Cell copying:</strong> See 3x3x3 grid of unit cells or just the central cell</li>
          </ul>
        </div>
      </main>
    </Layout>
  );
}