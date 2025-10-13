import React, { useState } from 'react';
import { Citation } from './types';
import styles from './Paper.module.css';

interface PaperCitationProps {
  citation: Citation;
  className?: string;
}

const PaperCitation: React.FC<PaperCitationProps> = ({
  citation,
  className = ''
}) => {
  const [copySuccess, setCopySuccess] = useState(false);

  const formatCitation = (format: 'apa' | 'bibtex' = 'apa') => {
    const { title, authors, journal, year, volume, issue, pages, doi } = citation;
    const authorNames = authors.map(author => author.name).join(', ');

    if (format === 'apa') {
      let formatted = `${authorNames} (${year}). ${title}. ${journal}`;
      if (volume) formatted += `, ${volume}`;
      if (issue) formatted += `(${issue})`;
      if (pages) formatted += `, ${pages}`;
      if (doi) formatted += `. https://doi.org/${doi}`;
      return formatted;
    }

    if (format === 'bibtex') {
      const cleanTitle = title.replace(/[{}]/g, '');
      const firstAuthor = authors[0]?.name.split(' ').pop() || 'Unknown';
      const key = `${firstAuthor}${year}`;

      return `@article{${key},
  title={${cleanTitle}},
  author={${authorNames}},
  journal={${journal}},
  year={${year}},${volume ? `\n  volume={${volume}},` : ''}${issue ? `\n  number={${issue}},` : ''}${pages ? `\n  pages={${pages}},` : ''}${doi ? `\n  doi={${doi}},` : ''}
}`;
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <section className={`${styles.citation} ${className}`}>
      <h3 className={styles.citationTitle}>Citation</h3>
      <div className={styles.citationText}>
        {formatCitation('apa')}
      </div>
      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          className="button button--secondary button--sm"
          onClick={() => copyToClipboard(formatCitation('apa') || '')}
        >
          {copySuccess ? 'Copied!' : 'Copy APA'}
        </button>
        <button
          className="button button--secondary button--sm"
          onClick={() => copyToClipboard(formatCitation('bibtex') || '')}
        >
          Copy BibTeX
        </button>
        {citation.doi && (
          <a
            href={`https://doi.org/${citation.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="button button--primary button--sm"
          >
            View DOI
          </a>
        )}
      </div>
    </section>
  );
};

export default PaperCitation;