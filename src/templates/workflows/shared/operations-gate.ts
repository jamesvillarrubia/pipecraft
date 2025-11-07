/**
 * Gate Job Operation
 *
 * Creates a gate job that enforces "at least one success AND no failures" pattern
 * for all test jobs. This provides a single point of control for gating downstream
 * jobs like tag, promote, and deploy.
 */

import {
  createValueFromString,
  type PathOperationConfig
} from '../../../utils/ast-path-operations.js'

export interface GateJobContext {
  testJobNames: string[]
  deployJobNames?: string[]
  /**
   * All jobs by prefix (from getDomainJobNames)
   * Allows gating on any custom prefix jobs (e.g., lint, build, etc.)
   */
  allJobsByPrefix?: Record<string, string[]>
}

/**
 * Create a gate job operation that runs after all test jobs
 *
 * The gate job:
 * - Runs on ALL events (PRs, push to any branch)
 * - Depends on all test jobs
 * - Uses "at least one success AND no failures" pattern
 * - Provides a single gate point for downstream jobs (tag, deploy, etc.)
 * - Always runs (even if tests are skipped) using always()
 *
 * @param ctx - Context containing test job names
 * @returns Path operation config for the gate job
 */
export function createGateJobOperation(ctx: GateJobContext): PathOperationConfig {
  const { testJobNames, deployJobNames = [], allJobsByPrefix = {} } = ctx

  // Collect all jobs from all prefixes
  const allPrefixJobs = Object.values(allJobsByPrefix).flat()

  // Combine test jobs, deploy jobs, and all prefix-based jobs
  // Use Set to deduplicate (test/deploy jobs might also be in allJobsByPrefix)
  const allGateJobs = Array.from(new Set([...testJobNames, ...deployJobNames, ...allPrefixJobs]))

  if (allGateJobs.length === 0) {
    // No jobs to gate - return a minimal gate that always succeeds
    return {
      path: 'jobs.gate',
      operation: 'overwrite',
      spaceBefore: true,
      commentBefore: `
=============================================================================
 GATE (⚠️  Managed by Pipecraft - do not modify)
=============================================================================
 Gate job that ensures tests pass before allowing tag/promote/deploy.
 Uses pattern: at least ONE success AND NO failures (skipped is OK).
`,
      value: createValueFromString(`
    needs: [ version ]
    if: \${{ always() && needs.version.result == 'success' }}
    runs-on: ubuntu-latest
    steps:
      - name: Gate passed
        run: echo "No test jobs configured - gate passes"
  `)
    }
  }

  // Build the "at least one success AND no failures" condition
  const noFailures = allGateJobs.map(job => `needs.${job}.result != 'failure'`).join(' && ')
  const atLeastOneSuccess = allGateJobs.map(job => `needs.${job}.result == 'success'`).join(' || ')
  const gateCondition = `always() && needs.version.result == 'success' && (${noFailures}) && (${atLeastOneSuccess})`

  return {
    path: 'jobs.gate',
    operation: 'overwrite',
    spaceBefore: true,
    commentBefore: `
=============================================================================
 GATE (⚠️  Managed by Pipecraft - do not modify)
=============================================================================
 Gate job that ensures tests pass before allowing tag/promote/deploy.
 Uses pattern: at least ONE success AND NO failures (skipped is OK).
`,
    value: createValueFromString(`
    needs: [ version, ${allGateJobs.join(', ')} ]
    if: \${{ ${gateCondition} }}
    runs-on: ubuntu-latest
    steps:
      - name: Gate passed
        run: echo "All tests passed - gate allows progression"
  `)
  }
}
