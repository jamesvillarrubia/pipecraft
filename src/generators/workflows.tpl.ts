import { PinionContext, toFile, renderTemplate, loadJSON, when } from '@featherscloud/pinion'
import { existsSync } from 'fs'
import { join } from 'path'

export interface WorkflowContext extends PinionContext {
  ciProvider: 'github' | 'gitlab'
  domains: Record<string, { paths: string[], description: string }>
  branchFlow: string[]
  semver: {
    bumpRules: Record<string, string>
  }
  actions: {
    onDevelopMerge: string[]
    onStagingMerge: string[]
  }
}

const changesWorkflowTemplate = (ctx: WorkflowContext) => {
  const domainNames = Object.keys(ctx.domains)
  const outputs = domainNames.map(name => `      ${name}: 
        value: ${{ jobs.changes.outputs.${name} }}`).join('\n')
  
  const jobOutputs = domainNames.map(name => `      ${name}: ${{ steps.merge.outputs.${name} }}`).join('\n')
  
  const branchCases = ctx.branchFlow.slice(0, -1).map((branch, index) => 
    `          'refs/heads/${branch}')
            base_branch='${ctx.branchFlow[index + 1]}'
            ;;`
  ).join('\n')
  
  const filters = Object.entries(ctx.domains).map(([name, config]) => 
    `          ${name}:
${config.paths.map(path => `            - '${path}'`).join('\n')}`
  ).join('\n')
  
  const mergeOutputs = domainNames.map(name => 
    `        echo "${name}=${{ steps.filter.outputs.${name} == 'true' || github.ref == 'refs/heads/main' || github.ref == 'refs/heads/staging' || github.ref == 'refs/heads/test' }}" >> $GITHUB_OUTPUT`
  ).join('\n')
  
  const debugOutputs = domainNames.map(name => 
    `        echo "${name.toUpperCase()}: ${{ steps.merge.outputs.${name} }}"`
  ).join('\n')

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
      ## Updated ${ctx.branchFlow.length}-branch flow: ${ctx.branchFlow.join(' → ')}
      ## Each branch compares to the next in the flow
      run: |
        case '${{ github.ref }}' in
${branchCases}
          *)
            base_branch='${ctx.branchFlow[0]}'
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

const versionWorkflowTemplate = (ctx: WorkflowContext) => `name: "Version Calculation"

on:
  workflow_call:
    inputs:
      baseRef:
        required: true
        type: string
        description: "Base reference for version calculation"
    outputs:
      version:
        value: ${{ jobs.calculate-version.outputs.version }}
      versionType:
        value: ${{ jobs.calculate-version.outputs.versionType }}
      nextVersion:
        value: ${{ jobs.calculate-version.outputs.nextVersion }}
      
  workflow_dispatch:
    inputs:
      baseRef:
        description: 'Base reference for version calculation'
        required: true
        default: 'main'

jobs:
  calculate-version:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    outputs:
      version: ${{ steps.version.outputs.version }}
      versionType: ${{ steps.version.outputs.versionType }}
      nextVersion: ${{ steps.version.outputs.nextVersion }}
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Get Latest Tag
      id: get-latest-tag
      run: |
        LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
        echo "latest_tag=$LATEST_TAG" >> $GITHUB_OUTPUT
        echo "Latest tag: $LATEST_TAG"

    - name: Calculate Version Bump
      id: version
      run: |
        COMMITS=$(git log --oneline ${{ steps.get-latest-tag.outputs.latest_tag }}..HEAD --pretty=format:"%s")
        
        VERSION_TYPE="patch"
        
        if echo "$COMMITS" | grep -q "BREAKING CHANGE\\|!:"
        then
          VERSION_TYPE="major"
        elif echo "$COMMITS" | grep -q "^feat"
        then
          VERSION_TYPE="minor"
        elif echo "$COMMITS" | grep -q "^fix"
        then
          VERSION_TYPE="patch"
        fi
        
        CURRENT_VERSION=$(echo "${{ steps.get-latest-tag.outputs.latest_tag }}" | sed 's/v//')
        
        IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
        
        case "$VERSION_TYPE" in
          "major")
            MAJOR=$((MAJOR + 1))
            MINOR=0
            PATCH=0
            ;;
          "minor")
            MINOR=$((MINOR + 1))
            PATCH=0
            ;;
          "patch")
            PATCH=$((PATCH + 1))
            ;;
        esac
        
        NEXT_VERSION="v$MAJOR.$MINOR.$PATCH"
        
        echo "version=$CURRENT_VERSION" >> $GITHUB_OUTPUT
        echo "versionType=$VERSION_TYPE" >> $GITHUB_OUTPUT
        echo "nextVersion=$NEXT_VERSION" >> $GITHUB_OUTPUT
        
        echo "Current version: $CURRENT_VERSION"
        echo "Version type: $VERSION_TYPE"
        echo "Next version: $NEXT_VERSION"

    - name: Debug Version Information
      run: |
        echo "Current version: ${{ steps.version.outputs.version }}"
        echo "Version type: ${{ steps.version.outputs.versionType }}"
        echo "Next version: ${{ steps.version.outputs.nextVersion }}"
`

