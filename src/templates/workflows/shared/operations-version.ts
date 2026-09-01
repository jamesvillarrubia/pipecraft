/**
 * Shared Version Job Operation
 *
 * Generates the version calculation job that determines the next semantic version.
 */

import {
  createValueFromString,
  type PathOperationConfig
} from '../../../utils/ast-path-operations.js'
import { getActionReference } from '../../../utils/action-reference.js'
import type { PipecraftConfig } from '../../../types/index.js'

export interface VersionContext {
  testJobNames: string[]
  baseRef?: string
  config?: Partial<PipecraftConfig>
}

/**
 * Create the version calculation job operation
 */
export function createVersionJobOperation(ctx: VersionContext): PathOperationConfig {
  const { testJobNames, baseRef = 'main', config = {} } = ctx
  const finalBranch = config.finalBranch || 'main'

  // Get the action reference based on configuration
  const actionRef = getActionReference('calculate-version', config)

  // Build the needs array
  const needsArray = ['changes', ...testJobNames].filter(Boolean)

  // Build the conditional logic
  const testConditions =
    testJobNames.length > 0
      ? [
          `(${testJobNames.map(job => `needs.${job}.result == 'success'`).join(' || ')})`,
          testJobNames.map(job => `needs.${job}.result != 'failure'`).join(' && ')
        ]
      : []

  const allConditions = ['always()', "github.event_name != 'pull_request'", ...testConditions]
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
    // The checkout below uses `filter: blob:none`. Versioning reads tags and commit
    // subjects, never file contents, so depth 0 is required for the tag history but the
    // blobs in that history are not. Git fetches a blob on demand if a step asks for one.
    // The filter is set here rather than as a YAML comment because a comment inside the
    // `with:` mapping forces the serializer out of flow style and reshapes the whole job.
    value: createValueFromString(`
    needs: [ ${needsArray.join(', ')} ]
    if: \${{ ${allConditions} }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          ref: \${{ inputs.commitSha || github.sha }}
          fetch-depth: \${{ env.FETCH_DEPTH_VERSIONING }}
          filter: blob:none
      - uses: ${actionRef}
        id: version
        with:
          baseRef: \${{ inputs.baseRef || '${baseRef}' }}
          version: \${{ inputs.version }}
          node-version: \${{ env.NODE_VERSION }}
          commitSha: \${{ inputs.commitSha }}
      - name: Warn if no version resolved on the final branch
        if: \${{ github.ref_name == '${finalBranch}' && steps.version.outputs.version == '' }}
        shell: bash
        run: |
          echo "::warning title=pipecraft::No version resolved on final branch '${finalBranch}' — tag/release will be skipped. This usually means the promote PR was merged as a merge commit, leaving the version tag off HEAD. Merge promote PRs with fast-forward or rebase so the tag lands on HEAD."
    outputs:
      version: \${{ steps.version.outputs.version }}
  `)
  }
}
