/**
 * Nx Sequential Pipeline Template
 *
 * Generates a workflow that uses Nx's affected command to intelligently test only changed projects.
 * Runs tasks sequentially in a single job, leveraging Nx's built-in caching for speed.
 *
 * This is Option 1 (Sequential Strategy) - simple, fast, and leverages Nx's intelligence.
 */

import { PinionContext } from '@featherscloud/pinion'
import { PipecraftConfig } from '../../types/index.js'

interface NxPipelineContext extends PinionContext {
  config: PipecraftConfig
  branchFlow: string[]
}

export const generateNxSequentialPipeline = (ctx: NxPipelineContext) => {
  const { config } = ctx
  const nxConfig = config.nx

  if (!nxConfig || !nxConfig.enabled) {
    throw new Error('Nx configuration not found or not enabled')
  }

  const tasks = nxConfig.tasks || ['lint', 'test', 'build']
  const baseRef = nxConfig.baseRef || 'origin/main'
  const enableCache = nxConfig.enableCache !== false
  const branchList = ctx.branchFlow.join(',')

  return `#=============================================================================
# PIPECRAFT MANAGED WORKFLOW - NX MONOREPO
#=============================================================================

# ✅ YOU CAN CUSTOMIZE:
#   - Node.js version
#   - Package manager (npm/pnpm/yarn)
#   - Cache settings
#   - Deploy jobs

# ⚠️  PIPECRAFT MANAGES (do not modify):
#   - Workflow triggers and job dependencies
#   - Nx affected commands and task orchestration
#   - Version calculation and promotion flow

# 📖 Learn more: https://pipecraft.thecraftlab.dev
#=============================================================================

name: "Nx CI/CD Pipeline"

run-name: "\${{ github.event_name == 'pull_request' &&
  !contains('${branchList}', github.head_ref) &&
  github.event.pull_request.title || github.ref_name }} #\${{ inputs.run_number
  || github.run_number }}\${{ inputs.version && format(' - {0}', inputs.version)
  || '' }}"

on:
  workflow_dispatch:
    inputs:
      version:
        description: The version to deploy
        required: false
        type: string
      baseRef:
        description: The base reference for Nx affected detection
        required: false
        type: string
      run_number:
        description: The original run number from develop branch
        required: false
        type: string
      commitSha:
        description: The exact commit SHA to checkout and test
        required: false
        type: string
  workflow_call:
    inputs:
      version:
        description: The version to deploy
        required: false
        type: string
      baseRef:
        description: The base reference for Nx affected detection
        required: false
        type: string
      run_number:
        description: The original run number from develop branch
        required: false
        type: string
      commitSha:
        description: The exact commit SHA to checkout and test
        required: false
        type: string
  push:
    branches:
      - ${ctx.branchFlow.map(b => `${b}`).join('\n      - ')}
  pull_request:
    types:
      - opened
      - synchronize
      - reopened
    branches:
      - ${ctx.branchFlow[0]}

jobs:
  #=============================================================================
  # NX CI - All Tasks Sequential (⚠️  Managed by Pipecraft - do not modify)
  #=============================================================================
  # This job runs all Nx tasks sequentially using \`nx affected\`.
  # Nx handles dependency detection, caching, and parallel execution internally.
  nx-ci:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci${enableCache ? `

      - name: Restore Nx Cache
        uses: actions/cache/restore@v3
        with:
          path: .nx/cache
          key: nx-\${{ hashFiles('package-lock.json') }}-\${{ github.sha }}
          restore-keys: |
            nx-\${{ hashFiles('package-lock.json') }}-
            nx-` : ''}
${tasks.map(task => `
      - name: Run Nx Affected - ${task}
        run: npx nx affected --target=${task} --base=\${{ inputs.baseRef || '${baseRef}' }}`).join('')}${enableCache ? `

      - name: Save Nx Cache
        if: always()
        uses: actions/cache/save@v3
        with:
          path: .nx/cache
          key: nx-\${{ hashFiles('package-lock.json') }}-\${{ github.sha }}` : ''}

  #=============================================================================
  # VERSIONING (⚠️  Managed by Pipecraft - do not modify)
  #=============================================================================
  version:
    if: \${{ always() && github.event_name != 'pull_request' && needs.nx-ci.result == 'success' }}
    needs: [ nx-ci ]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
      - uses: ./.github/actions/calculate-version
        id: version
        with:
          baseRef: \${{ inputs.baseRef || 'main' }}
          commitSha: \${{ inputs.commitSha || github.sha }}
    outputs:
      version: \${{ steps.version.outputs.version }}

  #=============================================================================
  # TAG & PROMOTE (⚠️  Managed by Pipecraft - do not modify)
  #=============================================================================
  tag:
    if: \${{ always() && needs.version.result == 'success' && needs.version.outputs.version != '' }}
    needs: [ version ]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
      - uses: ./.github/actions/create-tag
        with:
          version: \${{ needs.version.outputs.version }}
          commitSha: \${{ inputs.commitSha || github.sha }}

  promote:
    if: \${{ always() && needs.tag.result == 'success' }}
    needs: [ tag, version ]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
      - uses: ./.github/actions/promote-branch
        with:
          version: \${{ needs.version.outputs.version }}
          currentBranch: \${{ github.ref_name }}
          nextBranch: \${{ github.ref_name == '${ctx.branchFlow[0]}' && '${ctx.branchFlow[1]}' || '${ctx.branchFlow[2]}' }}
          runNumber: \${{ github.run_number }}

  release:
    if: \${{ always() && github.ref_name == '${ctx.branchFlow[ctx.branchFlow.length - 1]}' && needs.tag.result == 'success' }}
    needs: [ tag, version ]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.commitSha || github.sha }}
      - uses: ./.github/actions/create-release
        with:
          version: \${{ needs.version.outputs.version }}
          commitSha: \${{ inputs.commitSha || github.sha }}
`
}
