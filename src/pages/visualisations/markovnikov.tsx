import React from 'react';
import Markovnikov from '@site/src/components/markovnikov/Markovnikov';
import { VizPage } from '@site/src/components/shared/viz';

export default function MarkovnikovPage() {
    return (
        <VizPage
            titleInPlot
            title="Markovnikov's rule"
            description="HBr adding to propene both ways along GFN2-xTB NEB paths: why the proton goes to the CH₂ end"
        >
            <Markovnikov title="Markovnikov's rule" />
        </VizPage>
    );
}
