import React from 'react';
import { CardIndex, type IndexSection } from '@site/src/components/shared/viz/CardIndex';

const SECTIONS: IndexSection[] = [
  {
    title: 'Quantum chemistry',
    cards: [
      {
        title: 'Wavefunction calculator',
        href: '/utilities/wavefunction-calculator',
        description: 'Hartree–Fock and DFT in the browser: energies, orbitals, geometry optimisation and frequencies.',
      },
      {
        title: 'Elastic tensor analysis',
        href: '/utilities/elastic-tensor',
        description: "Mechanical properties from a 6×6 elastic tensor, with directional Young's modulus, shear and Poisson's ratio.",
      },
    ],
  },
  {
    title: 'Simulation',
    cards: [
      {
        title: 'LAMMPS in the browser',
        href: '/utilities/lammps-interface',
        description: 'Run LAMMPS input scripts with WebAssembly, then plot thermo output and view the trajectory.',
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
      intro="Chemistry tools that run entirely in your browser. Nothing is uploaded: calculations run locally with WebAssembly."
      sections={SECTIONS}
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
