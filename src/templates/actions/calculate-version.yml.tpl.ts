/**
 * Calculate Version Action Template
 *
 * Generates a composite action that calculates the next semantic version based on
 * conventional commits. Uses `release-it` to analyze commit history and determine
 * the appropriate version bump (major, minor, or patch).
 *
 * ## Purpose
 *
 * Automates semantic versioning in the CI/CD pipeline by:
 * - Analyzing conventional commit messages since the last tag
 * - Determining the appropriate version bump (feat→minor, fix→patch, BREAKING→major)
 * - Installing and running release-it for version calculation
 * - Outputting the calculated version for use in subsequent jobs
 *
 * ## Generated Action Location
 *
 * `actions/calculate-version/action.yml`
 *
 * ## Usage in Workflows
 *
 * ```yaml
 * jobs:
 *   version:
 *     runs-on: ubuntu-latest
 *     outputs:
 *       version: ${{ steps.calc.outputs.version }}
 *     steps:
 *       - uses: ./actions/calculate-version
 *         id: calc
 *         with:
 *           baseRef: main
 *
 *   tag:
 *     needs: version
 *     steps:
 *       - run: echo "Next version: ${{ needs.version.outputs.version }}"
 * ```
 *
 * @module templates/actions/calculate-version.yml.tpl
 */

import { type PinionContext, renderTemplate, toFile } from '@featherscloud/pinion'
import fs from 'fs'
import { logger } from '../../utils/logger.js'
import { getActionOutputDir } from '../../utils/action-reference.js'
import type { PipecraftConfig } from '../../types/index.js'

/**
 * Generates the calculate-version composite action YAML content.
 *
 * @param {any} ctx - Context (not currently used, included for consistency)
 * @returns {string} YAML content for the composite action
 */
const versionActionTemplate = (ctx: any) => {
  return `name: 'Calculate Version'
description: 'Calculate semantic version using release-it and conventional commits'
author: 'Pipecraft'

inputs:
  baseRef:
    description: 'Base reference for version calculation'
    required: false
    default: 'main'
  node-version:
    description: 'Node.js version to use'
    required: false
    default: '24'

outputs:
  version:
    description: 'The determined version'
    value: \${{ steps.set_version.outputs.version }}

runs:
  using: 'composite'
  steps:
    - name: Checkout Code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Install Node.js
      uses: actions/setup-node@v4
      with:
        node-version: \${{ inputs.node-version }}

    - name: Configure Git
      shell: bash
      run: |
        git config --global user.name "github-actions[bot]"
        git config --global user.email "github-actions[bot]@users.noreply.github.com"

    - name: Ensure on branch (not detached HEAD)
      shell: bash
      run: |
        # release-it requires a branch ref, not detached HEAD
        # If we're in detached HEAD, create a temporary branch
        if ! git symbolic-ref -q HEAD > /dev/null; then
          echo "⚠️  In detached HEAD state, creating temporary branch"
          TEMP_BRANCH="temp-release-it-$(git rev-parse --short HEAD)"
          git checkout -b "$TEMP_BRANCH"
          # Set upstream to track the branch we're calculating version for
          git branch --set-upstream-to=origin/\${{ github.ref_name }} "$TEMP_BRANCH" 2>/dev/null || true
          echo "✅ Created temporary branch: $TEMP_BRANCH"
        else
          echo "✅ Already on a branch: $(git branch --show-current)"
        fi

    - name: Get existing version tag
      id: get_version_old
      shell: bash
      run: |
        set -x  # Enable debugging output
        # Get the current commit hash
        git rev-parse HEAD
        COMMIT_HASH=$(git rev-parse HEAD)
        echo "Current commit hash: $COMMIT_HASH"
        
        # Check for tags on the current commit
        TAG=$(git tag --points-at $COMMIT_HASH | grep -E '^v[0-9]+\\.[0-9]+\\.[0-9]+$' || true)
        echo "Tags found: $TAG"
        
        if [ -z "$TAG" ]; then
          echo "No existing tag found on the current commit"
        else
          echo "Found existing tag: $TAG"
          echo "version=$TAG" >> $GITHUB_OUTPUT
        fi

    - name: Set up minimal package.json
      shell: bash
      run: |
        echo '{
          "name": "temporary-lib",
          "version": "0.0.0-release-it"
        }' > package.json

    - name: Install dependencies
      shell: bash
      run: npm install @release-it/conventional-changelog conventional-changelog-angular

    - name: Get version
      if: steps.get_version_old.outputs.version == ''
      id: get_version_new
      shell: bash
      run: |
        # Get version and filter out warnings
        RAW_OUTPUT=$(npx release-it --ci --release-version 2>&1 || echo "")
        # Extract just the version number (last line that looks like a version)
        VERSION=$(echo "$RAW_OUTPUT" | grep -E '^[0-9]+\\.[0-9]+\\.[0-9]+' | tail -1 || true)

        if [[ "$RAW_OUTPUT" == *"No new version to release"* || -z "$VERSION" ]]; then
          echo "No new version to release"
          echo "VERSION=" >> $GITHUB_ENV
          echo "version=" >> $GITHUB_OUTPUT
        else
          echo "New version to release: $VERSION"
          echo "VERSION=v$VERSION" >> $GITHUB_ENV
          echo "version=v$VERSION" >> $GITHUB_OUTPUT
        fi

    - name: Set version output
      id: set_version
      shell: bash
      run: |
        if [ -n "\${{ steps.get_version_old.outputs.version }}" ]; then
          echo "Using old version: \${{ steps.get_version_old.outputs.version }}"
          echo "version=\${{ steps.get_version_old.outputs.version }}" >> $GITHUB_OUTPUT
        elif [ -n "\${{ steps.get_version_new.outputs.version }}" ]; then
          echo "Using new version: \${{ steps.get_version_new.outputs.version }}"
          echo "version=\${{ steps.get_version_new.outputs.version }}" >> $GITHUB_OUTPUT
        else
          echo "No version determined"
          echo "version=" >> $GITHUB_OUTPUT
        fi

    - name: Output version
      shell: bash
      run: |
        echo "Version determined: \${{ steps.set_version.outputs.version }}"`
}

/**
 * Generator entry point for calculate-version composite action.
 *
 * @param {PinionContext} ctx - Pinion generator context
 * @returns {Promise<PinionContext>} Updated context after file generation
 */
export const generate = (ctx: PinionContext & { config?: Partial<PipecraftConfig> }) =>
  Promise.resolve(ctx)
    .then(ctx => {
      // Determine output directory based on actionSourceMode
      const config = ctx.config || {}
      const outputDir = getActionOutputDir(config)
      const filePath = `${outputDir}/calculate-version/action.yml`
      const exists = fs.existsSync(filePath)
      const status = exists ? '🔄 Merged with existing' : '📝 Created new'
      logger.verbose(`${status} ${filePath}`)
      return { ...ctx, actionOutputPath: filePath }
    })
    .then(ctx =>
      renderTemplate(
        versionActionTemplate,
        toFile(ctx.actionOutputPath || 'actions/calculate-version/action.yml')
      )(ctx)
    )
