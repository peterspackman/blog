import React, { useMemo } from 'react';
import clsx from 'clsx';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import styles from './visualisations.module.css';

type Category = 'Quantum' | 'Crystallography' | 'Simulation' | 'Mathematics';

interface VizCard {
  title: string;
  href: string;
  description: string;
  tag: Category;
}

const CATEGORY_ORDER: Category[] = ['Quantum', 'Crystallography', 'Simulation'];

const VISUALISATIONS: VizCard[] = [
  {
    title: 'Schrödinger Equation in 1D',
    href: '/qm1d',
    tag: 'Quantum',
    description: 'Stationary states and time evolution in harmonic, box, double-well, Morse and lattice potentials.',
  },
  {
    title: 'Particle in a 2D Box',
    href: '/qm2d',
    tag: 'Quantum',
    description: 'Superpositions of stationary states in a square box, shown as evolving probability densities.',
  },
  {
    title: 'Particle in a 3D Box',
    href: '/qm3d',
    tag: 'Quantum',
    description: 'Probability clouds of a particle in a cubic box, rendered by volume ray marching.',
  },
  {
    title: 'Spherical Harmonics & Hydrogen Orbitals',
    href: '/spherical-harmonics',
    tag: 'Quantum',
    description:
      'Separation of variables for central potentials: Y_{l,m}(θ,φ), R_{nl}(r), and the full ψ_{nlm} with linear combinations and cartesian pedagogy.',
  },
  {
    title: 'Bands from Molecular Orbitals',
    href: '/bandstructure',
    tag: 'Quantum',
    description: 'Hückel chains and rings: discrete MO levels merging into a band, with filling, doping and Peierls gaps.',
  },
  {
    title: "Bragg's Law",
    href: '/bragg',
    tag: 'Crystallography',
    description: 'Reflections from crystal planes, path difference and how intensity peaks sharpen with more planes.',
  },
  {
    title: 'Diffraction',
    href: '/diffraction',
    tag: 'Crystallography',
    description: 'X-ray diffraction patterns, reciprocal lattice, and electron density.',
  },
  {
    title: 'Wulff Construction',
    href: '/wulff',
    tag: 'Crystallography',
    description: 'Equilibrium crystal shapes from surface energies: the 2D construction and 3D cubic shapes.',
  },
  {
    title: 'Molecular Dynamics',
    href: '/md',
    tag: 'Simulation',
    description: 'Real-time molecular dynamics with interatomic potentials.',
  },
  {
    title: 'Grand Canonical Monte Carlo',
    href: '/gcmc',
    tag: 'Simulation',
    description: 'GCMC simulation with particle insertion, deletion, and displacement moves.',
  },
  {
    title: 'Fourier Transform',
    href: '/fourier',
    tag: 'Crystallography',
    description: '2D Fourier transforms with pattern drawing and wallpaper symmetry.',
  },
];

export default function Visualisations() {
  const grouped = useMemo(() => {
    const groups: Record<string, VizCard[]> = {};
    for (const card of VISUALISATIONS) {
      (groups[card.tag] ??= []).push(card);
    }
    return CATEGORY_ORDER
      .filter((cat) => groups[cat]?.length)
      .map((cat) => ({ category: cat, cards: groups[cat] }));
  }, []);

  return (
    <Layout
      title="Visualisations"
      description="Interactive physics and chemistry visualisations"
    >
      <main className={clsx('container', styles.container)}>
        <div className={styles.header}>
          <h1>Visualisations</h1>
          <p className="hero__subtitle">
            Interactive explorations of physics and chemistry concepts.
          </p>
        </div>
        {grouped.map(({ category, cards }) => (
          <section key={category} className={styles.section}>
            <h2 className={styles.sectionTitle}>{category}</h2>
            <div className={styles.grid}>
              {cards.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className={clsx(styles.card, styles[`card${card.tag}`])}
                >
                  <div className={styles.cardBody}>
                    <h3 className={styles.cardTitle}>{card.title}</h3>
                    <p className={styles.cardDesc}>{card.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
    </Layout>
  );
}
