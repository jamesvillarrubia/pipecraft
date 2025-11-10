/**
 * Action Reference Utilities
 *
 * Helper functions for generating action references in workflows based on
 * the configured action source mode (embedded, marketplace, or repository).
 *
 * @module utils/action-reference
 */

import type { PipecraftConfig } from '../types/index.js'

/**
 * Generate the action reference path based on configuration.
 *
 * @param actionName - Name of the action (e.g., 'detect-changes', 'create-tag')
 * @param config - PipeCraft configuration
 * @returns The action reference string to use in workflows
 *
 * @example
 * ```typescript
 * // Embedded mode (default)
 * getActionReference('detect-changes', { actionSourceMode: 'local' })
 * // Returns: './.github/actions/detect-changes'
 *
 * // Marketplace mode
 * getActionReference('detect-changes', {
 *   actionSourceMode: 'remote',
 *   actionVersion: 'v1.2.3'
 * })
 * // Returns: 'the-craftlab/pipecraft/actions/detect-changes@v1.2.3'
 *
 * // Repository mode (PipeCraft's own CI)
 * getActionReference('detect-changes', { actionSourceMode: 'source' })
 * // Returns: './actions/detect-changes'
 * ```
 */
export function getActionReference(actionName: string, config: Partial<PipecraftConfig>): string {
  const mode = config.actionSourceMode || 'local'

  switch (mode) {
    case 'local':
      // Default: Actions in .github/actions/ (user repos)
      return `./.github/actions/${actionName}`

    case 'remote': {
      // Reference published marketplace actions
      const version = config.actionVersion || 'v1'
      return `the-craftlab/pipecraft/actions/${actionName}@${version}`
    }

    case 'source':
      // Internal: Actions in /actions/ (PipeCraft repo only)
      return `./actions/${actionName}`

    default:
      // Fallback to local mode
      return `./.github/actions/${actionName}`
  }
}

/**
 * Get the output directory for action files during generation.
 *
 * @param config - PipeCraft configuration
 * @returns Directory path where actions should be generated
 *
 * @example
 * ```typescript
 * getActionOutputDir({ actionSourceMode: 'local' })
 * // Returns: '.github/actions'
 *
 * getActionOutputDir({ actionSourceMode: 'source' })
 * // Returns: 'actions'
 * ```
 */
export function getActionOutputDir(config: Partial<PipecraftConfig>): string {
  const mode = config.actionSourceMode || 'local'

  switch (mode) {
    case 'local':
      return '.github/actions'

    case 'remote':
      // Don't generate actions locally in remote mode
      return ''

    case 'source':
      return 'actions'

    default:
      return '.github/actions'
  }
}

/**
 * Check if actions should be generated locally.
 *
 * @param config - PipeCraft configuration
 * @returns True if actions should be generated, false if using marketplace
 *
 * @example
 * ```typescript
 * shouldGenerateActions({ actionSourceMode: 'local' })    // true
 * shouldGenerateActions({ actionSourceMode: 'remote' }) // false
 * shouldGenerateActions({ actionSourceMode: 'source' })  // true
 * ```
 */
export function shouldGenerateActions(config: Partial<PipecraftConfig>): boolean {
  const mode = config.actionSourceMode || 'local'
  return mode !== 'remote'
}

/**
 * Get human-readable description of the action source mode.
 *
 * @param config - PipeCraft configuration
 * @returns Description string for logging/display
 */
export function getActionSourceDescription(config: Partial<PipecraftConfig>): string {
  const mode = config.actionSourceMode || 'local'

  switch (mode) {
    case 'local':
      return 'Local actions (full control, in .github/actions/)'

    case 'remote': {
      const version = config.actionVersion || 'v1'
      return `Marketplace actions (pinned to ${version})`
    }

    case 'source':
      return 'Repository actions (dogfooding /actions/ folder)'

    default:
      return 'Local actions (default mode)'
  }
}
