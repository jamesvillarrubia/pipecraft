/**
 * Init Template Generator
 *
 * Generates the initial PipeCraft configuration file (.pipecraftrc) with default settings.
 * This generator is invoked by the `pipecraft init` command and prompts the user for
 * basic project configuration preferences.
 *
 * @module generators/init.tpl
 *
 * @example
 * ```typescript
 * import { generate } from './generators/init.tpl.js'
 *
 * // Called by CLI with Pinion context
 * await generate(pinionContext)
 *
 * // Creates .pipecraftrc with:
 * // - CI provider (GitHub/GitLab)
 * // - Merge strategy (fast-forward/merge)
 * // - Branch flow configuration
 * // - Domain-based change detection
 * // - Semantic versioning rules
 * ```
 *
 * @note Current Implementation: The generator currently uses hardcoded defaults
 * from `defaultConfig` regardless of user prompt responses. This is intentional
 * for the initial release to ensure consistent behavior. Future versions will
 * respect user input and allow customization.
 */

import type { PinionContext } from '@featherscloud/pinion'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import inquirer from 'inquirer'

/**
 * Default PipeCraft configuration for new projects.
 *
 * Provides a complete, working trunk-based development workflow with:
 * - GitHub Actions CI/CD
 * - Fast-forward merge strategy
 * - Develop → Staging → Main branch flow
 * - Conventional commits enforcement
 * - Semantic versioning with standard bump rules
 * - Domain-based change detection for monorepos
 *
 * @const
 */
const defaultConfig = {
  ciProvider: 'github' as const,
  mergeStrategy: 'fast-forward' as const,
  requireConventionalCommits: true,
  initialBranch: 'develop',
  finalBranch: 'main',
  branchFlow: ['develop', 'staging', 'main'],
  autoMerge: {
    staging: true,
    main: true
  },
  semver: {
    bumpRules: {
      test: 'ignore',
      build: 'ignore',

      ci: 'patch',
      docs: 'patch',
      style: 'patch',
      fix: 'patch',
      perf: 'patch',
      refactor: 'patch',
      chore: 'patch',
      patch: 'patch',

      feat: 'minor',
      minor: 'minor',

      major: 'major',
      breaking: 'major'
    }
  },
  domains: {
    api: {
      paths: ['apps/api/**'],
      description: 'API application changes'
    },
    web: {
      paths: ['apps/web/**'],
      description: 'Web application changes'
    },
    libs: {
      paths: ['libs/**'],
      description: 'Shared library changes'
    },
    cicd: {
      paths: ['.github/workflows/**'],
      description: 'CI/CD configuration changes'
    }
  }
}

/**
 * Generates a YAML configuration file with comprehensive comments.
 *
 * Creates a .pipecraftrc file with:
 * - Descriptive section headers
 * - Inline comments for each configuration option
 * - Examples and valid values
 * - Proper YAML formatting
 *
 * @param {any} config - The configuration object to serialize
 * @returns {string} YAML string with comments
 */
