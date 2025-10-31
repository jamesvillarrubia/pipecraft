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
  createHeaderOperations,
  createChangesJobOperation,
  createVersionJobOperation,
  createTagPromoteReleaseOperations
} from './shared/index.js'

interface PathBasedPipelineContext extends PinionContext {
  config: PipecraftConfig
  branchFlow: string[]
  domains: Record<string, any>
  outputPipelinePath?: string
}

/**
 * Extract user-customized section between markers from YAML content
 * Returns content WITHOUT the markers themselves
 * Uses unique delimiters as YAML comments (indentation-independent)
 */
function extractUserSection(yamlContent: string): string | null {
  // Match markers as YAML comments: any leading whitespace + one or more # + optional whitespace + marker
  // Example: "  ### <--START CUSTOM JOBS-->"
  const startMarkerRegex = /^.*#+\s*<--START CUSTOM JOBS-->\s*$/m
  const endMarkerRegex = /^.*#+\s*<--END CUSTOM JOBS-->\s*$/m

  const startMatch = yamlContent.match(startMarkerRegex)
  const endMatch = yamlContent.match(endMarkerRegex)

  if (!startMatch || !endMatch) {
    return null
  }

  const startIndex = startMatch.index! + startMatch[0].length
  const endIndex = endMatch.index!

  // Extract content between markers (NOT including the markers themselves)
  let extracted = yamlContent.substring(startIndex, endIndex)

  // Normalize whitespace: remove leading/trailing newlines
  // These will be added back consistently during insertion
  extracted = extracted.replace(/^\n+/, '')
  extracted = extracted.replace(/\n+$/, '')

  return extracted
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

      // Build operations array - only managed jobs
      const operations: PathOperationConfig[] = [
        // Header (name, run-name, on triggers)
        ...createHeaderOperations({ branchFlow }),

        // Changes detection (path-based)
        createChangesJobOperation({
          domains,
          useNx: false,
          baseRef: config.finalBranch
        }),

        // Version calculation (simplified - only depends on changes)
        createVersionJobOperation({
          testJobNames: [], // No test job dependencies in new model
          nxEnabled: false,
          baseRef: config.finalBranch
        }),

        // Tag, promote, release
        ...createTagPromoteReleaseOperations({
          branchFlow,
          deployJobNames: [], // No deployment dependencies in new model
          remoteTestJobNames: []
        })
      ]

      // Check if file exists
      const fileExists = fs.existsSync(filePath)

      // Extract user-customized section from existing file if it exists
      let userSection: string | null = null
      if (fileExists) {
        const existingContent = fs.readFileSync(filePath, 'utf8')
        userSection = extractUserSection(existingContent)
        if (userSection) {
          logger.verbose('📋 Found user-customized section between markers')
        }
      }

      // In force mode or new file, create fresh document to ensure correct structure
      if (!fileExists || ctx.pinion?.force) {
        const logMessage = !fileExists
          ? '📝 Creating new path-based pipeline'
          : '🔄 Force mode: Rebuilding path-based pipeline from scratch'
        logger.verbose(logMessage)

        // Create new document with empty YAML map
        const doc = parseDocument('{}')
        // Ensure the root map uses block style (not flow/compact)
        if (doc.contents && (doc.contents as any).flow !== undefined) {
          ;(doc.contents as any).flow = false
        }

        // Add header comment block to document
        const headerComment = `=============================================================================
 PIPECRAFT MANAGED WORKFLOW
=============================================================================

 ✅ YOU CAN CUSTOMIZE:
   - Custom jobs between the '# <--START CUSTOM JOBS-->' and '# <--END CUSTOM JOBS-->' comment markers
   - Workflow name

 ⚠️  PIPECRAFT MANAGES (do not modify):
   - Workflow triggers, job dependencies, and conditionals
   - Changes detection, version calculation, and tag creation
   - Tag, promote, and release jobs

 📌 VERSION PROMOTION BEHAVIOR:
   - Only commits that trigger a version bump will promote to staging/main
   - Non-versioned commits (test, build, etc.) remain on develop
   - This keeps staging/main aligned with tagged releases

 Running 'pipecraft generate' updates managed sections while preserving
 your customizations in test/deploy/remote-test jobs.

 📖 Learn more: https://docs.pipecraft.dev
=============================================================================`
        doc.commentBefore = headerComment

        if (doc.contents) {
          applyPathOperations(doc.contents as any, operations, doc)
        }

        // Stringify to YAML
        let yamlContent = stringify(doc, {
          lineWidth: 0,
          indent: 2,
          defaultStringType: 'PLAIN',
          defaultKeyType: 'PLAIN',
          minContentWidth: 0
        })

        // Insert user section after version job if it exists
        // Find the version job's outputs section
        const versionOutputsPattern = /^  version:\s*\n(?:.*\n)*?    outputs:\s*\n\s*version:.*$/m
        const match = yamlContent.match(versionOutputsPattern)
        if (match) {
          const insertionIndex = match.index! + match[0].length

          // If no user section exists, create default with test-gate example
          const defaultCustomSection = `#=============================================================================
  # CUSTOM JOBS SECTION (✅ Add your test, deploy, and remote-test jobs here)
  #=============================================================================
  # This section is preserved across regenerations. Add your custom jobs between
  # the START and END markers below.
  #
  # Example: test-gate pattern (recommended for production workflows)
  # Uncomment and customize the example below to prevent deployments when tests fail.

  # test-gate:
  #   needs: [ ]  # TODO: Add all test job names (e.g., test-api, test-frontend)
  #   if: always()  # TODO: Add failure checks and success conditions
  #   runs-on: ubuntu-latest
  #   steps:
  #     - run: echo "✅ All tests passed"`

          const contentToInsert = userSection || defaultCustomSection
          const userSectionWithMarkers = `# <--START CUSTOM JOBS-->\n\n${contentToInsert}\n\n  # <--END CUSTOM JOBS-->`

          if (userSection) {
            logger.verbose('📋 Inserting preserved user section between markers')
          } else {
            logger.verbose('📝 Creating default custom section with test-gate example')
          }

          yamlContent = yamlContent.slice(0, insertionIndex) + '\n\n  ' + userSectionWithMarkers + '\n' + yamlContent.slice(insertionIndex)
        }

        const formattedContent = formatIfConditions(yamlContent)
        const status = userSection ? 'merged' : (fileExists ? 'rebuilt' : 'created')
        return { ...ctx, yamlContent: formattedContent, mergeStatus: status }
      }

      // Parse existing file for merge mode (no force flag)
      const existingContent = fs.readFileSync(filePath, 'utf8')
      const doc = parseDocument(existingContent)

      // Apply operations to update managed jobs
      if (doc.contents) {
        applyPathOperations(doc.contents as any, operations, doc)
      }

      // Stringify to YAML
      let yamlContent = stringify(doc, {
        lineWidth: 0,
        indent: 2,
        defaultStringType: 'PLAIN',
        defaultKeyType: 'PLAIN',
        minContentWidth: 0
      })

      // Insert user section after version job if it exists
      // Find the version job's outputs section
      const versionOutputsPattern = /^  version:\s*\n(?:.*\n)*?    outputs:\s*\n\s*version:.*$/m
      const match = yamlContent.match(versionOutputsPattern)
      if (match) {
        const insertionIndex = match.index! + match[0].length

        // If no user section exists, create default with test-gate example
        const defaultCustomSection = `#=============================================================================
  # CUSTOM JOBS SECTION (✅ Add your test, deploy, and remote-test jobs here)
  #=============================================================================
  # This section is preserved across regenerations. Add your custom jobs between
  # the START and END markers below.
  #
  # Example: test-gate pattern (recommended for production workflows)
  # Uncomment and customize the example below to prevent deployments when tests fail.

  # test-gate:
  #   needs: [ ]  # TODO: Add all test job names (e.g., test-api, test-frontend)
  #   if: always()  # TODO: Add failure checks and success conditions
  #   runs-on: ubuntu-latest
  #   steps:
  #     - run: echo "✅ All tests passed"`

        const contentToInsert = userSection || defaultCustomSection
        const userSectionWithMarkers = `# <--START CUSTOM JOBS-->\n\n${contentToInsert}\n\n  # <--END CUSTOM JOBS-->`

        if (userSection) {
          logger.verbose('📋 Inserting preserved user section between markers')
        } else {
          logger.verbose('📝 Creating default custom section with test-gate example')
        }

        yamlContent = yamlContent.slice(0, insertionIndex) + '\n\n  ' + userSectionWithMarkers + '\n' + yamlContent.slice(insertionIndex)
      }

      const formattedContent = formatIfConditions(yamlContent)
      const status = userSection ? 'merged' : 'updated'
      return { ...ctx, yamlContent: formattedContent, mergeStatus: status }
    })
    .then(ctx => {
      const outputPath = ctx.outputPipelinePath || '.github/workflows/pipeline.yml'
      const status =
        ctx.mergeStatus === 'merged'
          ? '🔄 Merged with existing'
          : ctx.mergeStatus === 'updated'
            ? '🔄 Updated existing'
            : ctx.mergeStatus === 'rebuilt'
              ? '🔄 Rebuilt from scratch'
              : '📝 Created new'
      logger.verbose(`${status} ${outputPath}`)
      return ctx
    })
    .then(renderTemplate((ctx: any) => ctx.yamlContent, toFile((ctx: any) => ctx.outputPipelinePath || '.github/workflows/pipeline.yml')))
