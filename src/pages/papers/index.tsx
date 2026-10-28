import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import styles from './papers.module.css';

interface PaperEntry {
  id: string;
  title: string;
  authors: string[];
  year: number;
  venue: string;
  description: string;
}

const PAPERS: PaperEntry[] = [
  {
    id: 'crystal-growth',
    title: 'Predicting molecular crystal growth',
    authors: ['Brookes', 'Spackman', 'Gale', 'Anderson', 'Walisinghe'],
    year: 2026,
    venue: 'ChemRxiv preprint',
    description:
      'Automated surface terminations, interchangeable interaction energy models and finite particles in the CrystalClear protocol.',
  },
];

export default function PapersIndex() {
  return (
    <Layout
      title="Papers"
      description="Interactive paper presentations and supplements">
      <main className={styles.page}>
        <header className={styles.header}>
          <h1>Papers</h1>
          <p>Interactive companions to papers.</p>
        </header>
        <div className={styles.list}>
          {PAPERS.map((paper) => (
            <Link key={paper.id} to={`/papers/${paper.id}`} className={styles.card}>
              <h2 className={styles.title}>{paper.title}</h2>
              <span className={styles.authors}>{paper.authors.join(', ')}</span>
              <span className={styles.meta}>
                {paper.venue}, {paper.year}
              </span>
              <p className={styles.desc}>{paper.description}</p>
            </Link>
          ))}
        </div>
      </main>
    </Layout>
  );
}
