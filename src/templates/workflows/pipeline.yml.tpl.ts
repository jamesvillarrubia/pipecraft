/**
 * Path-Based Pipeline Template
 *
 * Generates a workflow that uses path-based change detection to identify which domains
 * have changed and runs appropriate test/deploy jobs.
 *
 * Uses shared operations architecture for maintainability and consistency with Nx template.
 */

import { type PinionContext, renderTemplate, toFile } from '@featherscloud/pinion'
import fs from 'fs'
import { Document, parseDocument, Scalar, stringify, YAMLMap } from 'yaml'
import type { PipecraftConfig } from '../../types/index.js'
import { applyPathOperations, type PathOperationConfig } from '../../utils/ast-path-operations.js'
import { logger } from '../../utils/logger.js'
import { formatIfConditions } from '../yaml-format-utils.js'
import {
  createChangesJobOperation,
  createGateJobOperation,
  createHeaderOperations,
  createPrefixedDomainJobOperations,
  createTagPromoteReleaseOperations,
  createVersionJobOperation
} from './shared/index.js'
import { getDomainJobNames } from './shared/operations-domain-jobs.js'

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
 * Generate placeholder jobs for domains with prefixes as YAML text
 *
 * @param domains - Domain configuration
 * @returns YAML text for placeholder jobs, grouped by prefix
 */
function generatePrefixedJobsText(domains: Record<string, any>): string {
  // Group jobs by prefix
  const jobsByPrefix: Record<string, Array<{ domain: string; jobName: string }>> = {}

  Object.keys(domains)
    .sort()
    .forEach(domain => {
      const domainConfig = domains[domain]
      logger.verbose(
        `📋 Domain ${domain}: prefixes = ${
          domainConfig.prefixes ? JSON.stringify(domainConfig.prefixes) : 'undefined'
        }`
      )
      if (domainConfig.prefixes && Array.isArray(domainConfig.prefixes)) {
        domainConfig.prefixes.forEach((prefix: string) => {
          if (!jobsByPrefix[prefix]) {
            jobsByPrefix[prefix] = []
          }
          jobsByPrefix[prefix].push({
            domain,
            jobName: `${prefix}-${domain}`
          })
        })
      }
    })

  // Generate YAML text for each prefix group
  const jobTexts: string[] = []

  Object.keys(jobsByPrefix)
    .sort()
    .forEach(prefix => {
      const jobs = jobsByPrefix[prefix]

      jobs.forEach(job => {
        const jobYaml = `  ${job.jobName}:
    needs: changes
    if: \${{ needs.changes.outputs.${job.domain} == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
      # TODO: Replace with your ${job.domain} ${prefix} logic
      - name: Run ${prefix} for ${job.domain}
        run: |
          echo "Running ${prefix} for ${job.domain} domain"
          echo "Replace this with your actual ${prefix} commands"
          # Example: npm run ${prefix}:${job.domain}`

        jobTexts.push(jobYaml)
      })
    })

  return jobTexts.join('\n\n')
}

/**
 * Merge generated placeholder jobs with existing custom section content
 *
 * Only adds jobs that don't already exist in the custom section
 *
 * @param userSection - Existing custom section content (may be null)
 * @param generatedJobs - Generated placeholder jobs text
 * @returns Merged content
 */
function mergeCustomJobsContent(userSection: string | null, generatedJobs: string): string {
  if (!generatedJobs) {
    return userSection || ''
  }

  // Extract existing job names from userSection
  const existingJobNames = new Set<string>()
  if (userSection) {
    // Match job names: lines starting with spaces + jobname + :
    const jobNameRegex = /^ {2}([a-zA-Z0-9_-]+):/gm
    let match
    while ((match = jobNameRegex.exec(userSection)) !== null) {
      existingJobNames.add(match[1])
    }
  }

  logger.verbose(
    `📋 Existing custom job names: ${Array.from(existingJobNames).join(', ') || 'none'}`
  )

  // Filter generated jobs to only include those that don't exist
  const generatedJobLines = generatedJobs.split('\n\n')
  const newJobs: string[] = []
  const skippedJobs: string[] = []

  generatedJobLines.forEach(jobText => {
    // Extract job name from first line
    const jobNameMatch = jobText.match(/^ {2}([a-zA-Z0-9_-]+):/)
    if (jobNameMatch) {
      const jobName = jobNameMatch[1]
      if (!existingJobNames.has(jobName)) {
        newJobs.push(jobText)
      } else {
        skippedJobs.push(jobName)
      }
    }
  })

  logger.verbose(`📋 Generated ${newJobs.length} new placeholder job(s)`)
  if (skippedJobs.length > 0) {
    logger.verbose(`📋 Skipped ${skippedJobs.length} existing job(s): ${skippedJobs.join(', ')}`)
  }

  // Merge: existing jobs first, then new jobs
  const parts: string[] = []
  if (userSection && userSection.trim()) {
    parts.push(userSection)
  }
  if (newJobs.length > 0) {
    parts.push(newJobs.join('\n\n'))
  }

  return parts.join('\n\n')
}

