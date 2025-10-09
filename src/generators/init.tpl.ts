import { PinionContext, toFile, renderTemplate, prompt, when, writeJSON } from '@featherscloud/pinion'
import { existsSync } from 'fs'
import { IdempotencyManager } from '../utils/idempotency'
import { VersionManager } from '../utils/versioning'
import { FlowcraftConfig } from '../types'

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

const configTemplate = (ctx: FlowcraftConfig) => {
  const config = {
    ciProvider: ctx.ciProvider,
    mergeStrategy: ctx.mergeStrategy,
    requireConventionalCommits: ctx.requireConventionalCommits,
    initialBranch: ctx.initialBranch,
    finalBranch: ctx.finalBranch,
    branchFlow: ctx.branchFlow,
    semver: {
      bumpRules: ctx.semver.bumpRules
    },
    actions: {
      onDevelopMerge: ctx.actions.onDevelopMerge,
      onStagingMerge: ctx.actions.onStagingMerge
    },
    domains: ctx.domains
  }
  
  return JSON.stringify(config, null, 2)
}


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
    .then((ctx) => ({ ...ctx, ...defaultConfig } as FlowcraftConfig))
    .then(renderTemplate(configTemplate, toFile('.flowcraftrc.json')))