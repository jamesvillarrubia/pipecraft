// Debug script for createPipelineContent function
import { readFileSync } from 'fs';

// Import the template functions (we'll need to extract them)
// For now, let's recreate the functions here for debugging

// Base pipeline YAML structure with all comments and formatting preserved
const getBasePipelineContent = () => {
  return `name: "Pipeline"

on:
  pull_request: ## REQUIRED ON PULL REQUEST MERGES FOR BRANCHES IN BRANCH FLOW
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

// Process YAML content to strip arrow bracket comments while preserving structure
const processYamlContent = (content: string): string => {
  console.log('🔍 Processing YAML content to remove arrow bracket comments...')
  
  // Split into lines to process each line
  const lines = content.split('\n')
  const processedLines: string[] = []
  
  console.log(`📄 Total lines to process: ${lines.length}`)
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Check if line contains arrow bracket comments
    if (line.includes('# <') && line.includes('>')) {
      console.log(`🗑️  Line ${i + 1}: Removing arrow bracket comment: "${line.trim()}"`)
      
      // Remove arrow bracket comments but keep the line if it has other content
      const withoutArrowComments = line.replace(/#\s*<[^>]*>/g, '').trim()
      if (withoutArrowComments) {
        console.log(`✅ Line ${i + 1}: Kept content after removing arrow comments: "${withoutArrowComments}"`)
        processedLines.push(withoutArrowComments)
      } else {
        console.log(`❌ Line ${i + 1}: Skipped line (only arrow bracket comments)`)
      }
      // Skip lines that are only arrow bracket comments
    } else {
      // Keep all other lines (including regular comments and content)
      processedLines.push(line)
    }
  }
  
  console.log(`📊 Processed lines: ${processedLines.length} (removed ${lines.length - processedLines.length} lines)`)
  
  return processedLines.join('\n')
}

// Create pipeline content with AST processing
const createPipelineContent = (ctx: any) => {
  console.log('🚀 Starting createPipelineContent function')
  console.log('📋 Context received:', JSON.stringify(ctx, null, 2))
  
  let content = getBasePipelineContent()
  console.log('📄 Base content length:', content.length, 'characters')

  // Process the content to remove arrow bracket comments
  console.log('\n🔧 Step 1: Processing YAML content to remove arrow bracket comments')
  content = processYamlContent(content)

  // Update dynamic values using string replacement to preserve formatting
  console.log('\n🔧 Step 2: Updating dynamic values')
  
  if (ctx.initialBranch) {
    console.log(`🔄 Replacing 'develop' with '${ctx.initialBranch}'`)
    const beforeReplace = content
    content = content.replace(/github\.ref_name == 'develop'/g, `github.ref_name == '${ctx.initialBranch}'`)
    const replacements = (beforeReplace.match(/github\.ref_name == 'develop'/g) || []).length
    console.log(`✅ Made ${replacements} replacements for initialBranch`)
  } else {
    console.log('⚠️  No initialBranch provided in context')
  }

  if (ctx.finalBranch) {
    console.log(`🔄 Replacing 'main' with '${ctx.finalBranch}'`)
    const beforeReplace = content
    content = content.replace(/targetBranch: 'main'/g, `targetBranch: '${ctx.finalBranch}'`)
    const replacements = (beforeReplace.match(/targetBranch: 'main'/g) || []).length
    console.log(`✅ Made ${replacements} replacements for finalBranch`)
  } else {
    console.log('⚠️  No finalBranch provided in context')
  }

  // Update domain outputs if domains are provided
  if (ctx.domains) {
    console.log('\n🔧 Step 3: Updating domain outputs')
    console.log('📋 Domains provided:', Object.keys(ctx.domains))
    
    const domainNames = Object.keys(ctx.domains)
    const domainOutputs = domainNames.map(name => 
      `      ${name}:
        value: \${{ jobs.changes.outputs.${name} }}`
    ).join('\n')
    
    console.log('📄 Generated domain outputs:')
    console.log(domainOutputs)
    
    // Replace the outputs section
    const regex = /    outputs:[\s\S]*?api:[\s\S]*?web:[\s\S]*?libs:[\s\S]*?cicd:[\s\S]*?(?=\n\s*\n|\n  \w+:|$)/
    const beforeReplace = content
    content = content.replace(regex, `    outputs:
${domainOutputs}`)
    
    if (content !== beforeReplace) {
      console.log('✅ Successfully replaced domain outputs')
    } else {
      console.log('❌ Failed to replace domain outputs - regex did not match')
      console.log('🔍 Looking for outputs section in content...')
      const outputsMatch = content.match(/    outputs:[\s\S]*?(?=\n  \w+:|$)/)
      if (outputsMatch) {
        console.log('📄 Found outputs section:')
        console.log(outputsMatch[0])
      } else {
        console.log('❌ No outputs section found')
      }
    }
  } else {
    console.log('⚠️  No domains provided in context')
  }

  console.log('\n✅ Final content length:', content.length, 'characters')
  return content
}

// Load the actual config from .flowcraftrc.json
const loadConfig = () => {
  try {
    const configContent = readFileSync('.flowcraftrc.json', 'utf8')
    return JSON.parse(configContent)
  } catch (error) {
    console.error('Failed to load config:', error)
    return {}
  }
}

// Main debug function
const main = () => {
  console.log('🧪 Debug Pipeline Content Function\n')
  
  const config = loadConfig()
  console.log('📋 Loaded config:', JSON.stringify(config, null, 2))
  
  // Set breakpoint here to debug
  const result = createPipelineContent(config)
  
  console.log('\n📄 Final result (first 500 characters):')
  console.log(result.substring(0, 500))
  console.log('...')
  
  // Save result to file for inspection
  import('fs').then(fs => {
    fs.writeFileSync('debug-pipeline-result.yml', result)
    console.log('\n💾 Saved full result to debug-pipeline-result.yml')
  })
}

// Run the debug function
main()
