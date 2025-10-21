import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'PipeCraft',
  tagline: 'Automated CI/CD Pipeline Generator for Trunk-Based Development',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  // GitHub Pages configuration
  url: 'https://pipecraft.thecraftlab.dev',
  baseUrl: '/',

  organizationName: 'jamesvillarrubia',
  projectName: 'pipecraft',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  plugins: [],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/jamesvillarrubia/pipecraft/tree/develop/docs/',
          showLastUpdateTime: true,
          showLastUpdateAuthor: true,
        },
        blog: false, // Disable blog for now
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/pipecraft-social-card.jpg',
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'PipeCraft',
      logo: {
        alt: 'PipeCraft Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://github.com/jamesvillarrubia/pipecraft',
          label: 'GitHub',
          position: 'right',
        },
        {
          type: 'docsVersionDropdown',
          position: 'right',
          dropdownActiveClassDisabled: true,
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/intro',
            },
            {
              label: 'Architecture',
              to: '/docs/architecture',
            },
            {
              label: 'Testing Guide',
              to: '/docs/testing-guide',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub Issues',
              href: 'https://github.com/jamesvillarrubia/pipecraft/issues',
            },
            {
              label: 'GitHub Discussions',
              href: 'https://github.com/jamesvillarrubia/pipecraft/discussions',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/jamesvillarrubia/pipecraft',
            },
            {
              label: 'npm',
              href: 'https://www.npmjs.com/package/pipecraft',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} PipeCraft. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'diff', 'json', 'yaml'],
    },
    algolia: {
      // You'll need to add Algolia later for search
      appId: 'YOUR_APP_ID',
      apiKey: 'YOUR_SEARCH_API_KEY',
      indexName: 'pipecraft',
      contextualSearch: true,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
