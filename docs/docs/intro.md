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

PipeCraft will ask you questions about your project, but currently uses sensible defaults regardless of your answers. You'll get a `.pipecraftrc.json` file with these defaults:

- **CI Provider**: GitHub Actions
- **Branch Flow**: develop → staging → main  
- **Merge Strategy**: fast-forward
- **Default Domains**: api, web, libs, cicd

After initialization, you'll have a `.pipecraftrc.json` file:

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

**Next, customize the configuration**:

1. **Update branch names** if you use different naming (e.g., dev, prod):
   ```json
   {
     "branchFlow": ["dev", "uat", "prod"],
     "initialBranch": "dev",
     "finalBranch": "prod"
   }
   ```

2. **Configure your domains** to match your monorepo structure:
   ```json
   {
     "domains": {
       "api": {
         "paths": ["packages/api/**"],
         "description": "Backend API services",
         "testable": true,
         "deployable": true,
         "remoteTestable": false
       },
       "web": {
         "paths": ["packages/web/**"],
         "description": "Frontend web application",
         "testable": true,
         "deployable": true,
         "remoteTestable": true
       }
     }
   }
   ```

3. **Set domain capabilities** based on your needs:
   - `testable: true` (default) - Generates test jobs
   - `deployable: true` (default: false) - Generates deployment jobs
   - `remoteTestable: true` (default: false) - Generates remote testing jobs after deployment

After editing `.pipecraftrc.json`, you're ready to generate workflows.

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

The generated workflow orchestrates multiple phases that run automatically based on your configuration and what changed in your commit.

### Complete Phase Flow

#### 1. Change Detection
**When**: Every workflow run
**What**: Analyzes which files changed and maps them to domains

The `changes` job looks at modified file paths and determines which domains are affected. If you modify `packages/api/server.ts`, only the API domain is marked as changed. If you modify `packages/shared/utils.ts` used by multiple domains, all dependent domains may be marked.

**Output**: Boolean flags for each domain (`api: true`, `web: false`, etc.)

#### 2. Testing
**When**: After change detection, for domains with `testable: true` (default) that have changes
**What**: Runs your test commands for affected domains in parallel

Jobs run concurrently to save time. `test-api` and `test-web` run simultaneously if both domains changed. Each job only runs if its domain has changes (`if: needs.changes.outputs.api == 'true'`).

**Output**: Pass/fail status for each domain's tests

#### 3. Versioning
**When**: After all tests pass, only on push events (not PRs)
**What**: Calculates the next version number based on conventional commits

The `version` job analyzes commit messages since the last version:
- `feat:` commits bump the minor version (1.0.0 → 1.1.0)
- `fix:` commits bump the patch version (1.0.0 → 1.0.1)
- `feat!:` or `BREAKING CHANGE:` bumps major version (1.0.0 → 2.0.0)
- `chore:`, `docs:`, `style:`, `refactor:` don't trigger version bumps

**Output**: New version number (e.g., `1.2.0`) or empty if no versioned commits

#### 4. Deployment (if domains have `deployable: true`)
**When**: After versioning succeeds, for domains with `deployable: true` that have changes
**What**: Deploys services to their respective environments

Deployment jobs (`deploy-api`, `deploy-web`, etc.) run in parallel. Each only runs if its domain changed and tests passed. This is where you add your actual deployment commands (push to cloud, update Kubernetes, deploy to CDN, etc.).

**Output**: Pass/fail status for each deployment

#### 5. Remote Testing (if domains have `remoteTestable: true`)
**When**: After deployment succeeds, for domains with `remoteTestable: true`
**What**: Tests deployed services in their live environment

Remote test jobs (`remote-test-api`, `remote-test-web`, etc.) verify deployments work correctly. Use these for integration tests, smoke tests, health checks, or end-to-end tests against deployed services.

**Output**: Pass/fail status for each remote test

