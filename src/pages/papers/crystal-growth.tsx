import React, { useEffect } from 'react';
import Layout from '@theme/Layout';
import CrystalGrowthPaper from '@site/src/components/crystalGrowth/CrystalGrowthPaper';

export default function CrystalGrowthPaperPage() {
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
        <Layout
            title="Predicting molecular crystal growth"
            description="Interactive version of our Crystal Growth & Design paper: a full occ cg crystal growth calculation on paracetamol with GFN2-xTB, running in the browser"
        >
            <CrystalGrowthPaper />
        </Layout>
    );
}
