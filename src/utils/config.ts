/**
 * Configuration Loading and Validation Utilities
 *
 * This module provides functions to load and validate PipeCraft configuration files.
 * It uses cosmiconfig to search for configuration in multiple locations:
 * - .pipecraftrc (YAML or JSON, recommended)
 * - .pipecraftrc.json
 * - .pipecraftrc.yaml
 * - .pipecraftrc.yml
 * - .pipecraftrc.js
 * - pipecraft.config.js
 * - package.json (pipecraft key)
 *
 * The configuration is validated to ensure all required fields are present
 * and have valid values before being used to generate workflows.
 *
 * @module utils/config
 */

import { cosmiconfigSync } from 'cosmiconfig'
import {
  type DomainConfig,
  KNOWN_CONFIG_KEYS,
  KNOWN_DOMAIN_KEYS,
  PipecraftConfig
} from '../types/index.js'
import { logger } from './logger.js'

/**
 * Reserved job names that cannot be used as domain names.
 * These are managed by Pipecraft and would conflict with generated workflow jobs.
 */
export const RESERVED_JOB_NAMES = [
  'version',
  'changes',
  'gate',
  'tag',
  'promote',
  'release'
] as const

/**
 * Load PipeCraft configuration from filesystem.
 *
 * Uses cosmiconfig to search for configuration files in standard locations.
 * If no path is provided, searches the current directory and ancestors for
 * configuration files in this order:
 * 1. .pipecraftrc (YAML or JSON, recommended)
 * 2. .pipecraftrc.json
 * 3. .pipecraftrc.yaml
 * 4. .pipecraftrc.yml
 * 5. .pipecraftrc.js
 * 6. pipecraft.config.js
 * 7. package.json (pipecraft key)
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
  const explorer = cosmiconfigSync('pipecraft', {
    searchPlaces: [
      '.pipecraftrc',
      '.pipecraftrc.json',
      '.pipecraftrc.yaml',
      '.pipecraftrc.yml',
      '.pipecraftrc.js',
      'pipecraft.config.js',
      'package.json'
    ]
  })
  const result = configPath ? explorer.load(configPath) : explorer.search()

  if (!result) {
    throw new Error(
      `No configuration file found. Expected: ${
        configPath ||
        '.pipecraftrc, .pipecraftrc.json, .pipecraftrc.yml, .pipecraftrc.yaml, or .pipecraftrc.js'
      }`
    )
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
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Configuration must be an object')
  }

  // Collect warnings against the config as the user wrote it. Validation below both
  // translates deprecated domain flags into `prefixes` and defaults those flags to true,
  // so anything computed afterwards cannot tell what the user actually typed.
  const warnings = getConfigWarnings(config)

  // Reject unknown / misspelled top-level keys. Silently ignoring them was the root
  // cause of the historical autoMerge / nx bugs: a wrong key passed validation and was
  // dropped at generation time. KNOWN_CONFIG_KEYS is kept in lockstep with the types
  // (compile-time) and the JSON schema (schema-types-consistency.test.ts). `$schema` is
  // allowed as an editor-only meta key.
  const allowedTopLevel = new Set<string>([...KNOWN_CONFIG_KEYS, '$schema'])
  const unknownTopLevel = Object.keys(config).filter(key => !allowedTopLevel.has(key))
  if (unknownTopLevel.length > 0) {
    throw new Error(
      `Unknown config key${unknownTopLevel.length > 1 ? 's' : ''}: ` +
        `${unknownTopLevel.map(k => `"${k}"`).join(', ')}. ` +
        `Allowed keys: ${KNOWN_CONFIG_KEYS.join(', ')}.`
    )
  }

  // Check for all required top-level fields
  const requiredFields = [
    'ciProvider',
    'mergeStrategy',
    'requireConventionalCommits',
    'initialBranch',
    'finalBranch',
    'branchFlow',
    'domains'
  ]

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

  // Validate branchFlow is a non-empty array
  // Single-branch workflows are valid (e.g., GitHub Actions, libraries that publish from main)
  if (!Array.isArray(config.branchFlow) || config.branchFlow.length < 1) {
    throw new Error('branchFlow must be an array with at least 1 branch')
  }

  // Validate initialBranch is first in branchFlow
  if (config.branchFlow[0] !== config.initialBranch) {
    throw new Error(
      `initialBranch "${config.initialBranch}" must be the first branch in branchFlow. ` +
        `Got branchFlow: [${config.branchFlow.join(', ')}]`
    )
  }

  // Validate finalBranch is last in branchFlow
  if (config.branchFlow[config.branchFlow.length - 1] !== config.finalBranch) {
    throw new Error(
      `finalBranch "${config.finalBranch}" must be the last branch in branchFlow. ` +
        `Got branchFlow: [${config.branchFlow.join(', ')}]`
    )
  }

  // Validate domains structure
  if (typeof config.domains !== 'object') {
    throw new Error('domains must be an object')
  }

  // Validate domain names don't conflict with reserved job names
  const domainNames = Object.keys(config.domains)
  for (const domainName of domainNames) {
    const lowerName = domainName.toLowerCase()
    if ((RESERVED_JOB_NAMES as readonly string[]).includes(lowerName)) {
      throw new Error(
        `Domain name "${domainName}" is reserved and cannot be used. ` +
          `Reserved names: ${RESERVED_JOB_NAMES.join(', ')}. ` +
          `These names are used by Pipecraft-managed workflow jobs.`
      )
    }
  }

  // Validate each domain configuration
  for (const [domainName, domainConfig] of Object.entries(config.domains) as [
    string,
    DomainConfig
  ][]) {
    if (!domainConfig || typeof domainConfig !== 'object') {
      throw new Error(`Domain "${domainName}" must be an object`)
    }

    // Reject unknown / misspelled domain keys.
    const allowedDomainKeys = new Set<string>(KNOWN_DOMAIN_KEYS)
    const unknownDomainKeys = Object.keys(domainConfig).filter(key => !allowedDomainKeys.has(key))
    if (unknownDomainKeys.length > 0) {
      throw new Error(
        `Domain "${domainName}" has unknown key${unknownDomainKeys.length > 1 ? 's' : ''}: ` +
          `${unknownDomainKeys.map(k => `"${k}"`).join(', ')}. ` +
          `Allowed keys: ${KNOWN_DOMAIN_KEYS.join(', ')}.`
      )
    }

    if (!domainConfig.paths || !Array.isArray(domainConfig.paths)) {
      throw new Error(`Domain "${domainName}" must have a "paths" array`)
    }

    if (domainConfig.paths.length === 0) {
      throw new Error(`Domain "${domainName}" must have at least one path pattern`)
    }

    // Translate the deprecated boolean flags into `prefixes`, which is the only shape job
    // generation reads (generatePrefixedJobsText in pipeline.yml.tpl.ts). Without this the
    // flags validate, generate exits 0, and no test/deploy jobs appear at all.
    //
    // Only translate flags the user actually wrote. Both default to true immediately below,
    // and turning those defaults into prefixes would invent test-* and deploy-* jobs for
    // every config that never mentioned them.
    if (!Array.isArray(domainConfig.prefixes)) {
      const derived: string[] = []
      if (domainConfig.testable === true) derived.push('test')
      if (domainConfig.deployable === true) derived.push('deploy')
      if (domainConfig.remoteTestable === true) derived.push('remote-test')
      if (derived.length > 0) {
        domainConfig.prefixes = derived
      }
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

  // Surface declared-but-inert / deprecated fields (non-fatal). Computed at the top,
  // before validation mutates the config.
  for (const warning of warnings) {
    logger.warn(`⚠️  ${warning}`)
  }

  return true
}

/**
 * Collect non-fatal warnings for config fields that are declared/documented but have no
 * effect, so the dead surface is visible instead of silently ignored.
 *
 * - `mergeMethod` is consumed nowhere. `mergeStrategy` IS honoured: the promote action
 *   branches on it, using `git merge --no-ff` for `'merge'` and `--ff-only` otherwise.
 * - `autoMerge` is a deprecated alias for `autoPromote`.
 *
 * @param config - A config object (already structurally validated)
 * @returns Human-readable warning strings (empty when the config is clean)
 */
