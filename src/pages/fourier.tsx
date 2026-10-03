import React from 'react';
import FourierVisualization from '@site/src/components/FourierVisualization';
import { VizPage } from '@site/src/components/shared/viz';

export default function FourierPage() {
    return (
        <VizPage
            titleInPlot
            title="Fourier transform"
            description="Interactive 2D Fourier transform visualization for building intuition about spatial frequencies"
        >
            <FourierVisualization title="Fourier transform" />
        </VizPage>
    );
}
