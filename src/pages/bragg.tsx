import React from 'react';
import BraggLaw from '@site/src/components/bragg/BraggLaw';
import { VizPage } from '@site/src/components/shared/viz';

export default function BraggPage() {
    return (
        <VizPage
            titleInPlot
            title="Bragg's law"
            description="Interactive Bragg scattering: reflections from crystal planes, path difference, wave interference and intensity against angle"
        >
            <BraggLaw title="Bragg's law" />
        </VizPage>
    );
}
