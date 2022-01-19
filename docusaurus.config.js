// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');
const math = require('remark-math');
const katex = require('rehype-katex');

/** @type {import('@docusaurus/types').Config} */
const config = {
    title: 'Peter R. Spackman',
    tagline: 'computational chemist & software enthusiast',
    url: 'https://www.prs.wiki/',
    baseUrl: '/',
    onBrokenLinks: 'throw',
    onBrokenMarkdownLinks: 'warn',
    favicon: 'img/favicon.ico',
    trailingSlash: false,
    organizationName: 'peterspackman', // Usually your GitHub org/user name.
    projectName: 'blog', // Usually your repo name.

    presets: [
        [
            '@docusaurus/preset-classic',
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

                gtag: {
                    trackingID: 'G-W51GMN2E4G',
                    anonymizeIP: true,
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
                    label: 'software',
                },
                {
                    type: 'doc',
                    docId: 'publications',
                    position: 'left',
                    label: 'papers',
                },
                {to: '/blog', label: 'blog', position: 'left'},
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
                            to: 'https://peterspackman.github.io/chmpy/',
                        },
                        {
                            label: 'tonto',
                            to: 'https://github.com/dylan-jayatilaka/tonto',
                        },
                    ],
                },
                {
                    title: 'Social',
                    items: [
                        {
                            label: 'twitter',
                            href: 'https://twitter.com/prspackman',
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
                            href: 'https://scholar.google.com.au/citations?user=GmSR9oIAAAAJ',
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
            theme: lightCodeTheme,
            darkTheme: darkCodeTheme,
        },
    }),
};

module.exports = config;
