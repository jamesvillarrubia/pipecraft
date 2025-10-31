/**
 * Detect Changes Action Template
 *
 * Generates a GitHub composite action that detects which domains have changed.
 * Supports both Nx dependency graph analysis and path-based change detection.
 *
 * ## Purpose
 *
 * This action intelligently detects changes in monorepos:
 * - For Nx monorepos: Uses `nx show projects --affected` to leverage the dependency graph
 * - For path-based projects: Uses path filters to detect which domains changed
 * - Automatically falls back to path-based detection if Nx is unavailable
 *
 * ## Generated Action Location
 *
 * `.github/actions/detect-changes/action.yml`
 *
 * @module templates/actions/detect-changes.yml.tpl
 */

import { PinionContext, toFile, renderTemplate } from '@featherscloud/pinion'
import fs from 'fs'
import { DomainConfig } from '../../types/index.js'
import { logger } from '../../utils/logger.js'

/**
 * Generates the detect-changes composite action YAML content.
 *
 * Creates a GitHub Actions composite action that:
 * - Checks for Nx availability in the repository
 * - Uses `nx show projects --affected` for dependency graph analysis
 * - Maps affected projects to domains
 * - Falls back to path-based detection if Nx isn't available
 * - Outputs Nx-specific information (affected projects, Nx availability)
 *
 * @param {any} ctx - Context containing domains configuration
 * @param {Record<string, DomainConfig>} ctx.domains - Domain configurations with path patterns
 * @returns {string} YAML content for the composite action
 */
