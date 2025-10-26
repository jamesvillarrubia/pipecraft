/**
 * Init Template Generator
 * 
 * Generates the initial PipeCraft configuration file (.pipecraftrc.json) with default settings.
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
 * // Creates .pipecraftrc.json with:
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

import { PinionContext, toFile, renderTemplate, prompt, when, writeJSON } from '@featherscloud/pinion'
import { existsSync, readFileSync } from 'fs'
import { IdempotencyManager } from '../utils/idempotency.js'
import { VersionManager } from '../utils/versioning.js'
import { PipecraftConfig } from '../types/index.js'

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
      feat: 'minor',
      fix: 'patch',
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
 * Generates a JSON string representation of the PipeCraft configuration.
 * 
 * Serializes the configuration object with proper formatting (2-space indentation)
 * for writing to .pipecraftrc.json file.
 * 
 * @param {PipecraftConfig} ctx - The configuration context to serialize
 * @returns {string} JSON string representation of the configuration
 * 
 * @note The function extracts specific fields from the context to ensure
 * only valid configuration properties are included in the output file.
 */
const configTemplate = (ctx: PipecraftConfig) => {
  const config: any = {
    ciProvider: ctx.ciProvider,
    mergeStrategy: ctx.mergeStrategy,
    requireConventionalCommits: ctx.requireConventionalCommits,
    initialBranch: ctx.initialBranch,
    finalBranch: ctx.finalBranch,
    branchFlow: ctx.branchFlow,
    autoMerge: ctx.autoMerge,
    semver: {
      bumpRules: ctx.semver.bumpRules
    },
    domains: ctx.domains
  }

  // Include Nx configuration if detected
  if (ctx.nx) {
    config.nx = ctx.nx
  }

  return JSON.stringify(config, null, 2)
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
export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then(prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'What is your project name?',
        default: 'my-project'
      },
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
      }
    ]))
    .then((ctx) => {
      const mergedCtx = { ...ctx, ...defaultConfig } as any

      // Detect Nx workspace
      const nxJsonPath = `${mergedCtx.cwd || process.cwd()}/nx.json`
      let nxConfig = undefined

      if (existsSync(nxJsonPath)) {
        try {
          const nxJsonContent = readFileSync(nxJsonPath, 'utf8')
          const nxJson = JSON.parse(nxJsonContent)

          // Extract tasks from targetDefaults
          const tasks = nxJson.targetDefaults ? Object.keys(nxJson.targetDefaults) : []

          // Sort tasks in a logical order (quality → test → build → e2e)
          const taskOrder = ['lint', 'typecheck', 'test', 'unit-test', 'build', 'integration-test', 'e2e', 'e2e-ci']
          const sortedTasks = tasks.sort((a, b) => {
            const aIdx = taskOrder.indexOf(a)
            const bIdx = taskOrder.indexOf(b)
            if (aIdx === -1 && bIdx === -1) return 0
            if (aIdx === -1) return 1
            if (bIdx === -1) return -1
            return aIdx - bIdx
          })

          console.log('✅ Nx workspace detected - enabling Nx integration')
          console.log(`   Detected tasks: ${sortedTasks.join(', ')}`)

          nxConfig = {
            enabled: true,
            tasks: sortedTasks,
            baseRef: 'origin/main',
            enableCache: true
          }
        } catch (error) {
          console.warn('⚠️  Found nx.json but could not parse it:', error)
          console.log('   Using default Nx configuration')
          nxConfig = {
            enabled: true,
            tasks: ['lint', 'test', 'build', 'integration-test'],
            baseRef: 'origin/main',
            enableCache: true
          }
        }
      }

      const configData: any = {
        ciProvider: mergedCtx.ciProvider,
        mergeStrategy: mergedCtx.mergeStrategy,
        requireConventionalCommits: mergedCtx.requireConventionalCommits,
        initialBranch: mergedCtx.initialBranch,
        finalBranch: mergedCtx.finalBranch,
        branchFlow: mergedCtx.branchFlow,
        autoMerge: mergedCtx.autoMerge,
        semver: {
          bumpRules: mergedCtx.semver.bumpRules
        },
        domains: mergedCtx.domains
      }

      // Add Nx config if detected
      if (nxConfig) {
        configData.nx = nxConfig
      }

      return writeJSON(() => configData, toFile('.pipecraftrc.json'))(mergedCtx)
    })