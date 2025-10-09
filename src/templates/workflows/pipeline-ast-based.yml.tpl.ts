import { PinionContext, toFile, renderTemplate } from '@featherscloud/pinion'
import { parseDocument, stringify } from 'yaml'
import fs from 'fs'
// Removed incorrect toJS import

// Base pipeline YAML structure with all comments and formatting preserved
const getBasePipelineAST = () => {
  const doc = parseDocument(`name: "Pipeline"

on:
  pull_request: # < REQUIRED ON PULL REQUEST MERGES FOR BRANCHES IN BRANCH FLOW >
    branches:    
      - develop 
      - main
      - staging

  workflow_call:
    
    # < USER CUSTOMIZATION: Added custom input >

    inputs: 
      version: # REQUIRED IF WORKFLOW_CALL IS USED
        description: 'The version to deploy'
        required: false
        type: string
    # < USER CUSTOMIZATION: Added custom input >

  workflow_dispatch:
    # < USER CUSTOMIZATION: Added custom input >
    inputs:
      version: # REQUIRED IF WORKFLOW_DISPATCH IS USED
        description: 'The version to deploy'
        required: false
        type: string
    # < USER CUSTOMIZATION: Added custom input >

jobs:

  # < USER JOBS HERE >

  # =============================================================================
  # CHANGES DETECTION
  # =============================================================================
  changes:
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/detect-changes
        with:
          baseRef: \${{ inputs.baseRef || 'main' }}

  # < USER JOBS HERE >
  # =============================================================================
  # TESTING JOBS
  # =============================================================================
  # Add your testing jobs here
  # < USER JOBS HERE >
  # Example:
  # test-api: 
  #   needs: branch
  #   runs-on: ubuntu-latest
  #   steps:
  #     - name: Test API
  #       run: |
  #         echo "Run API tests"
  #
  # test-web:
  #   needs: branch
  #   runs-on: ubuntu-latest
  #   steps:
  #     - name: Test Web
  #       run: |
  #         echo "Run Web tests"

  # < USER JOBS HERE >

  # =============================================================================
  # VERSIONING
  # =============================================================================
  version:
    ## COULD BE CHANGED TO IF: github.ref_name == 'develop'
    if: github.ref_name == 'develop'
    needs: changes
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/calculate-version
        with:
          baseRef: \${{ inputs.baseRef || 'main' }}

  # < USER JOBS HERE >

  # =============================================================================
  # DEPLOYMENT JOBS
  # =============================================================================
  # Add your deployment jobs here
  # < USER JOBS HERE >
  # Example:
  # deploy-api:
  #   ## COULD BE CHANGED TO IF: github.ref_name == 'develop'
  #   if: github.ref_name == 'develop'
  #   needs: branch
  #   runs-on: ubuntu-latest
  #   steps:
  #     - name: Deploy API
  #       run: |
  #         echo "Deploy API to production"
  #
  # deploy-web:
  #   ## COULD BE CHANGED TO IF: github.ref_name == 'develop'
  #   if: github.ref_name == 'develop'
  #   needs: branch
  #   runs-on: ubuntu-latest
  #   steps:
  #     - name: Deploy Web
  #       run: |
  #         echo "Deploy Web to production"
  #

  # =============================================================================
  # TAG & CREATE PR
  # =============================================================================     
  tag:
    ## COULD BE CHANGED TO IF: github.ref_name == 'develop'
    if: github.ref_name == 'develop'
    needs: version
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/create-tag
        with:
          version: \${{ needs.version.outputs.nextVersion }}

  # < USER JOBS HERE >

  createpr:
    ## SHOULD BE ANY BRANCH EXCEPT the final branch
    if: github.ref_name == 'develop' || github.ref_name == 'test' || github.ref_name == 'staging'
    needs: tag
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/create-pr
        with:
          sourceBranch: \${{ github.ref_name }}
          targetBranch: 'main'
          title: 'Release \${{ needs.version.outputs.nextVersion }}'
          body: 'Automated release PR for version \${{ needs.version.outputs.nextVersion }}'    
  
  # < USER JOBS HERE >

  branch:
    ## SHOULD BE THE NEXT BRANCH

    needs: createpr
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/manage-branch
        with:
          action: 'fast-forward'
          targetBranch: 'main'
          sourceBranch: \${{ github.ref_name }}

    # < USER JOBS HERE >`)
  return doc
}

