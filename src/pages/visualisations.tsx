import React from 'react';
import { CardIndex, type IndexCard } from '@site/src/components/shared/viz/CardIndex';
import { VIZ_THUMBS } from '@site/src/components/shared/viz/VizThumbs';

type Category = 'Quantum' | 'Crystallography' | 'Simulation';

const CATEGORY_ORDER: Category[] = ['Quantum', 'Crystallography', 'Simulation'];

const VISUALISATIONS: (IndexCard & { tag: Category })[] = [
  {
    title: 'Schrödinger equation in 1D',
    href: '/qm1d',
    tag: 'Quantum',
    description: 'Stationary states and time evolution in harmonic, box, double-well, Morse and lattice potentials.',
  },
  {
    title: 'Particle in a 2D box',
    href: '/qm2d',
    tag: 'Quantum',
    description: 'Superpositions of stationary states in a square box, shown as evolving probability densities.',
  },
  {
    title: 'Particle in a 3D box',
    href: '/qm3d',
    tag: 'Quantum',
    description: 'Probability clouds of a particle in a cubic box, rendered by volume ray marching.',
  },
  {
    title: 'Spherical harmonics and hydrogen orbitals',
    href: '/spherical-harmonics',
    tag: 'Quantum',
    description:
      'Separation of variables for central potentials: angular and radial parts, real and complex orbitals, and their linear combinations.',
  },
  {
    title: 'Bands from molecular orbitals',
    href: '/bandstructure',
    tag: 'Quantum',
    description: 'Hückel chains and rings: discrete MO levels merging into a band, with filling, doping and Peierls gaps.',
  },
  {
    title: "Bragg's law",
    href: '/bragg',
    tag: 'Crystallography',
    description: 'Reflections from crystal planes, path difference and how intensity peaks sharpen with more planes.',
  },
  {
    title: 'X-ray diffraction',
    href: '/diffraction',
    tag: 'Crystallography',
    description: 'X-ray diffraction patterns, reciprocal lattice, and electron density.',
  },
  {
    title: 'Wulff construction',
    href: '/wulff',
    tag: 'Crystallography',
    description: 'Equilibrium crystal shapes from surface energies, in 2D and 3D, from cubes to needles to droplets.',
  },
  {
    title: 'Molecular dynamics',
    href: '/md',
    tag: 'Simulation',
    description: 'Real-time Lennard-Jones and Coulomb dynamics: argon, condensation, NaCl, mixing and ions in a field.',
  },
  {
    title: 'Grand canonical Monte Carlo',
    href: '/gcmc',
    tag: 'Simulation',
    description: 'Particle insertion and deletion at fixed chemical potential: adsorption in pores, a model zeolite and on charged surfaces.',
  },
  {
    title: 'Fourier transform',
    href: '/fourier',
    tag: 'Crystallography',
    description: '2D Fourier transforms with pattern drawing and wallpaper symmetry.',
  },
];

export default function Visualisations() {
  const sections = CATEGORY_ORDER.map((tag) => ({
    title: tag,
    cards: VISUALISATIONS.filter((card) => card.tag === tag).map((card) => {
      const Thumb = VIZ_THUMBS[card.href];
      return Thumb ? { ...card, preview: <Thumb /> } : card;
    }),
  }));
  return (
    <CardIndex
      title="Visualisations"
      description="Interactive physics and chemistry visualisations"
      intro="Interactive explorations of physics and chemistry concepts."
      sections={sections}
    />
  );
}
