import { PinionContext, toFile, renderTemplate } from '@featherscloud/pinion'
import fs from 'fs'
import dedent from 'dedent'

// Template for the Promote Branch GitHub Action
// This action handles branch promotions via temporary branches + PRs
const promoteBranchActionTemplate = (ctx: any) => {
  return dedent`name: 'Promote Branch'
    description: 'Promote code from source to target branch via temporary branch + PR'
    author: 'PipeCraft'

    inputs:
      sourceBranch:
        description: 'Source branch to promote from'
        required: true
      targetBranch:
        description: 'Target branch to promote to'
        required: true
      version:
        description: 'Version being promoted (e.g., v1.2.3)'
        required: true
      autoMerge:
        description: 'Enable GitHub auto-merge on the PR'
        required: false
        default: 'false'
      tempBranchPattern:
        description: 'Pattern for temp branch name'
        required: false
        default: 'release/{source}-to-{target}-{version}'
      token:
        description: 'GitHub token for authentication'
        required: false
        default: \${{ github.token }}

    outputs:
      prNumber:
        description: 'The created PR number'
        value: \${{ steps.create-pr.outputs.prNumber }}
      prUrl:
        description: 'The created PR URL'
        value: \${{ steps.create-pr.outputs.prUrl }}
      tempBranch:
        description: 'The temporary branch name'
        value: \${{ steps.create-temp.outputs.tempBranch }}

    runs:
      using: 'composite'
      steps:
        - name: Checkout Code
          uses: actions/checkout@v4
          with:
            fetch-depth: 0
            token: \${{ inputs.token }}

        - name: Create Temporary Branch
          id: create-temp
          shell: bash
          run: |
            SOURCE="\${{ inputs.sourceBranch }}"
            TARGET="\${{ inputs.targetBranch }}"
            VERSION="\${{ inputs.version }}"
            PATTERN="\${{ inputs.tempBranchPattern }}"

            # Remove 'v' prefix from version for branch name
            VERSION_CLEAN="\${VERSION#v}"

            # Replace placeholders in pattern
            TEMP_BRANCH="\$PATTERN"
            TEMP_BRANCH="\${TEMP_BRANCH//\{source\}/\$SOURCE}"
            TEMP_BRANCH="\${TEMP_BRANCH//\{target\}/\$TARGET}"
            TEMP_BRANCH="\${TEMP_BRANCH//\{version\}/\$VERSION_CLEAN}"

            echo "🌿 Creating temporary branch: \$TEMP_BRANCH"
            echo "   From: \$SOURCE"
            echo "   To: \$TARGET"
            echo "   Version: \$VERSION"

            # Ensure we're on the source branch
            git checkout "\$SOURCE"

            # Create temp branch from current commit
            git checkout -b "\$TEMP_BRANCH"

            # Push temp branch to remote
            git push origin "\$TEMP_BRANCH"

            echo "tempBranch=\$TEMP_BRANCH" >> \$GITHUB_OUTPUT
            echo "✅ Temporary branch created and pushed"

        - name: Check for Existing PR
          id: check-pr
          shell: bash
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
          run: |
            TEMP_BRANCH="\${{ steps.create-temp.outputs.tempBranch }}"
            TARGET="\${{ inputs.targetBranch }}"
            SOURCE="\${{ inputs.sourceBranch }}"
            VERSION="\${{ inputs.version }}"
            AUTO_MERGE="\${{ inputs.autoMerge }}"

            TITLE="🚀 Release \$VERSION to \$TARGET"

            # Determine merge behavior text
            if [ "\$AUTO_MERGE" == "true" ]; then
              MERGE_TEXT="merge automatically"
            else
              MERGE_TEXT="require manual approval"
            fi

            # Create the PR with simple body
            PR_OUTPUT=\$(gh pr create \\
              --title "\$TITLE" \\
              --body "Release \$VERSION from \$SOURCE to \$TARGET" \\
              --head "\$TEMP_BRANCH" \\
              --base "\$TARGET" \\
              --json number,url 2>&1)

            # Write output to file to avoid echo issues with special characters
            echo "\$PR_OUTPUT" > /tmp/pr_output.txt

            if jq -e '.number' /tmp/pr_output.txt > /dev/null 2>&1; then
              PR_NUMBER=\$(jq -r '.number' /tmp/pr_output.txt)
              PR_URL=\$(jq -r '.url' /tmp/pr_output.txt)
              echo "prNumber=\$PR_NUMBER" >> \$GITHUB_OUTPUT
              echo "prUrl=\$PR_URL" >> \$GITHUB_OUTPUT
              echo "✅ Created PR #\$PR_NUMBER"
              echo "🔗 URL: \$PR_URL"
            else
              echo "❌ Failed to create PR"
              echo "Error output:"
              cat /tmp/pr_output.txt || echo "Could not read output file"
              exit 1
            fi

        - name: Enable Auto-Merge
          if: inputs.autoMerge == 'true' && steps.check-pr.outputs.exists == 'false'
          shell: bash
          run: |
            PR_NUMBER="\${{ steps.create-pr.outputs.prNumber }}"

            echo "🔄 Enabling auto-merge for PR #\$PR_NUMBER"

            # Enable auto-merge with squash strategy
            gh pr merge "\$PR_NUMBER" --auto --squash

            echo "✅ Auto-merge enabled - PR will merge automatically when checks pass"

        - name: Use Existing PR
          if: steps.check-pr.outputs.exists == 'true'
          shell: bash
          run: |
            PR_NUMBER="\${{ steps.check-pr.outputs.prNumber }}"
            PR_URL="\${{ steps.check-pr.outputs.prUrl }}"

            echo "ℹ️  Using existing PR #\$PR_NUMBER"
            echo "🔗 URL: \$PR_URL"

            # If autoMerge is enabled and not already set, enable it
            if [ "\${{ inputs.autoMerge }}" == "true" ]; then
              echo "🔄 Ensuring auto-merge is enabled"
              gh pr merge "\$PR_NUMBER" --auto --squash 2>/dev/null || echo "Auto-merge already enabled or not available"
            fi
  `
}

export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then((ctx) => {
      // Check if file exists to determine merge status
      const filePath = '.github/actions/promote-branch/action.yml'
      const exists = fs.existsSync(filePath)
      const status = exists ? '🔄 Merged with existing' : '📝 Created new'
      console.log(`${status} ${filePath}`)
      return ctx
    })
    .then(renderTemplate(promoteBranchActionTemplate, toFile('.github/actions/promote-branch/action.yml')))
