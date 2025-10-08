import { createHash } from 'crypto'
import { readFileSync, existsSync, writeFileSync, statSync, rmSync } from 'fs'
import { join } from 'path'
import { FlowcraftConfig } from '../types'

export interface FileHash {
  path: string
  hash: string
  mtime: number
  size: number
}

export interface RebuildCache {
  files: Record<string, FileHash>
  configHash: string
  lastGenerated: number
  version: string
}

export class IdempotencyManager {
  private cacheFile: string
  private config: FlowcraftConfig

  constructor(config: FlowcraftConfig, cacheFile = '.flowcraft-cache.json') {
    this.config = config
    this.cacheFile = cacheFile
  }

  /**
   * Calculate hash for a file or directory
   */
  calculateHash(filePath: string, algorithm: string = 'sha256'): string {
    if (!existsSync(filePath)) {
      return ''
    }

    const stats = statSync(filePath)
    if (stats.isDirectory()) {
      // For directories, hash all files recursively
      return this.hashDirectory(filePath, algorithm)
    } else {
      // For files, hash content + metadata
      const content = readFileSync(filePath)
      const hash = createHash(algorithm)
      hash.update(content)
      hash.update(stats.mtime.toString())
      hash.update(stats.size.toString())
      return hash.digest('hex')
    }
  }

  /**
   * Hash directory contents recursively
   */
  private hashDirectory(dirPath: string, algorithm: string): string {
    const fs = require('fs')
    const path = require('path')
    const hash = createHash(algorithm)
    
    const hashDir = (dir: string) => {
      const items = fs.readdirSync(dir)
      for (const item of items) {
        const itemPath = path.join(dir, item)
        const stats = fs.statSync(itemPath)
        
        if (stats.isDirectory()) {
          hashDir(itemPath)
        } else {
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
   * Load rebuild cache from file
   */
  loadCache(): RebuildCache | null {
    if (!existsSync(this.cacheFile)) {
      return null
    }

    try {
      const content = readFileSync(this.cacheFile, 'utf8')
      return JSON.parse(content)
    } catch (error) {
      console.warn(`Failed to load cache file: ${error.message}`)
      return null
    }
  }

  /**
   * Save rebuild cache to file
   */
  saveCache(cache: RebuildCache): void {
    try {
      writeFileSync(this.cacheFile, JSON.stringify(cache, null, 2))
    } catch (error) {
      console.warn(`Failed to save cache file: ${error.message}`)
    }
  }

  /**
   * Check if files have changed since last generation
   */
  hasChanges(): boolean {
    if (!this.config.rebuild?.enabled) {
      return true // Always regenerate if rebuild is disabled
    }

    if (this.config.rebuild?.forceRegenerate) {
      return true // Force regeneration
    }

    const cache = this.loadCache()
    if (!cache) {
      return true // No cache, need to regenerate
    }

    // Check if config has changed
    const configHash = this.calculateHash('.trunkflowrc.json')
    if (cache.configHash !== configHash) {
      return true
    }

    // Check if template files have changed
    const templateDir = 'src/templates'
    if (existsSync(templateDir)) {
      const templateHash = this.calculateHash(templateDir)
      if (cache.files[templateDir]?.hash !== templateHash) {
        return true
      }
    }

    // Check if source files have changed
    const sourceDir = 'src/generators'
    if (existsSync(sourceDir)) {
      const sourceHash = this.calculateHash(sourceDir)
      if (cache.files[sourceDir]?.hash !== sourceHash) {
        return true
      }
    }

    return false
  }

  /**
   * Update cache with current file states
   */
  updateCache(): void {
    const cache: RebuildCache = {
      files: {},
      configHash: this.calculateHash('.trunkflowrc.json'),
      lastGenerated: Date.now(),
      version: '1.0.0'
    }

    // Cache template files
    const templateDir = 'src/templates'
    if (existsSync(templateDir)) {
      cache.files[templateDir] = {
        path: templateDir,
        hash: this.calculateHash(templateDir),
        mtime: statSync(templateDir).mtime.getTime(),
        size: 0 // Directory size not meaningful
      }
    }

    // Cache source files
    const sourceDir = 'src/generators'
    if (existsSync(sourceDir)) {
      cache.files[sourceDir] = {
        path: sourceDir,
        hash: this.calculateHash(sourceDir),
        mtime: statSync(sourceDir).mtime.getTime(),
        size: 0
      }
    }

    this.saveCache(cache)
  }

  /**
   * Check if specific file should be regenerated
   */
  shouldRegenerateFile(filePath: string): boolean {
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

    const currentHash = this.calculateHash(filePath)
    const cachedFile = cache.files[filePath]
    
    if (!cachedFile) {
      return true // File not in cache, needs generation
    }

    return cachedFile.hash !== currentHash
  }
}
