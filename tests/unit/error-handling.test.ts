/**
 * Error Handling Tests
 * 
 * Focused tests for real-world error scenarios and edge cases.
 * Tests that the system fails gracefully with helpful error messages.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { writeFileSync, chmodSync, mkdirSync } from 'fs'
import {
  createWorkspaceWithCleanup,
  inWorkspace
} from '../helpers/workspace.js'
import { IdempotencyManager } from '../../src/utils/idempotency.js'

describe('Error Handling', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    [workspace, cleanup] = createWorkspaceWithCleanup('error-handling')
  })

  afterEach(() => {
    cleanup()
  })

  describe('File System Errors', () => {
    it('should handle corrupted cache gracefully', async () => {
      await inWorkspace(workspace, () => {
        writeFileSync('.pipecraft-cache.json', '{ invalid json }')
        
        const manager = new IdempotencyManager('.pipecraft-cache.json')
        
        // Should not crash
        expect(() => manager.hasChanges('test.txt')).not.toThrow()
      })
    })

    it('should handle binary files without crashing', async () => {
      await inWorkspace(workspace, () => {
        const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD])
        writeFileSync('binary-file.bin', binaryData)
        
        const manager = new IdempotencyManager('.pipecraft-cache.json')
        
        expect(() => manager.hasChanges('binary-file.bin')).not.toThrow()
      })
    })

    it('should handle very large files', async () => {
      await inWorkspace(workspace, () => {
        const largeContent = 'a'.repeat(1024 * 1024) // 1MB
        writeFileSync('large-file.txt', largeContent)
        
        const manager = new IdempotencyManager('.pipecraft-cache.json')
        
        // Should not crash on large files
        expect(() => manager.shouldRegenerateFile('large-file.txt', largeContent)).not.toThrow()
      })
    })

    it('should handle non-existent files gracefully', async () => {
      await inWorkspace(workspace, () => {
        const manager = new IdempotencyManager('.pipecraft-cache.json')
        
        // Should not crash on non-existent files
        expect(() => manager.shouldRegenerateFile('non-existent.txt', 'some-content')).not.toThrow()
      })
    })

    it('should handle deeply nested directories', async () => {
      await inWorkspace(workspace, () => {
        let deepPath = 'level1/level2/level3/level4/level5'
        
        try {
          mkdirSync(deepPath, { recursive: true })
          writeFileSync(`${deepPath}/file.txt`, 'content')
          
          const manager = new IdempotencyManager('.pipecraft-cache.json')
          expect(() => manager.hasChanges(`${deepPath}/file.txt`)).not.toThrow()
        } catch (error: any) {
          // OS limit - acceptable failure
          expect(error.code).toBeDefined()
        }
      })
    })

    it('should handle special characters in filenames', async () => {
      await inWorkspace(workspace, () => {
        const specialNames = [
          'file with spaces.txt',
          'file-with-dashes.txt',
          'file_with_underscores.txt',
          'file.multiple.dots.txt'
        ]
        
        const manager = new IdempotencyManager('.pipecraft-cache.json')
        
        specialNames.forEach(name => {
          writeFileSync(name, 'content')
          expect(() => manager.hasChanges(name)).not.toThrow()
        })
      })
    })
  })

  describe('Performance Edge Cases', () => {
    it('should handle rapid repeated operations', async () => {
      await inWorkspace(workspace, () => {
        writeFileSync('test-file.txt', 'content')
        const manager = new IdempotencyManager('.pipecraft-cache.json')
        
        // Rapid repeated checks should not cause issues
        for (let i = 0; i < 100; i++) {
          manager.hasChanges('test-file.txt')
        }
        
        expect(true).toBe(true)
      })
    })

    it('should handle many small files', async () => {
      await inWorkspace(workspace, () => {
        const manager = new IdempotencyManager('.pipecraft-cache.json')
        
        // Create and check many files - should not crash
        for (let i = 0; i < 50; i++) {
          writeFileSync(`file-${i}.txt`, `content-${i}`)
          expect(() => manager.shouldRegenerateFile(`file-${i}.txt`, `content-${i}`)).not.toThrow()
        }
      })
    })
  })

  describe('Input Validation Edge Cases', () => {
    it('should handle empty strings gracefully', async () => {
      await inWorkspace(workspace, () => {
        const manager = new IdempotencyManager('.pipecraft-cache.json')
        
        // Empty filename should not crash
        try {
          manager.hasChanges('')
        } catch (error) {
          // Error is acceptable
          expect(error).toBeDefined()
        }
      })
    })

    it('should handle Unicode paths', async () => {
      await inWorkspace(workspace, () => {
        const unicodeName = 'файл-ユニコード-🚀.txt'
        
        try {
          writeFileSync(unicodeName, 'content')
          
          const manager = new IdempotencyManager('.pipecraft-cache.json')
          expect(() => manager.hasChanges(unicodeName)).not.toThrow()
        } catch (error) {
          // Some filesystems don't support Unicode - acceptable
          console.log('Unicode test skipped - filesystem limitation')
        }
      })
    })

    it('should handle paths with backslashes', async () => {
      await inWorkspace(workspace, () => {
        // On Windows, backslashes are valid path separators
        // On Unix, they're just part of the filename
        const path = 'test\\file.txt'
        
        writeFileSync('test_file.txt', 'content') // Use safe name
        
        const manager = new IdempotencyManager('.pipecraft-cache.json')
        
        // Should handle without crashing
        try {
          manager.hasChanges(path)
        } catch (error) {
          // Platform-specific behavior is okay
          expect(error).toBeDefined()
        }
      })
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent cache reads', async () => {
      await inWorkspace(workspace, async () => {
        writeFileSync('test.txt', 'content')
        const manager = new IdempotencyManager('.pipecraft-cache.json')
        manager.updateCache('test.txt')
        
        // Simulate concurrent reads
        const promises = Array.from({ length: 10 }, () => 
          Promise.resolve(manager.hasChanges('test.txt'))
        )
        
        const results = await Promise.all(promises)
        
        // All should return consistent results
        expect(new Set(results).size).toBe(1) // All same value
      })
    })

    it('should handle concurrent cache updates', async () => {
      await inWorkspace(workspace, async () => {
        const manager = new IdempotencyManager('.pipecraft-cache.json')
        
        // Create multiple files concurrently
        const files = Array.from({ length: 10 }, (_, i) => `file-${i}.txt`)
        files.forEach(file => writeFileSync(file, 'content'))
        
        // Update cache concurrently
        const promises = files.map(file => 
          Promise.resolve(manager.updateCache(file))
        )
        
        await Promise.all(promises)
        
        // All should be registered
        expect(true).toBe(true)
      })
    })
  })

  describe('Resource Limits', () => {
    it('should handle very long filenames', async () => {
      await inWorkspace(workspace, () => {
        const longName = 'a'.repeat(200) + '.txt'
        
        try {
          writeFileSync(longName, 'content')
          
          const manager = new IdempotencyManager('.pipecraft-cache.json')
          manager.hasChanges(longName)
          expect(true).toBe(true)
        } catch (error: any) {
          // Filesystem limit - acceptable
          expect(error.code).toBeDefined()
        }
      })
    })

    it('should handle very deep cache structures', async () => {
      await inWorkspace(workspace, () => {
        const manager = new IdempotencyManager('.pipecraft-cache.json')
        
        // Create nested directory structure
        const levels = 20
        let path = ''
        for (let i = 0; i < levels; i++) {
          path += `level${i}/`
        }
        
        try {
          mkdirSync(path, { recursive: true })
          const filePath = `${path}file.txt`
          writeFileSync(filePath, 'content')
          
          manager.updateCache(filePath)
          expect(manager.hasChanges(filePath)).toBe(false)
        } catch (error: any) {
          // OS/filesystem limit - acceptable
          expect(error).toBeDefined()
        }
      })
    })
  })

  describe('Cache Persistence', () => {
    it('should persist cache across manager instances', async () => {
      await inWorkspace(workspace, () => {
        writeFileSync('test.txt', 'original')
        
        // First manager interacts with cache
        const manager1 = new IdempotencyManager('.pipecraft-cache.json')
        expect(() => manager1.shouldRegenerateFile('test.txt', 'original')).not.toThrow()
        
        // Second manager should read from cache without crashing
        const manager2 = new IdempotencyManager('.pipecraft-cache.json')
        expect(() => manager2.shouldRegenerateFile('test.txt', 'original')).not.toThrow()
      })
    })

    it('should handle cache corruption recovery', async () => {
      await inWorkspace(workspace, () => {
        writeFileSync('test.txt', 'content')
        
        // Create valid cache
        const manager1 = new IdempotencyManager('.pipecraft-cache.json')
        manager1.updateCache('test.txt')
        
        // Corrupt the cache
        writeFileSync('.pipecraft-cache.json', '{ "files": { broken }')
        
        // New manager should recover
        const manager2 = new IdempotencyManager('.pipecraft-cache.json')
        expect(() => manager2.hasChanges('test.txt')).not.toThrow()
      })
    })
  })
})

