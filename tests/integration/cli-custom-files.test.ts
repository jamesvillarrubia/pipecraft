import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, existsSync, rmSync, readFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { TEST_DIR, FIXTURES_DIR } from '../setup'
import { spawn } from 'child_process'

describe('CLI Custom Files Integration Tests', () => {
  const customConfigPath = join(TEST_DIR, 'custom-flowcraftrc.json')
  const customPipelinePath = join(TEST_DIR, 'custom-pipeline.yml')
  const outputPath = join(TEST_DIR, '.github/workflows/pipeline.yml')

  beforeEach(() => {
    // Clean up test files
    const filesToClean = [customConfigPath, customPipelinePath, outputPath, '.flowcraft-cache.json']
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
    const filesToClean = [customConfigPath, customPipelinePath, outputPath, '.flowcraft-cache.json']
    filesToClean.forEach(file => {
      const fullPath = join(TEST_DIR, file)
      if (existsSync(fullPath)) {
        rmSync(fullPath, { recursive: true, force: true })
      }
    })
  })

  describe('Custom Config File', () => {
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

      writeFileSync(customConfigPath, JSON.stringify(customConfig, null, 2))

      // Run CLI with custom config
      const result = await runCLI(['generate', '--config', customConfigPath, '--verbose'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Generated workflows in: .github/workflows')
      expect(result.stdout).toContain(`Reading config from: ${customConfigPath}`)

      // Verify output file exists
      expect(existsSync(outputPath)).toBe(true)

      // Parse generated YAML to verify structure
      const generatedContent = readFileSync(outputPath, 'utf8')
      const parsedYaml = JSON.parse(JSON.stringify(require('yaml').parse(generatedContent)))
      
      expect(parsedYaml).toBeDefined()
      expect(parsedYaml.name).toBe('Pipeline')
      expect(parsedYaml.on).toBeDefined()
      expect(parsedYaml.jobs).toBeDefined()

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
  })

  describe('Custom Pipeline File', () => {
    it('should merge with custom pipeline file containing user customizations', async () => {
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

      // Create existing pipeline with user customizations
      const existingPipeline = `name: "USER NAME"
# USER COMMENT 1

on:
  pull_request:
    paths:
      - '**/*.yml'
      - '**/*.yaml'
      - '**/*.json'
      - '**/*.ts'
      - '**/*.js'
      - '**/*.tsx'
    # USER COMMENT 3
    branches:
      - develop
      - feature
      # USER COMMENT 4

  workflow_call:
    inputs:
      # USER COMMENT 5
      fakevar1:  
        description: 'The fake version to deploy'
        required: false
        type: string
      version:
        # USER COMMENT 6
        description: 'The version to deploy'
        required: false
        type: string
      # USER COMMENT 7
      fakevar2:
        description: 'The fake version to deploy'
        required: false
        type: string
    # USER COMMENT 8
    outputs:
      fakevar3:
        value: 'fakevalue3'
      fakevar4:
        value: 'fakevalue4'

jobs:
  # USER COMMENT 9

  fake-job-1:
    # USER COMMENT 10    
    runs-on: ubuntu-latest
    steps:
      - name: Fake Job
        run: |
          echo "Running fake job"

  # =============================================================================
  # CHANGES DETECTION
  # =============================================================================
  # USER COMMENT 11
  changes:
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/detect-changes
        with:
          baseRef: ${{ inputs.baseRef || 'main' }}

  # USER COMMENT 12
  fake-job-2:
    # USER COMMENT 13
    runs-on: ubuntu-latest
    steps:
      - name: Fake Job
        run: |
          echo "Running fake job"

  # =============================================================================
  # TESTING JOBS
  # =============================================================================
  # Add your testing jobs here
  # Example:
  # test-api: 
  #   needs: branch
  #   runs-on: ubuntu-latest
  #   steps:
  #     - name: Test API
  #       run: |
  #         echo "Run API tests"
  #
  # test-web:
  #   needs: branch
  #   runs-on: ubuntu-latest
  #   steps:
  #     - name: Test Web
  #       run: |
  #         echo "Run Web tests"


  # USER COMMENT 14

  fake-job-3:
    # USER COMMENT 15
    runs-on: ubuntu-latest
    steps:
      - name: Fake Job
        run: |
          echo "Running fake job"

  # =============================================================================
  # VERSIONING
  # =============================================================================
  version:
    if: github.ref_name == 'develop'
    needs: changes
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/calculate-version
        with:
          baseRef: ${{ inputs.baseRef || 'main' }}


  # USER COMMENT 16

  fake-job-4:
    # USER COMMENT 17
    runs-on: ubuntu-latest
    steps:
      - name: Fake Job
        run: |
          echo "Running fake job"

  # USER COMMENT 18

  fake-job-5:
    # USER COMMENT 19
    runs-on: ubuntu-latest
    steps:
      - name: Fake Job
        run: |
          echo "Running fake job"

  # USER COMMENT 20

  # =============================================================================
  # DEPLOYMENT JOBS
  # =============================================================================
  deploy-api:
    needs: branch
    runs-on: ubuntu-latest
    steps:
      - name: Deploy API
        run: |
          echo "Deploy API to production"

  fake-job-6:
    # USER COMMENT 21
    runs-on: ubuntu-latest
    steps:
      - name: Fake Job
        run: |
          echo "Running fake job"

  # =============================================================================
  # TAG & CREATE PR
  # =============================================================================     
  tag:
    if: github.ref_name == 'develop'
    needs: version
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/create-tag
        with:
          version: ${{ needs.version.outputs.nextVersion }}

  # USER COMMENT 22

  fake-job-7:
    # USER COMMENT 23
    runs-on: ubuntu-latest
    steps:
      - name: Fake Job
        run: |
          echo "Running fake job"

  createpr:
    ## SHOULD BE ANY BRANCH EXCEPT the final branch
    if: github.ref_name != 'main'
    needs: tag
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/create-pr
        with:
          sourceBranch: ${{ github.ref_name }}
          targetBranch: ${{ github.ref_name == 'develop' && 'staging' || github.ref_name
            == 'staging' && 'main' || github.ref_name == 'main' && 'main' ||
            'main' }}
          title: 'Release ${{ needs.version.outputs.nextVersion }}'
          body: 'Automated release PR for version ${{ needs.version.outputs.nextVersion
            }}'

  branch:
    ## SHOULD BE THE NEXT BRANCH
    needs: createpr
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/manage-branch
        with:
          action: 'fast-forward'
          targetBranch: ${{ github.ref_name == 'develop' && 'staging' || github.ref_name
            == 'staging' && 'main' || github.ref_name == 'main' && 'main' ||
            'main' }}
          sourceBranch: ${{ github.ref_name }}

  # USER COMMENT 24

  fake-job-8:
    # USER COMMENT 25
    runs-on: ubuntu-latest
    steps:
      - name: Fake Job
        run: |
          echo "Running fake job"`

      writeFileSync(customConfigPath, JSON.stringify(customConfig, null, 2))
      writeFileSync(customPipelinePath, existingPipeline)

      // Run CLI with custom config and pipeline
      const result = await runCLI(['generate', '--config', customConfigPath, '--pipeline', customPipelinePath, '--verbose'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Generated workflows in: .github/workflows')
      expect(result.stdout).toContain(`Reading config from: ${customConfigPath}`)
      expect(result.stdout).toContain(`Reading pipeline from: ${customPipelinePath}`)

      // Verify output file exists
      expect(existsSync(outputPath)).toBe(true)

      // Parse generated YAML to verify merging
      const generatedContent = readFileSync(outputPath, 'utf8')
      const parsedYaml = JSON.parse(JSON.stringify(require('yaml').parse(generatedContent)))
      
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
      expect(parsedYaml.jobs['fake-job-3']).toBeDefined()
      expect(parsedYaml.jobs['fake-job-4']).toBeDefined()
      expect(parsedYaml.jobs['fake-job-5']).toBeDefined()
      expect(parsedYaml.jobs['fake-job-6']).toBeDefined()
      expect(parsedYaml.jobs['fake-job-7']).toBeDefined()
      expect(parsedYaml.jobs['fake-job-8']).toBeDefined()

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

    it('should handle missing pipeline file gracefully', async () => {
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

      writeFileSync(customConfigPath, JSON.stringify(customConfig, null, 2))

      // Run CLI with custom config but no pipeline file
      const result = await runCLI(['generate', '--config', customConfigPath, '--pipeline', 'nonexistent-pipeline.yml', '--verbose'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Generated workflows in: .github/workflows')
      expect(result.stdout).toContain(`Reading config from: ${customConfigPath}`)
      expect(result.stdout).toContain('Reading pipeline from: nonexistent-pipeline.yml')

      // Verify output file exists
      expect(existsSync(outputPath)).toBe(true)

      // Parse generated YAML to verify structure
      const generatedContent = readFileSync(outputPath, 'utf8')
      const parsedYaml = JSON.parse(JSON.stringify(require('yaml').parse(generatedContent)))
      
      expect(parsedYaml).toBeDefined()
      expect(parsedYaml.name).toBe('Pipeline')
      expect(parsedYaml.jobs).toBeDefined()
    })
  })

  describe('CLI Options Validation', () => {
    it('should show help for custom options', async () => {
      const result = await runCLI(['--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('--config <path>')
      expect(result.stdout).toContain('--pipeline <path>')
      expect(result.stdout).toContain('path to config file')
      expect(result.stdout).toContain('path to existing pipeline file for merging')
    })

    it('should show help for generate command options', async () => {
      const result = await runCLI(['generate', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Generate CI/CD workflows from configuration')
      expect(result.stdout).toContain('--output <path>')
      expect(result.stdout).toContain('--skip-unchanged')
    })
  })
})

// Helper function to run CLI commands
async function runCLI(args: string[]): Promise<{ exitCode: number, stdout: string, stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('node', ['../../src/cli/index.ts', ...args], {
      cwd: TEST_DIR,
      stdio: 'pipe'
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      resolve({
        exitCode: code || 0,
        stdout,
        stderr
      })
    })
  })
}
