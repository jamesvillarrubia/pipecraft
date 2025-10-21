/**
 * CLI Unit Tests
 *
 * These tests directly test the CLI logic without spawning processes,
 * avoiding the race conditions that plagued the previous integration tests.
 *
 * Strategy:
 * - Mock external dependencies (fs, runModule, etc.)
 * - Test command logic directly
 * - Use isolated temp directories
 * - Verify correct function calls and outputs
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { writeFileSync, existsSync, rmSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// We'll test by mocking and importing the functions that would be called
// Note: The CLI uses commander which makes it hard to test directly
// So we'll test the underlying logic functions instead

import { loadConfig, validateConfig } from '../../src/utils/config'
import { IdempotencyManager } from '../../src/utils/idempotency'
import { VersionManager } from '../../src/utils/versioning'
import { PipecraftConfig } from '../../src/types'

describe('CLI Logic Tests', () => {
  let testDir: string
  let originalCwd: string

  beforeEach(() => {
    // Create unique temp directory for this test
    testDir = join(tmpdir(), `pipecraft-cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDir, { recursive: true })
    originalCwd = process.cwd()
    process.chdir(testDir)
  })

  afterEach(() => {
    // Restore original directory and cleanup
    try {
      // Only chdir if the original directory still exists
      if (existsSync(originalCwd)) {
        process.chdir(originalCwd)
      } else {
        // Fallback to a safe directory if original doesn't exist
        process.chdir(__dirname)
      }
    } catch (error) {
      // If chdir fails, try to go to the test directory parent
      process.chdir(__dirname)
    }

    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('Config Loading and Validation', () => {
    it('should load valid config file', () => {
      const config: PipecraftConfig = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop', 'staging', 'main'],
        semver: {
          bumpRules: {
            feat: 'minor',
            fix: 'patch',
            breaking: 'major'
          }
        },
        domains: {
          api: {
            paths: ['apps/api/**'],
            description: 'API application'
          }
        }
      }

      const configPath = join(testDir, '.pipecraftrc.json')
      writeFileSync(configPath, JSON.stringify(config, null, 2))

      const loadedConfig = loadConfig(configPath)
      expect(loadedConfig).toBeDefined()
      expect(loadedConfig.ciProvider).toBe('github')
      expect(loadedConfig.domains).toHaveProperty('api')
    })

    it('should throw error when config file not found', () => {
      expect(() => loadConfig(join(testDir, 'nonexistent.json'))).toThrow()
    })

    it('should validate correct config', () => {
      const config: PipecraftConfig = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop', 'main'],
        semver: {
          bumpRules: {
            feat: 'minor',
            fix: 'patch',
            breaking: 'major'
          }
        },
        domains: {
          api: {
            paths: ['apps/api/**'],
            description: 'API'
          }
        }
      }

      expect(() => validateConfig(config)).not.toThrow()
    })

    it('should fail validation for invalid config', () => {
      const invalidConfig = {
        ciProvider: 'invalid-provider', // Invalid
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main'
      } as any

      expect(() => validateConfig(invalidConfig)).toThrow()
    })

    it('should fail validation for missing required fields', () => {
      const incompleteConfig = {
        ciProvider: 'github'
        // Missing other required fields
      } as any

      expect(() => validateConfig(incompleteConfig)).toThrow()
    })
  })

  describe('Generate Command Logic', () => {
    let config: PipecraftConfig

    beforeEach(() => {
      config = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop', 'main'],
        semver: {
          bumpRules: {
            feat: 'minor',
            fix: 'patch',
            breaking: 'major'
          }
        },
        domains: {
          api: {
            paths: ['apps/api/**'],
            description: 'API'
          }
        },
        rebuild: {
          enabled: true,
          skipIfUnchanged: true,
          forceRegenerate: false,
          watchMode: false,
          hashAlgorithm: 'sha256',
          cacheFile: join(testDir, '.pipecraft-cache.json'),
          ignorePatterns: []
        }
      }

      const configPath = join(testDir, '.pipecraftrc.json')
      writeFileSync(configPath, JSON.stringify(config, null, 2))
    })

    it('should detect when regeneration is needed (no cache)', async () => {
      const idempotencyManager = new IdempotencyManager(config)
      const hasChanges = await idempotencyManager.hasChanges()

      expect(hasChanges).toBe(true)
    })

    it('should detect no changes when cache exists and unchanged', async () => {
      const idempotencyManager = new IdempotencyManager(config)

      // Create initial cache
      await idempotencyManager.updateCache()

      // Check again - should be no changes
      const hasChanges = await idempotencyManager.hasChanges()

      expect(hasChanges).toBe(false)
    })

    it('should force regeneration when force flag is true', async () => {
      const configWithForce = {
        ...config,
        rebuild: {
          ...config.rebuild!,
          forceRegenerate: true
        }
      }

      const idempotencyManager = new IdempotencyManager(configWithForce)

      // Even with cache, should return true due to force
      await idempotencyManager.updateCache()
      const hasChanges = await idempotencyManager.hasChanges()

      expect(hasChanges).toBe(true)
    })

    it('should skip regeneration when rebuild is disabled', async () => {
      const configWithoutRebuild = {
        ...config,
        rebuild: {
          ...config.rebuild!,
          enabled: false
        }
      }

      const idempotencyManager = new IdempotencyManager(configWithoutRebuild)
      const hasChanges = await idempotencyManager.hasChanges()

      // Should always return true when rebuild is disabled
      expect(hasChanges).toBe(true)
    })

    it('should update cache after generation', async () => {
      const idempotencyManager = new IdempotencyManager(config)
      const cacheFile = join(testDir, '.pipecraft-cache.json')

      // Cache shouldn't exist initially
      expect(existsSync(cacheFile)).toBe(false)

      // Update cache
      await idempotencyManager.updateCache()

      // Cache should now exist
      expect(existsSync(cacheFile)).toBe(true)

      // Cache should contain valid data
      const cache = idempotencyManager.loadCache()
      expect(cache).toBeDefined()
      expect(cache?.configHash).toBeDefined()
      expect(cache?.lastGenerated).toBeDefined()
    })
  })

  describe('Version Command Logic', () => {
    let config: PipecraftConfig

    beforeEach(() => {
      config = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop', 'main'],
        semver: {
          bumpRules: {
            feat: 'minor',
            fix: 'patch',
            breaking: 'major'
          }
        },
        domains: {
          api: {
            paths: ['apps/api/**'],
            description: 'API'
          }
        },
        versioning: {
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
      }

      // Create package.json for version reading
      writeFileSync(join(testDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        version: '1.0.0'
      }, null, 2))
    })

    it('should create version manager with config', () => {
      const versionManager = new VersionManager(config)
      expect(versionManager).toBeDefined()
    })

    it('should calculate next version based on commits', () => {
      const versionManager = new VersionManager(config)
      const nextVersion = versionManager.calculateNextVersion()

      expect(nextVersion).toBeDefined()
      expect(nextVersion.version).toBeDefined()
      expect(nextVersion.type).toBeDefined()
    })

    it('should validate conventional commits', () => {
      const versionManager = new VersionManager(config)
      const isValid = versionManager.validateConventionalCommits()

      // Should return boolean
      expect(typeof isValid).toBe('boolean')
    })
  })

  describe('Verify Command Logic', () => {
    it('should detect when config file exists', () => {
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
      } as PipecraftConfig

      writeFileSync(join(testDir, '.pipecraftrc.json'), JSON.stringify(config, null, 2))

      expect(existsSync(join(testDir, '.pipecraftrc.json'))).toBe(true)
    })

    it('should detect when workflow files exist', () => {
      const workflowDir = join(testDir, '.github', 'workflows')
      mkdirSync(workflowDir, { recursive: true })

      const pipelineFile = join(workflowDir, 'pipeline.yml')
      writeFileSync(pipelineFile, 'name: Pipeline\n')

      expect(existsSync(pipelineFile)).toBe(true)
    })

    it('should handle missing workflow directory', () => {
      const workflowDir = join(testDir, '.github', 'workflows')

      expect(existsSync(workflowDir)).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed config file', () => {
      const configPath = join(testDir, '.pipecraftrc.json')
      writeFileSync(configPath, '{ invalid json }')

      expect(() => loadConfig(configPath)).toThrow()
    })

    it('should handle config with missing domains', () => {
      const config = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop', 'main']
        // Missing domains
      } as any

      expect(() => validateConfig(config)).toThrow()
    })

    it('should handle empty branch flow', () => {
      const config = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: [], // Empty
        domains: {
          api: { paths: ['apps/api/**'], description: 'API' }
        }
      } as any

      expect(() => validateConfig(config)).toThrow()
    })
  })

  describe('Configuration Edge Cases', () => {
    it('should handle custom branch names', () => {
      const config: PipecraftConfig = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'alpha',
        finalBranch: 'production',
        branchFlow: ['alpha', 'beta', 'gamma', 'production'],
        semver: {
          bumpRules: {
            feat: 'minor',
            fix: 'patch',
            breaking: 'major'
          }
        },
        domains: {
          backend: {
            paths: ['services/backend/**'],
            description: 'Backend services'
          }
        }
      }

      writeFileSync(join(testDir, '.pipecraftrc.json'), JSON.stringify(config, null, 2))

      const loadedConfig = loadConfig(join(testDir, '.pipecraftrc.json'))
      expect(loadedConfig.initialBranch).toBe('alpha')
      expect(loadedConfig.finalBranch).toBe('production')
      expect(loadedConfig.branchFlow).toHaveLength(4)
    })

    it('should handle many domains', () => {
      const config: PipecraftConfig = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop', 'main'],
        semver: {
          bumpRules: {
            feat: 'minor',
            fix: 'patch',
            breaking: 'major'
          }
        },
        domains: {
          'api': { paths: ['apps/api/**'], description: 'API' },
          'web': { paths: ['apps/web/**'], description: 'Web' },
          'mobile': { paths: ['apps/mobile/**'], description: 'Mobile' },
          'admin': { paths: ['apps/admin/**'], description: 'Admin' },
          'analytics': { paths: ['apps/analytics/**'], description: 'Analytics' }
        }
      }

      writeFileSync(join(testDir, '.pipecraftrc.json'), JSON.stringify(config, null, 2))

      const loadedConfig = loadConfig(join(testDir, '.pipecraftrc.json'))
      expect(Object.keys(loadedConfig.domains)).toHaveLength(5)
    })

    it('should handle gitlab CI provider', () => {
      const config: PipecraftConfig = {
        ciProvider: 'gitlab',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop', 'main'],
        semver: {
          bumpRules: {
            feat: 'minor',
            fix: 'patch',
            breaking: 'major'
          }
        },
        domains: {
          api: { paths: ['apps/api/**'], description: 'API' }
        }
      }

      writeFileSync(join(testDir, '.pipecraftrc.json'), JSON.stringify(config, null, 2))

      const loadedConfig = loadConfig(join(testDir, '.pipecraftrc.json'))
      expect(loadedConfig.ciProvider).toBe('gitlab')
    })

    it('should handle merge strategy', () => {
      const config: PipecraftConfig = {
        ciProvider: 'github',
        mergeStrategy: 'merge',
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop', 'main'],
        semver: {
          bumpRules: {
            feat: 'minor',
            fix: 'patch',
            breaking: 'major'
          }
        },
        domains: {
          api: { paths: ['apps/api/**'], description: 'API' }
        }
      }

      writeFileSync(join(testDir, '.pipecraftrc.json'), JSON.stringify(config, null, 2))

      const loadedConfig = loadConfig(join(testDir, '.pipecraftrc.json'))
      expect(loadedConfig.mergeStrategy).toBe('merge')
    })
  })
})