const generateYamlConfig = (config: any): string => {
  const lines: string[] = []

  // Header with comprehensive introduction
  lines.push('# =============================================================================')
  lines.push('# PipeCraft Configuration File')
  lines.push('# =============================================================================')
  lines.push('#')
  lines.push('# This file configures PipeCraft\'s CI/CD pipeline generation for trunk-based')
  lines.push('# development workflows. PipeCraft generates GitHub Actions or GitLab CI/CD')
  lines.push('# workflows with intelligent change detection and automated branch promotion.')
  lines.push('#')
  lines.push('# Documentation: https://pipecraft.thecraftlab.dev')
  lines.push('# Support: https://github.com/pipecraft-lab/pipecraft/issues')
  lines.push('#')
  lines.push('# REQUIRED FIELDS: ciProvider, mergeStrategy, requireConventionalCommits,')
  lines.push('#                  initialBranch, finalBranch, branchFlow, domains')
  lines.push('#')
  lines.push('# OPTIONAL FIELDS: autoMerge, packageManager, semver, nx, versioning, rebuild')
  lines.push('#')
  lines.push('# =============================================================================')
  lines.push('')

  // CI Provider
  lines.push('# -----------------------------------------------------------------------------')
  lines.push('# CI/CD Platform Configuration (REQUIRED)')
  lines.push('# -----------------------------------------------------------------------------')
  lines.push('#')
  lines.push('# Specifies which CI/CD platform to generate workflows for.')
  lines.push('#')
  lines.push('# Valid values:')
  lines.push('#   - \'github\' : Generate GitHub Actions workflows (.github/workflows/)')
  lines.push('#   - \'gitlab\' : Generate GitLab CI/CD pipelines (.gitlab-ci.yml)')
  lines.push('#')
  lines.push('# Example: ciProvider: github')
  lines.push('#')
  lines.push(`ciProvider: ${config.ciProvider}`)
  lines.push('')

  // Merge Strategy
  lines.push('# -----------------------------------------------------------------------------')
  lines.push('# Merge Strategy (REQUIRED)')
  lines.push('# -----------------------------------------------------------------------------')
  lines.push('#')
  lines.push('# Determines how branches are merged during automatic promotions.')
  lines.push('#')
  lines.push('# Valid values:')
  lines.push('#   - \'fast-forward\' : (RECOMMENDED) Creates clean linear history, requires')
  lines.push('#                      branches to be up-to-date before merging')
  lines.push('#   - \'merge\'        : Creates merge commits, preserves branch history')
  lines.push('#')
  lines.push('# Example: mergeStrategy: fast-forward')
  lines.push('#')
  lines.push(`mergeStrategy: ${config.mergeStrategy}`)
  lines.push('')

  // Conventional Commits
  lines.push('# -----------------------------------------------------------------------------')
  lines.push('# Conventional Commits Enforcement (REQUIRED)')
  lines.push('# -----------------------------------------------------------------------------')
  lines.push('#')
  lines.push('# Enforces conventional commit format for pull request titles.')
  lines.push('# When enabled, PR titles must follow: <type>(<scope>): <description>')
  lines.push('#')
  lines.push('# Valid values: true | false')
  lines.push('#')
  lines.push('# Examples:')
  lines.push('#   - feat: add user authentication')
  lines.push('#   - fix(api): resolve memory leak in cache')
  lines.push('#   - docs: update installation guide')
  lines.push('#')
  lines.push(`requireConventionalCommits: ${config.requireConventionalCommits}`)
  lines.push('')

  // Branch Configuration
  lines.push('# -----------------------------------------------------------------------------')
  lines.push('# Branch Configuration (REQUIRED)')
  lines.push('# -----------------------------------------------------------------------------')
  lines.push('#')
  lines.push('# Defines the main branches in your trunk-based workflow.')
  lines.push('#')
  lines.push('# initialBranch: Where feature branches merge (development branch)')
  lines.push('# finalBranch:   Production-ready code (main/master branch)')
  lines.push('#')
  lines.push('# Examples:')
  lines.push('#   initialBranch: develop')
  lines.push('#   finalBranch: main')
  lines.push('#')
  lines.push(`initialBranch: ${config.initialBranch}  # Where features land`)
  lines.push(`finalBranch: ${config.finalBranch}       # Production branch`)
  lines.push('')

  // Branch Flow
  lines.push('# -----------------------------------------------------------------------------')
  lines.push('# Branch Promotion Flow (REQUIRED)')
  lines.push('# -----------------------------------------------------------------------------')
  lines.push('#')
  lines.push('# Defines the sequence of branches that code flows through.')
  lines.push('# Code is automatically promoted from one branch to the next after')
  lines.push('# successful tests and validation.')
  lines.push('#')
  lines.push('# Minimum: 2 branches (e.g., [develop, main])')
  lines.push('# Typical:  3 branches (e.g., [develop, staging, main])')
  lines.push('#')
  lines.push(`# Current flow: ${config.branchFlow.join(' → ')}`)
  lines.push('#')
  lines.push('# Example 2-stage flow:')
  lines.push('#   branchFlow:')
  lines.push('#     - develop  # Feature integration')
  lines.push('#     - main     # Production')
  lines.push('#')
  lines.push('# Example 3-stage flow (recommended):')
  lines.push('#   branchFlow:')
  lines.push('#     - develop  # Feature integration and initial testing')
  lines.push('#     - staging  # Pre-production validation')
  lines.push('#     - main     # Production releases')
  lines.push('#')
  lines.push('branchFlow:')
  config.branchFlow.forEach((branch: string, index: number) => {
    const comments = [
      '# Feature integration and initial testing',
      '# Pre-production validation',
      '# Production releases'
    ]
    lines.push(`  - ${branch}  ${comments[index] || ''}`)
  })
  lines.push('')

  // Auto Merge
  lines.push('# -----------------------------------------------------------------------------')
  lines.push('# Automatic Branch Promotion (OPTIONAL)')
  lines.push('# -----------------------------------------------------------------------------')
  lines.push('#')
  lines.push('# Controls which branches automatically promote to the next branch in the flow')
  lines.push('# after tests pass. Set to false to require manual promotion.')
  lines.push('#')
  lines.push('# Valid values: true | false')
  lines.push('#')
  lines.push('# Example:')
  lines.push('#   autoMerge:')
  lines.push('#     staging: true   # Auto-promote develop → staging')
  lines.push('#     main: false     # Require manual promotion staging → main')
  lines.push('#')
  lines.push('autoMerge:')
  const autoMergeEntries = Object.entries(config.autoMerge)
  autoMergeEntries.forEach(([key, value]) => {
    const flowIndex = config.branchFlow.indexOf(key)
    const fromBranch = flowIndex > 0 ? config.branchFlow[flowIndex - 1] : ''
    const comment = fromBranch ? `  # Auto-promote ${fromBranch} → ${key}` : ''
    lines.push(`  ${key}: ${value}${comment}`)
  })
  lines.push('')

  // Package Manager (if present)
  if (config.packageManager) {
    lines.push('# -----------------------------------------------------------------------------')
    lines.push('# Package Manager (OPTIONAL)')
    lines.push('# -----------------------------------------------------------------------------')
    lines.push('#')
    lines.push('# Specifies the package manager used in your project.')
    lines.push('#')
    lines.push('# Valid values: npm | yarn | pnpm')
    lines.push('#')
    lines.push('# Example: packageManager: pnpm')
    lines.push('#')
    lines.push(`packageManager: ${config.packageManager}`)
    lines.push('')
  }

  // Semantic Versioning
  lines.push('# -----------------------------------------------------------------------------')
  lines.push('# Semantic Versioning Rules (OPTIONAL)')
  lines.push('# -----------------------------------------------------------------------------')
  lines.push('#')
  lines.push('# Defines how commit types map to version bumps (major.minor.patch).')
  lines.push('# Based on conventional commits (https://www.conventionalcommits.org/).')
  lines.push('#')
  lines.push('# Valid bump levels:')
  lines.push('#   - \'major\'  : Breaking changes (x.0.0)')
  lines.push('#   - \'minor\'  : New features (0.x.0)')
  lines.push('#   - \'patch\'  : Bug fixes (0.0.x)')
  lines.push('#   - \'ignore\' : No version bump')
  lines.push('#')
  lines.push('# You can customize these rules to match your project\'s versioning strategy.')
  lines.push('#')
  lines.push('semver:')
  lines.push('  bumpRules:')

  const bumpRules = config.semver.bumpRules
  const ruleGroups = [
    { title: '# Ignored types (no version bump)', keys: ['test', 'build'] },
    {
      title: '# Patch-level changes (0.0.x) - Bug fixes and minor updates',
      keys: ['ci', 'docs', 'style', 'fix', 'perf', 'refactor', 'chore', 'patch']
    },
    { title: '# Minor-level changes (0.x.0) - New features', keys: ['feat', 'minor'] },
    { title: '# Major-level changes (x.0.0) - Breaking changes', keys: ['major', 'breaking'] }
  ]

  ruleGroups.forEach((group, groupIndex) => {
    if (groupIndex > 0) lines.push('')
    lines.push(`    ${group.title}`)
    group.keys.forEach(key => {
      if (bumpRules[key]) {
        lines.push(`    ${key}: '${bumpRules[key]}'`)
      }
    })
  })
  lines.push('')

  // Domains
  lines.push('# -----------------------------------------------------------------------------')
  lines.push('# Domain Definitions (REQUIRED)')
  lines.push('# -----------------------------------------------------------------------------')
  lines.push('#')
  lines.push('# Domains represent distinct parts of your codebase (e.g., apps, services,')
  lines.push('# libraries). PipeCraft uses domains for intelligent change detection - only')
  lines.push('# running tests for domains that have changes.')
  lines.push('#')
  lines.push('# Each domain requires:')
  lines.push('#   - paths:       Array of glob patterns matching domain files (REQUIRED)')
  lines.push('#   - description: Human-readable description (OPTIONAL)')
  lines.push('#   - prefixes:    Conventional commit prefixes for this domain (OPTIONAL)')
  lines.push('#   - testable:    Whether domain has tests (default: true, OPTIONAL)')
  lines.push('#   - deployable:  Whether domain can be deployed (default: true, OPTIONAL)')
  lines.push('#')
  lines.push('# Example domains:')
  lines.push('#   api:')
  lines.push('#     description: "Backend API service"')
  lines.push('#     paths:')
  lines.push('#       - "apps/api/**"')
  lines.push('#       - "libs/api-utils/**"')
  lines.push('#     prefixes: ["api", "backend"]')
  lines.push('#     testable: true')
  lines.push('#     deployable: true')
  lines.push('#')
  lines.push('#   web:')
  lines.push('#     description: "Frontend web application"')
  lines.push('#     paths:')
  lines.push('#       - "apps/web/**"')
  lines.push('#     testable: true')
  lines.push('#     deployable: true')
  lines.push('#')
  lines.push('#   shared:')
  lines.push('#     description: "Shared libraries"')
  lines.push('#     paths:')
  lines.push('#       - "libs/**"')
  lines.push('#     testable: true')
  lines.push('#     deployable: false  # Libraries don\'t deploy independently')
  lines.push('#')
  lines.push('domains:')

  Object.entries(config.domains).forEach(([domainName, domainConfig]: [string, any]) => {
    lines.push(`  ${domainName}:`)

    // Description (always write as field)
    if (domainConfig.description) {
      lines.push(`    description: '${domainConfig.description}'`)
    }

    // Paths
    if (domainConfig.paths) {
      lines.push('    paths:')
      domainConfig.paths.forEach((path: string) => {
        lines.push(`      - ${path}`)
      })
    }

    // Prefixes (if present)
    if (domainConfig.prefixes) {
      lines.push(`    prefixes: [${domainConfig.prefixes.map((p: string) => `'${p}'`).join(', ')}]`)
    }

    lines.push('')
  })

  // Nx Configuration (if present)
  if (config.nx) {
    lines.push('# -----------------------------------------------------------------------------')
    lines.push('# Nx Monorepo Integration (OPTIONAL)')
    lines.push('# -----------------------------------------------------------------------------')
    lines.push('#')
    lines.push('# Enables Nx-powered change detection using the dependency graph.')
    lines.push('# When enabled, PipeCraft uses "nx affected" to determine which projects')
    lines.push('# need testing, rather than path-based detection.')
    lines.push('#')
    lines.push('# enabled:     Enable/disable Nx integration (REQUIRED if nx section present)')
    lines.push('# tasks:       Nx tasks to run for affected projects (e.g., lint, test, build)')
    lines.push('# baseRef:     Git ref to compare against (default: origin/main)')
    lines.push('# enableCache: Use Nx caching for faster builds (default: true)')
    lines.push('#')
    lines.push('# Example:')
    lines.push('#   nx:')
    lines.push('#     enabled: true')
    lines.push('#     tasks:')
    lines.push('#       - lint')
    lines.push('#       - test')
    lines.push('#       - build')
    lines.push('#     baseRef: origin/main')
    lines.push('#     enableCache: true')
    lines.push('#')
    lines.push('nx:')
    lines.push(`  enabled: ${config.nx.enabled}`)
    if (config.nx.tasks !== undefined) {
      if (config.nx.tasks.length > 0) {
        lines.push('  tasks:')
        config.nx.tasks.forEach((task: string) => {
          lines.push(`    - ${task}`)
        })
      } else {
        lines.push('  tasks: []')
      }
    }
    if (config.nx.baseRef) {
      lines.push(`  baseRef: ${config.nx.baseRef}`)
    }
    if (config.nx.enableCache !== undefined) {
      lines.push(`  enableCache: ${config.nx.enableCache}`)
    }
    lines.push('')
  }

  // Versioning (if present)
  if (config.versioning) {
    lines.push('# -----------------------------------------------------------------------------')
    lines.push('# Version Calculation and Release Automation (OPTIONAL)')
    lines.push('# -----------------------------------------------------------------------------')
    lines.push('#')
    lines.push('# Controls automatic version calculation and release creation.')
    lines.push('#')
    lines.push('# enabled:            Enable/disable versioning (REQUIRED if section present)')
    lines.push('# releaseItConfig:    Path to release-it config file (OPTIONAL)')
    lines.push('# conventionalCommits: Use conventional commits for version bumps (OPTIONAL)')
    lines.push('# autoTag:            Automatically create git tags (OPTIONAL)')
    lines.push('# autoPush:           Automatically push tags and commits (OPTIONAL)')
    lines.push('# changelog:          Generate CHANGELOG.md (OPTIONAL)')
    lines.push('#')
    lines.push('# Example:')
    lines.push('#   versioning:')
    lines.push('#     enabled: true')
    lines.push('#     conventionalCommits: true')
    lines.push('#     autoTag: true')
    lines.push('#     changelog: true')
    lines.push('#')
    lines.push('versioning:')
    lines.push(`  enabled: ${config.versioning.enabled}`)
    if (config.versioning.releaseItConfig) {
      lines.push(`  releaseItConfig: ${config.versioning.releaseItConfig}`)
    }
    if (config.versioning.conventionalCommits !== undefined) {
      lines.push(
        `  conventionalCommits: ${config.versioning.conventionalCommits}  # Use conventional commits for version bumps`
      )
    }
    if (config.versioning.autoTag !== undefined) {
      lines.push(
        `  autoTag: ${config.versioning.autoTag}              # Automatically create git tags`
      )
    }
    if (config.versioning.autoPush !== undefined) {
      lines.push(
        `  autoPush: ${config.versioning.autoPush}            # Manual control over git push`
      )
    }
    if (config.versioning.changelog !== undefined) {
      lines.push(`  changelog: ${config.versioning.changelog}            # Generate CHANGELOG.md`)
    }
    if (config.versioning.bumpRules) {
      lines.push('  bumpRules:')
      Object.entries(config.versioning.bumpRules).forEach(([key, value]) => {
        lines.push(`    ${key}: ${value}`)
      })
    }
    lines.push('')
  }

  // Rebuild configuration (if present)
  if (config.rebuild) {
    lines.push('# -----------------------------------------------------------------------------')
    lines.push('# Workflow Rebuild Optimization (OPTIONAL)')
    lines.push('# -----------------------------------------------------------------------------')
    lines.push('#')
    lines.push('# Enables smart detection of when workflows need regeneration.')
    lines.push('#')
    lines.push('# enabled:          Enable/disable rebuild optimization (REQUIRED if section present)')
    lines.push('# skipIfUnchanged:  Skip regeneration if config hasn\'t changed (OPTIONAL)')
    lines.push('# forceRegenerate:  Force regenerate even if unchanged (OPTIONAL)')
    lines.push('# cacheFile:        Path to cache file (default: .pipecraft-cache.json)')
    lines.push('#')
    lines.push('# Example:')
    lines.push('#   rebuild:')
    lines.push('#     enabled: true')
    lines.push('#     skipIfUnchanged: true')
    lines.push('#     cacheFile: .pipecraft-cache.json')
    lines.push('#')
    lines.push('rebuild:')
    lines.push(`  enabled: ${config.rebuild.enabled}           # Enable smart rebuild detection`)
    if (config.rebuild.skipIfUnchanged !== undefined) {
      lines.push(
        `  skipIfUnchanged: ${config.rebuild.skipIfUnchanged}   # Skip regeneration if config hasn't changed`
      )
    }
    if (config.rebuild.forceRegenerate !== undefined) {
      lines.push(
        `  forceRegenerate: ${config.rebuild.forceRegenerate}  # Force regenerate even if unchanged`
      )
    }
    if (config.rebuild.cacheFile) {
      lines.push(`  cacheFile: ${config.rebuild.cacheFile}`)
    }
    lines.push('')
  }

  // Footer with helpful tips and links
  lines.push('# =============================================================================')
  lines.push('# Quick Reference & Tips')
  lines.push('# =============================================================================')
  lines.push('#')
  lines.push('# Next Steps:')
  lines.push('#   1. Review and adjust domain paths to match your project structure')
  lines.push('#   2. Run "npx pipecraft generate" to create CI/CD workflows')
  lines.push('#   3. Commit the generated workflows to your repository')
  lines.push('#')
  lines.push('# Common Configuration Patterns:')
  lines.push('#')
  lines.push('#   Simple 2-stage flow (develop → main):')
  lines.push('#     branchFlow: [develop, main]')
  lines.push('#     autoMerge:')
  lines.push('#       main: true')
  lines.push('#')
  lines.push('#   Standard 3-stage flow (develop → staging → main):')
  lines.push('#     branchFlow: [develop, staging, main]')
  lines.push('#     autoMerge:')
  lines.push('#       staging: true')
  lines.push('#       main: true')
  lines.push('#')
  lines.push('#   Manual promotion only:')
  lines.push('#     autoMerge:')
  lines.push('#       staging: false')
  lines.push('#       main: false')
  lines.push('#')
  lines.push('# Documentation & Support:')
  lines.push('#   - Full Documentation: https://pipecraft.thecraftlab.dev')
  lines.push('#   - Getting Started:    https://pipecraft.thecraftlab.dev/docs/getting-started')
  lines.push('#   - Configuration Ref:  https://pipecraft.thecraftlab.dev/docs/configuration')
  lines.push('#   - GitHub Issues:      https://github.com/pipecraft-lab/pipecraft/issues')
  lines.push('#   - Examples:           https://github.com/pipecraft-lab/pipecraft/tree/main/examples')
  lines.push('#')
  lines.push('# =============================================================================')

  // Remove trailing empty line
  while (lines[lines.length - 1] === '') {
    lines.pop()
  }

  lines.push('') // Single trailing newline

  return lines.join('\n')
}

