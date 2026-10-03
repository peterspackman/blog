import React from 'react';
import { VizPage } from '@site/src/components/shared/viz';
import { ElasticTensor } from '@site/src/components/ElasticTensor';

export default function ElasticTensorPage(): React.JSX.Element {
  return (
    <VizPage
      title="Elastic tensor analysis"
      description="Interactive elastic tensor analysis: averaged moduli, directional extremes and polar and 3D plots of Young's modulus, shear modulus, linear compressibility and Poisson's ratio"
      intro="Paste a 6×6 stiffness matrix to get Voigt–Reuss–Hill averages and see how each modulus varies with direction."
      actions={
        <small>
          Inspired by{' '}
          <a href="https://progs.coudert.name/elate" target="_blank" rel="noopener noreferrer">
            ELATE
          </a>
        </small>
      }
    >
      <ElasticTensor />
    </VizPage>
  );
}
