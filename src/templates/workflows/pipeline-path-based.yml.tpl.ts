import { PinionContext, toFile, renderTemplate } from '@featherscloud/pinion'
import { parseDocument, stringify, Scalar } from 'yaml'
import fs from 'fs'
import {
  applyPathOperations,
  PathOperationConfig,
  createValueFromString
} from '../../utils/ast-path-operations.js'
import dedent from 'dedent';

/**
 * Path-based pipeline generator
 * 
 * Uses precise AST path operations to:
 * - Ensure required paths exist
 * - Set/merge/overwrite specific values
 * - Preserve user customizations while ensuring template requirements
 */


/**
 * Get minimal base template - just enough structure to be parsed
 * All actual content is defined via operations list
 */
const getBaseTemplate = (ctx: any) => {
  return dedent`
    name: "Pipeline"
    on:
    jobs:
  `
}

/**
 * Define which jobs Pipecraft owns vs user jobs
 */
const getPipecraftOwnedJobs = (branchFlow: string[], domains: Record<string, any> = {}): Set<string> => {
  const jobs = new Set([
    'changes',
    'version',
    'tag',
    'promote'  // Single promote job instead of multiple promote-to-{target} jobs
  ])

  // Add domain-based jobs (test-*, deploy-*, remote-test-*) based on flags
  Object.keys(domains).forEach(domain => {
    const domainConfig = domains[domain]
    if (domainConfig.test !== false) jobs.add(`test-${domain}`)
    if (domainConfig.deploy === true) jobs.add(`deploy-${domain}`)
    if (domainConfig.remoteTest === true) jobs.add(`remote-test-${domain}`)
  })

  return jobs
}

/**
 * Check if a job is owned by Pipecraft
 */
const isPipecraftJob = (jobName: string, branchFlow: string[]): boolean => {
  return getPipecraftOwnedJobs(branchFlow).has(jobName)
}

/**
 * Create path-based pipeline content
 */
