/**
 * Detect Changes Action Template
 * 
 * Generates a GitHub composite action that detects which domains (application areas)
 * have changes in a pull request. This is the foundation for PipeCraft's path-based
 * conditional workflow execution.
 * 
 * ## Purpose
 * 
 * In monorepos or multi-domain projects, not every change affects every part of the
 * system. This action uses GitHub's `dorny/paths-filter` to detect which domains
 * have modifications, allowing subsequent jobs to run conditionally.
 * 
 * ## How It Works
 * 
 * 1. Checks out the repository with full history
 * 2. Uses paths-filter action to check each domain's file patterns
 * 3. Outputs a boolean for each domain (true if changed, false if not)
 * 4. Logs results for debugging
 * 
 * ## Generated Action Location
 * 
 * `.github/actions/detect-changes/action.yml`
 * 
 * ## Usage in Workflows
 * 
 * ```yaml
 * jobs:
 *   changes:
 *     runs-on: ubuntu-latest
 *     outputs:
 *       api: ${{ steps.changes.outputs.api }}
 *       web: ${{ steps.changes.outputs.web }}
 *     steps:
 *       - uses: ./.github/actions/detect-changes
 *         id: changes
 *         with:
 *           baseRef: main
 * 
 *   test-api:
 *     needs: changes
 *     if: needs.changes.outputs.api == 'true'
 *     # Only runs if API domain changed
 * ```
 * 
 * @module templates/actions/detect-changes.yml.tpl
 */

import { PinionContext, toFile, renderTemplate } from '@featherscloud/pinion'
import fs from 'fs'
import dedent from 'dedent'
import { DomainConfig } from '../../types/index.js'
import { logger } from '../../utils/logger.js'

/**
 * Generates the detect-changes composite action YAML content.
 * 
 * Creates a GitHub Actions composite action that:
 * - Accepts a base branch reference for comparison
 * - Defines outputs for each configured domain
 * - Uses dorny/paths-filter to detect file changes
 * - Merges filter outputs into domain-specific outputs
 * - Logs detection results
 * 
 * @param {any} ctx - Context containing domains configuration
 * @param {Record<string, DomainConfig>} ctx.domains - Domain configurations with path patterns
 * @returns {string} YAML content for the composite action
 * 
 * @example
 * ```typescript
 * const yaml = changesActionTemplate({
 *   domains: {
 *     api: { paths: ['src/api/**'] },
 *     web: { paths: ['src/web/**'] }
 *   }
 * })
 * // Generates action with 'api' and 'web' outputs
 * ```
 */
const changesActionTemplate = (ctx: any) => {
  const domainOutputs = Object.entries(ctx.domains).map((entry) => {
    const [domainName, domainConfig] = entry as [string, DomainConfig];
    return `  ${domainName}:
    description: 'Whether ${domainName} domain has changes'
    value: \${{ steps.merge.outputs.${domainName} }}`;
  }).join('\n');

  const domainFilters = Object.entries(ctx.domains).map((entry) => {
    const [domainName, domainConfig] = entry as [string, DomainConfig];
    return `          ${domainName}:\n            - '${domainConfig.paths.join("'\\n            - '")}'`;
  }).join('\n');

  const domainEchoes = Object.entries(ctx.domains).map((entry) => {
    const [domainName, domainConfig] = entry as [string, DomainConfig];
    return `        echo "${domainName}=\${{ contains(steps.filter.outputs.changes, '${domainName}') }}" >> $GITHUB_OUTPUT`
  }).join('\n');

  const domainResults = Object.entries(ctx.domains).map((entry) => {
    const [domainName, domainConfig] = entry as [string, DomainConfig];
    return `        echo "  ${domainName}: \${{ contains(steps.filter.outputs.changes, '${domainName}') }}"`
  }).join('\n');

  // Generate the composite action YAML
  return `name: 'Detect Changes'
description: 'Detect changes in different application domains based on file paths'
author: 'Pipecraft'

inputs:
  baseRef:
    description: 'Base reference to compare against'
    required: false
    default: 'main'

outputs:
${domainOutputs}

runs:
  using: 'composite'
  steps:
    - name: Checkout Code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Set Base Branch
      id: set-base
      shell: bash
      run: |
        base_branch=\${{ inputs.baseRef || 'main' }}
        echo "base_branch=$base_branch" >> $GITHUB_OUTPUT
        echo "base_branch=$base_branch" >> $GITHUB_ENV

    - name: Detect Changes
      uses: dorny/paths-filter@v3
      id: filter
      with:
        base: \${{ steps.set-base.outputs.base_branch }}
        filters: |
${domainFilters}

    - name: Merge filter outputs
      id: merge
      shell: bash
      run: |
${domainEchoes}
        
        echo "📋 Change Detection Results:"
${domainResults}`
}

/**
 * Generator entry point for detect-changes composite action.
 * 
 * Generates the `.github/actions/detect-changes/action.yml` file with domain-specific
 * change detection logic. This action is used by the main pipeline to determine which
 * domains have changes and need to run tests/deployment.
 * 
 * @param {PinionContext} ctx - Pinion generator context
 * @param {Record<string, DomainConfig>} ctx.domains - Domain configurations
 * @returns {Promise<PinionContext>} Updated context after file generation
 * 
 * @example
 * ```typescript
 * await generate({
 *   cwd: '/path/to/project',
 *   domains: {
 *     api: { paths: ['src/api/**'], description: 'API' },
 *     web: { paths: ['src/web/**'], description: 'Web' }
 *   }
 * })
 * // Creates: .github/actions/detect-changes/action.yml
 * ```
 */
export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then((ctx) => {
      // Check if file exists to determine merge status
      const filePath = '.github/actions/detect-changes/action.yml'
      const exists = fs.existsSync(filePath)
      const status = exists ? '🔄 Merged with existing' : '📝 Created new'
      logger.verbose(`${status} ${filePath}`)
      return ctx
    })
    .then(renderTemplate(changesActionTemplate, toFile('.github/actions/detect-changes/action.yml')))