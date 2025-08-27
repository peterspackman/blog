import React from 'react';
import Layout from '@theme/Layout';
import LammpsInterface from '@site/src/components/LammpsInterface';
import styles from '../utilities/utilities.module.css';

export default function LammpsInterfacePage() {
  return (
    <Layout
      title="LAMMPS Interface"
      description="Run LAMMPS molecular dynamics simulations in your browser"
      wrapperClassName="layout-wrapper--full-height">
      <div className="container-fluid" style={{ height: '100%', padding: '1rem' }}>
        <LammpsInterface />
      </div>
    </Layout>
  );
}