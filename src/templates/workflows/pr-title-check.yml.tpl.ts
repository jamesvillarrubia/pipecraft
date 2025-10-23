/**
 * PR Title Check Workflow Template
 * 
 * Generates a GitHub Actions workflow that validates pull request titles follow
 * the Conventional Commits specification. This ensures consistent commit and
 * PR title formatting across the project.
 * 
 * The workflow:
 * - Triggers on PR events (opened, edited, synchronize, reopened)
 * - Validates PR titles using conventional commit format
 * - Provides helpful error messages with guidance
 * - Uses sticky comments to show validation results
 * 
 * @module templates/workflows/pr-title-check.yml.tpl
 * 
 * @example
 * ```typescript
 * import { generate } from './templates/workflows/pr-title-check.yml.tpl.js'
 * 
 * await generate({
 *   cwd: '/path/to/project',
 *   config: {
 *     requireConventionalCommits: true
 *   }
 * })
 * ```
 */

import { PinionContext, toFile, renderTemplate } from '@featherscloud/pinion'

/**
 * Generates the pr-title-check.yml workflow file.
 * 
 * Creates a workflow that validates PR titles follow conventional commit format
 * and provides helpful feedback to contributors.
 * 
 * @param {PinionContext} ctx - Pinion context with configuration
 * @returns {Promise<PinionContext>} Updated context after file generation
 * 
 * @throws {Error} If the workflow file cannot be written
 * 
 * @example
 * ```typescript
 * // Generate with default config
 * await generate({
 *   cwd: '/path/to/project',
 *   config: { requireConventionalCommits: true }
 * })
 * 
 * // Creates: .github/workflows/pr-title-check.yml
 * ```
 */
export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then(renderTemplate(
      (ctx: any) => {
        const { requireConventionalCommits = true } = ctx
        
        // Only generate if conventional commits are required
        if (!requireConventionalCommits) {
          return null
        }
        
        return `name: "PR Title Format Check"

on:
  pull_request:
    types:
      - opened
      - edited
      - synchronize
      - reopened

permissions:
  pull-requests: read

jobs:
  main:
    name: Validate PR title
    runs-on: ubuntu-latest
    steps:
      - uses: amannn/action-semantic-pull-request@v5
        id: lint_pr_title
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        with:
          # Configure which types are allowed (newline-delimited).
          # Default: https://github.com/commitizen/conventional-commit-types
          types: |
            fix
            feat
            docs
            style
            chore
            refactor
            perf
            test
            ci
            build
            revert
            major
          requireScope: false


      - uses: marocchino/sticky-pull-request-comment@v2
        # When the previous steps fails, the workflow would stop. By adding this
        # condition you can continue the execution with the populated error message.
        if: always() && (steps.lint_pr_title.outputs.error_message != null)
        with:
          header: pr-title-lint-error
          message: |
            Hey there and thank you for opening this pull request! 👋🏼
            
            We require pull request titles to follow the [Conventional Commits specification](https://www.conventionalcommits.org/en/v1.0.0/) and it looks like your proposed title needs to be adjusted.

            Details:
            
            \`\`\`
            \${{ steps.lint_pr_title.outputs.error_message }}
            \`\`\`

      # Delete a previous comment when the issue has been resolved
      - if: \${{ steps.lint_pr_title.outputs.error_message == null }}
        uses: marocchino/sticky-pull-request-comment@v2
        with:   
          header: pr-title-lint-error
          delete: true`
      },
      toFile('.github/workflows/pr-title-check.yml')
    ))
