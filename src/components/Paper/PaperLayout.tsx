import React from 'react';
import Head from '@docusaurus/Head';

interface PaperLayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

const PaperLayout: React.FC<PaperLayoutProps> = ({
  title,
  description,
  children
}) => {
  return (
    <>
      <Head>
        <title>{title}</title>
        {description && <meta name="description" content={description} />}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={{
        minHeight: '100vh',
        backgroundColor: 'var(--ifm-background-color)',
        color: 'var(--ifm-font-color-base)',
        fontFamily: 'var(--ifm-font-family-base)'
      }}>
        {children}
      </div>
    </>
  );
};

export default PaperLayout;