#### 6. Tagging
**When**: After deployments and remote tests pass, only on initial branch (e.g., develop)
**What**: Creates a git tag with the calculated version

The `tag` job only runs if:
- A version was calculated
- All deployments succeeded or were skipped
- All remote tests passed or were skipped
- We're on the initial branch (develop)

This creates an immutable reference to the tested and deployed code.

**Output**: Git tag created (e.g., `v1.2.0`)

#### 7. Promotion
**When**: After tagging succeeds, on any branch except the final branch
**What**: Creates a PR to promote code to the next branch in the flow

The `promote` job triggers the workflow on the next branch (develop → staging → main). It creates a PR with the version number and passes metadata (version, run number, commit SHA) to maintain traceability.

**Branch flow example** (develop → staging → main):
1. PR merged to develop → Tests pass → Version 1.2.0 calculated → Deploy → Tag → Create PR to staging
2. Staging PR auto-merged → Tests pass → (version already set) → Deploy → Create PR to main
3. Main PR auto-merged → Tests pass → (version already set) → Deploy → Create release

**Output**: PR created to next branch

#### 8. Release (final branch only)
**When**: After tests pass on the final branch (e.g., main)
**What**: Creates a GitHub release with changelog

The `release` job only runs on your production branch (typically `main`). It creates a GitHub release with:
- Version number from tag
- Changelog generated from conventional commits
- Links to compare changes
- Artifacts (if configured)

**Output**: GitHub release created

### Phase Dependencies

Phases depend on previous phases succeeding:

```
Change Detection (always runs)
    ↓
Testing (if testable: true and changes detected)
    ↓
Versioning (if tests pass and push event)
    ↓
Deployment (if deployable: true and version calculated)
    ↓
Remote Testing (if remoteTestable: true and deployment succeeded)
    ↓
Tagging (if version calculated and deployments/remote-tests passed)
    ↓
Promotion (if on non-final branch and tag created)
    OR
Release (if on final branch and tests passed)
```

### Phase Behavior by Event Type

**Pull Request to develop**:
- Runs: Change Detection → Testing
- Skips: Versioning, Deployment, Remote Testing, Tagging, Promotion, Release
- Why: PRs only verify code quality, don't version or promote

**Push to develop** (after PR merge):
- Runs: Change Detection → Testing → Versioning → Deployment → Remote Testing → Tagging → Promotion
- Creates: PR from develop to staging
- Why: First branch gets full pipeline and initiates promotion flow

**Push to staging** (after promotion PR merges):
- Runs: Change Detection → Testing → Deployment → Remote Testing → Promotion
- Skips: Versioning (version already set from develop), Tagging (only on initial branch)
- Creates: PR from staging to main
- Why: Middle branches test and deploy but don't re-version

**Push to main** (after promotion PR merges):
- Runs: Change Detection → Testing → Deployment → Remote Testing → Release
- Skips: Promotion (no next branch)
- Creates: GitHub release
- Why: Final branch creates release instead of promoting

### Customizing Phases

You can customize test and deployment logic in the generated workflow:

**Test jobs** - Add your test commands:
```yaml
test-api:
  needs: changes
  if: needs.changes.outputs.api == 'true'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npm install
    - run: npm test -- apps/api  # Your test command
```

**Deploy jobs** - Add your deployment commands:
```yaml
deploy-api:
  needs: [version, changes]
  if: needs.changes.outputs.api == 'true'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: ./deploy-api.sh ${{ needs.version.outputs.version }}
```

**Remote test jobs** - Add your remote testing:
```yaml
remote-test-api:
  needs: [deploy-api, changes]
  if: needs.deploy-api.result == 'success'
  runs-on: ubuntu-latest
  steps:
    - run: curl -f https://api.example.com/health
    - run: npm run test:e2e -- --api-url=https://api.example.com
```

PipeCraft preserves your customizations during regeneration, so you only need to configure these once.

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