export const createPathBasedPipeline = (ctx: any) => {
  const branchFlow = ctx.branchFlow || ['develop', 'staging', 'main']
  console.log('🔍 Branch flow from context:', branchFlow)
  console.log('🔍 Context keys:', Object.keys(ctx))
  
  // Use existing pipeline from context or start with base template
  let doc: any
  let hasExistingPipeline = false
  
  if (ctx.existingPipelineContent) {
    // Parse the original YAML content WITHOUT source tokens
    // This prevents old comments from being preserved when we rebuild
    doc = parseDocument(ctx.existingPipelineContent)
    hasExistingPipeline = true
    console.log('🔄 Merging with existing pipeline from existingPipelineContent')
  } else if (ctx.existingPipeline) {
    // Convert existing pipeline object to YAML string first
    const existingYaml = stringify(ctx.existingPipeline)
    doc = parseDocument(existingYaml)
    hasExistingPipeline = true
    console.log('🔄 Merging with existing pipeline from existingPipeline object')
  } else {
    doc = parseDocument(getBaseTemplate(ctx))
    console.log('📝 Creating new pipeline')
  }
  
  if (!doc.contents) {
    throw new Error('Failed to parse pipeline document')
  }
  
  // Apply path-based operations
  const operations: PathOperationConfig[] = [

    // =============================================================================
    // WORKFLOW METADATA - Name and run identification
    // =============================================================================
    {
      path: 'run-name',
      operation: 'set',
      value: `\${{ github.ref_name }} \${{ github.sha }}\${{ inputs.version && format(' - {0}', inputs.version) || '' }}`,
      required: true
    },

    // =============================================================================
    // WORKFLOW TRIGGERS - Define when the pipeline runs
    // =============================================================================
    // The pipeline should only run on:
    // 1. Push to develop/staging/main (from PR merge or promotion)
    // 2. Manual trigger via workflow_dispatch
    //
    // NOT on pull_request events - we only want to run after the PR is merged

    {
      path: 'on.workflow_dispatch.inputs.version',
      operation: 'set',
      value: {
        description: 'The version to deploy',
        required: false,
        type: 'string'
      },
      required: true
    },
    {
      path: 'on.workflow_dispatch.inputs.baseRef',
      operation: 'set',
      value: {
        description: 'The base reference for comparison',
        required: false,
        type: 'string'
      },
      required: true
    },
    {
      path: 'on.push.branches',
      operation: 'set',
      value: branchFlow,
      required: true
    },
    
    // =============================================================================
    // CORE PIPECRAFT JOBS - Template-managed jobs that get updates
    // =============================================================================
    // These are the core Pipecraft jobs that should always use the latest template
    // version. Using 'overwrite' operation ensures users get bug fixes and improvements.
    // These jobs are essential for Pipecraft functionality and should not be customized.
    
    {
      path: 'jobs.changes',
      operation: 'overwrite',
      value: createValueFromString(`
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: ./.github/actions/detect-changes
            id: detect
            with:
              baseRef: \${{ inputs.baseRef || '${ctx.finalBranch || "main"}' }}
        outputs:
${Object.keys(ctx.domains || {}).sort().map((domain: string) => `          ${domain}: \${{ steps.detect.outputs.${domain} }}`).join('\n')}
      `, ctx),
      commentBefore: dedent`
        =============================================================================
         CHANGES DETECTION
        =============================================================================
      `,
      required: true
    },

    // =============================================================================
    // USER-MANAGED SECTIONS - Preserve user customizations
    // =============================================================================
    // These sections are designed for user customizations (testing, deployment).
    // Using 'preserve' operation to keep any existing user jobs while providing
    // template structure and examples for new users.

    // Generate test jobs for each domain (only if test: true)
    ...Object.keys(ctx.domains || {}).sort().filter((domain: string) => ctx.domains[domain].test !== false).map((domain: string) => ({
      path: `jobs.test-${domain}`,
      operation: 'preserve' as const,
      value: createValueFromString(`
        needs: changes
        if: \${{ needs.changes.outputs.${domain} == 'true' }}
        runs-on: ubuntu-latest
        steps:
          # TODO: Replace with your ${domain} test logic
          - name: Run ${domain} tests
            run: |
              echo "Running tests for ${domain} domain"
              echo "Replace this with your actual test commands"
              # Example: npm test -- --testPathPattern=${domain}
      `, ctx),
      commentBefore: domain === Object.keys(ctx.domains || {}).sort()[0] ? dedent`


        =============================================================================
         TESTING JOBS
        =============================================================================
      ` : undefined,
      required: true
    })),
    
    {
      path: 'jobs.version',
      operation: 'overwrite',
      commentBefore: dedent`
        =============================================================================
         VERSIONING
        =============================================================================
      `,
      value: createValueFromString(`
        if: \${{ always() && (${Object.keys(ctx.domains || {}).sort().filter((domain: string) => ctx.domains[domain].test !== false).map((domain: string) => `needs.test-${domain}.result == 'success'`).join(' || ')}) && ${Object.keys(ctx.domains || {}).sort().filter((domain: string) => ctx.domains[domain].test !== false).map((domain: string) => `needs.test-${domain}.result != 'failure'`).join(' && ')} }}
        needs: [ changes, ${Object.keys(ctx.domains || {}).sort().filter((domain: string) => ctx.domains[domain].test !== false).map((domain: string) => `test-${domain}`).join(', ')} ]
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: ./.github/actions/calculate-version
            id: version
            with:
              baseRef: \${{ inputs.baseRef || '${ctx.finalBranch || "main"}' }}
        outputs:
          version: \${{ steps.version.outputs.version }}
      `, ctx),
      required: true,
      spaceBefore: true,
    },
    
    // Generate deployment jobs for each domain (only if deploy: true)
    ...Object.keys(ctx.domains || {}).sort().filter((domain: string) => ctx.domains[domain].deploy === true).map((domain: string, index: number) => ({
      path: `jobs.deploy-${domain}`,
      operation: 'overwrite' as const,
      commentBefore: index === 0 ? dedent`
        =============================================================================
         DEPLOYMENT JOBS
        =============================================================================
      ` : undefined,
      spaceBefore: index === 0 ? true : undefined,
      value: createValueFromString(`
        needs: [ version, changes ]
        if: \${{ always() && needs.version.result == 'success' && needs.changes.outputs.${domain} == 'true' }}
        runs-on: ubuntu-latest
        steps:
          - name: Deploy ${domain}
            run: |
              echo "Deploying ${domain}"
              echo "Replace this with your actual deploy commands"
              # Example: npm deploy -- --testPathPattern=${domain}
      `, ctx),
      required: true
    })),

    // Generate remote testing jobs for each domain (only if remoteTest: true)
    ...Object.keys(ctx.domains || {}).sort().filter((domain: string) => ctx.domains[domain].remoteTest === true).map((domain: string, index: number) => ({
      path: `jobs.remote-test-${domain}`,
      operation: 'overwrite' as const,
      commentBefore: index === 0 ? dedent`
        =============================================================================
         REMOTE TESTING JOBS
        =============================================================================
      ` : undefined,
      spaceBefore: index === 0 ? true : undefined,
      value: createValueFromString(`
        needs: [ deploy-${domain}, changes ]
        if: \${{ always() }}
        runs-on: ubuntu-latest
        steps:
          - name: Test ${domain}
            if: \${{ needs.changes.outputs.${domain} == 'true' && needs.deploy-${domain}.result == 'success' }}
            run: |
              echo "Testing ${domain} remotely"
              echo "Replace this with your actual test commands"
              # Example: npm test -- --testPathPattern=${domain}
      `, ctx),
      required: true
    })),
    
    {
      path: 'jobs.tag',
      operation: 'overwrite',
      value: (() => {
        // Build list of deploy and remote-test jobs that tag depends on
        const deployJobs = Object.keys(ctx.domains || {}).sort().filter((domain: string) => ctx.domains[domain].deploy === true).map((domain: string) => `deploy-${domain}`)
        const remoteTestJobs = Object.keys(ctx.domains || {}).sort().filter((domain: string) => ctx.domains[domain].remoteTest === true).map((domain: string) => `remote-test-${domain}`)
        const allDeployTestJobs = [...deployJobs, ...remoteTestJobs]

        // Build needs array (version + all deploy/remote-test jobs)
        const needsArray = ['version', ...allDeployTestJobs]

        // Build conditional: no failures AND at least one success
        const noFailures = allDeployTestJobs.length > 0
          ? allDeployTestJobs.map((job: string) => `needs.${job}.result != 'failure'`).join(' && \n              ')
          : 'true'
        const atLeastOneSuccess = allDeployTestJobs.length > 0
          ? allDeployTestJobs.map((job: string) => `needs.${job}.result == 'success'`).join(' || \n              ')
          : 'true'

        return createValueFromString(`
          # Needs all deploy and/or remote test jobs to succeed or be skipped
          # Needs at least one domain to succeed
          needs: [ ${needsArray.join(', ')} ]
          if: \${{
              always() &&
              github.ref_name == '${ctx.initialBranch || branchFlow[0]}' &&
              needs.version.result == 'success' &&
              (
                ${noFailures}
              ) &&
              (
                ${atLeastOneSuccess}
              )
              }}
          runs-on: ubuntu-latest
          steps:
            - uses: actions/checkout@v4
            - uses: ./.github/actions/create-tag
              with:
                version: \${{ needs.version.outputs.version }}
        `, ctx)
      })(),
      spaceBefore: true,
      commentBefore: dedent`
        =============================================================================
         TAG & PROMOTE
        =============================================================================
      `,
      required: true
    },

    // Generate single promotion job that handles all branch transitions dynamically
    {
      path: 'jobs.promote',
      operation: 'overwrite' as const,
      value: createValueFromString(`
        # Only runs on push or manual workflow_dispatch events to branches that can promote
        # Waits for version/tag if they run, but doesn't fail if they're skipped
        # Needs all deploy and/or remote test jobs to succeed
        if: \${{
            always() &&
            (github.event_name == 'push' || github.event_name == 'workflow_dispatch') &&
            (needs.version.result == 'success' || needs.version.result == 'skipped') &&
            (needs.tag.result == 'success' || needs.tag.result == 'skipped') &&
            (
              ${branchFlow.slice(0, -1).map((branch: string) => `github.ref_name == '${branch}'`).join(' || \n              ')}
            )
            }}
        needs: [ version, tag ]
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: ./.github/actions/promote-branch
            with:
              sourceBranch: \${{ github.ref_name }}
              token: \${{ secrets.GITHUB_TOKEN }}
      `, ctx),
      spaceBefore: true,
      commentBefore: dedent`
        =============================================================================
         PROMOTION JOB
        =============================================================================
      `,
      required: true
    },
    

  ]

  // Helper function to get job keys in order
  const getJobKeysInOrder = (jobsNode: any): string[] => {
    if (!jobsNode || !jobsNode.items) return []
    return jobsNode.items
      .filter((item: any) => item.key)
      .map((item: any) => item.key.toString())
  }

  // Unified approach: Use the operation system for all Pipecraft jobs
  // The operation system already handles:
  // - If key exists and is owned by Pipecraft → overwrite it
  // - If key doesn't exist → create it
  // - If key isn't part of Pipecraft → ignore it (via job filtering)

  const PIPECRAFT_OWNED_JOBS = getPipecraftOwnedJobs(branchFlow, ctx.domains)

  // Capture original job order before any modifications
  let originalJobOrder: string[] = []
  if (doc.contents.get('jobs')) {
    const jobsNode = doc.contents.get('jobs')
    if (jobsNode && jobsNode.items) {
      originalJobOrder = getJobKeysInOrder(jobsNode)
      console.log('📋 Original job order:', originalJobOrder)
    }
  }

  // Collect user jobs (non-Pipecraft jobs) to preserve them
  const userJobs = new Map<string, any>()
  if (doc.contents.get('jobs')) {
    const jobsNode = doc.contents.get('jobs')
    if (jobsNode && jobsNode.items) {
      for (const item of jobsNode.items) {
        const jobName = item.key?.toString() || item.key?.value
        if (jobName && !PIPECRAFT_OWNED_JOBS.has(jobName)) {
          userJobs.set(jobName, item.value)
        }
      }
      if (userJobs.size > 0) {
        console.log(`📋 Preserving ${userJobs.size} user jobs: ${Array.from(userJobs.keys()).join(', ')}`)
      }
    }
  }

  // Clear the entire jobs section to rebuild in correct order
  const jobsNode = doc.contents.get('jobs')
  if (jobsNode && jobsNode.items) {
    jobsNode.items = []
    // Clear any orphaned comments that were attached to the jobs node
    // When we parse YAML with comments and clear items, comments can become orphaned on the parent
    delete (jobsNode as any).commentBefore
    delete (jobsNode as any).comment
  }

  // Apply all operations in order - this creates/overwrites Pipecraft jobs
  // The 'overwrite' operation handles both create and update cases automatically
  applyPathOperations(doc.contents, operations, doc)

  // Remove old trigger types that are no longer used (workflow_call, pull_request)
  // We only want push and workflow_dispatch triggers
  const onNode = doc.contents.get('on')
  if (onNode && onNode.delete) {
    onNode.delete('workflow_call')
    onNode.delete('pull_request')
  }

  // Now we need to reorder jobs to match the original order
  // Collect all current jobs (Pipecraft jobs that were just created)
  const currentJobs = new Map<string, any>()
  if (jobsNode && jobsNode.items) {
    for (const item of jobsNode.items) {
      const jobName = item.key?.toString()
      if (jobName) {
        currentJobs.set(jobName, item)
      }
    }
  }

  // Clear again to rebuild in correct order
  if (jobsNode && jobsNode.items) {
    jobsNode.items = []
  }

  // Rebuild jobs in original order
  // For each job in the original order:
  // - If it's a Pipecraft job, use the newly created version from currentJobs
  // - If it's a user job, use the preserved version from userJobs
  // IMPORTANT: Ensure all keys are Scalars (not strings) so we can add comments later
  for (const jobName of originalJobOrder) {
    if (PIPECRAFT_OWNED_JOBS.has(jobName)) {
      // It's a Pipecraft job - use the newly created version
      const item = currentJobs.get(jobName)
      if (item && jobsNode) {
        // Ensure the key is a Scalar, not a string
        if (typeof item.key === 'string') {
          item.key = new Scalar(item.key)
        }
        jobsNode.items.push(item)
      }
    } else {
      // It's a user job - re-insert from preserved values
      const jobValue = userJobs.get(jobName)
      if (jobValue && jobsNode) {
        jobsNode.set(jobName, jobValue)
      }
    }
  }

  // Add any new Pipecraft jobs that weren't in the original order (at the end)
  for (const [jobName, item] of currentJobs) {
    if (!originalJobOrder.includes(jobName) && jobsNode) {
      // Ensure the key is a Scalar, not a string
      if (typeof item.key === 'string') {
        item.key = new Scalar(item.key)
      }
      jobsNode.items.push(item)
    }
  }
  
  // Log final job order (after operations are applied)
  const finalJobsNode = doc.contents.get('jobs')
  if (finalJobsNode && finalJobsNode.items && finalJobsNode.items.length > 0) {
    const jobNames = getJobKeysInOrder(finalJobsNode)
    if (jobNames.length > 0) {
      console.log('📋 Final job order:', jobNames)
    }

    // Remove duplicate comment headers
    // When we reuse existing job values, they may carry old comments from parsing
    // We want to keep only the comments we explicitly set on keys
    for (const item of finalJobsNode.items) {
      if (item.value && (item.value as any).commentBefore) {
        // Clear commentBefore from values - comments should only be on keys
        delete (item.value as any).commentBefore
      }
    }

    // Add section headers and spacing to domain-based jobs
    // This ensures headers appear in the right place and jobs have proper spacing
    const domainKeys = Object.keys(ctx.domains || {})
    if (domainKeys.length > 0) {
      let foundFirstTest = false
      let foundFirstDeploy = false
      let foundFirstRemoteTest = false

      for (const item of finalJobsNode.items) {
        const jobName = item.key?.toString()
        if (!jobName) continue

        // Skip if key is a string (can't add properties to primitive strings)
        if (typeof item.key === 'string') continue

        // Handle test-* jobs
        if (jobName.startsWith('test-')) {
          if (!foundFirstTest) {
            // First test job gets the header
            (item.key as any).commentBefore = `


=============================================================================
 TESTING JOBS
=============================================================================`
            ;(item.key as any).spaceBefore = true
            foundFirstTest = true
          } else {
            // Subsequent test jobs get a blank line
            ;(item.key as any).spaceBefore = true
          }
        }

        // Handle deploy-* jobs
        if (jobName.startsWith('deploy-')) {
          if (!foundFirstDeploy) {
            // First deploy job gets the header
            ;(item.key as any).commentBefore = `


=============================================================================
 DEPLOYMENT JOBS
=============================================================================`
            ;(item.key as any).spaceBefore = true
            foundFirstDeploy = true
          } else {
            // Subsequent deploy jobs get a blank line
            ;(item.key as any).spaceBefore = true
          }
        }

        // Handle remote-test-* jobs
        if (jobName.startsWith('remote-test-')) {
          if (!foundFirstRemoteTest) {
            // First remote-test job gets the header
            ;(item.key as any).commentBefore = `


=============================================================================
 REMOTE TESTING JOBS
=============================================================================`
            ;(item.key as any).spaceBefore = true
            foundFirstRemoteTest = true
          } else {
            // Subsequent remote-test jobs get a blank line
            ;(item.key as any).spaceBefore = true
          }
        }
      }
    }
  }

  // Generate final content with comment preservation
  // Use lineWidth: 0 to prevent line wrapping of long expressions
  // This keeps GitHub Actions expressions on a single line
  let finalContent = stringify(doc, {
    lineWidth: 0,
    minContentWidth: 0
  })

  // Post-process: Format long GitHub Actions conditionals for better readability
  // The YAML library doesn't handle newlines well in flow scalars, so we format after stringify
  finalContent = finalContent.replace(
    /if: \$\{\{([^}]+)\}\}/g,
    (match, condition) => {
      // Only format if the condition is long enough to benefit from formatting
      if (condition.length < 100) return match

      let formatted = condition.trim()

      // Step 1: Protect function calls like always() by replacing with placeholders
      const functionCalls: string[] = []
      formatted = formatted.replace(/(\w+)\(\)/g, (match: string) => {
        const placeholder = `__FUNC_${functionCalls.length}__`
        functionCalls.push(match)
        return placeholder
      })

      // Step 2: Add line breaks for logical operators
      formatted = formatted.replace(/\s+&&\s+/g, ' &&\n        ')
      formatted = formatted.replace(/\s+\|\|\s+/g, ' ||\n        ')

      // Step 3: Format grouping parentheses (now that function calls are protected)
      formatted = formatted.replace(/\(\s*/g, '(\n        ')
      formatted = formatted.replace(/\s*\)\s*(&&|\|\|)/g, '\n      ) $1')
      formatted = formatted.replace(/\s*\)(\s*)$/g, '\n      )')

      // Step 4: Restore function calls
      functionCalls.forEach((funcCall, index) => {
        formatted = formatted.replace(`__FUNC_${index}__`, funcCall)
      })

      return `if: $\{{\n        ${formatted}\n      }}`
    }
  )

  return {
    yamlContent: finalContent,
    mergeStatus: hasExistingPipeline ? 'merged' : 'overwritten'
  }
}



/**
 * Load existing pipeline file
 */
const loadExistingPipeline = (filePath: string): string | null => {
  if (!fs.existsSync(filePath)) {
    return null
  }
  return fs.readFileSync(filePath, 'utf8')
}

/**
 * Main export - path-based pipeline generator
 */
export const generate = (ctx: PinionContext & { existingPipeline?: any, outputPipelinePath?: string }) =>
  Promise.resolve(ctx)
    .then((ctx) => {
      const result = createPathBasedPipeline(ctx)
      return { 
        ...ctx, 
        yamlContent: result.yamlContent, 
        mergeStatus: result.mergeStatus
      }
    })
    .then((ctx) => {
      // Provide user feedback about file operation
      const outputPath = ctx.outputPipelinePath || '.github/workflows/pipeline.yml'
      const status = ctx.mergeStatus === 'merged' ? '🔄 Merged with existing' : '📝 Created new'
      console.log(`${status} ${outputPath}`)
      return ctx
    })
    .then(renderTemplate(
      (ctx: any) => ctx.yamlContent,
      toFile((ctx: any) => ctx.outputPipelinePath || '.github/workflows/pipeline.yml')
    ))
