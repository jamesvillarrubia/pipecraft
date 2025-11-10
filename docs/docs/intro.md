---
sidebar_position: 1
---

# Getting Started

PipeCraft generates battle-tested CI/CD workflows directly into your repository. Instead of debugging GitHub Actions YAML through trial and error, you start with proven templates that handle common patterns like domain-based testing, semantic versioning, and branch promotions.

## Why PipeCraft?

Debugging CI/CD pipelines wastes time. You make a change, push it, wait for the pipeline to run, discover a syntax error or misconfiguration, fix it, wait again. Each cycle takes 5-15 minutes. After several iterations, you've spent hours on what should be straightforward workflow setup.

PipeCraft eliminates these debugging cycles by providing battle-tested templates. These workflows are generated into your repository where you own them completely. You can customize them freely—add your deployment steps, integrate your tools, modify job configurations. The generated code lives in your `.github/workflows` directory just like hand-written workflows, but you start from a working foundation instead of an empty file.

When customizations become complex or you need to incorporate updates, regenerate from templates. PipeCraft's smart merging preserves your custom jobs and deployment steps while updating the core workflow structure. This gives you the best of both worlds: the speed of templates with the flexibility of full ownership.

The templates include best practices for monorepos where different parts of your codebase need independent testing. PipeCraft's domain-based change detection ensures only affected code gets tested, reducing CI costs and runtime. For Nx workspaces, PipeCraft automatically detects your setup and generates optimized workflows that use Nx's dependency graph for even more precise change detection. The workflows also handle semantic versioning, changelog generation, and automated branch promotions—common requirements that are tedious to implement correctly from scratch.

## Your first workflow

Let's walk through setting up PipeCraft in a real project. We'll use a monorepo with an API and web frontend as an example.

### Run PipeCraft

No installation required—use `npx` to run PipeCraft directly:

```bash
cd my-monorepo
npx pipecraft init
```

Alternatively, you can install PipeCraft globally:

```bash
npm install -g pipecraft
pipecraft init
```

### Initialize your configuration

PipeCraft will ask you questions about your project:

- **What is your project name?** Used for documentation and workflow naming
- **Which CI provider are you using?** GitHub Actions or GitLab CI/CD
- **What merge strategy do you prefer?** Fast-forward only (recommended) or merge commits
- **Require conventional commit format for PR titles?** Enforces consistent commit messages
- **What is your development branch name?** Usually `develop` or `main`
- **What is your production branch name?** Usually `main` or `production`
- **Enter your branch flow (comma-separated)** - The sequence of branches (e.g., `develop,staging,main`)
- **Which package manager do you use?** npm, yarn, or pnpm (auto-detected from lock files)
- **What domains exist in your codebase?** Choose from common patterns or enter custom domains

For domains, you can select from:

- **API + Web** (common monorepo pattern)
- **Frontend + Backend** (full-stack pattern)
- **Apps + Libs** (Nx-style monorepo)
- **Custom domains** (enter your own comma-separated list)

If you choose custom domains, PipeCraft will warn you that you'll need to edit the paths in the generated configuration to match your actual project structure.

PipeCraft also auto-detects Nx workspaces and will enable Nx integration if found.

After answering these questions, you'll have a `.pipecraftrc.json` file:

```json
{
  "ciProvider": "github",
  "mergeStrategy": "fast-forward",
  "requireConventionalCommits": true,
  "initialBranch": "develop",
  "finalBranch": "main",
  "branchFlow": ["develop", "staging", "main"],
  "packageManager": "npm",
  "autoMerge": {
    "staging": true,
    "main": true
  },
  "semver": {
    "bumpRules": {
      "feat": "minor",
      "fix": "patch",
      "breaking": "major"
    }
  },
  "domains": {
    "api": {
      "paths": ["apps/api/**"],
      "description": "API application changes"
    },
    "web": {
      "paths": ["apps/web/**"],
      "description": "Web application changes"
    },
    "libs": {
      "paths": ["libs/**"],
      "description": "Shared library changes"
    },
    "cicd": {
      "paths": [".github/workflows/**"],
      "description": "CI/CD configuration changes"
    }
  }
}
```

**Note:** The domains are generated based on your selection during init. If you chose custom domains, you'll need to edit the paths in `.pipecraftrc.json` to match your actual project structure. You can always add, remove, or modify domains after generation.

If PipeCraft detects an Nx workspace, it will also add an `nx` configuration section with detected tasks and optimization settings.

This configuration tells PipeCraft everything it needs to know about your project structure.

### Generate workflows

