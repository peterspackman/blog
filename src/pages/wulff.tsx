import React from 'react';
import WulffConstruction from '@site/src/components/wulff/WulffConstruction';
import { VizPage } from '@site/src/components/shared/viz';

export default function WulffPage() {
    return (
        <VizPage
            titleInPlot
            title="Wulff construction"
            description="Equilibrium crystal shapes from surface energies: an interactive 2D Wulff construction and 3D cubic crystal shapes"
        >
            <WulffConstruction title="Wulff construction" />
        </VizPage>
    );
}
