/**
 * Path-Based Pipeline Template
 *
 * Generates a workflow that uses path-based change detection to identify which domains
 * have changed and runs appropriate test/deploy jobs.
 *
 * Uses shared operations architecture for maintainability and consistency with Nx template.
 */

import { PinionContext, renderTemplate, toFile } from '@featherscloud/pinion'
import { PipecraftConfig } from '../../types/index.js'
import { parseDocument, stringify } from 'yaml'
import fs from 'fs'
import { logger } from '../../utils/logger.js'
import { PathOperationConfig, applyPathOperations } from '../../utils/ast-path-operations.js'
import { formatIfConditions } from '../yaml-format-utils.js'
import {
  getDocumentMap,
  getMapValue,
  getCollectionItems,
  setCollectionItems,
  getPairKey,
  isYAMLMap
} from '../../utils/yaml-helpers.js'
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

interface PathBasedPipelineContext extends PinionContext {
  config: PipecraftConfig
  branchFlow: string[]
  domains: Record<string, any>
  outputPipelinePath?: string
}

/**
 * Main generator that handles merging with existing workflow
 */
export const generate = (ctx: PathBasedPipelineContext) =>
  Promise.resolve(ctx)
    .then(ctx => {
      const filePath = `${ctx.cwd || process.cwd()}/.github/workflows/pipeline.yml`
      const { config, branchFlow } = ctx
      const domains = config?.domains || {}

      // Get domain job names for dependency management
      const { testJobs, deployJobs, remoteTestJobs } = getDomainJobNames(domains)

      // Build operations array
      const operations: PathOperationConfig[] = [
        // Header (name, run-name, on triggers)
        ...createHeaderOperations({ branchFlow }),

        // Changes detection (path-based)
        createChangesJobOperation({
          domains,
          useNx: false,
          baseRef: 'main'
        }),

        // NO nx-ci job for path-based (that's the key difference!)

        // Domain test jobs (preserved for user customization)
        ...createDomainTestJobOperations({ domains }),

        // Version calculation
        createVersionJobOperation({
          testJobNames: testJobs,
          nxEnabled: false,
          baseRef: 'main'
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
        logger.verbose('📝 Creating new path-based pipeline')

        // Create new document with empty YAML map
        const doc = parseDocument('{}')
        const contents = getDocumentMap(doc)
        if (contents) {
          applyPathOperations(contents, operations, doc)
        }

        const yamlContent = stringify(doc, { lineWidth: 0, minContentWidth: 0 })
        const formattedContent = formatIfConditions(yamlContent)
        return { ...ctx, yamlContent: formattedContent, mergeStatus: 'created' }
      }

      // Parse existing file
      const existingContent = fs.readFileSync(filePath, 'utf8')
      const doc = parseDocument(existingContent)

      // Get managed jobs (always overwritten)
      const managedJobs = new Set(['changes', 'version', 'tag', 'promote', 'release'])

      // Get deprecated jobs (should be removed)
      const deprecatedJobs = new Set(['createpr', 'branch'])

      // Extract user jobs from existing (preserves comments!)
      const userJobs = new Map<string, any>()
      const existingJobs = getMapValue(doc.contents, 'jobs')

      if (existingJobs) {
        const jobItems = getCollectionItems(existingJobs)
        for (const item of jobItems) {
          const jobName = getPairKey(item)
          if (
            jobName &&
            !managedJobs.has(jobName) &&
            !deprecatedJobs.has(jobName) &&
            !testJobs.includes(jobName) &&
            !deployJobs.includes(jobName) &&
            !remoteTestJobs.includes(jobName)
          ) {
            // This is a custom user job - preserve it completely
            userJobs.set(jobName, item)
          }
        }
      }

      // Clear all jobs before applying operations to prevent duplicates
      if (existingJobs) {
        setCollectionItems(existingJobs, [])
      }

      // Apply operations to update managed jobs
      const contents = getDocumentMap(doc)
      if (contents) {
        applyPathOperations(contents, operations, doc)
      }

      // Add back user jobs (preserves their comments!)
      if (userJobs.size > 0) {
        logger.verbose(`📋 Preserving ${userJobs.size} user jobs: ${Array.from(userJobs.keys()).join(', ')}`)

        const jobsNode = getMapValue(doc.contents, 'jobs')
        if (jobsNode) {
          const currentItems = getCollectionItems(jobsNode)
          for (const [_, item] of userJobs) {
            currentItems.push(item)
          }
          setCollectionItems(jobsNode, currentItems)
        }
      }

      // Check for deprecated jobs
      const deprecatedFound = []
      if (existingJobs) {
        const jobItems = getCollectionItems(existingJobs)
        for (const item of jobItems) {
          const jobName = getPairKey(item)
          if (jobName && deprecatedJobs.has(jobName)) {
            deprecatedFound.push(jobName)
          }
        }
      }

      if (deprecatedFound.length > 0) {
        logger.verbose(`🗑️  Removed deprecated jobs: ${deprecatedFound.join(', ')}`)
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
