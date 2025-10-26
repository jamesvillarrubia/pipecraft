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
  const action = useNx ? 'detect-changes-nx' : 'detect-changes'
  const sortedDomains = Object.keys(domains).sort()

  const comment = `
=============================================================================
CHANGES DETECTION (⚠️  Managed by Pipecraft - do not modify)
=============================================================================
${useNx
    ? 'Detects which domains have changed using Nx dependency graph and path-based fallback'
    : 'Detects which domains have changed using path-based detection'
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
    commentBefore: comment,
    value: createValueFromString(`
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
          fetch-depth: 0
      - uses: ./.github/actions/${action}
        id: detect
        with:
          baseRef: \${{ inputs.baseRef || '${baseRef}' }}${useNx ? '\n          useNx: \'true\'' : ''}
    outputs:
${outputsSection}
${nxOutputs}
  `)
  }
}
