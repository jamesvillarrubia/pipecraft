/**
 * Integration tests for Pipecraft generators (init.tpl.ts and workflows.tpl.ts)
 *
 * These tests verify that:
 * 1. Init generator creates proper configuration files
 * 2. Workflows generator orchestrates template generation correctly
 * 3. Generators handle errors gracefully
 * 4. Context is properly passed through the generation pipeline
 *
 * Refactored to use isolated workspaces to eliminate race conditions.
 */

import type { PinionContext } from '@featherscloud/pinion'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import inquirer from 'inquirer'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parse as parseYAML } from 'yaml'
import { generate as generateInit } from '../../src/generators/init.tpl.js'
import { generate as generateWorkflows } from '../../src/generators/workflows.tpl.js'
import type { PipecraftConfig } from '../../src/types/index.js'
import { createMinimalConfig } from '../helpers/fixtures.js'
import { createWorkspaceWithCleanup } from '../helpers/workspace.js'
import { FIXTURES_DIR } from '../setup.js'

// Mock inquirer to avoid interactive prompts in tests
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}))

describe('Generator Integration Tests', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('pipecraft-generators')

    // Setup default mock responses for inquirer
    vi.mocked(inquirer.prompt).mockResolvedValue({
      ciProvider: 'github',
      mergeStrategy: 'fast-forward',
      requireConventionalCommits: true,
      initialBranch: 'develop',
      finalBranch: 'main',
      branchFlow: ['develop', 'staging', 'main'],
      packageManager: 'npm',
      domainSelection: 'api-web',
      enableNx: false
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('init.tpl.ts - Configuration Initialization', () => {
    it('should generate valid configuration file', async () => {
      // Skipped: Race condition when running with full test suite - workspace cleanup timing issue
      // All init.tpl.ts tests fail intermittently when run with other tests
      // Tests pass when run individually: npx vitest run tests/integration/generators.test.ts -t "init"
      // Root cause: workspace being cleaned up by other tests while generator is running
      const ctx: PinionContext = {
        cwd: workspace,
        argv: ['init'],
        pinion: {
          logger: {
            ...console,
            notice: console.log
          },
          prompt: async () => ({}),
          cwd: workspace,
          force: true,
          trace: [],
          exec: async () => 0
        },
        projectName: 'test-project',
        ciProvider: 'github' as const,
        mergeStrategy: 'fast-forward' as const,
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop', 'staging', 'main']
      }

      await generateInit(ctx)

      const configPath = join(workspace, '.pipecraftrc')
      expect(existsSync(configPath)).toBe(true)

      const rawContent = readFileSync(configPath, 'utf8')
      const configContent = parseYAML(rawContent)

      expect(configContent.ciProvider).toBe('github')
      expect(configContent.branchFlow).toEqual(['develop', 'staging', 'main'])
      expect(configContent.initialBranch).toBe('develop')
      expect(configContent.finalBranch).toBe('main')
    })

    it('should create basic configuration structure', async () => {
      // Skipped: Race condition when running with other tests - workspace cleanup timing issue
      // Test passes when run individually but fails in full test suite
      // This is a duplicate of "should generate valid configuration file" above
      const ctx: PinionContext = {
        cwd: workspace,
        argv: ['init'],
        pinion: {
          logger: {
            ...console,
            notice: console.log
          },
          prompt: async () => ({}),
          cwd: workspace,
          force: true,
          trace: [],
          exec: async () => 0
        },
        projectName: 'test-project',
        ciProvider: 'github' as const,
        mergeStrategy: 'fast-forward' as const,
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop', 'staging', 'main']
      }

      await generateInit(ctx)

      const configPath = join(workspace, '.pipecraftrc')
      const rawContent = readFileSync(configPath, 'utf8')
      const configContent = parseYAML(rawContent)

      // Verify required fields exist (actual behavior of init generator)
      expect(configContent.ciProvider).toBeDefined()
      expect(configContent.mergeStrategy).toBeDefined()
      expect(configContent.branchFlow).toBeDefined()
    })

    it('should write config with proper structure and defaults', async () => {
      // Skipped: Race condition when running with other tests - workspace cleanup timing issue
      // Test passes when run individually but fails in full test suite
      // This is a duplicate of "should generate valid configuration file" above
      const ctx: PinionContext = {
        cwd: workspace,
        argv: ['init'],
        pinion: {
          logger: {
            ...console,
            notice: console.log
          },
          prompt: async () => ({}),
          cwd: workspace,
          force: true,
          trace: [],
          exec: async () => 0
        },
        projectName: 'test-project',
        ciProvider: 'github' as const,
        mergeStrategy: 'fast-forward' as const,
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop', 'staging', 'main']
      }

      await generateInit(ctx)

      const configPath = join(workspace, '.pipecraftrc')
      const rawContent = readFileSync(configPath, 'utf8')

      // Should be valid YAML
      const parsedContent = parseYAML(rawContent)

      // Verify it has the expected structure
      expect(parsedContent.ciProvider).toBe('github')
      expect(parsedContent.branchFlow).toEqual(['develop', 'staging', 'main'])
      expect(parsedContent.semver).toBeDefined()
      expect(parsedContent.domains).toBeDefined()
    })
  })

  describe('workflows.tpl.ts - Workflow Generation Orchestration', () => {
    let testConfig: PipecraftConfig

    beforeEach(() => {
      // Load test config
      const configPath = join(FIXTURES_DIR, 'basic-config.json')
      testConfig = JSON.parse(readFileSync(configPath, 'utf8'))
    })

    it('should generate all workflow files', async () => {
      // Skipped: Race condition with workspace cleanup - directory exists before
      // generateWorkflows() but gets removed/doesn't exist when Pinion tries to write
      // Core functionality is tested in other integration tests
      const ctx: PinionContext & { config?: PipecraftConfig } = {
        cwd: workspace,
        argv: ['generate'],
        pinion: {
          logger: {
            ...console,
            notice: console.log
          },
          prompt: async () => ({}),
          cwd: workspace,
          force: true,
          trace: [],
          exec: async () => 0
        },
        config: testConfig
      }

      // Ensure .github/workflows directory exists
      const workflowsDir = join(workspace, '.github', 'workflows')
      mkdirSync(workflowsDir, { recursive: true })

      // Verify directory was created
      expect(existsSync(workflowsDir), 'Workflows directory should exist before generate').toBe(
        true
      )

      await generateWorkflows(ctx)

      // Check that the main pipeline file was created
      const pipelinePath = join(workflowsDir, 'pipeline.yml')
      expect(existsSync(pipelinePath), `Expected pipeline.yml to exist`).toBe(true)

      // Action templates are included in the pipeline, not as separate files
      // Verify pipeline has content
      const pipelineContent = readFileSync(pipelinePath, 'utf8')
      expect(pipelineContent.length).toBeGreaterThan(0)
    })

    it('should generate valid YAML in pipeline file', async () => {
      const ctx: PinionContext & { config?: PipecraftConfig } = {
        cwd: workspace,
        argv: ['generate'],
        pinion: {
          logger: {
            ...console,
            notice: console.log
          },
          prompt: async () => ({}),
          cwd: workspace,
          force: true,
          trace: [],
          exec: async () => 0
        },
        config: testConfig
      }

      const workflowsDir = join(workspace, '.github', 'workflows')
      mkdirSync(workflowsDir, { recursive: true })

      await generateWorkflows(ctx)

      const pipelinePath = join(workflowsDir, 'pipeline.yml')
      const pipelineContent = readFileSync(pipelinePath, 'utf8')

      // Should be valid YAML
      expect(() => parseYAML(pipelineContent)).not.toThrow()

      const pipeline = parseYAML(pipelineContent)
      expect(pipeline.name).toBeDefined()
      expect(pipeline.on).toBeDefined()
      expect(pipeline.jobs).toBeDefined()
    })

    it('should include Pipecraft-managed jobs in pipeline', async () => {
      const ctx: PinionContext & { config?: PipecraftConfig } = {
        cwd: workspace,
        argv: ['generate'],
        pinion: {
          logger: {
            ...console,
            notice: console.log
          },
          prompt: async () => ({}),
          cwd: workspace,
          force: true,
          trace: [],
          exec: async () => 0
        },
        config: testConfig
      }

      const workflowsDir = join(workspace, '.github', 'workflows')
      mkdirSync(workflowsDir, { recursive: true })

      await generateWorkflows(ctx)

      const pipelinePath = join(workflowsDir, 'pipeline.yml')
      const pipelineContent = readFileSync(pipelinePath, 'utf8')
      const pipeline = parseYAML(pipelineContent)

      // Check for Pipecraft-managed jobs
      expect(pipeline.jobs.changes).toBeDefined()
      expect(pipeline.jobs.version).toBeDefined()
      expect(pipeline.jobs.tag).toBeDefined()
      expect(pipeline.jobs.promote).toBeDefined()
      expect(pipeline.jobs.release).toBeDefined()
    })

    it('should merge with existing pipeline when provided', async () => {
      // Create an existing pipeline with custom jobs
      const workflowsDir = join(workspace, '.github', 'workflows')
      mkdirSync(workflowsDir, { recursive: true })

      const existingPipelinePath = join(workflowsDir, 'pipeline.yml')
      const existingPipeline = `
name: Existing Pipeline
on:
  push:
    branches: [main]
jobs:
  custom-job:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Custom job"
`
      writeFileSync(existingPipelinePath, existingPipeline)

      const ctx: PinionContext & { config?: PipecraftConfig; pipelinePath?: string } = {
        cwd: workspace,
        argv: ['generate'],
        pinion: {
          logger: {
            ...console,
            notice: console.log
          },
          prompt: async () => ({}),
          cwd: workspace,
          force: true,
          trace: [],
          exec: async () => 0
        },
        config: testConfig,
        pipelinePath: existingPipelinePath
      }

      await generateWorkflows(ctx)

      const pipelineContent = readFileSync(existingPipelinePath, 'utf8')
      const pipeline = parseYAML(pipelineContent)

      // Should preserve custom job
      expect(pipeline.jobs['custom-job']).toBeDefined()

      // Should add Pipecraft jobs
      expect(pipeline.jobs.changes).toBeDefined()
    })

    it('should use custom branch flow from config', async () => {
      const customConfig: PipecraftConfig = {
        ...testConfig,
        branchFlow: ['alpha', 'beta', 'gamma', 'delta']
      }

      const ctx: PinionContext & { config?: PipecraftConfig } = {
        cwd: workspace,
        argv: ['generate'],
        pinion: {
          logger: {
            ...console,
            notice: console.log
          },
          prompt: async () => ({}),
          cwd: workspace,
          force: true,
          trace: [],
          exec: async () => 0
        },
        config: customConfig
      }

      const workflowsDir = join(workspace, '.github', 'workflows')
      mkdirSync(workflowsDir, { recursive: true })

      await generateWorkflows(ctx)

      const pipelinePath = join(workflowsDir, 'pipeline.yml')
      const pipelineContent = readFileSync(pipelinePath, 'utf8')

      // Should include custom branches in the workflow
      expect(pipelineContent).toContain('alpha')
      expect(pipelineContent).toContain('beta')
      expect(pipelineContent).toContain('gamma')
      expect(pipelineContent).toContain('delta')
    })

    it('should handle missing config gracefully with defaults', async () => {
      const workflowsDir = join(workspace, '.github', 'workflows')
      mkdirSync(workflowsDir, { recursive: true })

      // Create minimal config
      const config = createMinimalConfig()
      writeFileSync(join(workspace, '.pipecraftrc'), JSON.stringify(config, null, 2))

      const ctx: PinionContext = {
        cwd: workspace,
        argv: ['generate'],
        config: config,
        pinion: {
          logger: {
            ...console,
            notice: console.log
          },
          prompt: async () => ({}),
          cwd: workspace,
          force: true,
          trace: [],
          exec: async () => 0
        }
      }

      // Should not throw
      await expect(generateWorkflows(ctx)).resolves.not.toThrow()

      // Should use config values
      const pipelinePath = join(workflowsDir, 'pipeline.yml')
      const pipelineContent = readFileSync(pipelinePath, 'utf8')

      // Should include branches from config
      expect(pipelineContent).toContain('develop')
      expect(pipelineContent).toContain('main')
    })

    it('should output to custom pipeline path when specified', async () => {
      const customPipelinePath = join(workspace, 'custom-pipeline.yml')

      const ctx: PinionContext & { config?: PipecraftConfig; outputPipelinePath?: string } = {
        cwd: workspace,
        argv: ['generate'],
        pinion: {
          logger: {
            ...console,
            notice: console.log
          },
          prompt: async () => ({}),
          cwd: workspace,
          force: true,
          trace: [],
          exec: async () => 0
        },
        config: testConfig,
        outputPipelinePath: customPipelinePath
      }

      const workflowsDir = join(workspace, '.github', 'workflows')
      mkdirSync(workflowsDir, { recursive: true })

      await generateWorkflows(ctx)

      // Should write to custom path
      expect(existsSync(customPipelinePath)).toBe(true)

      const pipelineContent = readFileSync(customPipelinePath, 'utf8')
      expect(() => parseYAML(pipelineContent)).not.toThrow()
    })

    it('should include workflow_dispatch trigger with inputs', async () => {
      const ctx: PinionContext & { config?: PipecraftConfig } = {
        cwd: workspace,
        argv: ['generate'],
        pinion: {
          logger: {
            ...console,
            notice: console.log
          },
          prompt: async () => ({}),
          cwd: workspace,
          force: true,
          trace: [],
          exec: async () => 0
        },
        config: testConfig
      }

      const workflowsDir = join(workspace, '.github', 'workflows')
      mkdirSync(workflowsDir, { recursive: true })

      await generateWorkflows(ctx)

      const pipelinePath = join(workflowsDir, 'pipeline.yml')
      const pipelineContent = readFileSync(pipelinePath, 'utf8')
      const pipeline = parseYAML(pipelineContent)

      expect(pipeline.on.workflow_dispatch).toBeDefined()
      expect(pipeline.on.workflow_dispatch.inputs).toBeDefined()
      expect(pipeline.on.workflow_dispatch.inputs.version).toBeDefined()
      expect(pipeline.on.workflow_dispatch.inputs.baseRef).toBeDefined()
    })

    it('should include push trigger with branch flow', async () => {
      // Skipped: Same race condition as 'should generate all workflow files'
      // Core functionality is tested in path-based-template.test.ts
      const ctx: PinionContext & { config?: PipecraftConfig } = {
        cwd: workspace,
        argv: ['generate'],
        pinion: {
          logger: {
            ...console,
            notice: console.log
          },
          prompt: async () => ({}),
          cwd: workspace,
          force: true,
          trace: [],
          exec: async () => 0
        },
        config: testConfig
      }

      const workflowsDir = join(workspace, '.github', 'workflows')
      mkdirSync(workflowsDir, { recursive: true })

      await generateWorkflows(ctx)

      const pipelinePath = join(workflowsDir, 'pipeline.yml')
      const pipelineContent = readFileSync(pipelinePath, 'utf8')
      const pipeline = parseYAML(pipelineContent)

      expect(pipeline.on.push).toBeDefined()
      expect(pipeline.on.push.branches).toBeDefined()
    })
  })

  describe('Generator Error Handling', () => {
    it('should handle invalid config in workflows generator', async () => {
      const invalidConfig = {
        ...JSON.parse(readFileSync(join(FIXTURES_DIR, 'basic-config.json'), 'utf8')),
        branchFlow: null // Invalid
      }

      const ctx: PinionContext & { config?: any } = {
        cwd: workspace,
        argv: ['generate'],
        pinion: {
          logger: {
            ...console,
            notice: console.log
          },
          prompt: async () => ({}),
          cwd: workspace,
          force: true,
          trace: [],
          exec: async () => 0
        },
        config: invalidConfig
      }

      const workflowsDir = join(workspace, '.github', 'workflows')
      mkdirSync(workflowsDir, { recursive: true })

      // Should handle gracefully with defaults
      await expect(generateWorkflows(ctx)).resolves.not.toThrow()
    })

    it('should handle missing pipeline file path gracefully', async () => {
      const testConfig = JSON.parse(readFileSync(join(FIXTURES_DIR, 'basic-config.json'), 'utf8'))

      const ctx: PinionContext & { config?: PipecraftConfig; pipelinePath?: string } = {
        cwd: workspace,
        argv: ['generate'],
        pinion: {
          logger: {
            ...console,
            notice: console.log
          },
          prompt: async () => ({}),
          cwd: workspace,
          force: true,
          trace: [],
          exec: async () => 0
        },
        config: testConfig,
        pipelinePath: '/non/existent/path.yml'
      }

      const workflowsDir = join(workspace, '.github', 'workflows')
      mkdirSync(workflowsDir, { recursive: true })

      // Should not throw, should create new pipeline
      await expect(generateWorkflows(ctx)).resolves.not.toThrow()

      expect(existsSync(join(workflowsDir, 'pipeline.yml'))).toBe(true)
    })
  })
})
