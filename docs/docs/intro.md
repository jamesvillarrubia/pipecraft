---
sidebar_position: 1
---

# Getting Started

PipeCraft generates battle-tested CI/CD workflows directly into your repository. Instead of debugging GitHub Actions YAML through trial and error, you start with proven templates that handle common patterns like domain-based testing, semantic versioning, and branch promotions.

## Why PipeCraft?

Debugging CI/CD pipelines wastes time. You make a change, push it, wait for the pipeline to run, discover a syntax error or misconfiguration, fix it, wait again. Each cycle takes 5-15 minutes. After several iterations, you've spent hours on what should be straightforward workflow setup.

PipeCraft eliminates these debugging cycles by providing battle-tested templates. These workflows are generated into your repository where you own them completely. You can customize them freely—add your deployment steps, integrate your tools, modify job configurations. The generated code lives in your `.github/workflows` directory just like hand-written workflows, but you start from a working foundation instead of an empty file.

When customizations become complex or you need to incorporate updates, regenerate from templates. PipeCraft's smart merging preserves your custom jobs and deployment steps while updating the core workflow structure. This gives you the best of both worlds: the speed of templates with the flexibility of full ownership.

The templates include best practices for monorepos where different parts of your codebase need independent testing. PipeCraft's domain-based change detection ensures only affected code gets tested, reducing CI costs and runtime. The workflows also handle semantic versioning, changelog generation, and automated branch promotions—common requirements that are tedious to implement correctly from scratch.

## Your first workflow

Let's walk through setting up PipeCraft in a real project. We'll use a monorepo with an API and web frontend as an example.

### Install PipeCraft

Start by installing PipeCraft globally:

```bash
npm install -g pipecraft
```

This makes the `pipecraft` command available in your terminal.

### Initialize your configuration

Navigate to your project and run the init command:

```bash
cd my-monorepo
pipecraft init
```

PipeCraft will ask you questions about your project:

- **What branches do you use?** Most teams use develop, staging, and main. Choose what matches your workflow.
- **What domains exist in your codebase?** For our example, we have "api" and "web".
- **Where is each domain located?** The API lives in `packages/api/**` and the web app in `packages/web/**`.

After answering these questions, you'll have a `.pipecraftrc.json` file:

```json
{
  "ciProvider": "github",
  "branchFlow": ["develop", "staging", "main"],
  "initialBranch": "develop",
  "finalBranch": "main",
  "domains": {
    "api": {
      "paths": ["packages/api/**"],
      "testable": true,
      "deployable": true
    },
    "web": {
      "paths": ["packages/web/**"],
      "testable": true,
      "deployable": true
    }
  }
}
```

This configuration tells PipeCraft everything it needs to know about your project structure.

### Generate workflows

Now generate the workflow files:

```bash
pipecraft generate
```

PipeCraft creates:
- `.github/workflows/pipeline.yml` - Your main CI/CD pipeline
- `.github/actions/*/action.yml` - Reusable actions for change detection, versioning, etc.

Open `.github/workflows/pipeline.yml` and you'll see a complete workflow with jobs for testing, versioning, and deploying both domains. The workflow is ready to use - you just need to add your specific test and deploy commands.

### Add your test commands

Find the test jobs in the generated workflow and add your actual test commands:

```yaml
test-api:
  needs: changes
  if: needs.changes.outputs.api == 'true'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - run: npm install
    - run: npm test -- packages/api  # Your test command here
```

Do the same for the web domain and any deploy jobs. PipeCraft preserves these customizations when you regenerate, so you can safely edit them.

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

When you run `pipecraft generate`, PipeCraft creates a complete GitHub Actions workflow tailored to your configuration. Understanding what's in these files helps you customize them effectively.

### The main pipeline file

The heart of your CI/CD is `.github/workflows/pipeline.yml`. This file orchestrates all the jobs that run when you push code. Let's look at what it contains:

```yaml
name: Pipeline

on:
  push:
    branches:
      - develop
      - staging
      - main
  workflow_dispatch:
    inputs:
      target_branch:
        description: 'Branch to promote to'
        required: true

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      api: ${{ steps.changes.outputs.api }}
      web: ${{ steps.changes.outputs.web }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: changes
        with:
          filters: |
            api:
              - 'packages/api/**'
            web:
              - 'packages/web/**'

  test-api:
    needs: changes
    if: needs.changes.outputs.api == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # Your API test commands here

  test-web:
    needs: changes
    if: needs.changes.outputs.web == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # Your web test commands here
```

The workflow starts with a **change detection job** that uses GitHub's paths-filter action to determine which domains have modifications. This job outputs boolean values (api: true/false, web: true/false) that other jobs use to decide whether to run.

Next come **domain-specific test jobs** that only execute when their domain has changes. The `if: needs.changes.outputs.api == 'true'` condition prevents unnecessary test runs. When you change only the web code, only web tests run. This saves time and CI minutes.

PipeCraft also generates jobs for **version bumping** on your final branch (main) and **branch promotion** to move code through your flow automatically. These jobs respect your semantic versioning rules and only run when appropriate.

### Reusable actions

PipeCraft creates composite actions in `.github/actions/` for common operations:

- **change-detection**: Analyzes file paths to determine affected domains
- **version-check**: Inspects commits to calculate the next version number
- **branch-promotion**: Handles the mechanics of promoting code between branches

These actions keep the main workflow file clean and make it easier to understand what's happening at each step.

### Customizable sections

The generated workflow includes clearly marked sections where you can add your own jobs and steps:

```yaml
# === USER JOBS START ===
# Add your custom jobs here
# PipeCraft preserves this section during regeneration
# === USER JOBS END ===
```

Anything between these markers survives regeneration. When you add deployment scripts, integration tests, or notification steps, place them in these sections. PipeCraft's AST-based merging ensures your customizations remain intact when you update your configuration and regenerate.

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

For questions or discussions, visit [GitHub Discussions](https://github.com/jamesvillarrubia/pipecraft/discussions).

To report bugs or request features, open an issue on [GitHub Issues](https://github.com/jamesvillarrubia/pipecraft/issues).
