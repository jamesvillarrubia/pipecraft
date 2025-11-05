/**
 * Create Tag Action Template
 *
 * Generates a composite action that creates and pushes git tags, and optionally creates
 * GitHub releases. Used after version calculation to tag the codebase with semantic versions.
 *
 * @module templates/actions/create-tag.yml.tpl
 */

import { type PinionContext, renderTemplate, toFile } from '@featherscloud/pinion'
import dedent from 'dedent'
import fs from 'fs'
import { logger } from '../../utils/logger.js'
import { getActionOutputDir } from '../../utils/action-reference.js'
import type { PipecraftConfig } from '../../types/index.js'

/**
 * Generates the create-tag composite action YAML content.
 *
 * @param {any} ctx - Context (not currently used)
 * @returns {string} YAML content for the composite action
 */
const tagActionTemplate = (ctx: any) => {
  return dedent`name: 'Tag Version'
    description: 'Create and push a Git tag for a given version'
    author: 'Pipecraft'

    inputs:
      version:
        description: 'Version to tag'
        required: true
      tag_prefix:
        description: 'Prefix for the tag (e.g., v)'
        required: false
        default: 'v'
      push:
        description: 'Whether to push the tag to remote'
        required: false
        default: 'true'

    outputs:
      tag_name:
        description: 'The created tag name'
        value: \${{ steps.tag.outputs.tag_name }}
      success:
        description: 'Whether the tag was created successfully'
        value: \${{ steps.tag.outputs.success }}

    runs:
      using: 'composite'
      steps:
        - name: Validate Inputs
          id: validate
          shell: bash
          run: |
            if [ -z "\${{ inputs.version }}" ]; then
              echo "❌ Version is required"
              exit 1
            fi
            
            # Strip v prefix if present and validate version format
            VERSION="\${{ inputs.version }}"
            VERSION="\${VERSION#v}"  # Remove v prefix

            if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
              echo "❌ Version must be in format [v]x.y.z (e.g., 1.0.0 or v1.0.0)"
              exit 1
            fi

            echo "✅ Version format is valid: $VERSION"
            echo "version=$VERSION" >> $GITHUB_OUTPUT

        - name: Configure Git
          shell: bash
          run: |
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"

        - name: Create Tag
          id: tag
          shell: bash
          run: |
            VERSION="\${{ steps.validate.outputs.version }}"
            PREFIX="\${{ inputs.tag_prefix }}"
            TAG_NAME="\${PREFIX}\${VERSION}"

            # Check if tag already exists
            if git tag -l | grep -q "^\${TAG_NAME}$"; then
              echo "⚠️  Tag \${TAG_NAME} already exists"
              echo "tag_name=\${TAG_NAME}" >> \$GITHUB_OUTPUT
              echo "success=false" >> \$GITHUB_OUTPUT
              exit 0
            fi
            
            # Create the tag
            git tag -a "\${TAG_NAME}" -m "Release \${TAG_NAME}"
            echo "✅ Created tag: \${TAG_NAME}"
            
            echo "tag_name=\${TAG_NAME}" >> \$GITHUB_OUTPUT
            echo "success=true" >> \$GITHUB_OUTPUT

        - name: Push Tag
          if: steps.tag.outputs.success == 'true' && inputs.push == 'true'
          shell: bash
          run: |
            TAG_NAME="\${{ steps.tag.outputs.tag_name }}"
            git push origin "\${TAG_NAME}"
            echo "✅ Pushed tag \${TAG_NAME} to remote"

        - name: Action Summary
          shell: bash
          run: |
            if [ "\${{ steps.tag.outputs.success }}" == "true" ]; then
              echo "✅ Successfully created and pushed tag: \${{ steps.tag.outputs.tag_name }}"
            else
              echo "❌ Failed to create tag: \${{ steps.tag.outputs.tag_name }}"
            fi`
}

/**
 * Generator entry point for create-tag composite action.
 *
 * @param {PinionContext} ctx - Pinion generator context
 * @returns {Promise<PinionContext>} Updated context after file generation
 */
export const generate = (ctx: PinionContext & { config?: Partial<PipecraftConfig> }) =>
  Promise.resolve(ctx)
    .then(ctx => {
      // Check if file exists to determine merge status
      const config = ctx.config || {}
      const outputDir = getActionOutputDir(config)
      const filePath = `${outputDir}/create-tag/action.yml`
      const exists = fs.existsSync(filePath)
      const status = exists ? '🔄 Merged with existing' : '📝 Created new'
      logger.verbose(`${status} ${filePath}`)
      return { ...ctx, actionOutputPath: filePath }
    })
    .then(ctx =>
      renderTemplate(
        tagActionTemplate,
        toFile(ctx.actionOutputPath || 'actions/create-tag/action.yml')
      )(ctx)
    )
