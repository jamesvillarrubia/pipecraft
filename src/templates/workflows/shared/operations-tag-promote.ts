/**
 * Shared Tag, Promote, and Release Job Operations
 *
 * Generates the tag creation, branch promotion, and GitHub release jobs.
 */

import {
  createValueFromString,
  type PathOperationConfig
} from '../../../utils/ast-path-operations.js'
import { getActionReference } from '../../../utils/action-reference.js'
import type { PipecraftConfig } from '../../../types/index.js'

/**
 * Only promote commits GitHub authored, or a run a maintainer started deliberately.
 *
 * A merged pull request produces a commit whose committer is `noreply@github.com`, because
 * GitHub creates it. A fast-forward promotion preserves that, so the marker survives the
 * whole branch flow. A commit pushed by hand keeps its author's address and does not
 * promote — which stops a hotfix typed on the wrong branch from cutting a release.
 *
 * `workflow_dispatch` stays open so a promotion can always be triggered on purpose.
 */
const PROMOTION_SOURCE_GATE =
  "(github.event.head_commit.committer.email == 'noreply@github.com' || " +
  "github.event_name == 'workflow_dispatch')"

export interface TagPromoteContext {
  branchFlow: string[]
  autoPromote?: boolean | Record<string, boolean> // global boolean, or per-target map
  mergeStrategy?: 'fast-forward' | 'merge' // how promotions land on the target branch
  config?: Partial<PipecraftConfig>
}

/**
 * Create tag, promote, and release job operations
 */
