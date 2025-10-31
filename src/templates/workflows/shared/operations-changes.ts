/**
 * Shared Changes Detection Job Operations
 *
 * Generates the changes detection job that identifies which domains have changed.
 * Supports both Nx-based detection (using dependency graph) and path-based detection.
 */

import { PathOperationConfig, createValueFromString } from '../../../utils/ast-path-operations.js'

export interface ChangesContext {
  domains: Record<string, any>
  useNx?: boolean
  baseRef?: string
}

/**
 * Create the changes detection job operation
 */
export function createChangesJobOperation(ctx: ChangesContext): PathOperationConfig {
  const { domains, useNx = false, baseRef = 'main' } = ctx
  // Always use 'detect-changes' - it handles both Nx and path-based detection
  const action = 'detect-changes'
  const sortedDomains = Object.keys(domains).sort()

  const comment = `
=============================================================================
 CHANGES DETECTION (⚠️  Managed by Pipecraft - do not modify)
=============================================================================
 ${useNx
    ? 'This job detects which domains have changed and sets outputs for downstream jobs.'
    : 'This job detects which domains have changed and sets outputs for downstream jobs.'
}
`

  const outputsSection = sortedDomains.map(domain => `      ${domain}: \${{ steps.detect.outputs.${domain} }}`).join('\n')

  const nxOutputs = useNx
    ? `      nxAvailable: \${{ steps.detect.outputs.nxAvailable }}
      affectedProjects: \${{ steps.detect.outputs.affectedProjects }}`
    : ''

  return {
    path: 'jobs.changes',
    operation: 'overwrite',
    spaceBefore: true,
    commentBefore: comment,
    value: createValueFromString(`
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
          fetch-depth: \${{ env.FETCH_DEPTH_AFFECTED }}
      - uses: ./.github/actions/${action}
        id: detect
        with:
          baseRef: \${{ inputs.baseRef || '${baseRef}' }}${useNx ? '\n          useNx: \'true\'' : ''}
          node-version: \${{ env.NODE_VERSION }}
          pnpm-version: \${{ env.PNPM_VERSION }}
    outputs:
${outputsSection}
${nxOutputs}
  `)
  }
}
