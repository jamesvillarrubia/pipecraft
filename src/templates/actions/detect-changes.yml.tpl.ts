/**
 * Detect Changes Action Template
 *
 * Generates a REUSABLE GitHub composite action that detects which domains have changed.
 * Supports both Nx dependency graph analysis and path-based change detection.
 *
 * ## Purpose
 *
 * This action is **configuration-driven** and accepts domain definitions as JSON input,
 * making it truly reusable across any project without regeneration:
 * - For Nx monorepos: Uses `nx show projects --affected` to leverage the dependency graph
 * - For path-based projects: Uses path filters to detect which domains changed
 * - Automatically falls back to path-based detection if Nx is unavailable
 *
 * ## Key Design Principle
 *
 * **Domains are passed as input, not hardcoded in the action.**
 * This allows the same action to work with any domain configuration without regeneration.
 *
 * ## Generated Action Location
 *
 * `.github/actions/detect-changes/action.yml`
 *
 * @module templates/actions/detect-changes.yml.tpl
 */

import { type PinionContext, renderTemplate, toFile } from '@featherscloud/pinion'
import fs from 'fs'
import { logger } from '../../utils/logger.js'

/**
 * Generates the detect-changes composite action YAML content.
 *
 * Creates a GitHub Actions composite action that:
 * - Accepts domain configuration as JSON input (not hardcoded)
 * - Dynamically parses domains using jq
 * - Checks for Nx availability in the repository
 * - Uses `nx show projects --affected` for dependency graph analysis
 * - Maps affected projects to domains dynamically
 * - Falls back to path-based detection if Nx isn't available
 * - Outputs individual domain results AND a JSON summary
 *
 * @param {any} ctx - Context (not used - action is fully dynamic now)
 * @returns {string} YAML content for the composite action
 */
