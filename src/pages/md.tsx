import React from 'react';
import MolecularDynamics from '@site/src/components/MolecularDynamics';
import { VizPage } from '@site/src/components/shared/viz';

export default function MD() {
    return (
        <VizPage
            titleInPlot
            title="Molecular dynamics"
            description="Interactive 2D molecular dynamics with Lennard-Jones and Coulomb interactions, thermostats and external fields"
        >
            <MolecularDynamics title="Molecular dynamics" />
        </VizPage>
    );
}
