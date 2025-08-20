import React, { useState } from 'react';
import Layout from '@theme/Layout';
import { InfiniteMolecules } from '../../components/SelfiesGenerator/InfiniteMolecules';

export default function InfiniteMoleculesPage(): React.JSX.Element {
  const [symbolLength, setSymbolLength] = useState(10);
  
  return (
    <Layout
      title="Chemical Space Explorer"
      description="Systematically browse through all possible molecular structures using SELFIES enumeration"
    >
      <main style={{ minHeight: 'calc(100vh - 60px)' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 1rem',
          flexWrap: 'wrap',
          gap: '1rem',
          margin: '1rem',
          marginBottom: '0',
          borderBottom: '1px solid var(--ifm-color-emphasis-200)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 style={{ marginBottom: 0, fontSize: '1.5rem' }}>Chemical Space Explorer</h1>
            <small style={{ color: 'var(--ifm-color-emphasis-600)' }}>
              Browse all N^M possible molecules
            </small>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label htmlFor="symbol-length" style={{ 
              fontSize: '0.9rem',
              color: 'var(--ifm-color-emphasis-700)',
              fontWeight: 500
            }}>
              Complexity:
            </label>
            <select
              id="symbol-length"
              value={symbolLength}
              onChange={(e) => setSymbolLength(parseInt(e.target.value))}
              style={{
                padding: '0.25rem 0.5rem',
                border: '1px solid var(--ifm-color-emphasis-300)',
                borderRadius: 'var(--ifm-button-border-radius)',
                background: 'var(--ifm-background-color)',
                color: 'var(--ifm-font-color-base)',
                fontSize: '0.9rem'
              }}
            >
              <option value={6}>Simple (6 symbols)</option>
              <option value={10}>Medium (10 symbols)</option>
              <option value={20}>Complex (20 symbols)</option>
              <option value={100}>Very Complex (100 symbols)</option>
            </select>
          </div>
        </div>
        
        <InfiniteMolecules symbolLength={symbolLength} batchSize={8} />
        
        <div style={{ 
          maxWidth: '800px', 
          margin: '2rem auto', 
          padding: '0 1rem',
          textAlign: 'center'
        }}>
          <div className="card" style={{ padding: '2rem' }}>
            <h2>About Every Molecule</h2>
            <p>
              This infinite scroll generates random molecular structures using SELFIES 
              (Self-Referencing Embedded Strings). Each molecule is guaranteed to be 
              chemically valid, making this perfect for exploring chemical space.
            </p>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '2rem',
              marginTop: '2rem',
              textAlign: 'left'
            }}>
              <div>
                <h3>✨ Features</h3>
                <ul>
                  <li><strong>Infinite Scroll:</strong> Generates molecules as you scroll</li>
                  <li><strong>Visual Structures:</strong> Interactive 2D molecular diagrams</li>
                  <li><strong>Copy to Clipboard:</strong> Click any SELFIES or SMILES string</li>
                  <li><strong>Adjustable Complexity:</strong> Control molecule size</li>
                </ul>
              </div>
              
              <div>
                <h3>🧪 Technical Details</h3>
                <ul>
                  <li><strong>SELFIES:</strong> 100% valid molecule generation</li>
                  <li><strong>RDKit.js:</strong> Client-side molecular visualization</li>
                  <li><strong>Smart Generation:</strong> Chemically sensible random structures</li>
                  <li><strong>Performance:</strong> Lazy loading and efficient rendering</li>
                </ul>
              </div>
            </div>
            
            <div style={{ marginTop: '2rem' }}>
              <h3>Usage Tips</h3>
              <ul style={{ textAlign: 'left', maxWidth: '600px', margin: '0 auto' }}>
                <li>Scroll down to generate more molecules</li>
                <li>Click any SELFIES or SMILES string to copy it to clipboard</li>
                <li>Adjust symbol length to control molecular complexity</li>
                <li>All molecules are guaranteed to be chemically valid</li>
                <li>Use these molecules for research, education, or inspiration</li>
              </ul>
            </div>
            
            <div className="alert alert--info" style={{ marginTop: '2rem', textAlign: 'left' }}>
              <strong>Note:</strong> This generator creates random molecules for exploration and 
              educational purposes. For drug discovery or serious chemical research, use more 
              sophisticated molecular generation tools with specific constraints and objectives.
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}