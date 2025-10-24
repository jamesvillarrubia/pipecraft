/**
 * Tests for NX Workspace Analyzer
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { analyzeNxWorkspace, isNxWorkspace, generateNxCommand, DEFAULT_TASK_STAGE_MAPPING } from '../../src/utils/nx-analyzer.js'

describe('NX Workspace Analyzer', () => {
  const testDir = join(process.cwd(), 'tmp-nx-test')

  beforeEach(() => {
    // Clean up and create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    // Clean up after tests
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('isNxWorkspace', () => {
    it('should detect NX workspace when nx.json exists', () => {
      writeFileSync(join(testDir, 'nx.json'), '{}')
      expect(isNxWorkspace(testDir)).toBe(true)
    })

    it('should return false when nx.json does not exist', () => {
      expect(isNxWorkspace(testDir)).toBe(false)
    })
  })

  describe('analyzeNxWorkspace', () => {
    it('should return not NX workspace when nx.json missing', () => {
      const result = analyzeNxWorkspace(testDir)
      expect(result.isNxWorkspace).toBe(false)
      expect(result.tasks).toEqual([])
      expect(result.tasksByStage['pre-version']).toEqual([])
      expect(result.tasksByStage['post-version']).toEqual([])
    })

    it('should discover tasks from nx.json targetDefaults', () => {
      const nxJson = {
        targetDefaults: {
          'build': {
            dependsOn: ['^build']
          },
          'test': {
            dependsOn: ['^build']
          },
          'lint': {}
        }
      }

      writeFileSync(join(testDir, 'nx.json'), JSON.stringify(nxJson))

      const result = analyzeNxWorkspace(testDir)

      expect(result.isNxWorkspace).toBe(true)
      expect(result.tasks.length).toBe(3)
      expect(result.tasksByStage['pre-version']).toContain('lint')
      expect(result.tasksByStage['pre-version']).toContain('test')
      expect(result.tasksByStage['pre-version']).toContain('build')
    })

    it('should discover tasks from project.json files', () => {
      writeFileSync(join(testDir, 'nx.json'), '{}')

      // Create a project with project.json
      mkdirSync(join(testDir, 'apps', 'app1'), { recursive: true })
      const projectJson = {
        targets: {
          'build': {},
          'test': {},
          'e2e': {}
        }
      }
      writeFileSync(join(testDir, 'apps', 'app1', 'project.json'), JSON.stringify(projectJson))

      const result = analyzeNxWorkspace(testDir)

      expect(result.isNxWorkspace).toBe(true)
      expect(result.tasks.length).toBe(3)
      expect(result.tasksByStage['pre-version']).toContain('test')
      expect(result.tasksByStage['pre-version']).toContain('e2e')
      expect(result.tasksByStage['post-version']).toContain('build')
    })

    it('should combine tasks from nx.json and project.json', () => {
      const nxJson = {
        targetDefaults: {
          'lint': {},
          'test': {}
        }
      }
      writeFileSync(join(testDir, 'nx.json'), JSON.stringify(nxJson))

      mkdirSync(join(testDir, 'libs', 'lib1'), { recursive: true })
      const projectJson = {
        targets: {
          'build': {},
          'e2e': {}
        }
      }
      writeFileSync(join(testDir, 'libs', 'lib1', 'project.json'), JSON.stringify(projectJson))

      const result = analyzeNxWorkspace(testDir)

      expect(result.isNxWorkspace).toBe(true)
      expect(result.tasks.length).toBe(4)
      expect(result.tasksByStage['pre-version']).toContain('lint')
      expect(result.tasksByStage['pre-version']).toContain('test')
      expect(result.tasksByStage['pre-version']).toContain('e2e')
      expect(result.tasksByStage['post-version']).toContain('build')
    })

    it('should respect custom task stage mapping', () => {
      const nxJson = {
        targetDefaults: {
          'custom-task': {}
        }
      }
      writeFileSync(join(testDir, 'nx.json'), JSON.stringify(nxJson))

      const customMapping = {
        'custom-task': 'post-version' as const
      }

      const result = analyzeNxWorkspace(testDir, customMapping)

      expect(result.tasksByStage['post-version']).toContain('custom-task')
      expect(result.tasksByStage['pre-version']).not.toContain('custom-task')
    })

    it('should exclude tasks specified in excludeTasks', () => {
      const nxJson = {
        targetDefaults: {
          'build': {},
          'test': {},
          'serve': {},
          'storybook': {}
        }
      }
      writeFileSync(join(testDir, 'nx.json'), JSON.stringify(nxJson))

      const result = analyzeNxWorkspace(testDir, {}, ['serve', 'storybook'])

      expect(result.tasks.map(t => t.name)).not.toContain('serve')
      expect(result.tasks.map(t => t.name)).not.toContain('storybook')
      expect(result.tasks.map(t => t.name)).toContain('build')
      expect(result.tasks.map(t => t.name)).toContain('test')
    })

    it('should default unknown tasks to pre-version', () => {
      const nxJson = {
        targetDefaults: {
          'unknown-task': {}
        }
      }
      writeFileSync(join(testDir, 'nx.json'), JSON.stringify(nxJson))

      const result = analyzeNxWorkspace(testDir)

      expect(result.tasksByStage['pre-version']).toContain('unknown-task')
      expect(result.tasksByStage['post-version']).not.toContain('unknown-task')
    })

    it('should handle nested project.json files', () => {
      writeFileSync(join(testDir, 'nx.json'), '{}')

      // Create nested projects
      mkdirSync(join(testDir, 'apps', 'app1', 'nested'), { recursive: true })
      writeFileSync(join(testDir, 'apps', 'app1', 'nested', 'project.json'), JSON.stringify({
        targets: { 'build': {}, 'test': {} }
      }))

      mkdirSync(join(testDir, 'libs', 'lib1'), { recursive: true })
      writeFileSync(join(testDir, 'libs', 'lib1', 'project.json'), JSON.stringify({
        targets: { 'lint': {} }
      }))

      const result = analyzeNxWorkspace(testDir)

      expect(result.isNxWorkspace).toBe(true)
      expect(result.tasks.length).toBe(3)
    })

    it('should skip node_modules and dist directories', () => {
      writeFileSync(join(testDir, 'nx.json'), '{}')

      // Create project.json in node_modules (should be ignored)
      mkdirSync(join(testDir, 'node_modules', 'some-package'), { recursive: true })
      writeFileSync(join(testDir, 'node_modules', 'some-package', 'project.json'), JSON.stringify({
        targets: { 'should-be-ignored': {} }
      }))

      // Create project.json in dist (should be ignored)
      mkdirSync(join(testDir, 'dist', 'app'), { recursive: true })
      writeFileSync(join(testDir, 'dist', 'app', 'project.json'), JSON.stringify({
        targets: { 'also-ignored': {} }
      }))

      // Create valid project.json
      mkdirSync(join(testDir, 'apps', 'app1'), { recursive: true })
      writeFileSync(join(testDir, 'apps', 'app1', 'project.json'), JSON.stringify({
        targets: { 'test': {} }
      }))

      const result = analyzeNxWorkspace(testDir)

      expect(result.tasks.map(t => t.name)).not.toContain('should-be-ignored')
      expect(result.tasks.map(t => t.name)).not.toContain('also-ignored')
      expect(result.tasks.map(t => t.name)).toContain('test')
    })
  })

  describe('generateNxCommand', () => {
    it('should generate nx affected command by default', () => {
      const cmd = generateNxCommand('test', 'main')
      expect(cmd).toBe('npx nx affected --target=test --base=main')
    })

    it('should generate nx affected command with useAffected=true', () => {
      const cmd = generateNxCommand('build', 'develop', true)
      expect(cmd).toBe('npx nx affected --target=build --base=develop')
    })

    it('should generate nx run-many command with useAffected=false', () => {
      const cmd = generateNxCommand('lint', 'main', false)
      expect(cmd).toBe('npx nx run-many --target=lint --all')
    })

    it('should use default base when not specified', () => {
      const cmd = generateNxCommand('test')
      expect(cmd).toBe('npx nx affected --target=test --base=main')
    })
  })

  describe('DEFAULT_TASK_STAGE_MAPPING', () => {
    it('should map quality check tasks to pre-version', () => {
      expect(DEFAULT_TASK_STAGE_MAPPING['lint']).toBe('pre-version')
      expect(DEFAULT_TASK_STAGE_MAPPING['test']).toBe('pre-version')
      expect(DEFAULT_TASK_STAGE_MAPPING['e2e']).toBe('pre-version')
      expect(DEFAULT_TASK_STAGE_MAPPING['typecheck']).toBe('pre-version')
    })

    it('should map build/deploy tasks to post-version', () => {
      expect(DEFAULT_TASK_STAGE_MAPPING['build']).toBe('post-version')
      expect(DEFAULT_TASK_STAGE_MAPPING['deploy']).toBe('post-version')
      expect(DEFAULT_TASK_STAGE_MAPPING['publish']).toBe('post-version')
      expect(DEFAULT_TASK_STAGE_MAPPING['docker-build']).toBe('post-version')
    })
  })
})
