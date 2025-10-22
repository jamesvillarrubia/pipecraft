# Workflow Generation

When you run `pipecraft generate`, PipeCraft reads your configuration and creates a complete CI/CD pipeline. This guide explains what gets generated and how you can customize it.

## Understanding what gets generated

PipeCraft creates two types of files in your repository:

**The main workflow file** at `.github/workflows/pipeline.yml` contains all the jobs that run when you push code. This includes testing, version calculation, deployments, and branch promotions.

**Composite actions** in `.github/actions/` are reusable pieces of logic that the main workflow calls. These handle things like detecting which files changed, calculating version numbers, and creating git tags.

## How configuration maps to workflows

Your configuration directly controls what workflows get generated. Let's walk through a simple example:

```json
{
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

From this configuration, PipeCraft generates:
- A `test-api` job that runs when files in `packages/api/**` change
- A `deploy-api` job that deploys your API after tests pass
- A `test-web` job that runs when files in `packages/web/**` change
- A `deploy-web` job that deploys your web app after tests pass

The workflow is smart about only running jobs for domains that actually changed. If you modify a file in `packages/api/` but not `packages/web/`, only the API jobs will run. This saves time and money on CI/CD costs.

## Domain-based change detection

PipeCraft's most powerful feature for monorepos is automatic domain-based change detection. This system ensures you only test and deploy the parts of your codebase that actually changed, dramatically reducing CI/CD time and cost for large projects.

### How change detection works

When your workflow runs, the first job uses GitHub's `paths-filter` action to analyze which files changed in the commit or pull request. It compares these changes against the path patterns you defined for each domain in your configuration:

```yaml
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
```

This job outputs boolean values for each domain (api: true/false, web: true/false) that subsequent jobs use to decide whether to run. These outputs are available to all downstream jobs via the `needs` context.

### Conditional job execution

Domain-specific jobs include conditions that reference the change detection outputs:

```yaml
test-api:
  needs: changes
  if: needs.changes.outputs.api == 'true'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Run API tests
      run: npm test --workspace=api
```

The `if: needs.changes.outputs.api == 'true'` condition means this job only runs when API files changed. If you modify only web files, this job is skipped entirely—it doesn't even start a runner, so you don't pay for it.

### Parallel execution

When multiple domains change in a single commit, their jobs run in parallel rather than sequentially. If you change both API and web code, both test suites run simultaneously on separate runners. This is one of the major benefits of domain-based testing—independence.

Here's what the workflow execution looks like in practice:

```
Commit: changes to both packages/api and packages/web
├─ changes job (runs, detects both api and web changed)
├─ test-api job (runs in parallel)
└─ test-web job (runs in parallel)
   └─ deploy-all job (runs after both tests pass)
```

### Shared code and dependencies

A common scenario in monorepos is shared code that multiple domains depend on. You might have a `libs/shared/**` directory with utilities used by both API and web. How do you ensure that changes to shared code trigger tests for all dependent domains?

The solution is to include shared paths in multiple domains:

```json
{
  "domains": {
    "api": {
      "paths": [
        "packages/api/**",
        "libs/shared/**"
      ]
    },
    "web": {
      "paths": [
        "packages/web/**",
        "libs/shared/**"
      ]
    }
  }
}
```

Now when you modify a file in `libs/shared/`, both the api and web domains show as changed, and both test suites run. This is exactly what you want—shared code changes should be validated against all code that depends on them.

### Complete workflow example

Here's a complete generated workflow showing how all these pieces fit together:

```yaml
name: Pipeline

on:
  push:
    branches: [develop, staging, main]
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
      mobile: ${{ steps.changes.outputs.mobile }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: changes
        with:
          filters: |
            api:
              - 'services/api/**'
              - 'libs/shared/**'
            web:
              - 'apps/web/**'
              - 'libs/ui/**'
              - 'libs/shared/**'
            mobile:
              - 'apps/mobile/**'
              - 'libs/mobile-shared/**'
              - 'libs/shared/**'

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
      - run: npm test --workspace=api

  test-web:
    needs: changes
    if: needs.changes.outputs.web == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npm test --workspace=web

  test-mobile:
    needs: changes
    if: needs.changes.outputs.mobile == 'true'
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npm test --workspace=mobile

  all-tests:
    needs: [test-api, test-web, test-mobile]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Check test results
        run: |
          if [[ "${{ needs.test-api.result }}" == "failure" ]] || \
             [[ "${{ needs.test-web.result }}" == "failure" ]] || \
             [[ "${{ needs.test-mobile.result }}" == "failure" ]]; then
            echo "One or more test suites failed"
            exit 1
          fi
          echo "All tests passed"
```

This workflow demonstrates several key patterns:

**Change detection happens first**: The `changes` job always runs and produces outputs for all other jobs to reference.

**Tests run conditionally**: Each test job checks if its domain changed before running. Unchanged domains are skipped.

**Tests run in parallel**: Multiple domains can test simultaneously when all changed.

**Aggregation handles conditional jobs**: The `all-tests` job uses `if: always()` and explicitly checks test results. This ensures it runs even when some test jobs were skipped, and only fails if tests that did run actually failed.

**Shared dependencies work correctly**: Changes to `libs/shared/**` trigger all three test suites because it's included in all three domain path lists.

## Customizing your workflows

The generated workflow files have two types of sections: managed and customizable.

**Managed sections** are marked with `# PIPECRAFT-MANAGED` comments. These sections are controlled by PipeCraft and will be overwritten when you regenerate. They handle the workflow structure, job dependencies, and promotion logic.

**Customizable sections** are where you add your own commands. These are the test and deploy jobs where you specify exactly what commands to run:

```yaml
test-api:
  needs: changes
  if: needs.changes.outputs.api == 'true'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: npm install
    - run: npm test -- packages/api
```

You can modify the steps in these jobs however you need. Want to add code coverage? Use a different Node version? Run integration tests? Just add the steps you need. PipeCraft will preserve your changes when regenerating.

## Safe regeneration

PipeCraft is designed to be regenerated safely. When you run `pipecraft generate` again (perhaps after changing your configuration), it will:

1. Read your existing workflow files
2. Identify which sections are managed vs. customizable
3. Update only the managed sections
4. Preserve all your custom test and deploy commands
5. Keep any comments you've added outside managed sections

This means you can freely add comments, modify test commands, and customize deploy steps without worrying about losing your changes.

## Performance and caching

PipeCraft uses caching to make regeneration fast. It stores a hash of your configuration and template files in `.pipecraft-cache.json`. On subsequent runs, if nothing has changed, it skips regeneration entirely. This makes the command nearly instant when nothing needs updating.

If you need to force regeneration (for example, after updating PipeCraft itself), use the `--force` flag:

```bash
pipecraft generate --force
```

## Next steps

Once your workflows are generated, commit them to your repository:

```bash
git add .github/
git commit -m "chore: add pipecraft workflows"
git push
```

The workflows will start running automatically on your next push or pull request.
