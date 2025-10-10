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
} from '../../utils/ast-path-operations'
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
        on: {}
        jobs: {}
        `
}

/**
 * Define which jobs Flowcraft owns vs user jobs
 */
const FLOWCRAFT_OWNED_JOBS = new Set([
  'changes',
  'version', 
  'tag',
  'createpr',
  'branch'
])

/**
 * Check if a job is owned by Flowcraft
 */
const isFlowcraftJob = (jobName: string): boolean => {
  return FLOWCRAFT_OWNED_JOBS.has(jobName)
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
  
  if (ctx.existingPipelineContent) {
    // Parse the original YAML content with comment preservation
    doc = parseDocument(ctx.existingPipelineContent, { keepSourceTokens: true })
    console.log('🔄 Merging with existing pipeline from context')
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
    // CORE FLOWCRAFT JOBS - Template-managed jobs that get updates
    // =============================================================================
    // These are the core Flowcraft jobs that should always use the latest template
    // version. Using 'overwrite' operation ensures users get bug fixes and improvements.
    // These jobs are essential for Flowcraft functionality and should not be customized.
    
    {
      path: 'jobs.changes',
      operation: 'overwrite',
      value: createValueFromObject({
        'runs-on': 'ubuntu-latest',
        steps: [
          {
            uses: './.github/actions/detect-changes',
            with: {
              baseRef: `\${{ inputs.baseRef || '${ctx.finalBranch || "main"}' }}`
            }
          }
        ]
      }, doc),
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
      value: createValueFromString(`
        # =============================================================================
        # VERSIONING
        # =============================================================================
        if: github.ref_name == '${ctx.initialBranch || branchFlow[0]}'
        needs: changes
        runs-on: ubuntu-latest
        steps:
          - uses: ./.github/actions/calculate-version
            with:
              baseRef: \${{ inputs.baseRef || '${ctx.finalBranch || "main"}' }}
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
        # =============================================================================
        # TAG & CREATE PR
        # =============================================================================
        if: github.ref_name == '${ctx.initialBranch || branchFlow[0]}'
        needs: version
        runs-on: ubuntu-latest
        steps:
          - uses: ./.github/actions/create-tag
            with:
              version: \${{ needs.version.outputs.nextVersion }}
      `, ctx),
      required: true
    },
    
    {
      path: 'jobs.createpr',
      operation: 'overwrite',
      value: createValueFromString(`
        ## SHOULD BE ANY BRANCH EXCEPT the final branch
        if: github.ref_name != '${ctx.finalBranch || "main"}'
        needs: tag
        runs-on: ubuntu-latest
        steps:
          - uses: ./.github/actions/create-pr
            with:
              sourceBranch: \${{ github.ref_name }}
              targetBranch: \${{ github.ref_name == '${branchFlow[0]}' && '${branchFlow[1] || branchFlow[0]}' || github.ref_name == '${branchFlow[1]}' && '${branchFlow[2] || branchFlow[1]}' || '${branchFlow[branchFlow.length - 1]}' }}
              title: 'Release \${{ needs.version.outputs.nextVersion }}'
              body: 'Automated release PR for version \${{ needs.version.outputs.nextVersion }}'
      `, ctx),
      required: true
    },
    
    {
      path: 'jobs.branch',
      operation: 'overwrite',
      value: createValueFromString(`
        ## SHOULD BE THE NEXT BRANCH
        needs: createpr
        runs-on: ubuntu-latest
        steps:
          - uses: ./.github/actions/manage-branch
            with:
              action: 'fast-forward'
              targetBranch: \${{ github.ref_name == '${branchFlow[0]}' && '${branchFlow[1] || branchFlow[0]}' || github.ref_name == '${branchFlow[1]}' && '${branchFlow[2] || branchFlow[1]}' || '${branchFlow[branchFlow.length - 1]}' }}
              sourceBranch: \${{ github.ref_name }}
      `, ctx),
      required: true
    },
    

  ]
  
  // Helper function to get job keys in order
  const getJobKeysInOrder = (jobsNode: any): string[] => {
    if (!jobsNode || !jobsNode.items) return []
    return jobsNode.items.map((item: any) => item.key.value)
  }
  
  // Check if Flowcraft jobs already exist in user's pipeline
  const existingFlowcraftJobs = new Set<string>()
  if (ctx.existingPipelineContent && doc.contents.get('jobs')) {
    const jobsNode = doc.contents.get('jobs')
    if (jobsNode && jobsNode.items) {
      console.log('📋 Original job order:', getJobKeysInOrder(jobsNode))
      for (const item of jobsNode.items) {
        const jobName = item.key.value
        if (FLOWCRAFT_OWNED_JOBS.has(jobName)) {
          existingFlowcraftJobs.add(jobName)
        }
      }
    }
  }
  
  if (existingFlowcraftJobs.size > 0) {
    // User has existing Flowcraft jobs - preserve their positions
    console.log(`📋 Found existing Flowcraft jobs: ${Array.from(existingFlowcraftJobs).join(', ')}`)
    console.log('🔄 Preserving user\'s job positions and updating content')
    
    // Remove Flowcraft-owned jobs from existing pipeline to ensure clean overwrite
    if (doc.contents.get('jobs')) {
      const jobsNode = doc.contents.get('jobs')
      if (jobsNode && jobsNode.items) {
        // Remove all Flowcraft-owned jobs from existing pipeline
        for (const jobName of FLOWCRAFT_OWNED_JOBS) {
          if (jobsNode.has(jobName)) {
            console.log(`🔄 Removing existing Flowcraft job: ${jobName}`)
            jobsNode.delete(jobName)
          }
        }
      }
    }
    
    // Apply all operations - this will add Flowcraft jobs back in their original positions
    applyPathOperations(doc.contents, operations, doc)
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
          if (!FLOWCRAFT_OWNED_JOBS.has(jobName)) {
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
  const finalContent = stringify(doc)
  
  return { 
    yamlContent: finalContent, 
    mergeStatus: ctx.existingPipelineContent ? 'merged' : 'overwritten'
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
