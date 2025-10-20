/**
 * Workflows Template Generator
 * 
 * Main orchestrator for generating complete GitHub Actions CI/CD pipeline.
 * This generator creates all necessary workflow files including:
 * - Main pipeline workflow (path-based change detection)
 * - Reusable composite actions (tag creation, versioning, branch management, etc.)
 * 
 * The generator supports both initial generation and incremental updates, preserving
 * user modifications to existing workflows through intelligent merging.
 * 
 * @module generators/workflows.tpl
 * 
 * @example
 * ```typescript
 * import { generate } from './generators/workflows.tpl.js'
 * 
 * // Initial generation - creates all workflows
 * await generate({
 *   cwd: '/path/to/project',
 *   config: pipecraftConfig
 * })
 * 
 * // Incremental update - merges with existing pipeline
 * await generate({
 *   cwd: '/path/to/project',
 *   pipelinePath: '.github/workflows/pipeline.yml',
 *   config: pipecraftConfig
 * })
 * 
 * // Creates:
 * // .github/workflows/pipeline.yml         - Main pipeline
 * // .github/actions/detect-changes/...     - Change detection action
 * // .github/actions/calculate-version/...  - Version calculation action
 * // .github/actions/create-tag/...         - Tag creation action
 * // .github/actions/create-pr/...          - PR creation action
 * // .github/actions/manage-branch/...      - Branch management action
 * // .github/actions/promote-branch/...     - Branch promotion action
 * ```
 */

import { PinionContext, toFile, renderTemplate, loadJSON, when } from '@featherscloud/pinion'
import { IdempotencyManager } from '../utils/idempotency.js'
import { PipecraftConfig } from '../types/index.js'
import { readFileSync, existsSync } from 'fs'
import { parse } from 'yaml'
import { logger } from '../utils/logger.js'

// Import individual workflow templates
import { generate as generateTagWorkflow } from '../templates/actions/create-tag.yml.tpl.js'
import { generate as generateChangesWorkflow } from '../templates/actions/detect-changes.yml.tpl.js'
import { generate as generateVersionWorkflow } from '../templates/actions/calculate-version.yml.tpl.js'
import { generate as generateCreatePRWorkflow } from '../templates/actions/create-pr.yml.tpl.js'
import { generate as generateBranchWorkflow } from '../templates/actions/manage-branch.yml.tpl.js'
import { generate as generatePromoteBranchWorkflow } from '../templates/actions/promote-branch.yml.tpl.js'
import { generate as generatePathBasedPipeline } from '../templates/workflows/pipeline-path-based.yml.tpl.js'

/**
 * Default fallback configuration when no config file exists.
 * Mirrors `defaultConfig` from init.tpl.ts to ensure consistent behavior.
 * 
 * @const
 * @see {@link module:generators/init.tpl~defaultConfig}
 */
const defaultConfig = {
  ciProvider: 'github' as const,
  mergeStrategy: 'fast-forward' as const,
  requireConventionalCommits: true,
  initialBranch: 'develop',
  finalBranch: 'main',
  branchFlow: ['develop', 'staging', 'main'],
  semver: {
    bumpRules: {
      feat: 'minor',
      fix: 'patch',
      breaking: 'major'
    }
  },
  actions: {
    onDevelopMerge: ['runTests', 'fastForwardToStaging'],
    onStagingMerge: ['runTests', 'calculateVersion', 'createOrFastForwardToMain']
  },
  domains: {
    api: { paths: ['apps/api/**'], description: 'API application changes' },
    web: { paths: ['apps/web/**'], description: 'Web application changes' },
    libs: { paths: ['libs/**'], description: 'Shared library changes' },
    cicd: { paths: ['.github/workflows/**'], description: 'CI/CD configuration changes' }
  }
}

/**
 * Workflows generator main entry point.
 * 
 * Orchestrates the complete workflow generation process:
 * 1. Loads existing pipeline (if specified) for merging
 * 2. Merges configuration with defaults
 * 3. Generates all composite actions in parallel
 * 4. Generates the main pipeline workflow
 * 
 * @param {PinionContext & { pipelinePath?: string, outputPipelinePath?: string, config?: any }} ctx - Extended Pinion context
 * @param {string} [ctx.pipelinePath] - Path to existing pipeline for incremental updates
 * @param {string} [ctx.outputPipelinePath] - Custom output path for pipeline (defaults to .github/workflows/pipeline.yml)
 * @param {PipecraftConfig} [ctx.config] - PipeCraft configuration (overrides defaults)
 * @returns {Promise<PinionContext>} Updated context after workflow generation
 * 
 * @throws {Error} If workflow files cannot be written
 * @throws {Error} If existing pipeline cannot be parsed
 * 
 * @example
 * ```typescript
 * // Initial generation with config
 * await generate({
 *   cwd: '/path/to/project',
 *   config: {
 *     ciProvider: 'github',
 *     branchFlow: ['develop', 'staging', 'main'],
 *     domains: { api: { paths: ['src/api/**'] } }
 *   }
 * })
 * 
 * // Update existing pipeline
 * await generate({
 *   cwd: '/path/to/project',
 *   pipelinePath: '.github/workflows/pipeline.yml',
 *   config: updatedConfig
 * })
 * ```
 * 
 * @note The generator creates 7 files:
 * - 1 main workflow (pipeline.yml)
 * - 6 composite actions (in .github/actions/)
 * 
 * All actions are generated in parallel for performance, followed by
 * the main pipeline which may reference the actions.
 */
export const generate = (ctx: PinionContext & { pipelinePath?: string, outputPipelinePath?: string, config?: any }) =>
  Promise.resolve(ctx)
    .then((ctx) => {
      logger.info('🔧 Generating GitHub Actions...')

      // Load existing pipeline if provided
      let existingPipeline = null
      let existingPipelineContent = null
      if (ctx.pipelinePath && existsSync(ctx.pipelinePath)) {
        try {
          existingPipelineContent = readFileSync(ctx.pipelinePath, 'utf8')
          existingPipeline = parse(existingPipelineContent)
          logger.verbose(`📖 Loaded existing pipeline from: ${ctx.pipelinePath}`)
        } catch (error) {
          logger.warn(`⚠️  Failed to load existing pipeline: ${error}`)
        }
      }

      return { ...ctx, ...defaultConfig, ...ctx.config, ...ctx, existingPipeline, existingPipelineContent, outputPipelinePath: ctx.outputPipelinePath }
    })
    .then((ctx) => {
      // Generate individual GitHub Actions
      return Promise.all([
        generateChangesWorkflow(ctx),
        generateTagWorkflow(ctx),
        generateVersionWorkflow(ctx),
        generateCreatePRWorkflow(ctx),
        generateBranchWorkflow(ctx),
        generatePromoteBranchWorkflow(ctx)
      ]).then(() => ctx)
    })
    .then((ctx) => {
      // Generate the main pipeline
      return generatePathBasedPipeline(ctx)
    })
    .then((ctx) => {
      logger.success('✅ Generated workflows in: .github/workflows')
      return ctx
    })