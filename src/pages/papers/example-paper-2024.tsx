import React from 'react';
import {
  PaperHeader,
  PaperAuthors,
  PaperAbstract,
  PaperSection,
  PaperFigure,
  PaperGLTFSceneSimple,
  PaperCitation,
  PaperResources,
  PaperAcknowledgements,
  PaperLayout,
  Author,
  Citation,
  Resource
} from '../../components/Paper';
import styles from '../../components/Paper/Paper.module.css';

const ExamplePaper2024: React.FC = () => {
  const authors: Author[] = [
    {
      name: 'Peter R. Spackman',
      affiliation: 'University of Western Australia',
      orcid: '0000-0002-6532-8571',
      email: 'peter.spackman@uwa.edu.au',
      corresponding: true
    },
    {
      name: 'Co-Author Name',
      affiliation: 'Another Institution',
      orcid: '0000-0000-0000-0000'
    }
  ];

  const citation: Citation = {
    title: 'Novel Computational Approaches to Quantum Chemistry: An Interactive Exploration',
    authors,
    journal: 'Journal of Computational Chemistry',
    year: 2024,
    volume: '45',
    issue: '12',
    pages: '1234-1250',
    doi: '10.1002/jcc.example'
  };

  const resources: Resource[] = [
    {
      title: 'Source Code',
      url: 'https://github.com/peterspackman/example-code',
      type: 'code',
      description: 'Complete implementation with examples and tests'
    },
    {
      title: 'Supplementary Data',
      url: '/files/example-data.zip',
      type: 'data',
      description: 'Raw computational data and analysis scripts'
    },
    {
      title: 'Supporting Information',
      url: '/files/example-si.pdf',
      type: 'supplementary',
      description: 'Additional computational details and validation studies'
    },
    {
      title: 'Full Paper (PDF)',
      url: '/files/example-paper.pdf',
      type: 'pdf',
      description: 'Complete manuscript with high-resolution figures'
    }
  ];

  const keywords = [
    'quantum chemistry',
    'computational methods',
    'molecular visualization',
    'ab initio',
    'density functional theory'
  ];

  return (
    <PaperLayout
      title={citation.title}
      description="Interactive presentation of novel computational approaches to quantum chemistry">
      <div className={styles.paperContainer}>
          <PaperHeader
            title={citation.title}
            subtitle="An Interactive Exploration for General Audiences"
          />

          <PaperAuthors authors={authors} />

          <PaperAbstract keywords={keywords}>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
              tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
              quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
            </p>
            <p>
              Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore
              eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident,
              sunt in culpa qui officia deserunt mollit anim id est laborum.
            </p>
            <p>
              Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium
              doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore
              veritatis et quasi architecto beatae vitae dicta sunt explicabo.
            </p>
          </PaperAbstract>

          <PaperSection title="Introduction">
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
              tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
              quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore
              eu fugiat nulla pariatur.
            </p>
            <p>
              Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia
              deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste
              natus error sit voluptatem accusantium doloremque laudantium, totam rem
              aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto
              beatae vitae dicta sunt explicabo.
            </p>
          </PaperSection>

          <PaperSection title="Crystal Structure Visualization">
            <p>
              Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit,
              sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.
              Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur,
              adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore
              et dolore magnam aliquam quaerat voluptatem.
            </p>

            <PaperFigure
              number={1}
              caption="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            >
              <PaperGLTFSceneSimple
                modelUrl="/gltf/OCHTET/OCHTET15_elat_results.gltf"
                height={400}
                lighting="city"
                autoRotate={true}
                autoRotateSpeed={1}
              />
            </PaperFigure>

            <p>
              Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit
              laboriosam, nisi ut aliquid ex ea commodi consequatur. Quis autem vel eum
              iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae
              consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur.
            </p>
          </PaperSection>

          <PaperSection title="Computational Methods">
            <p>
              At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis
              praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias
              excepturi sint occaecati cupiditate non provident, similique sunt in culpa:
            </p>
            <ul>
              <li>Lorem ipsum dolor sit amet consectetur adipiscing elit</li>
              <li>Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua</li>
              <li>Ut enim ad minim veniam quis nostrud exercitation ullamco</li>
              <li>Duis aute irure dolor in reprehenderit in voluptate velit esse</li>
            </ul>
            <p>
              Qui officia deserunt mollitia animi, id est laborum et dolorum fuga.
              Et harum quidem rerum facilis est et expedita distinctio nam libero
              tempore, cum soluta nobis est eligendi optio cumque nihil impedit.
            </p>
          </PaperSection>

          <PaperSection title="Results and Discussion">
            <p>
              Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus
              saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae:
            </p>
            <ul>
              <li>Itaque earum rerum hic tenetur a sapiente delectus</li>
              <li>Ut aut reiciendis voluptatibus maiores alias consequatur</li>
              <li>Aut perferendis doloribus asperiores repellat</li>
              <li>Nam libero tempore cum soluta nobis est eligendi optio</li>
            </ul>
            <p>
              Cumque nihil impedit quo minus id quod maxime placeat facere possimus,
              omnis voluptas assumenda est, omnis dolor repellendus. Sed ut perspiciatis
              unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.
            </p>
          </PaperSection>

          <PaperSection title="Conclusions">
            <p>
              Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi
              architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem
              quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur
              magni dolores eos qui ratione voluptatem sequi nesciunt.
            </p>
            <p>
              Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet,
              consectetur, adipisci velit, sed quia non numquam eius modi tempora
              incidunt ut labore et dolore magnam aliquam quaerat voluptatem.
            </p>
          </PaperSection>

          <PaperCitation citation={citation} />

          <PaperResources resources={resources} />

          <PaperAcknowledgements>
            <p>
              Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis
              suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur. Quis
              autem vel eum iure reprehenderit qui in ea voluptate velit esse quam
              nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo
              voluptas nulla pariatur.
            </p>
          </PaperAcknowledgements>
      </div>
    </PaperLayout>
  );
};

export default ExamplePaper2024;