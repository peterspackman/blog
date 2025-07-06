import React from 'react';
import Layout from '@theme/Layout';
import ORCIDPublications from '../components/ORCIDPublications';

export default function Publications(): JSX.Element {
  const orcidId = '0000-0002-6532-8571';

  return (
    <Layout
      title="Publications"
      description="Comprehensive list of my peer-reviewed works">
      <main>
        <div className="container margin-vert--lg">
          <div className="row">
            <div className="col col--8 col--offset-2">
              <h1>Publications</h1>
              <p>My research publications and software contributions, automatically fetched from <a href="https://orcid.org" target="_blank" rel="noopener noreferrer">ORCID</a>.</p>
              
              <ORCIDPublications orcidId={orcidId} />
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}