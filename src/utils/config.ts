/**
 * Configuration Loading and Validation Utilities
 *
 * This module provides functions to load and validate PipeCraft configuration files.
 * It uses cosmiconfig to search for configuration in multiple locations:
 * - .pipecraftrc.json
 * - .pipecraftrc (JSON or YAML)
 * - pipecraft.config.js
 * - package.json (pipecraft key)
 *
 * The configuration is validated to ensure all required fields are present
 * and have valid values before being used to generate workflows.
 *
 * @module utils/config
 */

import { cosmiconfigSync } from 'cosmiconfig'
import { PipecraftConfig, DomainConfig } from '../types/index.js'  

/**
 * Load PipeCraft configuration from filesystem.
 *
 * Uses cosmiconfig to search for configuration files in standard locations.
 * If no path is provided, searches the current directory and ancestors for
 * configuration files in this order:
 * 1. .pipecraftrc.json
 * 2. .pipecraftrc
 * 3. pipecraft.config.js
 * 4. package.json (pipecraft key)
 *
 * @param configPath - Optional explicit path to configuration file
 * @returns Parsed configuration object
 * @throws {Error} If no configuration file is found
 *
 * @example
 * ```typescript
 * // Search for config in current directory and ancestors
 * const config = loadConfig()
 *
 * // Load from explicit path
 * const config = loadConfig('./my-config.json')
 * ```
 */
export const loadConfig = (configPath?: string) => {
  const explorer = cosmiconfigSync('pipecraft')
  const result = configPath ? explorer.load(configPath) : explorer.search()
  
  if (!result) {
    throw new Error(`No configuration file found. Expected: ${configPath || '.pipecraftrc.json'}`)
  }
  
  return result.config
}

/**
 * Validate PipeCraft configuration structure and values.
 *
 * Performs comprehensive validation including:
 * - Presence of all required fields
 * - Valid enum values (ciProvider, mergeStrategy)
 * - Branch flow structure (minimum 2 branches)
 * - Domain configuration (paths, testable, deployable)
 *
 * Also sets default values for optional domain properties:
 * - testable defaults to true
 * - deployable defaults to true
 *
 * @param config - Configuration object to validate (untyped to allow validation)
 * @returns true if validation passes
 * @throws {Error} If validation fails with detailed error message
 *
 * @example
 * ```typescript
 * const config = loadConfig()
 * validateConfig(config) // Throws if invalid
 * // Safe to use config as PipecraftConfig after this point
 * ```
 */
export const validateConfig = (config: any) => {
  // Check for all required top-level fields
  const requiredFields = ['ciProvider', 'mergeStrategy', 'requireConventionalCommits', 'initialBranch', 'finalBranch', 'branchFlow', 'domains']
  
  for (const field of requiredFields) {
    if (!(field in config)) {
      throw new Error(`Missing required field: ${field}`)
    }
  }
  
  // Validate ciProvider enum
  if (!['github', 'gitlab'].includes(config.ciProvider)) {
    throw new Error('ciProvider must be either "github" or "gitlab"')
  }
  
  // Validate mergeStrategy enum
  if (!['fast-forward', 'merge'].includes(config.mergeStrategy)) {
    throw new Error('mergeStrategy must be either "fast-forward" or "merge"')
  }
  
  // Validate branchFlow is a non-empty array with at least 2 branches
  // (minimum trunk-based flow requires at least develop → main)
  if (!Array.isArray(config.branchFlow) || config.branchFlow.length < 2) {
    throw new Error('branchFlow must be an array with at least 2 branches')
  }
  
  // Validate domains structure
  if (typeof config.domains !== 'object') {
    throw new Error('domains must be an object')
  }
  
  // Validate each domain configuration
  for (const [domainName, domainConfig] of Object.entries(config.domains) as [string, DomainConfig][]) {
    if (!domainConfig || typeof domainConfig !== 'object') {
      throw new Error(`Domain "${domainName}" must be an object`)
    }
    
    if (!domainConfig.paths || !Array.isArray(domainConfig.paths)) {
      throw new Error(`Domain "${domainName}" must have a "paths" array`)
    }
    
    if (domainConfig.paths.length === 0) {
      throw new Error(`Domain "${domainName}" must have at least one path pattern`)
    }
    
    // Set defaults for optional properties
    // By default, domains are both testable and deployable
    if (domainConfig.testable === undefined) {
      domainConfig.testable = true
    }
    if (domainConfig.deployable === undefined) {
      domainConfig.deployable = true
    }
  }

  
  return true
}
