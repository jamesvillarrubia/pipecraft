import { PinionContext, toFile, renderTemplate, loadJSON, when } from '@featherscloud/pinion'
import { IdempotencyManager } from '../utils/idempotency'
import { FlowcraftConfig } from '../types'

// Import individual workflow templates
import { generate as generateTagWorkflow } from '../templates/jobs/_tag.yml.tpl'
import { generate as generateChangesWorkflow } from '../templates/jobs/_changes.yml.tpl'
import { generate as generateVersionWorkflow } from '../templates/jobs/_version.yml.tpl'
import { generate as generateCreatePRWorkflow } from '../templates/jobs/_createpr.yml.tpl'
import { generate as generateBranchWorkflow } from '../templates/jobs/_branch.yml.tpl'
import { generate as generateAppsWorkflow } from '../templates/jobs/_apps.yml.tpl'

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

// Changes workflow template
const changesWorkflowTemplate = (ctx: any) => {
  const domainNames = Object.keys(ctx.domains)
  const outputs = domainNames.map(name => `      ${name}: 
        value: \${{ jobs.changes.outputs.` + name + ` }}`).join('\n')
  
  const jobOutputs = domainNames.map(name => `      ${name}: \${{ steps.merge.outputs.` + name + ` }}`).join('\n')
  
  const branchCases = ctx.branchFlow.slice(0, -1).map((branch, index) => 
    `          'refs/heads/${branch}')
            base_branch='${ctx.branchFlow[index + 1]}'
            ;;`
  ).join('\n')
  
  const filters = Object.entries(ctx.domains).map(([name, config]) => 
    `          ${name}:
${config.paths.map(path => `            - '${path}'`).join('\n')}`
  ).join('\n')
  
  const mergeOutputs = domainNames.map(name => 
    `        echo "${name}=\${{ contains(steps.filter.outputs.changes, '` + name + `') || github.ref == 'refs/heads/main' || github.ref == 'refs/heads/staging' || github.ref == 'refs/heads/test' }}" >> \$GITHUB_OUTPUT`
  ).join('\n')
  
  const debugOutputs = domainNames.map(name => 
    `        echo "${name.toUpperCase()}: \${{ steps.merge.outputs.` + name + ` }}"`
  ).join('\n')

  return `name: "Changes"

on:
  workflow_call:
    outputs:
${outputs}
      
  workflow_dispatch:

jobs:
  changes:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
    outputs:
${jobOutputs}
    steps:

    - uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Set Base Branch
      id: set-base
      ## Updated ${ctx.branchFlow.length}-branch flow: ${ctx.branchFlow.join(' → ')}
      ## Each branch compares to the next in the flow
      run: |
        case '\${{ github.ref }}' in
${branchCases}
          *)
            base_branch='${ctx.branchFlow[0]}'
            ;;
        esac
        echo "Base branch determined: $base_branch"
        echo "base_branch=$base_branch" >> $GITHUB_ENV
        echo "base_branch=$base_branch" >> $GITHUB_OUTPUT

    - name: Install Git
      run: |
        apt-get update
        apt-get install -y git

    - uses: dorny/paths-filter@v3
      id: filter
      with:
        base: \${{ steps.set-base.outputs.base_branch }}
        filters: |
${filters}

    - name: Merge filter outputs with branch condition
      id: merge
      run: |
        # Force full deployment on main, staging, and test branches
${mergeOutputs}

    - name: Debug Paths Filter Outputs
      run: |
${debugOutputs}`
}

// Pipeline workflow template
const pipelineWorkflowTemplate = (ctx: any) => {
  const domainNames = Object.keys(ctx.domains)
  const domainOutputs = domainNames.map(name => 
    `      ${name}: 
        value: \${{ jobs.changes.outputs.` + name + ` }}`
  ).join('\n')

  return `name: "Pipeline"

on:
  workflow_call:
    inputs:
      version:
        description: 'The version to deploy'
        required: false
        type: string
    outputs:
${domainOutputs}
      
  workflow_dispatch:
    inputs:
      version:
        description: 'The version to deploy'
        required: false
        type: string

jobs:
  changes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: ./.github/actions/job._changes
        with:
          baseRef: \${{ inputs.baseRef || 'main' }}

  version:
    if: github.ref_name == '${ctx.initialBranch}'
    needs: changes
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: ./.github/actions/job._version
        with:
          baseRef: \${{ inputs.baseRef || 'main' }}

  tag:
    if: github.ref_name == '${ctx.initialBranch}'
    needs: version
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: \${{ secrets.GITHUB_TOKEN }}
      - uses: ./.github/actions/job._tag
        with:
          version: \${{ needs.version.outputs.nextVersion }}

  createpr:
    if: github.ref_name == '${ctx.initialBranch}'
    needs: tag
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: \${{ secrets.GITHUB_TOKEN }}
      - uses: ./.github/actions/job._createpr
        with:
          sourceBranch: \${{ github.ref_name }}
          targetBranch: '${ctx.finalBranch}'
          title: 'Release \${{ needs.version.outputs.nextVersion }}'
          body: 'Automated release PR for version \${{ needs.version.outputs.nextVersion }}'

  branch:
    if: github.ref_name == '${ctx.initialBranch}'
    needs: createpr
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: \${{ secrets.GITHUB_TOKEN }}
      - uses: ./.github/actions/job._branch
        with:
          action: 'fast-forward'
          targetBranch: '${ctx.finalBranch}'
          sourceBranch: \${{ github.ref_name }}

  apps:
    if: github.ref_name == '${ctx.initialBranch}'
    needs: branch
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: ./.github/actions/job._apps
        with:
          environment: '${ctx.environment || 'production'}'
          domains: 'api,web,libs'
          version: \${{ needs.version.outputs.nextVersion }}`
}

export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then(loadJSON(
      () => '.flowcraftrc.json',
      (config) => ({ ...ctx, ...config } as FlowcraftConfig),
      () => ({ ...ctx, ...defaultConfig } as FlowcraftConfig)
    ))
    .then(when(
      (ctx) => ctx.ciProvider === 'github',
      renderTemplate(changesWorkflowTemplate, toFile('.github/workflows/job._changes.yml'))
    ))
    .then(when(
      (ctx) => ctx.ciProvider === 'github',
      renderTemplate(pipelineWorkflowTemplate, toFile('.github/workflows/pipeline.yml'))
    ))
    .then(when(
      (ctx) => ctx.ciProvider === 'github',
      async (ctx) => {
        // Generate individual workflow templates
        await generateChangesWorkflow(ctx)
        await generateTagWorkflow(ctx)
        await generateVersionWorkflow(ctx)
        await generateCreatePRWorkflow(ctx)
        await generateBranchWorkflow(ctx)
        await generateAppsWorkflow(ctx)
        return ctx
      }
    ))