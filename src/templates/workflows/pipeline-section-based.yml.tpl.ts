import { PinionContext, toFile, renderTemplate } from '@featherscloud/pinion'
import { parseDocument, stringify } from 'yaml'
import fs from 'fs'
import { extractSections, mergeSections, reconstructPipeline } from '../../utils/pipeline-sections'

/**
 * Section-based pipeline generator
 * 
 * Uses comment boundaries to define logical sections that can be:
 * - Template-managed (always use latest template)
 * - User-managed (preserve user customizations)  
 * - Mixed (merge template + user)
 */

// Generate dynamic branch flow logic
const generateBranchFlowNextLogic = (branchFlow: string[]) => {
  if (!branchFlow || branchFlow.length === 0) return "'main'"
  
  const conditions = branchFlow.map((branch, index) => {
    const nextBranch = index < branchFlow.length - 1 ? branchFlow[index + 1] : branchFlow[index]
    return `github.ref_name == '${branch}' && '${nextBranch}'`
  }).join(' || ')
  
  return `${{ ${conditions} || '${branchFlow[branchFlow.length - 1]}' }}`
}

/**
 * Get base template sections
 */
const getBaseTemplateSections = (ctx: any) => {
  const branchFlow = ctx.branchFlow || ['develop', 'staging', 'main']
  const branchFlowNextLogic = generateBranchFlowNextLogic(branchFlow)
  const createPRCondition = branchFlow.slice(0, -1).map((branch: string) => `github.ref_name == '${branch}'`).join(' || ')

  const templateContent = `
# =============================================================================
# FLOWCRAFT GENERATED PIPELINE
# =============================================================================
#
# Generated on: ${new Date().toISOString()}
# Changes to this file may be overwritten by running 'npx flowcraft generate'
# The pipeline will be generated based on the configuration in the .flowcraftrc.json file
# See https://github.com/jamesvillarrubia/flowcraft for more information
#
# ============================================================================= 

name: "Pipeline"

on:
  pull_request:
    branches:    
      - develop 
      - main
      - staging

  workflow_call:
    inputs: 
      version:
        description: 'The version to deploy'
        required: false
        type: string
      baseRef:
        description: 'The base reference for comparison'
        required: false
        type: string

  workflow_dispatch:
    inputs:
      version:
        description: 'The version to deploy'
        required: false
        type: string
      baseRef:
        description: 'The base reference for comparison'
        required: false
        type: string

jobs:
  # =============================================================================
  # CHANGES DETECTION
  # =============================================================================
  changes:
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/detect-changes
        with:
          baseRef: ${{ inputs.baseRef || 'main' }}

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

  # =============================================================================
  # VERSIONING
  # =============================================================================
  version:
    if: github.ref_name == '${branchFlow[0]}'
    needs: changes
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/calculate-version
        with:
          baseRef: ${{ inputs.baseRef || 'main' }}

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

  # =============================================================================
  # TAG & CREATE PR
  # =============================================================================     
  tag:
    if: github.ref_name == '${branchFlow[0]}'
    needs: version
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/create-tag
        with:
          version: ${{ needs.version.outputs.nextVersion }}

  createpr:
    if: github.ref_name != '${ctx.finalBranch}'
    needs: tag
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/create-pr
        with:
          sourceBranch: ${{ github.ref_name }}
          targetBranch: ${branchFlowNextLogic}
          title: 'Release ${{ needs.version.outputs.nextVersion }}'
          body: 'Automated release PR for version ${{ needs.version.outputs.nextVersion }}'    

  branch:
    needs: createpr
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/manage-branch
        with:
          action: 'fast-forward'
          targetBranch: ${branchFlowNextLogic}
          sourceBranch: ${{ github.ref_name }}
`

  // Apply dynamic variables
  let processedContent = templateContent
    .replace(/\$\{branchFlow\[0\]\}/g, branchFlow[0])
    .replace(/\$\{createPRCondition\}/g, createPRCondition)
    .replace(/\$\{branchFlowNextLogic\}/g, branchFlowNextLogic)

  return extractSections(processedContent)
}

/**
 * Create section-based pipeline content
 */
const createSectionBasedPipeline = (ctx: any) => {
  // Get template sections
  const templateSections = getBaseTemplateSections(ctx)
  
  // Load existing pipeline if it exists
  const existingPipeline = loadExistingPipeline('.github/workflows/pipeline.yml')
  let userSections: any[] = []
  
  if (existingPipeline) {
    userSections = extractSections(existingPipeline)
    console.log(`🔍 Found ${userSections.length} sections in existing pipeline`)
  }
  
  // Merge sections based on their type
  const mergedSections = mergeSections(templateSections, userSections)
  
  // Reconstruct pipeline
  const finalContent = reconstructPipeline(mergedSections)
  
  // Apply additional dynamic variables
  const processedContent = applyDynamicVariables(finalContent, ctx)
  
  // Report what was merged
  const templateManaged = mergedSections.filter(s => s.type === 'template').length
  const userManaged = mergedSections.filter(s => s.type === 'user').length
  const mixed = mergedSections.filter(s => s.type === 'mixed').length
  
  console.log(`📊 Sections: ${templateManaged} template, ${userManaged} user, ${mixed} mixed`)
  
  return { 
    yamlContent: processedContent, 
    mergeStatus: userSections.length > 0 ? 'merged' : 'overwritten',
    sectionCounts: { templateManaged, userManaged, mixed }
  }
}

/**
 * Apply dynamic template variables
 */
const applyDynamicVariables = (content: string, ctx: any): string => {
  let processedContent = content
  
  // Update initial branch if specified
  if (ctx.initialBranch) {
    processedContent = processedContent.replace(/github\.ref_name == 'develop'/g, `github.ref_name == '${ctx.initialBranch}'`)
  }
  
  // Update final branch if specified
  if (ctx.finalBranch) {
    processedContent = processedContent.replace(/targetBranch: 'main'/g, `targetBranch: '${ctx.finalBranch}'`)
  }
  
  // Update domain outputs if domains are provided
  if (ctx.domains) {
    const domainNames = Object.keys(ctx.domains)
    const domainOutputs = domainNames.map(name => 
      `      ${name}:
        value: ${{ jobs.changes.outputs.${name} }}`
    ).join('\n')
    
    processedContent = processedContent.replace(
      / {4}outputs:\s*\n\s*api:\s*\n\s*value:.*?\n\s*web:\s*\n\s*value:.*?\n\s*libs:\s*\n\s*value:.*?\n\s*cicd:\s*\n\s*value:.*?/s,
      `    outputs:
${domainOutputs}`
    )
  }
  
  return processedContent
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
 * Main export - section-based pipeline generator
 */
export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then((ctx) => {
      const result = createSectionBasedPipeline(ctx)
      return { 
        ...ctx, 
        yamlContent: result.yamlContent, 
        mergeStatus: result.mergeStatus,
        sectionCounts: result.sectionCounts
      }
    })
    .then((ctx) => {
      // Provide user feedback about file operation
      const status = ctx.mergeStatus === 'merged' ? '🔄 Merged with existing' : '📝 Created new'
      console.log(`${status} .github/workflows/pipeline.yml`)
      
      if (ctx.sectionCounts) {
        const { templateManaged, userManaged, mixed } = ctx.sectionCounts
        console.log(`📊 Sections: ${templateManaged} template, ${userManaged} user, ${mixed} mixed`)
      }
      
      return ctx
    })
    .then(renderTemplate(
      (ctx: any) => ctx.yamlContent,
      toFile('.github/workflows/pipeline.yml')
    ))
