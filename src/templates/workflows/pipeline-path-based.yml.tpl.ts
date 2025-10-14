import { PinionContext, toFile, renderTemplate } from '@featherscloud/pinion'
import { parseDocument, stringify } from 'yaml'
import fs from 'fs'
import { 
  applyPathOperations, 
  ensurePathAndApply,
  PathOperationConfig,
  createValueFromString,
  createValueFromObject,
  createValueFromArray
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
 * Define which jobs Flowcraft owns vs user jobs
 */
const getPipecraftOwnedJobs = (branchFlow: string[]): Set<string> => {
  const jobs = new Set([
    'changes',
    'version',
    'tag',
    'promote'  // Single promote job instead of multiple promote-to-{target} jobs
  ])

  return jobs
}

/**
 * Check if a job is owned by Flowcraft
 */
const isFlowcraftJob = (jobName: string, branchFlow: string[]): boolean => {
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
    // Parse the original YAML content with comment preservation
    doc = parseDocument(ctx.existingPipelineContent, { keepSourceTokens: true })
    hasExistingPipeline = true
    console.log('🔄 Merging with existing pipeline from existingPipelineContent')
  } else if (ctx.existingPipeline) {
    // Convert existing pipeline object to YAML string first
    const existingYaml = stringify(ctx.existingPipeline)
    doc = parseDocument(existingYaml, { keepSourceTokens: true })
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
    // WORKFLOW INPUTS - Ensure required inputs exist for workflow calls
    // =============================================================================
    // These operations ensure that workflow_call and workflow_dispatch have the
    // required inputs (version, baseRef) that Flowcraft needs to function.
    // Using 'set' operation to ensure these inputs always exist with correct structure.
    
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
    
    // =============================================================================
    // BRANCH CONFIGURATION - Merge template branches with user branches
    // =============================================================================
    // Using 'merge' operation to preserve any custom branches the user has added
    // while ensuring the template branches (from branchFlow) are included.
    // This allows users to add custom branches without losing template functionality.
    
    {
      path: 'on.pull_request.branches',
      operation: 'merge',
      value: branchFlow,
      required: true
    },
    
    // =============================================================================
    // CORE PIPECRAFT JOBS - Template-managed jobs that get updates
    // =============================================================================
    // These are the core Flowcraft jobs that should always use the latest template
    // version. Using 'overwrite' operation ensures users get bug fixes and improvements.
    // These jobs are essential for Flowcraft functionality and should not be customized.
    
    {
      path: 'jobs.changes',
      operation: 'overwrite',
      value: createValueFromString(`
        runs-on: ubuntu-latest
        steps:
          - name: Checkout Code
            uses: actions/checkout@v4
            with:
              fetch-depth: 0

          - uses: ./.github/actions/detect-changes
            with:
              baseRef: \${{ inputs.baseRef || '${ctx.finalBranch || "main"}' }}
      `, ctx),
      commentBefore: `
        # =============================================================================
        # CHANGES DETECTION
        # =============================================================================
      `,
      required: true
    },

    // =============================================================================
    // USER-MANAGED SECTIONS - Preserve user customizations
    // =============================================================================
    // These sections are designed for user customizations (testing, deployment).
    // Using 'preserve' operation to keep any existing user jobs while providing
    // template structure and examples for new users.
    
    {
      path: 'jobs.testing-section',
      operation: 'preserve',
      commentBefore: `
        # =============================================================================
        # TESTING JOBS
        # =============================================================================
      `,
      value: createValueFromString(`
        # =============================================================================
        # TESTING JOBS
        # =============================================================================
        # Add your testing jobs here
        # Example:
        # test-api: 
        #   needs: changes
        #   runs-on: ubuntu-latest
        #   steps:
        #     - name: Test API
        #       run: |
        #         echo "Run API tests"
        #
        # test-web:
        #   needs: changes
        #   runs-on: ubuntu-latest
        #   steps:
        #     - name: Test Web
        #       run: |
        #         echo "Run Web tests"
      `, ctx),
      required: false
    },
    
    {
      path: 'jobs.version',
      operation: 'overwrite',
      commentBefore: `
        # =============================================================================
        # VERSIONING
        # =============================================================================
      `,
      value: createValueFromString(`
        if: github.ref_name == '${ctx.initialBranch || branchFlow[0]}'
        needs: changes
        runs-on: ubuntu-latest
        steps:
          - name: Checkout Code
            uses: actions/checkout@v4
            with:
              fetch-depth: 0

          - uses: ./.github/actions/calculate-version
            id: calculate-version
            with:
              baseRef: \${{ inputs.baseRef || '${ctx.finalBranch || "main"}' }}
        outputs:
          nextVersion: \${{ steps.calculate-version.outputs.version }}
      `, ctx),
      required: true
    },
    
    {
      path: 'jobs.deployment-section',
      operation: 'preserve',
      value: createValueFromString(`
        # =============================================================================
        # DEPLOYMENT JOBS
        # =============================================================================
        # Add your deployment jobs here
        # Example:
        # deploy-api:
        #   needs: version
        #   runs-on: ubuntu-latest
        #   steps:
        #     - name: Deploy API
        #       run: |
        #         echo "Deploy API to production"
        #
        # deploy-web:
        #   needs: version
        #   runs-on: ubuntu-latest
        #   steps:
        #     - name: Deploy Web
        #       run: |
        #         echo "Deploy Web to production"
      `, ctx),
      required: false
    },
    
    {
      path: 'jobs.tag',
      operation: 'overwrite',
      value: createValueFromString(`
        if: github.ref_name == '${ctx.initialBranch || branchFlow[0]}'
        needs: version
        runs-on: ubuntu-latest
        steps:
          - name: Checkout Code
            uses: actions/checkout@v4
            with:
              fetch-depth: 0

          - uses: ./.github/actions/create-tag
            with:
              version: \${{ needs.version.outputs.nextVersion }}
      `, ctx),
      commentBefore: `
        # =============================================================================
        # TAG & PROMOTE
        # =============================================================================
      `,
      required: true
    },

    // Generate single promotion job that handles all branch transitions dynamically
    {
      path: 'jobs.promote',
      operation: 'overwrite' as const,
      value: createValueFromString(`
        if: |
          ${branchFlow.slice(0, -1).map((branch: string) => `github.ref_name == '${branch}'`).join(' || ')}
        needs: [changes]
        runs-on: ubuntu-latest
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        steps:
          - name: Checkout Code
            uses: actions/checkout@v4
            with:
              fetch-depth: 0

          - name: Determine target branch and auto-merge setting
            id: determine-target
            run: |
              case "\${{ github.ref_name }}" in
                ${branchFlow.slice(0, -1).map((sb: string, idx: number) => {
                  const tb = branchFlow[idx + 1]
                  const autoMergeConfig = ctx.autoMerge || {}
                  const autoMerge = typeof autoMergeConfig === 'boolean'
                    ? autoMergeConfig
                    : autoMergeConfig[tb] === true
                  return `"${sb}")
                  echo "target=${tb}" >> $GITHUB_OUTPUT
                  echo "autoMerge=${autoMerge}" >> $GITHUB_OUTPUT
                  ;;`
                }).join('\n                ')}
              esac

          - name: Get version for promotion
            id: get-version
            run: |
              # Get the latest tag for this promotion
              VERSION=\$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.1.0")
              echo "version=\${VERSION}" >> $GITHUB_OUTPUT
              echo "Using version: \${VERSION}"

          - uses: ./.github/actions/promote-branch
            with:
              sourceBranch: \${{ github.ref_name }}
              targetBranch: \${{ steps.determine-target.outputs.target }}
              version: \${{ steps.get-version.outputs.version }}
              autoMerge: \${{ steps.determine-target.outputs.autoMerge }}
              token: \${{ secrets.GITHUB_TOKEN }}
      `, ctx),
      commentBefore: `
        # =============================================================================
        # PROMOTION JOB - Single dynamic job that handles all branch promotions
        # Uses latest git tag for version (version/tag jobs create tags on develop)
        # =============================================================================
      `,
      required: true
    },
    

  ]

  // Helper function to get job keys in order
  const getJobKeysInOrder = (jobsNode: any): string[] => {
    if (!jobsNode || !jobsNode.items) return []
    return jobsNode.items.map((item: any) => item.key.value)
  }

  // Remove old createpr and branch jobs if they exist (migration from old template)
  const jobsNode = doc.contents.get('jobs')
  if (jobsNode) {
    if (jobsNode.get('createpr')) {
      console.log('🗑️  Removing old createpr job (migrating to promote jobs)')
      jobsNode.delete('createpr')
    }
    if (jobsNode.get('branch')) {
      console.log('🗑️  Removing old branch job (migrating to promote jobs)')
      jobsNode.delete('branch')
    }
    // Remove old promote-to-{target} jobs (migrating to single promote job)
    for (let i = 0; i < branchFlow.length - 1; i++) {
      const oldJobName = `promote-to-${branchFlow[i + 1]}`
      if (jobsNode.get(oldJobName)) {
        console.log(`🗑️  Removing old ${oldJobName} job (migrating to single promote job)`)
        jobsNode.delete(oldJobName)
      }
    }
  }

  // Check if Flowcraft jobs already exist in user's pipeline
  const PIPECRAFT_OWNED_JOBS = getPipecraftOwnedJobs(branchFlow)
  const existingFlowcraftJobs = new Set<string>()
  if (ctx.existingPipelineContent && doc.contents.get('jobs')) {
    const jobsNode = doc.contents.get('jobs')
    if (jobsNode && jobsNode.items) {
      console.log('📋 Original job order:', getJobKeysInOrder(jobsNode))
      for (const item of jobsNode.items) {
        const jobName = item.key.value
        if (PIPECRAFT_OWNED_JOBS.has(jobName)) {
          existingFlowcraftJobs.add(jobName)
        }
      }
    }
  }
  
  if (existingFlowcraftJobs.size > 0) {
    // User has existing Flowcraft jobs - preserve their positions
    console.log(`📋 Found existing Flowcraft jobs: ${Array.from(existingFlowcraftJobs).join(', ')}`)
    console.log('🔄 Preserving user\'s job positions and updating content')
    
    // Collect all jobs in their original order
    const orderedJobs = new Map<string, any>()
    if (doc.contents.get('jobs')) {
      const jobsNode = doc.contents.get('jobs')
      if (jobsNode && jobsNode.items) {
        for (const item of jobsNode.items) {
          const jobName = item.key.value
          orderedJobs.set(jobName, item.value)
        }
      }
    }
    
    
    // Update Flowcraft jobs in place to preserve comment structure
    const jobsNode = doc.contents.get('jobs')
    if (jobsNode && jobsNode.items) {
      for (let i = 0; i < jobsNode.items.length; i++) {
        const item = jobsNode.items[i]
        const jobName = item.key.value
        
        if (PIPECRAFT_OWNED_JOBS.has(jobName)) {
          // This is a Flowcraft job - update it with the latest template content
          const operation = operations.find(op => op.path === `jobs.${jobName}`)
          if (operation) {
            // Create the updated job content
            let updatedJobValue
            if (typeof operation.value === 'string') {
              updatedJobValue = createValueFromString(operation.value, ctx)
            } else if (typeof operation.value === 'object') {
              updatedJobValue = createValueFromObject(operation.value, doc)
            }
            
            // Replace the job value while preserving the key and any comments
            jobsNode.items[i].value = updatedJobValue
            jobsNode.items[i].commentBefore = operation?.commentBefore?.trim()
            jobsNode.items[i].comment = operation?.comment?.trim()
            jobsNode.items[i].spaceBefore = operation?.spaceBefore
            jobsNode.items[i].tag = operation?.tag?.trim()
            


          }
        }
        // User jobs are left unchanged
      }
    }
    
    // Add any Flowcraft jobs that the user didn't have
    const pipecraftJobOrder = ['changes', 'version', 'tag', 'promote']

    for (const jobName of pipecraftJobOrder) {
      if (!orderedJobs.has(jobName)) {
        // User didn't have this job - create it using operations
        const operation = operations.find(op => op.path === `jobs.${jobName}`)
        if (operation) {
          let newJobValue
          if (typeof operation.value === 'string') {
            newJobValue = createValueFromString(operation.value, ctx)
          } else if (typeof operation.value === 'object') {
            newJobValue = createValueFromObject(operation.value, doc)
          }
          
          // Apply commentBefore if provided
          if (operation.commentBefore && newJobValue) {
            newJobValue.commentBefore = operation.commentBefore.trim()
          }
          
          jobsNode.set(jobName, newJobValue)
        }
      }
    }
    
    // Apply non-job operations (like workflow_dispatch inputs)
    const nonJobOperations = operations.filter(op => !op.path.startsWith('jobs.'))
    applyPathOperations(doc.contents, nonJobOperations, doc)
  } else {
    // No existing Flowcraft jobs - build in correct order
    console.log('📋 No existing Flowcraft jobs found - building in correct order')
    
    // Collect user jobs before clearing
    const userJobs = new Map<string, any>()
    if (doc.contents.get('jobs')) {
      const jobsNode = doc.contents.get('jobs')
      if (jobsNode && jobsNode.items) {
        // Collect all user jobs (non-Flowcraft jobs)
        for (const item of jobsNode.items) {
          const jobName = item.key.value
          if (!PIPECRAFT_OWNED_JOBS.has(jobName)) {
            userJobs.set(jobName, item.value)
          }
        }
        console.log(`📋 Preserved ${userJobs.size} user jobs`)
      }
    }
    
    // Clear the entire jobs section to rebuild in correct order
    const jobsNode = doc.contents.get('jobs')
    if (jobsNode && jobsNode.items) {
      jobsNode.items = []
    }
    
    // Apply all operations in order - this builds the Flowcraft jobs
    applyPathOperations(doc.contents, operations, doc)
    
    // Re-insert user jobs after the operations
    if (userJobs.size > 0 && jobsNode) {
      for (const [jobName, jobValue] of userJobs) {
        jobsNode.set(jobName, jobValue)
      }
    }
  }
  
  // Log final job order
  const finalJobsNode = doc.contents.get('jobs')
  if (finalJobsNode) {
    console.log('📋 Final job order:', getJobKeysInOrder(finalJobsNode))
  }
  
  // Generate final content with comment preservation
  // Use lineWidth: 0 to prevent line wrapping of long expressions
  // This keeps GitHub Actions expressions on a single line
  const finalContent = stringify(doc, {
    lineWidth: 0,
    minContentWidth: 0
  })
  
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
