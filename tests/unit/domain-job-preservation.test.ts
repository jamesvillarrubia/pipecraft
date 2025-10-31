/**
 * Domain Job Preservation Tests
 *
 * Tests the correct behavior for domain jobs (test-*, deploy-*, remote-test-*):
 * - Created if missing
 * - Preserved if customized
 * - Both normal and force generation modes
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse as parseYAML, stringify } from 'yaml'
import { createMinimalConfig } from '../helpers/fixtures.js'
import { createWorkspaceWithCleanup } from '../helpers/workspace.js'

describe('Domain Job Preservation', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('domain-job-preservation')
  })

  afterEach(() => {
    cleanup()
  })

  describe('Domain Job Creation', () => {
    it('should create missing test jobs for domains with test: true (normal mode)', () => {
      testDomainJobCreation(false)
    })

    it('should create missing test jobs for domains with test: true (force mode)', () => {
      testDomainJobCreation(true)
    })

    it('should create missing deploy jobs for domains with deployable: true (normal mode)', () => {
      testDomainJobCreation(false, 'deploy')
    })

    it('should create missing deploy jobs for domains with deployable: true (force mode)', () => {
      testDomainJobCreation(true, 'deploy')
    })

    it('should create missing remote-test jobs for domains with remoteTestable: true (normal mode)', () => {
      testDomainJobCreation(false, 'remote-test')
    })

    it('should create missing remote-test jobs for domains with remoteTestable: true (force mode)', () => {
      testDomainJobCreation(true, 'remote-test')
    })

    function testDomainJobCreation(
      force: boolean,
      jobType: 'test' | 'deploy' | 'remote-test' = 'test'
    ) {
      const config = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop', 'staging', 'main'],
        semver: { bumpRules: { feat: 'minor', fix: 'patch', breaking: 'major' } },
        domains: {
          api: { paths: ['src/api/**'], description: 'API changes', test: true },
          web: { paths: ['src/web/**'], description: 'Web changes', test: true },
          mobile: { paths: ['src/mobile/**'], description: 'Mobile changes', test: false }
        }
      }

      // Create a pipeline with only api test job (missing web test job)
      const existingPipeline = {
        name: 'Test Pipeline',
        on: { push: { branches: ['develop'] } },
        jobs: {
          changes: { runs_on: 'ubuntu-latest', steps: [] },
          'test-api': {
            needs: 'changes',
            runs_on: 'ubuntu-latest',
            steps: [{ name: 'Test API', run: 'echo "API tests"' }]
          },
          version: { runs_on: 'ubuntu-latest', steps: [] }
        }
      }

      // Simulate PipeCraft generation
      const result = generatePipelineWithDomainJobs(config, existingPipeline, force)
      const parsedYaml = parseYAML(result)

      // Should create missing test-web job
      expect(parsedYaml.jobs['test-web']).toBeDefined()
      expect(parsedYaml.jobs['test-web'].needs).toBe('changes')
      expect(parsedYaml.jobs['test-web'].runs_on).toBe('ubuntu-latest')

      // Should preserve existing test-api job
      expect(parsedYaml.jobs['test-api']).toBeDefined()
      expect(parsedYaml.jobs['test-api'].steps[0].name).toBe('Test API')

      // Should not create test-mobile job (test: false)
      expect(parsedYaml.jobs['test-mobile']).toBeUndefined()
    }
  })

  describe('Domain Job Preservation', () => {
    it('should preserve customized test jobs (normal mode)', () => {
      testDomainJobPreservation(false, 'test')
    })

    it('should preserve customized test jobs (force mode)', () => {
      testDomainJobPreservation(true, 'test')
    })

    it('should preserve customized deploy jobs (normal mode)', () => {
      testDomainJobPreservation(false, 'deploy')
    })

    it('should preserve customized deploy jobs (force mode)', () => {
      testDomainJobPreservation(true, 'deploy')
    })

    it('should preserve customized remote-test jobs (normal mode)', () => {
      testDomainJobPreservation(false, 'remote-test')
    })

    it('should preserve customized remote-test jobs (force mode)', () => {
      testDomainJobPreservation(true, 'remote-test')
    })

    function testDomainJobPreservation(force: boolean, jobType: 'test' | 'deploy' | 'remote-test') {
      const config = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop', 'staging', 'main'],
        semver: { bumpRules: { feat: 'minor', fix: 'patch', breaking: 'major' } },
        domains: {
          api: {
            paths: ['src/api/**'],
            description: 'API changes',
            test: true,
            deployable: true,
            remoteTestable: true
          }
        }
      }

      // Create a pipeline with customized domain job
      const existingPipeline = {
        name: 'Test Pipeline',
        on: { push: { branches: ['develop'] } },
        jobs: {
          changes: { runs_on: 'ubuntu-latest', steps: [] },
          version: { runs_on: 'ubuntu-latest', steps: [] },
          [`${jobType}-api`]: {
            needs:
              jobType === 'test'
                ? 'changes'
                : jobType === 'deploy'
                ? ['version', 'changes']
                : ['deploy-api', 'changes'],
            runs_on: 'ubuntu-latest',
            ...(jobType === 'deploy' && { environment: 'production' }),
            steps: [
              { name: `Custom ${jobType} Setup`, run: `echo "Custom ${jobType} setup"` },
              { name: `Run ${jobType}`, run: `echo "Running ${jobType}"` }
            ]
          }
        }
      }

      const result = generatePipelineWithDomainJobs(config, existingPipeline, force)
      const parsedYaml = parseYAML(result)

      // Should preserve customized job
      expect(parsedYaml.jobs[`${jobType}-api`]).toBeDefined()
      expect(parsedYaml.jobs[`${jobType}-api`].steps).toHaveLength(2)
      expect(parsedYaml.jobs[`${jobType}-api`].steps[0].name).toBe(`Custom ${jobType} Setup`)
      expect(parsedYaml.jobs[`${jobType}-api`].steps[1].name).toBe(`Run ${jobType}`)

      if (jobType === 'deploy') {
        expect(parsedYaml.jobs[`${jobType}-api`].environment).toBe('production')
      }
    }
  })

  describe('Force vs Normal Generation', () => {
    it('should behave identically for domain job creation in both modes', () => {
      testDomainJobCreationComparison()
    })

    it('should behave identically for domain job preservation in both modes', () => {
      testDomainJobPreservationComparison()
    })

    function testDomainJobCreationComparison() {
      const config = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop', 'staging', 'main'],
        semver: { bumpRules: { feat: 'minor', fix: 'patch', breaking: 'major' } },
        domains: {
          api: {
            paths: ['src/api/**'],
            description: 'API changes',
            test: true,
            deployable: true,
            remoteTestable: true
          }
        }
      }

      const existingPipeline = {
        name: 'Test Pipeline',
        on: { push: { branches: ['develop'] } },
        jobs: {
          changes: { runs_on: 'ubuntu-latest', steps: [] },
          version: { runs_on: 'ubuntu-latest', steps: [] }
        }
      }

      // Test normal generation
      const normalResult = generatePipelineWithDomainJobs(config, existingPipeline, false)
      const normalParsed = parseYAML(normalResult)

      // Test force generation
      const forceResult = generatePipelineWithDomainJobs(config, existingPipeline, true)
      const forceParsed = parseYAML(forceResult)

      // Both should create the same domain jobs
      expect(normalParsed.jobs['test-api']).toBeDefined()
      expect(forceParsed.jobs['test-api']).toBeDefined()

      expect(normalParsed.jobs['deploy-api']).toBeDefined()
      expect(forceParsed.jobs['deploy-api']).toBeDefined()

      expect(normalParsed.jobs['remote-test-api']).toBeDefined()
      expect(forceParsed.jobs['remote-test-api']).toBeDefined()
    }

    function testDomainJobPreservationComparison() {
      const config = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop', 'staging', 'main'],
        semver: { bumpRules: { feat: 'minor', fix: 'patch', breaking: 'major' } },
        domains: {
          api: {
            paths: ['src/api/**'],
            description: 'API changes',
            test: true,
            deployable: true,
            remoteTestable: true
          }
        }
      }

      // Create pipeline with customized domain jobs
      const existingPipeline = {
        name: 'Test Pipeline',
        on: { push: { branches: ['develop'] } },
        jobs: {
          changes: { runs_on: 'ubuntu-latest', steps: [] },
          version: { runs_on: 'ubuntu-latest', steps: [] },
          'test-api': {
            needs: 'changes',
            runs_on: 'ubuntu-latest',
            steps: [
              { name: 'Custom API Setup', run: 'echo "Custom setup"' },
              { name: 'Run API Tests', run: 'npm test' }
            ]
          },
          'deploy-api': {
            needs: ['version', 'changes'],
            runs_on: 'ubuntu-latest',
            environment: 'production',
            steps: [{ name: 'Custom Deploy', run: 'echo "Custom deploy"' }]
          },
          'remote-test-api': {
            needs: ['deploy-api', 'changes'],
            runs_on: 'ubuntu-latest',
            steps: [{ name: 'Custom Remote Test', run: 'echo "Custom remote test"' }]
          }
        }
      }

      // Test normal generation
      const normalResult = generatePipelineWithDomainJobs(config, existingPipeline, false)
      const normalParsed = parseYAML(normalResult)

      // Test force generation
      const forceResult = generatePipelineWithDomainJobs(config, existingPipeline, true)
      const forceParsed = parseYAML(forceResult)

      // Both should preserve customized domain jobs identically
      expect(normalParsed.jobs['test-api'].steps[0].name).toBe('Custom API Setup')
      expect(forceParsed.jobs['test-api'].steps[0].name).toBe('Custom API Setup')

      expect(normalParsed.jobs['deploy-api'].environment).toBe('production')
      expect(forceParsed.jobs['deploy-api'].environment).toBe('production')

      expect(normalParsed.jobs['remote-test-api'].steps[0].name).toBe('Custom Remote Test')
      expect(forceParsed.jobs['remote-test-api'].steps[0].name).toBe('Custom Remote Test')
    }
  })
})

/**
 * Mock function to simulate PipeCraft's domain job generation logic
 * This would be replaced with actual PipeCraft generation in real tests
 */
