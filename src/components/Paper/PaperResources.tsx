import React from 'react';
import { Resource } from './types';
import styles from './Paper.module.css';

interface PaperResourcesProps {
  resources: Resource[];
  className?: string;
}

const getResourceIcon = (type: Resource['type']) => {
  switch (type) {
    case 'code':
      return '💻';
    case 'data':
      return '📊';
    case 'supplementary':
      return '📎';
    case 'pdf':
      return '📄';
    default:
      return '🔗';
  }
};

const PaperResources: React.FC<PaperResourcesProps> = ({
  resources,
  className = ''
}) => {
  if (!resources || resources.length === 0) {
    return null;
  }

  return (
    <section className={`${styles.section} ${className}`}>
      <h3 className={styles.sectionTitle}>Resources</h3>
      <div className={styles.resourceList}>
        {resources.map((resource, index) => (
          <a
            key={index}
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.resource}
          >
            <div className={styles.resourceType}>
              {getResourceIcon(resource.type)} {resource.type}
            </div>
            <div className={styles.resourceTitle}>{resource.title}</div>
            {resource.description && (
              <div className={styles.resourceDescription}>
                {resource.description}
              </div>
            )}
          </a>
        ))}
      </div>
    </section>
  );
};

export default PaperResources;