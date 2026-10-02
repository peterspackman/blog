import React from 'react';
import QM3DVisualization from '@site/src/components/QM3DVisualization';
import { VizPage } from '@site/src/components/shared/viz';

export default function QM3D() {
    return (
        <VizPage
            titleInPlot
            title="Particle in a 3D box"
            description="Interactive visualization of a 3D quantum particle in a box with volume ray marching"
        >
            <QM3DVisualization title="Particle in a 3D box" />
        </VizPage>
    );
}
