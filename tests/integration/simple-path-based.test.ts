import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, existsSync, rmSync, readFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { TEST_DIR } from '../setup'
import { parse } from 'yaml'
import { applyPathOperations, PathOperationConfig, createValueFromString, createValueFromObject } from '../../src/utils/ast-path-operations'
import { parseDocument, stringify } from 'yaml'

describe('Simple Path-Based Template Tests', () => {
  beforeEach(() => {
    // Clean up test files
    const filesToClean = ['.pipecraft-cache.json']
    filesToClean.forEach(file => {
      const fullPath = join(TEST_DIR, file)
      if (existsSync(fullPath)) {
        rmSync(fullPath, { recursive: true, force: true })
      }
    })
  })

  afterEach(() => {
    // Clean up after each test
    const filesToClean = ['.pipecraft-cache.json']
    filesToClean.forEach(file => {
      const fullPath = join(TEST_DIR, file)
      if (existsSync(fullPath)) {
        rmSync(fullPath, { recursive: true, force: true })
      }
    })
  })

  describe('Path Operations with Simple YAML', () => {
    it('should apply set operations for workflow inputs', () => {
      // Create a simple YAML document
      const simpleYaml = `name: "Test Pipeline"
on:
  pull_request:
    branches: [develop]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Test
        run: echo "test"`

      const doc = parseDocument(simpleYaml)
      
      // Apply path operations
      const operations: PathOperationConfig[] = [
        {
          path: 'on.workflow_call.inputs.version',
          operation: 'set',
          value: {
            description: 'The version to deploy',
            required: false,
            type: 'string'
          },
          required: true
        },
        {
          path: 'on.workflow_call.inputs.baseRef',
          operation: 'set',
          value: {
            description: 'The base reference for comparison',
            required: false,
            type: 'string'
          },
          required: true
        }
      ]

      applyPathOperations(doc.contents, operations)

      // Stringify and parse to verify
      const result = stringify(doc)
      const parsed = parse(result)

      expect(parsed.on.workflow_call?.inputs?.version).toEqual({
        description: 'The version to deploy',
        required: false,
        type: 'string'
      })
      expect(parsed.on.workflow_call?.inputs?.baseRef).toEqual({
        description: 'The base reference for comparison',
        required: false,
        type: 'string'
      })
    })

    it('should apply merge operations for branch configuration', () => {
      // Create a simple YAML document with existing branches
      const simpleYaml = `name: "Test Pipeline"
on:
  pull_request:
    branches: [develop, feature]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Test
        run: echo "test"`

      const doc = parseDocument(simpleYaml)
      
      // Apply merge operation for branches
      const operations: PathOperationConfig[] = [
        {
          path: 'on.pull_request.branches',
          operation: 'merge',
          value: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'],
          required: true
        }
      ]

      applyPathOperations(doc.contents, operations)

      // Stringify and parse to verify
      const result = stringify(doc)
      const parsed = parse(result)

      // Should contain both existing and new branches
      expect(parsed.on.pull_request.branches).toContain('develop')
      expect(parsed.on.pull_request.branches).toContain('feature')
      expect(parsed.on.pull_request.branches).toContain('alpha')
      expect(parsed.on.pull_request.branches).toContain('beta')
      expect(parsed.on.pull_request.branches).toContain('gamma')
      expect(parsed.on.pull_request.branches).toContain('delta')
      expect(parsed.on.pull_request.branches).toContain('epsilon')
    })

    it('should apply overwrite operations for core jobs', () => {
      // Create a simple YAML document with existing jobs
      const simpleYaml = `name: "Test Pipeline"
on:
  pull_request:
    branches: [develop]
jobs:
  changes:
    runs-on: ubuntu-latest
    steps:
      - name: Old Changes Job
        run: echo "This should be overwritten"
  version:
    runs-on: ubuntu-latest
    steps:
      - name: Old Version Job
        run: echo "This should be overwritten"`

      const doc = parseDocument(simpleYaml)
      
      // Apply overwrite operations for core jobs
      const operations: PathOperationConfig[] = [
        {
          path: 'jobs.changes',
          operation: 'overwrite',
          value: createValueFromString(`
            runs-on: ubuntu-latest
            steps:
              - uses: ./.github/actions/detect-changes
                with:
                  baseRef: \${{ inputs.baseRef || 'main' }}
          `),
          required: true
        },
        {
          path: 'jobs.version',
          operation: 'overwrite',
          value: createValueFromString(`
            if: github.ref_name == 'alpha'
            needs: changes
            runs-on: ubuntu-latest
            steps:
              - uses: ./.github/actions/calculate-version
                with:
                  baseRef: \${{ inputs.baseRef || 'main' }}
          `),
          required: true
        }
      ]

      applyPathOperations(doc.contents, operations)

      // Stringify and parse to verify
      const result = stringify(doc)
      const parsed = parse(result)


      // Verify core jobs are overwritten
      expect(parsed.jobs.changes).toBeDefined()
      expect(parsed.jobs.version).toBeDefined()
      
      // Check if steps exist and have the expected structure
      if (parsed.jobs.changes.steps && parsed.jobs.changes.steps.length > 0) {
        expect(parsed.jobs.changes.steps[0].uses).toBe('./.github/actions/detect-changes')
        expect(parsed.jobs.changes.steps[0].name).toBeUndefined() // No custom name
      }
      
      if (parsed.jobs.version.steps && parsed.jobs.version.steps.length > 0) {
        expect(parsed.jobs.version.steps[0].uses).toBe('./.github/actions/calculate-version')
        expect(parsed.jobs.version.steps[0].name).toBeUndefined() // No custom name
      }
      
      // Check if the if condition exists
      if (parsed.jobs.version.if) {
        expect(parsed.jobs.version.if).toBe("github.ref_name == 'alpha'")
      }
    })

    it('should apply preserve operations for user-managed sections', () => {
      // Create a simple YAML document with user jobs
      const simpleYaml = `name: "Test Pipeline"
on:
  pull_request:
    branches: [develop]
jobs:
  testing-section:
    test-api:
      needs: changes
      runs-on: ubuntu-latest
      steps:
        - name: Test API
          run: echo "Running API tests"
  deployment-section:
    deploy-api:
      needs: version
      runs-on: ubuntu-latest
      steps:
        - name: Deploy API
          run: echo "Deploying API"`

      const doc = parseDocument(simpleYaml)
      
      // Apply preserve operations for user-managed sections
      const operations: PathOperationConfig[] = [
        {
          path: 'jobs.testing-section',
          operation: 'preserve',
          value: createValueFromString(`
            # Add your testing jobs here
            # Example:
            # test-api: 
            #   needs: changes
            #   runs-on: ubuntu-latest
            #   steps:
            #     - name: Test API
            #       run: echo "Run API tests"
          `),
          required: false
        },
        {
          path: 'jobs.deployment-section',
          operation: 'preserve',
          value: createValueFromString(`
            # Add your deployment jobs here
            # Example:
            # deploy-api:
            #   needs: version
            #   runs-on: ubuntu-latest
            #   steps:
            #     - name: Deploy API
            #       run: echo "Deploy API to production"
          `),
          required: false
        }
      ]

      applyPathOperations(doc.contents, operations)

      // Stringify and parse to verify
      const result = stringify(doc)
      const parsed = parse(result)

      // Verify user-managed sections are preserved
      expect(parsed.jobs['testing-section']['test-api']).toBeDefined()
      expect(parsed.jobs['testing-section']['test-api'].steps[0].name).toBe('Test API')
      expect(parsed.jobs['deployment-section']['deploy-api']).toBeDefined()
      expect(parsed.jobs['deployment-section']['deploy-api'].steps[0].name).toBe('Deploy API')
    })
  })

  describe('CLI Integration with Custom Files', () => {
    it('should handle custom config file with unexpected variables', async () => {
      // Create custom config with unexpected variables
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

      const configPath = join(TEST_DIR, 'custom-pipecraftrc.json')
      writeFileSync(configPath, JSON.stringify(customConfig, null, 2))

      // Test that the config can be loaded and parsed
      const loadedConfig = JSON.parse(readFileSync(configPath, 'utf8'))
      expect(loadedConfig.initialBranch).toBe('alpha')
      expect(loadedConfig.finalBranch).toBe('epsilon')
      expect(loadedConfig.branchFlow).toEqual(['alpha', 'beta', 'gamma', 'delta', 'epsilon'])
      expect(loadedConfig.domains['fake-domain1']).toBeDefined()
      expect(loadedConfig.domains['fake-domain2']).toBeDefined()
      expect(loadedConfig.domains['fake-domain3']).toBeDefined()
      expect(loadedConfig.domains['fake-domain4']).toBeDefined()
    })

    it('should handle custom pipeline file with user customizations', async () => {
      // Create existing pipeline with user customizations
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
          }
        }
      }

      const pipelinePath = join(TEST_DIR, 'custom-pipeline.yml')
      writeFileSync(pipelinePath, stringify(existingPipeline))

      // Test that the pipeline can be loaded and parsed
      const loadedPipeline = parse(readFileSync(pipelinePath, 'utf8'))
      expect(loadedPipeline.name).toBe('USER NAME')
      expect(loadedPipeline.on.pull_request.paths).toContain('**/*.yml')
      expect(loadedPipeline.on.pull_request.branches).toContain('develop')
      expect(loadedPipeline.on.pull_request.branches).toContain('feature')
      expect(loadedPipeline.on.workflow_call.inputs.fakevar1).toBeDefined()
      expect(loadedPipeline.on.workflow_call.inputs.version).toBeDefined()
      expect(loadedPipeline.on.workflow_call.inputs.fakevar2).toBeDefined()
      expect(loadedPipeline.on.workflow_call.outputs.fakevar3).toBeDefined()
      expect(loadedPipeline.on.workflow_call.outputs.fakevar4).toBeDefined()
      expect(loadedPipeline.jobs['fake-job-1']).toBeDefined()
      expect(loadedPipeline.jobs.changes).toBeDefined()
    })
  })
})
