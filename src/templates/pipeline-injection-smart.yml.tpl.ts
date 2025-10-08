import { PinionContext, toFile, renderTemplate, inject, prepend, after, before } from '@featherscloud/pinion'

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

// Template for injecting specific jobs
const envCheckJobTemplate = (ctx: any) => `  env-check:
    secrets: inherit
    uses: ./.github/workflows/job.env-check.yml`

const debugEnvJobTemplate = (ctx: any) => `  debug-env:
    needs: [env-check]
    runs-on: ubuntu-latest
    steps:
      - name: Debug Environment Variables
        run: |
          echo "project_id: \${{ needs.env-check.outputs.project_id }}"
          echo "bucket: \${{ needs.env-check.outputs.bucket }}"`

const lintJobTemplate = (ctx: any) => `  # LINTING
  lint:
    secrets: inherit
    uses: ./.github/workflows/job.lint.yml`

const changesJobTemplate = (ctx: any) => `  # CHANGE DETECTION
  changes:
    secrets: inherit
    uses: ./.github/workflows/job.changes.yml`

const securityJobsTemplate = (ctx: any) => `  # SECURITY
  code-analyze:
    needs: [changes]
    secrets: inherit
    uses: ./.github/workflows/job.analyze.code.yml

  docker-analyze:
    needs: [changes]
    secrets: inherit
    uses: ./.github/workflows/job.analyze.docker.yml`

const testingJobsTemplate = (ctx: any) => `  # TESTING
  api-test:
    needs: [changes, lint]
    if: \${{ needs.changes.outputs.api == 'true' }}
    secrets: inherit
    uses: ./.github/workflows/job.app.api.test.yml

  web-test:
    needs: [changes, lint]
    if: \${{ needs.changes.outputs.web == 'true' }}
    secrets: inherit
    uses: ./.github/workflows/job.app.web.test.yml`

const versioningJobTemplate = (ctx: any) => `  # VERSIONING
  versioning:
    needs: [api-test, web-test, docker-analyze, code-analyze, changes, lint]
    # allows the versioning job to run even if api-test or web-test is skipped
    if:
      \${{ 
        always() && (
          (
            needs.api-test.result == 'success' || 
            needs.web-test.result == 'success' || 
            needs.changes.outputs.cicd == 'true'
          ) && (
            needs.api-test.result != 'failure' && 
            needs.web-test.result != 'failure' &&
            needs.lint.result != 'failure'
          )
      ) || contains(fromJson('["develop", "test", "staging", "main"]'), github.ref_name) }}
    secrets: inherit
    uses: ./.github/workflows/job.version.yml`

const deploymentJobsTemplate = (ctx: any) => `  # DEPLOYMENTS
  api-deploy:
    needs: [versioning, changes, env-check]
    if: \${{ 
      always() && 
      needs.changes.outputs.api == 'true' && 
      needs.versioning.outputs.version != '' && 
      contains(fromJson('["develop", "test", "staging", "main"]'), github.ref_name) }}
    secrets: inherit
    uses: ./.github/workflows/job.app.api.deploy.yml
    with:
      version: \${{ needs.versioning.outputs.version }}
      project_id: \${{ needs.env-check.outputs.project_id }}

  web-deploy:
    needs: [versioning, changes, env-check]
    if: 
      \${{ 
        always() && 
        needs.changes.outputs.web == 'true' && 
        needs.versioning.outputs.version != '' && 
        contains(fromJson('["develop", "test", "staging", "main"]'), github.ref_name) }}
    secrets: inherit
    uses: ./.github/workflows/job.app.web.deploy.yml
    with:
      version: \${{ needs.versioning.outputs.version }}
      project_id: \${{ needs.env-check.outputs.project_id }}
      bucket: \${{ needs.env-check.outputs.bucket }}`

const releaseJobsTemplate = (ctx: any) => `  create-pr:
    needs: [api-deploy, web-deploy, versioning]
    # runs if any of the deployments are successful and non-failure
    # and the version is not empty
    # and the branch is develop, test, or staging 
    if:
      \${{ 
        always() && (
          (
            needs.api-deploy.result == 'success' || 
            needs.web-deploy.result == 'success' || 
            needs.versioning.result == 'success'
          ) && (
            needs.api-deploy.result != 'failure' && 
            needs.web-deploy.result != 'failure' && 
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
    // Inject security jobs if they don't exist
    .then(
      inject(
        securityJobsTemplate,
        after('changes:'),
        toFile('.github/workflows/pipeline.yml')
      )
    )
    // Inject testing jobs if they don't exist
    .then(
      inject(
        testingJobsTemplate,
        after('docker-analyze:'),
        toFile('.github/workflows/pipeline.yml')
      )
    )
    // Inject versioning job if it doesn't exist
    .then(
      inject(
        versioningJobTemplate,
        after('web-test:'),
        toFile('.github/workflows/pipeline.yml')
      )
    )
    // Inject deployment jobs if they don't exist
    .then(
      inject(
        deploymentJobsTemplate,
        after('versioning:'),
        toFile('.github/workflows/pipeline.yml')
      )
    )
    // Inject release jobs if they don't exist
    .then(
      inject(
        releaseJobsTemplate,
        after('web-deploy:'),
        toFile('.github/workflows/pipeline.yml')
      )
    )
