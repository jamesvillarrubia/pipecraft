import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, existsSync, rmSync, readFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { IdempotencyManager } from '../../src/utils/idempotency'
import { FlowcraftConfig } from '../../src/types'
import { TEST_DIR, FIXTURES_DIR } from '../setup'

describe('IdempotencyManager', () => {
  let config: FlowcraftConfig
  let idempotencyManager: IdempotencyManager

  beforeEach(() => {
    // Load test config
    const configPath = join(FIXTURES_DIR, 'basic-config.json')
    const configContent = readFileSync(configPath, 'utf8')
    config = JSON.parse(configContent)
    
    idempotencyManager = new IdempotencyManager(config, join(TEST_DIR, '.flowcraft-cache.json'))
  })

  afterEach(() => {
    // Clean up cache file
    const cacheFile = join(TEST_DIR, '.flowcraft-cache.json')
    try {
      if (existsSync(cacheFile)) {
        rmSync(cacheFile)
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('calculateHash', () => {
    it('should calculate hash for existing file', async () => {
      const testFile = join(TEST_DIR, 'test.txt')
      writeFileSync(testFile, 'test content')
      
      const hash = await idempotencyManager.calculateHash(testFile)
      
      expect(hash).toBeDefined()
      expect(hash).toMatch(/^[a-f0-9]{64}$/) // SHA256 hash
    })

    it('should return empty string for non-existent file', async () => {
      const hash = await idempotencyManager.calculateHash('non-existent-file.txt')
      
      expect(hash).toBe('')
    })

    it('should calculate different hashes for different content', async () => {
      const file1 = join(TEST_DIR, 'file1.txt')
      const file2 = join(TEST_DIR, 'file2.txt')
      
      writeFileSync(file1, 'content 1')
      writeFileSync(file2, 'content 2')
      
      const hash1 = await idempotencyManager.calculateHash(file1)
      const hash2 = await idempotencyManager.calculateHash(file2)
      
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('hasChanges', () => {
    it('should return true when rebuild is disabled', async () => {
      config.rebuild = { enabled: false, skipIfUnchanged: true, forceRegenerate: false, watchMode: false, hashAlgorithm: 'sha256', cacheFile: '.flowcraft-cache.json', ignorePatterns: [] }
      const manager = new IdempotencyManager(config)
      
      expect(await manager.hasChanges()).toBe(true)
    })

    it('should return true when forceRegenerate is enabled', async () => {
      config.rebuild = { enabled: true, skipIfUnchanged: true, forceRegenerate: true, watchMode: false, hashAlgorithm: 'sha256', cacheFile: '.flowcraft-cache.json', ignorePatterns: [] }
      const manager = new IdempotencyManager(config)
      
      expect(await manager.hasChanges()).toBe(true)
    })

    it('should return true when no cache exists', async () => {
      config.rebuild = { enabled: true, skipIfUnchanged: true, forceRegenerate: false, watchMode: false, hashAlgorithm: 'sha256', cacheFile: '.flowcraft-cache.json', ignorePatterns: [] }
      const manager = new IdempotencyManager(config)
      
      expect(await manager.hasChanges()).toBe(true)
    })

    it('should return false when no changes detected', async () => {
      // Create a config file
      const configFile = join(TEST_DIR, '.flowcraftrc.json')
      writeFileSync(configFile, JSON.stringify(config, null, 2))
      
      // Create mock template and generator directories to avoid checking project root
      const templateDir = join(TEST_DIR, 'src', 'templates')
      const generatorDir = join(TEST_DIR, 'src', 'generators')
      mkdirSync(templateDir, { recursive: true })
      mkdirSync(generatorDir, { recursive: true })
      writeFileSync(join(templateDir, 'test.tpl.ts'), 'export const test = "template"')
      writeFileSync(join(generatorDir, 'test.gen.ts'), 'export const test = "generator"')
      
      // Create cache with current state
      await idempotencyManager.updateCache()
      
      // Small delay to ensure file system operations complete
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // Check for changes (should be false)
      expect(await idempotencyManager.hasChanges()).toBe(false)
    })
  })

  describe('updateCache', () => {
    it('should create cache file', async () => {
      const configFile = join(TEST_DIR, '.flowcraftrc.json')
      writeFileSync(configFile, JSON.stringify(config, null, 2))
      
      await idempotencyManager.updateCache()
      
      const cacheFile = join(TEST_DIR, '.flowcraft-cache.json')
      expect(existsSync(cacheFile)).toBe(true)
    })

    it('should include config hash in cache', async () => {
      const configFile = join(TEST_DIR, '.flowcraftrc.json')
      writeFileSync(configFile, JSON.stringify(config, null, 2))
      
      await idempotencyManager.updateCache()
      
      const cache = idempotencyManager.loadCache()
      expect(cache).toBeDefined()
      expect(cache?.configHash).toBeDefined()
      expect(cache?.lastGenerated).toBeDefined()
    })
  })

  describe('shouldRegenerateFile', () => {
    it('should return true for new file', async () => {
      const testFile = join(TEST_DIR, 'new-file.txt')
      writeFileSync(testFile, 'content')
      
      expect(await idempotencyManager.shouldRegenerateFile(testFile)).toBe(true)
    })

    it('should return true for file not in cache', async () => {
      const testFile = join(TEST_DIR, 'test-file.txt')
      writeFileSync(testFile, 'content')
      
      // Update cache (but won't include our test file since it's not in src/templates or src/generators)
      await idempotencyManager.updateCache()
      
      // Should return true because file is not tracked in cache
      expect(await idempotencyManager.shouldRegenerateFile(testFile)).toBe(true)
    })

    it('should return true for changed file', async () => {
      const testFile = join(TEST_DIR, 'test-file.txt')
      writeFileSync(testFile, 'original content')
      
      // Update cache with original content
      idempotencyManager.updateCache()
      
      // Change file content
      writeFileSync(testFile, 'modified content')
      
      expect(await idempotencyManager.shouldRegenerateFile(testFile)).toBe(true)
    })
  })
})