const changesNxActionTemplate = (ctx: any) => {
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

  // Generate Nx pattern matching logic for each domain
  const domainNames = Object.keys(ctx.domains);
  const nxPatternMatching = domainNames.map(domainName => {
    return `              # Check ${domainName} domain patterns
              if echo "$project" | grep -qE "(${domainName}|$(echo "${domainName}" | sed 's/-/[-_]/g'))"; then
                ${domainName.toUpperCase()}_AFFECTED=true
                echo "  ✅ $project matches ${domainName} domain"
              fi`;
  }).join('\n');

  const nxFlagInit = domainNames.map(domainName =>
    `            ${domainName.toUpperCase()}_AFFECTED=false`
  ).join('\n');

  const nxOutputs = domainNames.map(domainName =>
    `            echo "${domainName}=$${domainName.toUpperCase()}_AFFECTED" >> $GITHUB_OUTPUT`
  ).join('\n');

  const nxFallbackOutputs = domainNames.map(domainName =>
    `            echo "${domainName}=false" >> $GITHUB_OUTPUT`
  ).join('\n');

  const pathFilterOutputs = domainNames.map(domainName =>
    `          echo "${domainName}=\${{ contains(steps.filter.outputs.changes, '${domainName}') }}" >> $GITHUB_OUTPUT`
  ).join('\n');

  const nxMergeOutputs = domainNames.map(domainName =>
    `          echo "${domainName}=\${{ steps.nx-filter.outputs.${domainName} }}" >> $GITHUB_OUTPUT`
  ).join('\n');

  const resultEchoes = domainNames.map(domainName =>
    `        echo "  ${domainName}: \${{ steps.merge.outputs.${domainName} }}"`
  ).join('\n');

  // Generate the composite action YAML
  return `name: 'Detect Changes with Nx Support'
description: 'Enhanced change detection using Nx dependency graph with path-based fallback'
author: 'Pipecraft'

inputs:
  baseRef:
    description: 'Base reference to compare against'
    required: false
    default: 'main'
  useNx:
    description: 'Whether to use Nx dependency graph for change detection'
    required: false
    default: 'true'
  node-version:
    description: 'Node.js version to use'
    required: false
    default: '20'
  pnpm-version:
    description: 'pnpm version to use (only used if pnpm detected)'
    required: false
    default: '9'

outputs:
${domainOutputs}
  nxAvailable:
    description: 'Whether Nx is available in the repository'
    value: \${{ steps.nx-check.outputs.available }}
  affectedProjects:
    description: 'Comma-separated list of affected Nx projects'
    value: \${{ steps.nx-filter.outputs.affectedProjects }}

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

    - name: Check for Nx
      id: nx-check
      shell: bash
      run: |
        if [ -f "nx.json" ] || ([ -f "package.json" ] && grep -q '"nx"' package.json); then
          echo "available=true" >> $GITHUB_OUTPUT
          echo "🔍 Nx detected in repository"
        else
          echo "available=false" >> $GITHUB_OUTPUT
          echo "⚠️  Nx not detected, falling back to path-based detection"
        fi

    - name: Setup Node.js
      if: steps.nx-check.outputs.available == 'true' && inputs.useNx == 'true'
      uses: actions/setup-node@v4
      with:
        node-version: \${{ inputs.node-version }}

    - name: Install Dependencies
      if: steps.nx-check.outputs.available == 'true' && inputs.useNx == 'true'
      shell: bash
      run: |
        echo "📦 Installing dependencies for Nx..."
        if [ -f "pnpm-lock.yaml" ]; then
          corepack enable
          pnpm install --frozen-lockfile || pnpm install
        elif [ -f "yarn.lock" ]; then
          yarn install --frozen-lockfile || yarn install
        elif [ -f "package-lock.json" ]; then
          npm ci || npm install
        else
          npm install
        fi

    - name: Detect Changes with Nx (if available)
      id: nx-filter
      if: steps.nx-check.outputs.available == 'true' && inputs.useNx == 'true'
      shell: bash
      run: |
        echo "🚀 Using Nx dependency graph for change detection"

        # Get affected projects using Nx
        if command -v npx >/dev/null 2>&1; then
          # Get list of affected projects (newline-separated)
          AFFECTED_PROJECTS_RAW=$(npx nx show projects --affected --base=\${{ steps.set-base.outputs.base_branch }} 2>/dev/null || echo "")

          # Convert newlines to commas for storage
          AFFECTED_PROJECTS=$(echo "$AFFECTED_PROJECTS_RAW" | tr '\\n' ',' | sed 's/,$//')
          echo "affectedProjects=$AFFECTED_PROJECTS" >> $GITHUB_OUTPUT

          if [ -n "$AFFECTED_PROJECTS" ]; then
            echo "📦 Affected Nx projects: $AFFECTED_PROJECTS"

            # Initialize domain flags
${nxFlagInit}

            # Check each affected project against domain patterns (comma-separated)
            IFS=',' read -ra PROJECTS <<< "$AFFECTED_PROJECTS"
            for project in "\${PROJECTS[@]}"; do
              project=$(echo "$project" | xargs) # trim whitespace
${nxPatternMatching}
            done

            # Set outputs
${nxOutputs}

          else
            echo "No affected projects detected"
${nxFallbackOutputs}
          fi
        else
          echo "⚠️  npx not available, falling back to path-based detection"
${nxFallbackOutputs}
          echo "affectedProjects=" >> $GITHUB_OUTPUT
        fi

    - name: Detect Changes with Paths Filter (fallback)
      uses: dorny/paths-filter@v3
      id: filter
      if: steps.nx-check.outputs.available != 'true' || inputs.useNx != 'true'
      with:
        base: \${{ steps.set-base.outputs.base_branch }}
        filters: |
${domainFilters}

    - name: Merge filter outputs
      id: merge
      shell: bash
      run: |
        # Use Nx results if available, otherwise use path filter results
        if [ "\${{ steps.nx-check.outputs.available }}" == "true" ] && [ "\${{ inputs.useNx }}" == "true" ]; then
${nxMergeOutputs}
          echo "🔍 Using Nx dependency analysis results"
          echo "📦 Affected projects: \${{ steps.nx-filter.outputs.affectedProjects }}"
        else
${pathFilterOutputs}
          echo "📁 Using path-based change detection"
        fi

        echo "📋 Change Detection Results:"
${resultEchoes}
        echo "  nx-available: \${{ steps.nx-check.outputs.available }}"
`;
}

/**
 * Generator entry point for detect-changes composite action.
 *
 * Generates the `.github/actions/detect-changes/action.yml` file with intelligent
 * change detection logic. This action is used by Nx-enabled pipelines.
 *
 * @param {PinionContext} ctx - Pinion generator context
 * @param {Record<string, DomainConfig>} ctx.domains - Domain configurations
 * @returns {Promise<PinionContext>} Updated context after file generation
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
    .then(renderTemplate(changesNxActionTemplate, toFile('.github/actions/detect-changes/action.yml')))
