import React from 'react';
import { CardIndex, type IndexSection } from '@site/src/components/shared/viz/CardIndex';
import { UTILITY_THUMBS } from '@site/src/components/shared/viz/UtilityThumbs';

const SECTIONS: IndexSection[] = [
  {
    title: 'Quantum chemistry',
    cards: [
      {
        title: 'Wavefunction calculator',
        href: '/utilities/wavefunction-calculator',
        description: 'HF and DFT with OCC, plus orbitals, geometry optimisations and frequencies.',
      },
      {
        title: 'Elastic tensor analysis',
        href: '/utilities/elastic-tensor',
        description: 'Paste a 6×6 stiffness matrix and see how the moduli vary with direction.',
      },
    ],
  },
  {
    title: 'Simulation',
    cards: [
      {
        title: 'LAMMPS in the browser',
        href: '/utilities/lammps-interface',
        description: 'Run an input script, plot the thermo output, watch the trajectory.',
      },
      {
        title: 'Trajectory viewer',
        href: '/utilities/xyz-trajectory',
        description: 'Play back optimisation paths and MD trajectories from multi-frame XYZ files, with unit cells.',
      },
    ],
  },
  {
    title: 'Molecules',
    cards: [
      {
        title: 'SMILES viewer',
        href: '/utilities/smiles-viewer',
        description: 'Draw 2D structures from SMILES strings with RDKit.js.',
      },
      {
        title: 'Infinite molecules',
        href: '/utilities/infinite-molecules',
        description: 'Generate random valid molecules from SELFIES strings and browse them as a scrolling grid.',
      },
    ],
  },
];

export default function Utilities() {
  return (
    <CardIndex
      title="Utilities"
      description="Interactive chemistry tools that run entirely in your browser"
      intro="Chemistry tools that run in your browser. Everything runs locally with WebAssembly, so nothing gets uploaded anywhere."
      sections={SECTIONS.map((section) => ({
        ...section,
        cards: section.cards.map((card) => {
          const Thumb = UTILITY_THUMBS[card.href];
          return Thumb ? { ...card, preview: <Thumb /> } : card;
        }),
      }))}
      footer={
        <p>
          Built with <a href="https://getocc.xyz">OCC</a> for quantum chemistry,{' '}
          <a href="https://www.rdkit.org/">RDKit.js</a> for cheminformatics, <a href="https://www.lammps.org/">LAMMPS</a>{' '}
          for molecular dynamics and <a href="https://nglviewer.org/">NGL</a> for 3D structures.
        </p>
      }
    />
  );
}
