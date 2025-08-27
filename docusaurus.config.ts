import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

const config: Config = {
  title: 'Peter R. Spackman',
  tagline: 'computational chemist & software enthusiast',
  url: 'https://www.prs.wiki/',
  baseUrl: '/',
  favicon: 'img/favicon.ico',
  trailingSlash: false,
  organizationName: 'peterspackman',
  projectName: 'blog',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          remarkPlugins: [remarkMath],
          rehypePlugins: [[rehypeKatex, {}]],
        },
        blog: {
          showReadingTime: true,
          remarkPlugins: [remarkMath],
          rehypePlugins: [[rehypeKatex, {}]],
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
        gtag: {
          trackingID: 'G-W51GMN2E4G',
          anonymizeIP: true,
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    function(context, options) {
      return {
        name: 'occjs-webpack-plugin',
        configureWebpack(config, isServer, utils) {
          return {
            devServer: {
              headers: {
                'Cross-Origin-Embedder-Policy': 'require-corp',
                'Cross-Origin-Opener-Policy': 'same-origin',
              },
              static: {
                serveIndex: true,
              },
              // Add proper MIME types for WebAssembly
              onBeforeSetupMiddleware: (devServer) => {
                devServer.app.use((req, res, next) => {
                  if (req.url.endsWith('.wasm')) {
                    res.setHeader('Content-Type', 'application/wasm');
                  }
                  next();
                });
              },
            },
            module: {
              rules: [
                {
                  test: /occjs\.js$/,
                  use: [
                    {
                      loader: 'string-replace-loader',
                      options: {
                        search: /await import\("module"\)/g,
                        replace: '(function() { throw new Error("Node.js module not available in browser"); })()',
                        flags: 'g'
                      }
                    },
                    {
                      loader: 'string-replace-loader',
                      options: {
                        search: /require\(['"]worker_threads['"]\)/g,
                        replace: 'null',
                        flags: 'g'
                      }
                    },
                    {
                      loader: 'string-replace-loader',
                      options: {
                        search: /import.*from ['"]worker_threads['"];?/g,
                        replace: '// worker_threads import removed for browser',
                        flags: 'g'
                      }
                    }
                  ]
                },
                {
                  test: /\.wasm$/,
                  type: 'asset/resource',
                }
              ]
            },
            resolve: {
              fallback: {
                // Fallbacks for Node.js modules used by occjs and lmpjs
                module: false,
                worker_threads: false,
                fs: false,
                path: false,
                crypto: false,
                os: false,
                util: false,
                stream: false,
                buffer: false,
                events: false,
              }
            },
            experiments: {
              asyncWebAssembly: true,
            }
          };
        },
      };
    },
  ],

  stylesheets: [
    {
      href: "https://cdn.jsdelivr.net/npm/katex@0.13.11/dist/katex.min.css",
      integrity:
        "sha384-Um5gpz1odJg5Z4HAmzPtgZKdTBHZdw8S29IecapCSB31ligYPhHQZMIlWLYQGVoc",
      crossorigin: "anonymous",
    },
  ],


  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      logo: {
        alt: 'Peter R. Spackman',
        src: 'img/prs.png',
      },
      items: [
        {
          to: '/software',
          position: 'left',
          label: 'software',
        },
        {
          to: '/publications',
          position: 'left',
          label: 'papers',
        },
        { to: '/blog', label: 'blog', position: 'left' },
        {
          type: 'dropdown',
          label: 'utilities',
          position: 'left',
          items: [
            {
              label: 'All Utilities',
              to: '/utilities',
            },
            {
              label: 'Wavefunction Calculator',
              to: '/utilities/wavefunction-calculator',
            },
            {
              label: 'XYZ Trajectory Viewer',
              to: '/utilities/xyz-trajectory',
            },
            {
              label: 'Elastic Tensor Analysis',
              to: '/utilities/elastic-tensor',
            },
            {
              label: 'SMILES Viewer',
              to: '/utilities/smiles-viewer',
            },
            {
              label: 'LAMMPS Interface',
              to: '/utilities/lammps-interface',
            },
          ],
        },
        {
          type: 'dropdown',
          label: 'visualisations',
          position: 'left',
          items: [
            {
              label: "Bragg's Law",
              href: '/bragg',
            },

            {
              label: 'QM 1D',
              href: '/qm1d',
            },
            {
              label: 'QM 2D',
              href: '/qm2d',
            },
            {
              label: 'Spherical Harmonics',
              href: '/spherical-harmonics',
            },
            {
              label: 'Molecular Dynamics',
              href: '/md',
            },
            {
              label: 'Crystal Structures',
              href: '/crystals',
            },
            {
              label: 'Wulff Construction 2D',
              href: '/wulff',
            },
          ],
        },
        {
          href: 'https://github.com/peterspackman',
          label: 'github',
          position: 'right',
        },
        {
          href: 'https://scholar.google.com.au/citations?user=GmSR9oIAAAAJ',
          label: 'google scholar',
          position: 'right',
        },
        {
          href: 'https://orcid.org/0000-0002-6532-8571',
          label: 'orcid',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'light',
      links: [
        {
          title: 'Software',
          items: [
            {
              label: 'crystalexplorer',
              to: 'https://crystalexplorer.net',
            },
            {
              label: 'chmpy',
              to: 'https://github.com/peterspackman/chmpy/',
            },
            {
              label: 'occ',
              to: 'https://github.com/peterspackman/occ',
            },
          ],
        },
        {
          title: 'Social',
          items: [
            {
              label: 'bluesky',
              href: 'https://bsky.app/profile/crystalexplorer.net',
            },
            {
              label: 'github',
              href: 'https://github.com/peterspackman',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'blog',
              to: '/blog',
            },
            {
              href:
                'https://scholar.google.com.au/citations?user=GmSR9oIAAAAJ',
              label: 'google scholar',
            },
            {
              href: 'https://orcid.org/0000-0002-6532-8571',
              label: 'orcid',
            },
            {
              href: 'https://publons.com/researcher/AAA-2424-2020/',
              label: 'publons'
            }
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Peter R. Spackman`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
