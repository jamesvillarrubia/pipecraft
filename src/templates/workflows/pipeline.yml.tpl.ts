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
import { type PathOperationConfig } from '../../utils/ast-path-operations.js'
import { RESERVED_JOB_NAMES } from '../../utils/config.js'
import { logger } from '../../utils/logger.js'
import { formatIfConditions } from '../yaml-format-utils.js'
import {
  createChangesJobOperation,
  createHeaderOperations,
  createPrefixedDomainJobOperations,
  createTagPromoteReleaseOperations,
  createVersionJobOperation,
  createManagedWorkflowDocument,
  stringifyManagedWorkflow,
  applyManagedWorkflowOperations
} from './shared/index.js'

interface PathBasedPipelineContext extends PinionContext {
  config: PipecraftConfig
  branchFlow: string[]
  domains: Record<string, any>
  outputPipelinePath?: string
  /** Only used for the example command in generated placeholder jobs. */
  packageManager?: string
}

/**
 * Header comment written at the top of generated pipelines. It states the managed-section
 * contract honestly: customizations (custom jobs, managed-job `needs`/`runs-on`, name) are
 * preserved across `pipecraft generate`; correctness-critical wiring is re-asserted; and
 * `--force` resets managed sections to defaults.
 */
export const MANAGED_WORKFLOW_HEADER = `=============================================================================
 PIPECRAFT MANAGED WORKFLOW
=============================================================================

 ✅ YOU CAN CUSTOMIZE (preserved across 'pipecraft generate'):
   - Custom jobs between the '# <--START CUSTOM JOBS-->' / '# <--END CUSTOM JOBS-->' markers
   - The 'needs' list and 'runs-on' of managed jobs
   - The workflow name

 🔒 PIPECRAFT MANAGES (re-asserted on every generate; edits here are reset):
   - Workflow triggers and the changes / version / tag / promote / release job logic
   - The gate's 'if: always()' and its fail-on-failure step

 ♻️  Regeneration PRESERVES the customizations above. To reset managed sections
    (including the gate) to template defaults, run: pipecraft generate --force

 📌 VERSION PROMOTION BEHAVIOR:
   - Only commits that trigger a version bump promote to staging/main
   - Non-versioned commits (test, build, etc.) remain on develop

 📖 Learn more: https://pipecraft.thecraftlab.dev
=============================================================================`

/**
 * Detect duplicate keys in the generated workflow (e.g. a custom job whose name collides
 * with a Pipecraft-managed job: changes/version/gate/tag/promote/release). Duplicate keys
 * make the workflow unparseable on GitHub.
 *
 * Returns the duplicate-key error messages (empty when clean). Callers surface these as a
 * non-fatal warning rather than throwing: the marker/merge path can produce duplicates in
 * messy edge cases (jobs scattered outside markers, repeated in-process regenerations), and
 * hard-failing there would regress existing preservation behavior. See ROADMAP for the
 * deeper merge-dedup fix.
 *
 * @param yamlContent - The fully generated workflow YAML, about to be written
 * @returns Duplicate-key error messages (empty array when there are none)
 */
export function findDuplicateKeyMessages(yamlContent: string): string[] {
  return parseDocument(yamlContent)
    .errors.filter(err => err.code === 'DUPLICATE_KEY')
    .map(err => err.message)
}

/**
 * Strip top-level job blocks whose name is a Pipecraft-managed job (changes/version/
 * gate/tag/promote/release) from a custom-jobs section.
 *
 * Managed jobs are emitted by the managed operations, never by the custom section. If one
 * leaks into the extracted custom section (e.g. a workflow edited so a managed job landed
 * between the markers), keeping it would duplicate the key. This is a no-op on the normal
 * case (the custom section never legitimately contains managed jobs), so preservation
 * behaviour is unchanged — it only removes the abnormal duplicate source.
 *
 * Top-level job keys sit at two-space indent; a block runs until the next top-level key.
 *
 * @param section - The custom-jobs section text (between markers), or null
 * @returns The cleaned section and the names of any managed jobs removed
 */
export function stripReservedJobBlocks(section: string | null): {
  cleaned: string | null
  removed: string[]
} {
  if (!section) return { cleaned: section, removed: [] }

  const reserved = new Set<string>(RESERVED_JOB_NAMES as readonly string[])
  const lines = section.split('\n')
  const jobStart = /^ {2}([A-Za-z0-9_-]+):/

  // Index of every top-level job key line.
  const starts: Array<{ name: string; idx: number }> = []
  lines.forEach((line, idx) => {
    const match = line.match(jobStart)
    if (match) starts.push({ name: match[1], idx })
  })

  const drop = new Array<boolean>(lines.length).fill(false)
  const removed: string[] = []
  starts.forEach((start, s) => {
    if (!reserved.has(start.name.toLowerCase())) return
    removed.push(start.name)
    const end = s + 1 < starts.length ? starts[s + 1].idx : lines.length
    for (let k = start.idx; k < end; k++) drop[k] = true
  })

  if (removed.length === 0) return { cleaned: section, removed: [] }

  const cleaned = lines
    .filter((_, idx) => !drop[idx])
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { cleaned: cleaned.length > 0 ? cleaned : null, removed: [...new Set(removed)] }
}

