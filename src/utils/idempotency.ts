/**
 * Idempotency and Caching Utilities
 *
 * This module implements intelligent caching to avoid unnecessary workflow regeneration.
 * It tracks file hashes and modification times for:
 * - Configuration files (.pipecraftrc.json)
 * - Template source files (src/templates/)
 * - Generator code (src/generators/)
 *
 * Workflows are only regenerated when relevant source files have changed,
 * significantly improving performance during iterative development.
 *
 * The cache is stored in `.pipecraft-cache.json` and contains hashes
 * of all tracked files along with metadata.
 *
 * @module utils/idempotency
 */

import { createHash } from 'crypto'
import { readFileSync, existsSync, writeFileSync, statSync, rmSync } from 'fs'
import { join } from 'path'
import { PipecraftConfig } from '../types/index.js'

/**
 * Metadata and hash information for a tracked file.
 */
export interface FileHash {
  /** Relative path to the file */
  path: string

  /** Cryptographic hash of file content and metadata */
  hash: string

  /** Last modification time (Unix timestamp in milliseconds) */
  mtime: number

  /** File size in bytes */
  size: number
}

/**
 * Complete rebuild cache structure stored in .pipecraft-cache.json.
 *
 * This cache enables idempotent workflow generation by tracking when
 * configuration or template files change.
 */
export interface RebuildCache {
  /** Map of file paths to their hash metadata */
  files: Record<string, FileHash>

  /** Hash of the configuration file (.pipecraftrc.json) */
  configHash: string

  /** Timestamp when workflows were last generated */
  lastGenerated: number

  /** Cache format version for future migration compatibility */
  version: string
}

/**
 * Manager for idempotent workflow generation through intelligent caching.
 *
 * This class tracks changes to configuration and template files to determine
 * when workflows need to be regenerated. It creates cryptographic hashes of
 * files and directories to detect changes efficiently.
 *
 * @example
 * ```typescript
 * const manager = new IdempotencyManager(config)
 *
 * if (await manager.hasChanges()) {
 *   // Generate workflows
 *   await generateWorkflows()
 *   // Update cache after successful generation
 *   await manager.updateCache()
 * } else {
 *   console.log('No changes detected, skipping regeneration')
 * }
 * ```
 */
export class IdempotencyManager {
  private cacheFile: string
  private config: PipecraftConfig

  /**
   * Create a new IdempotencyManager instance.
   *
   * @param config - PipeCraft configuration object
   * @param cacheFile - Path to cache file (default: .pipecraft-cache.json)
   */
  constructor(config: PipecraftConfig, cacheFile = '.pipecraft-cache.json') {
    this.config = config
    this.cacheFile = cacheFile
  }

  /**
   * Calculate cryptographic hash for a file or directory.
   *
   * For files: Hashes content + mtime + size to detect any changes
   * For directories: Recursively hashes all files within
   *
   * Returns empty string if the path doesn't exist.
   *
   * @param filePath - Path to file or directory to hash
   * @param algorithm - Hashing algorithm (default: sha256)
   * @returns Hex-encoded hash string
   *
   * @example
   * ```typescript
   * const configHash = await manager.calculateHash('.pipecraftrc.json')
   * const templateHash = await manager.calculateHash('src/templates')
   * ```
   */
  async calculateHash(filePath: string, algorithm: string = 'sha256'): Promise<string> {
    if (!existsSync(filePath)) {
      return ''
    }

    const stats = statSync(filePath)
    if (stats.isDirectory()) {
      // For directories, hash all files recursively
      return await this.hashDirectory(filePath, algorithm)
    } else {
      // For files, hash content + metadata
      // Including mtime and size ensures any change is detected
      const content = readFileSync(filePath)
      const hash = createHash(algorithm)
      hash.update(content)
      hash.update(stats.mtime.toString())
      hash.update(stats.size.toString())
      return hash.digest('hex')
    }
  }

  /**
   * Hash directory contents recursively.
   *
   * Traverses all files in the directory tree and combines their hashes
   * along with metadata into a single directory hash. This allows detecting
   * when any file within the directory structure has changed.
   *
   * @param dirPath - Path to directory to hash
   * @param algorithm - Hashing algorithm
   * @returns Hex-encoded hash string representing the entire directory
   * @private
   */
  private async hashDirectory(dirPath: string, algorithm: string): Promise<string> {
    const fs = await import('fs')
    const path = await import('path')
    const hash = createHash(algorithm)
    
    // Recursively hash all files in the directory tree
    const hashDir = (dir: string) => {
      const items = fs.readdirSync(dir)
      for (const item of items) {
        const itemPath = path.join(dir, item)
        const stats = fs.statSync(itemPath)
        
        if (stats.isDirectory()) {
          hashDir(itemPath)
        } else {
          // Include file content and metadata in hash
          const content = fs.readFileSync(itemPath)
          hash.update(content)
          hash.update(stats.mtime.toString())
          hash.update(stats.size.toString())
        }
      }
    }
    
    hashDir(dirPath)
    return hash.digest('hex')
  }

