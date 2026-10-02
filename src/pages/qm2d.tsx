import React from 'react';
import QM2DVisualization from '@site/src/components/QM2DVisualization';
import { VizPage } from '@site/src/components/shared/viz';

export default function QM2D() {
    return (
        <VizPage
            titleInPlot
            title="Particle in a 2D box"
            description="Interactive visualization of a 2D quantum particle in a box"
        >
            <QM2DVisualization title="Particle in a 2D box" />
        </VizPage>
    );
}
