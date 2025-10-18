import { PinionContext, toFile, renderTemplate } from '@featherscloud/pinion'
import { parseDocument, stringify, Scalar, YAMLMap } from 'yaml'
import fs from 'fs'
import {
  applyPathOperations,
  PathOperationConfig,
  createValueFromString
} from '../../utils/ast-path-operations.js'
import dedent from 'dedent'
import { logger } from '../../utils/logger.js'

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
    'promote',   // Promotion job - triggers workflow on next branch
    'release'    // GitHub release creation on final branch
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
  logger.debug('🔍 Branch flow from context:', branchFlow)
  logger.debug('🔍 Context keys:', Object.keys(ctx))

  // Use existing pipeline from context or start with base template
  let doc: any
  let hasExistingPipeline = false

  if (ctx.existingPipelineContent) {
    // Parse the original YAML content WITHOUT source tokens
    // This prevents old comments from being preserved when we rebuild
    doc = parseDocument(ctx.existingPipelineContent)
    // Clear any document-level comment that might have been at the top of the file
    // We'll re-add the header comment via operations
    if (doc.commentBefore) {
      doc.commentBefore = undefined
    }
    hasExistingPipeline = true
    logger.verbose('🔄 Merging with existing pipeline')
  } else if (ctx.existingPipeline) {
    // Convert existing pipeline object to YAML string first
    const existingYaml = stringify(ctx.existingPipeline)
    doc = parseDocument(existingYaml)
    hasExistingPipeline = true
    logger.verbose('🔄 Merging with existing pipeline')
  } else {
    doc = parseDocument(getBaseTemplate(ctx))
    logger.verbose('📝 Creating new pipeline')
  }
  
  if (!doc.contents) {
    throw new Error('Failed to parse pipeline document')
  }
  
  // Apply path-based operations
  const operations: PathOperationConfig[] = [

    // =============================================================================
    // WORKFLOW HEADER COMMENT
    // Note: This comment should be preserved if user has custom comments at
    // document level, only job-level managed headers should replace user comments
    // =============================================================================
    {
      path: 'name',
      operation: 'preserve',
      value: (() => {
        const nameScalar = new Scalar('Pipeline')
        nameScalar.type = Scalar.QUOTE_DOUBLE
        return nameScalar
      })(),
      required: true
      // Note: No commentBefore here - we'll add it only if no user comment exists
    },

    // =============================================================================
    // WORKFLOW METADATA - Name and run identification
    // =============================================================================
    {
      path: 'run-name',
      operation: 'preserve',
      value: (() => {
        const runNameScalar = new Scalar(`\${{ github.ref_name }} #\${{ inputs.run_number || github.run_number }}\${{ inputs.version && format(' - {0}', inputs.version) || '' }}`)
        runNameScalar.type = Scalar.QUOTE_DOUBLE
        return runNameScalar
      })(),
      required: true,
      spaceBefore: true
    },

    // =============================================================================
    // WORKFLOW TRIGGERS - Define when the pipeline runs
    // =============================================================================
    // The pipeline runs on:
    // 1. pull_request (opened/synchronize/reopened) targeting initial branch only
    //    - Excludes 'closed' type to avoid duplicate runs when PR is merged
    //    - Only targets initial branch (e.g., develop) to avoid duplicates
    //    - Automated PRs (develop→staging, staging→main) don't trigger (wrong target)
    //    - Only runs changes detection + tests (no versioning/tagging/promotion)
    // 2. push to branch flow branches - Runs full pipeline after PR merge
    //    - Includes versioning, tagging, PR creation to next branch, and promotion
    // 3. workflow_dispatch - Manual trigger with full pipeline
    // 4. workflow_call - Can be called from other workflows
    //
    // Flow example:
    //   feature/xyz → PR to develop → Tests run (targets develop ✓)
    //   PR merged → Push to develop → Full pipeline (version + tag + createpr)
    //   Pipecraft creates PR: develop → staging (targets staging, skipped ✓)
    //   Auto-merge → Push to staging → Full pipeline continues
    //   Pipecraft creates PR: staging → main (targets main, skipped ✓)
    //   Auto-merge → Push to main → Full pipeline completes

    // Ensure 'on' key exists with proper spacing (nested operations below will populate it)
    {
      path: 'on',
      operation: 'set',
      value: {},
      required: true,
      spaceBefore: true
    },

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
      path: 'on.workflow_dispatch.inputs.run_number',
      operation: 'set',
      value: {
        description: 'The original run number from develop branch',
        required: false,
        type: 'string'
      },
      required: true
    },
    {
      path: 'on.workflow_call.inputs.version',
      operation: 'set',
      value: {
        description: 'The version to deploy',
        required: false,
        type: 'string'
      },
      required: true
    },
    {
      path: 'on.workflow_call.inputs.baseRef',
      operation: 'set',
      value: {
        description: 'The base reference for comparison',
        required: false,
        type: 'string'
      },
      required: true
    },
    {
      path: 'on.workflow_call.inputs.run_number',
      operation: 'set',
      value: {
        description: 'The original run number from develop branch',
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
    {
      path: 'on.pull_request.types',
      operation: 'set',
      value: ['opened', 'synchronize', 'reopened'],
      required: true
    },
    {
      path: 'on.pull_request.branches',
      operation: 'set',
      value: [ctx.initialBranch || branchFlow[0]],
      required: true
    },
    
    // =============================================================================
    // CORE PIPECRAFT JOBS - Template-managed jobs that get updates
    // =============================================================================
    // These are the core Pipecraft jobs that should always use the latest template
    // version. Using 'overwrite' operation ensures users get bug fixes and improvements.
    // These jobs are essential for Pipecraft functionality and should not be customized.

    // Ensure 'jobs' key exists with proper spacing (nested operations below will populate it)
    {
      path: 'jobs',
      operation: 'set',
      value: {},
      required: true,
      spaceBefore: true
    },

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
         CHANGES DETECTION (⚠️  Managed by Pipecraft - do not modify)
        =============================================================================
         This job detects which domains have changed and sets outputs for downstream jobs.
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
         TESTING JOBS (✅ Customize these with your test logic)
        =============================================================================
         These jobs run tests for each domain when changes are detected.
         Replace the TODO comments with your actual test commands.
      ` : undefined,
      required: true
    })),
    
    {
      path: 'jobs.version',
      operation: 'overwrite',
      commentBefore: dedent`
        =============================================================================
         VERSIONING (⚠️  Managed by Pipecraft - do not modify)
        =============================================================================
         Calculates the next version based on conventional commits and semver rules.
         Only runs on push events (skipped on pull requests).
      `,
      value: createValueFromString(`
        if: \${{ always() && github.event_name != 'pull_request' && (${Object.keys(ctx.domains || {}).sort().filter((domain: string) => ctx.domains[domain].test !== false).map((domain: string) => `needs.test-${domain}.result == 'success'`).join(' || ')}) && ${Object.keys(ctx.domains || {}).sort().filter((domain: string) => ctx.domains[domain].test !== false).map((domain: string) => `needs.test-${domain}.result != 'failure'`).join(' && ')} }}
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
         DEPLOYMENT JOBS (✅ Customize these with your deploy logic)
        =============================================================================
         These jobs deploy each domain when changes are detected and tests pass.
         Replace the TODO comments with your actual deployment commands.
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
         REMOTE TESTING JOBS (✅ Customize these with your remote test logic)
        =============================================================================
         These jobs test deployed services remotely after deployment succeeds.
         Replace the TODO comments with your actual remote testing commands.
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
              github.event_name != 'pull_request' &&
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
         TAG & PROMOTE (⚠️  Managed by Pipecraft - do not modify)
        =============================================================================
         Creates a git tag with the calculated version on the initial branch.
         Only runs on push events after successful tests and deployments.
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
              version: \${{ needs.version.outputs.version }}
              run_number: \${{ inputs.run_number || github.run_number }}
              token: \${{ secrets.GITHUB_TOKEN }}
      `, ctx),
      spaceBefore: true,
      commentBefore: `=============================================================================
 PROMOTION JOB (⚠️  Managed by Pipecraft - do not modify)
=============================================================================
 Triggers the next branch's workflow after successful versioning and tagging.
 Passes version and run_number to maintain traceability across branches.`,
      required: true
    },

    // Generate release job for final branch (main)
    {
      path: 'jobs.release',
      operation: 'overwrite' as const,
      value: createValueFromString(`
        # Create GitHub release on main branch after successful tests and versioning
        if: \${{
            always() &&
            github.ref_name == '${ctx.finalBranch || branchFlow[branchFlow.length - 1]}' &&
            (github.event_name == 'push' || github.event_name == 'workflow_dispatch') &&
            needs.version.result == 'success' &&
            (needs.tag.result == 'success' || needs.tag.result == 'skipped')
            }}
        needs: [ version, tag ]
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: ./.github/actions/create-release
            with:
              version: \${{ needs.version.outputs.version }}
              token: \${{ secrets.GITHUB_TOKEN }}
      `, ctx),
      spaceBefore: true,
      commentBefore: `=============================================================================
 RELEASE JOB (⚠️  Managed by Pipecraft - do not modify)
=============================================================================
 Creates a GitHub release on the final branch with release notes.
 Only runs after successful versioning and tagging on the final branch.`,
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
      logger.debug('📋 Original job order:', originalJobOrder)
    }
  }

  // Deprecated jobs that should be removed (old promotion strategy)
  const DEPRECATED_JOBS = new Set(['createpr', 'branch'])

  // Collect user jobs (non-Pipecraft jobs) to preserve them
  const userJobs = new Map<string, any>()
  if (doc.contents.get('jobs')) {
    const jobsNode = doc.contents.get('jobs')
    if (jobsNode && jobsNode.items) {
      for (const item of jobsNode.items) {
        const jobName = item.key?.toString() || item.key?.value
        // Skip deprecated jobs - don't preserve them
        if (jobName && !PIPECRAFT_OWNED_JOBS.has(jobName) && !DEPRECATED_JOBS.has(jobName)) {
          userJobs.set(jobName, item.value)
        }
      }
      if (userJobs.size > 0) {
        logger.verbose(`📋 Preserving ${userJobs.size} user jobs: ${Array.from(userJobs.keys()).join(', ')}`)
      }
    }
  }

  // To ensure proper key order (name, run-name, on, jobs), we need to:
  // 1. Extract all values we care about
  // 2. Clear the document
  // 3. Re-add them in the correct order

  // Save existing values and comments that should be preserved
  const existingName = doc.contents.get('name')
  const existingRunName = doc.contents.get('run-name')
  const existingOn = doc.contents.get('on')
  const existingJobs = doc.contents.get('jobs')

  // Save document-level comments (user comments at the top)
  // Note: YAML stores document-level comments on doc.commentBefore, not doc.contents.commentBefore
  const docCommentBefore = (doc as any).commentBefore
  const docComment = (doc as any).comment

  // Save user comments on keys (but not Pipecraft-managed comments)
  const savedComments = new Map<string, { commentBefore?: string; comment?: string }>()

  const isPipecraftComment = (comment: string | undefined): boolean => {
    if (!comment) return false
    const lowerComment = comment.toLowerCase()
    return lowerComment.includes('pipecraft') ||
           lowerComment.includes('managed by pipecraft') ||
           lowerComment.includes('do not modify')
  }

  for (const item of doc.contents.items) {
    const keyName = typeof item.key === 'string' ? item.key : item.key?.value
    if (keyName) {
      const keyCommentBefore = (item.key as any)?.commentBefore
      const keyComment = (item.key as any)?.comment

      // Only save non-Pipecraft comments
      if ((keyCommentBefore && !isPipecraftComment(keyCommentBefore)) ||
          (keyComment && !isPipecraftComment(keyComment))) {
        savedComments.set(keyName, {
          commentBefore: keyCommentBefore && !isPipecraftComment(keyCommentBefore) ? keyCommentBefore : undefined,
          comment: keyComment && !isPipecraftComment(keyComment) ? keyComment : undefined
        })
      }
    }
  }

  // Clear the document to rebuild with correct key order
  doc.contents.items = []

  // Apply root-level operations to set name, run-name, on
  const rootOperations = operations.filter(op => !op.path.startsWith('jobs.'))
  applyPathOperations(doc.contents, rootOperations, doc)

  // Restore document-level comments (user comments at the top of file)
  // Only restore if they're not Pipecraft comments
  const hasUserDocComment = docCommentBefore && !isPipecraftComment(docCommentBefore)

  if (hasUserDocComment) {
    ;(doc as any).commentBefore = docCommentBefore
  } else {
    // No user comment at document level, add Pipecraft workflow header
    const pipecraftHeader = `=============================================================================
 PIPECRAFT MANAGED WORKFLOW
=============================================================================

 ✅ YOU CAN CUSTOMIZE:
   - test-*** jobs for each domain
   - deploy-*** jobs for each domain
   - remote-test-*** jobs for each domain
   - Workflow name

 ⚠️  PIPECRAFT MANAGES (do not modify):
   - Workflow triggers, job dependencies, and conditionals
   - Changes detection, version calculation, and tag creation
   - CreatePR, branch management, promote, and release jobs

 Running 'pipecraft generate' updates managed sections while preserving
 your customizations in test/deploy/remote-test jobs.

 📖 Learn more: https://docs.pipecraft.dev
=============================================================================`
    ;(doc as any).commentBefore = pipecraftHeader
  }

  if (docComment && !isPipecraftComment(docComment)) {
    ;(doc as any).comment = docComment
  }

  // Replace values for preserve operations that had existing values
  // This maintains the order and comments from operations, but uses the preserved values
  if (existingName !== undefined && existingName !== null) {
    // Find the 'name' key and replace its value
    const nameIndex = doc.contents.items.findIndex((item: any) => {
      const key = item.key
      if (typeof key === 'string') return key === 'name'
      if (key && typeof key.value === 'string') return key.value === 'name'
      return false
    })
    if (nameIndex >= 0) {
      doc.contents.items[nameIndex].value = existingName
    }
  }
  if (existingRunName !== undefined && existingRunName !== null) {
    // Find the 'run-name' key and replace its value
    const runNameIndex = doc.contents.items.findIndex((item: any) => {
      const key = item.key
      if (typeof key === 'string') return key === 'run-name'
      if (key && typeof key.value === 'string') return key.value === 'run-name'
      return false
    })
    if (runNameIndex >= 0) {
      doc.contents.items[runNameIndex].value = existingRunName
    }
  }

  // Restore user comments on keys (but don't overwrite Pipecraft comments)
  for (const item of doc.contents.items) {
    const keyName = typeof item.key === 'string' ? item.key : item.key?.value
    if (keyName && savedComments.has(keyName)) {
      const saved = savedComments.get(keyName)!
      const currentKey = item.key

      // Only restore user comments if current comment is Pipecraft-managed or missing
      const currentCommentBefore = (currentKey as any)?.commentBefore
      const currentComment = (currentKey as any)?.comment

      if (saved.commentBefore && (!currentCommentBefore || !isPipecraftComment(currentCommentBefore))) {
        ;(currentKey as any).commentBefore = saved.commentBefore
      }
      if (saved.comment && (!currentComment || !isPipecraftComment(currentComment))) {
        ;(currentKey as any).comment = saved.comment
      }
    }
  }

  // Note: We don't restore 'on' or 'jobs' here because the operations already created them
  // with proper spacing. Restoring them would overwrite the Scalar keys and lose spacing.

  // Clear the jobs section to rebuild in correct order
  const jobsNode = doc.contents.get('jobs')
  if (jobsNode && jobsNode.items) {
    jobsNode.items = []
    // Clear any orphaned comments that were attached to the jobs node
    delete (jobsNode as any).commentBefore
    delete (jobsNode as any).comment
  }

  // Apply job operations
  const jobOperations = operations.filter(op => op.path.startsWith('jobs.'))
  applyPathOperations(doc.contents, jobOperations, doc)

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
  // - Skip deprecated jobs
  // IMPORTANT: Ensure all keys are Scalars (not strings) so we can add comments later
  for (const jobName of originalJobOrder) {
    // Skip deprecated jobs
    if (DEPRECATED_JOBS.has(jobName)) {
      logger.verbose(`🗑️  Removing deprecated job: ${jobName}`)
      continue
    }

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
      logger.debug('📋 Final job order:', jobNames)
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
      logger.verbose(`${status} ${outputPath}`)
      return ctx
    })
    .then(renderTemplate(
      (ctx: any) => ctx.yamlContent,
      toFile((ctx: any) => ctx.outputPipelinePath || '.github/workflows/pipeline.yml')
    ))
