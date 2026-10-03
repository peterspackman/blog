import React, { useEffect } from 'react';
import { VizPage } from '@site/src/components/shared/viz';
import WavefunctionCalculator from '@site/src/components/WavefunctionCalculator';

const TITLE = 'Wavefunction calculator';

export default function WavefunctionCalculatorPage() {
  useEffect(() => {
    // coi-serviceworker sets the COOP/COEP headers the WASM threads need. It
    // declares globals, so inject it at most once per document.
    if (document.querySelector('script[src="/coi-serviceworker.js"]')) return;
    const script = document.createElement('script');
    script.src = '/coi-serviceworker.js';
    script.async = true;
    document.head.appendChild(script);
  }, []);

  return (
    <VizPage title={TITLE} description="Quantum chemistry calculations in your browser" titleInPlot>
      <WavefunctionCalculator title={TITLE} />
    </VizPage>
  );
}
