import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, existsSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import { TEST_DIR, FIXTURES_DIR } from '../setup'

describe('End-to-End Workflow Generation', () => {
  beforeEach(() => {
    // Clean up test directory
    const testFiles = ['.trunkflowrc.json', '.flowcraft-cache.json', 'package.json']
    testFiles.forEach(file => {
      if (existsSync(join(TEST_DIR, file))) {
        rmSync(join(TEST_DIR, file))
      }
    })
  })

  afterEach(() => {
    // Clean up generated files
    const generatedDirs = ['.github', '.husky']
    generatedDirs.forEach(dir => {
      if (existsSync(join(TEST_DIR, dir))) {
        rmSync(join(TEST_DIR, dir), { recursive: true, force: true })
      }
    })
  })

  describe('Complete Workflow Generation', () => {
    it('should generate all GitHub Actions workflows', async () => {
      // Setup configuration
      const configPath = join(FIXTURES_DIR, 'basic-config.json')
      const configContent = readFileSync(configPath, 'utf8')
      writeFileSync(join(TEST_DIR, '.trunkflowrc.json'), configContent)

      // Generate workflows
      const result = await runCLI(['generate'])
      expect(result.exitCode).toBe(0)

      // Check that all expected workflows were generated
      const expectedWorkflows = [
        '.github/workflows/job.changes.yml',
        '.github/workflows/job.version.yml',
        '.github/workflows/job.tag.yml',
        '.github/workflows/job.createpr.yml',
        '.github/workflows/job.branch.yml',
        '.github/workflows/job.apps.yml',
        '.github/workflows/pipeline.yml'
      ]

      for (const workflow of expectedWorkflows) {
        expect(existsSync(join(TEST_DIR, workflow))).toBe(true)
      }
    })

    it('should generate workflows with correct content', async () => {
      // Setup configuration
      const configPath = join(FIXTURES_DIR, 'basic-config.json')
      const configContent = readFileSync(configPath, 'utf8')
      writeFileSync(join(TEST_DIR, '.trunkflowrc.json'), configContent)

      // Generate workflows
      await runCLI(['generate'])

      // Check changes workflow content
      const changesWorkflow = readFileSync(join(TEST_DIR, '.github/workflows/job.changes.yml'), 'utf8')
      expect(changesWorkflow).toContain('name: "Changes"')
      expect(changesWorkflow).toContain('workflow_call:')
      expect(changesWorkflow).toContain('api:')
      expect(changesWorkflow).toContain('web:')
      expect(changesWorkflow).toContain('apps/api/**')
      expect(changesWorkflow).toContain('apps/web/**')

      // Check pipeline workflow content
      const pipelineWorkflow = readFileSync(join(TEST_DIR, '.github/workflows/pipeline.yml'), 'utf8')
      expect(pipelineWorkflow).toContain('name: "Pipeline"')
      expect(pipelineWorkflow).toContain('workflow_call:')
      expect(pipelineWorkflow).toContain('job.changes')
    })

    it('should handle idempotent regeneration', async () => {
      // Setup configuration
      const configPath = join(FIXTURES_DIR, 'basic-config.json')
      const configContent = readFileSync(configPath, 'utf8')
      writeFileSync(join(TEST_DIR, '.trunkflowrc.json'), configContent)

      // First generation
      const result1 = await runCLI(['generate'])
      expect(result1.exitCode).toBe(0)
      expect(result1.stdout).toContain('Generated workflows in: .github/workflows')

      // Second generation should be skipped
      const result2 = await runCLI(['generate'])
      expect(result2.exitCode).toBe(0)
      expect(result2.stdout).toContain('No changes detected')

      // Force regeneration
      const result3 = await runCLI(['generate', '--force'])
      expect(result3.exitCode).toBe(0)
      expect(result3.stdout).toContain('Generated workflows in: .github/workflows')
    })

    it('should generate version management files', async () => {
      // Setup configuration with versioning
      const configPath = join(FIXTURES_DIR, 'basic-config.json')
      const configContent = readFileSync(configPath, 'utf8')
      const config = JSON.parse(configContent)
      config.versioning = {
        enabled: true,
        releaseItConfig: '.release-it.cjs',
        conventionalCommits: true,
        autoTag: true,
        autoPush: true,
        changelog: true,
        bumpRules: {
          feat: 'minor',
          fix: 'patch',
          breaking: 'major'
        }
      }
      writeFileSync(join(TEST_DIR, '.trunkflowrc.json'), JSON.stringify(config, null, 2))

      // Initialize with versioning
      const initResult = await runCLI(['init', '--force', '--with-versioning'])
      expect(initResult.exitCode).toBe(0)

      // Check version management files
      expect(existsSync(join(TEST_DIR, '.release-it.cjs'))).toBe(true)
      expect(existsSync(join(TEST_DIR, 'commitlint.config.js'))).toBe(true)
      expect(existsSync(join(TEST_DIR, '.husky/commit-msg'))).toBe(true)

      // Check package.json was updated
      const packageJson = JSON.parse(readFileSync(join(TEST_DIR, 'package.json'), 'utf8'))
      expect(packageJson.scripts).toHaveProperty('release')
      expect(packageJson.scripts).toHaveProperty('changelog')
    })
  })

  describe('Configuration Validation', () => {
    it('should validate complete configuration', async () => {
      // Setup valid configuration
      const configPath = join(FIXTURES_DIR, 'basic-config.json')
      const configContent = readFileSync(configPath, 'utf8')
      writeFileSync(join(TEST_DIR, '.trunkflowrc.json'), configContent)

      const result = await runCLI(['validate'])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Configuration is valid')
    })

    it('should fail validation for invalid configuration', async () => {
      // Setup invalid configuration
      const configPath = join(FIXTURES_DIR, 'invalid-config.json')
      const configContent = readFileSync(configPath, 'utf8')
      writeFileSync(join(TEST_DIR, '.trunkflowrc.json'), configContent)

      const result = await runCLI(['validate'])
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Configuration validation failed')
    })
  })

  describe('Version Management', () => {
    it('should check version information', async () => {
      // Setup configuration
      const configPath = join(FIXTURES_DIR, 'basic-config.json')
      const configContent = readFileSync(configPath, 'utf8')
      writeFileSync(join(TEST_DIR, '.trunkflowrc.json'), configContent)

      const result = await runCLI(['version', '--check'])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Current version')
      expect(result.stdout).toContain('Next version')
      expect(result.stdout).toContain('Conventional commits')
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
