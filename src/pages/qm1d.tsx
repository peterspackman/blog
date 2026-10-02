import React from 'react';
import QMVisualization1D from '@site/src/components/QMVisualization1D';
import { VizPage } from '@site/src/components/shared/viz';

export default function QM1D() {
    return (
        <VizPage
            titleInPlot
            title="Schrödinger equation in 1D"
            description="Interactive visualization of quantum wavefunctions in 1D potentials"
        >
            <QMVisualization1D title="Schrödinger equation in 1D" />
        </VizPage>
    );
}
