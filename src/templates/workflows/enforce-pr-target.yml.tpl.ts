/**
 * Enforce PR Target Branch Workflow Template
 *
 * Generates a GitHub Actions workflow that enforces pull requests target the correct
 * initial branch (typically 'develop') instead of the final branch (typically 'main').
 * This prevents accidental direct commits to production branches.
 *
 * The workflow:
 * - Triggers on PR events (opened, edited, synchronize, reopened)
 * - Checks if the PR targets the final branch (main)
 * - Fails with helpful error message if targeting wrong branch
 * - Succeeds with confirmation if targeting correct branch
 *
 * @module templates/workflows/enforce-pr-target.yml.tpl
 *
 * @example
 * ```typescript
 * import { generate } from './templates/workflows/enforce-pr-target.yml.tpl.js'
 *
 * await generate({
 *   cwd: '/path/to/project',
 *   config: {
 *     initialBranch: 'develop',
 *     finalBranch: 'main'
 *   }
 * })
 * ```
 */

import { type PinionContext, renderTemplate, toFile } from '@featherscloud/pinion'

/**
 * Repo-relative path this template writes to.
 *
 * Exported so the generator can clear a stale file when the flow collapses to a
 * single branch and the workflow is no longer generated.
 */
export const ENFORCE_PR_TARGET_PATH = '.github/workflows/enforce-pr-target.yml'

/**
 * Generates the enforce-pr-target.yml workflow file.
 *
 * Creates a workflow that enforces PRs target the initial branch (develop)
 * instead of the final branch (main) to prevent direct commits to production.
 *
 * @param {PinionContext} ctx - Pinion context with configuration
 * @returns {Promise<PinionContext>} Updated context after file generation
 *
 * @throws {Error} If the workflow file cannot be written
 *
 * @example
 * ```typescript
 * // Generate with default config
 * await generate({
 *   cwd: '/path/to/project',
 *   config: { initialBranch: 'develop', finalBranch: 'main' }
 * })
 *
 * // Creates: .github/workflows/enforce-pr-target.yml
 * ```
 */
export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx).then(
    renderTemplate((ctx: any) => {
      const { initialBranch = 'develop', finalBranch = 'main' } = ctx

      return `name: Enforce PR Target Branch

on:
  pull_request:
    types: [opened, edited, synchronize, reopened]
    # Only PRs targeting the final branch matter here (the rule rejects human PRs to it).
    # Scoping the trigger keeps PipeCraft's own promotion PRs to intermediate branches from
    # spawning approval-gated runs at all; the job-level guard below covers promotion PRs
    # that do target the final branch.
    branches:
      - ${finalBranch}

jobs:
  check-pr-target:
    # Skip PipeCraft's own promotion PRs (pipecraft-promote/*). They legitimately target
    # downstream/final branches as part of the flow; this guard is for human-authored PRs.
    if: \${{ !startsWith(github.head_ref, 'pipecraft-promote/') }}
    runs-on: ubuntu-latest
    steps:
      - name: Check PR base branch
        if: github.base_ref == '${finalBranch}'
        run: |
          echo "::error::Pull requests must target '${initialBranch}' branch, not '${finalBranch}'"
          echo "::error::Please change the base branch to '${initialBranch}'"
          echo ""
          echo "To fix this:"
          echo "1. Go to your PR"
          echo "2. Click 'Edit' next to the title"
          echo "3. Change base branch from '${finalBranch}' to '${initialBranch}'"
          exit 1
      
      - name: Confirm correct target
        if: github.base_ref == '${initialBranch}'
        run: |
          echo "✅ PR correctly targets '${initialBranch}' branch"
`
    }, toFile(ENFORCE_PR_TARGET_PATH))
  )
