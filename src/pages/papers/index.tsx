import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';

export default function PapersIndex() {
  const papers = [
    // Papers will be added here as they're ready for publication
  ];

  return (
    <Layout
      title="Papers"
      description="Interactive paper presentations and supplements">
      <main>
        <div className="container margin-vert--lg">
          <div className="row">
            <div className="col col--8 col--offset-2">
              {papers.length > 0 ? (
                <div className="margin-top--lg">
                  {papers.map((paper) => (
                    <div key={paper.id} className="card margin-bottom--lg">
                      <div className="card__header">
                        <h3>
                          <Link to={`/papers/${paper.id}`}>
                            {paper.title}
                          </Link>
                        </h3>
                        <p className="text--secondary">
                          {paper.authors.join(', ')} ({paper.year}) • {paper.journal}
                        </p>
                      </div>
                      <div className="card__body">
                        <p>{paper.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="alert alert--info margin-top--lg">
                  <p>No interactive paper presentations available yet. Check back later!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}
