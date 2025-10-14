import { PinionContext, toFile, renderTemplate, loadJSON, when } from '@featherscloud/pinion'
import { IdempotencyManager } from '../utils/idempotency.js'
import { FlowcraftConfig } from '../types/index.js'
import { readFileSync, existsSync } from 'fs'
import { parse } from 'yaml'

// Import individual workflow templates
import { generate as generateTagWorkflow } from '../templates/actions/create-tag.yml.tpl.js'
import { generate as generateChangesWorkflow } from '../templates/actions/detect-changes.yml.tpl.js'
import { generate as generateVersionWorkflow } from '../templates/actions/calculate-version.yml.tpl.js'
import { generate as generateCreatePRWorkflow } from '../templates/actions/create-pr.yml.tpl.js'
import { generate as generateBranchWorkflow } from '../templates/actions/manage-branch.yml.tpl.js'
import { generate as generatePathBasedPipeline } from '../templates/workflows/pipeline-path-based.yml.tpl.js'

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

export const generate = (ctx: PinionContext & { pipelinePath?: string, outputPipelinePath?: string, config?: any }) =>
  Promise.resolve(ctx)
    .then((ctx) => {
      console.log('🔧 Generating GitHub Actions...')
      
      // Load existing pipeline if provided
      let existingPipeline = null
      let existingPipelineContent = null
      if (ctx.pipelinePath && existsSync(ctx.pipelinePath)) {
        try {
          existingPipelineContent = readFileSync(ctx.pipelinePath, 'utf8')
          existingPipeline = parse(existingPipelineContent)
          console.log(`📖 Loaded existing pipeline from: ${ctx.pipelinePath}`)
        } catch (error) {
          console.warn(`⚠️  Failed to load existing pipeline: ${error}`)
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
        generateBranchWorkflow(ctx)
      ]).then(() => ctx)
    })
    .then((ctx) => {
      // Generate the main pipeline
      return generatePathBasedPipeline(ctx)
    })
    .then((ctx) => {
      console.log('✅ Generated workflows in: .github/workflows')
      return ctx
    })