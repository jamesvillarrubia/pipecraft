import { PinionContext, toFile, renderTemplate, loadJSON, when } from '@featherscloud/pinion'
import { IdempotencyManager } from '../utils/idempotency'
import { FlowcraftConfig } from '../types'

// Import individual workflow templates
import { generate as generateTagWorkflow } from '../templates/actions/create-tag.yml.tpl'
import { generate as generateChangesWorkflow } from '../templates/actions/detect-changes.yml.tpl'
import { generate as generateVersionWorkflow } from '../templates/actions/calculate-version.yml.tpl'
import { generate as generateCreatePRWorkflow } from '../templates/actions/create-pr.yml.tpl'
import { generate as generateBranchWorkflow } from '../templates/actions/manage-branch.yml.tpl'
import { generate as generateASTPipeline } from '../templates/workflows/pipeline-ast-based.yml.tpl'

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

export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then((ctx) => {
      console.log('🔧 Generating GitHub Actions...')
      return { ...ctx, ...defaultConfig, ...ctx }
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
      return generateASTPipeline(ctx)
    })
    .then((ctx) => {
      console.log('✅ Generated workflows in: .github/workflows')
      return ctx
    })