/**
 * Init generator main entry point.
 *
 * Orchestrates the initialization process by:
 * 1. Prompting user for project preferences (currently unused - see note)
 * 2. Merging user input with default configuration
 * 3. Generating and writing .pipecraftrc.json file
 *
 * @param {PinionContext} ctx - Pinion generator context from CLI
 * @returns {Promise<PinionContext>} Updated context after file generation
 *
 * @throws {Error} If configuration file cannot be written
 * @throws {Error} If user input validation fails
 *
 * @example
 * ```typescript
 * // Called by Pinion framework when user runs `pipecraft init`
 * const result = await generate({
 *   cwd: '/path/to/project',
 *   argv: ['init'],
 *   pinion: { ... }
 * })
 *
 * // Results in: /path/to/project/.pipecraftrc.json
 * ```
 *
 * @note Current Behavior: Despite prompting for user input, the generator
 * currently overwrites all responses with `defaultConfig` values (line 167).
 * This ensures consistency for the initial release. Future versions will
 * respect user choices and allow customization of branch names, merge strategies,
 * and domain configurations.
 *
 * Prompts Presented (currently unused):
 * - Project name
 * - CI provider (GitHub/GitLab)
 * - Merge strategy (fast-forward/merge)
 * - Conventional commits enforcement
 * - Development branch name
 * - Production branch name
 * - Branch flow sequence
 */
