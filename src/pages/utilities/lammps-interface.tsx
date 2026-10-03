import React from 'react';
import { VizPage } from '@site/src/components/shared/viz';
import LammpsInterface from '@site/src/components/LammpsInterface';

const TITLE = 'LAMMPS in the browser';

export default function LammpsInterfacePage() {
  return (
    <VizPage
      title={TITLE}
      description="Run LAMMPS molecular dynamics simulations in your browser"
      titleInPlot>
      <LammpsInterface title={TITLE} />
    </VizPage>
  );
}
