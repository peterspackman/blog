import React from 'react';
import Layout from '@theme/Layout';
import GrandCanonicalMC from '@site/src/components/GrandCanonicalMC';

export default function GCMC() {
    return (
        <Layout
            title="Grand Canonical Monte Carlo"
            description="Interactive Grand Canonical Monte Carlo simulation">
            <main style={{ width: '100%', maxWidth: 'none', padding: 0 }}>
                <GrandCanonicalMC />
            </main>
        </Layout>
    );
}
