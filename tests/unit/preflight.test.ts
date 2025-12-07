/**
 * Comprehensive Preflight Tests
 *
 * Tests all preflight check functionality including:
 * - Individual check functions (config, git, directories, node version)
 * - orchestration via runPreflightChecks()
 * - Result formatting via formatPreflightResults()
 * - Edge cases and error handling
 */

import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkCanWriteGithubDir,
  checkConfigExists,
  checkConfigValid,
  checkHasGitRemote,
  checkInGitRepo,
  checkNodeVersion,
  formatPreflightResults,
  runPreflightChecks
} from '../../src/utils/preflight.js'
import { createMinimalConfig } from '../helpers/fixtures.js'
import { createWorkspaceWithCleanup, inWorkspace } from '../helpers/workspace.js'

// Mock child_process at module level
vi.mock('child_process', async () => {
  const actual = await vi.importActual('child_process')
  return {
    ...actual,
    execSync: vi.fn()
  }
})

const mockExecSync = execSync as unknown as ReturnType<typeof vi.fn>

describe('Preflight Checks', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('pipecraft-preflight')

    // Reset mock before each test
    mockExecSync.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  describe('checkConfigExists()', () => {
    it('should pass when .pipecraftrc exists', async () => {
      const config = createMinimalConfig()

      await inWorkspace(workspace, () => {
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        const result = checkConfigExists()
        expect(result.passed).toBe(true)
        expect(result.message).toContain('Configuration found')
        expect(result.message).toContain('.pipecraftrc')
      })
    })

    it('should pass when .pipecraftrc exists', async () => {
      const config = createMinimalConfig()

      await inWorkspace(workspace, () => {
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        const result = checkConfigExists()
        expect(result.passed).toBe(true)
        expect(result.message).toContain('Configuration found')
      })
    })

    it('should pass when config in package.json', async () => {
      const config = createMinimalConfig()

      await inWorkspace(workspace, () => {
        writeFileSync(
          'package.json',
          JSON.stringify(
            {
              name: 'test',
              pipecraft: config
            },
            null,
            2
          )
        )

        const result = checkConfigExists()
        expect(result.passed).toBe(true)
        expect(result.message).toContain('Configuration found')
      })
    })

    it('should fail when no config exists', async () => {
      await inWorkspace(workspace, () => {
        const result = checkConfigExists()
        expect(result.passed).toBe(false)
        expect(result.message).toContain('No PipeCraft configuration found')
        expect(result.suggestion).toContain('pipecraft init')
      })
    })
  })

  describe('checkConfigValid()', () => {
    it('should pass with valid config', async () => {
      const config = createMinimalConfig()

      await inWorkspace(workspace, () => {
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        const result = checkConfigValid()
        expect(result.passed).toBe(true)
        expect(result.message).toBe('Configuration is valid')
      })
    })

    it('should fail when config file does not exist', async () => {
      await inWorkspace(workspace, () => {
        const result = checkConfigValid()
        expect(result.passed).toBe(false)
        expect(result.message).toContain('No configuration file found')
        expect(result.suggestion).toContain('pipecraft init')
      })
    })

    it('should fail when config is missing ciProvider', async () => {
      const config = createMinimalConfig()
      delete (config as any).ciProvider

      await inWorkspace(workspace, () => {
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        const result = checkConfigValid()
        expect(result.passed).toBe(false)
        expect(result.message).toContain('missing required fields')
        expect(result.message).toContain('ciProvider')
      })
    })

    it('should fail when config is missing branchFlow', async () => {
      const config = createMinimalConfig()
      delete (config as any).branchFlow

      await inWorkspace(workspace, () => {
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        const result = checkConfigValid()
        expect(result.passed).toBe(false)
        expect(result.message).toContain('missing required fields')
        expect(result.message).toContain('branchFlow')
      })
    })

    it('should fail when config is missing domains', async () => {
      const config = createMinimalConfig()
      delete (config as any).domains

      await inWorkspace(workspace, () => {
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        const result = checkConfigValid()
        expect(result.passed).toBe(false)
        expect(result.message).toContain('missing required fields')
        expect(result.message).toContain('domains')
      })
    })

    it('should fail when config has empty domains', async () => {
      const config = {
        ...createMinimalConfig(),
        domains: {}
      }

      await inWorkspace(workspace, () => {
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        const result = checkConfigValid()
        expect(result.passed).toBe(false)
        expect(result.message).toContain('no domains configured')
        expect(result.suggestion).toContain('Add at least one domain')
      })
    })

    it('should handle malformed JSON', async () => {
      await inWorkspace(workspace, () => {
        writeFileSync('.pipecraftrc', '{ invalid json }')

        // Function should gracefully catch and return error result
        const result = checkConfigValid()
        expect(result.passed).toBe(false)
        expect(result.message.toLowerCase()).toContain('config')
      })
    })
  })

  describe('checkInGitRepo()', () => {
    it('should pass when in a git repository', async () => {
      mockExecSync.mockReturnValue('true')

      await inWorkspace(workspace, () => {
        const result = checkInGitRepo()
        expect(result.passed).toBe(true)
        expect(result.message).toContain('git repository')
        expect(mockExecSync).toHaveBeenCalledWith(
          'git rev-parse --is-inside-work-tree',
          expect.objectContaining({
            stdio: ['pipe', 'pipe', 'ignore']
          })
        )
      })
    })

    it('should fail when not in a git repository', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('not a git repository')
      })

      await inWorkspace(workspace, () => {
        const result = checkInGitRepo()
        expect(result.passed).toBe(false)
        expect(result.message).toContain('Not in a git repository')
        expect(result.suggestion).toContain('git init')
      })
    })
  })

  describe('checkHasGitRemote()', () => {
    it('should pass with GitHub remote', async () => {
      mockExecSync.mockReturnValue('https://github.com/user/repo.git')

      await inWorkspace(workspace, () => {
        const result = checkHasGitRemote()
        expect(result.passed).toBe(true)
        expect(result.message).toContain('Git remote configured')
        expect(result.message).toContain('github.com')
        expect(result.suggestion).toBeUndefined() // No warning for GitHub
      })
    })

    it('should pass with GitLab remote but show warning', async () => {
      mockExecSync.mockReturnValue('https://gitlab.com/user/repo.git')

      await inWorkspace(workspace, () => {
        const result = checkHasGitRemote()
        expect(result.passed).toBe(true)
        expect(result.message).toContain('Git remote configured')
        expect(result.message).toContain('gitlab.com')
        expect(result.suggestion).toContain('GitLab support is experimental')
      })
    })

    it('should fail when no remote configured', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('No such remote')
      })

      await inWorkspace(workspace, () => {
        const result = checkHasGitRemote()
        expect(result.passed).toBe(false)
        expect(result.message).toContain('No git remote')
        expect(result.suggestion).toContain('git remote add origin')
      })
    })

    it('should fail when remote is empty', async () => {
      mockExecSync.mockReturnValue('')

      await inWorkspace(workspace, () => {
        const result = checkHasGitRemote()
        expect(result.passed).toBe(false)
        // This matches the actual error message in the code
        expect(result.message).toMatch(/No git remote/)
      })
    })
  })

  describe('checkCanWriteGithubDir()', () => {
    it('should pass and create directory if not exists', async () => {
      await inWorkspace(workspace, () => {
        const result = checkCanWriteGithubDir()
        expect(result.passed).toBe(true)
        expect(result.message).toContain('Created .github/workflows directory')
      })
    })

    it('should pass when directory exists and is writable', async () => {
      const { mkdirSync, existsSync } = require('fs')
      const { join } = require('path')

      await inWorkspace(workspace, () => {
        // Pre-create the directory
        mkdirSync(join('.github', 'workflows'), { recursive: true })

        const result = checkCanWriteGithubDir()
        expect(result.passed).toBe(true)
        expect(result.message).toContain('writable')
      })
    })

    // Note: Testing write permission failures is difficult without OS-level permission manipulation
    // In a real scenario, this would fail if the directory has no write permissions
  })

  describe('checkNodeVersion()', () => {
    it('should pass with Node 18+', () => {
      // Current Node version running tests should be >= 18
      const result = checkNodeVersion('18.0.0')
      expect(result.passed).toBe(true)
      expect(result.message).toContain('Node.js')
      expect(result.message).toMatch(/\d+\.\d+\.\d+/)
    })

    it('should pass with Node version equal to minimum', () => {
      // Mock process.version
      const originalVersion = process.version
      Object.defineProperty(process, 'version', {
        value: 'v18.0.0',
        writable: true,
        configurable: true
      })

      const result = checkNodeVersion('18.0.0')
      expect(result.passed).toBe(true)

      // Restore
      Object.defineProperty(process, 'version', {
        value: originalVersion,
        writable: true,
        configurable: true
      })
    })

    it('should fail with Node version below minimum', () => {
      // Mock process.version
      const originalVersion = process.version
      Object.defineProperty(process, 'version', {
        value: 'v16.20.0',
        writable: true,
        configurable: true
      })

      const result = checkNodeVersion('18.0.0')
      expect(result.passed).toBe(false)
      expect(result.message).toContain('too old')
      expect(result.message).toContain('16.20.0')
      expect(result.suggestion).toContain('nodejs.org')

      // Restore
      Object.defineProperty(process, 'version', {
        value: originalVersion,
        writable: true,
        configurable: true
      })
    })

    it('should handle different minimum versions', () => {
      const originalVersion = process.version
      Object.defineProperty(process, 'version', {
        value: 'v20.0.0',
        writable: true,
        configurable: true
      })

      // Should pass 18 requirement
      expect(checkNodeVersion('18.0.0').passed).toBe(true)

      // Should pass 20 requirement
      expect(checkNodeVersion('20.0.0').passed).toBe(true)

      // Should fail 22 requirement
      expect(checkNodeVersion('22.0.0').passed).toBe(false)

      // Restore
      Object.defineProperty(process, 'version', {
        value: originalVersion,
        writable: true,
        configurable: true
      })
    })
  })

  describe('runPreflightChecks()', () => {
    it('should run all checks and return results', async () => {
      const config = createMinimalConfig()
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('rev-parse')) return 'true'
        if (cmd.includes('remote')) return 'https://github.com/user/repo.git'
        if (cmd.includes('branch')) return 'main'
        return ''
      })

      await inWorkspace(workspace, () => {
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        const results = runPreflightChecks()

        // Should have all required checks
        expect(results.configExists).toBeDefined()
        expect(results.configValid).toBeDefined()
        expect(results.inGitRepo).toBeDefined()
        expect(results.hasGitRemote).toBeDefined()
        expect(results.canWriteGithubDir).toBeDefined()

        // All should pass in this scenario
        expect(results.configExists.passed).toBe(true)
        expect(results.configValid.passed).toBe(true)
        expect(results.inGitRepo.passed).toBe(true)
        expect(results.hasGitRemote.passed).toBe(true)
        expect(results.canWriteGithubDir.passed).toBe(true)
      })
    })

    it('should return failed checks when environment is not ready', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not in git repo')
      })

      await inWorkspace(workspace, () => {
        // No config file, not in git repo
        const results = runPreflightChecks()

        expect(results.configExists.passed).toBe(false)
        expect(results.configValid.passed).toBe(false)
        expect(results.inGitRepo.passed).toBe(false)
        expect(results.hasGitRemote.passed).toBe(false)
        // Directory check should still pass (it creates the dir)
        expect(results.canWriteGithubDir.passed).toBe(true)
      })
    })
  })

  describe('formatPreflightResults()', () => {
    it('should format all passing checks', async () => {
      const config = createMinimalConfig()
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('rev-parse')) return 'true'
        if (cmd.includes('remote')) return 'https://github.com/user/repo.git'
        if (cmd.includes('branch')) return 'main'
        return ''
      })

      await inWorkspace(workspace, () => {
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        const checks = runPreflightChecks()
        const { allPassed, output, nextSteps } = formatPreflightResults(checks)

        expect(allPassed).toBe(true)
        expect(output).toContain('✅')
        expect(output).not.toContain('❌')
        expect(nextSteps).toBeDefined()
        expect(nextSteps?.join('\n')).toContain('Your environment is ready')
      })
    })

    it('should format failing checks with suggestions', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not in git repo')
      })

      await inWorkspace(workspace, () => {
        const checks = runPreflightChecks()
        const { allPassed, output, nextSteps } = formatPreflightResults(checks)

        expect(allPassed).toBe(false)
        expect(output).toContain('❌')
        expect(output).toContain('💡') // Suggestion icon
        expect(output).toContain('pipecraft init')
        expect(output).toContain('git init')
        expect(nextSteps).toBeUndefined() // No next steps when checks fail
      })
    })

    it('should include next steps with correct branch name', async () => {
      const config = createMinimalConfig()
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('rev-parse')) return 'true'
        if (cmd.includes('remote')) return 'https://github.com/user/repo.git'
        if (cmd.includes('branch')) return 'develop'
        return ''
      })

      await inWorkspace(workspace, () => {
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        const checks = runPreflightChecks()
        const { nextSteps } = formatPreflightResults(checks)

        expect(nextSteps).toBeDefined()
        expect(nextSteps?.join('\n')).toContain('git push')
      })
    })

    it('should handle mixed pass/fail results', async () => {
      const config = createMinimalConfig()
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('rev-parse')) return 'true' // Git repo exists
        if (cmd.includes('remote')) throw new Error('No remote') // But no remote
        return ''
      })

      await inWorkspace(workspace, () => {
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        const checks = runPreflightChecks()
        const { allPassed, output } = formatPreflightResults(checks)

        expect(allPassed).toBe(false)
        expect(output).toContain('✅') // Some checks pass
        expect(output).toContain('❌') // Some checks fail
      })
    })

    it('should include validate:pipeline suggestion when script exists', async () => {
      const config = createMinimalConfig()
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('rev-parse')) return 'true'
        if (cmd.includes('remote')) return 'https://github.com/user/repo.git'
        if (cmd.includes('branch')) return 'main'
        return ''
      })

      await inWorkspace(workspace, () => {
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))
        writeFileSync(
          'package.json',
          JSON.stringify(
            {
              name: 'test',
              scripts: {
                'validate:pipeline': 'echo validate'
              }
            },
            null,
            2
          )
        )

        const checks = runPreflightChecks()
        const { nextSteps } = formatPreflightResults(checks)

        expect(nextSteps).toBeDefined()
        const stepsText = nextSteps?.join('\n') || ''
        expect(stepsText).toContain('validate:pipeline')
        expect(stepsText).toContain('Check YAML is valid')
      })
    })

    it('should exclude validate:pipeline suggestion when script does not exist', async () => {
      const config = createMinimalConfig()
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('rev-parse')) return 'true'
        if (cmd.includes('remote')) return 'https://github.com/user/repo.git'
        if (cmd.includes('branch')) return 'main'
        return ''
      })

      await inWorkspace(workspace, () => {
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))
        writeFileSync(
          'package.json',
          JSON.stringify(
            {
              name: 'test',
              scripts: {
                test: 'echo test'
              }
            },
            null,
            2
          )
        )

        const checks = runPreflightChecks()
        const { nextSteps } = formatPreflightResults(checks)

        expect(nextSteps).toBeDefined()
        const stepsText = nextSteps?.join('\n') || ''
        expect(stepsText).not.toContain('validate:pipeline')
      })
    })

    it('should exclude validate:pipeline suggestion when no package.json exists', async () => {
      const config = createMinimalConfig()
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('rev-parse')) return 'true'
        if (cmd.includes('remote')) return 'https://github.com/user/repo.git'
        if (cmd.includes('branch')) return 'main'
        return ''
      })

      await inWorkspace(workspace, () => {
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))
        // No package.json created

        const checks = runPreflightChecks()
        const { nextSteps } = formatPreflightResults(checks)

        expect(nextSteps).toBeDefined()
        const stepsText = nextSteps?.join('\n') || ''
        expect(stepsText).not.toContain('validate:pipeline')
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle config with multiple missing fields', async () => {
      await inWorkspace(workspace, () => {
        writeFileSync(
          '.pipecraftrc',
          JSON.stringify(
            {
              // Missing all required fields
            },
            null,
            2
          )
        )

        const result = checkConfigValid()
        expect(result.passed).toBe(false)
        expect(result.message).toContain('missing required fields')
        // Should list all missing fields
        expect(result.message).toContain('ciProvider')
        expect(result.message).toContain('branchFlow')
        expect(result.message).toContain('domains')
      })
    })

    it('should handle execSync errors gracefully', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command failed')
      })

      await inWorkspace(workspace, () => {
        const gitRepoResult = checkInGitRepo()
        expect(gitRepoResult.passed).toBe(false)

        const gitRemoteResult = checkHasGitRemote()
        expect(gitRemoteResult.passed).toBe(false)
      })
    })
  })
})