const changesActionTemplate = (ctx: any) => {
  // Generate the composite action YAML - now fully configuration-driven
  return `name: 'Detect Changes (Configuration-Driven)'
description: 'Enhanced change detection using Nx dependency graph with path-based fallback. Accepts domain configuration as JSON input.'
author: 'Pipecraft'

inputs:
  baseRef:
    description: 'Base reference to compare against'
    required: false
    default: 'main'
  domains-config:
    description: 'YAML string of domain configurations (embedded in pipeline at generation time)'
    required: true
  useNx:
    description: 'Whether to use Nx dependency graph for change detection'
    required: false
    default: 'true'
  node-version:
    description: 'Node.js version to use'
    required: false
    default: '20'
  pnpm-version:
    description: 'pnpm version to use (only used if pnpm detected)'
    required: false
    default: '9'

outputs:
  changes:
    description: 'JSON object with domain change results (e.g., {"core": true, "docs": false})'
    value: \${{ steps.output.outputs.changes }}
  affectedDomains:
    description: 'Comma-separated list of domains with changes'
    value: \${{ steps.output.outputs.affectedDomains }}
  nxAvailable:
    description: 'Whether Nx is available in the repository'
    value: \${{ steps.nx-check.outputs.available }}
  affectedProjects:
    description: 'Comma-separated list of affected Nx projects'
    value: \${{ steps.nx-filter.outputs.affectedProjects }}

runs:
  using: 'composite'
  steps:
    - name: Set Base Branch
      id: set-base
      shell: bash
      run: |
        base_branch=\${{ inputs.baseRef || 'main' }}
        echo "base_branch=$base_branch" >> $GITHUB_OUTPUT
        echo "base_branch=$base_branch" >> $GITHUB_ENV

    - name: Parse Domain Configuration
      id: parse-domains
      shell: bash
      run: |
        # Parse the domains-config YAML input (embedded in pipeline at generation time)
        echo "\${{ inputs.domains-config }}" > /tmp/domains-config.yml
        
        # Extract domain names using yq (or fallback to grep/awk)
        if command -v yq >/dev/null 2>&1; then
          DOMAIN_NAMES=$(yq eval 'keys | join(",")' /tmp/domains-config.yml)
        else
          # Fallback: extract domain names without yq
          DOMAIN_NAMES=$(grep -E '^[[:space:]]*[a-zA-Z0-9_-]+:' /tmp/domains-config.yml | sed 's/[[:space:]]*\\(.*\\):.*/\\1/' | tr '\\n' ',' | sed 's/,$//')
        fi
        
        echo "domains=$DOMAIN_NAMES" >> $GITHUB_OUTPUT
        echo "📋 Configured domains: $DOMAIN_NAMES"
        
        # Display the domain configuration
        echo "Domain configuration:"
        cat /tmp/domains-config.yml
        echo ""

    - name: Check for Nx
      id: nx-check
      shell: bash
      run: |
        if [ -f "nx.json" ] || ([ -f "package.json" ] && grep -q '"nx"' package.json); then
          echo "available=true" >> $GITHUB_OUTPUT
          echo "🔍 Nx detected in repository"
        else
          echo "available=false" >> $GITHUB_OUTPUT
          echo "⚠️  Nx not detected, falling back to path-based detection"
        fi

    - name: Setup Node.js
      if: steps.nx-check.outputs.available == 'true' && inputs.useNx == 'true'
      uses: actions/setup-node@v4
      with:
        node-version: \${{ inputs.node-version }}

    - name: Install Dependencies
      if: steps.nx-check.outputs.available == 'true' && inputs.useNx == 'true'
      shell: bash
      run: |
        echo "📦 Installing dependencies for Nx..."
        if [ -f "pnpm-lock.yaml" ]; then
          corepack enable
          pnpm install --frozen-lockfile || pnpm install
        elif [ -f "yarn.lock" ]; then
          yarn install --frozen-lockfile || yarn install
        elif [ -f "package-lock.json" ]; then
          npm ci || npm install
        else
          npm install
        fi

    - name: Detect Changes with Nx (if available)
      id: nx-filter
      if: steps.nx-check.outputs.available == 'true' && inputs.useNx == 'true'
      shell: bash
      run: |
        echo "🚀 Using Nx dependency graph for change detection"

        # Get affected projects using Nx
        if command -v npx >/dev/null 2>&1; then
          # Get list of affected projects (newline-separated)
          AFFECTED_PROJECTS_RAW=$(npx nx show projects --affected --base=\${{ steps.set-base.outputs.base_branch }} 2>/dev/null || echo "")

          # Convert newlines to commas for storage
          AFFECTED_PROJECTS=$(echo "$AFFECTED_PROJECTS_RAW" | tr '\\n' ',' | sed 's/,$//')
          echo "affectedProjects=$AFFECTED_PROJECTS" >> $GITHUB_OUTPUT

          if [ -n "$AFFECTED_PROJECTS" ]; then
            echo "📦 Affected Nx projects: $AFFECTED_PROJECTS"

            # Parse domains dynamically from config
            IFS=',' read -ra DOMAIN_NAMES <<< "\${{ steps.parse-domains.outputs.domains }}"
            
            # Initialize results JSON
            echo "{" > /tmp/nx-results.json
            FIRST=true
            
            # Check each domain dynamically
            for domain in "\${DOMAIN_NAMES[@]}"; do
              domain=$(echo "$domain" | xargs) # trim whitespace
              DOMAIN_AFFECTED=false
              
              # Check if any affected project matches this domain name
              IFS=',' read -ra PROJECTS <<< "$AFFECTED_PROJECTS"
              for project in "\${PROJECTS[@]}"; do
                project=$(echo "$project" | xargs)
                # Match if project name contains domain name (with flexible - vs _ matching)
                domain_pattern=$(echo "$domain" | sed 's/-/[-_]/g')
                if echo "$project" | grep -qiE "$domain_pattern"; then
                  DOMAIN_AFFECTED=true
                  echo "  ✅ $project matches $domain domain"
                  break
                fi
              done
              
              # Add to JSON
              if [ "$FIRST" = true ]; then
                FIRST=false
              else
                echo "," >> /tmp/nx-results.json
              fi
              echo "  \\"$domain\\": $DOMAIN_AFFECTED" >> /tmp/nx-results.json
            done
            
            echo "}" >> /tmp/nx-results.json
            
          else
            echo "No affected projects detected"
            # Create empty results
            echo "{}" > /tmp/nx-results.json
            IFS=',' read -ra DOMAIN_NAMES <<< "\${{ steps.parse-domains.outputs.domains }}"
            FIRST=true
            for domain in "\${DOMAIN_NAMES[@]}"; do
              if [ "$FIRST" = true ]; then
                echo "{" > /tmp/nx-results.json
                FIRST=false
              else
                echo "," >> /tmp/nx-results.json
              fi
              echo "  \\"$domain\\": false" >> /tmp/nx-results.json
            done
            echo "}" >> /tmp/nx-results.json
          fi
        else
          echo "⚠️  npx not available, falling back to path-based detection"
          echo "{}" > /tmp/nx-results.json
          echo "affectedProjects=" >> $GITHUB_OUTPUT
        fi
        
        cat /tmp/nx-results.json

    - name: Detect Changes with Paths Filter (fallback)
      uses: dorny/paths-filter@v3
      id: filter
      if: steps.nx-check.outputs.available != 'true' || inputs.useNx != 'true'
      with:
        base: \${{ steps.set-base.outputs.base_branch }}
        filters: \${{ inputs.domains-config }}

    - name: Generate Outputs
      id: output
      shell: bash
      run: |
        # Determine which detection method was used and build results
        if [ "\${{ steps.nx-check.outputs.available }}" == "true" ] && [ "\${{ inputs.useNx }}" == "true" ]; then
          # Use Nx results
          CHANGES_JSON=$(cat /tmp/nx-results.json)
          echo "🔍 Using Nx dependency analysis results"
          echo "📦 Affected projects: \${{ steps.nx-filter.outputs.affectedProjects }}"
        else
          # Use path filter results - convert to JSON
          echo "📁 Using path-based change detection"
          echo "{" > /tmp/path-results.json
          
          IFS=',' read -ra DOMAIN_NAMES <<< "\${{ steps.parse-domains.outputs.domains }}"
          FIRST=true
          for domain in "\${DOMAIN_NAMES[@]}"; do
            domain=$(echo "$domain" | xargs)
            if [ "$FIRST" = true ]; then
              FIRST=false
            else
              echo "," >> /tmp/path-results.json
            fi
            
            # Check if domain appears in filter changes
            if echo "\${{ steps.filter.outputs.changes }}" | grep -q "$domain"; then
              echo "  \\"$domain\\": true" >> /tmp/path-results.json
            else
              echo "  \\"$domain\\": false" >> /tmp/path-results.json
            fi
          done
          echo "}" >> /tmp/path-results.json
          
          CHANGES_JSON=$(cat /tmp/path-results.json)
        fi
        
        # Output the JSON
        echo "changes<<EOF" >> $GITHUB_OUTPUT
        echo "$CHANGES_JSON" >> $GITHUB_OUTPUT
        echo "EOF" >> $GITHUB_OUTPUT
        
        # Build comma-separated list of affected domains
        AFFECTED_DOMAINS=$(echo "$CHANGES_JSON" | jq -r 'to_entries | map(select(.value == true) | .key) | join(",")')
        echo "affectedDomains=$AFFECTED_DOMAINS" >> $GITHUB_OUTPUT
        
        echo "📋 Change Detection Results:"
        echo "$CHANGES_JSON" | jq '.'
        echo "🎯 Affected domains: $AFFECTED_DOMAINS"
        echo "  nx-available: \${{ steps.nx-check.outputs.available }}"
`
}

/**
 * Generator entry point for detect-changes composite action.
 *
 * Generates the `.github/actions/detect-changes/action.yml` file with configuration-driven
 * change detection logic. This action accepts domain configuration as input at runtime,
 * making it truly reusable without regeneration.
 *
 * **Important:** This action no longer embeds domain configurations. Instead, it receives
 * them as JSON input from the workflow, allowing the same action to work with any
 * domain configuration.
 *
 * @param {PinionContext} ctx - Pinion generator context (domains no longer needed in template)
 * @returns {Promise<PinionContext>} Updated context after file generation
 */
export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then(ctx => {
      // Check if file exists to determine merge status
      const filePath = '.github/actions/detect-changes/action.yml'
      const exists = fs.existsSync(filePath)
      const status = exists ? '🔄 Merged with existing' : '📝 Created new'
      logger.verbose(`${status} ${filePath}`)
      return ctx
    })
    .then(
      renderTemplate(changesActionTemplate, toFile('.github/actions/detect-changes/action.yml'))
    )
