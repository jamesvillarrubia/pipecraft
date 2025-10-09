import { PinionContext, toFile, renderTemplate } from '@featherscloud/pinion'

// Template for the Changes Detection GitHub Action
const changesActionTemplate = (ctx: any) => `name: 'Detect Changes'
description: 'Detect changes in different application domains based on file paths'
author: 'Flowcraft'

inputs:
  baseRef:
    description: 'Base reference to compare against'
    required: false
    default: 'main'

outputs:
<% for (const [domainName, domainConfig] of Object.entries(ctx.domains)) { -%>
  <%= domainName %>:
    description: 'Whether <%= domainName %> domain has changes'
    value: \${{ steps.merge.outputs.<%= domainName %> }}
<% } -%>

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
        base_branch="\${{ inputs.baseRef }}"
        echo "base_branch=$base_branch" >> $GITHUB_OUTPUT
        echo "base_branch=$base_branch" >> $GITHUB_ENV
        echo "Using base branch: $base_branch"

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
<% for (const [domainName, domainConfig] of Object.entries(ctx.domains)) { -%>
          <%= domainName %>:
            - '<%= domainConfig.paths.join("'\\n            - '") %>'
<% } -%>

    - name: Merge filter outputs
      id: merge
      shell: bash
      run: |
<% for (const [domainName, domainConfig] of Object.entries(ctx.domains)) { -%>
        echo "<%= domainName %>=\${{ contains(steps.filter.outputs.changes, '<%= domainName %>') }}" >> $GITHUB_OUTPUT
<% } -%>
        
        echo "📋 Change Detection Results:"
<% for (const [domainName, domainConfig] of Object.entries(ctx.domains)) { -%>
        echo "  <%= domainName %>: \${{ contains(steps.filter.outputs.changes, '<%= domainName %>') }}"
<% } -%>`

export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then(renderTemplate(changesActionTemplate, toFile('.github/actions/job._changes/action.yml')))
