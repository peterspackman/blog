import React from 'react';
import Layout from '@theme/Layout';
import { ElasticTensor } from '../../components/ElasticTensor';

export default function ElasticTensorPage(): React.JSX.Element {
  return (
    <Layout
      title="Elastic Tensor Calculator"
      description="Interactive elastic tensor analysis tool for calculating elastic properties and visualizations"
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
          <h1 style={{ marginBottom: 0, fontSize: '1.5rem', flex: '1 1 auto' }}>Elastic Tensor Calculator</h1>
          <small style={{ color: 'var(--ifm-color-emphasis-600)', flex: '0 0 auto' }}>
            Inspired by <a href="https://progs.coudert.name/elate" target="_blank" rel="noopener noreferrer">ELATE</a>
          </small>
        </div>
        <ElasticTensor />
      </main>
    </Layout>
  );
}