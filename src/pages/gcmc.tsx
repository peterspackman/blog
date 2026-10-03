import React from 'react';
import GrandCanonicalMC from '@site/src/components/GrandCanonicalMC';
import { VizPage } from '@site/src/components/shared/viz';

export default function GCMCPage() {
    return (
        <VizPage
            titleInPlot
            title="Grand canonical Monte Carlo"
            description="Interactive grand canonical Monte Carlo simulation with insertion, deletion and displacement moves"
        >
            <GrandCanonicalMC title="Grand canonical Monte Carlo" />
        </VizPage>
    );
}
