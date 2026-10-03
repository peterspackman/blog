import React from 'react';
import { VizPage } from '../../components/shared/viz';
import { SmilesViewer } from '../../components/SmilesViewer';

export default function SmilesViewerPage(): React.JSX.Element {
  return (
    <VizPage
      title="SMILES viewer"
      description="Draw molecular structures from SMILES strings"
      intro={
        <>
          Type a SMILES string to draw its 2D structure and a few common descriptors. Runs in your browser
          with <a href="https://www.rdkit.org/docs/JSMol.html" target="_blank" rel="noopener noreferrer">RDKit.js</a>.
        </>
      }
    >
      <SmilesViewer />
    </VizPage>
  );
}
