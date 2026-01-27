import type * as Preset from '@docusaurus/preset-classic'
import type { Config } from '@docusaurus/types'
import { themes as prismThemes } from 'prism-react-renderer'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPackageJsonPath = path.resolve(__dirname, '../package.json')
const rootPackageJson = JSON.parse(readFileSync(rootPackageJsonPath, 'utf8'))

// Version resolution priority:
// 1. PIPECRAFT_DOCS_VERSION env var (set by CI/CD pipeline during release builds, format: v1.2.3)
// 2. package.json version (fallback for local development, format: 1.2.3)
const rawDocsVersion = process.env.PIPECRAFT_DOCS_VERSION
const derivedDocsVersion =
  typeof rawDocsVersion === 'string' && rawDocsVersion.trim().length > 0
    ? rawDocsVersion
    : rootPackageJson.version

// Normalize to remove v prefix if present (handles both CI and local dev formats)
const PIPECRAFT_VERSION: string = (derivedDocsVersion ?? '0.0.0-dev').replace(/^v/i, '')

const config: Config = {
  title: 'PipeCraft',
  tagline: 'Automated CI/CD Pipeline Generator for Trunk-Based Development',
  favicon: 'img/favicon.ico',
  customFields: {
    pipecraftVersion: PIPECRAFT_VERSION
  },

  // Test deployment trigger - small change to docs

  future: {
    v4: true
  },

  // Documentation site configuration
  url: 'https://pipecraft.thecraftlab.dev',
  baseUrl: '/',

  organizationName: 'jamesvillarrubia',
  projectName: 'pipecraft',

  headTags: [
    {
      tagName: 'link',
      attributes: {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/img/apple-touch-icon.png'
      }
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/img/favicon-32x32.png'
      }
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/img/favicon-16x16.png'
      }
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'manifest',
        href: '/site.webmanifest'
      }
    }
  ],

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en']
  },

  plugins: [],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/pipecraft-lab/pipecraft/tree/develop/docs/',
          showLastUpdateTime: true,
          showLastUpdateAuthor: true
        },
        blog: false, // Disable blog for now
        theme: {
          customCss: './src/css/custom.css'
        }
      } satisfies Preset.Options
    ]
  ],

  themeConfig: {
    image: 'img/logo_banner_trans.png',
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true
    },
    navbar: {
      title: 'PipeCraft',
      logo: {
        alt: 'PipeCraft Logo',
        src: '/img/logo.png'
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Documentation'
        },
        {
          to: '/config-builder',
          label: 'Config Builder',
          position: 'left'
        },
        {
          href: 'https://github.com/pipecraft-lab/pipecraft',
          label: 'GitHub',
          position: 'right'
        },
        {
          type: 'docsVersionDropdown',
          position: 'right',
          dropdownActiveClassDisabled: true
        }
      ]
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/intro'
            },
            {
              label: 'Config Builder',
              to: '/config-builder'
            },
            {
              label: 'CLI Reference',
              to: '/docs/cli-reference'
            },
            {
              label: 'Architecture',
              to: '/docs/architecture'
            }
          ]
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub Issues',
              href: 'https://github.com/pipecraft-lab/pipecraft/issues'
            },
            {
              label: 'GitHub Discussions',
              href: 'https://github.com/pipecraft-lab/pipecraft/discussions'
            }
          ]
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/pipecraft-lab/pipecraft'
            },
            {
              label: 'npm',
              href: 'https://www.npmjs.com/package/pipecraft'
            }
          ]
        }
      ],
      copyright: `
        <div>Copyright © ${new Date().getFullYear()} PipeCraft. Built with Docusaurus.</div>
        <div id="docs-version-badge" style="margin-top: 0.5rem; font-size: 0.875rem; opacity: 0.8;">
          Latest Release: <span class="version-value">v${PIPECRAFT_VERSION}</span>
        </div>
      `
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'diff', 'json', 'yaml']
    },
    algolia: {
      // You'll need to add Algolia later for search
      appId: 'JPOBW2G16D',
      apiKey: 'fad562cc189c49a9bde177e40dc9747d',
      indexName: 'pipecraft',
      contextualSearch: true
    }
  } satisfies Preset.ThemeConfig
}

export default config
