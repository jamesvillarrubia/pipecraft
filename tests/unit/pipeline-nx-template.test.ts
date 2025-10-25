/**
 * Tests for Nx Pipeline Template
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { generate } from '../../src/templates/workflows/pipeline-nx.yml.tpl.js'
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { parse as parseYAML } from 'yaml'

describe('Nx Pipeline Template', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(process.cwd(), '.test-temp-nx-pipeline')
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true })
    }
    mkdirSync(testDir, { recursive: true })
    mkdirSync(join(testDir, '.github', 'workflows'), { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true })
    }
  })

  const createContext = (overrides: any = {}) => ({
    cwd: testDir,
    pinion: {
      logger: { ...console, notice: console.log },
      prompt: async () => ({}),
      cwd: testDir,
      force: true,
      trace: [],
      exec: async () => 0
    },
    config: {
      branchFlow: ['develop', 'main'],
      domains: {},
      nx: {
        enabled: true,
        tasks: ['test', 'build'],
        baseRef: 'origin/main'
      },
      ...overrides.config
    },
    branchFlow: ['develop', 'main'],
    ...overrides
  })

  it('should generate Nx pipeline with minimal config', async () => {
    const ctx = createContext()
    const result = await generate(ctx)

    expect(result).toBeDefined()
    expect(result.yamlContent).toBeDefined()

    const workflow = parseYAML(result.yamlContent)
    expect(workflow.name).toBe('Pipeline')
    expect(workflow.jobs).toBeDefined()
    expect(workflow.jobs['nx-ci']).toBeDefined()
  })

  it('should include nx-ci job with all Nx tasks', async () => {
    const ctx = createContext({
      config: {
        branchFlow: ['develop', 'main'],
        domains: {},
        nx: {
          enabled: true,
          tasks: ['lint', 'test', 'build', 'e2e'],
          baseRef: 'origin/main'
        }
      }
    })

    const result = await generate(ctx)

    // Check that all tasks are in the generated workflow
    expect(result.yamlContent).toContain('nx affected --target=lint')
    expect(result.yamlContent).toContain('nx affected --target=test')
    expect(result.yamlContent).toContain('nx affected --target=build')
    expect(result.yamlContent).toContain('nx affected --target=e2e')
  })

  it('should include Nx cache when enabled', async () => {
    const ctx = createContext({
      config: {
        branchFlow: ['develop', 'main'],
        domains: {},
        nx: {
          enabled: true,
          tasks: ['test'],
          enableCache: true,
          baseRef: 'origin/main'
        }
      }
    })

    const result = await generate(ctx)

    expect(result.yamlContent).toContain('Cache Nx')
    expect(result.yamlContent).toContain('.nx/cache')
  })

  it('should not include cache when disabled', async () => {
    const ctx = createContext({
      config: {
        branchFlow: ['develop', 'main'],
        domains: {},
        nx: {
          enabled: true,
          tasks: ['test'],
          enableCache: false,
          baseRef: 'origin/main'
        }
      }
    })

    const result = await generate(ctx)

    expect(result.yamlContent).not.toContain('Cache Nx')
  })

  it('should use custom baseRef in nx affected commands', async () => {
    const ctx = createContext({
      config: {
        branchFlow: ['develop', 'main'],
        domains: {},
        nx: {
          enabled: true,
          tasks: ['test'],
          baseRef: 'origin/develop'
        }
      }
    })

    const result = await generate(ctx)

    expect(result.yamlContent).toContain('origin/develop')
  })

  it('should preserve user jobs when merging', async () => {
    const pipelinePath = join(testDir, '.github', 'workflows', 'pipeline.yml')

    // Create existing workflow with user job
    const existingWorkflow = `
name: Pipeline
jobs:
  my-custom-job:
    runs-on: ubuntu-latest
    steps:
      - run: echo "custom"
`
    writeFileSync(pipelinePath, existingWorkflow)

    const ctx = createContext()
    const result = await generate(ctx)

    expect(result.mergeStatus).toBe('merged')
    expect(result.yamlContent).toContain('my-custom-job')
    expect(result.yamlContent).toContain('nx-ci')
  })

  it('should use custom output path when specified', async () => {
    const customPath = join(testDir, 'custom-pipeline.yml')

    const ctx = createContext({
      outputPipelinePath: customPath
    })

    await generate(ctx)

    expect(existsSync(customPath)).toBe(true)

    const content = readFileSync(customPath, 'utf8')
    const workflow = parseYAML(content)
    expect(workflow.name).toBe('Pipeline')
  })

  it('should report created status for new workflow', async () => {
    const ctx = createContext()
    const result = await generate(ctx)

    expect(result.mergeStatus).toBe('created')
  })

  it('should include changes job dependency', async () => {
    const ctx = createContext()
    const result = await generate(ctx)
    const workflow = parseYAML(result.yamlContent)

    const nxJob = workflow.jobs['nx-ci']
    expect(nxJob.needs).toBe('changes')
  })

  it('should include version job after nx-ci', async () => {
    const ctx = createContext()
    const result = await generate(ctx)
    const workflow = parseYAML(result.yamlContent)

    const versionJob = workflow.jobs['version']
    expect(versionJob).toBeDefined()
    expect(versionJob.needs).toContain('nx-ci')
  })
})
