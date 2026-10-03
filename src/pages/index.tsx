import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import OrbitalHero from '../components/home/OrbitalHero';
import { FEATURED } from '../components/home/projects';
import { useRecentWorks } from '../components/home/useRecentWorks';
import styles from '../components/home/Home.module.css';

const ORCID = '0000-0002-6532-8571';

const TOOLS = [
  { title: 'Wavefunction calculator', href: '/utilities/wavefunction-calculator', desc: 'HF and DFT with OCC, plus orbitals, optimisations and frequencies' },
  { title: 'LAMMPS in the browser', href: '/utilities/lammps-interface', desc: 'Run an input script, plot the thermo output, watch the trajectory' },
  { title: 'Elastic tensor analysis', href: '/utilities/elastic-tensor', desc: 'Paste a 6×6 stiffness matrix and see how the moduli vary with direction' },
];

const NOTES = [
  { tag: 'Quantum', title: 'Schrödinger equation in 1D', href: '/qm1d' },
  { tag: 'Quantum', title: 'Hydrogen orbitals', href: '/spherical-harmonics' },
  { tag: 'Quantum', title: 'Bands from molecular orbitals', href: '/bandstructure' },
  { tag: 'Crystals', title: 'Wulff construction', href: '/wulff' },
  { tag: 'Crystals', title: 'X-ray diffraction', href: '/diffraction' },
  { tag: 'Simulation', title: 'Molecular dynamics', href: '/md' },
];

function RecentPapers() {
  const state = useRecentWorks(ORCID, 3);
  if (state.status === 'loading') return <p className={styles.quiet}>Fetching from ORCID…</p>;
  if (state.status === 'error' || state.works.length === 0) {
    return <p className={styles.quiet}>Couldn't reach ORCID just now; the papers page has the full list.</p>;
  }
  return (
    <ul className={styles.papers}>
      {state.works.map((w) => (
        <li key={w.title}>
          {w.url ? <a href={w.url}>{w.title}</a> : w.title}
          <span className={styles.paperMeta}>{[w.journal, w.year].filter(Boolean).join(' · ')}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <Layout
      title="Peter R. Spackman"
      description="Computational chemist and software enthusiast: quantum chemistry and crystallography software, in-browser tools and interactive notes."
    >
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <h1>Peter R. Spackman</h1>
            <p className={styles.tagline}>computational chemist &amp; software enthusiast</p>
            <p className={styles.lede}>
              I mostly write software for quantum chemistry and molecular crystals. A fair bit of it compiles to
              WebAssembly now, so you can run it here without installing anything.
            </p>
            <div className={styles.actions}>
              <Link className={styles.primary} to="/utilities/wavefunction-calculator">Run a calculation</Link>
              <Link className={styles.secondary} to="/software">Software</Link>
            </div>
          </div>
          <OrbitalHero className={styles.heroArt} />
        </div>
      </header>

      <main className={styles.main}>
        <section aria-labelledby="made">
          <div className={styles.sectionHead}>
            <h2 id="made">Things I've made</h2>
            <Link to="/software">All software →</Link>
          </div>
          <div className={styles.projects}>
            {FEATURED.map((p) => (
              <Link key={p.name} to={p.href ?? p.docs ?? p.github} className={styles.project}>
                <div className={styles.projectArt}>
                  {p.image ? <img src={p.image} alt="" /> : <span className={styles.projectGlyph}>{p.name}</span>}
                </div>
                <div className={styles.projectBody}>
                  <span className={styles.projectName}>
                    {p.name}
                    {p.status && <span className={styles.status}>{p.status}</span>}
                  </span>
                  <span className={styles.projectBlurb}>{p.blurb}</span>
                  <span className={styles.mono}>{p.languages}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.split}>
          <div className={styles.splitNarrow}>
            <h2>Run it in your browser</h2>
            <p className={styles.sub}>Everything runs locally, nothing gets sent anywhere.</p>
            <div className={styles.list}>
              {TOOLS.map((t) => (
                <Link key={t.href} to={t.href} className={styles.listItem}>
                  <span className={styles.listTitle}>{t.title}</span>
                  <span className={styles.listDesc}>{t.desc}</span>
                </Link>
              ))}
            </div>
            <Link to="/utilities" className={styles.more}>All tools →</Link>
          </div>
          <div className={styles.splitWide}>
            <h2>Interactive notes</h2>
            <p className={styles.sub}>Notes and toys, mostly for teaching and partly for my own amusement.</p>
            <div className={styles.tiles}>
              {NOTES.map((n) => (
                <Link key={n.href} to={n.href} className={styles.tile}>
                  <span className={styles.tileTag}>{n.tag}</span>
                  <span className={styles.tileTitle}>{n.title}</span>
                </Link>
              ))}
            </div>
            <Link to="/visualisations" className={styles.more}>All notes →</Link>
          </div>
        </section>

        <section className={`${styles.split} ${styles.writing}`}>
          <div className={styles.splitWide}>
            <h2>Recent papers</h2>
            <RecentPapers />
            <Link to="/publications" className={styles.more}>All papers →</Link>
          </div>
          <div className={styles.splitNarrow}>
            <h2>Blog</h2>
            <Link to="/blog/MO_rotation">How to rotate MO coefficients</Link>
            <span className={styles.paperMeta}>January 2022</span>
            <p className={styles.quiet} style={{ marginTop: '0.5rem' }}>I do plan on posting more. Eventually.</p>
          </div>
        </section>
      </main>
    </Layout>
  );
}