export function createTagPromoteReleaseOperations(ctx: TagPromoteContext): PathOperationConfig[] {
  const { branchFlow, config = {} } = ctx
  // Provide sensible defaults if branchFlow is invalid
  const validBranchFlow =
    branchFlow && Array.isArray(branchFlow) && branchFlow.length > 0 ? branchFlow : ['main']
  const initialBranch = validBranchFlow[0]
  // How promotions land on the target branch (default fast-forward for linear history).
  const mergeStrategy = ctx.mergeStrategy === 'merge' ? 'merge' : 'fast-forward'

  // Get action references based on configuration
  const tagActionRef = getActionReference('create-tag', config)
  const promoteActionRef = getActionReference('promote-branch', config)
  const releaseActionRef = getActionReference('create-release', config)

  // Build tag job conditional (should only run on initial branch, not on PRs)
  // Now depends on the gate job instead of individual test jobs
  const tagConditions = [
    'always()',
    "github.event_name != 'pull_request'",
    `github.ref_name == '${initialBranch}'`,
    "needs.version.result == 'success'",
    "needs.version.outputs.version != ''",
    "needs.gate.result == 'success'", // Gate job must succeed
    PROMOTION_SOURCE_GATE
  ]

  // Default needs: version + gate (gate already checks all test jobs)
  const tagNeedsArray = ['version', 'gate']
  const defaultTagIfCondition = tagConditions.join(' && ')

  return [
    // TAG JOB - Ensure the job key exists with comment (but don't overwrite existing job)
    {
      path: 'jobs.tag',
      operation: 'preserve',
      spaceBefore: true,
      commentBefore: `
=============================================================================
 TAG (⚠️  Managed by Pipecraft - customizable needs and if)
=============================================================================
 Creates git tags and promotes code through branch flow.
 The 'needs' and 'if' fields are customizable and will be preserved.
 All other fields (runs-on, steps) are managed by Pipecraft.
`,
      value: {} // Empty object - just ensures the job exists with the comment
    },
    // TAG JOB NEEDS - Preserve user customizations, default to version + gate
    {
      path: 'jobs.tag.needs',
      operation: 'preserve',
      value: tagNeedsArray
    },
    // TAG JOB IF - Preserve user customizations, default to standard conditions
    //
    // Now simplified: just check that gate job succeeded (gate already validates all tests)
    //
    // Pattern:
    //   if: ${{
    //     always() &&
    //     github.event_name != 'pull_request' &&
    //     github.ref_name == 'develop' &&
    //     needs.version.result == 'success' &&
    //     needs.version.outputs.version != '' &&
    //     needs.gate.result == 'success'
    //   }}
    {
      path: 'jobs.tag.if',
      operation: 'preserve',
      value: createValueFromString(`\${{ ${defaultTagIfCondition} }}`)
    },
    // TAG JOB RUNS-ON - Always managed
    {
      path: 'jobs.tag.runs-on',
      operation: 'overwrite',
      value: 'ubuntu-latest'
    },
    // TAG JOB STEPS - Always managed
    {
      path: 'jobs.tag.steps',
      operation: 'overwrite',
      value: createValueFromString(`
      - uses: actions/checkout@v5
        with:
          ref: \${{ inputs.commitSha || github.sha }}
          fetch-depth: \${{ env.FETCH_DEPTH_VERSIONING }}
      - uses: ${tagActionRef}
        with:
          version: \${{ needs.version.outputs.version }}
  `)
    },

    // PROMOTE JOB
    {
      path: 'jobs.promote',
      operation: 'overwrite',
      spaceBefore: true,
      commentBefore: `
=============================================================================
 PROMOTE (⚠️  Managed by Pipecraft - do not modify)
=============================================================================
 Promotes code from develop to staging or main via PR.
`,
      value: createValueFromString(`
    needs: [ version, tag ]
    if: \${{ always() && (github.event_name == 'push' || github.event_name == 'workflow_dispatch') && ${PROMOTION_SOURCE_GATE} && needs.version.result == 'success' && needs.version.outputs.version != '' && (needs.tag.result == 'success' || needs.tag.result == 'skipped') && (${buildPromotableBranchesCondition(
        validBranchFlow
      )}) }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          ref: \${{ inputs.commitSha || github.sha }}
          fetch-depth: \${{ env.FETCH_DEPTH_VERSIONING }}
      - uses: ${promoteActionRef}
        with:
          version: \${{ needs.version.outputs.version }}
          sourceBranch: \${{ github.ref_name }}
          targetBranch: \${{ ${buildTargetBranchExpression(validBranchFlow)} }}
          autoPromote: \${{ ${buildAutoPromoteExpression(validBranchFlow, ctx.autoPromote)} }}
          mergeStrategy: ${mergeStrategy}
          run_number: \${{ inputs.run_number || github.run_number }}
  `)
    },

    // RELEASE JOB
    {
      path: 'jobs.release',
      operation: 'overwrite',
      spaceBefore: true,
      commentBefore: `
=============================================================================
 RELEASE (⚠️  Managed by Pipecraft - do not modify)
=============================================================================
 Creates a release for the version.
`,
      value: createValueFromString(`
    needs: [ tag, version ]
    if: \${{ always() && github.ref_name == '${
      validBranchFlow[validBranchFlow.length - 1]
    }' && needs.version.result == 'success' && needs.version.outputs.version != '' && (needs.tag.result == 'success' || needs.tag.result == 'skipped') }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          ref: \${{ inputs.commitSha || github.sha }}
          fetch-depth: \${{ env.FETCH_DEPTH_VERSIONING }}
      - uses: ${releaseActionRef}
        with:
          version: \${{ needs.version.outputs.version }}
          commitSha: \${{ inputs.commitSha }}
  `)
    }
  ]
}