  /**
   * Load rebuild cache from filesystem.
   *
   * Reads and parses the cache file containing previous generation state.
   * Returns null if cache doesn't exist or can't be parsed.
   *
   * @returns Parsed cache object or null if unavailable
   */
  loadCache(): RebuildCache | null {
    if (!existsSync(this.cacheFile)) {
      return null
    }

    try {
      const content = readFileSync(this.cacheFile, 'utf8')
      return JSON.parse(content)
    } catch (error: any) {
      console.warn(`Failed to load cache file: ${error.message}`)
      return null
    }
  }

  /**
   * Save rebuild cache to filesystem.
   *
   * Writes the cache object to disk as formatted JSON.
   * Failures are logged as warnings but don't throw errors.
   *
   * @param cache - Cache object to persist
   */
  saveCache(cache: RebuildCache): void {
    try {
      writeFileSync(this.cacheFile, JSON.stringify(cache, null, 2))
    } catch (error: any) {
      console.warn(`Failed to save cache file: ${error.message}`)
    }
  }

  /**
   * Check if any tracked files have changed since last generation.
   *
   * Compares current file hashes against cached values to detect changes in:
   * - Configuration file (.pipecraftrc.json)
   * - Template source files (src/templates/)
   * - Generator code (src/generators/)
   *
   * Returns true if:
   * - Rebuild is disabled (always regenerate)
   * - Force regenerate flag is set
   * - No cache exists
   * - Any tracked file has changed
   *
   * @returns true if workflows should be regenerated
   *
   * @example
   * ```typescript
   * if (await manager.hasChanges()) {
   *   console.log('Changes detected, regenerating workflows...')
   *   await generateWorkflows()
   *   await manager.updateCache()
   * }
   * ```
   */
  async hasChanges(): Promise<boolean> {
    // Always regenerate if idempotency is disabled
    if (!this.config.rebuild?.enabled) {
      return true
    }

    // Always regenerate if force flag is set
    if (this.config.rebuild?.forceRegenerate) {
      return true
    }

    const cache = this.loadCache()
    if (!cache) {
      return true // No cache exists, need to generate
    }

    // Check if configuration file has changed
    const configHash = await this.calculateHash('.pipecraftrc.json')
    if (cache.configHash !== configHash) {
      return true
    }

    // Check if template source files have changed
    const templateDir = 'src/templates'
    if (existsSync(templateDir)) {
      const templateHash = await this.calculateHash(templateDir)
      if (cache.files[templateDir]?.hash !== templateHash) {
        return true
      }
    }

    // Check if generator source files have changed
    const sourceDir = 'src/generators'
    if (existsSync(sourceDir)) {
      const sourceHash = await this.calculateHash(sourceDir)
      if (cache.files[sourceDir]?.hash !== sourceHash) {
        return true
      }
    }

    return false
  }

  /**
   * Update cache with current file states after successful generation.
   *
   * Should be called after workflows are successfully generated to save
   * the current state of all tracked files. This allows future runs to
   * skip regeneration if nothing has changed.
   *
   * @example
   * ```typescript
   * await generateWorkflows()
   * await manager.updateCache() // Save current state
   * ```
   */
  async updateCache(): Promise<void> {
    const cache: RebuildCache = {
      files: {},
      configHash: await this.calculateHash('.pipecraftrc.json'),
      lastGenerated: Date.now(),
      version: '1.0.0'
    }

    // Cache template directory state
    const templateDir = 'src/templates'
    if (existsSync(templateDir)) {
      cache.files[templateDir] = {
        path: templateDir,
        hash: await this.calculateHash(templateDir),
        mtime: statSync(templateDir).mtime.getTime(),
        size: 0 // Directory size not meaningful
      }
    }

    // Cache generator directory state
    const sourceDir = 'src/generators'
    if (existsSync(sourceDir)) {
      cache.files[sourceDir] = {
        path: sourceDir,
        hash: await this.calculateHash(sourceDir),
        mtime: statSync(sourceDir).mtime.getTime(),
        size: 0
      }
    }

    this.saveCache(cache)
  }

  /**
   * Check if a specific file should be regenerated.
   *
   * Similar to hasChanges() but checks a single file instead of the
   * entire project. Useful for selective regeneration.
   *
   * @param filePath - Path to file to check
   * @returns true if file should be regenerated
   *
   * @example
   * ```typescript
   * if (await manager.shouldRegenerateFile('.github/workflows/pipeline.yml')) {
   *   await generatePipeline()
   * }
   * ```
   */
  async shouldRegenerateFile(filePath: string): Promise<boolean> {
    if (!this.config.rebuild?.enabled) {
      return true
    }

    if (this.config.rebuild?.forceRegenerate) {
      return true
    }

    const cache = this.loadCache()
    if (!cache) {
      return true
    }

    const currentHash = await this.calculateHash(filePath)
    const cachedFile = cache.files[filePath]
    
    if (!cachedFile) {
      return true // File not in cache, needs generation
    }

    return cachedFile.hash !== currentHash
  }
}
