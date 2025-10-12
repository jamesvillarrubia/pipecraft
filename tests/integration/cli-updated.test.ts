/**
 * Updated CLI Integration Tests
 * 
 * These tests verify CLI commands work correctly by running the actual CLI
 * using a reliable execution strategy.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { execSync } from 'child_process'
import { writeFileSync, existsSync, rmSync, readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { TEST_DIR, FIXTURES_DIR } from '../setup'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = join(__dirname, '../..')

describe('CLI Integration Tests (Updated)', () => {
  beforeEach(() => {
    // Clean up any existing files
    const filesToClean = [
      '.flowcraftrc.json',
      '.flowcraft-cache.json',
      'package.json',
      '.github',
      '.release-it.cjs',
      'commitlint.config.js',
      '.husky'
    ]
    
    filesToClean.forEach(file => {
      const filePath = join(TEST_DIR, file)
      if (existsSync(filePath)) {
        rmSync(filePath, { recursive: true, force: true })
      }
    })
  })

  describe('generate command', () => {
    beforeEach(() => {
      // Setup test configuration
      const configPath = join(FIXTURES_DIR, 'basic-config.json')
      const configContent = readFileSync(configPath, 'utf8')
      writeFileSync(join(TEST_DIR, '.flowcraftrc.json'), configContent)
      
      // Create .github/workflows directory
      mkdirSync(join(TEST_DIR, '.github/workflows'), { recursive: true })
    })

    it('should generate workflows successfully with --force flag', () => {
      const result = runCLISync(['generate', '--force'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Generated workflows')
      
      // Verify pipeline was created
      const pipelinePath = join(TEST_DIR, '.github/workflows/pipeline.yml')
      expect(existsSync(pipelinePath)).toBe(true)
    })

    it('should respect --dry-run flag', () => {
      const result = runCLISync(['generate', '--dry-run'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Dry run mode')
    })

    it('should support custom config path', () => {
      // Create custom config
      const customConfigPath = join(TEST_DIR, 'custom-config.json')
      const configContent = readFileSync(join(FIXTURES_DIR, 'basic-config.json'), 'utf8')
      writeFileSync(customConfigPath, configContent)
      
      const result = runCLISync(['generate', '--force', '--config', 'custom-config.json'])
      
      expect(result.exitCode).toBe(0)
    })

    it('should support custom output pipeline path', () => {
      const customOutput = 'custom-output.yml'
      const result = runCLISync(['generate', '--force', '--output-pipeline', customOutput])
      
      expect(result.exitCode).toBe(0)
      expect(existsSync(join(TEST_DIR, customOutput))).toBe(true)
    })

    it('should skip generation when no changes detected', () => {
      // First generation with force
      runCLISync(['generate', '--force'])
      
      // Second generation without force should skip
      const result = runCLISync(['generate'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('No changes detected')
    })
  })

  describe('validate command', () => {
    it('should validate correct configuration', () => {
      const configPath = join(FIXTURES_DIR, 'basic-config.json')
      const configContent = readFileSync(configPath, 'utf8')
      writeFileSync(join(TEST_DIR, '.flowcraftrc.json'), configContent)
      
      const result = runCLISync(['validate'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Configuration is valid')
    })

    it('should fail validation for invalid configuration', () => {
      const configPath = join(FIXTURES_DIR, 'invalid-config.json')
      const configContent = readFileSync(configPath, 'utf8')
      writeFileSync(join(TEST_DIR, '.flowcraftrc.json'), configContent)
      
      const result = runCLISync(['validate'], { expectError: true })
      
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('validation failed')
    })

    it('should fail when no configuration file exists', () => {
      const result = runCLISync(['validate'], { expectError: true })
      
      expect(result.exitCode).toBe(1)
      // Error message may vary but should indicate file not found
      expect(result.stderr).toMatch(/no such file|No configuration file found/i)
    })
  })

  describe('help command', () => {
    it('should show help when no command provided', () => {
      // Running with no args may exit with 0 or non-zero depending on implementation
      const result = runCLISync([], { expectError: true })
      
      // Should show help text regardless of exit code
      const output = result.stdout + result.stderr
      expect(output).toContain('Usage:')
      expect(output).toContain('Commands:')
    })

    it('should show help for specific command', () => {
      const result = runCLISync(['generate', '--help'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Generate CI/CD workflows')
    })

    it('should show help for init command', () => {
      const result = runCLISync(['init', '--help'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Initialize flowcraft configuration')
    })
  })

  describe('version command', () => {
    beforeEach(() => {
      const configPath = join(FIXTURES_DIR, 'basic-config.json')
      const configContent = readFileSync(configPath, 'utf8')
      writeFileSync(join(TEST_DIR, '.flowcraftrc.json'), configContent)
      
      // Create a minimal package.json for versioning
      writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({
        name: 'test-project',
        version: '1.0.0'
      }, null, 2))
    })

    it('should check version information', () => {
      const result = runCLISync(['version', '--check'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Current version')
    })
  })

  describe('global options', () => {
    beforeEach(() => {
      const configPath = join(FIXTURES_DIR, 'basic-config.json')
      const configContent = readFileSync(configPath, 'utf8')
      writeFileSync(join(TEST_DIR, '.flowcraftrc.json'), configContent)
      mkdirSync(join(TEST_DIR, '.github/workflows'), { recursive: true })
    })

    it('should support --verbose flag', () => {
      const result = runCLISync(['generate', '--force', '--verbose'])
      
      expect(result.exitCode).toBe(0)
      // Verbose output should show config reading
      expect(result.stdout).toMatch(/Reading config|config from/)
    })

    it('should support --force flag', () => {
      // Generate twice with force
      const result1 = runCLISync(['generate', '--force'])
      expect(result1.exitCode).toBe(0)
      
      const result2 = runCLISync(['generate', '--force'])
      expect(result2.exitCode).toBe(0)
      
      // Should not skip on second run
      expect(result2.stdout).not.toContain('No changes detected')
    })
  })
})

/**
 * Helper function to run CLI commands synchronously
 * This uses execSync which is more reliable than spawn for testing
 * 
 * We use tsx to run TypeScript directly from project root to avoid
 * ES module path resolution issues with the compiled JavaScript.
 */
function runCLISync(
  args: string[],
  options: { expectError?: boolean } = {}
): { exitCode: number; stdout: string; stderr: string } {
  // Get absolute path to CLI source from project root
  const cliPath = join(PROJECT_ROOT, 'src/cli/index.ts')
  
  // Build command with proper working directory handling:
  // 1. Set NODE_PATH to project root for module resolution
  // 2. Run tsx from TEST_DIR so CLI operates in test context
  const command = `npx tsx "${cliPath}" ${args.map(arg => `"${arg}"`).join(' ')}`
  
  try {
    const output = execSync(command, {
      cwd: TEST_DIR,
      encoding: 'utf8',
      stdio: 'pipe',
      env: { 
        ...process.env,
        // Add project root to NODE_PATH for module resolution
        NODE_PATH: join(PROJECT_ROOT, 'src')
      },
      shell: '/bin/bash'
    })
    
    return {
      exitCode: 0,
      stdout: output,
      stderr: ''
    }
  } catch (error: any) {
    if (options.expectError) {
      return {
        exitCode: error.status || 1,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || ''
      }
    }
    
    // If we didn't expect an error, log it for debugging
    console.error('Unexpected CLI error:', {
      status: error.status,
      stdout: error.stdout,
      stderr: error.stderr,
      message: error.message
    })
    
    throw error
  }
}

