import { describe, it, expect, beforeEach } from 'vitest'
import { writeFileSync, existsSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { loadConfig, validateConfig } from '../../src/utils/config'
import { TEST_DIR, FIXTURES_DIR } from '../setup'

describe('Config Utilities', () => {
  beforeEach(() => {
    // Clean up any existing config files
    const configFiles = ['.trunkflowrc.json', '.trunkflowrc', 'package.json']
    configFiles.forEach(file => {
      if (existsSync(join(TEST_DIR, file))) {
        rmSync(join(TEST_DIR, file))
      }
    })
  })

  describe('loadConfig', () => {
    it('should load valid configuration from .trunkflowrc.json', () => {
      const configPath = join(FIXTURES_DIR, 'basic-config.json')
      const configContent = readFileSync(configPath, 'utf8')
      writeFileSync(join(TEST_DIR, '.trunkflowrc.json'), configContent)

      const config = loadConfig()
      
      expect(config).toBeDefined()
      expect(config.ciProvider).toBe('github')
      expect(config.mergeStrategy).toBe('fast-forward')
      expect(config.domains).toHaveProperty('api')
      expect(config.domains).toHaveProperty('web')
    })

    it('should throw error when no config file found', () => {
      expect(() => loadConfig()).toThrow('No configuration file found')
    })

    it('should load config from custom path', () => {
      const configPath = join(FIXTURES_DIR, 'basic-config.json')
      const configContent = readFileSync(configPath, 'utf8')
      const customPath = join(TEST_DIR, 'custom-config.json')
      writeFileSync(customPath, configContent)

      const config = loadConfig(customPath)
      
      expect(config).toBeDefined()
      expect(config.ciProvider).toBe('github')
    })
  })

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      const configPath = join(FIXTURES_DIR, 'basic-config.json')
      const configContent = readFileSync(configPath, 'utf8')
      const config = JSON.parse(configContent)

      expect(() => validateConfig(config)).not.toThrow()
    })

    it('should throw error for missing required fields', () => {
      const config = { ciProvider: 'github' }
      
      expect(() => validateConfig(config)).toThrow('Missing required field: mergeStrategy')
    })

    it('should throw error for invalid ciProvider', () => {
      const config = {
        ciProvider: 'invalid',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop', 'main'],
        domains: { api: { paths: ['apps/api/**'], description: 'API' } }
      }
      
      expect(() => validateConfig(config)).toThrow('ciProvider must be either "github" or "gitlab"')
    })

    it('should throw error for invalid mergeStrategy', () => {
      const config = {
        ciProvider: 'github',
        mergeStrategy: 'invalid',
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop', 'main'],
        domains: { api: { paths: ['apps/api/**'], description: 'API' } }
      }
      
      expect(() => validateConfig(config)).toThrow('mergeStrategy must be either "fast-forward" or "merge"')
    })

    it('should throw error for invalid branchFlow', () => {
      const config = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop'], // Only one branch
        domains: { api: { paths: ['apps/api/**'], description: 'API' } }
      }
      
      expect(() => validateConfig(config)).toThrow('branchFlow must be an array with at least 2 branches')
    })

    it('should throw error for invalid domains', () => {
      const config = {
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop', 'main'],
        domains: {
          api: {
            paths: [], // Empty paths
            description: 'API'
          }
        }
      }
      
      expect(() => validateConfig(config)).toThrow('Domain "api" must have at least one path pattern')
    })
  })
})
