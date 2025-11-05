/**
 * Run Nx Affected Action Template
 *
 * Generates a reusable GitHub composite action that runs Nx affected commands
 * with caching, reporting, and proper error handling.
 *
 * ## Purpose
 *
 * This action encapsulates all the complexity of running Nx affected tasks:
 * - Sets up package manager caching (pnpm store)
 * - Configures Nx workspace caching
 * - Runs multiple Nx targets with proper comparison base
 * - Reports results as PR comments
 * - Handles failures gracefully with continue-on-error
 *
 * ## Generated Action Location
 *
 * `actions/run-nx-affected/action.yml`
 *
 * @module templates/actions/run-nx-affected.yml.tpl
 */

import { type PinionContext, renderTemplate, toFile } from '@featherscloud/pinion'
import fs from 'fs'
import { logger } from '../../utils/logger.js'
import { getActionOutputDir } from '../../utils/action-reference.js'
import type { PipecraftConfig } from '../../types/index.js'

/**
 * Generates the run-nx-affected composite action YAML content.
 */
/* eslint-disable no-useless-escape */
function runNxAffectedActionTemplate(ctx: PinionContext) {
  return `name: 'Run Nx Affected'
description: 'Runs Nx affected commands with caching and reporting'

inputs:
  targets:
    description: 'Comma-separated list of Nx targets to run (e.g., "lint,test,build")'
    required: true
  baseRef:
    description: 'Base reference for comparison'
    required: false
    default: 'origin/main'
  commitSha:
    description: 'Commit SHA to test'
    required: false
    default: \${{ github.sha }}
  packageManager:
    description: 'Package manager to use (npm, pnpm, yarn)'
    required: false
    default: 'pnpm'
  enableCache:
    description: 'Enable caching for dependencies and Nx'
    required: false
    default: 'true'
  reportResults:
    description: 'Post results as PR comment (only works on pull_request events)'
    required: false
    default: 'true'
  exclude:
    description: 'Comma-separated list of Nx projects to exclude (e.g., "@mf/app1,@mf/lib2")'
    required: false
    default: ''
  node-version:
    description: 'Node.js version to use'
    required: false
    default: '20'
  pnpm-version:
    description: 'pnpm version to use'
    required: false
    default: '9'
  verbose:
    description: 'Enable verbose logging for debugging affected detection'
    required: false
    default: 'false'

runs:
  using: composite
  steps:
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: \${{ inputs.node-version }}

    - name: Enable Corepack
      if: inputs.packageManager == 'pnpm'
      shell: bash
      run: corepack enable

    - name: Get pnpm store directory
      if: inputs.packageManager == 'pnpm' && inputs.enableCache == 'true'
      id: pnpm-cache
      shell: bash
      run: |
        echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_OUTPUT

    - name: Cache Package Manager
      if: inputs.enableCache == 'true'
      uses: actions/cache@v4
      with:
        path: \${{ inputs.packageManager == 'pnpm' && steps.pnpm-cache.outputs.STORE_PATH || '~/.npm' }}
        key: \${{ inputs.packageManager }}-\${{ runner.os }}-\${{ hashFiles(inputs.packageManager == 'pnpm' && 'pnpm-lock.yaml' || inputs.packageManager == 'yarn' && 'yarn.lock' || 'package-lock.json') }}
        restore-keys: |
          \${{ inputs.packageManager }}-\${{ runner.os }}-

    - name: Install Dependencies
      shell: bash
      run: |
        case "\${{ inputs.packageManager }}" in
          pnpm)
            pnpm install --frozen-lockfile || pnpm install
            ;;
          yarn)
            yarn install --frozen-lockfile || yarn install
            ;;
          npm)
            npm ci || npm install
            ;;
          *)
            npm install
            ;;
        esac

    - name: Cache Nx
      if: inputs.enableCache == 'true'
      uses: actions/cache@v4
      with:
        path: .nx/cache
        key: nx-\${{ runner.os }}-\${{ hashFiles(inputs.packageManager == 'pnpm' && 'pnpm-lock.yaml' || inputs.packageManager == 'yarn' && 'yarn.lock' || 'package-lock.json') }}-\${{ github.ref_name }}-\${{ github.run_number }}
        restore-keys: |
          nx-\${{ runner.os }}-\${{ hashFiles(inputs.packageManager == 'pnpm' && 'pnpm-lock.yaml' || inputs.packageManager == 'yarn' && 'yarn.lock' || 'package-lock.json') }}-\${{ github.ref_name }}-
          nx-\${{ runner.os }}-\${{ hashFiles(inputs.packageManager == 'pnpm' && 'pnpm-lock.yaml' || inputs.packageManager == 'yarn' && 'yarn.lock' || 'package-lock.json') }}-
          nx-\${{ runner.os }}-

    - name: Show Nx Comparison Info
      if: inputs.verbose == 'true'
      shell: bash
      run: |
        echo "=========================================="
        echo "🔍 Nx Affected Analysis Configuration"
        echo "=========================================="
        echo ""
        echo "📌 Current HEAD:"
        echo "  Commit: \${{ inputs.commitSha }}"
        git log -1 --oneline \${{ inputs.commitSha }} || echo "  (commit details unavailable)"
        echo ""
        echo "📌 Base for comparison:"
        BASE_REF="\${{ inputs.baseRef }}"
        echo "  Base ref: $BASE_REF"
        git log -1 --oneline $BASE_REF || echo "  (base ref details unavailable)"
        echo ""
        echo "📊 Commits being analyzed:"
        git log --oneline $BASE_REF..\${{ inputs.commitSha }} || echo "  (unable to show commit range)"
        echo ""
        echo "🎯 Targets to run: \${{ inputs.targets }}"
        if [ -n "\${{ inputs.exclude }}" ]; then
          echo "🚫 Excluding projects: \${{ inputs.exclude }}"
        fi
        echo "=========================================="

    - name: Run Nx Affected Targets
      id: nx-run
      shell: bash
      run: |
        # Parse targets into array
        IFS=',' read -ra TARGETS <<< "\${{ inputs.targets }}"

        # Get the command prefix based on package manager
        if [ "\${{ inputs.packageManager }}" = "pnpm" ]; then
          NX_CMD="pnpm exec nx"
        else
          NX_CMD="npx nx"
        fi

        # Build exclude flag if provided (strip spaces for comma-separated list)
        EXCLUDE_FLAG=""
        if [ -n "\${{ inputs.exclude }}" ]; then
          EXCLUDE_LIST=$(echo "\${{ inputs.exclude }}" | tr -d ' ')
          EXCLUDE_FLAG="--exclude=$EXCLUDE_LIST"
        fi

        # Track overall success
        OVERALL_SUCCESS=true
        RESULTS_JSON="{"
        FAILED_LOGS_JSON="{"

        # Run each target
        for target in "\${TARGETS[@]}"; do
          # Trim whitespace
          target=$(echo "$target" | xargs)

          echo ""
          echo "=========================================="
          echo "🎯 Running target: $target"
          echo "=========================================="

          # Capture output to a temp file
          LOG_FILE=$(mktemp)

          # Run the target and capture result
          if $NX_CMD affected --target=$target --base=\${{ inputs.baseRef }} --head=\${{ inputs.commitSha }} $EXCLUDE_FLAG 2>&1 | tee "$LOG_FILE"; then
            echo "✅ $target passed"
            RESULTS_JSON+="\"$target\":\"success\","
          else
            echo "❌ $target failed"
            RESULTS_JSON+="\"$target\":\"failure\","
            OVERALL_SUCCESS=false

            # Extract and store the failure log (last 100 lines, strip ANSI codes, escape for JSON)
            FAILURE_LOG=$(tail -n 100 "$LOG_FILE" | sed 's/\\x1b\\[[0-9;]*m//g' | sed 's/\\\\/\\\\\\\\/g' | sed 's/"/\\\\"/g' | sed ':a;N;$!ba;s/\\n/\\\\n/g')
            FAILED_LOGS_JSON+="\"$target\":\"$FAILURE_LOG\","
          fi

          rm -f "$LOG_FILE"
        done

        # Close JSON and save to output
        RESULTS_JSON="\${RESULTS_JSON%,}}"
        echo "results=$RESULTS_JSON" >> $GITHUB_OUTPUT

        FAILED_LOGS_JSON="\${FAILED_LOGS_JSON%,}}"
        if [ "$FAILED_LOGS_JSON" != "{" ]; then
          FAILED_LOGS_JSON+="}"
        fi
        # Use delimiter for multiline output
        echo "failed_logs<<EOF" >> $GITHUB_OUTPUT
        echo "$FAILED_LOGS_JSON" >> $GITHUB_OUTPUT
        echo "EOF" >> $GITHUB_OUTPUT

        # Set overall success
        if [ "$OVERALL_SUCCESS" = "false" ]; then
          echo "overall_success=false" >> $GITHUB_OUTPUT
          exit 1
        else
          echo "overall_success=true" >> $GITHUB_OUTPUT
        fi

    - name: Report Results to PR
      if: always() && inputs.reportResults == 'true' && github.event_name == 'pull_request'
      uses: actions/github-script@v7
      with:
        script: |
          const results = \${{ steps.nx-run.outputs.results || '{}' }};
          const failedLogs = \${{ steps.nx-run.outputs.failed_logs || '{}' }};
          const targets = '\${{ inputs.targets }}'.split(',').map(t => t.trim());
          const exclude = '\${{ inputs.exclude }}';

          let report = '## 🔍 Nx Affected Test Results\\n\\n';
          let hasFailures = false;
          const failedTargets = [];

          for (const target of targets) {
            const status = results[target];
            if (status === 'failure') {
              report += \`❌ **\${target}** - Failed\\n\`;
              hasFailures = true;
              failedTargets.push(target);
            } else if (status === 'success') {
              report += \`✅ **\${target}** - Passed\\n\`;
            } else {
              report += \`⚠️  **\${target}** - Unknown\\n\`;
            }
          }

          // Add failure details with collapsible sections
          if (failedTargets.length > 0) {
            report += \`\\n### ❌ Failure Details\\n\\n\`;

            for (const target of failedTargets) {
              const log = failedLogs[target];

              // Link to full logs for this specific target
              report += \`#### \${target}\\n\`;
              report += \`[View full logs for \${target}](\${context.serverUrl}/\${context.repo.owner}/\${context.repo.repo}/actions/runs/\${context.runId})\\n\\n\`;

              // Collapsible section with error output
              if (log) {
                report += \`<details>\\n\`;
                report += \`<summary>Show error output</summary>\\n\\n\`;
                report += \`\\\`\\\`\\\`\\n\`;
                report += log;
                report += \`\\n\\\`\\\`\\\`\\n\`;
                report += \`</details>\\n\\n\`;
              }
            }
          }

          if (exclude) {
            report += \`\\n### Excluded Projects\\n\`;
            const excludedProjects = exclude.split(',').map(p => p.trim());
            report += \`The following projects were skipped from the affected analysis:\\n\`;
            excludedProjects.forEach(project => {
              report += \`- \\\`\${project}\\\`\\n\`;
            });
          }

          report += \`\\n---\\n[View full workflow run](\${context.serverUrl}/\${context.repo.owner}/\${context.repo.repo}/actions/runs/\${context.runId})\\n\`;

          // Find existing comment
          const { data: comments } = await github.rest.issues.listComments({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: context.issue.number,
          });

          const botComment = comments.find(comment =>
            comment.user.type === 'Bot' &&
            comment.body.includes('🔍 Nx Affected Test Results')
          );

          if (botComment) {
            // Update existing comment
            await github.rest.issues.updateComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              comment_id: botComment.id,
              body: report
            });
          } else {
            // Create new comment
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: report
            });
          }
`
}
/* eslint-enable no-useless-escape */

/**
 * Generator entry point for run-nx-affected composite action.
 *
 * @param {PinionContext} ctx - Pinion generator context
 * @returns {Promise<PinionContext>} Updated context after file generation
 */
export const generate = (ctx: PinionContext & { config?: Partial<PipecraftConfig> }) =>
  Promise.resolve(ctx)
    .then(ctx => {
      const config = ctx.config || {}
      const outputDir = getActionOutputDir(config)
      const filePath = `${outputDir}/run-nx-affected/action.yml`
      const exists = fs.existsSync(filePath)
      const status = exists ? '🔄 Merged with existing' : '📝 Created new'
      logger.verbose(`${status} ${filePath}`)
      return { ...ctx, actionOutputPath: filePath }
    })
    .then(ctx =>
      renderTemplate(
        runNxAffectedActionTemplate,
        toFile(ctx.actionOutputPath || 'actions/run-nx-affected/action.yml')
      )(ctx)
    )
