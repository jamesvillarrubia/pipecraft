import { PinionContext, toFile, renderTemplate, inject, prepend, after, before } from '@featherscloud/pinion'
import dedent from 'dedent';

// Template for injecting branches-ignore into on.push
const branchesIgnoreTemplate = (ctx: any) => `    branches-ignore:
      - 'temp-*'`

// Template for injecting workflow_dispatch inputs
const workflowDispatchTemplate = (ctx: any) => `  workflow_dispatch:
    inputs:
      migration_input:
        description: 'Perform Migration'
        default: false
        required: true
        type: boolean
      seed_input:
        description: 'Perform Seed'
        default: false
        required: true
        type: boolean`

// Template for injecting specific jobs with anchor comments
const envCheckJobTemplate = (ctx: any) => `  # FLOWCRAFT: ENV CHECK
  env-check:
    secrets: inherit
    uses: ./.github/workflows/job.env-check.yml`

const debugEnvJobTemplate = (ctx: any) => `  # FLOWCRAFT: DEBUG ENV
  debug-env:
    needs: [env-check]
    runs-on: ubuntu-latest
    steps:
      - name: Debug Environment Variables
        run: |
          echo "project_id: \${{ needs.env-check.outputs.project_id }}"
          echo "bucket: \${{ needs.env-check.outputs.bucket }}"`

const lintJobTemplate = (ctx: any) => dedent`
  #----------------------------------------------------------------------------
  # FLOWCRAFT: LINTING
  #----------------------------------------------------------------------------
  lint:
    secrets: inherit
    uses: ./.github/workflows/job.lint.yml`

const changesJobTemplate = (ctx: any) => dedent`
  #----------------------------------------------------------------------------
  # FLOWCRAFT: CHANGE DETECTION
  #----------------------------------------------------------------------------
  changes:
    secrets: inherit
    uses: ./.github/workflows/job.changes.yml`


const testingJobsTemplate = (ctx: any) => {
  const domains = Object.keys(ctx.domains).filter(d => d !== 'cicd' && ctx.domains[d].testable !== false)
  return `  # FLOWCRAFT: TESTING
${domains.map(domainName => `  ${domainName}-test:
    needs: [changes, lint]
    if: \${{ needs.changes.outputs.${domainName} == 'true' }}
    secrets: inherit
    uses: ./.github/workflows/job.app.${domainName}.test.yml`).join('\n\n')}`
}

const versioningJobTemplate = (ctx: any) => {
  const testableDomains = Object.keys(ctx.domains).filter(d => d !== 'cicd' && ctx.domains[d].testable !== false)
  const testJobs = testableDomains.map(d => d + '-test').join(', ')
  const testSuccessConditions = testableDomains.map(d => `needs.${d}-test.result == 'success'`).join(' || ')
  const testFailureConditions = testableDomains.map(d => `needs.${d}-test.result != 'failure'`).join(' && ')
  
  return `  # FLOWCRAFT: VERSIONING
  versioning:
    needs: [${testJobs}, docker-analyze, code-analyze, changes, lint]
    # allows the versioning job to run even if test jobs are skipped
    if:
      \${{ 
        always() && (
          (
            ${testSuccessConditions} || 
            needs.changes.outputs.cicd == 'true'
          ) && (
            ${testFailureConditions} &&
            needs.lint.result != 'failure'
          )
      ) || contains(fromJson('["develop", "test", "staging", "main"]'), github.ref_name) }}
    secrets: inherit
    uses: ./.github/workflows/job.version.yml`
}

const releaseJobsTemplate = (ctx: any) => {
  const deployableDomains = Object.keys(ctx.domains).filter(d => d !== 'cicd' && ctx.domains[d].deployable !== false)
  const deployJobs = deployableDomains.map(d => d + '-deploy').join(', ')
  const deploySuccessConditions = deployableDomains.map(d => `needs.${d}-deploy.result == 'success'`).join(' || ')
  const deployFailureConditions = deployableDomains.map(d => `needs.${d}-deploy.result != 'failure'`).join(' && ')
  
  return dedent`
  #----------------------------------------------------------------------------
  # FLOWCRAFT: RELEASE MANAGEMENT
  #----------------------------------------------------------------------------
  create-pr:
    needs: [${deployJobs}, versioning]
    # runs if any of the deployments are successful and non-failure
    # and the version is not empty
    # and the branch is develop, test, or staging 
    if:
      \${{ 
        always() && (
          (
            ${deploySuccessConditions} || 
            needs.versioning.result == 'success'
          ) && (
            ${deployFailureConditions} &&
            needs.versioning.result != 'failure'
          ) && needs.versioning.outputs.version != '' 
        ) && contains(fromJson('["develop", "test", "staging"]'), github.ref_name) }}
    secrets: inherit
    uses: ./.github/workflows/job.create-pr.yml
    with:
      version: \${{ needs.versioning.outputs.version }}

  tag-version:
    needs: [create-pr, versioning]
    if: \${{ always() && needs.versioning.outputs.version != '' }}
    uses: ./.github/workflows/job.tag.yml
    with:
      version: \${{ needs.versioning.outputs.version }}`
}

export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    // Inject branches-ignore into on.push if it doesn't exist
    .then(
      inject(
        branchesIgnoreTemplate,
        after('on:'),
        toFile('.github/workflows/pipeline.yml')
      )
    )
    // Inject workflow_dispatch if it doesn't exist
    .then(
      inject(
        workflowDispatchTemplate,
        after('on:'),
        toFile('.github/workflows/pipeline.yml')
      )
    )
    // Inject env-check job if it doesn't exist
    .then(
      inject(
        envCheckJobTemplate,
        after('jobs:'),
        toFile('.github/workflows/pipeline.yml')
      )
    )
    // Inject debug-env job if it doesn't exist
    .then(
      inject(
        debugEnvJobTemplate,
        after('env-check:'),
        toFile('.github/workflows/pipeline.yml')
      )
    )
    // Inject lint job if it doesn't exist
    .then(
      inject(
        lintJobTemplate,
        after('jobs:'),
        toFile('.github/workflows/pipeline.yml')
      )
    )
    // Inject changes job if it doesn't exist
    .then(
      inject(
        changesJobTemplate,
        after('jobs:'),
        toFile('.github/workflows/pipeline.yml')
      )
    )
    // Inject versioning job if it doesn't exist
    .then(
      inject(
        versioningJobTemplate,
        after('docker-analyze:'),
        toFile('.github/workflows/pipeline.yml')
      )
    )
    // Inject release jobs if they don't exist
    .then(
      inject(
        releaseJobsTemplate,
        after('versioning:'),
        toFile('.github/workflows/pipeline.yml')
      )
    )
