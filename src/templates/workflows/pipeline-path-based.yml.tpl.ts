import { PinionContext, toFile, renderTemplate } from '@featherscloud/pinion'
import { parseDocument, stringify } from 'yaml'
import fs from 'fs'
import { 
  ensureWorkflowInputs, 
  applyPathOperations, 
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

// Generate dynamic branch flow logic
const generateBranchFlowNextLogic = (branchFlow: string[]) => {
  if (!branchFlow || branchFlow.length === 0) return "'main'"
  
  const conditions = branchFlow.map((branch, index) => {
    const nextBranch = index < branchFlow.length - 1 ? branchFlow[index + 1] : branchFlow[index]
    return `github.ref_name == '${branch}' && '${nextBranch}'`
  }).join(' || ')
  
  return `\${{ ${conditions} || '${branchFlow[branchFlow.length - 1]}' }}`
}

/**
 * Get base template with minimal structure
 */
const getBaseTemplate = (ctx: any) => {
  const branchFlow = ctx.branchFlow || ['develop', 'staging', 'main']
  const branchFlowNextLogic = generateBranchFlowNextLogic(branchFlow)
  
  return dedent`
        name: "Pipeline"

        on:
        pull_request:
            branches:
            - develop
            - staging
            - main

        jobs:
        changes:
            runs-on: ubuntu-latest
            steps:
            - uses: ./.github/actions/detect-changes
                with:
                baseRef: \${{ inputs.baseRef || 'main' }}

        version:
            if: github.ref_name == '${branchFlow[0]}'
            needs: changes
            runs-on: ubuntu-latest
            steps:
            - uses: ./.github/actions/calculate-version
                with:
                baseRef: \${{ inputs.baseRef || 'main' }}

        tag:
            if: github.ref_name == '${branchFlow[0]}'
            needs: version
            runs-on: ubuntu-latest
            steps:
            - uses: ./.github/actions/create-tag
                with:
                version: \${{ needs.version.outputs.nextVersion }}

        createpr:
            if: github.ref_name != '${ctx.finalBranch}'
            needs: tag
            runs-on: ubuntu-latest
            steps:
            - uses: ./.github/actions/create-pr
                with:
                sourceBranch: \${{ github.ref_name }}
                targetBranch: \${branchFlowNextLogic}
                title: 'Release \${{ needs.version.outputs.nextVersion }}'
                body: 'Automated release PR for version \${{ needs.version.outputs.nextVersion }}'

        branch:
            needs: createpr
            runs-on: ubuntu-latest
            steps:
            - uses: ./.github/actions/manage-branch
                with:
                action: 'fast-forward'
                targetBranch: ${branchFlowNextLogic}
                sourceBranch: \${{ github.ref_name }}
        `
}

/**
 * Create path-based pipeline content
 */
export const createPathBasedPipeline = (ctx: any) => {
  const branchFlow = ctx.branchFlow || ['develop', 'staging', 'main']
  
  // Use existing pipeline from context or start with base template
  let doc: any
  
  if (ctx.existingPipeline) {
    // Convert existing pipeline object to YAML string and parse
    const yamlString = stringify(ctx.existingPipeline)
    doc = parseDocument(yamlString)
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
      value: createValueFromString(`
        # =============================================================================
        # CHANGES DETECTION
        # =============================================================================
        runs-on: ubuntu-latest
        steps:
          - uses: ./.github/actions/detect-changes
            with:
              baseRef: \${{ inputs.baseRef || ${ctx.finalBranch || 'main' }}}
      `),
      required: true
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
              baseRef: \${{ inputs.baseRef || ${ctx.finalBranch || 'main'} }}
      `),
      required: true
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
      `),
      required: true
    },
    
    {
      path: 'jobs.createpr',
      operation: 'overwrite',
      value: createValueFromString(`
        ## SHOULD BE ANY BRANCH EXCEPT the final branch
        if: github.ref_name != '${ctx.finalBranch || 'main'}'
        needs: tag
        runs-on: ubuntu-latest
        steps:
          - uses: ./.github/actions/create-pr
            with:
              sourceBranch: \${{ github.ref_name }}
              targetBranch: ${generateBranchFlowNextLogic(branchFlow)}
              title: 'Release \${{ needs.version.outputs.nextVersion }}'
              body: 'Automated release PR for version \${{ needs.version.outputs.nextVersion }}'
      `),
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
              targetBranch: ${generateBranchFlowNextLogic(branchFlow)}
              sourceBranch: \${{ github.ref_name }}
      `),
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
      `),
      required: false
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
      `),
      required: false
    }
  ]
  
  // Apply all operations
  applyPathOperations(doc.contents, operations)
  
  // Generate final content
  const finalContent = stringify(doc)
  
  return { 
    yamlContent: finalContent, 
    mergeStatus: ctx.existingPipeline ? 'merged' : 'overwritten'
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
export const generate = (ctx: PinionContext & { existingPipeline?: any }) =>
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
      const status = ctx.mergeStatus === 'merged' ? '🔄 Merged with existing' : '📝 Created new'
      console.log(`${status} .github/workflows/pipeline.yml`)
      return ctx
    })
    .then(renderTemplate(
      (ctx: any) => ctx.yamlContent,
      toFile('.github/workflows/pipeline.yml')
    ))
