/**
 * Nx-Enhanced Pipeline Template
 *
 * This template generates GitHub Actions workflows that leverage Nx's dependency graph
 * for intelligent change detection in monorepo environments. It automatically detects
 * which projects are affected by changes and only runs relevant tests and deployments.
 *
 * NOTE: This is an example template and not currently used in the main generation flow.
 */

import { PinionContext, toFile, renderTemplate } from '@featherscloud/pinion'

const nxPipelineTemplate = () => `name: 'Nx-Enhanced CI/CD Pipeline'

on:
  push:
    branches: [develop, staging, main]
  pull_request:
    branches: [develop, staging, main]

jobs:
  # Enhanced change detection using Nx dependency graph
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      core: \${{ steps.changes.outputs.core }}
      cicd: \${{ steps.changes.outputs.cicd }}
      docs: \${{ steps.changes.outputs.docs }}
      nx-available: \${{ steps.changes.outputs.nxAvailable }}
      affected-projects: \${{ steps.changes.outputs.affectedProjects }}
    steps:
      - name: Detect Changes with Nx Support
        id: changes
        uses: ./.github/actions/detect-changes-nx
        with:
          baseRef: \${{ github.event.pull_request.base.ref || 'main' }}
          useNx: true
          domainMappings: |
            {
              "core": ["src", "libs", "apps", "core", "main", "api", "web", "frontend", "backend"],
              "cicd": [".github", "workflows", "infrastructure", "ci", "cd", "deploy", "pipeline"],
              "docs": ["docs", "documentation", "site", "storybook", "guide", "readme"]
            }

  # Core application testing (only runs if core domain has changes)
  test-core:
    runs-on: ubuntu-latest
    needs: detect-changes
    if: needs.detect-changes.outputs.core == 'true'
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install Dependencies
        run: npm ci
      
      - name: Run Nx Tests for Affected Projects
        if: needs.detect-changes.outputs.nx-available == 'true'
        run: |
          echo "🧪 Running tests for affected Nx projects: \${{ needs.detect-changes.outputs.affected-projects }}"
          npx nx affected --target=test --base=\${{ github.event.pull_request.base.ref || 'main' }}
      
      - name: Run Standard Tests (fallback)
        if: needs.detect-changes.outputs.nx-available != 'true'
        run: |
          echo "🧪 Running standard test suite"
          npm test

  # CI/CD infrastructure testing
  test-cicd:
    runs-on: ubuntu-latest
    needs: detect-changes
    if: needs.detect-changes.outputs.cicd == 'true'
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
      
      - name: Validate GitHub Actions
        uses: ./.github/actions/validate-workflows
      
      - name: Test Infrastructure Changes
        run: |
          echo "🔧 Validating CI/CD changes"
          # Add your infrastructure validation here

  # Documentation testing and deployment
  test-docs:
    runs-on: ubuntu-latest
    needs: detect-changes
    if: needs.detect-changes.outputs.docs == 'true'
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install Dependencies
        run: npm ci
      
      - name: Build Documentation
        run: |
          echo "📚 Building documentation"
          npm run docs:build
      
      - name: Validate Documentation
        run: |
          echo "✅ Validating documentation structure"
          # Add your documentation validation here

  # Deployment jobs (only run after all tests pass)
  deploy-core:
    runs-on: ubuntu-latest
    needs: [detect-changes, test-core]
    if: needs.detect-changes.outputs.core == 'true' && needs.test-core.result == 'success'
    environment: production
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
      
      - name: Deploy Core Application
        run: |
          echo "🚀 Deploying core application"
          # Add your deployment logic here

  deploy-docs:
    runs-on: ubuntu-latest
    needs: [detect-changes, test-docs]
    if: needs.detect-changes.outputs.docs == 'true' && needs.test-docs.result == 'success'
    environment: production
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
      
      - name: Deploy Documentation
        run: |
          echo "📚 Deploying documentation"
          # Add your documentation deployment logic here

  # Summary job to show what was affected
  summary:
    runs-on: ubuntu-latest
    needs: [detect-changes, test-core, test-cicd, test-docs]
    if: always()
    steps:
      - name: Pipeline Summary
        run: |
          echo "📋 Pipeline Summary:"
          echo "  Core changes: \${{ needs.detect-changes.outputs.core }}"
          echo "  CI/CD changes: \${{ needs.detect-changes.outputs.cicd }}"
          echo "  Docs changes: \${{ needs.detect-changes.outputs.docs }}"
          echo "  Nx available: \${{ needs.detect-changes.outputs.nx-available }}"
          if [ "\${{ needs.detect-changes.outputs.affected-projects }}" != "" ]; then
            echo "  Affected projects: \${{ needs.detect-changes.outputs.affected-projects }}"
          fi
          echo ""
          echo "Test Results:"
          echo "  Core tests: \${{ needs.test-core.result }}"
          echo "  CI/CD tests: \${{ needs.test-cicd.result }}"
          echo "  Docs tests: \${{ needs.test-docs.result }}"
`

export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then(renderTemplate(nxPipelineTemplate, toFile('.github/workflows/nx-pipeline.yml')))
