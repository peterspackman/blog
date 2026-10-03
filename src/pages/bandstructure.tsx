import React from 'react';
import BandStructure from '@site/src/components/bandstructure/BandStructure';
import { VizPage } from '@site/src/components/shared/viz';

export default function BandStructurePage() {
    return (
        <VizPage
            titleInPlot
            title="Bands from molecular orbitals"
            description="Hückel model of polyene chains and rings: how discrete molecular orbital levels become an energy band, with filling, doping and Peierls distortion"
        >
            <BandStructure title="Bands from molecular orbitals" />
        </VizPage>
    );
}
