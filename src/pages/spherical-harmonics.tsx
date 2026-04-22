import React from 'react';
import Layout from '@theme/Layout';
import HydrogenOrbitals from '@site/src/components/HydrogenOrbitals';

export default function SphericalHarmonicsPage() {
    return (
        <Layout
            title="Spherical Harmonics & Hydrogen Orbitals"
            description="Interactive viewer for spherical harmonics and hydrogen wavefunctions, showing the separation ψ = R(r)·Y(θ,φ)"
        >
            <div style={{ padding: '24px 0 48px' }}>
                <HydrogenOrbitals />
            </div>
        </Layout>
    );
}
