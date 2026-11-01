import React from 'react';
import ChairFlip from '@site/src/components/chairFlip/ChairFlip';
import { VizPage } from '@site/src/components/shared/viz';

export default function ChairFlipPage() {
    return (
        <VizPage
            titleInPlot
            title="Cyclohexane ring flip"
            description="The chair flip of methylcyclohexane along a GFN2-xTB NEB path: half-chair and boat transition states, twist-boats and the axial/equatorial methyl"
        >
            <ChairFlip title="Cyclohexane ring flip" />
        </VizPage>
    );
}
