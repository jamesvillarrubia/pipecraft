/**
 * Version Management and Semantic Versioning Utilities
 *
 * This module provides comprehensive version management using release-it and
 * conventional commits. It handles:
 * - Automatic version calculation based on commit history
 * - Generation of release-it, commitlint, and husky configurations
 * - Git tag creation and management
 * - Conventional commit validation
 * - Changelog generation
 *
 * The VersionManager integrates with the trunk-based workflow to automatically
 * bump versions when code is promoted through the pipeline.
 *
 * @module utils/versioning
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { PipecraftConfig } from '../types/index.js'

/**
 * Manager for semantic versioning and release automation.
 *
 * This class handles all version-related operations including configuration
 * generation, version calculation, and commit validation. It integrates with
 * release-it for automated versioning and conventional-changelog for
 * changelog generation.
 *
 * @example
 * ```typescript
 * const versionManager = new VersionManager(config)
 *
 * // Setup version management (creates config files)
 * versionManager.setupVersionManagement()
 *
 * // Get current version from git tags
 * const currentVersion = versionManager.getCurrentVersion()
 *
 * // Calculate next version based on commits
 * const { version, type } = versionManager.calculateNextVersion()
 * console.log(`Next version: ${version} (${type} bump)`)
 * ```
 */
export class VersionManager {
  private config: PipecraftConfig

  /**
   * Create a new VersionManager instance.
   *
   * @param config - PipeCraft configuration object
   */
  constructor(config: PipecraftConfig) {
    this.config = config
  }

  /**
   * Generate release-it configuration file content.
   *
   * Creates a CommonJS module exporting release-it configuration that:
   * - Disables npm publishing (for monorepos/private packages)
   * - Configures git tagging with conventional versioning
   * - Sets up conventional-changelog plugin for automatic version bumping
   * - Merges user-defined bump rules with sensible defaults
   *
   * The generated config uses a custom whatBump function that analyzes
   * conventional commits to determine the appropriate version bump level
   * (major, minor, or patch).
   *
   * @returns JavaScript module string ready to write to .release-it.cjs
   *
   * @example
   * ```typescript
   * const config = versionManager.generateReleaseItConfig()
   * writeFileSync('.release-it.cjs', config)
   * ```
   */
  generateReleaseItConfig(): string {
    const defaultConfig = {
      git: {
        requireCleanWorkingDir: false,
        commit: false,
        pushArgs: ["--tags"],
        tagMatch: "v[0-9]*.[0-9]*.[0-9]*"
      },
      github: {
        release: false
      },
      npm: {
        ignoreVersion: true,
        publish: false,
        skipChecks: true
      },
      hooks: {
        "after:release": "echo ${version} > .release-version"
      },
      plugins: {
        "@release-it/conventional-changelog": {
          whatBump: (commits: any[], options: any) => {
            // Import DEFAULT_PREFIXES from the release-it config
            const { DEFAULT_PREFIXES } = require('../../.release-it.cjs')
            const defaults = DEFAULT_PREFIXES

            // Merge with user-defined bump rules
            const bumpRules = { ...defaults, ...this.config.versioning?.bumpRules }
            
            let breakings = 0
            let features = 0
            let levelSet = ['major', 'minor', 'patch', 'ignore']
            
            // eslint-disable-next-line prefer-spread
            let level = Math.min.apply(Math, commits.map(commit => {
              let level = levelSet.indexOf(bumpRules[commit.type as keyof typeof bumpRules] || 'ignore')
              level = level < 0 ? 3 : level
              
              if (commit.notes.length > 0) {
                breakings += commit.notes.length
              }
              if (commit.type === 'feat') {
                features += 1
              }
              return level
            }))

            return {
              level: level,
              reason: breakings === 1
                ? `There is ${breakings} BREAKING CHANGE and ${features} features`
                : `There are ${breakings} BREAKING CHANGES and ${features} features`
            }
          }
        }
      }
    }

    return `module.exports = ${JSON.stringify(defaultConfig, null, 2)}`
  }

  /**
   * Generate commitlint configuration file content.
   *
   * Creates a CommonJS module that configures commitlint to enforce
   * conventional commit message format. This ensures all commits follow
   * a consistent structure that can be parsed for automatic versioning.
   *
   * Enforced rules include:
   * - Valid commit types (feat, fix, docs, etc.)
   * - Lowercase types
   * - Non-empty subjects
   * - Lowercase subject (except proper nouns)
   * - No trailing period in subject
   *
   * @returns JavaScript module string ready to write to commitlint.config.js
   */
  generateCommitlintConfig(): string {
    return `module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert'
      ]
    ],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never']
  }
}`
  }

  /**
   * Generate husky commit-msg hook script.
   *
   * Creates a shell script that runs commitlint on every commit message.
   * This hook automatically validates commit messages before they're accepted,
   * preventing non-conventional commits from entering the repository.
   *
   * @returns Shell script string ready to write to .husky/commit-msg
   */
  generateHuskyConfig(): string {
    return `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx commitlint --edit $1`
  }

