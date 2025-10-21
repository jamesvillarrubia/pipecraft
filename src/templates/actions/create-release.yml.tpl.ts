/**
 * Create Release Action Template
 *
 * Generates a composite action that creates GitHub releases with auto-generated
 * release notes from commit history. Used on the final branch (typically main)
 * after successful version calculation and tagging.
 *
 * @module templates/actions/create-release.yml.tpl
 */

import { PinionContext, toFile, renderTemplate } from '@featherscloud/pinion'
import fs from 'fs'
import dedent from 'dedent'
import { logger } from '../../utils/logger.js'

/**
 * Generates the create-release composite action YAML content.
 *
 * @param {any} ctx - Context (not currently used)
 * @returns {string} YAML content for the composite action
 */
const releaseActionTemplate = (ctx: any) => {
  return dedent`name: 'Create Release'
    description: 'Create a GitHub release with auto-generated release notes'
    author: 'PipeCraft'

    inputs:
      version:
        description: 'Version to release (e.g., v1.2.3)'
        required: true
      token:
        description: 'GitHub token for authentication'
        required: false
        default: \${{ github.token }}

    outputs:
      release_url:
        description: 'The URL of the created release'
        value: \${{ steps.create.outputs.release_url }}
      release_id:
        description: 'The ID of the created release'
        value: \${{ steps.create.outputs.release_id }}

    runs:
      using: 'composite'
      steps:
        - name: Checkout Code
          uses: actions/checkout@v4
          with:
            fetch-depth: 0
            token: \${{ inputs.token }}

        - name: Create GitHub Release
          id: create
          shell: bash
          env:
            GH_TOKEN: \${{ inputs.token }}
          run: |
            VERSION="\${{ inputs.version }}"
            echo "📦 Creating GitHub release for $VERSION"

            # Generate release notes from commits since last tag
            PREVIOUS_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")

            if [ -n "$PREVIOUS_TAG" ]; then
              echo "📝 Generating release notes from $PREVIOUS_TAG to HEAD"
              RELEASE_NOTES=$(git log $PREVIOUS_TAG..HEAD --pretty=format:"- %s" --no-merges)
            else
              echo "📝 Generating release notes from all commits"
              RELEASE_NOTES=$(git log --pretty=format:"- %s" --no-merges)
            fi

            # Create release with notes
            RELEASE_OUTPUT=$(gh release create "$VERSION" \\
              --title "Release $VERSION" \\
              --notes "$RELEASE_NOTES" \\
              --latest 2>&1)

            RELEASE_EXIT_CODE=$?

            if [ $RELEASE_EXIT_CODE -eq 0 ]; then
              # Extract release URL from output
              RELEASE_URL=$(echo "$RELEASE_OUTPUT" | grep -oE 'https://github.com/.*/releases/.*')
              echo "release_url=$RELEASE_URL" >> $GITHUB_OUTPUT

              # Get release ID using gh api
              RELEASE_ID=$(gh api repos/\${{ github.repository }}/releases/tags/$VERSION --jq '.id')
              echo "release_id=$RELEASE_ID" >> $GITHUB_OUTPUT

              echo "✅ Release created successfully"
              echo "🔗 URL: $RELEASE_URL"
            else
              echo "❌ Failed to create release"
              echo "$RELEASE_OUTPUT"
              exit 1
            fi

        - name: Trigger Publish Workflow (if exists)
          shell: bash
          env:
            GH_TOKEN: \${{ inputs.token }}
          run: |
            VERSION="\${{ inputs.version }}"

            # Check if publish.yml workflow exists
            if gh workflow list | grep -q "publish.yml"; then
              echo "🔄 Triggering publish workflow for $VERSION"

              # Trigger the publish workflow with the release tag
              # This is necessary because GITHUB_TOKEN release creation doesn't trigger workflows
              if gh workflow run publish.yml --field tag="$VERSION" 2>&1; then
                echo "✅ Publish workflow triggered for $VERSION"
              else
                echo "⚠️  Failed to trigger publish workflow, but continuing"
                echo "   Check that publish.yml accepts workflow_dispatch with a 'tag' input"
              fi
            else
              echo "ℹ️  No publish.yml workflow found - skipping publish trigger"
              echo "   This is normal if you don't have a separate publish workflow"
            fi`
};

/**
 * Generator entry point for create-release composite action.
 *
 * @param {PinionContext} ctx - Pinion generator context
 * @returns {Promise<PinionContext>} Updated context after file generation
 */
export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then((ctx) => {
      // Check if file exists to determine merge status
      const filePath = '.github/actions/create-release/action.yml'
      const exists = fs.existsSync(filePath)
      const status = exists ? '🔄 Merged with existing' : '📝 Created new'
      logger.verbose(`${status} ${filePath}`)
      return ctx
    })
    .then(renderTemplate(releaseActionTemplate, toFile('.github/actions/create-release/action.yml')))
