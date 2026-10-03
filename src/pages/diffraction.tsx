import React from 'react';
import DiffractionVisualization from '@site/src/components/DiffractionVisualization';
import { VizPage } from '@site/src/components/shared/viz';

export default function DiffractionPage() {
    return (
        <VizPage
            titleInPlot
            title="X-ray diffraction"
            description="Interactive X-ray diffraction: crystal structure, reciprocal lattice, detector images, powder patterns and electron density"
        >
            <DiffractionVisualization title="X-ray diffraction" />
        </VizPage>
    );
}