Now generate the workflow files:

```bash
pipecraft generate
```

PipeCraft creates:

**Main workflow:**

- `.github/workflows/pipeline.yml` - Your main CI/CD pipeline

**Reusable actions:**

- `actions/detect-changes/action.yml` - Path-based change detection
- `actions/calculate-version/action.yml` - Semantic version calculation
- `actions/create-tag/action.yml` - Git tag creation
- `actions/create-pr/action.yml` - Pull request management
- `actions/manage-branch/action.yml` - Branch operations
- `actions/promote-branch/action.yml` - Branch promotion
- `actions/create-release/action.yml` - GitHub release creation

**Additional workflows:**

- `.github/workflows/enforce-pr-target.yml` - Ensures PRs target correct branches
- `.github/workflows/pr-title-check.yml` - Validates conventional commit format

**Configuration:**

- `.release-it.cjs` - Release-it configuration for version management

If you have an Nx workspace, PipeCraft also generates:

- `actions/detect-changes-nx/action.yml` - Nx-optimized change detection

Open `.github/workflows/pipeline.yml` and you'll see a complete workflow with jobs for testing, versioning, and deploying both domains. The workflow is ready to use - you just need to add your specific test and deploy commands.

### Add your test commands

Find the test jobs in the generated workflow and replace the TODO comments with your actual test commands:

```yaml
test-api:
  needs: changes
  if: ${{ needs.changes.outputs.api == 'true' }}
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        ref: ${{ inputs.commitSha || github.sha }}
    - uses: actions/setup-node@v4
      with:
        node-version: '24'
    - run: npm install
    - run: npm test -- packages/api # Your test command here
```

The generated jobs start with TODO placeholders that you replace with your actual commands. PipeCraft uses `operation: 'preserve'` for domain jobs, so your customizations survive regeneration. Only structural changes (like conditions and dependencies) are updated when you modify your configuration.

### Commit and test

Commit the generated files to your repository:

```bash
git add .github/ .pipecraftrc.json
git commit -m "feat: add pipecraft workflows"
git push
```

The workflow will run on your next push. Open GitHub Actions to watch it execute. You'll see it:

