import { PinionContext, toFile, renderTemplate } from '@featherscloud/pinion'
import fs from 'fs'
import dedent from 'dedent'
import { DomainConfig } from '../../types/index.js'

// Template for the Changes Detection GitHub Action
const changesActionTemplate = (ctx: any) => {
  const domainOutputs = Object.entries(ctx.domains).map((entry) => {
    const [domainName, domainConfig] = entry as [string, DomainConfig];
    return `  ${domainName}:
    description: 'Whether ${domainName} domain has changes'
    value: \${{ steps.merge.outputs.${domainName} }}`;
  }).join('\n');

  const domainFilters = Object.entries(ctx.domains).map((entry) => {
    const [domainName, domainConfig] = entry as [string, DomainConfig];
    return `          ${domainName}:\n            - '${domainConfig.paths.join("'\\n            - '")}'`;
  }).join('\n');

  const domainEchoes = Object.entries(ctx.domains).map((entry) => {
    const [domainName, domainConfig] = entry as [string, DomainConfig];
    return `        echo "${domainName}=\${{ contains(steps.filter.outputs.changes, '${domainName}') }}" >> $GITHUB_OUTPUT`
  }).join('\n');

  const domainResults = Object.entries(ctx.domains).map((entry) => {
    const [domainName, domainConfig] = entry as [string, DomainConfig];
    return `        echo "  ${domainName}: \${{ contains(steps.filter.outputs.changes, '${domainName}') }}"`
  }).join('\n');

  return `name: 'Detect Changes'
description: 'Detect changes in different application domains based on file paths'
author: 'Flowcraft'

inputs:
  baseRef:
    description: 'Base reference to compare against'
    required: false
    default: 'main'

outputs:
${domainOutputs}

runs:
  using: 'composite'
  steps:
    - name: Checkout Code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Set Base Branch
      id: set-base
      shell: bash
      run: |
        base_branch=\${{ inputs.baseRef || 'main' }}
        echo "base_branch=$base_branch" >> $GITHUB_OUTPUT
        echo "base_branch=$base_branch" >> $GITHUB_ENV

    - name: Install Git
      shell: bash
      run: |
        apt-get update && apt-get install -y git

    - name: Detect Changes
      uses: dorny/paths-filter@v3
      id: filter
      with:
        base: \${{ steps.set-base.outputs.base_branch }}
        filters: |
${domainFilters}

    - name: Merge filter outputs
      id: merge
      shell: bash
      run: |
${domainEchoes}
        
        echo "📋 Change Detection Results:"
${domainResults}`
}

export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then((ctx) => {
      // Check if file exists to determine merge status
      const filePath = '.github/actions/detect-changes/action.yml'
      const exists = fs.existsSync(filePath)
      const status = exists ? '🔄 Merged with existing' : '📝 Created new'
      console.log(`${status} ${filePath}`)
      return ctx
    })
    .then(renderTemplate(changesActionTemplate, toFile('.github/actions/detect-changes/action.yml')))