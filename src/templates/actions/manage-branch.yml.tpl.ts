/**
 * Manage Branch Action Template
 *
 * Generates a composite action for branch operations including fast-forward merges,
 * branch creation, and deletion. Core utility for trunk-based development workflows.
 *
 * @module templates/actions/manage-branch.yml.tpl
 */

import { type PinionContext, renderTemplate, toFile } from '@featherscloud/pinion'
import dedent from 'dedent'
import fs from 'fs'
import { logger } from '../../utils/logger.js'

/**
 * Generates the manage-branch composite action YAML content.
 *
 * @param {any} ctx - Context (not currently used)
 * @returns {string} YAML content for the composite action
 */
const branchActionTemplate = (ctx: any) => {
  return dedent`name: 'Branch Management'
    description: 'Manage branches (fast-forward, create, delete)'
    author: 'Pipecraft'

    inputs:
      action:
        description: 'Action to perform (fast-forward, create, delete)'
        required: true
      targetBranch:
        description: 'Target branch for the action'
        required: true
      sourceBranch:
        description: 'Source branch for the action'
        required: false
      branchName:
        description: 'Name for new branch (for create action)'
        required: false

    outputs:
      success:
        description: 'Whether the action was successful'
        value: \${{ steps.branch-action.outputs.success }}
      message:
        description: 'Result message'
        value: \${{ steps.branch-action.outputs.message }}

    runs:
      using: 'composite'
      steps:
        - name: Checkout Code
          uses: actions/checkout@v4
          with:
            fetch-depth: 0
            token: \${{ inputs.token }}

        - name: Validate Inputs
          id: validate
          shell: bash
          run: |
            ACTION="\${{ inputs.action }}"
            TARGET="\${{ inputs.targetBranch }}"
            SOURCE="\${{ inputs.sourceBranch }}"
            BRANCH_NAME="\${{ inputs.branchName }}"
            
            case "\$ACTION" in
              "fast-forward")
                if [ -z "\$SOURCE" ]; then
                  echo "❌ Source branch is required for fast-forward"
                  exit 1
                fi
                ;;
              "create")
                if [ -z "\$BRANCH_NAME" ]; then
                  echo "❌ Branch name is required for create action"
                  exit 1
                fi
                ;;
              "delete")
                if [ -z "\$TARGET" ]; then
                  echo "❌ Target branch is required for delete action"
                  exit 1
                fi
                ;;
              *)
                echo "❌ Invalid action: \$ACTION. Must be fast-forward, create, or delete"
                exit 1
                ;;
            esac
            
            echo "✅ Input validation passed"

        - name: Perform Branch Action
          id: branch-action
          shell: bash
          run: |
            ACTION="\${{ inputs.action }}"
            TARGET="\${{ inputs.targetBranch }}"
            SOURCE="\${{ inputs.sourceBranch }}"
            BRANCH_NAME="\${{ inputs.branchName }}"
            
            case "\$ACTION" in
              "fast-forward")
                echo "🔄 Fast-forwarding \$TARGET to \$SOURCE"
                git checkout "\$TARGET"
                git merge --ff-only "\$SOURCE"
                git push origin "\$TARGET"
                echo "success=true" >> \$GITHUB_OUTPUT
                echo "message=Successfully fast-forwarded \$TARGET to \$SOURCE" >> \$GITHUB_OUTPUT
                ;;
              "create")
                echo "🌱 Creating branch \$BRANCH_NAME from \$TARGET"
                git checkout "\$TARGET"
                git checkout -b "\$BRANCH_NAME"
                git push -u origin "\$BRANCH_NAME"
                echo "success=true" >> \$GITHUB_OUTPUT
                echo "message=Successfully created branch \$BRANCH_NAME" >> \$GITHUB_OUTPUT
                ;;
              "delete")
                echo "🗑️  Deleting branch \$TARGET"
                git push origin --delete "\$TARGET"
                echo "success=true" >> \$GITHUB_OUTPUT
                echo "message=Successfully deleted branch \$TARGET" >> \$GITHUB_OUTPUT
                ;;
            esac

        - name: Action Summary
          shell: bash
          run: |
            if [ "\${{ steps.branch-action.outputs.success }}" == "true" ]; then
              echo "✅ \${{ steps.branch-action.outputs.message }}"
            else
              echo "❌ \${{ steps.branch-action.outputs.message }}"
            fi`
}

/**
 * Generator entry point for manage-branch composite action.
 *
 * @param {PinionContext} ctx - Pinion generator context
 * @returns {Promise<PinionContext>} Updated context after file generation
 */
export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then(ctx => {
      // Check if file exists to determine merge status
      const filePath = 'actions/manage-branch/action.yml'
      const exists = fs.existsSync(filePath)
      const status = exists ? '🔄 Merged with existing' : '📝 Created new'
      logger.verbose(`${status} ${filePath}`)
      return ctx
    })
    .then(renderTemplate(branchActionTemplate, toFile('actions/manage-branch/action.yml')))
