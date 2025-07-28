import React from 'react';
import Layout from '@theme/Layout';
import WavefunctionCalculator from '@site/src/components/WavefunctionCalculator';

export default function WavefunctionCalculatorPage() {
  return (
    <Layout
      title="Wavefunction Calculator"
      description="Quantum Chemistry Calculations in Your Browser">
      <main style={{ minHeight: 'calc(100vh - 60px)' }}>
        <WavefunctionCalculator />
      </main>
    </Layout>
  );
}