/**
 * Main generator that handles merging with existing workflow
 */
export const generate = (ctx: PathBasedPipelineContext) =>
  Promise.resolve(ctx)
    .then(ctx => {
      const filePath =
        (ctx as any).pipelinePath || `${ctx.cwd || process.cwd()}/.github/workflows/pipeline.yml`
      const { config, branchFlow } = ctx
      const domains = config?.domains || {}

      // Get job names from domains (supports both prefixes and legacy boolean flags)
      const { testJobs, deployJobs, remoteTestJobs, allJobsByPrefix } = getDomainJobNames(domains)

      // Check if file exists
      const fileExists = fs.existsSync(filePath)

      // Extract user-customized section and custom jobs from existing file if it exists
      let userSection: string | null = null
      const customJobsFromExisting: any[] = []
      if (fileExists) {
        const existingContent = fs.readFileSync(filePath, 'utf8')
        userSection = extractUserSection(existingContent)
        if (userSection) {
          logger.verbose('📋 Found user-customized section between markers')
        }

        // Also extract custom jobs (for force mode preservation)
        const existingDoc = parseDocument(existingContent)
        const existingJobs =
          existingDoc.contents && (existingDoc.contents as any).get
            ? (existingDoc.contents as any).get('jobs')
            : null
        const managedJobs = new Set(['changes', 'version', 'gate', 'tag', 'promote', 'release'])
        if (existingJobs && (existingJobs as any).items) {
          for (const pair of (existingJobs as any).items) {
            const keyStr = pair.key instanceof Scalar ? pair.key.value : pair.key
            if (!managedJobs.has(keyStr as string)) {
              customJobsFromExisting.push(pair)
            }
          }
        }
        if (customJobsFromExisting.length > 0) {
          logger.verbose(`📋 Found ${customJobsFromExisting.length} custom job(s) to preserve`)

          // If no userSection but custom jobs exist, convert custom jobs to YAML text
          if (!userSection && customJobsFromExisting.length > 0) {
            // Stringify each job pair individually to get proper formatting
            const jobTexts: string[] = []

            for (const pair of customJobsFromExisting) {
              // Create a temp doc for this one job to get proper YAML formatting
              const tempDoc = new Document(new YAMLMap())
              ;(tempDoc.contents as YAMLMap).items = [pair]

              let jobYaml = tempDoc.toString({
                lineWidth: 0,
                indent: 2,
                defaultStringType: 'PLAIN',
                defaultKeyType: 'PLAIN',
                minContentWidth: 0
              })

              // Remove trailing newlines and add proper indentation (2 spaces for YAML jobs section)
              jobYaml = jobYaml
                .trim()
                .split('\n')
                .map(line => '  ' + line)
                .join('\n')
              jobTexts.push(jobYaml)
            }

            // Join all jobs with double newlines
            userSection = jobTexts.join('\n\n')
            logger.verbose('📋 Converted custom jobs to user section')
          }
        }
      }
      
      // Generate placeholder jobs from prefixes (only for new files, not during regeneration)
      let generatedPlaceholders = ''
      if (!fileExists) {
        generatedPlaceholders = generatePrefixedJobsText(domains)
      }
      
      const mergedCustomContent = mergeCustomJobsContent(userSection, generatedPlaceholders)
      
      // Extract actual job names from the merged custom content
      let actualCustomJobNames: string[] = []
      if (mergedCustomContent && mergedCustomContent.trim().length > 0) {
        // Extract job names from the merged content using regex
        const jobNameRegex = /^ {2}([a-zA-Z0-9_-]+):/gm
        let match
        while ((match = jobNameRegex.exec(mergedCustomContent)) !== null) {
          actualCustomJobNames.push(match[1])
        }
        logger.verbose(`📋 Found ${actualCustomJobNames.length} job(s) in merged content: ${actualCustomJobNames.join(', ')}`)
      }

      // Determine which job names to use for gate job
      // - Use actual job names from merged custom content if any exist
      // - Otherwise use configured jobs from domain config
      const gateJobNames = actualCustomJobNames.length > 0
        ? actualCustomJobNames
        : Array.from(new Set([...testJobs, ...deployJobs, ...Object.values(allJobsByPrefix).flat()]))
      
      logger.verbose(`📋 Gate job will reference ${gateJobNames.length} job(s): ${gateJobNames.join(', ') || 'none'}`)

      // Build operations array - only managed jobs
      const operations: PathOperationConfig[] = [
        // Header (name, run-name, on triggers)
        ...createHeaderOperations({ branchFlow }),

        // Changes detection (path-based)
        createChangesJobOperation({
          domains,
          useNx: false,
          baseRef: config.finalBranch,
          config
        }),

        // Version calculation (simplified - only depends on changes)
        createVersionJobOperation({
          testJobNames: [], // No test job dependencies in new model
          nxEnabled: false,
          baseRef: config.finalBranch,
          config
        }),

        // NOTE: Prefixed domain jobs are NOT generated via operations
        // They are generated as text and merged into the custom section below

        // Gate job (runs after ALL prefix-based jobs, gates downstream jobs)
        // Uses actual job names from merged custom content, or configured jobs for new files
        createGateJobOperation({
          testJobNames: gateJobNames.filter(j => j.startsWith('test-')),
          deployJobNames: gateJobNames.filter(j => j.startsWith('deploy-')),
          allJobsByPrefix: gateJobNames.length > 0 
            ? { custom: gateJobNames }  // Group all actual jobs under 'custom' prefix
            : {}
        }),

        // Tag, promote, release
        ...createTagPromoteReleaseOperations({
          branchFlow,
          deployJobNames: [], // No deployment dependencies in new model
          remoteTestJobNames: [],
          testJobNames: testJobs, // Pass test jobs for default tag job dependencies
          autoMerge: typeof config.autoMerge === 'object' ? config.autoMerge : {},
          config
        })
      ]

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

 📖 Learn more: https://pipecraft.thecraftlab.dev
=============================================================================`
        doc.commentBefore = headerComment

        // NOTE: Custom jobs are NOT added to the document via AST
        // They are preserved in userSection and merged with generated placeholders
        // Then inserted as text after version job (see below)

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

        // Generate placeholder jobs from prefixes and merge with existing custom section
        const generatedPlaceholders = generatePrefixedJobsText(domains)

        // Debug: log generated job names
        const generatedJobNames = generatedPlaceholders
          .split('\n\n')
          .map(j => j.match(/^ {2}([a-zA-Z0-9_-]+):/))
          .filter(m => m)
          .map(m => m![1])
        logger.verbose(
          `📋 Generated ${generatedJobNames.length} placeholder jobs: ${generatedJobNames.join(
            ', '
          )}`
        )

        const mergedCustomContent = mergeCustomJobsContent(userSection, generatedPlaceholders)

        // Insert merged custom section (user jobs + generated placeholders)
        if (mergedCustomContent && mergedCustomContent.trim().length > 0) {
          // Find the version job's outputs section
          const versionOutputsPattern =
            /^ {2}version:\s*\n(?:.*\n)*? {4}outputs:\s*\n\s*version:.*$/m
          const match = yamlContent.match(versionOutputsPattern)
          if (match) {
            const insertionIndex = match.index! + match[0].length

            const userSectionWithMarkers = `# <--START CUSTOM JOBS-->\n\n${mergedCustomContent}\n\n  # <--END CUSTOM JOBS-->`
            yamlContent =
              yamlContent.slice(0, insertionIndex) +
              '\n\n  ' +
              userSectionWithMarkers +
              '\n' +
              yamlContent.slice(insertionIndex)
            logger.verbose(
              '📋 Inserted custom jobs section (user + generated placeholders) after version job'
            )
          }
        } else if (!fileExists) {
          // For new files, add placeholder markers
          const versionOutputsPattern =
            /^( {2}version:\s*\n(?:.*\n)*? {4}outputs:\s*\n\s*version:.*)$/m
          yamlContent = yamlContent.replace(
            versionOutputsPattern,
            '$1\n\n  # <--START CUSTOM JOBS-->\n\n  # <--END CUSTOM JOBS-->\n'
          )
          logger.verbose('📝 Added placeholder user section markers')
        }

        const formattedContent = formatIfConditions(yamlContent)
        const status = mergedCustomContent ? 'merged' : fileExists ? 'rebuilt' : 'created'
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
      const versionOutputsPattern = /^ {2}version:\s*\n(?:.*\n)*? {4}outputs:\s*\n\s*version:.*$/m
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

        yamlContent =
          yamlContent.slice(0, insertionIndex) +
          '\n\n  ' +
          userSectionWithMarkers +
          '\n' +
          yamlContent.slice(insertionIndex)
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
    .then(
      renderTemplate(
        (ctx: any) => ctx.yamlContent,
        toFile((ctx: any) => ctx.outputPipelinePath || '.github/workflows/pipeline.yml')
      )
    )
