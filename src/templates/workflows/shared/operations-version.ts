/**
 * Shared Version Job Operation
 *
 * Generates the version calculation job that determines the next semantic version.
 */

import {
  createValueFromString,
  type PathOperationConfig
} from '../../../utils/ast-path-operations.js'

export interface VersionContext {
  testJobNames: string[]
  nxEnabled?: boolean
  baseRef?: string
}

/**
 * Create the version calculation job operation
 */
export function createVersionJobOperation(ctx: VersionContext): PathOperationConfig {
  const { testJobNames, nxEnabled = false, baseRef = 'main' } = ctx

  // Build the needs array
  const nxJobName = nxEnabled ? 'test-nx' : null
  const needsArray = ['changes', nxJobName, ...testJobNames].filter(Boolean)

  // Build the conditional logic
  const nxCondition = nxEnabled ? "needs.test-nx.result == 'success'" : ''
  const testConditions =
    testJobNames.length > 0
      ? [
          `(${testJobNames.map(job => `needs.${job}.result == 'success'`).join(' || ')})`,
          testJobNames.map(job => `needs.${job}.result != 'failure'`).join(' && ')
        ]
      : []

  const allConditions = [
    'always()',
    "github.event_name != 'pull_request'",
    nxCondition,
    ...testConditions
  ]
    .filter(Boolean)
    .join(' && ')

  return {
    path: 'jobs.version',
    operation: 'overwrite',
    spaceBefore: true,
    commentBefore: `
=============================================================================
 VERSIONING (⚠️  Managed by Pipecraft - do not modify)
=============================================================================
 Calculates the next semantic version based on conventional commits.
 Only runs on push events (skipped on pull requests).
`,
    value: createValueFromString(`
    needs: [ ${needsArray.join(', ')} ]
    if: \${{ ${allConditions} }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
          fetch-depth: \${{ env.FETCH_DEPTH_VERSIONING }}
      - uses: ./.github/actions/calculate-version
        id: version
        with:
          baseRef: \${{ inputs.baseRef || '${baseRef}' }}
          commitSha: \${{ inputs.commitSha || github.sha }}
          node-version: \${{ env.NODE_VERSION }}
    outputs:
      version: \${{ steps.version.outputs.version }}
  `)
  }
}
