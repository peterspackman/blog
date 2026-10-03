import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import { FEATURED, MORE, WEB_PACKAGES } from '../components/home/projects';
import styles from './software.module.css';

export default function Software() {
  return (
    <Layout title="Software" description="Software by Peter R. Spackman: OCC, CrystalExplorer, chmpy, mlip.cpp and more.">
      <main className={styles.page}>
        <header className={styles.header}>
          <h1>Software</h1>
          <p>Things I've written, nearly all open source and nearly all for computational chemistry.</p>
        </header>

        <section aria-label="Main projects" className={styles.featured}>
          {FEATURED.map((p) => (
            <article key={p.name} className={styles.row}>
              <div className={styles.art}>
                {p.image ? <img src={p.image} alt={`${p.name} logo`} /> : <span className={styles.glyph}>{p.name}</span>}
              </div>
              <div className={styles.body}>
                <div className={styles.titleLine}>
                  <h2>{p.name}</h2>
                  {p.status && <span className={styles.status}>{p.status}</span>}
                  <span className={styles.mono}>{p.languages}</span>
                </div>
                <p>{p.description}</p>
                <div className={styles.links}>
                  {p.href && <Link to={p.href}>{new URL(p.href).hostname}</Link>}
                  {p.docs && <Link to={p.docs}>Documentation</Link>}
                  {p.github && <Link to={p.github}>GitHub</Link>}
                  {p.tryHref && <Link to={p.tryHref}>Try it in the browser</Link>}
                </div>
              </div>
            </article>
          ))}
        </section>

        <section aria-labelledby="more">
          <h2 id="more" className={styles.sectionTitle}>More projects</h2>
          <p className={styles.sub}>Smaller libraries, experiments and ports. Some are more polished than others.</p>
          <div className={styles.grid}>
            {MORE.map((p) => (
              <Link key={p.name} to={p.github} className={styles.card}>
                <span className={styles.cardName}>{p.name}</span>
                <span className={styles.cardDesc}>{p.description}</span>
                <span className={styles.mono}>{p.languages}</span>
              </Link>
            ))}
          </div>
          <Link to="https://github.com/peterspackman" className={styles.more}>Everything else is on GitHub →</Link>
        </section>

        <section aria-labelledby="web" className={styles.web}>
          <h2 id="web" className={styles.sectionTitle}>Built for the browser</h2>
          <p className={styles.sub}>The packages behind the tools on this site.</p>
          <div className={styles.webGrid}>
            {WEB_PACKAGES.map((w) => (
              <div key={w.name} className={styles.webItem}>
                <Link to={w.href} className={styles.cardName}>{w.name}</Link>
                <span>
                  {w.what} → <Link to={w.toolHref}>{w.tool}</Link>
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </Layout>
  );
}
