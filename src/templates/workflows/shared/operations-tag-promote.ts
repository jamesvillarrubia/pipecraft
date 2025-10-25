/**
 * Shared Tag, Promote, and Release Job Operations
 *
 * Generates the tag creation, branch promotion, and GitHub release jobs.
 */

import { PathOperationConfig, createValueFromString } from '../../../utils/ast-path-operations.js'

export interface TagPromoteContext {
  branchFlow: string[]
  deployJobNames: string[]
  remoteTestJobNames: string[]
}

/**
 * Create tag, promote, and release job operations
 */
export function createTagPromoteReleaseOperations(ctx: TagPromoteContext): PathOperationConfig[] {
  const { branchFlow, deployJobNames, remoteTestJobNames } = ctx
  // Provide sensible defaults if branchFlow is invalid
  const validBranchFlow = (branchFlow && Array.isArray(branchFlow) && branchFlow.length > 0) ? branchFlow : ['main']
  const allDeploymentJobs = [...deployJobNames, ...remoteTestJobNames]
  const initialBranch = validBranchFlow[0]

  // Build tag job conditional (should only run on initial branch, not on PRs)
  const tagConditions = [
    'always()',
    'github.event_name != \'pull_request\'',
    `github.ref_name == '${initialBranch}'`,
    'needs.version.result == \'success\'',
    'needs.version.outputs.version != \'\''
  ]

  if (allDeploymentJobs.length > 0) {
    const noFailures = allDeploymentJobs.map(job => `needs.${job}.result != 'failure'`).join(' && ')
    const atLeastOneSuccess = allDeploymentJobs.map(job => `needs.${job}.result == 'success'`).join(' || ')
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
TAG & PROMOTE (⚠️  Managed by Pipecraft - do not modify)
=============================================================================
Creates git tags and promotes code through branch flow.
`,
      value: createValueFromString(`
    if: \${{ ${tagConditions.join(' && ')} }}
    needs: [ ${tagNeedsArray.join(', ')} ]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
      - uses: ./.github/actions/create-tag
        with:
          version: \${{ needs.version.outputs.version }}
          commitSha: \${{ inputs.commitSha || github.sha }}
  `)
    },

    // PROMOTE JOB
    {
      path: 'jobs.promote',
      operation: 'overwrite',
      value: createValueFromString(`
    if: \${{ always() && (github.event_name == 'push' || github.event_name == 'workflow_dispatch') && needs.version.result == 'success' && needs.version.outputs.version != '' && (needs.tag.result == 'success' || needs.tag.result == 'skipped') && (${buildPromotableBranchesCondition(validBranchFlow)}) }}
    needs: [ version, tag ]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
      - uses: ./.github/actions/promote-branch
        with:
          version: \${{ needs.version.outputs.version }}
          currentBranch: \${{ github.ref_name }}
          nextBranch: \${{ ${buildNextBranchExpression(validBranchFlow)} }}
          runNumber: \${{ github.run_number }}
  `)
    },

    // RELEASE JOB
    {
      path: 'jobs.release',
      operation: 'overwrite',
      value: createValueFromString(`
    if: \${{ always() && github.ref_name == '${validBranchFlow[validBranchFlow.length - 1]}' && needs.version.result == 'success' && needs.version.outputs.version != '' && needs.tag.result == 'success' }}
    needs: [ tag, version ]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
      - uses: ./.github/actions/create-release
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
 * Helper to build the nextBranch expression
 */
function buildNextBranchExpression(branchFlow: string[]): string {
  if (branchFlow.length === 1) return `''`
  if (branchFlow.length === 2) return `'${branchFlow[1]}'`

  // For 3+ branches: develop → staging, staging → main
  return `github.ref_name == '${branchFlow[0]}' && '${branchFlow[1]}' || '${branchFlow[branchFlow.length - 1]}'`
}
