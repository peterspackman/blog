import React from 'react';
import Layout from '@theme/Layout';
import styles from './software.module.css';
import Link from '@docusaurus/Link';

type SoftwareProjectProps = {
  title: string;
  description: React.ReactNode;
  imageUrl?: string;
  link: string;
  github?: string;
  language: string;
};

const SoftwareProject: React.FC<SoftwareProjectProps> = ({
  title,
  description,
  imageUrl,
  link,
  github,
  language,
}) => {
  return (
    <div className={styles.projectCard}>
      {imageUrl && (
        <div className={styles.projectImageContainer}>
          <img src={imageUrl} alt={title} className={styles.projectImage} />
        </div>
      )}
      <div className={styles.projectContent}>
        <h3 className={styles.projectTitle}>{title}</h3>
        <div className={styles.projectLanguage}>{language}</div>
        <div className={styles.projectDescription}>{description}</div>
        <div className={styles.projectLinks}>
          <Link className="button button--primary" to={link}>
            Learn More
          </Link>
          {github && (
            <Link className="button button--secondary" to={github}>
              GitHub
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default function Software(): JSX.Element {
  return (
    <Layout
      title="Software"
      description="Scientific software developed by Peter Spackman"
    >
      <main className={styles.softwarePage}>
        <div className="container margin-vert--lg">
          <div className={styles.projectsContainer}>
            <SoftwareProject
              title="Open Computational Chemistry (OCC)"
              description={
                <>
                  <p>
                    A modern framework for computational chemistry methods, with a focus on quantum
                    chemistry and electronic structure theory. OCC aims to provide a flexible,
                    efficient, and maintainable platform for implementing and applying quantum
                    chemical methods.
                  </p>
                  <p>
                    Features include Hartree-Fock, DFT, and post-HF methods for molecular systems,
                    along with visualization capabilities and integration with other computational
                    chemistry tools.
                  </p>
                </>
              }
              imageUrl="/img/occ.png"
              link="https://peterspackman.github.io/occ"
              github="https://github.com/peterspackman/occ"
              language="C++ / Python"
            />

            <SoftwareProject
              title="CrystalExplorer"
              description={
                <>
                  <p>
                    A software tool for analysis and visualization of molecular crystal structures.
                    CrystalExplorer enables researchers to explore intermolecular interactions,
                    characterize crystal packing, and compute properties of crystalline materials.
                  </p>
                  <p>
                    The software provides advanced visualization of Hirshfeld surfaces,
                    interaction energies, and other properties relevant to understanding
                    molecular crystal structures and their properties.
                  </p>
                </>
              }
              imageUrl="/img/CrystalExplorer512x512.png"
              link="https://crystalexplorer.net"
              language="C++ / Qt"
            />

            <SoftwareProject
              title="chmpy"
              description={
                <>
                  <p>
                    A python library for wrangling molecules, crystals, Hirshfeld & promolecule density isosurfaces, spherical harmonic shape descriptors and more...
                  </p>
                </>
              }
              imageUrl="/img/chmpy_logo.png"
              link="https://peterspackman.github.io/chmpy/"
              github="https://github.com/peterspackman/chmpy"
              language="Python"
            />
          </div>

          <div className="margin-top--lg">
            <h2 className="text--center">Visualizations</h2>
            <p className="text--center">
              Interactive (JS) visualizations of quantum mechanical concepts,
              available on this website
            </p>

            <div className={styles.visualizationsContainer}>
              <div className={styles.visualizationCard}>
                <h3>Quantum Particle in 1D</h3>
                <p>Visualization of quantum states in one-dimensional potentials</p>
                <Link to="/qm1d" className="button button--outline button--primary">
                  View Visualization
                </Link>
              </div>

              <div className={styles.visualizationCard}>
                <h3>Quantum Particle in 2D</h3>
                <p>Interactive visualization of 2D quantum states and superpositions</p>
                <Link to="/qm2d" className="button button--outline button--primary">
                  View Visualization
                </Link>
              </div>

              <div className={styles.visualizationCard}>
                <h3>Hydrogen-like Orbitals</h3>
                <p>3D rendering of hydrogen-like atomic orbitals</p>
                <Link to="/qm3d" className="button button--outline button--primary">
                  View Visualization
                </Link>
              </div>

              <div className={styles.visualizationCard}>
                <h3>Bragg Diffraction</h3>
                <p>Simulation of X-ray diffraction in crystals</p>
                <Link to="/bragg" className="button button--outline button--primary">
                  View Visualization
                </Link>
              </div>
            </div>
          </div>

          <div className="margin-top--xl text--center">
            <h2>More Projects</h2>
            <p>Visit my GitHub profile to see all my open-source projects</p>
            <Link
              className="button button--secondary button--lg"
              to="https://github.com/peterspackman"
            >
              GitHub Profile
            </Link>
          </div>
        </div>
      </main>
    </Layout>
  );
}