/** Warn (non-fatal) if the generated workflow contains duplicate keys. */
function warnOnDuplicateKeys(yamlContent: string): void {
  const duplicates = findDuplicateKeyMessages(yamlContent)
  if (duplicates.length > 0) {
    logger.warn(
      `⚠️  Generated workflow has duplicate keys — usually a custom job name colliding ` +
        `with a Pipecraft-managed job (${RESERVED_JOB_NAMES.join(', ')}). ` +
        `Rename the custom job(s) and regenerate.`
    )
    for (const message of duplicates) logger.warn(`   ${message}`)
  }
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
function generatePrefixedJobsText(
  domains: Record<string, any>,
  packageManager: string = 'npm'
): string {
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
      - uses: actions/checkout@v5
        with:
          ref: \${{ inputs.commitSha || github.sha }}
      # TODO: Replace with your ${job.domain} ${prefix} logic
      - name: Run ${prefix} for ${job.domain}
        run: |
          echo "Running ${prefix} for ${job.domain} domain"
          echo "Replace this with your actual ${prefix} commands"
          # Example: ${packageManager} run ${prefix}:${job.domain}`

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

      const fileExists = fs.existsSync(filePath)
      let existingContent = ''
      let existingEnv: Record<string, any> | null = null

      if (fileExists) {
        existingContent = fs.readFileSync(filePath, 'utf8')
        try {
          const envDoc = parseDocument(existingContent)
          const envNode =
            envDoc && typeof (envDoc as any).get === 'function' ? (envDoc as any).get('env') : null
          if (envNode && typeof (envNode as any).toJSON === 'function') {
            existingEnv = (envNode as any).toJSON()
          }
        } catch (error) {
          logger.warn(`⚠️  Failed to parse existing pipeline for runtime defaults: ${error}`)
        }
      }

      // Get job names from domains (supports both prefixes and legacy boolean flags)
      // Build operations array - only managed jobs
      const operations: PathOperationConfig[] = [
        // Header (name, run-name, on triggers)
        ...createHeaderOperations({
          branchFlow,
          // config.runtime is authoritative; fall back to the existing file's env
          nodeVersion:
            config.runtime?.nodeVersion ?? (existingEnv?.NODE_VERSION as string | undefined),
          pnpmVersion:
            config.runtime?.pnpmVersion ?? (existingEnv?.PNPM_VERSION as string | undefined),
          nodeVersionFromConfig: typeof config.runtime?.nodeVersion === 'string',
          pnpmVersionFromConfig: typeof config.runtime?.pnpmVersion === 'string'
        }),

        // Changes detection (path-based)
        createChangesJobOperation({
          domains,
          baseRef: config.finalBranch,
          config
        }),

        // Version calculation (simplified - only depends on changes)
        createVersionJobOperation({
          testJobNames: [], // No test job dependencies in new model
          baseRef: config.finalBranch,
          config
        }),

        // NOTE: Prefixed domain jobs are NOT generated via operations
        // They are generated as text and merged into the custom section below

        // Tag, promote, release
        ...createTagPromoteReleaseOperations({
          branchFlow,
          // Pass autoPromote through as-is: a global boolean (true = every hop) or a
          // per-target map. Coercing the boolean to {} here is what made `autoPromote:
          // true` silently behave as all-manual.
          autoPromote: config.autoPromote,
          mergeStrategy: config.mergeStrategy,
          config
        })
      ]

      // Extract user-customized section and custom jobs from existing file if it exists
      let userSection: string | null = null
      const customJobsFromExisting: any[] = []
      // Preserve gate job's needs and if (user may have customized them)
      let preservedGateNeeds: any = null
      let preservedGateIf: any = null
      if (fileExists) {
        userSection = extractUserSection(existingContent)
        if (userSection) {
          logger.verbose('📋 Found user-customized section between markers')
        } else {
          // Check if markers exist but are mismatched
          const hasStartMarker = /^.*#+\s*<--START CUSTOM JOBS-->\s*$/m.test(existingContent)
          const hasEndMarker = /^.*#+\s*<--END CUSTOM JOBS-->\s*$/m.test(existingContent)

          if (hasStartMarker && !hasEndMarker) {
            logger.warn('⚠️  Found START marker but missing END marker - markers are mismatched!')
            logger.warn('   Custom jobs will be preserved but markers will be fixed.')
          } else if (!hasStartMarker && hasEndMarker) {
            logger.warn('⚠️  Found END marker but missing START marker - markers are mismatched!')
            logger.warn('   Custom jobs will be preserved but markers will be fixed.')
          } else if (!hasStartMarker && !hasEndMarker) {
            logger.verbose('📋 No custom jobs markers found - will preserve existing custom jobs')
          }
        }

        // Also extract custom jobs (for force mode preservation)
        const existingDoc = parseDocument(existingContent)
        const existingJobs =
          existingDoc.contents && (existingDoc.contents as any).get
            ? (existingDoc.contents as any).get('jobs')
            : null
        const managedJobs = new Set<string>(RESERVED_JOB_NAMES as readonly string[])

        // Extract gate job's needs and if for preservation
        if (existingJobs && (existingJobs as any).get) {
          const existingGate = (existingJobs as any).get('gate')
          if (existingGate) {
            preservedGateNeeds = existingGate.get('needs')
            preservedGateIf = existingGate.get('if')
            if (preservedGateNeeds || preservedGateIf) {
              logger.verbose('📋 Preserving gate job needs/if from existing workflow')
            }
          }
        }
        if (existingJobs && (existingJobs as any).items) {
          for (const pair of (existingJobs as any).items) {
            const keyStr = pair.key instanceof Scalar ? pair.key.value : pair.key
            if (!managedJobs.has(keyStr as string)) {
              customJobsFromExisting.push(pair)
            }
          }
        }
        if (customJobsFromExisting.length > 0) {
          const customJobNames = customJobsFromExisting
            .map(pair => (pair.key instanceof Scalar ? pair.key.value : pair.key))
            .join(', ')
          logger.info(
            `📋 Preserving ${customJobsFromExisting.length} custom job(s): ${customJobNames}`
          )

          // If no userSection but custom jobs exist, convert custom jobs to YAML text
          if (!userSection && customJobsFromExisting.length > 0) {
            logger.info('   Converting custom jobs to YAML (markers were missing or mismatched)')
            try {
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
              logger.info(
                `   ✅ Successfully converted ${customJobsFromExisting.length} custom jobs`
              )
            } catch (error) {
              logger.error(`❌ Failed to convert custom jobs to YAML: ${error}`)
              logger.error('   Your custom jobs may be lost! Please backup your pipeline file.')
              throw error // Re-throw to prevent silent data loss
            }
          }
        } else {
          logger.warn('⚠️  No custom jobs found in existing pipeline')
        }
      }

      // Managed jobs are emitted separately; if any leaked into the extracted custom
      // section, drop them here so they can't duplicate the managed key in the output.
      const stripped = stripReservedJobBlocks(userSection)
      if (stripped.removed.length > 0) {
        logger.warn(
          `⚠️  Dropped ${stripped.removed.length} managed-named job(s) from the custom ` +
            `section (${stripped.removed.join(', ')}); these are managed by Pipecraft. ` +
            `Rename them if they were meant to be custom jobs.`
        )
        userSection = stripped.cleaned
      }

      // In force mode or new file, create fresh document to ensure correct structure
      if (!fileExists || ctx.pinion?.force) {
        const logMessage = !fileExists
          ? '📝 Creating new path-based pipeline'
          : '🔄 Force mode: Rebuilding path-based pipeline from scratch'
        logger.verbose(logMessage)

        const doc = createManagedWorkflowDocument(MANAGED_WORKFLOW_HEADER, operations, ctx)

        // Restore preserved gate job needs/if (for force mode)
        if (preservedGateNeeds || preservedGateIf) {
          const jobs = (doc.contents as YAMLMap)?.get('jobs') as YAMLMap | undefined
          const gateJob = jobs?.get('gate') as YAMLMap | undefined
          if (gateJob) {
            if (preservedGateNeeds) {
              gateJob.set('needs', preservedGateNeeds)
            }
            if (preservedGateIf) {
              gateJob.set('if', preservedGateIf)
            }
            logger.verbose('📋 Restored gate job needs/if from existing workflow')
          }
        }

        // Stringify to YAML
        let yamlContent = stringifyManagedWorkflow(doc)

        // Generate placeholder jobs from prefixes and merge with existing custom section
        // Echo the configured package manager into the placeholder's example command.
        // Pipecraft writes no install or toolchain steps — domain job bodies are the
        // user's — but the example it does write should match what they told us.
        const generatedPlaceholders = generatePrefixedJobsText(domains, ctx.packageManager)

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

        warnOnDuplicateKeys(yamlContent)
        const formattedContent = formatIfConditions(yamlContent)
        const status = mergedCustomContent ? 'merged' : fileExists ? 'rebuilt' : 'created'
        return { ...ctx, yamlContent: formattedContent, mergeStatus: status }
      }

      // Parse existing file for merge mode (no force flag)
      const freshContent = fs.readFileSync(filePath, 'utf8')
      const doc = parseDocument(freshContent)
      applyManagedWorkflowOperations(doc, operations, ctx)

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

      warnOnDuplicateKeys(yamlContent)
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
