/**
 * Nx Pipeline Template
 *
 * Generates an Nx-optimized workflow that uses `nx affected` to intelligently test
 * only changed projects. Runs all Nx tasks sequentially in a single job, leveraging
 * Nx's built-in caching and parallel execution.
 *
 * This is Option 1 (Sequential Strategy) - simple, fast, and leverages Nx's intelligence.
 */

import { PinionContext, renderTemplate, toFile } from '@featherscloud/pinion'
import { PipecraftConfig } from '../../types/index.js'
import { parseDocument, stringify } from 'yaml'
import fs from 'fs'
import { logger } from '../../utils/logger.js'
import { PathOperationConfig, applyPathOperations, createValueFromString } from '../../utils/ast-path-operations.js'
import {
  createHeaderOperations,
  createChangesJobOperation,
  createDomainTestJobOperations,
  createDomainDeployJobOperations,
  createDomainRemoteTestJobOperations,
  createVersionJobOperation,
  createTagPromoteReleaseOperations,
  getDomainJobNames
} from './shared/index.js'
import { formatIfConditions } from '../yaml-format-utils.js'

interface NxPipelineContext extends PinionContext {
  config: PipecraftConfig
  branchFlow: string[]
  outputPipelinePath?: string
}

/**
 * Create the nx-ci job operation (Nx-specific)
 */
function createNxCiJobOperation(ctx: NxPipelineContext): PathOperationConfig {
  const { config } = ctx
  const nxConfig = config.nx!
  const enableCache = nxConfig.enableCache !== false

  const taskSteps = nxConfig.tasks
    .map(
      task => `      - name: Run Nx Affected - ${task}
        run: npx nx affected --target=${task} --base=\${{ inputs.baseRef || '${nxConfig.baseRef || 'origin/main'}' }}`
    )
    .join('\n')

  const cacheStep = enableCache
    ? `
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
            nx-\${{ runner.os }}-
`
    : ''

  return {
    path: 'jobs.nx-ci',
    operation: 'overwrite',
    commentBefore: `
=============================================================================
NX CI - All Tasks Sequential (⚠️  Managed by Pipecraft - do not modify)
=============================================================================
This job runs all Nx tasks sequentially using \`nx affected\`.
Nx handles dependency detection, caching, and parallel execution internally.
`,
    value: createValueFromString(`
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
        run: npm ci
${cacheStep}
${taskSteps}
  `)
  }
}

/**
 * Main generator that handles merging with existing workflow
 */
export const generate = (ctx: NxPipelineContext) =>
  Promise.resolve(ctx)
    .then(ctx => {
      const filePath = `${ctx.cwd || process.cwd()}/.github/workflows/pipeline.yml`
      const { config, branchFlow } = ctx
      const domains = config.domains || {}
      const nxConfig = config.nx!

      // Get domain job names for dependency management
      const { testJobs, deployJobs, remoteTestJobs } = getDomainJobNames(domains)

      // Build operations array
      const operations: PathOperationConfig[] = [
        // Header (name, run-name, on triggers)
        ...createHeaderOperations({ branchFlow }),

        // Changes detection (Nx-enabled)
        createChangesJobOperation({
          domains,
          useNx: true,
          baseRef: nxConfig.baseRef || 'origin/main'
        }),

        // Nx CI job (Nx-specific!)
        createNxCiJobOperation(ctx),

        // Domain test jobs (preserved for user customization)
        ...createDomainTestJobOperations({ domains }),

        // Version calculation
        createVersionJobOperation({
          testJobNames: testJobs,
          nxEnabled: true,
          baseRef: nxConfig.baseRef || 'origin/main'
        }),

        // Domain deploy jobs (preserved for user customization)
        ...createDomainDeployJobOperations({ domains }),

        // Domain remote test jobs (preserved for user customization)
        ...createDomainRemoteTestJobOperations({ domains }),

        // Tag, promote, release
        ...createTagPromoteReleaseOperations({
          branchFlow,
          deployJobNames: deployJobs,
          remoteTestJobNames: remoteTestJobs
        })
      ]

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        logger.verbose('📝 Creating new Nx pipeline')

        // Create new document with empty YAML map
        const doc = parseDocument('{}')
        if (doc.contents) {
          applyPathOperations(doc.contents as any, operations, doc)
        }

        const yamlContent = stringify(doc, { lineWidth: 0, minContentWidth: 0 })
        const formattedContent = formatIfConditions(yamlContent)
        return { ...ctx, yamlContent: formattedContent, mergeStatus: 'created' }
      }

      // Parse existing file
      const existingContent = fs.readFileSync(filePath, 'utf8')
      const doc = parseDocument(existingContent)

      // Get managed jobs (always overwritten)
      const managedJobs = new Set(['changes', 'nx-ci', 'version', 'tag', 'promote', 'release'])

      // Extract user jobs from existing (preserves comments!)
      const userJobs = new Map<string, any>()
      const existingJobs = doc.contents && (doc.contents as any).get ? (doc.contents as any).get('jobs') : null

      if (existingJobs && (existingJobs as any).items) {
        for (const item of existingJobs.items) {
          const jobName = item.key?.toString()
          if (jobName && !managedJobs.has(jobName) && !testJobs.includes(jobName) && !deployJobs.includes(jobName) && !remoteTestJobs.includes(jobName)) {
            // This is a custom user job - preserve it completely
            userJobs.set(jobName, item)
          }
        }
      }

      // Clear all jobs before applying operations to prevent duplicates
      if (existingJobs && (existingJobs as any).items) {
        ;(existingJobs as any).items = []
      }

      // Apply operations to update managed jobs
      if (doc.contents) {
        applyPathOperations(doc.contents as any, operations, doc)
      }

      // Add back user jobs (preserves their comments!)
      if (userJobs.size > 0) {
        logger.verbose(`📋 Preserving ${userJobs.size} user jobs: ${Array.from(userJobs.keys()).join(', ')}`)

        const jobsNode = (doc.contents as any).get('jobs')
        if (jobsNode && (jobsNode as any).items) {
          for (const [_, item] of userJobs) {
            jobsNode.items.push(item)
          }
        }
      }

      const status = userJobs.size > 0 ? 'merged' : 'updated'
      const yamlContent = stringify(doc, { lineWidth: 0, minContentWidth: 0 })
      const formattedContent = formatIfConditions(yamlContent)
      return { ...ctx, yamlContent: formattedContent, mergeStatus: status }
    })
    .then(ctx => {
      const outputPath = ctx.outputPipelinePath || '.github/workflows/pipeline.yml'
      const status =
        ctx.mergeStatus === 'merged' ? '🔄 Merged with existing' : ctx.mergeStatus === 'updated' ? '🔄 Updated existing' : '📝 Created new'
      logger.verbose(`${status} ${outputPath}`)
      return ctx
    })
    .then(renderTemplate((ctx: any) => ctx.yamlContent, toFile((ctx: any) => ctx.outputPipelinePath || '.github/workflows/pipeline.yml')))