// Get base pipeline content as string (preserves all comments and formatting)
const getBasePipelineContent = () => {
  return `name: "Pipeline"

on:
  pull_request: # < REQUIRED ON PULL REQUEST MERGES FOR BRANCHES IN BRANCH FLOW >
    branches:    
      - develop 
      - main
      - staging

  workflow_call:
    
    # < USER CUSTOMIZATION: Added custom input >

    inputs: 
      version: # REQUIRED IF WORKFLOW_CALL IS USED
        description: 'The version to deploy'
        required: false
        type: string
    # < USER CUSTOMIZATION: Added custom input >

    outputs:
      # < USER CUSTOMIZATION: Added custom outputs >

      # REQUIRED FOR EACH DOMAIN IF DOMAINS ARE USED
      api: 
        value: \${{ jobs.changes.outputs.api }}
      web: 
        value: \${{ jobs.changes.outputs.web }}
      libs: 
        value: \${{ jobs.changes.outputs.libs }}
      cicd: 
        value: \${{ jobs.changes.outputs.cicd }}
      # < USER CUSTOMIZATION: Added custom outputs >

  workflow_dispatch:
    # < USER CUSTOMIZATION: Added custom input >
    inputs:
      version: # REQUIRED IF WORKFLOW_DISPATCH IS USED
        description: 'The version to deploy'
        required: false
        type: string
    # < USER CUSTOMIZATION: Added custom input >

jobs:

  # < USER JOBS HERE >

  # =============================================================================
  # CHANGES DETECTION
  # =============================================================================
  changes:
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/detect-changes
        with:
          baseRef: \${{ inputs.baseRef || 'main' }}

  # < USER JOBS HERE >
  # =============================================================================
  # TESTING JOBS
  # =============================================================================
  # Add your testing jobs here
  # < USER JOBS HERE >
  # Example:
  # test-api: 
  #   needs: branch
  #   runs-on: ubuntu-latest
  #   steps:
  #     - name: Test API
  #       run: |
  #         echo "Run API tests"
  #
  # test-web:
  #   needs: branch
  #   runs-on: ubuntu-latest
  #   steps:
  #     - name: Test Web
  #       run: |
  #         echo "Run Web tests"

  # < USER JOBS HERE >

  # =============================================================================
  # VERSIONING
  # =============================================================================
  version:
    ## COULD BE CHANGED TO IF: github.ref_name == 'develop'
    if: github.ref_name == 'develop'
    needs: changes
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/calculate-version
        with:
          baseRef: \${{ inputs.baseRef || 'main' }}

  # < USER JOBS HERE >

  # =============================================================================
  # DEPLOYMENT JOBS
  # =============================================================================
  # Add your deployment jobs here
  # < USER JOBS HERE >
  # Example:
  # deploy-api:
  #   ## COULD BE CHANGED TO IF: github.ref_name == 'develop'
  #   if: github.ref_name == 'develop'
  #   needs: branch
  #   runs-on: ubuntu-latest
  #   steps:
  #     - name: Deploy API
  #       run: |
  #         echo "Deploy API to production"
  #
  # deploy-web:
  #   ## COULD BE CHANGED TO IF: github.ref_name == 'develop'
  #   if: github.ref_name == 'develop'
  #   needs: branch
  #   runs-on: ubuntu-latest
  #   steps:
  #     - name: Deploy Web
  #       run: |
  #         echo "Deploy Web to production"
  #

  # =============================================================================
  # TAG & CREATE PR
  # =============================================================================     
  tag:
    ## COULD BE CHANGED TO IF: github.ref_name == 'develop'
    if: github.ref_name == 'develop'
    needs: version
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/create-tag
        with:
          version: \${{ needs.version.outputs.nextVersion }}

  # < USER JOBS HERE >

  createpr:
    ## SHOULD BE ANY BRANCH EXCEPT the final branch
    if: github.ref_name == 'develop' || github.ref_name == 'test' || github.ref_name == 'staging'
    needs: tag
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/create-pr
        with:
          sourceBranch: \${{ github.ref_name }}
          targetBranch: 'main'
          title: 'Release \${{ needs.version.outputs.nextVersion }}'
          body: 'Automated release PR for version \${{ needs.version.outputs.nextVersion }}'    
  
  # < USER JOBS HERE >

  branch:
    ## SHOULD BE THE NEXT BRANCH

    needs: createpr
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/manage-branch
        with:
          action: 'fast-forward'
          targetBranch: 'main'
          sourceBranch: \${{ github.ref_name }}

    # < USER JOBS HERE >`
}

  // Create pipeline content with preserved comments and formatting
const createPipelineContent = (ctx: any) => {

  let existingPipelineContent = loadExistingPipeline('.github/workflows/pipeline.yml')
  
  // If no existing pipeline, use base structure
  let yamlContent = existingPipelineContent || getBasePipelineContent()
  
  // Use string replacement to update only dynamic values while preserving everything else
  // Update pull request branches
  const branchList = ctx.branchFlow.map((branch: string) => `      - ${branch}`).join('\n')
  yamlContent = yamlContent.replace(
    /branches:\s*\n\s*-\s+develop\s*\n\s*-\s+main\s*\n\s*-\s+staging/g,
    `branches:\n${branchList}`
  )
  
  // Update domain outputs in workflow_call outputs section
  if (ctx.domains && ctx.domains.length > 0) {
    const domainOutputs = ctx.domains.map((domain: string) => 
      `      ${domain}: \n        value: \${{ jobs.changes.outputs.${domain} }}`
    ).join('\n')
    
    yamlContent = yamlContent.replace(
      /outputs:\s*\n\s*api:\s*\n\s*value:\s*\${{ jobs\.changes\.outputs\.api }}\s*\n\s*web:\s*\n\s*value:\s*\${{ jobs\.changes\.outputs\.web }}\s*\n\s*libs:\s*\n\s*value:\s*\${{ jobs\.changes\.outputs\.libs }}\s*\n\s*cicd:\s*\n\s*value:\s*\${{ jobs\.changes\.outputs\.cicd }}/g,
      `outputs:\n${domainOutputs}`
    )
  }
  
  return yamlContent
}

// Load existing pipeline content as string
const loadExistingPipeline = (filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8')
    }
  } catch (error) {
    console.warn(`Could not load existing pipeline from ${filePath}:`, error)
  }
  return null
}

// Generate pipeline with proper merging
const generatePipeline = (ctx: any) => {
  const yamlContent = createPipelineContent(ctx)
  const mergeStatus = fs.existsSync('.github/workflows/pipeline.yml') ? 'Merged with existing' : 'Created new'
  return { yamlContent, mergeStatus }
}

// Main generate function
export const generate = (ctx: PinionContext) => {
  const { yamlContent, mergeStatus } = generatePipeline(ctx)
  
  return toFile(
    yamlContent,
    '.github/workflows/pipeline.yml',
    ctx
  ).then(() => {
    console.log(`✅ Pipeline workflow: ${mergeStatus}`)
    return ctx
  })
}
