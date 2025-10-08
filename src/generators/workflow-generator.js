import { cosmiconfigSync } from 'cosmiconfig'
import { writeFile } from 'fs/promises'

/**
 * Generate workflow from configuration file
 * @param {string} configPath - Path to the configuration file
 * @param {string} outputPath - Path where to write the generated workflow
 */
export const generateFromConfig = async (configPath, outputPath = '.github/workflows/job.changes.yml') => {
  try {
    const explorer = cosmiconfigSync('trunkflow')
    const result = explorer.search()
    
    if (!result) {
      throw new Error(`No configuration file found. Expected: ${configPath}`)
    }
    
    const config = result.config
    
    if (!config.domains) {
      throw new Error('Configuration must include a "domains" section')
    }

    if (!config.branchFlow || !Array.isArray(config.branchFlow)) {
      throw new Error('Configuration must include a "branchFlow" array')
    }

    // Generate the workflow content
    const workflowContent = generateWorkflowContent(config.domains, config.branchFlow)
    
    // Write the file
    await writeFile(outputPath, workflowContent)
    console.log(`✅ Generated workflow file at ${outputPath}`)
    
  } catch (error) {
    console.error('❌ Failed to generate workflow:', error.message)
    throw error
  }
}

/**
 * Generate workflow content from domains and branch flow
 * @param {Object} domains - Domains configuration
 * @param {Array} branchFlow - Branch flow array
 * @returns {string} Generated workflow content
 */
const generateWorkflowContent = (domains, branchFlow) => {
  const domainNames = Object.keys(domains)
  
  // Generate outputs section
  let outputs = ''
  for (const domainName of domainNames) {
    outputs += `      ${domainName}: 
        value: ${{ jobs.changes.outputs.${domainName} }}
`
  }
  
  // Generate job outputs
  let jobOutputs = ''
  for (const domainName of domainNames) {
    jobOutputs += `      ${domainName}: ${{ steps.merge.outputs.${domainName} }}
`
  }
  
  // Generate branch cases
  let branchCases = ''
  for (let i = 0; i < branchFlow.length - 1; i++) {
    const branch = branchFlow[i]
    const nextBranch = branchFlow[i + 1]
    branchCases += `          'refs/heads/${branch}')
            base_branch='${nextBranch}'
            ;;
`
  }
  
  // Generate filters
  let filters = ''
  for (const [domainName, domainConfig] of Object.entries(domains)) {
    filters += `          ${domainName}:
`
    for (const path of domainConfig.paths) {
      filters += `            - '${path}'
`
    }
  }
  
  // Generate merge outputs
  let mergeOutputs = ''
  for (const domainName of domainNames) {
    mergeOutputs += `        echo "${domainName}=${{ steps.filter.outputs.${domainName} == 'true' || github.ref == 'refs/heads/main' || github.ref == 'refs/heads/staging' || github.ref == 'refs/heads/test' }}" >> $GITHUB_OUTPUT
`
  }
  
  // Generate debug outputs
  let debugOutputs = ''
  for (const domainName of domainNames) {
    debugOutputs += `        echo "${domainName.toUpperCase()}: ${{ steps.merge.outputs.${domainName} }}"
`
  }

  return `name: "Changes"

on:
  workflow_call:
    outputs:
${outputs}
      
  workflow_dispatch:

jobs:
  changes:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
    outputs:
${jobOutputs}
    steps:

    - uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Set Base Branch
      id: set-base
      ## Updated ${branchFlow.length}-branch flow: ${branchFlow.join(' → ')}
      ## Each branch compares to the next in the flow
      run: |
        case '${{ github.ref }}' in
${branchCases}
          *)
            base_branch='${branchFlow[0]}'
            ;;
        esac
        echo "Base branch determined: $base_branch"
        echo "base_branch=$base_branch" >> $GITHUB_ENV

    - uses: dorny/paths-filter@v3
      id: filter
      with:
        base: ${{ env.base_branch }}
        filters: |
${filters}

    - name: Merge filter outputs with branch condition
      id: merge
      run: |
        # Force full deployment on main, staging, and test branches
${mergeOutputs}

    - name: Debug Paths Filter Outputs
      run: |
${debugOutputs}`
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const configPath = process.argv[2] || '.trunkflowrc.json'
  const outputPath = process.argv[3] || '.github/workflows/job.changes.yml'
  
  generateFromConfig(configPath, outputPath)
    .catch(process.exit)
}