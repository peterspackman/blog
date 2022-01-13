import React from 'react';
import clsx from 'clsx';
import styles from './HomepageFeatures.module.css';

type FeatureItem = {
  title: string;
  image: string;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Computational Chemistry',
    image: '/img/atom.svg',
    description: (
      <>
        Method development &amp; implementation - quantum chemistry, force-fields and more...
      </>
    ),
  },
  {
    title: 'Molecular Crystals',
    image: '/img/urea_crystal.svg',
    description: (
      <>
        Analysis &amp; visualisation, prediction of crystal structure, crystal
        growth and properties...
      </>
    ),
  },
  {
    title: 'Software',
    image: '/img/software_vec.svg',
    description: (
      <>
        Predominantly scientific software in mostly python and C++. But also C, javascript, rust &amp; fortran.
      </>
    ),
  },
];

function Feature({title, image, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <img className={styles.featureSvg} alt={title} src={image} />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
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
