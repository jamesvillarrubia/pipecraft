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
    .then((ctx) => {
      const { requireConventionalCommits = true } = ctx as any
      
      // Only generate if conventional commits are required
      if (!requireConventionalCommits) {
        return ctx
      }
      
      return renderTemplate(
        (ctx: any) => {
          // Get all commit types from bumpRules config
          const bumpRules = ctx.config?.semver?.bumpRules || ctx.config?.versioning?.bumpRules || {}
          const allTypes = Object.keys(bumpRules)

          // Get major bump types for breaking change detection
          const majorTypes = Object.entries(bumpRules)
            .filter(([_, level]) => level === 'major')
            .map(([type, _]) => type)

          // Build the types list for the PR title validator
          // Use config types, or fall back to common conventional commit types
          const typesList = allTypes.length > 0
            ? allTypes.map(type => `            ${type}`).join('\n')
            : `            fix
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
            major`

          // Build regex pattern for detecting major bump types
          // Format: ^(major|breaking|othermajortype):
          const majorTypesPattern = majorTypes.length > 0
            ? `^(${majorTypes.join('|')}):`
            : '^major:'

          return `name: "PR Title Format Check"

on:
  pull_request:
    types:
      - opened
      - edited
      - synchronize
      - reopened

permissions:
  pull-requests: write
  contents: read

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
          # Types are derived from pipecraft config bumpRules
          types: |
${typesList}
          requireScope: false

      # Check for breaking changes
      - name: Check for breaking changes
        id: breaking_check
        if: always()
        run: |
          PR_TITLE="\${{ github.event.pull_request.title }}"
          PR_BODY="\${{ github.event.pull_request.body }}"

          # Check if title starts with types that bump major version or contains "!" or "BREAKING"
          # Types that bump major: ${majorTypes.join(', ')}
          if [[ "\$PR_TITLE" =~ ^(${majorTypes.join('|')}): ]] || [[ "\$PR_TITLE" =~ ^[a-z]+\!: ]] || [[ "\$PR_TITLE" =~ BREAKING ]] || [[ "\$PR_TITLE" =~ breaking ]]; then
            echo "is_breaking=true" >> \$GITHUB_OUTPUT
            echo "⚠️  Breaking change detected in PR title"
          elif [[ "\$PR_BODY" =~ BREAKING[[:space:]]CHANGE ]]; then
            echo "is_breaking=true" >> \$GITHUB_OUTPUT
            echo "⚠️  Breaking change detected in PR body"
          else
            echo "is_breaking=false" >> \$GITHUB_OUTPUT
          fi

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
          delete: true

      # Add warning comment for breaking changes
      - name: Add breaking change warning
        if: always() && steps.breaking_check.outputs.is_breaking == 'true'
        uses: marocchino/sticky-pull-request-comment@v2
        with:
          header: breaking-change-warning
          message: |
            ## ⚠️  BREAKING CHANGE DETECTED

            This PR contains a **BREAKING CHANGE** which will result in a **MAJOR version bump**.

            **Important considerations:**
            - Breaking changes require careful review by maintainers
            - This will increment the major version (e.g., 1.x.x → 2.0.0)
            - Users will need to update their code when upgrading
            - Documentation should be updated to reflect the breaking changes
            - Consider if this change can be made backwards-compatible

            **Required actions:**
            - [ ] Breaking changes are documented in the PR description
            - [ ] Migration guide is provided (if applicable)
            - [ ] All maintainers have been notified for review

            **Reviewers:** This PR requires additional scrutiny due to the breaking change.

      # Delete breaking change warning when resolved
      - name: Remove breaking change warning
        if: always() && steps.breaking_check.outputs.is_breaking == 'false'
        uses: marocchino/sticky-pull-request-comment@v2
        with:
          header: breaking-change-warning
          delete: true`
        },
        toFile('.github/workflows/pr-title-check.yml')
      )(ctx)
    })
