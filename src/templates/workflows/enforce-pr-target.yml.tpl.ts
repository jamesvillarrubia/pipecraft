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

import { fullyManagedHeader } from './shared/fully-managed-header.js'

const ENFORCE_HEADER = fullyManagedHeader(['initialBranch', 'finalBranch'])

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
    renderTemplate(
      (ctx: any) => {
        const { initialBranch = 'develop', finalBranch = 'main' } = ctx

        // In a single-branch flow the rule "target initialBranch, not finalBranch" names the
        // same branch twice. Emitting both steps gives them an identical `if`, so the reject
        // step runs first and fails every PR to the only branch there is.
        //
        // Emit the confirm step alone instead of skipping the file. Regenerating then repairs
        // a workflow left over from a previous multi-branch config, and any branch protection
        // rule requiring the `check-pr-target` status keeps getting a result — deleting the
        // workflow would leave that check permanently unreported and block every PR.
        if (initialBranch === finalBranch) {
          return `${ENFORCE_HEADER}name: Enforce PR Target Branch

# pull_request_target for the same reason as the multi-branch form below: a pull_request run
# from a first-time contributor waits for approval, and this workflow exists to report the
# 'check-pr-target' status a branch protection rule may require. Gated behind approval, that
# status never arrives and the contributor's PR can never merge. This job checks out nothing
# and 'permissions: {}' leaves it no token.
on:
  pull_request_target:
    types: [opened, edited, synchronize, reopened]
    # Single-branch flow: '${finalBranch}' is the only branch, so it is the only valid target.
    branches:
      - ${finalBranch}

permissions: {}

jobs:
  check-pr-target:
    runs-on: ubuntu-latest
    steps:
      - name: Confirm correct target
        run: |
          echo "✅ PR correctly targets '${initialBranch}' branch"
          echo "Single-branch flow: '${initialBranch}' is the only branch in the flow."
`
        }

        return `${ENFORCE_HEADER}name: Enforce PR Target Branch

# pull_request_target, not pull_request. GitHub's approval gate applies to pull_request runs
# from a first-time contributor, and 'github-actions[bot]' is one, so the last promotion hop
# (the only one whose base is '${finalBranch}') opened an approval-gated run that nobody
# approves. It expired and reported a failure against every release. pull_request_target runs
# in the base repository's context and carries no such gate.
#
# The usual hazard of pull_request_target is running a fork's code with a write token. This
# job checks out nothing and runs nothing from the pull request; it reads two ref names and
# echoes. 'permissions: {}' removes the token as well, so there is nothing left to misuse.
#
# No 'branches:' filter. That filter matches on the pull request's base, so scoping it to
# '${finalBranch}' made github.base_ref always '${finalBranch}' inside a run: the reject step
# fired every time and the confirm step below could never run. Worse, a contributor who
# followed the rejection text and retargeted the PR to '${initialBranch}' produced an
# 'edited' event the filter excluded, so no new run started and the failed 'check-pr-target'
# remained the latest status on that head SHA — unmergeable where branch protection requires
# it. The filter was there to keep promotion PRs from opening approval-gated runs; the
# pull_request_target trigger has no approval gate, and the pipecraft-promote guard on the
# job below is what skips those PRs now.
on:
  pull_request_target:
    types: [opened, edited, synchronize, reopened]

permissions: {}

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
      },
      toFile(ENFORCE_PR_TARGET_PATH),
      // This workflow is entirely generated — unlike pipeline.yml it has no user-editable
      // regions to preserve. Without force, Pinion skips the file whenever it already
      // exists, so the branches baked into it never change: renaming finalBranch left the
      // old name enforced, and collapsing to a single-branch flow left the rejecting
      // version in place, failing every PR.
      { force: true }
    )
  )
