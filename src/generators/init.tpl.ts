import { PinionContext, toFile, renderTemplate, prompt, when, writeJSON, loadJSON } from '@featherscloud/pinion'
import { existsSync } from 'fs'
import { join } from 'path'

export interface FlowcraftContext extends PinionContext {
  projectName: string
  ciProvider: 'github' | 'gitlab'
  mergeStrategy: 'fast-forward' | 'merge'
  requireConventionalCommits: boolean
  initialBranch: string
  finalBranch: string
  branchFlow: string[]
  domains: Record<string, { paths: string[], description: string }>
  semver: {
    bumpRules: Record<string, string>
  }
  actions: {
    onDevelopMerge: string[]
    onStagingMerge: string[]
  }
}

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

const configTemplate = (ctx: FlowcraftContext) => `{
  "ciProvider": "${ctx.ciProvider}",
  "mergeStrategy": "${ctx.mergeStrategy}",
  "requireConventionalCommits": ${ctx.requireConventionalCommits},
  "initialBranch": "${ctx.initialBranch}",
  "finalBranch": "${ctx.finalBranch}",
  "branchFlow": ${JSON.stringify(ctx.branchFlow, null, 2)},
  "semver": {
    "bumpRules": ${JSON.stringify(ctx.semver.bumpRules, null, 4)}
  },
  "actions": {
    "onDevelopMerge": ${JSON.stringify(ctx.actions.onDevelopMerge)},
    "onStagingMerge": ${JSON.stringify(ctx.actions.onStagingMerge)}
  },
  "domains": ${JSON.stringify(ctx.domains, null, 2)}
}`

const readmeTemplate = (ctx: FlowcraftContext) => `# ${ctx.projectName}

This project uses Flowcraft for automated branching and release management.

## Branching Strategy

- **${ctx.initialBranch}**: Active development branch
- **${ctx.branchFlow.slice(1, -1).join(', ')}**: Staging/validation branches  
- **${ctx.finalBranch}**: Production branch

## Workflow

1. Create feature branches from \`${ctx.initialBranch}\`
2. Submit PRs with conventional commit titles
3. Automated promotion through branch flow
4. Automatic versioning and tagging

## Commands

\`\`\`bash
# Initialize Flowcraft
npx flowcraft init

# Generate workflows
npx flowcraft generate

# Validate configuration
npx flowcraft validate

# Promote to next environment
npx flowcraft promote
\`\`\`
`

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
    .then((ctx) => ({ ...ctx, ...defaultConfig } as FlowcraftContext))
    .then(renderTemplate(configTemplate, toFile('.trunkflowrc.json')))
    .then(renderTemplate(readmeTemplate, toFile('FLOWCRAFT.md')))
    .then(when(
      (ctx) => ctx.ciProvider === 'github',
      renderTemplate(() => `# GitHub Actions Workflows

This directory contains auto-generated GitHub Actions workflows for Flowcraft.

## Workflows

- \`pipeline.yml\`: Main orchestration workflow
- \`job.changes.yml\`: Change detection
- \`job.version.yml\`: Version calculation
- \`job.tag.yml\`: Tag creation
- \`job.createpr.yml\`: PR management
- \`job.branch.yml\`: Branch operations
- \`job.apps.yml\`: Application deployment

## Usage

These workflows are automatically generated and should not be manually edited.
To update them, modify your \`.trunkflowrc.json\` configuration and run:

\`\`\`bash
npx flowcraft generate
\`\`\`
`, toFile('.github/workflows/README.md')))
    .then(when(
      (ctx) => ctx.ciProvider === 'gitlab',
      renderTemplate(() => `# GitLab CI/CD Pipelines

This directory contains auto-generated GitLab CI/CD pipelines for Flowcraft.

## Pipelines

- \`.gitlab-ci.yml\`: Main pipeline configuration
- \`jobs/\`: Individual job definitions

## Usage

These pipelines are automatically generated and should not be manually edited.
To update them, modify your \`.trunkflowrc.json\` configuration and run:

\`\`\`bash
npx flowcraft generate
\`\`\`
`, toFile('.gitlab-ci/README.md')))