export const generate = async (ctx: PinionContext) => {
  const cwd = ctx.cwd || process.cwd()

  // Check if .pipecraftrc already exists (YAML format)
  const configPath = `${cwd}/.pipecraftrc`
  const legacyConfigPath = `${cwd}/.pipecraftrc.json`

  if (existsSync(configPath) || existsSync(legacyConfigPath)) {
    const existingPath = existsSync(configPath) ? '.pipecraftrc' : '.pipecraftrc.json'
    const overwriteAnswer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `⚠️  ${existingPath} already exists. Overwrite it?`,
        default: false
      }
    ])

    if (!overwriteAnswer.overwrite) {
      console.log('\n❌ Init cancelled. Existing configuration preserved.\n')
      return
    }

    console.log('\n✅ Proceeding with overwrite...\n')

    // Set force flag to true so Pinion will overwrite the file
    if (ctx.pinion) {
      ctx.pinion.force = true
    }
  }

  // Detect package manager before prompting
  let detectedPackageManager: 'npm' | 'yarn' | 'pnpm' = 'npm'
  if (existsSync(`${cwd}/pnpm-lock.yaml`)) {
    detectedPackageManager = 'pnpm'
  } else if (existsSync(`${cwd}/yarn.lock`)) {
    detectedPackageManager = 'yarn'
  } else if (existsSync(`${cwd}/package-lock.json`)) {
    detectedPackageManager = 'npm'
  }

  // Detect Nx workspace before prompting
  const nxJsonPath = `${cwd}/nx.json`
  let detectedNxTasks: string[] = []
  let nxDetected = false

  if (existsSync(nxJsonPath)) {
    try {
      const nxJsonContent = readFileSync(nxJsonPath, 'utf8')
      const nxJson = JSON.parse(nxJsonContent)

      // Extract tasks from targetDefaults
      const tasks = nxJson.targetDefaults ? Object.keys(nxJson.targetDefaults) : []

      // Sort tasks in a logical order (quality → test → build → e2e)
      const taskOrder = [
        'lint',
        'typecheck',
        'test',
        'unit-test',
        'build',
        'integration-test',
        'e2e',
        'e2e-ci'
      ]
      detectedNxTasks = tasks.sort((a, b) => {
        const aIdx = taskOrder.indexOf(a)
        const bIdx = taskOrder.indexOf(b)
        if (aIdx === -1 && bIdx === -1) return 0
        if (aIdx === -1) return 1
        if (bIdx === -1) return -1
        return aIdx - bIdx
      })

      nxDetected = true
      console.log('\n✅ Nx workspace detected!')
      console.log(`   Found tasks: ${detectedNxTasks.join(', ')}`)
      console.log('   Pipecraft can optimize your CI pipeline using Nx affected commands.\n')
    } catch (error) {
      console.warn('\n⚠️  Found nx.json but could not parse it:', error)
      console.log('   Nx integration will use default tasks.\n')
      nxDetected = true
      detectedNxTasks = ['lint', 'test', 'build', 'integration-test']
    }
  }

  // Run inquirer prompts
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'ciProvider',
      message: 'Which CI provider are you using?',
      choices: [
        { name: 'GitHub Actions', value: 'github' },
        { name: 'GitLab CI/CD', value: 'gitlab' }
      ],
      default: 'github'
    },
    {
      type: 'list',
      name: 'mergeStrategy',
      message: 'What merge strategy do you prefer?',
      choices: [
        { name: 'Fast-forward only (recommended)', value: 'fast-forward' },
        { name: 'Merge commits', value: 'merge' }
      ],
      default: 'fast-forward'
    },
    {
      type: 'confirm',
      name: 'requireConventionalCommits',
      message: 'Require conventional commit format for PR titles?',
      default: true
    },
    {
      type: 'input',
      name: 'initialBranch',
      message: 'What is your development branch name?',
      default: 'develop'
    },
    {
      type: 'input',
      name: 'finalBranch',
      message: 'What is your production branch name?',
      default: 'main'
    },
    {
      type: 'input',
      name: 'branchFlow',
      message: 'Enter your branch flow (comma-separated)',
      default: 'develop,staging,main',
      filter: (input: string) => input.split(',').map(b => b.trim())
    },
    {
      type: 'list',
      name: 'packageManager',
      message: `Which package manager do you use? (detected: ${detectedPackageManager})`,
      choices: ['npm', 'yarn', 'pnpm'],
      default: detectedPackageManager
    },
    {
      type: 'confirm',
      name: 'enableNx',
      message: nxDetected
        ? `Enable Nx integration? (detected ${detectedNxTasks.length} tasks)`
        : 'Enable Nx integration?',
      default: nxDetected,
      when: () => nxDetected // Only show if Nx is detected
    },
    {
      type: 'list',
      name: 'domainSelection',
      message: 'What domains exist in your codebase?',
      choices: [
        { name: 'API + Web (common monorepo)', value: 'api-web' },
        { name: 'Frontend + Backend', value: 'frontend-backend' },
        { name: 'Apps + Libs (Nx-style)', value: 'apps-libs' },
        { name: 'Custom domains', value: 'custom' }
      ],
      default: 'api-web'
    }
  ])

  // Handle custom domain selection
  let selectedDomains = []
  if (answers.domainSelection === 'custom') {
    const customDomainsAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'customDomains',
        message: 'Enter your domains (comma-separated)',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'Please enter at least one domain'
          }
          const domains = input
            .split(',')
            .map(d => d.trim())
            .filter(d => d)
          if (domains.length === 0) {
            return 'Please enter valid domain names'
          }
          return true
        },
        filter: (input: string) =>
          input
            .split(',')
            .map(d => d.trim())
            .filter(d => d)
      }
    ])
    selectedDomains = customDomainsAnswer.customDomains
  } else {
    // Map predefined selections to domain names
    const domainMappings = {
      'api-web': ['api', 'web'],
      'frontend-backend': ['frontend', 'backend'],
      'apps-libs': ['apps', 'libs']
    }
    selectedDomains = domainMappings[answers.domainSelection as keyof typeof domainMappings] || [
      'api',
      'web'
    ]
  }

  // Generate domain configuration
  const domainConfig: Record<string, any> = {}
  selectedDomains.forEach((domain: string) => {
    domainConfig[domain] = {
      paths: [`${domain}/**`], // Default path pattern
      description: `${domain} application changes`
    }
  })

  // Add cicd domain for CI/CD changes
  domainConfig.cicd = {
    paths: ['.github/**'],
    description: 'CI/CD configuration changes'
  }

  // Show warning for custom domains about path editing
  if (answers.domainSelection === 'custom') {
    console.log('\n⚠️  Custom domains selected!')
    console.log('   You will need to edit the paths in .pipecraftrc after generation')
    console.log('   to match your actual project structure.\n')
  }

  // Merge answers with context and defaults
  const mergedCtx = { ...ctx, ...defaultConfig, ...answers } as any

  // Configure Nx based on detection and user confirmation
  let nxConfig:
    | { enabled: boolean; tasks: string[]; baseRef: string; enableCache: boolean }
    | undefined
  if (nxDetected && answers.enableNx) {
    console.log('\n✅ Nx integration enabled!')
    console.log(`   Tasks to run: ${detectedNxTasks.join(', ')}\n`)

    nxConfig = {
      enabled: true,
      tasks: detectedNxTasks,
      baseRef: 'origin/main',
      enableCache: true
    }
  } else if (nxDetected && !answers.enableNx) {
    console.log('\n⚠️  Nx detected but integration disabled.')
    console.log('   You can enable it later by editing .pipecraftrc\n')
  }

  const configData: any = {
    ciProvider: mergedCtx.ciProvider,
    mergeStrategy: mergedCtx.mergeStrategy,
    requireConventionalCommits: mergedCtx.requireConventionalCommits,
    initialBranch: mergedCtx.initialBranch,
    finalBranch: mergedCtx.finalBranch,
    branchFlow: mergedCtx.branchFlow,
    autoMerge: mergedCtx.autoMerge,
    packageManager: mergedCtx.packageManager,
    semver: {
      bumpRules: mergedCtx.semver.bumpRules
    },
    domains: domainConfig // Use user-selected domains instead of defaults
  }

  // Add Nx config if detected
  if (nxConfig) {
    configData.nx = nxConfig
  }

  // Generate YAML content with comments
  const yamlContent = generateYamlConfig(configData)

  // Write the .pipecraftrc file
  const outputPath = `${cwd}/.pipecraftrc`
  writeFileSync(outputPath, yamlContent, 'utf-8')

  console.log(`\n✅ Created ${outputPath}\n`)

  return mergedCtx
}
