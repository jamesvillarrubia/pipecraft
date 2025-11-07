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

export interface TagPromoteContext {
  branchFlow: string[]
  deployJobNames: string[]
  remoteTestJobNames: string[]
  testJobNames?: string[] // Optional test job names for default tag job dependencies
  autoMerge?: Record<string, boolean> // autoMerge settings per branch
  config?: Partial<PipecraftConfig>
}

/**
 * Create tag, promote, and release job operations
 */
export function createTagPromoteReleaseOperations(ctx: TagPromoteContext): PathOperationConfig[] {
  const { branchFlow, deployJobNames, remoteTestJobNames, testJobNames = [], config = {} } = ctx
  // Provide sensible defaults if branchFlow is invalid
  const validBranchFlow =
    branchFlow && Array.isArray(branchFlow) && branchFlow.length > 0 ? branchFlow : ['main']
  const initialBranch = validBranchFlow[0]

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
    "needs.gate.result == 'success'"  // Gate job must succeed
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
      value: {}  // Empty object - just ensures the job exists with the comment
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
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
          fetch-depth: \${{ env.FETCH_DEPTH_VERSIONING }}
      - uses: ${tagActionRef}
        with:
          version: \${{ needs.version.outputs.version }}
          commitSha: \${{ inputs.commitSha || github.sha }}
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
    if: \${{ always() && (github.event_name == 'push' || github.event_name == 'workflow_dispatch') && needs.version.result == 'success' && needs.version.outputs.version != '' && (needs.tag.result == 'success' || needs.tag.result == 'skipped') && (${buildPromotableBranchesCondition(
      validBranchFlow
    )}) }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
          fetch-depth: \${{ env.FETCH_DEPTH_VERSIONING }}
      - uses: ${promoteActionRef}
        with:
          version: \${{ needs.version.outputs.version }}
          sourceBranch: \${{ github.ref_name }}
          targetBranch: \${{ ${buildTargetBranchExpression(validBranchFlow)} }}
          autoMerge: \${{ ${buildAutoMergeExpression(validBranchFlow, ctx.autoMerge)} }}
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
    }' && needs.version.result == 'success' && needs.version.outputs.version != '' && needs.tag.result == 'success' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
          fetch-depth: \${{ env.FETCH_DEPTH_VERSIONING }}
      - uses: ${releaseActionRef}
        with:
          version: \${{ needs.version.outputs.version }}
          commitSha: \${{ inputs.commitSha || github.sha }}
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
 */
function buildPromotableBranchesCondition(branchFlow: string[]): string {
  const promotableBranches = branchFlow.slice(0, -1) // All branches except the last one
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
 * Helper to build the autoMerge expression
 * Maps each target branch to its autoMerge setting
 */
function buildAutoMergeExpression(
  branchFlow: string[],
  autoMerge?: Record<string, boolean>
): string {
  if (!autoMerge || branchFlow.length === 1) return `'false'`
  if (branchFlow.length === 2) {
    const target = branchFlow[1]
    return `'${autoMerge[target] ? 'true' : 'false'}'`
  }

  // For 3+ branches: develop → staging (check staging autoMerge), staging → main (check main autoMerge)
  // github.ref_name == 'develop' && 'true' || 'false'
  const stagingTarget = branchFlow[1]
  const mainTarget = branchFlow[branchFlow.length - 1]
  return `github.ref_name == '${branchFlow[0]}' && '${
    autoMerge[stagingTarget] ? 'true' : 'false'
  }' || '${autoMerge[mainTarget] ? 'true' : 'false'}'`
}
