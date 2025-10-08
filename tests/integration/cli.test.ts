import { describe, it, expect, beforeEach, vi } from 'vitest'
import { spawn } from 'child_process'
import { writeFileSync, existsSync, rmSync } from 'fs'
import { join } from 'path'
import { TEST_DIR, FIXTURES_DIR } from '../setup'

describe('CLI Integration Tests', () => {
  beforeEach(() => {
    // Clean up any existing files
    const filesToClean = ['.trunkflowrc.json', '.flowcraft-cache.json', 'package.json']
    filesToClean.forEach(file => {
      if (existsSync(join(TEST_DIR, file))) {
        rmSync(join(TEST_DIR, file))
      }
    })
  })

  describe('init command', () => {
    it('should initialize configuration with interactive mode', async () => {
      const result = await runCLI(['init', '--force'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Configuration initialized successfully')
      expect(existsSync(join(TEST_DIR, '.trunkflowrc.json'))).toBe(true)
    })

    it('should initialize with versioning setup', async () => {
      const result = await runCLI(['init', '--force', '--with-versioning'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Version management setup completed')
      expect(existsSync(join(TEST_DIR, '.release-it.cjs'))).toBe(true)
      expect(existsSync(join(TEST_DIR, 'commitlint.config.js'))).toBe(true)
    })
  })

  describe('generate command', () => {
    beforeEach(() => {
      // Setup test configuration
      const configPath = join(FIXTURES_DIR, 'basic-config.json')
      const configContent = readFileSync(configPath, 'utf8')
      writeFileSync(join(TEST_DIR, '.trunkflowrc.json'), configContent)
    })

    it('should generate workflows successfully', async () => {
      const result = await runCLI(['generate'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Generated workflows in: .github/workflows')
    })

    it('should skip generation when no changes detected', async () => {
      // First generation
      await runCLI(['generate'])
      
      // Second generation should be skipped
      const result = await runCLI(['generate'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('No changes detected')
    })

    it('should force generation when --force flag is used', async () => {
      // First generation
      await runCLI(['generate'])
      
      // Force second generation
      const result = await runCLI(['generate', '--force'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Generated workflows in: .github/workflows')
    })

    it('should show dry run output', async () => {
      const result = await runCLI(['generate', '--dry-run'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Dry run mode - would generate workflows')
    })
  })

  describe('validate command', () => {
    it('should validate correct configuration', async () => {
      const configPath = join(FIXTURES_DIR, 'basic-config.json')
      const configContent = readFileSync(configPath, 'utf8')
      writeFileSync(join(TEST_DIR, '.trunkflowrc.json'), configContent)
      
      const result = await runCLI(['validate'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Configuration is valid')
    })

    it('should fail validation for invalid configuration', async () => {
      const configPath = join(FIXTURES_DIR, 'invalid-config.json')
      const configContent = readFileSync(configPath, 'utf8')
      writeFileSync(join(TEST_DIR, '.trunkflowrc.json'), configContent)
      
      const result = await runCLI(['validate'])
      
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Configuration validation failed')
    })

    it('should fail when no configuration file exists', async () => {
      const result = await runCLI(['validate'])
      
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('No configuration file found')
    })
  })

  describe('verify command', () => {
    it('should verify setup successfully', async () => {
      const configPath = join(FIXTURES_DIR, 'basic-config.json')
      const configContent = readFileSync(configPath, 'utf8')
      writeFileSync(join(TEST_DIR, '.trunkflowrc.json'), configContent)
      
      const result = await runCLI(['verify'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Found configuration at')
      expect(result.stdout).toContain('Configuration is valid')
    })

    it('should warn when no configuration exists', async () => {
      const result = await runCLI(['verify'])
      
      expect(result.exitCode).toBe(1)
      expect(result.stdout).toContain('No configuration file found')
    })
  })

  describe('version command', () => {
    beforeEach(() => {
      const configPath = join(FIXTURES_DIR, 'basic-config.json')
      const configContent = readFileSync(configPath, 'utf8')
      writeFileSync(join(TEST_DIR, '.trunkflowrc.json'), configContent)
    })

    it('should check version information', async () => {
      const result = await runCLI(['version', '--check'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Current version')
      expect(result.stdout).toContain('Next version')
      expect(result.stdout).toContain('Conventional commits')
    })

    it('should bump version', async () => {
      const result = await runCLI(['version', '--bump'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Version bump completed')
    })

    it('should create release', async () => {
      const result = await runCLI(['version', '--release'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Release created')
    })
  })

  describe('help command', () => {
    it('should show help when no command provided', async () => {
      const result = await runCLI([])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Usage:')
      expect(result.stdout).toContain('Commands:')
    })

    it('should show help for specific command', async () => {
      const result = await runCLI(['init', '--help'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Initialize flowcraft configuration')
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
