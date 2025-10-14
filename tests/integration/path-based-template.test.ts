import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, existsSync, rmSync, readFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { TEST_DIR, FIXTURES_DIR } from '../setup'
import { parse } from 'yaml'

// Import the internal function directly for testing
import { createPathBasedPipeline } from '../../src/templates/workflows/pipeline-path-based.yml.tpl'

describe('Path-Based Template Generation Tests', () => {
  const testConfigPath = join(TEST_DIR, 'custom-pipecraftrc.json')
  const testPipelinePath = join(TEST_DIR, 'custom-pipeline.yml')
  const outputPath = join(TEST_DIR, '.github/workflows/pipeline.yml')

  beforeEach(() => {
    // Clean up test files
    const filesToClean = [testConfigPath, testPipelinePath, outputPath, '.pipecraft-cache.json']
    filesToClean.forEach(file => {
      const fullPath = join(TEST_DIR, file)
      if (existsSync(fullPath)) {
        rmSync(fullPath, { recursive: true, force: true })
      }
    })

    // Create .github/workflows directory
    mkdirSync(join(TEST_DIR, '.github/workflows'), { recursive: true })
  })

  afterEach(() => {
    // Clean up after each test
    const filesToClean = [testConfigPath, testPipelinePath, outputPath, '.pipecraft-cache.json']
    filesToClean.forEach(file => {
      const fullPath = join(TEST_DIR, file)
      if (existsSync(fullPath)) {
        rmSync(fullPath, { recursive: true, force: true })
      }
    })
  })

  describe('Custom Config and Pipeline Files', () => {
    it('should generate pipeline with custom config file containing unexpected variables', async () => {
      // Create custom config with unexpected variables (alpha, beta, gamma, delta, epsilon)
      const customConfig = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'alpha',
        finalBranch: 'epsilon',
        branchFlow: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'],
        semver: {
          bumpRules: {
            feat: 'minor',
            fix: 'patch',
            breaking: 'major'
          }
        },
        actions: {
          onDevelopMerge: ['runTests', 'fastForwardToStaging'],
          onStagingMerge: ['runTests', 'calculateVersion', 'createOrFastForwardToMain']
        },
        domains: {
          'fake-domain1': {
            paths: ['apps/fake-domain1/**'],
            description: 'fake-domain1 application changes'
          },
          'fake-domain2': {
            paths: ['apps/fake-domain2/**'],
            description: 'fake-domain2 application changes'
          },
          'fake-domain3': {
            paths: ['libs/fake-domain3/**'],
            description: 'fake-domain3 application changes'
          },
          'fake-domain4': {
            paths: ['.github/workflows/fake-domain4/**'],
            description: 'fake-domain4 application changes'
          }
        }
      }

      writeFileSync(testConfigPath, JSON.stringify(customConfig, null, 2))

      // Create context with custom config
      const ctx = {
        ...customConfig,
        cwd: TEST_DIR,
        force: true
      }

      // Generate pipeline
      const result = createPathBasedPipeline(ctx)

      expect(result.yamlContent).toBeDefined()
      expect(result.mergeStatus).toBe('overwritten')

      // Parse generated YAML to verify structure
      const parsedYaml = parse(result.yamlContent)
      expect(parsedYaml).toBeDefined()
      expect(parsedYaml.name).toBe('Pipeline')
      expect(parsedYaml.on).toBeDefined()
      expect(parsedYaml.jobs).toBeDefined()

      // Verify workflow inputs are set correctly
      expect(parsedYaml.on.workflow_call?.inputs?.version).toBeDefined()
      expect(parsedYaml.on.workflow_call?.inputs?.baseRef).toBeDefined()

      // Verify branch configuration uses custom branch flow
      expect(parsedYaml.on.pull_request?.branches).toContain('alpha')
      expect(parsedYaml.on.pull_request?.branches).toContain('beta')
      expect(parsedYaml.on.pull_request?.branches).toContain('gamma')
      expect(parsedYaml.on.pull_request?.branches).toContain('delta')
      expect(parsedYaml.on.pull_request?.branches).toContain('epsilon')

      // Verify core jobs exist
      expect(parsedYaml.jobs.changes).toBeDefined()
      expect(parsedYaml.jobs.version).toBeDefined()
      expect(parsedYaml.jobs.tag).toBeDefined()
      expect(parsedYaml.jobs.createpr).toBeDefined()
      expect(parsedYaml.jobs.branch).toBeDefined()

      // Verify version job uses custom initial branch
      expect(parsedYaml.jobs.version.if).toContain('alpha')
      expect(parsedYaml.jobs.tag.if).toContain('alpha')

      // Verify createpr job excludes custom final branch
      expect(parsedYaml.jobs.createpr.if).toContain('epsilon')
    })

    it('should merge with existing pipeline file containing user customizations', async () => {
      // Create custom config
      const customConfig = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'alpha',
        finalBranch: 'epsilon',
        branchFlow: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'],
        semver: {
          bumpRules: {
            feat: 'minor',
            fix: 'patch',
            breaking: 'major'
          }
        },
        actions: {
          onDevelopMerge: ['runTests', 'fastForwardToStaging'],
          onStagingMerge: ['runTests', 'calculateVersion', 'createOrFastForwardToMain']
        },
        domains: {
          'fake-domain1': {
            paths: ['apps/fake-domain1/**'],
            description: 'fake-domain1 application changes'
          }
        }
      }

      // Create existing pipeline with user customizations (similar to pipeline-user-modified.yml)
      const existingPipeline = {
        name: "USER NAME",
        on: {
          pull_request: {
            paths: ['**/*.yml', '**/*.yaml', '**/*.json', '**/*.ts', '**/*.js', '**/*.tsx'],
            branches: ['develop', 'feature']
          },
          workflow_call: {
            inputs: {
              fakevar1: {
                description: 'The fake version to deploy',
                required: false,
                type: 'string'
              },
              version: {
                description: 'The version to deploy',
                required: false,
                type: 'string'
              },
              fakevar2: {
                description: 'The fake version to deploy',
                required: false,
                type: 'string'
              }
            },
            outputs: {
              fakevar3: {
                value: 'fakevalue3'
              },
              fakevar4: {
                value: 'fakevalue4'
              }
            }
          }
        },
        jobs: {
          'fake-job-1': {
            runs_on: 'ubuntu-latest',
            steps: [
              {
                name: 'Fake Job',
                run: 'echo "Running fake job"'
              }
            ]
          },
          changes: {
            runs_on: 'ubuntu-latest',
            steps: [
              {
                uses: './.github/actions/detect-changes',
                with: {
                  baseRef: '${{ inputs.baseRef || \'main\' }}'
                }
              }
            ]
          },
          'fake-job-2': {
            runs_on: 'ubuntu-latest',
            steps: [
              {
                name: 'Fake Job',
                run: 'echo "Running fake job"'
              }
            ]
          }
        }
      }

      // Create context with existing pipeline
      const ctx = {
        ...customConfig,
        existingPipeline,
        cwd: TEST_DIR,
        force: true
      }

      // Generate pipeline
      const result = createPathBasedPipeline(ctx)

      expect(result.yamlContent).toBeDefined()
      expect(result.mergeStatus).toBe('merged')

      // Parse generated YAML to verify merging
      const parsedYaml = parse(result.yamlContent)
      expect(parsedYaml).toBeDefined()

      // Verify user customizations are preserved
      expect(parsedYaml.name).toBe('USER NAME')
      expect(parsedYaml.on.pull_request.paths).toContain('**/*.yml')
      expect(parsedYaml.on.pull_request.branches).toContain('develop')
      expect(parsedYaml.on.pull_request.branches).toContain('feature')

      // Verify user inputs are preserved and required inputs are added
      expect(parsedYaml.on.workflow_call.inputs.fakevar1).toBeDefined()
      expect(parsedYaml.on.workflow_call.inputs.version).toBeDefined()
      expect(parsedYaml.on.workflow_call.inputs.fakevar2).toBeDefined()
      expect(parsedYaml.on.workflow_call.inputs.baseRef).toBeDefined()

      // Verify user outputs are preserved
      expect(parsedYaml.on.workflow_call.outputs.fakevar3).toBeDefined()
      expect(parsedYaml.on.workflow_call.outputs.fakevar4).toBeDefined()

      // Verify user jobs are preserved
      expect(parsedYaml.jobs['fake-job-1']).toBeDefined()
      expect(parsedYaml.jobs['fake-job-2']).toBeDefined()

      // Verify core Flowcraft jobs are updated/overwritten
      expect(parsedYaml.jobs.changes).toBeDefined()
      expect(parsedYaml.jobs.version).toBeDefined()
      expect(parsedYaml.jobs.tag).toBeDefined()
      expect(parsedYaml.jobs.createpr).toBeDefined()
      expect(parsedYaml.jobs.branch).toBeDefined()

      // Verify branch configuration is merged (user branches + template branches)
      expect(parsedYaml.on.pull_request.branches).toContain('develop')
      expect(parsedYaml.on.pull_request.branches).toContain('feature')
      expect(parsedYaml.on.pull_request.branches).toContain('alpha')
      expect(parsedYaml.on.pull_request.branches).toContain('beta')
      expect(parsedYaml.on.pull_request.branches).toContain('gamma')
      expect(parsedYaml.on.pull_request.branches).toContain('delta')
      expect(parsedYaml.on.pull_request.branches).toContain('epsilon')
    })

    it('should handle missing existing pipeline gracefully', async () => {
      const customConfig = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'alpha',
        finalBranch: 'epsilon',
        branchFlow: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'],
        semver: {
          bumpRules: {
            feat: 'minor',
            fix: 'patch',
            breaking: 'major'
          }
        },
        actions: {
          onDevelopMerge: ['runTests', 'fastForwardToStaging'],
          onStagingMerge: ['runTests', 'calculateVersion', 'createOrFastForwardToMain']
        },
        domains: {
          'fake-domain1': {
            paths: ['apps/fake-domain1/**'],
            description: 'fake-domain1 application changes'
          }
        }
      }

      // Create context without existing pipeline
      const ctx = {
        ...customConfig,
        cwd: TEST_DIR,
        force: true
      }

      // Generate pipeline
      const result = createPathBasedPipeline(ctx)

      expect(result.yamlContent).toBeDefined()
      expect(result.mergeStatus).toBe('overwritten')

      // Parse generated YAML to verify structure
      const parsedYaml = parse(result.yamlContent)
      expect(parsedYaml).toBeDefined()
      expect(parsedYaml.name).toBe('Pipeline')
      expect(parsedYaml.jobs).toBeDefined()
    })
  })

  describe('Path Operations Validation', () => {
    it('should correctly apply set operations for workflow inputs', async () => {
      const ctx = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'alpha',
        finalBranch: 'epsilon',
        branchFlow: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'],
        semver: { bumpRules: { feat: 'minor', fix: 'patch', breaking: 'major' } },
        actions: { onDevelopMerge: ['runTests'], onStagingMerge: ['runTests'] },
        domains: { 'fake-domain1': { paths: ['apps/fake-domain1/**'], description: 'fake-domain1' } },
        cwd: TEST_DIR,
        force: true
      }

      const result = createPathBasedPipeline(ctx)
      const parsedYaml = parse(result.yamlContent)

      // Verify workflow_call inputs are set
      expect(parsedYaml.on.workflow_call?.inputs?.version).toEqual({
        description: 'The version to deploy',
        required: false,
        type: 'string'
      })
      expect(parsedYaml.on.workflow_call?.inputs?.baseRef).toEqual({
        description: 'The base reference for comparison',
        required: false,
        type: 'string'
      })
    })

    it('should correctly apply merge operations for branch configuration', async () => {
      const existingPipeline = {
        name: "Test Pipeline",
        on: {
          pull_request: {
            branches: ['develop', 'feature', 'custom-branch']
          }
        },
        jobs: {}
      }

      const ctx = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'alpha',
        finalBranch: 'epsilon',
        branchFlow: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'],
        semver: { bumpRules: { feat: 'minor', fix: 'patch', breaking: 'major' } },
        actions: { onDevelopMerge: ['runTests'], onStagingMerge: ['runTests'] },
        domains: { 'fake-domain1': { paths: ['apps/fake-domain1/**'], description: 'fake-domain1' } },
        existingPipeline,
        cwd: TEST_DIR,
        force: true
      }

      const result = createPathBasedPipeline(ctx)
      const parsedYaml = parse(result.yamlContent)

      // Verify branches are merged (user + template)
      const branches = parsedYaml.on.pull_request.branches
      expect(branches).toContain('develop')
      expect(branches).toContain('feature')
      expect(branches).toContain('custom-branch')
      expect(branches).toContain('alpha')
      expect(branches).toContain('beta')
      expect(branches).toContain('gamma')
      expect(branches).toContain('delta')
      expect(branches).toContain('epsilon')
    })

    it('should correctly apply overwrite operations for core Flowcraft jobs', async () => {
      const existingPipeline = {
        name: "Test Pipeline",
        on: { pull_request: { branches: ['develop'] } },
        jobs: {
          changes: {
            runs_on: 'ubuntu-latest',
            steps: [
              {
                name: 'Old Changes Job',
                run: 'echo "This should be overwritten"'
              }
            ]
          },
          version: {
            runs_on: 'ubuntu-latest',
            steps: [
              {
                name: 'Old Version Job',
                run: 'echo "This should be overwritten"'
              }
            ]
          }
        }
      }

      const ctx = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'alpha',
        finalBranch: 'epsilon',
        branchFlow: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'],
        semver: { bumpRules: { feat: 'minor', fix: 'patch', breaking: 'major' } },
        actions: { onDevelopMerge: ['runTests'], onStagingMerge: ['runTests'] },
        domains: { 'fake-domain1': { paths: ['apps/fake-domain1/**'], description: 'fake-domain1' } },
        existingPipeline,
        cwd: TEST_DIR,
        force: true
      }

      const result = createPathBasedPipeline(ctx)
      const parsedYaml = parse(result.yamlContent)

      // Verify core jobs are overwritten with template versions
      expect(parsedYaml.jobs.changes.steps[0].uses).toBe('./.github/actions/detect-changes')
      expect(parsedYaml.jobs.version.steps[0].uses).toBe('./.github/actions/calculate-version')
      expect(parsedYaml.jobs.changes.steps[0].name).toBeUndefined() // No custom name
      expect(parsedYaml.jobs.version.steps[0].name).toBeUndefined() // No custom name
    })

    it('should correctly apply preserve operations for user-managed sections', async () => {
      const existingPipeline = {
        name: "Test Pipeline",
        on: { pull_request: { branches: ['develop'] } },
        jobs: {
          'testing-section': {
            'test-api': {
              needs: 'changes',
              runs_on: 'ubuntu-latest',
              steps: [
                {
                  name: 'Test API',
                  run: 'echo "Running API tests"'
                }
              ]
            }
          },
          'deployment-section': {
            'deploy-api': {
              needs: 'version',
              runs_on: 'ubuntu-latest',
              steps: [
                {
                  name: 'Deploy API',
                  run: 'echo "Deploying API"'
                }
              ]
            }
          }
        }
      }

      const ctx = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'alpha',
        finalBranch: 'epsilon',
        branchFlow: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'],
        semver: { bumpRules: { feat: 'minor', fix: 'patch', breaking: 'major' } },
        actions: { onDevelopMerge: ['runTests'], onStagingMerge: ['runTests'] },
        domains: { 'fake-domain1': { paths: ['apps/fake-domain1/**'], description: 'fake-domain1' } },
        existingPipeline,
        cwd: TEST_DIR,
        force: true
      }

      const result = createPathBasedPipeline(ctx)
      const parsedYaml = parse(result.yamlContent)

      // Verify user-managed sections are preserved
      expect(parsedYaml.jobs['testing-section']['test-api']).toBeDefined()
      expect(parsedYaml.jobs['testing-section']['test-api'].steps[0].name).toBe('Test API')
      expect(parsedYaml.jobs['deployment-section']['deploy-api']).toBeDefined()
      expect(parsedYaml.jobs['deployment-section']['deploy-api'].steps[0].name).toBe('Deploy API')
    })
  })
})
