import React, { useState, useEffect } from 'react';

interface Publication {
  title: string;
  journal: string;
  year: string;
  doi?: string;
  url?: string;
  authors?: string[];
  volume?: string;
  issue?: string;
  pages?: string;
  type?: 'journal-article' | 'software' | 'other';
  abstract?: string;
  citationCount?: number;
}

interface ORCIDPublicationsProps {
  orcidId: string;
}

const ORCIDPublications: React.FC<ORCIDPublicationsProps> = ({ orcidId }) => {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'journal-article' | 'software' | 'other'>('all');
  const [crossrefData, setCrossrefData] = useState<Record<string, {abstract?: string, citationCount?: number}>>({});
  const [crossrefLoading, setCrossrefLoading] = useState(false);

  useEffect(() => {
    const fetchPublications = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check cache first
        const cacheKey = `orcid-publications-${orcidId}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
          if (Date.now() - timestamp < oneDay) {
            setPublications(data);
            setLoading(false);
            // Also fetch Crossref data when loading from cache
            fetchCrossrefData(data);
            return;
          }
        }

        // Fetch works from ORCID API
        const worksResponse = await fetch(
          `https://pub.orcid.org/v3.0/${orcidId}/works`,
          {
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        if (!worksResponse.ok) {
          throw new Error(`Failed to fetch ORCID works: ${worksResponse.status}`);
        }

        const worksData = await worksResponse.json();
        const works = worksData.group || [];

        // Fetch detailed information for each work
        const publicationPromises = works.slice(0, 50).map(async (group: any) => {
          const workSummary = group['work-summary'][0];
          const putCode = workSummary['put-code'];

          try {
            const detailResponse = await fetch(
              `https://pub.orcid.org/v3.0/${orcidId}/work/${putCode}`,
              {
                headers: {
                  'Accept': 'application/json',
                },
              }
            );

            if (!detailResponse.ok) {
              console.warn(`Failed to fetch work details for ${putCode}`);
              return null;
            }

            const detailData = await detailResponse.json();
            const work = detailData;

            // Extract publication information
            const title = work.title?.title?.value || 'Untitled';
            const journal = work['journal-title']?.value || '';
            const year = work['publication-date']?.year?.value || '';
            const type = work.type || 'other';
            
            // Extract volume, issue, pages
            const volume = work.volume?.value || '';
            const issue = work.issue?.value || '';
            const pages = work.pages?.value || '';
            
            // Extract authors
            let authors: string[] = [];
            if (work.contributors?.contributor) {
              authors = work.contributors.contributor
                .filter((contrib: any) => contrib['contributor-attributes']?.['contributor-role'] === 'author')
                .map((contrib: any) => {
                  const creditName = contrib['credit-name']?.value;
                  if (creditName) return creditName;
                  
                  const givenNames = contrib['contributor-attributes']?.['contributor-orcid']?.path ? '' : '';
                  const familyName = contrib['contributor-attributes']?.['contributor-orcid']?.path ? '' : '';
                  return `${givenNames} ${familyName}`.trim() || 'Unknown Author';
                })
                .filter((name: string) => name && name !== 'Unknown Author');
            }
            
            // Extract DOI
            let doi = '';
            let url = '';
            if (work['external-ids']?.['external-id']) {
              const externalIds = work['external-ids']['external-id'];
              const doiId = externalIds.find((id: any) => id['external-id-type'] === 'doi');
              if (doiId) {
                doi = doiId['external-id-value'];
                url = doiId['external-id-url']?.value || `https://doi.org/${doi}`;
              }
            }

            return {
              title,
              journal,
              year,
              doi,
              url,
              authors,
              volume,
              issue,
              pages,
              type,
            };
          } catch (err) {
            console.warn(`Error fetching work details for ${putCode}:`, err);
            return null;
          }
        });

        const publicationResults = await Promise.all(publicationPromises);
        const validPublications = publicationResults
          .filter((pub): pub is Publication => pub !== null)
          .sort((a, b) => parseInt(b.year) - parseInt(a.year));

        setPublications(validPublications);
        
        // Cache the results
        localStorage.setItem(cacheKey, JSON.stringify({
          data: validPublications,
          timestamp: Date.now()
        }));

        // Fetch Crossref data for papers with DOIs
        fetchCrossrefData(validPublications);
      } catch (err) {
        console.error('Error fetching ORCID publications:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch publications');
      } finally {
        setLoading(false);
      }
    };

    if (orcidId) {
      fetchPublications();
    }
  }, [orcidId]);

  // Fetch Crossref data separately for better performance
  const fetchCrossrefData = async (publications: Publication[]) => {
    const papersWithDOIs = publications.filter(pub => 
      pub.type === 'journal-article' && pub.doi
    );
    
    if (papersWithDOIs.length === 0) return;

    setCrossrefLoading(true);
    
    // Check cache for Crossref data
    const crossrefCacheKey = `crossref-data-${orcidId}`;
    const cachedCrossref = localStorage.getItem(crossrefCacheKey);
    let cachedData: Record<string, any> = {};
    
    if (cachedCrossref) {
      const { data, timestamp } = JSON.parse(cachedCrossref);
      const oneWeek = 7 * 24 * 60 * 60 * 1000; // Cache for 1 week
      if (Date.now() - timestamp < oneWeek) {
        setCrossrefData(data);
        setCrossrefLoading(false);
        return;
      }
      cachedData = data;
    }

    try {
      // Batch DOIs in chunks of 10 to avoid overwhelming the API
      const batchSize = 10;
      const newCrossrefData: Record<string, {abstract?: string, citationCount?: number}> = { ...cachedData };
      
      for (let i = 0; i < papersWithDOIs.length; i += batchSize) {
        const batch = papersWithDOIs.slice(i, i + batchSize);
        const batchPromises = batch.map(async (pub) => {
          if (!pub.doi || newCrossrefData[pub.doi]) return; // Skip if already cached
          
          try {
            const response = await fetch(
              `https://api.crossref.org/works/${pub.doi}`,
              {
                headers: {
                  'Accept': 'application/json',
                },
              }
            );
            
            if (response.ok) {
              const data = await response.json();
              const work = data.message;
              
              newCrossrefData[pub.doi] = {
                abstract: work.abstract ? work.abstract.replace(/<[^>]*>/g, '') : undefined,
                citationCount: work['is-referenced-by-count'] || 0
              };
            }
          } catch (err) {
            console.warn(`Failed to fetch Crossref data for DOI ${pub.doi}:`, err);
          }
        });
        
        await Promise.all(batchPromises);
        
        // Add a small delay between batches to be respectful to the API
        if (i + batchSize < papersWithDOIs.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      setCrossrefData(newCrossrefData);
      
      // Cache the Crossref data
      localStorage.setItem(crossrefCacheKey, JSON.stringify({
        data: newCrossrefData,
        timestamp: Date.now()
      }));
      
    } catch (err) {
      console.error('Error fetching Crossref data:', err);
    } finally {
      setCrossrefLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Loading publications from ORCID...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'red' }}>
        <p>Error loading publications: {error}</p>
        <p>Please check your ORCID ID and try again.</p>
      </div>
    );
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'journal-article':
        return 'paper';
      case 'software':
        return 'software';
      default:
        return ''; // Show nothing for unclassified items
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'journal-article':
        return '#e3f2fd'; // Light blue background
      case 'software':
        return '#e8f5e8'; // Light green background
      default:
        return '#f5f5f5'; // Light gray background
    }
  };

  const getTypeTextColor = (type: string) => {
    switch (type) {
      case 'journal-article':
        return '#1976d2'; // Darker blue text
      case 'software':
        return '#388e3c'; // Darker green text
      default:
        return '#616161'; // Dark gray text
    }
  };

  // Filter publications
  const filteredPublications = publications.filter(pub => 
    filter === 'all' || pub.type === filter
  );

  // Group filtered publications by year
  const publicationsByYear = filteredPublications.reduce((acc, pub) => {
    const year = pub.year || 'Unknown';
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(pub);
    return acc;
  }, {} as Record<string, Publication[]>);

  const sortedYears = Object.keys(publicationsByYear).sort((a, b) => {
    if (a === 'Unknown') return 1;
    if (b === 'Unknown') return -1;
    return parseInt(b) - parseInt(a);
  });

  return (
    <div>
      {/* Filter Controls */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem', 
          flexWrap: 'wrap',
          marginBottom: '1rem'
        }}>
          <span style={{ 
            fontSize: '0.9rem', 
            color: '#666',
            fontWeight: '500'
          }}>
            Show:
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: 'All', count: publications.length },
              { key: 'journal-article', label: 'Papers', count: publications.filter(p => p.type === 'journal-article').length },
              { key: 'software', label: 'Software', count: publications.filter(p => p.type === 'software').length },
              { key: 'other', label: 'Other', count: publications.filter(p => p.type === 'other' || !p.type).length }
            ].map(filterOption => (
              <button
                key={filterOption.key}
                onClick={() => setFilter(filterOption.key as any)}
                style={{
                  padding: '0.4rem 0.8rem',
                  border: '1px solid #e0e0e0',
                  backgroundColor: filter === filterOption.key ? '#f0f8ff' : 'white',
                  color: filter === filterOption.key ? '#1976d2' : '#666',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: filter === filterOption.key ? '500' : 'normal',
                  transition: 'all 0.2s ease',
                  borderColor: filter === filterOption.key ? '#1976d2' : '#e0e0e0'
                }}
                onMouseOver={(e) => {
                  if (filter !== filterOption.key) {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }
                }}
                onMouseOut={(e) => {
                  if (filter !== filterOption.key) {
                    e.currentTarget.style.backgroundColor = 'white';
                  }
                }}
              >
                {filterOption.label} ({filterOption.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {sortedYears.map((year, yearIndex) => (
        <div key={year} style={{ marginBottom: '3rem' }}>
          <div style={{ 
            marginBottom: '1.5rem',
            borderBottom: '2px solid #ddd',
            paddingBottom: '0.5rem'
          }}>
            <h3 style={{ 
              fontSize: '1.8rem', 
              fontWeight: 'bold', 
              color: '#333',
              margin: 0,
              display: 'inline-block'
            }}>
              {year}
            </h3>
          </div>
          
          <div style={{ marginLeft: '1rem' }}>
            {publicationsByYear[year].map((pub, index) => (
              <div key={index} style={{ 
                marginBottom: '2rem', 
                paddingBottom: '1.5rem', 
                borderBottom: index < publicationsByYear[year].length - 1 ? '1px solid #e0e0e0' : 'none'
              }}>
                {/* Title with Type Tag */}
                <div style={{ marginBottom: '0.8rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <strong 
                    style={{ 
                      fontSize: '1.15rem', 
                      lineHeight: '1.4',
                      color: '#333',
                      flex: 1,
                      marginRight: '1rem'
                    }}
                    dangerouslySetInnerHTML={{ __html: pub.title }}
                  />
                  {getTypeLabel(pub.type || 'other') && (
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      padding: '0.3rem 0.6rem',
                      borderRadius: '12px',
                      backgroundColor: getTypeColor(pub.type || 'other'),
                      color: getTypeTextColor(pub.type || 'other'),
                      flexShrink: 0,
                      alignSelf: 'flex-start'
                    }}>
                      {getTypeLabel(pub.type || 'other')}
                    </span>
                  )}
                </div>
                
                {/* Authors */}
                {pub.authors && pub.authors.length > 0 && (
                  <div style={{ 
                    marginBottom: '0.5rem', 
                    color: '#555',
                    fontSize: '0.95rem'
                  }}>
                    {pub.authors.length > 4 
                      ? `${pub.authors.slice(0, 4).join(', ')}, et al.`
                      : pub.authors.join(', ')
                    }
                  </div>
                )}
                
                {/* Journal with volume/issue/pages */}
                {pub.journal && (
                  <div 
                    style={{ 
                      marginBottom: '0.5rem', 
                      fontStyle: 'italic', 
                      color: '#666',
                      fontSize: '0.95rem'
                    }}
                    dangerouslySetInnerHTML={{ 
                      __html: `${pub.journal}${pub.volume ? ` <strong>${pub.volume}</strong>` : ''}${pub.issue ? `(${pub.issue})` : ''}${pub.pages ? `, ${pub.pages}` : ''}`
                    }}
                  />
                )}
                
                {/* Abstract */}
                {pub.doi && crossrefData[pub.doi]?.abstract && (
                  <div style={{ 
                    marginTop: '0.8rem',
                    padding: '0.8rem',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '6px',
                    borderLeft: '3px solid #e0e0e0'
                  }}>
                    <div style={{ 
                      fontSize: '0.8rem', 
                      fontWeight: '500', 
                      color: '#666',
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Abstract
                    </div>
                    <div style={{ 
                      fontSize: '0.9rem', 
                      lineHeight: '1.5',
                      color: '#555'
                    }}>
                      {crossrefData[pub.doi].abstract}
                    </div>
                  </div>
                )}

                {/* Loading indicator for abstracts */}
                {pub.doi && pub.type === 'journal-article' && crossrefLoading && !crossrefData[pub.doi] && (
                  <div style={{ 
                    marginTop: '0.8rem',
                    padding: '0.8rem',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '6px',
                    borderLeft: '3px solid #e0e0e0',
                    fontSize: '0.85rem',
                    color: '#666',
                    fontStyle: 'italic'
                  }}>
                    Loading additional details...
                  </div>
                )}

                {/* Metadata Row */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginTop: '0.8rem',
                  fontSize: '0.85rem'
                }}>
                  {/* DOI */}
                  {pub.doi && (
                    <div>
                      <a 
                        href={pub.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ 
                          textDecoration: 'none', 
                          color: '#007acc',
                          fontFamily: 'monospace'
                        }}
                      >
                        doi: {pub.doi}
                      </a>
                    </div>
                  )}
                  
                  {/* Citation Count */}
                  {pub.doi && crossrefData[pub.doi] && crossrefData[pub.doi].citationCount !== undefined && crossrefData[pub.doi].citationCount > 0 && (
                    <div style={{ 
                      color: '#666',
                      fontWeight: '500'
                    }}>
                      cited by {crossrefData[pub.doi].citationCount}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      
      {publications.length === 0 && (
        <p>No publications found for this ORCID ID.</p>
      )}
      
      {publications.length > 0 && filteredPublications.length === 0 && (
        <p>No publications found for the selected filter.</p>
      )}
      
      <div style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#666' }}>
        <p>
          Publications automatically fetched from{' '}
          <a 
            href={`https://orcid.org/${orcidId}`} 
            target="_blank" 
            rel="noopener noreferrer"
          >
            ORCID ({orcidId})
          </a>
        </p>
      </div>
    </div>
  );
};

export default ORCIDPublications;