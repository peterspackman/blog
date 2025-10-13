import React from 'react';
import { Author } from './types';
import styles from './Paper.module.css';

interface PaperAuthorsProps {
  authors: Author[];
  className?: string;
}

const PaperAuthors: React.FC<PaperAuthorsProps> = ({
  authors,
  className = ''
}) => {
  return (
    <div className={`${styles.authors} ${className}`}>
      <div className={styles.authorList}>
        {authors.map((author, index) => (
          <div
            key={index}
            className={styles.author}
          >
            <span className={styles.authorName}>
              {author.name}{author.corresponding ? '*' : ''}
            </span>
            {author.affiliation && (
              <div className={styles.authorAffiliation}>{author.affiliation}</div>
            )}
            <div className={styles.authorLinks}>
              {author.orcid && (
                <a
                  href={`https://orcid.org/${author.orcid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.authorLink}
                >
                  ORCID
                </a>
              )}
              {author.email && (
                <a
                  href={`mailto:${author.email}`}
                  className={styles.authorLink}
                >
                  Email
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PaperAuthors;