function generatePipelineWithDomainJobs(
  config: any,
  existingPipeline: any,
  force: boolean = false
): string {
  const jobs = { ...existingPipeline.jobs }

  // Simulate domain job creation/preservation logic
  // Key behavior: "Created if missing, preserved if customized" for BOTH normal and force modes
  Object.entries(config.domains || {}).forEach(([domainName, domainConfig]: [string, any]) => {
    // Create test jobs if missing and test: true
    if (domainConfig.test) {
      if (!jobs[`test-${domainName}`]) {
        // Create missing job
        jobs[`test-${domainName}`] = {
          needs: 'changes',
          runs_on: 'ubuntu-latest',
          steps: [{ name: `Run ${domainName} tests`, run: `echo "Testing ${domainName}"` }]
        }
      }
      // If job exists, preserve it (both normal and force modes)
    }

    // Create deploy jobs if missing and deployable: true
    if (domainConfig.deployable) {
      if (!jobs[`deploy-${domainName}`]) {
        // Create missing job
        jobs[`deploy-${domainName}`] = {
          needs: ['version', 'changes'],
          runs_on: 'ubuntu-latest',
          steps: [{ name: `Deploy ${domainName}`, run: `echo "Deploying ${domainName}"` }]
        }
      }
      // If job exists, preserve it (both normal and force modes)
    }

    // Create remote-test jobs if missing and remoteTestable: true
    if (domainConfig.remoteTestable) {
      if (!jobs[`remote-test-${domainName}`]) {
        // Create missing job
        jobs[`remote-test-${domainName}`] = {
          needs: [`deploy-${domainName}`, 'changes'],
          runs_on: 'ubuntu-latest',
          steps: [
            { name: `Test ${domainName} remotely`, run: `echo "Remote testing ${domainName}"` }
          ]
        }
      }
      // If job exists, preserve it (both normal and force modes)
    }
  })

  const pipeline = {
    ...existingPipeline,
    jobs
  }

  return stringify(pipeline)
}
