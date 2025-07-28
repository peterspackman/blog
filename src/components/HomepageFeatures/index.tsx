import * as React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  image: string;
  description;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Computational Chemistry',
    image: '/img/repulsion.png',
    description: (
      <>
        Research on method development and implementation in quantum chemistry.
        Work includes electronic structure theory and molecular modeling approaches.
      </>
    ),
  },
  {
    title: 'Molecular Crystals',
    image: '/img/urea_crystal.svg',
    description: (
      <>
        Analysis and visualization of crystalline structures using CrystalExplorer.
        Research on crystal structure prediction and property characterization.
      </>
    ),
  },
  {
    title: 'Scientific Software',
    image: '/img/urea_dough.png',
    description: (
      <>
        Development of Open Computational Chemistry (OCC), a molecular quantum mechanics program.
        Scientific programming in Python, C++, JavaScript, and other languages.
      </>
    ),
  },
];

function Feature({ title, image, description }: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <img className={styles.featureSvg} alt={title} src={image} />
      </div>
      <div className="text--center padding-horiz--md">
        <h3 className="margin-bottom--sm">{title}</h3>
        <p className="margin-bottom--lg">{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