export const getConfigWarnings = (config: any): string[] => {
  const warnings: string[] = []

  // Note: mergeStrategy 'merge' is now implemented (merge-commit promotion) — no warning.
  if (config?.mergeMethod !== undefined) {
    warnings.push(
      'mergeMethod is declared but has no effect; use mergeStrategy to choose how promotions land.'
    )
  }
  if (config?.autoMerge !== undefined) {
    warnings.push('autoMerge is deprecated; use autoPromote instead.')
  }

  // Domain flags are translated into `prefixes` during validation, so they work — but say
  // so, because the translation is the only thing standing between them and no jobs.
  const legacyFlagDomains = Object.entries(config?.domains ?? {})
    .filter(
      ([, d]: [string, any]) =>
        !Array.isArray(d?.prefixes) &&
        (d?.testable !== undefined ||
          d?.deployable !== undefined ||
          d?.remoteTestable !== undefined)
    )
    .map(([name]) => name)

  if (legacyFlagDomains.length > 0) {
    warnings.push(
      `Domain${legacyFlagDomains.length > 1 ? 's' : ''} ` +
        `${legacyFlagDomains.map(n => `"${n}"`).join(', ')} ` +
        `use deprecated testable/deployable/remoteTestable flags; use prefixes instead ` +
        `(e.g. prefixes: ['test', 'deploy']).`
    )
  }

  return warnings
}
