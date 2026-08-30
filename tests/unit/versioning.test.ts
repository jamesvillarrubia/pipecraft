import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PipecraftConfig } from '../../src/types'
import { VersionManager } from '../../src/utils/versioning'
import { cleanupTestWorkspace, createPipecraftWorkspace, inWorkspace } from '../helpers/workspace'
import { FIXTURES_DIR } from '../setup'

// Mock execSync
vi.mock('child_process', () => ({
  execSync: vi.fn()
}))

describe('VersionManager', () => {
  let config: PipecraftConfig
  let versionManager: VersionManager
  let mockExecSync: any

  beforeEach(async () => {
    // Load test config
    const configPath = join(FIXTURES_DIR, 'basic-config.json')
    const configContent = readFileSync(configPath, 'utf8')
    config = JSON.parse(configContent)

    versionManager = new VersionManager(config)

    // Get mock execSync
    const { execSync } = await import('child_process')
    mockExecSync = execSync as any
    mockExecSync.mockClear()
  })

  describe('generateReleaseItConfig', () => {
    it('should generate valid release-it configuration', () => {
      const configString = versionManager.generateReleaseItConfig()

      // The config is emitted as JS source (not JSON) so the whatBump function survives,
      // so assert on the keys themselves rather than on JSON quoting.
      expect(configString).toContain('module.exports =')
      expect(configString).toContain('git')
      expect(configString).toContain('github')
      expect(configString).toContain('npm')
      expect(configString).toContain('plugins')
    })

    it('should generate config with custom bump rules', () => {
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
          docs: 'patch'
        }
      }

      const manager = new VersionManager(config)
      const configString = manager.generateReleaseItConfig()

      expect(configString).toContain('module.exports =')
      expect(configString).toContain('@release-it/conventional-changelog')
      // The rules must actually reach the file — see versioning-bump-rules.test.ts for
      // the semver-vs-versioning precedence this fell back to here.
      expect(configString).toMatch(/docs:\s*'patch'/)
    })
  })

  describe('generateCommitlintConfig', () => {
    it('should generate valid commitlint configuration', () => {
      const configString = versionManager.generateCommitlintConfig()

      expect(configString).toContain('module.exports =')
      expect(configString).toContain('extends:')
      expect(configString).toContain('rules:')
      expect(configString).toContain('type-enum')
      expect(configString).toContain('feat')
      expect(configString).toContain('fix')
    })
  })

  describe('generateHuskyConfig', () => {
    it('should generate valid husky configuration', () => {
      const configString = versionManager.generateHuskyConfig()

      expect(configString).toContain('#!/usr/bin/env sh')
      expect(configString).toContain('husky.sh')
      expect(configString).toContain('commitlint')
    })
  })

  describe('getCurrentVersion', () => {
    it('should return current version from git tags', () => {
      mockExecSync.mockReturnValue('v1.2.3\n')

      const version = versionManager.getCurrentVersion()

      expect(version).toBe('1.2.3')
      expect(mockExecSync).toHaveBeenCalledWith('git describe --tags --abbrev=0', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      })
    })

    it('should return default version when no tags exist', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('No tags found')
      })

      const version = versionManager.getCurrentVersion()

      expect(version).toBe('0.0.0')
    })
  })

  describe('validateConventionalCommits', () => {
    it('should return true for valid conventional commits', () => {
      const validCommits = [
        'feat: add new feature',
        'fix: resolve bug',
        'docs: update documentation',
        'style: format code',
        'refactor: improve code structure',
        'perf: optimize performance',
        'test: add unit tests',
        'build: update build process',
        'ci: update CI configuration',
        'chore: update dependencies'
      ].join('\n')

      mockExecSync.mockReturnValue(validCommits)

      const isValid = versionManager.validateConventionalCommits()

      expect(isValid).toBe(true)
    })

    it('should return false for invalid conventional commits', () => {
      const invalidCommits = [
        'add new feature',
        'fix bug',
        'update docs',
        'random commit message'
      ].join('\n')

      mockExecSync.mockReturnValue(invalidCommits)

      const isValid = versionManager.validateConventionalCommits()

      expect(isValid).toBe(false)
    })

    it('should handle git command errors', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Git command failed')
      })

      const isValid = versionManager.validateConventionalCommits()

      expect(isValid).toBe(false)
    })
  })

  describe('calculateNextVersion', () => {
    it('should calculate next version from release-it', () => {
      const releaseItOutput = `
        version 1.2.4
        bump patch
        There are 0 BREAKING CHANGES and 0 features
      `

      mockExecSync.mockReturnValue(releaseItOutput)

      const result = versionManager.calculateNextVersion()

      expect(result.version).toBe('1.2.4')
      expect(result.type).toBe('patch')
    })

    it('should handle release-it errors gracefully', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Release-it failed')
      })

      const result = versionManager.calculateNextVersion()

      expect(result.version).toBe('0.0.0')
      expect(result.type).toBe('patch')
    })
  })

  describe('setupVersionManagement', () => {
    let workspace: string

    afterEach(() => {
      if (workspace) {
        cleanupTestWorkspace(workspace)
      }
    })

    it('should create version management files when enabled', async () => {
      // Create isolated workspace for this test
      workspace = createPipecraftWorkspace('versioning-test')

      config.versioning = {
        enabled: true,
        releaseItConfig: '.release-it.cjs',
        conventionalCommits: true,
        autoTag: true,
        autoPush: true,
        changelog: true,
        bumpRules: {}
      }

      const manager = new VersionManager(config)

      // Mock execSync for husky install
      mockExecSync.mockReturnValue('')

      // Run setupVersionManagement in the isolated workspace context
      await inWorkspace(workspace, () => {
        manager.setupVersionManagement()
      })

      // Check if files were created in the workspace
      expect(existsSync(join(workspace, '.release-it.cjs'))).toBe(true)
      expect(existsSync(join(workspace, 'commitlint.config.js'))).toBe(true)
      expect(existsSync(join(workspace, '.husky/commit-msg'))).toBe(true)
    })

    it('should not create files when versioning is disabled', async () => {
      // Create isolated workspace for this test
      workspace = createPipecraftWorkspace('versioning-test-disabled')

      config.versioning = {
        enabled: false,
        releaseItConfig: '.release-it.cjs',
        conventionalCommits: true,
        autoTag: true,
        autoPush: true,
        changelog: true,
        bumpRules: {}
      }

      const manager = new VersionManager(config)

      // Run setupVersionManagement in the isolated workspace context
      await inWorkspace(workspace, () => {
        manager.setupVersionManagement()
      })

      // Check if files were not created in the workspace
      expect(existsSync(join(workspace, '.release-it.cjs'))).toBe(false)
      expect(existsSync(join(workspace, 'commitlint.config.js'))).toBe(false)
    })
  })
})
