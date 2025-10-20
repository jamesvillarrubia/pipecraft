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
  url: 'https://jamesvillarrubia.github.io',
  baseUrl: '/pipecraft/',

  organizationName: 'jamesvillarrubia',
  projectName: 'pipecraft',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  plugins: [
    [
      'docusaurus-plugin-typedoc',
      {
        // TypeDoc options
        entryPoints: ['../src'],
        entryPointStrategy: 'expand',
        out: 'api',
        sidebar: {
          categoryLabel: 'API Reference',
          position: 4,
          fullNames: true,
        },
        // Output options
        plugin: ['typedoc-plugin-markdown'],
        readme: 'none',
        outputFileStrategy: 'modules',
        membersWithOwnFile: ['Class', 'Interface', 'Enum'],
        
        // Include/Exclude
        exclude: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**'],
        excludePrivate: true,
        excludeProtected: false,
        excludeInternal: true,
        
        // Display options
        hideGenerator: true,
        includeVersion: true,
      },
    ],
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/jamesvillarrubia/pipecraft/tree/develop/docs-site/',
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
          to: '/docs/api',
          label: 'API',
          position: 'left',
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
              label: 'API Reference',
              to: '/docs/api',
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
