import React, { useEffect } from 'react';
import Layout from '@theme/Layout';
import WavefunctionCalculator from '@site/src/components/WavefunctionCalculator';

export default function WavefunctionCalculatorPage() {
  useEffect(() => {
    // Load coi-serviceworker for COOP/COEP headers needed by WASM
    const script = document.createElement('script');
    script.src = '/coi-serviceworker.js';
    script.async = true;
    document.head.appendChild(script);

    return () => {
      // Cleanup on unmount
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

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