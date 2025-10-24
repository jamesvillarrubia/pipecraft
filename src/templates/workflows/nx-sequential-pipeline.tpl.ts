/**
 * Nx Sequential Pipeline Template
 *
 * Generates a workflow that uses Nx's affected command to intelligently test only changed projects.
 * Runs tasks sequentially in a single job, leveraging Nx's built-in caching for speed.
 *
 * This is Option 1 (Sequential Strategy) - simple, fast, and leverages Nx's intelligence.
 */

import { PinionContext, renderTemplate, toFile } from '@featherscloud/pinion'
import { PipecraftConfig } from '../../types/index.js'
import { parseDocument, stringify } from 'yaml'
import fs from 'fs'
import { logger } from '../../utils/logger.js'

interface NxPipelineContext extends PinionContext {
  config: PipecraftConfig
  branchFlow: string[]
}

export const generateNxSequentialPipeline = (ctx: NxPipelineContext) => {
  const { config } = ctx
  const nxConfig = config.nx

  if (!nxConfig || !nxConfig.enabled) {
    throw new Error('Nx configuration not found or not enabled')
  }

  const tasks = nxConfig.tasks || ['lint', 'test', 'build']
  const baseRef = nxConfig.baseRef || 'origin/main'
  const enableCache = nxConfig.enableCache !== false
  const branchList = ctx.branchFlow.join(',')
  const domains = config.domains || {}

  return `#=============================================================================
# PIPECRAFT MANAGED WORKFLOW - NX MONOREPO
#=============================================================================

# ✅ YOU CAN CUSTOMIZE:
#   - Node.js version
#   - Package manager (npm/pnpm/yarn)
#   - Cache settings
#   - test-* jobs for non-Nx domains
#   - deploy-* jobs for deployable domains
#   - remote-test-* jobs for remote testing

# ⚠️  PIPECRAFT MANAGES (do not modify):
#   - Workflow triggers and job dependencies
#   - Change detection for domain paths and Nx projects
#   - Nx affected commands and task orchestration
#   - Version calculation and promotion flow

# 📖 Learn more: https://pipecraft.thecraftlab.dev
#=============================================================================

name: "Nx CI/CD Pipeline"

run-name: "\${{ github.event_name == 'pull_request' &&
  !contains('${branchList}', github.head_ref) &&
  github.event.pull_request.title || github.ref_name }} #\${{ inputs.run_number
  || github.run_number }}\${{ inputs.version && format(' - {0}', inputs.version)
  || '' }}"

on:
  workflow_dispatch:
    inputs:
      version:
        description: The version to deploy
        required: false
        type: string
      baseRef:
        description: The base reference for Nx affected detection
        required: false
        type: string
      run_number:
        description: The original run number from develop branch
        required: false
        type: string
      commitSha:
        description: The exact commit SHA to checkout and test
        required: false
        type: string
  workflow_call:
    inputs:
      version:
        description: The version to deploy
        required: false
        type: string
      baseRef:
        description: The base reference for Nx affected detection
        required: false
        type: string
      run_number:
        description: The original run number from develop branch
        required: false
        type: string
      commitSha:
        description: The exact commit SHA to checkout and test
        required: false
        type: string
  push:
    branches:
      - ${ctx.branchFlow.map(b => `${b}`).join('\n      - ')}
  pull_request:
    types:
      - opened
      - synchronize
      - reopened
    branches:
      - ${ctx.branchFlow[0]}

jobs:
  #=============================================================================
  # CHANGES DETECTION (⚠️  Managed by Pipecraft - do not modify)
  #=============================================================================
  # Detects which domains have changed using Nx dependency graph and path-based detection
  changes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
          fetch-depth: 0
      - uses: ./.github/actions/detect-changes-nx
        id: detect
        with:
          baseRef: \${{ inputs.baseRef || '${baseRef}' }}
          useNx: 'true'
${Object.keys(domains).length > 0 ? `    outputs:
${Object.keys(domains).sort().map((domain: string) => `      ${domain}: \${{ steps.detect.outputs.${domain} }}`).join('\n')}
      nxAvailable: \${{ steps.detect.outputs.nxAvailable }}
      affectedProjects: \${{ steps.detect.outputs.affectedProjects }}` : ''}

  #=============================================================================
  # NX CI - All Tasks Sequential (⚠️  Managed by Pipecraft - do not modify)
  #=============================================================================
  # This job runs all Nx tasks sequentially using \`nx affected\`.
  # Nx handles dependency detection, caching, and parallel execution internally.
  nx-ci:
    needs: changes
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci${enableCache ? `

      - name: Cache Nx
        uses: actions/cache@v4
        with:
          path: .nx/cache
          # Cache key includes run_number to allow saving updated cache on each run
          # Nx cache accumulates computation results, so we want to save after every run
          # restore-keys ensure we start from the most recent cache on this branch
          key: nx-\${{ runner.os }}-\${{ hashFiles('package-lock.json') }}-\${{ github.ref_name }}-\${{ github.run_number }}
          restore-keys: |
            nx-\${{ runner.os }}-\${{ hashFiles('package-lock.json') }}-\${{ github.ref_name }}-
            nx-\${{ runner.os }}-\${{ hashFiles('package-lock.json') }}-
            nx-\${{ runner.os }}-` : ''}
${tasks.map(task => `
      - name: Run Nx Affected - ${task}
        run: npx nx affected --target=${task} --base=\${{ inputs.baseRef || '${baseRef}' }}`).join('')}
${Object.keys(domains).length > 0 && Object.keys(domains).some((d: string) => domains[d].testable !== false) ? `
  #=============================================================================
  # DOMAIN TESTING JOBS (✅ Customize these with your test logic)
  #=============================================================================
  # These jobs run tests for domains not covered by Nx or requiring special handling.
  # Replace the TODO comments with your actual test commands.
${Object.keys(domains).sort().filter((domain: string) => domains[domain].testable !== false).map((domain: string) => `
  test-${domain}:
    needs: changes
    if: \${{ needs.changes.outputs.${domain} == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
      # TODO: Replace with your ${domain} test logic
      - name: Run ${domain} tests
        run: |
          echo "Running tests for ${domain} domain"
          echo "Replace this with your actual test commands"
          # Example: npm test -- --testPathPattern=${domain}`).join('')}` : ''}

  #=============================================================================
  # VERSIONING (⚠️  Managed by Pipecraft - do not modify)
  #=============================================================================
  version:
    if: \${{ always() && github.event_name != 'pull_request' && needs.nx-ci.result == 'success'${Object.keys(domains).filter((d: string) => domains[d].testable !== false).length > 0 ? ` && (${Object.keys(domains).sort().filter((domain: string) => domains[domain].testable !== false).map((domain: string) => `needs.test-${domain}.result == 'success'`).join(' || ')}) && ${Object.keys(domains).sort().filter((domain: string) => domains[domain].testable !== false).map((domain: string) => `needs.test-${domain}.result != 'failure'`).join(' && ')}` : ''} }}
    needs: [ changes, nx-ci${Object.keys(domains).filter((d: string) => domains[d].testable !== false).length > 0 ? `, ${Object.keys(domains).sort().filter((domain: string) => domains[domain].testable !== false).map((domain: string) => `test-${domain}`).join(', ')}` : ''} ]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
      - uses: ./.github/actions/calculate-version
        id: version
        with:
          baseRef: \${{ inputs.baseRef || 'main' }}
          commitSha: \${{ inputs.commitSha || github.sha }}
    outputs:
      version: \${{ steps.version.outputs.version }}
${Object.keys(domains).length > 0 && Object.keys(domains).some((d: string) => domains[d].deployable === true) ? `
  #=============================================================================
  # DEPLOYMENT JOBS (✅ Customize these with your deploy logic)
  #=============================================================================
  # These jobs deploy each domain when changes are detected and tests pass.
  # Replace the TODO comments with your actual deployment commands.
${Object.keys(domains).sort().filter((domain: string) => domains[domain].deployable === true).map((domain: string) => `
  deploy-${domain}:
    needs: [ version, changes ]
    if: \${{ always() && needs.version.result == 'success' && needs.changes.outputs.${domain} == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
      # TODO: Replace with your ${domain} deployment logic
      - name: Deploy ${domain}
        run: |
          echo "Deploying ${domain} with version \${{ needs.version.outputs.version }}"
          echo "Replace this with your actual deploy commands"
          # Example: npm run deploy:${domain}`).join('')}` : ''}
${Object.keys(domains).length > 0 && Object.keys(domains).some((d: string) => domains[d].remoteTestable === true) ? `
  #=============================================================================
  # REMOTE TESTING JOBS (✅ Customize these with your remote test logic)
  #=============================================================================
  # These jobs test deployed services remotely after deployment succeeds.
  # Replace the TODO comments with your actual remote testing commands.
${Object.keys(domains).sort().filter((domain: string) => domains[domain].remoteTestable === true).map((domain: string) => `
  remote-test-${domain}:
    needs: [ deploy-${domain}, changes ]
    if: \${{ always() }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
      # TODO: Replace with your ${domain} remote testing logic
      - name: Test ${domain} remotely
        if: \${{ needs.changes.outputs.${domain} == 'true' && needs.deploy-${domain}.result == 'success' }}
        run: |
          echo "Testing ${domain} remotely"
          echo "Replace this with your actual remote test commands"
          # Example: npm run test:remote:${domain}`).join('')}` : ''}

  #=============================================================================
  # TAG & PROMOTE (⚠️  Managed by Pipecraft - do not modify)
  #=============================================================================
  tag:
    if: \${{ always() && needs.version.result == 'success' && needs.version.outputs.version != ''${(() => {
      const deployJobs = Object.keys(domains).sort().filter((d: string) => domains[d].deployable === true).map((d: string) => `deploy-${d}`)
      const remoteTestJobs = Object.keys(domains).sort().filter((d: string) => domains[d].remoteTestable === true).map((d: string) => `remote-test-${d}`)
      const allJobs = [...deployJobs, ...remoteTestJobs]
      if (allJobs.length === 0) return ''
      const noFailures = allJobs.map((job: string) => `needs.${job}.result != 'failure'`).join(' && ')
      const atLeastOneSuccess = allJobs.map((job: string) => `needs.${job}.result == 'success'`).join(' || ')
      return ` && (${noFailures}) && (${atLeastOneSuccess})`
    })()} }}
    needs: [ version${(() => {
      const deployJobs = Object.keys(domains).sort().filter((d: string) => domains[d].deployable === true).map((d: string) => `deploy-${d}`)
      const remoteTestJobs = Object.keys(domains).sort().filter((d: string) => domains[d].remoteTestable === true).map((d: string) => `remote-test-${d}`)
      const allJobs = [...deployJobs, ...remoteTestJobs]
      return allJobs.length > 0 ? `, ${allJobs.join(', ')}` : ''
    })()} ]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
      - uses: ./.github/actions/create-tag
        with:
          version: \${{ needs.version.outputs.version }}
          commitSha: \${{ inputs.commitSha || github.sha }}

  promote:
    if: \${{ always() && needs.tag.result == 'success' }}
    needs: [ tag, version ]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
      - uses: ./.github/actions/promote-branch
        with:
          version: \${{ needs.version.outputs.version }}
          currentBranch: \${{ github.ref_name }}
          nextBranch: \${{ github.ref_name == '${ctx.branchFlow[0]}' && '${ctx.branchFlow[1]}' || '${ctx.branchFlow[2]}' }}
          runNumber: \${{ github.run_number }}

  release:
    if: \${{ always() && github.ref_name == '${ctx.branchFlow[ctx.branchFlow.length - 1]}' && needs.tag.result == 'success' }}
    needs: [ tag, version ]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
      - uses: ./.github/actions/create-release
        with:
          version: \${{ needs.version.outputs.version }}
          commitSha: \${{ inputs.commitSha || github.sha }}
`
}

