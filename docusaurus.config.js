// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');
const math = require('remark-math');
const katex = require('rehype-katex');

/** @type {import('@docusaurus/types').Config} */
const config = {
    title: 'Peter R. Spackman',
    tagline: 'Computational chemist, software enthusiast.',
    url: 'https://your-docusaurus-test-site.com',
    baseUrl: '/',
    onBrokenLinks: 'throw',
    onBrokenMarkdownLinks: 'warn',
    favicon: 'img/favicon.ico',
    organizationName: 'peterspackman', // Usually your GitHub org/user name.
    projectName: 'blog', // Usually your repo name.

    presets: [
        [
            'classic',
            /** @type {import('@docusaurus/preset-classic').Options} */
            ({
                docs: {
                    sidebarPath: require.resolve('./sidebars.js'),
                    remarkPlugins: [math],
                    rehypePlugins: [katex],
                },
                blog: {
                    showReadingTime: true,
                },
                theme: {
                    customCss: require.resolve('./src/css/custom.css'),
                },

            }),
        ],
    ],
    stylesheets: [
        {
            href: "https://cdn.jsdelivr.net/npm/katex@0.13.11/dist/katex.min.css",
            integrity: "sha384-Um5gpz1odJg5Z4HAmzPtgZKdTBHZdw8S29IecapCSB31ligYPhHQZMIlWLYQGVoc",
            crossorigin: "anonymous",
        },
    ],

    themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
        navbar: {
            logo: {
                alt: 'Peter R. Spackman',
                src: 'img/logo.svg',
            },
            items: [
                {
                    type: 'doc',
                    docId: 'software',
                    position: 'left',
                    label: 'Software',
                },
                {to: '/blog', label: 'Blog', position: 'left'},
                {
                    href: 'https://github.com/peterspackman',
                    label: 'GitHub',
                    position: 'right',
                },
                {
                    href: 'https://scholar.google.com.au/citations?user=GmSR9oIAAAAJ',
                    label: 'Google Scholar',
                    position: 'right',
                },
                {
                    href: 'https://orcid.org/0000-0002-6532-8571',
                    label: 'ORCiD',
                    position: 'right',
                },
            ],
        },
        footer: {
            style: 'dark',
            links: [
                {
                    title: 'Software',
                    items: [
                        {
                            label: 'CrystalExplorer',
                            to: '/docs/crystalexplorer',
                        },
                        {
                            label: 'chmpy',
                            to: '/docs/chmpy',
                        },
                        {
                            label: 'tonto',
                            to: '/docs/tonto',
                        },
                    ],
                },
                {
                    title: 'Social',
                    items: [
                        {
                            label: 'Twitter',
                            href: 'https://twitter.com/prspackman',
                        },
                    ],
                },
                {
                    title: 'More',
                    items: [
                        {
                            label: 'Blog',
                            to: '/blog',
                        },
                        {
                            label: 'GitHub',
                            href: 'https://github.com/peterspackman',
                        },
                    ],
                },
            ],
            copyright: `Copyright © ${new Date().getFullYear()} Peter R. Spackman`,
        },
        prism: {
            theme: lightCodeTheme,
            darkTheme: darkCodeTheme,
        },
    }),
};

module.exports = config;
