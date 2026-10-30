import React, { useEffect, useState } from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { VizButton } from '@site/src/components/shared/controls';
import { VizPage } from '@site/src/components/shared/viz';
import WavefunctionCalculator from '@site/src/components/WavefunctionCalculator';
import { AboutDialog, CreditLine } from '@site/src/components/WavefunctionCalculator/About';

const TITLE = 'Wavefunction calculator';

export default function WavefunctionCalculatorPage() {
    const { siteConfig } = useDocusaurusContext();
    const occVersion = siteConfig.customFields?.occVersion as string | undefined;
    const [aboutOpen, setAboutOpen] = useState(false);

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
        <VizPage
            title={TITLE}
            description="Hartree–Fock, DFT and GFN2-xTB calculations with orbitals, density and electrostatic surfaces, and vibrational modes, run in your browser"
            intro="Hartree–Fock, DFT and GFN2-xTB on small molecules: orbitals, density and electrostatic surfaces, and vibrational modes, computed in your browser."
            actions={
                <VizButton size="sm" variant="ghost" onClick={() => setAboutOpen(true)}>
                    About
                </VizButton>
            }
        >
            <BrowserOnly fallback={<p>Loading the calculator…</p>}>{() => <WavefunctionCalculator occVersion={occVersion} />}</BrowserOnly>
            <CreditLine occVersion={occVersion} onAbout={() => setAboutOpen(true)} />
            <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} occVersion={occVersion} />
        </VizPage>
    );
}
