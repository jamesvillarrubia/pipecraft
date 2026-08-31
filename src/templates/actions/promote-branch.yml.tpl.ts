/**
 * Promote Branch Action Template
 *
 * Generates a composite action that promotes code from one branch to another via
 * temporary branch and pull request. Handles auto-merge and cleanup for trunk flow.
 *
 * @module templates/actions/promote-branch.yml.tpl
 */

import { type PinionContext, renderTemplate, toFile } from '@featherscloud/pinion'
import dedent from 'dedent'
import fs from 'fs'
import { logger } from '../../utils/logger.js'
import { getActionOutputDir, shouldGenerateActions } from '../../utils/action-reference.js'
import type { PipecraftConfig } from '../../types/index.js'

/**
 * Generates the promote-branch composite action YAML content.
 *
 * @param {any} ctx - Context (not currently used)
 * @returns {string} YAML content for the composite action
 */
export const promoteBranchActionTemplate = (ctx: any) => {
  return dedent`name: 'Promote Branch'
    description: 'Promote code from source to target branch via temporary branch + PR'
    author: 'PipeCraft'

    branding:
      icon: 'git-merge'
      color: 'purple'

    inputs:
      sourceBranch:
        description: 'Source branch to promote from (defaults to github.ref_name)'
        required: false
        default: \${{ github.ref_name }}
      targetBranch:
        description: 'Target branch to promote to'
        required: true
      version:
        description: 'Version being promoted (e.g., v1.2.3, auto-detected from git tags if not provided)'
        required: false
        default: ''
      run_number:
        description: 'The original run number from develop branch for traceability'
        required: false
        default: ''
      autoPromote:
        description: 'Whether to automatically promote to the target branch'
        required: false
        default: 'false'
      mergeStrategy:
        description: "How to land the promotion: 'fast-forward' (linear history) or 'merge' (merge commit)"
        required: false
        default: 'fast-forward'
      tempBranchPattern:
        description: 'Pattern for temp branch name'
        required: false
        default: 'pipecraft-promote/{source}-to-{target}-{version}'
      token:
        description: 'GitHub token for authentication'
        required: false
        default: \${{ github.token }}

    outputs:
      prNumber:
        description: 'The created or existing PR number'
        value: \${{ steps.check-pr.outputs.prNumber || steps.create-pr.outputs.prNumber }}
      prUrl:
        description: 'The created or existing PR URL'
        value: \${{ steps.check-pr.outputs.prUrl || steps.create-pr.outputs.prUrl }}
      tempBranch:
        description: 'The temporary branch name'
        value: \${{ steps.create-temp.outputs.tempBranch }}

    runs:
      using: 'composite'
      steps:
        - name: Validate Inputs
          shell: bash
          run: |
            # GitHub does not enforce 'required: true' for composite action inputs, so an
            # expression that resolves to empty arrives here silently. Left unchecked it is
            # substituted into the temp branch name and 'gh pr create --base', which fails
            # later with a confusing message about a malformed ref. Fail fast instead.
            TARGET="\${{ inputs.targetBranch }}"
            TARGET="\$(echo "\$TARGET" | xargs)"

            if [ -z "\$TARGET" ]; then
              echo "::error::promote-branch requires a non-empty 'targetBranch' input."
              echo "::error::Received an empty value. There is no branch to promote to."
              echo ""
              echo "This usually means one of:"
              echo "  - The branch flow has a single branch, so there is nothing to promote."
              echo "    Remove the promote step rather than calling it with an empty target."
              echo "  - The expression feeding targetBranch resolved to empty (typo, or a"
              echo "    'needs' output that was never set)."
              exit 1
            fi

            echo "✅ Promoting to '\$TARGET'"

        - name: Checkout Code
          uses: actions/checkout@v5
          with:
            fetch-depth: 0
            token: \${{ inputs.token }}

        - name: Configure Git
          shell: bash
          run: |
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"

        - name: Get Version
          id: get-version
          shell: bash
          run: |
            VERSION_INPUT="\${{ inputs.version }}"

            if [ -n "\$VERSION_INPUT" ]; then
              VERSION="\$VERSION_INPUT"
              echo "📌 Using provided version: \$VERSION"
            else
              # Auto-detect from git tags
              VERSION=\$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.1.0")
              echo "🏷️  Auto-detected version from tags: \$VERSION"
            fi

            echo "version=\$VERSION" >> \$GITHUB_OUTPUT

        - name: Create Temporary Branch
          id: create-temp
          shell: bash
          run: |
            SOURCE="\${{ inputs.sourceBranch }}"
            TARGET="\${{ inputs.targetBranch }}"
            VERSION="\${{ steps.get-version.outputs.version }}"
            PATTERN="\${{ inputs.tempBranchPattern }}"

            # Remove 'v' prefix from version for branch name
            VERSION_CLEAN="\${VERSION#v}"

            # Replace placeholders in pattern
            TEMP_BRANCH="\$PATTERN"
            TEMP_BRANCH="\${TEMP_BRANCH//\{source\}/\$SOURCE}"
            TEMP_BRANCH="\${TEMP_BRANCH//\{target\}/\$TARGET}"
            TEMP_BRANCH="\${TEMP_BRANCH//\{version\}/\$VERSION_CLEAN}"

            echo "🌿 Preparing temporary branch: \$TEMP_BRANCH"
            echo "   From: \$SOURCE"
            echo "   To: \$TARGET"
            echo "   Version: \$VERSION"

            # Ensure we're on the source branch
            git checkout "\$SOURCE"

            # Always (re)create the temp branch at SOURCE's current tip. A branch of the
            # same name may linger from an earlier no-op promotion pointing at an OLD commit
            # (the manual-gate path leaves its temp branch behind). Reusing it as-is makes
            # 'gh pr create' report "No commits between" and silently no-op, so a genuine
            # promotion produces no gate PR. Forcing the temp branch to SOURCE keeps the
            # promotion honest and stays idempotent on legitimate re-runs of the same version.
            echo "📝 (Re)creating temp branch \$TEMP_BRANCH at \$SOURCE tip"
            git branch -f "\$TEMP_BRANCH" "\$SOURCE"
            git checkout "\$TEMP_BRANCH"
            git push --force origin "\$TEMP_BRANCH"

            echo "tempBranch=\$TEMP_BRANCH" >> \$GITHUB_OUTPUT
            echo "✅ Temporary branch ready"

        - name: Check for Existing PR
          id: check-pr
          shell: bash
          env:
            GH_TOKEN: \${{ inputs.token }}
          run: |
            TEMP_BRANCH="\${{ steps.create-temp.outputs.tempBranch }}"
            TARGET="\${{ inputs.targetBranch }}"

            # Check if PR already exists from temp branch to target
            EXISTING_PR=\$(gh pr list --head "\$TEMP_BRANCH" --base "\$TARGET" --json number --jq '.[0].number' 2>/dev/null || echo "")

            if [ -n "\$EXISTING_PR" ]; then
              echo "exists=true" >> \$GITHUB_OUTPUT
              echo "prNumber=\$EXISTING_PR" >> \$GITHUB_OUTPUT
              echo "⚠️  PR already exists: #\$EXISTING_PR"

              # Get PR URL
              PR_URL=\$(gh pr view "\$EXISTING_PR" --json url --jq '.url')
              echo "prUrl=\$PR_URL" >> \$GITHUB_OUTPUT
            else
              echo "exists=false" >> \$GITHUB_OUTPUT
              echo "✅ No existing PR found"
            fi

        - name: Create Pull Request
          id: create-pr
          if: steps.check-pr.outputs.exists == 'false'
          shell: bash
          env:
            GH_TOKEN: \${{ inputs.token }}
          run: |
            TEMP_BRANCH="\${{ steps.create-temp.outputs.tempBranch }}"
            TARGET="\${{ inputs.targetBranch }}"
            SOURCE="\${{ inputs.sourceBranch }}"
            VERSION="\${{ steps.get-version.outputs.version }}"
            AUTO_PROMOTE="\${{ inputs.autoPromote }}"

            TITLE="🚀 Release \$VERSION to \$TARGET"

            # Determine merge behavior text
            if [ "\$AUTO_PROMOTE" == "true" ]; then
              MERGE_TEXT="merge automatically"
            else
              MERGE_TEXT="require manual approval"
            fi

            # Disable error exit to capture gh pr create output even on failure
            set +e

            # Create the PR - gh pr create returns the PR URL on success
            PR_URL=\$(gh pr create \\
              --title "\$TITLE" \\
              --body "Release \$VERSION from \$SOURCE to \$TARGET" \\
              --head "\$TEMP_BRANCH" \\
              --base "\$TARGET" 2>&1)
            PR_EXIT_CODE=\$?

            # Re-enable error exit
            set -e

            if [ \$PR_EXIT_CODE -eq 0 ] && [[ "\$PR_URL" =~ ^https://github.com/.*/pull/[0-9]+$ ]]; then
              # Extract PR number from URL (e.g., https://github.com/owner/repo/pull/123)
              PR_NUMBER=\$(echo "\$PR_URL" | grep -oE '[0-9]+$')
              echo "prNumber=\$PR_NUMBER" >> \$GITHUB_OUTPUT
              echo "prUrl=\$PR_URL" >> \$GITHUB_OUTPUT
              echo "✅ Created PR #\$PR_NUMBER"
              echo "🔗 URL: \$PR_URL"
            elif echo "\$PR_URL" | grep -qiE "No commits between"; then
              # '\$TARGET' is already even with '\$SOURCE' — there is nothing to promote.
              # This is a no-op success (also covers re-runs), not a failure. Downstream
              # steps tolerate an empty PR number (the ff-merge is a no-op when even).
              echo "ℹ️  '\$TARGET' is already up to date with '\$SOURCE' — nothing to promote."
              echo "prNumber=" >> \$GITHUB_OUTPUT
              echo "prUrl=" >> \$GITHUB_OUTPUT
              # No PR was opened against this temp branch, so delete it. Leaving it behind is
              # what caused the stale-reuse no-op on the next same-version promotion.
              git push origin --delete "\$TEMP_BRANCH" 2>/dev/null || true
            else
              echo "❌ Failed to create PR"
              echo "Error output:"
              echo "\$PR_URL"
              exit 1
            fi

        - name: Manual Merge Required
          if: inputs.autoPromote == 'false'
          shell: bash
          run: |
            PR_NUMBER="\${{ steps.check-pr.outputs.prNumber || steps.create-pr.outputs.prNumber }}"
            PR_URL="\${{ steps.check-pr.outputs.prUrl || steps.create-pr.outputs.prUrl }}"

            echo "✅ PR #\$PR_NUMBER created successfully"
            echo "🔗 URL: \$PR_URL"
            echo ""
            echo "⚠️  Auto-merge is disabled for this branch."
            echo "   Please review and merge the PR manually when ready."

        - name: Promote to Target (Immediate Auto-Promote)
          id: fast-forward
          if: inputs.autoPromote == 'true'
          shell: bash
          run: |
            SOURCE="\${{ inputs.sourceBranch }}"
            TARGET="\${{ inputs.targetBranch }}"
            VERSION="\${{ steps.get-version.outputs.version }}"
            STRATEGY="\${{ inputs.mergeStrategy }}"

            COMMIT_SHA=\$(git rev-parse \$SOURCE)
            echo "Source commit: \$COMMIT_SHA  (strategy: \$STRATEGY)"

            # Fetch target branch
            git fetch origin \$TARGET:\$TARGET 2>/dev/null || true

            # Capture the target branch's current SHA BEFORE promotion (for change detection)
            BEFORE_SHA=\$(git rev-parse \$TARGET)
            echo "beforeSha=\$BEFORE_SHA" >> \$GITHUB_OUTPUT
            echo "Target before: \$BEFORE_SHA"

            git checkout \$TARGET

            if [ "\$STRATEGY" = "merge" ]; then
              # Merge strategy: create a merge commit on the target. The release tag stays on
              # the source tip (the merge's 2nd parent); calculate-version resolves it there.
              if git merge-base --is-ancestor \$SOURCE \$TARGET; then
                echo "ℹ️  \$TARGET already contains \$SOURCE — nothing to promote."
              else
                echo "🔀 Merging \$SOURCE into \$TARGET (merge commit)"
                git merge --no-ff "\$SOURCE" -m "chore: promote \$VERSION from \$SOURCE to \$TARGET"
              fi
            else
              # Fast-forward strategy: linear history, no merge commit.
              if git merge-base --is-ancestor \$TARGET \$SOURCE; then
                echo "🚀 Fast-forwarding \$TARGET to \$SOURCE (linear history)"
                git merge --ff-only "\$SOURCE"
              else
                echo "❌ Cannot fast-forward - \$TARGET has commits not in \$SOURCE (diverged)."
                echo "   Use mergeStrategy: merge to promote across diverged branches."
                exit 1
              fi
            fi

            # Push to remote (no-op if nothing changed)
            git push origin \$TARGET

            echo "✅ Fast-forwarded \$TARGET to \$COMMIT_SHA"
            echo "📝 PR will be closed automatically for audit trail"

        - name: Wait for Branch to Propagate
          if: inputs.autoPromote == 'true'
          shell: bash
          run: |
            echo "⏳ Waiting 5 seconds for branch update to propagate..."
            sleep 5
            echo "✅ Branch should be fully propagated"

        - name: Trigger Pipeline Workflow on Target Branch
          if: inputs.autoPromote == 'true'
          shell: bash
          env:
            GH_TOKEN: \${{ inputs.token }}
          run: |
            TARGET="\${{ inputs.targetBranch }}"
            VERSION="\${{ steps.get-version.outputs.version }}"
            RUN_NUMBER="\${{ inputs.run_number }}"
            BEFORE_SHA="\${{ steps.fast-forward.outputs.beforeSha }}"

            # Get the exact commit SHA that was just pushed to target branch
            COMMIT_SHA=\$(git rev-parse \$TARGET)
            echo "🔄 Triggering pipeline workflow on \$TARGET branch"
            echo "   Version: \$VERSION"
            echo "   Commit SHA: \$COMMIT_SHA"
            echo "   Before SHA: \$BEFORE_SHA (for change detection)"

            # Trigger the pipeline workflow on the target branch
            # This is necessary because GITHUB_TOKEN pushes don't trigger workflows by default
            # Pass the exact commit SHA to ensure the workflow checks out the correct commit
            # Pass beforeSha for accurate change detection (simulates push event's 'before' field)
            WORKFLOW_ARGS=(--ref "\$TARGET" --field version="\$VERSION" --field commitSha="\$COMMIT_SHA" --field beforeSha="\$BEFORE_SHA")
            if [ -n "\$RUN_NUMBER" ]; then
              WORKFLOW_ARGS+=(--field run_number="\$RUN_NUMBER")
              echo "   Run number: \$RUN_NUMBER (for traceability)"
            fi

            # Dispatch and fail loudly if the API call itself is rejected (previously the
            # trailing echo masked a failed dispatch).
            if ! gh workflow run pipeline.yml "\${WORKFLOW_ARGS[@]}"; then
              echo "::error::Failed to dispatch pipeline workflow on \$TARGET"
              exit 1
            fi

            # 'gh workflow run' returns success once accepted, but a dropped dispatch
            # (misconfig / rate limit) would otherwise be invisible. Poll briefly to confirm
            # a run actually started; warn (non-fatal) if it doesn't appear.
            echo "⏳ Verifying a pipeline run started on \$TARGET..."
            RUN_STARTED=""
            for _attempt in 1 2 3 4 5 6; do
              sleep 5
              if gh run list --workflow=pipeline.yml --branch "\$TARGET" --limit 5 \\
                   --json status --jq '.[].status' 2>/dev/null \\
                   | grep -qE 'queued|in_progress|requested|waiting'; then
                RUN_STARTED="yes"
                break
              fi
            done

            if [ -n "\$RUN_STARTED" ]; then
              echo "✅ Pipeline workflow triggered on \$TARGET with version \$VERSION at commit \$COMMIT_SHA"
            else
              echo "::warning::Dispatched pipeline on \$TARGET but no run appeared within ~30s. \\
            Verify the workflow_dispatch trigger and Actions permissions; the promotion may need a manual re-trigger."
            fi

        - name: Close PR and Delete Branch
          if: inputs.autoPromote == 'true'
          shell: bash
          env:
            GH_TOKEN: \${{ inputs.token }}
          run: |
            TEMP_BRANCH="\${{ steps.create-temp.outputs.tempBranch }}"
            PR_NUMBER="\${{ steps.check-pr.outputs.prNumber || steps.create-pr.outputs.prNumber }}"

            echo "🧹 Cleaning up temporary branch: \$TEMP_BRANCH"

            # Close the PR (it's already been fast-forward merged)
            if [ -n "\$PR_NUMBER" ]; then
              gh pr close "\$PR_NUMBER" --comment "Automatically merged via fast-forward. Closing PR and cleaning up release branch." || true
              echo "✅ Closed PR #\$PR_NUMBER"
            fi

            # Delete the temporary branch from remote
            git push origin --delete "\$TEMP_BRANCH" || echo "⚠️  Branch may already be deleted"

            echo "✅ Deleted temporary branch \$TEMP_BRANCH"

        - name: Use Existing PR
          if: steps.check-pr.outputs.exists == 'true'
          shell: bash
          run: |
            PR_NUMBER="\${{ steps.check-pr.outputs.prNumber }}"
            PR_URL="\${{ steps.check-pr.outputs.prUrl }}"

            echo "ℹ️  Using existing PR #\$PR_NUMBER"
            echo "🔗 URL: \$PR_URL"

            # Note: Fast-forward merge happens in separate step if autoPromote is enabled
  `
}

/**
 * Generator entry point for promote-branch composite action.
 *
 * @param {PinionContext} ctx - Pinion generator context
 * @returns {Promise<PinionContext>} Updated context after file generation
 */
export const generate = (ctx: PinionContext & { config?: Partial<PipecraftConfig> }) =>
  Promise.resolve(ctx).then(ctx => {
    const config = ctx.config || {}

    if (!shouldGenerateActions(config)) {
      logger.verbose('Skipping promote-branch action generation (using remote actions)')
      return ctx
    }

    const outputDir = getActionOutputDir(config)
    const filePath = `${outputDir}/promote-branch/action.yml`
    const exists = fs.existsSync(filePath)
    const status = exists ? '🔄 Merged with existing' : '📝 Created new'
    logger.verbose(`${status} ${filePath}`)

    return renderTemplate(promoteBranchActionTemplate, toFile(filePath))(ctx)
  })