/**
 * Builds a condition that ensures at least ONE success AND NO failures for a set of jobs.
 *
 * This is the standard pattern for gating jobs (like tag) that depend on multiple test/deploy jobs.
 *
 * Pattern:
 *   - NO failures: All jobs must not be 'failure' (skipped is OK, failure is not)
 *   - AT LEAST ONE success: At least one job must be 'success' (skipped doesn't count as success)
 *
 * @param jobNames - Array of job names to check (e.g., ['test-cicd', 'test-core', 'deploy-docs'])
 * @returns Condition string like: "(needs.job1.result != 'failure' && needs.job2.result != 'failure') && (needs.job1.result == 'success' || needs.job2.result == 'success')"
 *
 * @example
 * ```typescript
 * // For test jobs
 * buildAtLeastOneSuccessNoFailuresCondition(['test-cicd', 'test-core', 'test-docs'])
 * // Returns: "(needs.test-cicd.result != 'failure' && needs.test-core.result != 'failure' && needs.test-docs.result != 'failure') && (needs.test-cicd.result == 'success' || needs.test-core.result == 'success' || needs.test-docs.result == 'success')"
 *
 * // For deployment jobs
 * buildAtLeastOneSuccessNoFailuresCondition(['deploy-staging', 'deploy-prod'])
 * // Returns: "(needs.deploy-staging.result != 'failure' && needs.deploy-prod.result != 'failure') && (needs.deploy-staging.result == 'success' || needs.deploy-prod.result == 'success')"
 * ```
 */
function buildAtLeastOneSuccessNoFailuresCondition(jobNames: string[]): string {
  if (jobNames.length === 0) {
    return ''
  }

  // Ensure NO failures (skipped is OK, but failure is not)
  const noFailures = jobNames.map(job => `needs.${job}.result != 'failure'`).join(' && ')

  // Ensure AT LEAST ONE success (skipped jobs don't count as success)
  const atLeastOneSuccess = jobNames.map(job => `needs.${job}.result == 'success'`).join(' || ')

  return `(${noFailures}) && (${atLeastOneSuccess})`
}

/**
 * Helper to build promotable branches condition
 * Returns a condition that checks if current branch is promotable (all except final branch)
 * For single-branch workflows, returns 'false' to skip the promote job
 */
function buildPromotableBranchesCondition(branchFlow: string[]): string {
  const promotableBranches = branchFlow.slice(0, -1) // All branches except the last one
  if (promotableBranches.length === 0) {
    return 'false' // Single-branch workflow - no promotion needed
  }
  return promotableBranches.map(branch => `github.ref_name == '${branch}'`).join(' || ')
}

/**
 * Helper to build the targetBranch expression
 * Maps each source branch to its target branch
 */
function buildTargetBranchExpression(branchFlow: string[]): string {
  if (branchFlow.length === 1) return `''`
  if (branchFlow.length === 2) return `'${branchFlow[1]}'`

  // For 3+ branches: develop → staging, staging → main
  // github.ref_name == 'develop' && 'staging' || 'main'
  return `github.ref_name == '${branchFlow[0]}' && '${branchFlow[1]}' || '${
    branchFlow[branchFlow.length - 1]
  }'`
}

/**
 * Helper to build the autoPromote expression
 * Maps each target branch to its autoPromote setting
 */
function buildAutoPromoteExpression(
  branchFlow: string[],
  autoPromote?: boolean | Record<string, boolean>
): string {
  if (!autoPromote || branchFlow.length === 1) return `'false'`

  // autoPromote may be a global boolean (true = auto-promote every hop) or a per-target
  // map ({ staging: true, main: false }). A bare `true` must enable every hop — indexing
  // it as `true[targetBranch]` yields undefined, which previously made `autoPromote: true`
  // silently behave as all-manual.
  const allHops = autoPromote === true
  const map = typeof autoPromote === 'object' ? autoPromote : {}

  const clauses: string[] = []
  for (let i = 0; i < branchFlow.length - 1; i += 1) {
    const sourceBranch = branchFlow[i]
    const targetBranch = branchFlow[i + 1]
    const isEnabled = allHops || map[targetBranch] ? 'true' : 'false'
    clauses.push(`(github.ref_name == '${sourceBranch}' && '${isEnabled}')`)
  }

  if (clauses.length === 0) {
    return `'false'`
  }

  return `${clauses.join(' || ')} || 'false'`
}
