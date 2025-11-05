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
  autoMerge?: Record<string, boolean> // autoMerge settings per branch
  config?: Partial<PipecraftConfig>
}

/**
 * Create tag, promote, and release job operations
 */
export function createTagPromoteReleaseOperations(ctx: TagPromoteContext): PathOperationConfig[] {
  const { branchFlow, deployJobNames, remoteTestJobNames, config = {} } = ctx
  // Provide sensible defaults if branchFlow is invalid
  const validBranchFlow =
    branchFlow && Array.isArray(branchFlow) && branchFlow.length > 0 ? branchFlow : ['main']
  const allDeploymentJobs = [...deployJobNames, ...remoteTestJobNames]
  const initialBranch = validBranchFlow[0]

  // Get action references based on configuration
  const tagActionRef = getActionReference('create-tag', config)
  const promoteActionRef = getActionReference('promote-branch', config)
  const releaseActionRef = getActionReference('create-release', config)

  // Build tag job conditional (should only run on initial branch, not on PRs)
  const tagConditions = [
    'always()',
    "github.event_name != 'pull_request'",
    `github.ref_name == '${initialBranch}'`,
    "needs.version.result == 'success'",
    "needs.version.outputs.version != ''"
  ]

  if (allDeploymentJobs.length > 0) {
    const noFailures = allDeploymentJobs.map(job => `needs.${job}.result != 'failure'`).join(' && ')
    const atLeastOneSuccess = allDeploymentJobs
      .map(job => `needs.${job}.result == 'success'`)
      .join(' || ')
    tagConditions.push(`(${noFailures})`)
    tagConditions.push(`(${atLeastOneSuccess})`)
  }

  const tagNeedsArray = ['version', ...allDeploymentJobs]

  return [
    // TAG JOB
    {
      path: 'jobs.tag',
      operation: 'overwrite',
      commentBefore: `
=============================================================================
 TAG (⚠️  Managed by Pipecraft - do not modify)
=============================================================================
 Creates git tags and promotes code through branch flow.
`,
      value: createValueFromString(`
    needs: [ ${tagNeedsArray.join(', ')} ]
    if: \${{ ${tagConditions.join(' && ')} }}
    runs-on: ubuntu-latest
    steps:
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
          run_number: \${{ github.run_number }}
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
