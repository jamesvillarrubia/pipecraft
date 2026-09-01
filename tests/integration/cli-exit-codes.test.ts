/**
 * CLI Exit Code Integration Tests
 *
 * Tests that the CLI returns correct exit codes for CI/CD integration.
 * These tests actually execute the CLI binary and verify exit codes.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('CLI Exit Codes', () => {
  let testDir: string
  let cliPath: string

  beforeEach(() => {
    // Create unique temp directory for this test
    testDir = join(
      tmpdir(),
      `pipecraft-exit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    mkdirSync(testDir, { recursive: true })
    mkdirSync(join(testDir, '.git'), { recursive: true })
    mkdirSync(join(testDir, '.github', 'workflows'), { recursive: true })

    // Create minimal git config
    writeFileSync(join(testDir, '.git', 'config'), '[core]\n\trepositoryformatversion = 0\n')

    // Path to CLI
    cliPath = join(process.cwd(), 'dist', 'cli', 'index.js')
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('validate command', () => {
    it('should exit 0 when validation passes', () => {
      // Create valid config
      const config = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop', 'main'],
        domains: {
          api: { paths: ['apps/api/**'], description: 'API' }
        }
      }
      writeFileSync(join(testDir, '.pipecraftrc'), JSON.stringify(config))

      const result = spawnSync('node', [cliPath, 'validate'], {
        cwd: testDir,
        encoding: 'utf8',
        timeout: 10000
      })

      // Validation should succeed
      expect(result.status).toBe(0)
    })

    it('auto-discovers a .pipecraftrc.json config (not bare .pipecraftrc)', () => {
      // Regression: the CLI used to default -c to the literal '.pipecraftrc', forcing an
      // exact-file load that ENOENT'd on the common .pipecraftrc.json case. With no
      // default, cosmiconfig discovers any supported format.
      const config = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop', 'main'],
        semver: { bumpRules: { feat: 'minor', fix: 'patch' } },
        domains: { api: { paths: ['apps/api/**'], description: 'API', testable: true } }
      }
      writeFileSync(join(testDir, '.pipecraftrc.json'), JSON.stringify(config))

      const validate = spawnSync('node', [cliPath, 'validate'], {
        cwd: testDir,
        encoding: 'utf8',
        timeout: 10000
      })
      expect(validate.status).toBe(0)

      const generate = spawnSync('node', [cliPath, 'generate', '--skip-checks'], {
        cwd: testDir,
        encoding: 'utf8',
        timeout: 30000
      })
      expect(generate.status).toBe(0)
      expect(existsSync(join(testDir, '.github', 'workflows', 'pipeline.yml'))).toBe(true)
    })

    it('should exit 1 when config is invalid', () => {
      // Create invalid config (missing required fields)
      const invalidConfig = {
        ciProvider: 'github'
        // Missing required fields
      }
      writeFileSync(join(testDir, '.pipecraftrc'), JSON.stringify(invalidConfig))

      const result = spawnSync('node', [cliPath, 'validate'], {
        cwd: testDir,
        encoding: 'utf8',
        timeout: 10000
      })

      // Validation should fail
      expect(result.status).toBe(1)
    })

    it('should exit 1 when config file is missing', () => {
      // No config file created

      const result = spawnSync('node', [cliPath, 'validate'], {
        cwd: testDir,
        encoding: 'utf8',
        timeout: 10000
      })

      // Should fail due to missing config
      expect(result.status).toBe(1)
    })
  })

  describe('generate command', () => {
    it('should exit 0 when generation succeeds', () => {
      const config = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop', 'main'],
        domains: {
          api: { paths: ['apps/api/**'], description: 'API' }
        }
      }
      writeFileSync(join(testDir, '.pipecraftrc'), JSON.stringify(config))

      const result = spawnSync('node', [cliPath, 'generate', '--skip-checks'], {
        cwd: testDir,
        encoding: 'utf8',
        timeout: 30000
      })

      expect(result.status).toBe(0)

      // Verify workflow was created
      expect(existsSync(join(testDir, '.github', 'workflows', 'pipeline.yml'))).toBe(true)
    })

    it('should exit 1 when config has reserved domain name', () => {
      const config = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop', 'main'],
        domains: {
          version: { paths: ['apps/**'], description: 'Reserved name' }
        }
      }
      writeFileSync(join(testDir, '.pipecraftrc'), JSON.stringify(config))

      const result = spawnSync('node', [cliPath, 'generate', '--skip-checks'], {
        cwd: testDir,
        encoding: 'utf8',
        timeout: 30000
      })

      expect(result.status).toBe(1)
      expect(result.stderr || result.stdout).toContain('reserved')
    })

    it('should exit 1 when branch flow is invalid', () => {
      const config = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'staging', // Wrong - not first in branchFlow
        finalBranch: 'main',
        branchFlow: ['develop', 'staging', 'main'],
        domains: {
          api: { paths: ['apps/**'], description: 'API' }
        }
      }
      writeFileSync(join(testDir, '.pipecraftrc'), JSON.stringify(config))

      const result = spawnSync('node', [cliPath, 'generate', '--skip-checks'], {
        cwd: testDir,
        encoding: 'utf8',
        timeout: 30000
      })

      expect(result.status).toBe(1)
      expect(result.stderr || result.stdout).toContain('initialBranch')
    })
  })

  describe('help and version', () => {
    it('should exit 0 for --help', () => {
      const result = spawnSync('node', [cliPath, '--help'], {
        encoding: 'utf8',
        timeout: 5000
      })

      expect(result.status).toBe(0)
      expect(result.stdout).toContain('pipecraft')
    })

    it('should exit 0 for --version', () => {
      const result = spawnSync('node', [cliPath, '--version'], {
        encoding: 'utf8',
        timeout: 5000
      })

      expect(result.status).toBe(0)
      // Should output a version string
      expect(result.stdout).toMatch(/\d+\.\d+/)
    })
  })

  describe('unknown command', () => {
    it('should exit 1 for unknown command', () => {
      const result = spawnSync('node', [cliPath, 'nonexistent-command'], {
        encoding: 'utf8',
        timeout: 5000
      })

      expect(result.status).toBe(1)
    })
  })
})