1. Detect which domains changed (both, in this case, since it's the first run)
2. Run tests for changed domains
3. Calculate a version number from your commit message (since we used `feat:`)
4. Create a git tag with the new version

## What gets generated

When you run `npx pipecraft generate`, PipeCraft creates a complete GitHub Actions workflow tailored to your configuration. Understanding what's in these files helps you customize them effectively.

### The main pipeline file

The heart of your CI/CD is `.github/workflows/pipeline.yml`. This file orchestrates all the jobs that run when you push code. Let's look at what it contains:

> **Note**: The examples below show action paths like `./actions/detect-changes`. By default, PipeCraft generates actions to `.github/actions/` and references them as `./.github/actions/detect-changes`. The shorter path shown here is from PipeCraft's own repository which uses a different configuration. See [Action Reference Modes](action-modes.md) for details.

```yaml
name: Pipeline

on:
  push:
    branches:
      - develop
      - staging
      - main
  pull_request:
    branches:
      - develop
      - staging
      - main
  workflow_call:
    inputs:
      version:
        description: The version to deploy
        required: false
        type: string
      baseRef:
        description: The base reference for comparison
        required: false
        type: string
  workflow_dispatch:
    inputs:
      version:
        description: The version to deploy
        required: false
        type: string
      baseRef:
        description: The base reference for comparison
        required: false
        type: string

jobs:
  # =============================================================================
  # CHANGES DETECTION (⚠️  Managed by Pipecraft - do not modify)
  # =============================================================================
  changes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.commitSha || github.sha }}
          fetch-depth: 0
      - uses: ./actions/detect-changes
        id: detect
        with:
          baseRef: ${{ inputs.baseRef || 'main' }}
    outputs:
      api: ${{ steps.detect.outputs.api }}
      web: ${{ steps.detect.outputs.web }}

  # =============================================================================
  # TESTING JOBS (✅ Customize these with your test logic)
  # =============================================================================
  test-api:
    needs: changes
    if: ${{ needs.changes.outputs.api == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.commitSha || github.sha }}
      # TODO: Replace with your api test logic
      - name: Run api tests
        run: |
          echo "Running tests for api domain"
          echo "Replace this with your actual test commands"
          # Example: npm test -- --testPathPattern=api

  test-web:
    needs: changes
    if: ${{ needs.changes.outputs.web == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.commitSha || github.sha }}
      # TODO: Replace with your web test logic
      - name: Run web tests
        run: |
          echo "Running tests for web domain"
          echo "Replace this with your actual test commands"
          # Example: npm test -- --testPathPattern=web
```

The workflow starts with a **change detection job** that uses GitHub's paths-filter action to determine which domains have modifications. This job outputs boolean values (api: true/false, web: true/false) that other jobs use to decide whether to run.

Next come **domain-specific test jobs** that only execute when their domain has changes. The `if: needs.changes.outputs.api == 'true'` condition prevents unnecessary test runs. When you change only the web code, only web tests run. This saves time and CI minutes.

PipeCraft also generates jobs for **version bumping** on your final branch (main) and **branch promotion** to move code through your flow automatically. These jobs respect your semantic versioning rules and only run when appropriate.

### Reusable actions

PipeCraft creates composite actions in `actions/` for common operations:

- **detect-changes**: Analyzes file paths to determine affected domains using GitHub's paths-filter
- **calculate-version**: Inspects commits to calculate the next semantic version number
- **create-tag**: Creates git tags with the calculated version
- **create-pr**: Manages pull request creation and updates
- **manage-branch**: Handles branch operations and management
- **promote-branch**: Handles the mechanics of promoting code between branches
- **create-release**: Creates GitHub releases with changelogs

These actions keep the main workflow file clean and make it easier to understand what's happening at each step. Each action is self-contained and can be reused across different workflows.

### Customizable sections

The generated workflow includes clearly marked sections where you can customize jobs and add your own:

```yaml
# =============================================================================
# TESTING JOBS (✅ Customize these with your test logic)
# =============================================================================
test-api:
  needs: changes
  if: ${{ needs.changes.outputs.api == 'true' }}
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    # TODO: Replace with your api test logic
    - name: Run api tests
      run: |
        echo "Replace this with your actual test commands"
```

**How preservation works:**

- **Managed jobs** (always regenerated): `changes`, `version`, `tag`, `promote`, `release`
- **Domain jobs** (preserved when customized): `test-*`, `deploy-*`, `remote-test-*`
- **User jobs** (always preserved): Any job name not matching PipeCraft patterns

PipeCraft uses **AST-based intelligent merging** that preserves your customizations by job name. When you edit a `test-api` job, your changes survive regeneration. When you add a custom `database-migrations` job, it's automatically preserved. Comments and formatting are maintained through precise YAML parsing.

## Understanding the workflow

The generated workflow has several phases that run automatically:

**Change detection** looks at which files changed in your commit and determines which domains are affected. If you modify `packages/api/server.ts`, only API jobs run. If you modify `packages/web/App.tsx`, only web jobs run.

**Testing** runs your test commands for affected domains. Jobs run in parallel to save time.

**Versioning** calculates the next version number based on your commit messages. Commits starting with `feat:` bump the minor version, `fix:` bumps the patch version, and commits with `!` are breaking changes that bump the major version.

**Promotion** triggers the workflow on the next branch (staging, then main) after tests pass. This happens automatically for commits that bump the version, creating a continuous flow from development to production.

## Conventional commits

PipeCraft uses conventional commits to automate versioning. Format your commit messages like this:

```bash
git commit -m "feat: add user authentication"    # Bumps 1.0.0 → 1.1.0
git commit -m "fix: correct validation logic"    # Bumps 1.0.0 → 1.0.1
git commit -m "feat!: redesign API endpoints"    # Bumps 1.0.0 → 2.0.0
```

Commits that don't follow this format (like `chore:` or `docs:`) won't trigger version bumps or promotions. They stay on the development branch.

## What's next?

You now have a working CI/CD pipeline. From here you can:

**Customize deploy jobs** by adding your deployment commands to the generated workflow. PipeCraft preserves your changes when regenerating.

**Set up branch protection** by running `pipecraft setup` with a GitHub token. This configures required status checks and auto-merge settings.

**Add more domains** by editing `.pipecraftrc.json` and running `pipecraft generate` again. The workflow will update to include the new domains.

**Learn about the architecture** by reading the [Architecture](./architecture) page to understand how PipeCraft works under the hood.

**Explore workflow patterns** by checking out [Trunk Flow](./flows/trunk-flow) to understand how code flows through your branches.

## Getting help

If something goes wrong, check the [Troubleshooting](./troubleshooting) page for common issues and solutions.

For questions or discussions, visit [GitHub Discussions](https://github.com/pipecraft-lab/pipecraft/discussions).

To report bugs or request features, open an issue on [GitHub Issues](https://github.com/pipecraft-lab/pipecraft/issues).
