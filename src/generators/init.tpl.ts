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

  // Header
  lines.push('# PipeCraft Configuration')
  lines.push('# Trunk-based development workflow automation')
  lines.push('# https://pipecraft.thecraftlab.dev')
  lines.push('')

  // CI Provider
  lines.push('# CI/CD Platform')
  lines.push(`ciProvider: ${config.ciProvider}`)
  lines.push('')

  // Merge Strategy
  lines.push('# Merge strategy for automatic promotions')
  lines.push(
    "# Options: 'fast-forward' (clean linear history, recommended) | 'merge' (creates merge commits)"
  )
  lines.push(`mergeStrategy: ${config.mergeStrategy}`)
  lines.push('')

  // Conventional Commits
  lines.push('# Enforce conventional commit messages (feat:, fix:, etc.)')
  lines.push(`requireConventionalCommits: ${config.requireConventionalCommits}`)
  lines.push('')

  // Branch Configuration
  lines.push('# Branch flow configuration')
  lines.push(`initialBranch: ${config.initialBranch}  # Where features land`)
  lines.push(`finalBranch: ${config.finalBranch}       # Production branch`)
  lines.push('')

  // Branch Flow
  lines.push(`# Promotion flow: ${config.branchFlow.join(' → ')}`)
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
  lines.push('# Automatic promotion after successful tests')
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
    lines.push('# Package manager')
    lines.push(`packageManager: ${config.packageManager}`)
    lines.push('')
  }

  // Semantic Versioning
  lines.push('# Semantic versioning rules')
  lines.push('# Prefixes are used to determine the type of change and the version bump level')
  lines.push('semver:')
  lines.push('  bumpRules:')

  const bumpRules = config.semver.bumpRules
  const ruleGroups = [
    { title: '# Ignored types (no version bump)', keys: ['test', 'build'] },
    {
      title: '# Patch-level changes (0.0.x)',
      keys: ['ci', 'docs', 'style', 'fix', 'perf', 'refactor', 'chore', 'patch']
    },
    { title: '# Minor-level changes (0.x.0)', keys: ['feat', 'minor'] },
    { title: '# Major-level changes (x.0.0)', keys: ['major', 'breaking'] }
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
  lines.push('# Domain definitions - what parts of your codebase trigger which jobs')
  lines.push(
    '# Will create placeholder jobs for each domain if no jobs are defined in the pipeline.yml'
  )
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
    lines.push('# Nx integration for monorepo optimization')
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
    lines.push('# Version calculation and release automation')
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
    lines.push('# Workflow rebuild optimization')
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