  /**
   * Setup version management infrastructure.
   *
   * Creates all necessary configuration files and hooks for automated
   * version management:
   * - .release-it.cjs (release-it configuration)
   * - commitlint.config.js (commit message linting)
   * - .husky/commit-msg (git hook for commit validation)
   * - package.json scripts (release, changelog commands)
   *
   * Only runs if versioning is enabled in configuration.
   * Installs husky if not already present.
   *
   * @example
   * ```typescript
   * versionManager.setupVersionManagement()
   * // Files created:
   * // - .release-it.cjs
   * // - commitlint.config.js
   * // - .husky/commit-msg
   * // - Updated package.json
   * ```
   */
  setupVersionManagement(): void {
    if (!this.config.versioning?.enabled) {
      return
    }

    // Generate .release-it.cjs
    const releaseItConfig = this.generateReleaseItConfig()
    writeFileSync('.release-it.cjs', releaseItConfig)

    // Generate commitlint.config.js
    const commitlintConfig = this.generateCommitlintConfig()
    writeFileSync('commitlint.config.js', commitlintConfig)

    // Setup husky and commit-msg hook
    const huskyDir = '.husky'
    if (!existsSync(huskyDir)) {
      execSync('npx husky install', { stdio: 'inherit' })
      // Ensure directory exists (in case husky install was mocked/failed in tests)
      if (!existsSync(huskyDir)) {
        const { mkdirSync } = require('fs')
        mkdirSync(huskyDir, { recursive: true })
      }
    }
    
    // Create commit-msg hook script
    const commitMsgHook = this.generateHuskyConfig()
    writeFileSync(join(huskyDir, 'commit-msg'), commitMsgHook)
    // Make hook executable (required for git to run it)
    execSync(`chmod +x ${join(huskyDir, 'commit-msg')}`)

    // Update package.json with version management scripts
    this.updatePackageJsonScripts()
  }

  /**
   * Update package.json with version management scripts.
   *
   * Adds npm scripts for common version management tasks:
   * - release: Run release-it to create a new version
   * - release:dry: Preview what release-it would do
   * - version:check: Check what version would be bumped to
   * - changelog: Generate CHANGELOG.md from commits
   * - commit: Stage and commit with interactive prompting
   * - prepare: Install husky hooks (runs automatically on npm install)
   *
   * @private
   */
  private updatePackageJsonScripts(): void {
    const packageJsonPath = 'package.json'
    if (!existsSync(packageJsonPath)) {
      return
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    
    // Merge with existing scripts, preserving any user-defined ones
    packageJson.scripts = {
      ...packageJson.scripts,
      'release': 'release-it',
      'release:dry': 'release-it --dry-run',
      'version:check': 'release-it --dry-run',
      'changelog': 'conventional-changelog -p angular -i CHANGELOG.md -s',
      'commit': 'git add . && git commit',
      'prepare': 'husky install'
    }

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
  }

  /**
   * Validate that recent commits follow conventional commit format.
   *
   * Checks the last 10 commits to determine if the repository is following
   * conventional commit conventions. This can be used as a pre-flight check
   * before enabling versioning features.
   *
   * Expected format: `type(scope?): subject`
   * Valid types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
   *
   * @returns true if all recent commits follow conventional format
   *
   * @example
   * ```typescript
   * if (!versionManager.validateConventionalCommits()) {
   *   console.warn('⚠ Some commits do not follow conventional format')
   *   console.log('Enable with: git config commit.template .gitmessage')
   * }
   * ```
   */
  validateConventionalCommits(): boolean {
    try {
      const result = execSync('git log --oneline -10', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr to avoid "not a git repository" errors in tests
      })
      const commits = result.split('\n').filter(line => line.trim())
      
      // Check if commits follow conventional format: type(scope?): subject
      const conventionalPattern = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .+/
      
      return commits.every(commit => conventionalPattern.test(commit))
    } catch (error) {
      // Not a git repository or other git error
      return false
    }
  }

  /**
   * Get the current version from git tags.
   *
   * Finds the most recent git tag matching semantic versioning format (v*.*.*)
   * and returns it as a version string. Strips the leading 'v' if present.
   *
   * @returns Current version string (e.g., "1.2.3") or "0.0.0" if no tags exist
   *
   * @example
   * ```typescript
   * const currentVersion = versionManager.getCurrentVersion()
   * console.log(`Current version: v${currentVersion}`)
   * ```
   */
  getCurrentVersion(): string {
    try {
      const result = execSync('git describe --tags --abbrev=0', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr to avoid "not a git repository" errors in tests
      })
      return result.trim().replace('v', '')
    } catch (error) {
      // No tags exist yet, or not a git repository
      return '0.0.0'
    }
  }

  /**
   * Calculate the next version based on conventional commits.
   *
   * Runs release-it in dry-run mode to determine what version would be
   * created based on commits since the last tag. Analyzes conventional
   * commit messages to determine the appropriate bump level.
   *
   * @returns Object containing the next version string and bump type
   *
   * @example
   * ```typescript
   * const { version, type } = versionManager.calculateNextVersion()
   * console.log(`Next ${type} version: ${version}`)
   * // Output: "Next minor version: 1.3.0"
   * ```
   */
  calculateNextVersion(): { version: string, type: string } {
    try {
      const currentVersion = this.getCurrentVersion()
      const result = execSync('npx release-it --dry-run --no-git.requireCleanWorkingDir', { 
        encoding: 'utf8',
        stdio: 'pipe'
      })
      
      // Parse release-it output to extract version and bump type
      const versionMatch = result.match(/version\s+(\d+\.\d+\.\d+)/)
      const typeMatch = result.match(/bump\s+(\w+)/)
      
      return {
        version: versionMatch ? versionMatch[1] : currentVersion,
        type: typeMatch ? typeMatch[1] : 'patch'
      }
    } catch (error) {
      // release-it not installed, or other error
      return {
        version: this.getCurrentVersion(),
        type: 'patch'
      }
    }
  }
}