const pipelineWorkflowTemplate = (ctx: WorkflowContext) => {
  const domainNames = Object.keys(ctx.domains)
  const domainOutputs = domainNames.map(name => `      ${name}: 
        value: ${{ jobs.changes.outputs.${name} }}`).join('\n')
  
  const branchTriggers = ctx.branchFlow.map(branch => `      - ${branch}`).join('\n')
  
  return `name: "Flowcraft Pipeline"

on:
  push:
    branches:
${branchTriggers}
  pull_request:
    branches:
${branchTriggers}
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        type: choice
        options:
        - development
        - staging
        - production
      forceDeploy:
        description: 'Force deployment even if no changes detected'
        required: false
        type: boolean
        default: false

env:
  BRANCH_FLOW: ${JSON.stringify(ctx.branchFlow)}
  CI_PROVIDER: ${ctx.ciProvider}

jobs:
  # Detect changes in different domains
  changes:
    uses: ./.github/workflows/job.changes.yml
    secrets: inherit

  # Calculate version bump for releases
  version:
    if: github.ref == 'refs/heads/${ctx.branchFlow[ctx.branchFlow.length - 1]}' || github.event_name == 'workflow_dispatch'
    uses: ./.github/workflows/job.version.yml
    with:
      baseRef: '${ctx.branchFlow[ctx.branchFlow.length - 1]}'
    secrets: inherit

  # Create and manage branches
  branch-management:
    if: github.ref == 'refs/heads/${ctx.branchFlow[0]}' && needs.changes.outputs.api == 'true'
    needs: [changes]
    uses: ./.github/workflows/job.branch.yml
    with:
      action: 'fast-forward'
      sourceBranch: '${ctx.branchFlow[0]}'
      targetBranch: '${ctx.branchFlow[1]}'
    secrets: inherit

  # Create PR for non-patch releases
  create-pr:
    if: github.ref == 'refs/heads/${ctx.branchFlow[ctx.branchFlow.length - 2]}' && needs.version.outputs.versionType != 'patch'
    needs: [version]
    uses: ./.github/workflows/job.createpr.yml
    with:
      sourceBranch: '${ctx.branchFlow[ctx.branchFlow.length - 2]}'
      targetBranch: '${ctx.branchFlow[ctx.branchFlow.length - 1]}'
      title: 'Release ${{ needs.version.outputs.nextVersion }}'
      body: |
        ## Release ${{ needs.version.outputs.nextVersion }}
        
        This is an automated release PR for version ${{ needs.version.outputs.nextVersion }}.
        
        **Version Type:** ${{ needs.version.outputs.versionType }}
        **Current Version:** ${{ needs.version.outputs.version }}
        **Next Version:** ${{ needs.version.outputs.nextVersion }}
        
        Please review and approve this release.
      labels: 'release,automated'
    secrets: inherit

  # Create tag for releases
  create-tag:
    if: github.ref == 'refs/heads/${ctx.branchFlow[ctx.branchFlow.length - 1]}' && needs.version.outputs.versionType == 'patch'
    needs: [version]
    uses: ./.github/workflows/job.tag.yml
    with:
      version: '${{ needs.version.outputs.nextVersion }}'
      tagMessage: 'Release ${{ needs.version.outputs.nextVersion }}'
    secrets: inherit

  # Deploy applications based on changes
  deploy-apps:
    if: always() && (needs.changes.outputs.api == 'true' || needs.changes.outputs.web == 'true' || needs.changes.outputs.libs == 'true' || github.event.inputs.forceDeploy == 'true')
    needs: [changes, version]
    uses: ./.github/workflows/job.apps.yml
    with:
      environment: ${{ github.ref == 'refs/heads/${ctx.branchFlow[0]}' && 'development' || github.ref == 'refs/heads/${ctx.branchFlow[1]}' && 'staging' || 'production' }}
      domains: ${{ needs.changes.outputs.api == 'true' && 'api' || '' }}${{ needs.changes.outputs.web == 'true' && ',web' || '' }}${{ needs.changes.outputs.libs == 'true' && ',libs' || '' }}
      version: ${{ needs.version.outputs.nextVersion || 'latest' }}
    secrets: inherit

  # Summary job
  summary:
    if: always()
    needs: [changes, version, branch-management, create-pr, create-tag, deploy-apps]
    runs-on: ubuntu-latest
    steps:
    - name: Pipeline Summary
      run: |
        echo "## 🚀 Flowcraft Pipeline Summary" >> $GITHUB_STEP_SUMMARY
        echo "" >> $GITHUB_STEP_SUMMARY
        
        echo "### 📊 Change Detection" >> $GITHUB_STEP_SUMMARY
${domainNames.map(name => `        echo "- **${name.toUpperCase()}**: ${{ needs.changes.outputs.${name} == 'true' && '✅ Changed' || '❌ No changes' }}" >> $GITHUB_STEP_SUMMARY`).join('\n')}
        echo "" >> $GITHUB_STEP_SUMMARY
        
        echo "### 🏷️ Version Information" >> $GITHUB_STEP_SUMMARY
        echo "- **Current Version**: ${{ needs.version.outputs.version || 'N/A' }}" >> $GITHUB_STEP_SUMMARY
        echo "- **Version Type**: ${{ needs.version.outputs.versionType || 'N/A' }}" >> $GITHUB_STEP_SUMMARY
        echo "- **Next Version**: ${{ needs.version.outputs.nextVersion || 'N/A' }}" >> $GITHUB_STEP_SUMMARY
        echo "" >> $GITHUB_STEP_SUMMARY
        
        echo "### 🔄 Branch Management" >> $GITHUB_STEP_SUMMARY
        echo "- **Fast-forward**: ${{ needs.branch-management.result == 'success' && '✅ Success' || needs.branch-management.result == 'skipped' && '⏭️ Skipped' || '❌ Failed' }}" >> $GITHUB_STEP_SUMMARY
        echo "- **PR Creation**: ${{ needs.create-pr.result == 'success' && '✅ Success' || needs.create-pr.result == 'skipped' && '⏭️ Skipped' || '❌ Failed' }}" >> $GITHUB_STEP_SUMMARY
        echo "" >> $GITHUB_STEP_SUMMARY
        
        echo "### 🏷️ Tag Management" >> $GITHUB_STEP_SUMMARY
        echo "- **Tag Creation**: ${{ needs.create-tag.result == 'success' && '✅ Success' || needs.create-tag.result == 'skipped' && '⏭️ Skipped' || '❌ Failed' }}" >> $GITHUB_STEP_SUMMARY
        echo "" >> $GITHUB_STEP_SUMMARY
        
        echo "### 🚀 Deployment" >> $GITHUB_STEP_SUMMARY
        echo "- **Status**: ${{ needs.deploy-apps.outputs.deploymentStatus || 'N/A' }}" >> $GITHUB_STEP_SUMMARY
        echo "- **Domains**: ${{ needs.deploy-apps.outputs.deployedDomains || 'N/A' }}" >> $GITHUB_STEP_SUMMARY
        echo "" >> $GITHUB_STEP_SUMMARY
        
        echo "### 📋 Next Steps" >> $GITHUB_STEP_SUMMARY
        if [ "${{ needs.create-pr.result }}" == "success" ]; then
          echo "- Review and approve the release PR" >> $GITHUB_STEP_SUMMARY
        fi
        if [ "${{ needs.create-tag.result }}" == "success" ]; then
          echo "- Tag ${{ needs.version.outputs.nextVersion }} has been created" >> $GITHUB_STEP_SUMMARY
        fi
        if [ "${{ needs.deploy-apps.result }}" == "success" ]; then
          echo "- Applications have been deployed successfully" >> $GITHUB_STEP_SUMMARY
        fi
`
}

export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then(loadJSON(
      () => '.trunkflowrc.json',
      (config) => ({ ...ctx, ...config } as WorkflowContext),
      () => ({ ...ctx, ...defaultConfig } as WorkflowContext)
    ))
    .then(when(
      (ctx) => ctx.ciProvider === 'github',
      renderTemplate(changesWorkflowTemplate, toFile('.github/workflows/job.changes.yml'))
    ))
    .then(when(
      (ctx) => ctx.ciProvider === 'github',
      renderTemplate(versionWorkflowTemplate, toFile('.github/workflows/job.version.yml'))
    ))
    .then(when(
      (ctx) => ctx.ciProvider === 'github',
      renderTemplate(pipelineWorkflowTemplate, toFile('.github/workflows/pipeline.yml'))
    ))
    .then(when(
      (ctx) => ctx.ciProvider === 'gitlab',
      renderTemplate(() => `# GitLab CI/CD Pipeline

This is a placeholder for GitLab CI/CD pipeline generation.
GitLab support is coming soon!

For now, please use GitHub Actions or wait for GitLab support.
`, toFile('.gitlab-ci.yml')))
    )