/**
 * Get Pipecraft-managed jobs for Nx pipelines
 */
const getNxManagedJobs = (domains: Record<string, any> = {}): Set<string> => {
  return new Set([
    'changes',
    'nx-ci',
    'version',
    'tag',
    'promote',
    'release'
  ])
}

/**
 * Get user-customizable domain jobs
 */
const getNxDomainJobs = (domains: Record<string, any> = {}): Set<string> => {
  const jobs = new Set<string>()
  Object.keys(domains).forEach(domain => {
    const domainConfig = domains[domain]
    if (domainConfig.testable !== false) jobs.add(`test-${domain}`)
    if (domainConfig.deployable === true) jobs.add(`deploy-${domain}`)
    if (domainConfig.remoteTestable === true) jobs.add(`remote-test-${domain}`)
  })
  return jobs
}

/**
 * Main generator that handles merging with existing workflow
 */
export const generate = (ctx: NxPipelineContext) =>
  Promise.resolve(ctx)
    .then((ctx) => {
      const filePath = `${ctx.cwd || process.cwd()}/.github/workflows/pipeline.yml`
      const domains = ctx.config.domains || {}

      // Generate the template
      const templateYaml = generateNxSequentialPipeline(ctx)
      const templateDoc = parseDocument(templateYaml)

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        logger.verbose('📝 Creating new Nx pipeline')
        return { ...ctx, yamlContent: templateYaml, mergeStatus: 'created' }
      }

      // Parse existing file
      const existingContent = fs.readFileSync(filePath, 'utf8')
      const existingDoc = parseDocument(existingContent)

      // Get job sets
      const managedJobs = getNxManagedJobs(domains)
      const domainJobs = getNxDomainJobs(domains)

      // Extract user jobs from existing workflow
      const existingJobs = existingDoc.contents && (existingDoc.contents as any).get ? (existingDoc.contents as any).get('jobs') : null
      const userJobs = new Map<string, any>()

      if (existingJobs && (existingJobs as any).items) {
        for (const item of existingJobs.items) {
          const jobName = item.key?.toString()
          if (jobName && !managedJobs.has(jobName) && !domainJobs.has(jobName)) {
            // This is a user-added custom job - preserve it
            userJobs.set(jobName, item)
          }
        }
      }

      if (userJobs.size > 0) {
        logger.verbose(`📋 Preserving ${userJobs.size} user jobs: ${Array.from(userJobs.keys()).join(', ')}`)

        // Add user jobs to template
        const templateJobs = templateDoc.contents && (templateDoc.contents as any).get ? (templateDoc.contents as any).get('jobs') : null
        if (templateJobs && (templateJobs as any).items) {
          for (const [jobName, jobItem] of userJobs) {
            templateJobs.items.push(jobItem)
          }
        }

        return { ...ctx, yamlContent: stringify(templateDoc), mergeStatus: 'merged' }
      }

      logger.verbose('🔄 Updating Nx pipeline (no user jobs to preserve)')
      return { ...ctx, yamlContent: templateYaml, mergeStatus: 'updated' }
    })
    .then((ctx) => {
      const outputPath = '.github/workflows/pipeline.yml'
      const status = ctx.mergeStatus === 'merged' ? '🔄 Merged with existing' :
                     ctx.mergeStatus === 'updated' ? '🔄 Updated existing' :
                     '📝 Created new'
      logger.verbose(`${status} ${outputPath}`)
      return ctx
    })
    .then(renderTemplate(
      (ctx: any) => ctx.yamlContent,
      toFile('.github/workflows/pipeline.yml')
    ))
