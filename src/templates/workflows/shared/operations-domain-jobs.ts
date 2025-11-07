/**
 * Shared Domain Job Operations
 *
 * Generates test, deploy, and remote-test jobs for each domain.
 * These jobs are marked as 'preserve' so users can customize them.
 */

import {
  createValueFromString,
  type PathOperationConfig
} from '../../../utils/ast-path-operations.js'

export interface DomainJobsContext {
  domains: Record<string, any>
}

/**
 * Create placeholder job operations for domains with custom prefixes
 *
 * Generates jobs based on the `prefixes` field in domain config.
 * For example, with domain 'core' and prefixes ['lint', 'build', 'test'],
 * this creates: lint-core, build-core, test-core
 *
 * @param ctx Context with domain configurations
 * @returns Array of path operations for all prefix-based jobs
 */
export function createPrefixedDomainJobOperations(ctx: DomainJobsContext): PathOperationConfig[] {
  const { domains } = ctx
  const operations: PathOperationConfig[] = []

  // Group jobs by prefix to add section comments
  const jobsByPrefix: Record<string, Array<{ domain: string; jobName: string }>> = {}

  Object.keys(domains)
    .sort()
    .forEach(domain => {
      const domainConfig = domains[domain]

      // Only process domains with prefixes defined
      if (domainConfig.prefixes && Array.isArray(domainConfig.prefixes)) {
        domainConfig.prefixes.forEach((prefix: string) => {
          if (!jobsByPrefix[prefix]) {
            jobsByPrefix[prefix] = []
          }
          jobsByPrefix[prefix].push({
            domain,
            jobName: `${prefix}-${domain}`
          })
        })
      }
    })

  // Generate operations for each prefix group
  Object.keys(jobsByPrefix)
    .sort()
    .forEach(prefix => {
      const jobs = jobsByPrefix[prefix]

      jobs.forEach((job, index) => {
        operations.push({
          path: `jobs.${job.jobName}`,
          operation: 'preserve', // User can customize these jobs - won't overwrite if exists
          value: createValueFromString(`
    needs: changes
    if: \${{ needs.changes.outputs.${job.domain} == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
      # TODO: Replace with your ${job.domain} ${prefix} logic
      - name: Run ${prefix} for ${job.domain}
        run: |
          echo "Running ${prefix} for ${job.domain} domain"
          echo "Replace this with your actual ${prefix} commands"
          # Example: npm run ${prefix}:${job.domain}
  `)
        })
      })
    })

  return operations
}

/**
 * Create test job operations for each domain
 */
export function createDomainTestJobOperations(ctx: DomainJobsContext): PathOperationConfig[] {
  const { domains } = ctx
  const operations: PathOperationConfig[] = []

  const testableDomains = Object.keys(domains)
    .sort()
    .filter(d => domains[d].testable !== false)

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

  const deployableDomains = Object.keys(domains)
    .sort()
    .filter(d => domains[d].deployable === true)

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
 Replace the TODO commands with your actual deployment commands.
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

  const remoteTestableDomains = Object.keys(domains)
    .sort()
    .filter(d => domains[d].remoteTestable === true)

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
    if: \${{ needs.changes.outputs.${domain} == 'true' && needs.deploy-${domain}.result == 'success' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
      # TODO: Replace with your ${domain} remote testing logic
      - name: Test ${domain} remotely
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
 *
 * Supports both legacy boolean flags (testable, deployable, remoteTestable)
 * and new flexible prefixes array.
 *
 * @returns Object with arrays of job names categorized by type
 */
export function getDomainJobNames(domains: Record<string, any>): {
  testJobs: string[]
  deployJobs: string[]
  remoteTestJobs: string[]
  allJobsByPrefix: Record<string, string[]>
} {
  const testJobs: string[] = []
  const deployJobs: string[] = []
  const remoteTestJobs: string[] = []
  const allJobsByPrefix: Record<string, string[]> = {}

  Object.keys(domains)
    .sort()
    .forEach(domain => {
      const domainConfig = domains[domain]

      // New approach: use prefixes if defined
      if (domainConfig.prefixes && Array.isArray(domainConfig.prefixes)) {
        domainConfig.prefixes.forEach((prefix: string) => {
          const jobName = `${prefix}-${domain}`

          // Categorize by known prefixes for backwards compatibility
          if (prefix === 'test') {
            testJobs.push(jobName)
          } else if (prefix === 'deploy') {
            deployJobs.push(jobName)
          } else if (prefix === 'remote-test') {
            remoteTestJobs.push(jobName)
          }

          // Also track all jobs by prefix for flexible access
          if (!allJobsByPrefix[prefix]) {
            allJobsByPrefix[prefix] = []
          }
          allJobsByPrefix[prefix].push(jobName)
        })
      } else {
        // Legacy approach: use boolean flags
        if (domainConfig.testable !== false) {
          const jobName = `test-${domain}`
          testJobs.push(jobName)
          if (!allJobsByPrefix['test']) {
            allJobsByPrefix['test'] = []
          }
          allJobsByPrefix['test'].push(jobName)
        }

        if (domainConfig.deployable === true) {
          const jobName = `deploy-${domain}`
          deployJobs.push(jobName)
          if (!allJobsByPrefix['deploy']) {
            allJobsByPrefix['deploy'] = []
          }
          allJobsByPrefix['deploy'].push(jobName)
        }

        if (domainConfig.remoteTestable === true) {
          const jobName = `remote-test-${domain}`
          remoteTestJobs.push(jobName)
          if (!allJobsByPrefix['remote-test']) {
            allJobsByPrefix['remote-test'] = []
          }
          allJobsByPrefix['remote-test'].push(jobName)
        }
      }
    })

  return { testJobs, deployJobs, remoteTestJobs, allJobsByPrefix }
}
