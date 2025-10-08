import { PinionContext, toFile, renderTemplate } from '@featherscloud/pinion'

// Template for the Changes workflow
const changesWorkflowTemplate = (ctx: any) => `name: "Changes"

on:
  workflow_call:
    outputs:
<% for (const [domainName, domainConfig] of Object.entries(ctx.domains)) { -%>
      <%= domainName %>: 
        value: ${{ jobs.changes.outputs.<%= domainName %> }}
<% } -%>
      
  workflow_dispatch:

jobs:
  changes:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
    outputs:
<% for (const [domainName, domainConfig] of Object.entries(ctx.domains)) { -%>
      <%= domainName %>: ${{ steps.merge.outputs.<%= domainName %> }}
<% } -%>
    steps:

    - uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Set Base Branch
      id: set-base
      ## Updated <%= ctx.branchFlow.length %>-branch flow: <%= ctx.branchFlow.join(' → ') %>
      ## Each branch compares to the next in the flow
      run: |
        case '${{ github.ref }}' in
<% for (let i = 0; i < ctx.branchFlow.length - 1; i++) { -%>
          'refs/heads/<%= ctx.branchFlow[i] %>')
            base_branch='<%= ctx.branchFlow[i + 1] %>'
            ;;
<% } -%>
          *)
            base_branch='<%= ctx.branchFlow[0] %>'
            ;;
        esac
        echo "Base branch determined: $base_branch"
        echo "base_branch=$base_branch" >> $GITHUB_ENV

    - uses: dorny/paths-filter@v3
      id: filter
      with:
        base: ${{ env.base_branch }}
        filters: |
<% for (const [domainName, domainConfig] of Object.entries(ctx.domains)) { -%>
          <%= domainName %>:
<% for (const path of domainConfig.paths) { -%>
            - '<%= path %>'
<% } -%>
<% } -%>

    - name: Merge filter outputs with branch condition
      id: merge
      run: |
        # Force full deployment on main, staging, and test branches
<% for (const [domainName, domainConfig] of Object.entries(ctx.domains)) { -%>
        echo "<%= domainName %>=${{ steps.filter.outputs.<%= domainName %> == 'true' || github.ref == 'refs/heads/main' || github.ref == 'refs/heads/staging' || github.ref == 'refs/heads/test' }}" >> $GITHUB_OUTPUT
<% } -%>

    - name: Debug Paths Filter Outputs
      run: |
<% for (const [domainName, domainConfig] of Object.entries(ctx.domains)) { -%>
        echo "<%= domainName.toUpperCase() %>: ${{ steps.merge.outputs.<%= domainName %> }}"
<% } -%>`

export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then(renderTemplate(changesWorkflowTemplate, toFile('.github/workflows/job.changes.yml')))
