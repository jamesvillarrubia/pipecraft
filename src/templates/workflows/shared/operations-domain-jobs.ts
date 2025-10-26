/**
 * Shared Domain Job Operations
 *
 * Generates test, deploy, and remote-test jobs for each domain.
 * These jobs are marked as 'preserve' so users can customize them.
 */

import { PathOperationConfig, createValueFromString } from '../../../utils/ast-path-operations.js'

export interface DomainJobsContext {
  domains: Record<string, any>
}

/**
 * Create test job operations for each domain
 */
export function createDomainTestJobOperations(ctx: DomainJobsContext): PathOperationConfig[] {
  const { domains } = ctx
  const operations: PathOperationConfig[] = []

  const testableDomains = Object.keys(domains).sort().filter(d => domains[d].testable !== false)

  testableDomains.forEach((domain, index) => {
    operations.push({
      path: `jobs.test-${domain}`,
      operation: 'preserve', // User can customize this job!
      // Only add comment to the first test job
      ...(index === 0 && {
        commentBefore: `
=============================================================================
TESTING JOBS (✅ Customize these with your test logic)
=============================================================================
These jobs run tests for each domain when changes are detected.
Replace the TODO comments with your actual test commands.
`
      }),
      value: createValueFromString(`
    needs: changes
    if: \${{ needs.changes.outputs.${domain} == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
      # TODO: Replace with your ${domain} test logic
      - name: Run ${domain} tests
        run: |
          echo "Running tests for ${domain} domain"
          echo "Replace this with your actual test commands"
          # Example: npm test -- --testPathPattern=${domain}
  `)
    })
  })

  return operations
}

/**
 * Create deploy job operations for deployable domains
 */
export function createDomainDeployJobOperations(ctx: DomainJobsContext): PathOperationConfig[] {
  const { domains } = ctx
  const operations: PathOperationConfig[] = []

  const deployableDomains = Object.keys(domains).sort().filter(d => domains[d].deployable === true)

  deployableDomains.forEach((domain, index) => {
    operations.push({
      path: `jobs.deploy-${domain}`,
      operation: 'preserve', // User can customize this job!
      // Only add comment to the first deploy job
      ...(index === 0 && {
        commentBefore: `
=============================================================================
DEPLOYMENT JOBS (✅ Customize these with your deploy logic)
=============================================================================
These jobs deploy each domain when changes are detected and tests pass.
Replace the TODO comments with your actual deployment commands.
`
      }),
      value: createValueFromString(`
    needs: [ version, changes ]
    if: \${{ always() && needs.version.result == 'success' && needs.changes.outputs.${domain} == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
      # TODO: Replace with your ${domain} deployment logic
      - name: Deploy ${domain}
        run: |
          echo "Deploying ${domain} with version \${{ needs.version.outputs.version }}"
          echo "Replace this with your actual deploy commands"
          # Example: npm run deploy:${domain}
  `)
    })
  })

  return operations
}

/**
 * Create remote test job operations for remotely testable domains
 */
export function createDomainRemoteTestJobOperations(ctx: DomainJobsContext): PathOperationConfig[] {
  const { domains } = ctx
  const operations: PathOperationConfig[] = []

  const remoteTestableDomains = Object.keys(domains).sort().filter(d => domains[d].remoteTestable === true)

  remoteTestableDomains.forEach((domain, index) => {
    operations.push({
      path: `jobs.remote-test-${domain}`,
      operation: 'preserve', // User can customize this job!
      // Only add comment to the first remote test job
      ...(index === 0 && {
        commentBefore: `
=============================================================================
REMOTE TESTING JOBS (✅ Customize these with your remote test logic)
=============================================================================
These jobs test deployed services remotely after deployment succeeds.
Replace the TODO comments with your actual remote testing commands.
`
      }),
      value: createValueFromString(`
    needs: [ deploy-${domain}, changes ]
    if: \${{ always() }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
      # TODO: Replace with your ${domain} remote testing logic
      - name: Test ${domain} remotely
        if: \${{ needs.changes.outputs.${domain} == 'true' && needs.deploy-${domain}.result == 'success' }}
        run: |
          echo "Testing ${domain} remotely"
          echo "Replace this with your actual remote test commands"
          # Example: npm run test:remote:${domain}
  `)
    })
  })

  return operations
}

/**
 * Get list of all domain job names for dependency management
 */
export function getDomainJobNames(domains: Record<string, any>): {
  testJobs: string[]
  deployJobs: string[]
  remoteTestJobs: string[]
} {
  return {
    testJobs: Object.keys(domains).sort().filter(d => domains[d].testable !== false).map(d => `test-${d}`),
    deployJobs: Object.keys(domains).sort().filter(d => domains[d].deployable === true).map(d => `deploy-${d}`),
    remoteTestJobs: Object.keys(domains).sort().filter(d => domains[d].remoteTestable === true).map(d => `remote-test-${d}`)
  }
}
