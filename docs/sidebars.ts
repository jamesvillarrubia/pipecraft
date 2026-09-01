import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * User-facing documentation sidebar.
 *
 * Organized by Diátaxis-style intent: get started → guides (do) → reference (look up) →
 * understand (concepts) → help. Developer/internal material (contributing, testing the
 * project itself, the generated source API) lives with the repo README, not here.
 */
const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    {
      type: 'category',
      label: 'Get started',
      collapsed: false,
      items: ['intro', { type: 'doc', id: 'cli-reference', label: 'Quickstart' }]
    },
    {
      type: 'category',
      label: 'Guides',
      collapsed: false,
      items: [
        'workflow-generation',
        {
          type: 'category',
          label: 'Workflow patterns',
          collapsed: true,
          items: ['flows/trunk-flow', 'flows/github-flow', 'flows/gitflow', 'flows/custom-flow']
        },
        'version-management',
        'upgrading',
        'examples'
      ]
    },
    {
      type: 'category',
      label: 'Reference',
      collapsed: false,
      items: [
        { type: 'doc', id: 'commands', label: 'CLI reference' },
        'configuration-reference',
        'action-modes'
      ]
    },
    {
      type: 'category',
      label: 'Understand',
      collapsed: true,
      items: ['architecture']
    },
    {
      type: 'category',
      label: 'Help',
      collapsed: true,
      items: [
        'troubleshooting',
        { type: 'doc', id: 'error-handling', label: 'Error reference' },
        'faq',
        'roadmap',
        'security'
      ]
    }
  ]
}

export default sidebars
