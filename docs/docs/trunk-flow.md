# Current Trunk Flow Implementation

> **Status**: This document describes the ONE working trunk-based flow currently implemented in PipeCraft.
> For planned future enhancements, see [TRUNK_FLOW_PLAN.md](https://github.com/jamesvillarrubia/pipecraft/blob/main/TRUNK_FLOW_PLAN.md).

## Overview

PipeCraft currently implements a **simple promote-on-merge trunk-based workflow** with automatic branch-to-branch promotion. Code flows from an initial branch (typically `develop`) through intermediate branches (typically `staging`) to a final branch (typically `main`).

## Current Implementation

### Branch Flow

```
feature → develop → staging → main
          ↓         ↓          ↓
        [tests]  [tests +   [deploy]
                  version]
```

### How It Works

1. **Feature Development**
   - Developers create feature branches from `develop`
   - Feature branches merge into `develop` via pull request
   - Merge triggers workflow on `develop`

2. **Develop Branch**
   - On merge to `develop`:
     - Run tests for all affected domains
     - If tests pass, create PR to promote to `staging`
   - Promotion happens via PR (not direct push)

3. **Staging Branch**
   - On merge to `staging`:
     - Run tests for all affected domains
     - Calculate next semantic version (optional)
     - Create git tag (optional)
     - If tests pass, create PR to promote to `main`

4. **Main Branch**
   - On merge to `main`:
     - Run deployment jobs
     - Represents current production state

### Key Configuration Options

#### Basic Configuration

```json
{
  "ciProvider": "github",
  "mergeStrategy": "fast-forward",
  "initialBranch": "develop",
  "finalBranch": "main",
  "branchFlow": ["develop", "staging", "main"]
}
```

#### Auto-Merge Configuration

```json
{
  "autoMerge": {
    "staging": true,  // Auto-merge develop → staging PRs
    "main": false     // Manual approval for staging → main
  },
  "mergeMethod": {
    "staging": "squash",  // Squash commits when promoting to staging
    "main": "merge"       // Create merge commit when promoting to main
  }
}
```

**Auto-Merge Behavior**:
- When `autoMerge` is `true` for a branch, PRs targeting that branch are automatically merged after checks pass
- When `false`, PRs require manual approval
- Typically used for automated promote-to-staging, manual promote-to-production


### Domain-Based Testing

PipeCraft implements path-based change detection for monorepo support:

```json
{
  "domains": {
    "api": {
      "paths": ["packages/api/**", "libs/shared/**"],
      "description": "Backend API services",
      "testable": true,
      "deployable": true
    },
    "web": {
      "paths": ["packages/web/**", "libs/shared/**"],
      "description": "Frontend web application",
      "testable": true,
      "deployable": true
    }
  }
}
```

**How It Works**:
1. Workflow runs `detect-changes` action
2. Compares current commit with base branch
3. Matches changed files against domain path patterns
4. Sets outputs: `api-changed`, `web-changed`, etc.
5. Downstream jobs use `needs.detect-changes.outputs.{domain}-changed`
6. Only run tests/deploys for domains that changed

## Generated Workflow Structure

### Pipeline Jobs

```yaml
name: Pipeline

on:
  push:
    branches: [develop, staging, main]
  pull_request:
    branches: [develop, staging, main]

jobs:
  # 1. Change Detection
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      api-changed: ${{ steps.detect.outputs.api }}
      web-changed: ${{ steps.detect.outputs.web }}
    steps:
      - uses: ./.github/actions/detect-changes
        with:
          domains: |
            api: packages/api/**,libs/shared/**
            web: packages/web/**,libs/shared/**

  # 2. Domain Tests (run in parallel)
  test-api:
    needs: detect-changes
    if: needs.detect-changes.outputs.api-changed == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: npm test -- packages/api

  test-web:
    needs: detect-changes
    if: needs.detect-changes.outputs.web-changed == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: npm test -- packages/web

  # 3. Promotion Logic
  promote-to-staging:
    needs: [test-api, test-web]
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/create-pr
        with:
          source-branch: develop
          target-branch: staging
          auto-merge: true
          merge-method: squash

  promote-to-main:
    needs: [test-api, test-web]
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/calculate-version  # Optional
      - uses: ./.github/actions/create-tag         # Optional
      - uses: ./.github/actions/create-pr
        with:
          source-branch: staging
          target-branch: main
          auto-merge: false  # Manual approval required
          merge-method: merge

  # 4. Deployment
  deploy-api:
    needs: [test-api]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: npm run deploy:api

  deploy-web:
    needs: [test-web]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: npm run deploy:web
```

## Promotion Mechanism

### How Promotions Work

1. **Trigger**: Code merges to source branch (e.g., `develop`)
2. **Test**: Run all relevant tests
3. **Create PR**: If tests pass, create PR from source to target branch
4. **Auto-Merge** (optional): If configured, automatically merge PR after checks
5. **Trigger Next Stage**: PR merge triggers workflow on target branch

### Why PRs Instead of Direct Push?

**GitHub Token Limitation**: Pushes made with `GITHUB_TOKEN` do NOT trigger workflows.

```bash
# ❌ This does NOT trigger workflows
git push origin staging  # Using GITHUB_TOKEN
# Result: staging is updated, but no workflow runs!

# ✅ This DOES trigger workflows
Create PR → Merge PR (even with bot)
# Result: PR merge triggers workflow naturally!
```

**Key Insight**: PR merges (including auto-merges) DO trigger workflows, even with `GITHUB_TOKEN`.

Therefore, **all promotions MUST use PRs** for reliable workflow triggering.

### Auto-Merge Settings

Configure per-branch to control automation level:

```json
{
  "autoMerge": {
    "staging": true,    // Fully automated develop → staging
    "main": false       // Manual approval for staging → main
  }
}
```

**Typical Usage**:
- `staging: true` - Low-risk staging environment, auto-promote for fast feedback
- `main: false` - High-risk production, require human approval

## Semantic Versioning (Optional)

When `versioning.enabled: true`:

### Version Calculation

1. Workflow runs on `staging` merge
2. `calculate-version` action runs:
   - Reads conventional commits since last tag
   - Determines bump level (major, minor, patch) from commit types
   - Calculates next version
3. `create-tag` action creates git tag
4. Tag pushed to repository

### Conventional Commit Mapping

```
feat: something       → minor bump (1.0.0 → 1.1.0)
fix: something        → patch bump (1.0.0 → 1.0.1)
BREAKING CHANGE:      → major bump (1.0.0 → 2.0.0)
chore: something      → no bump (ignored)
```

### Configuration

```json
{
  "versioning": {
    "enabled": true,
    "conventionalCommits": true,
    "autoTag": true,
    "changelog": true,
    "bumpRules": {
      "feat": "minor",
      "fix": "patch",
      "breaking": "major",
      "chore": "patch"
    }
  }
}
```

## Idempotent Regeneration

PipeCraft only regenerates workflows when necessary:

### What Triggers Regeneration?

- Configuration file (`.pipecraftrc.json`) changes
- Template files change (if developing PipeCraft itself)
- Explicit `--force` flag

### What Doesn't Trigger Regeneration?

- Application code changes
- Test file changes
- Documentation changes
- Any change outside config/templates

### How It Works

```bash
# First run
$ pipecraft generate
✓ Generating workflows...
✓ Created .github/workflows/pipeline.yml
✓ Cache updated

# Second run (unchanged config)
$ pipecraft generate
✓ No changes detected, skipping regeneration

# Force regeneration
$ pipecraft generate --force
✓ Force regeneration enabled
✓ Generating workflows...
```

## User Comment Preservation

PipeCraft preserves user comments when regenerating:

### What Gets Preserved?

```yaml
# This is a user comment - PRESERVED
name: Pipeline

# PIPECRAFT-MANAGED: This section is managed
jobs:
  test-api:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
      # User comment within job - PRESERVED
```

### What Gets Overwritten?

```yaml
jobs:
  # PIPECRAFT-MANAGED: detect-changes
  detect-changes:
    # This comment is within a managed block - OVERWRITTEN
    runs-on: ubuntu-latest
```

### Best Practices

1. Add user comments OUTSIDE PipeCraft-managed blocks
2. Look for `# PIPECRAFT-MANAGED` markers
3. Don't modify jobs with PIPECRAFT markers
4. Add custom jobs after PipeCraft-managed jobs

## Limitations & Constraints

### Current Limitations

1. **Single Flow Pattern**: Only supports the promote-through-branches pattern
2. **GitHub Only**: GitLab support is planned but not implemented
3. **No Manual Gates**: Can't require manual approval mid-workflow (only at PR level)
4. **No Matrix Builds**: Can't test across multiple Node versions/OSes automatically
5. **Linear Branch Flow**: Must be linear (A → B → C), no branching/rejoining

### GitHub API Requirements

The following GitHub settings must be configured (can use `pipecraft setup`):

- **Branch Protection**: Require status checks before merging
- **Workflow Permissions**: Allow workflow to create PRs
- **Auto-Merge**: Enable auto-merge for the repository

### Git Workflow Constraints

- **Fast-Forward Strategy**: Requires linear history (rebase before merge)
- **Conventional Commits**: Required if versioning is enabled
- **Tag Format**: Must be `vX.Y.Z` for version detection

## Configuration Examples

### Minimal Configuration

```json
{
  "ciProvider": "github",
  "mergeStrategy": "fast-forward",
  "requireConventionalCommits": false,
  "initialBranch": "develop",
  "finalBranch": "main",
  "branchFlow": ["develop", "main"],
  "semver": {
    "bumpRules": {}
  },
  "domains": {
    "app": {
      "paths": ["src/**"],
      "description": "Application code",
      "testable": true,
      "deployable": true
    }
  }
}
```

### Full Configuration with Versioning

```json
{
  "ciProvider": "github",
  "mergeStrategy": "fast-forward",
  "requireConventionalCommits": true,
  "initialBranch": "develop",
  "finalBranch": "main",
  "branchFlow": ["develop", "staging", "main"],
  "autoMerge": {
    "staging": true,
    "main": false
  },
  "mergeMethod": {
    "staging": "squash",
    "main": "merge"
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
      "paths": ["packages/api/**", "libs/shared/**"],
      "description": "Backend API",
      "testable": true,
      "deployable": true
    },
    "web": {
      "paths": ["packages/web/**", "libs/shared/**"],
      "description": "Frontend",
      "testable": true,
      "deployable": true
    }
  },
  "versioning": {
    "enabled": true,
    "conventionalCommits": true,
    "autoTag": true,
    "changelog": true
  },
  "rebuild": {
    "enabled": true,
    "skipIfUnchanged": true
  }
}
```

## Troubleshooting

### Workflows Not Running

**Symptom**: Merge to develop/staging doesn't trigger workflow

**Causes**:
1. Workflow file not in `.github/workflows/`
2. Branch name mismatch in configuration
3. GitHub Actions disabled for repository
4. Workflow file has syntax errors

**Solutions**:
```bash
# Verify workflow exists
ls -la .github/workflows/

# Validate workflow syntax
pipecraft validate

# Check branch names
git branch --show-current
# Should match one of branchFlow values
```

### Auto-Merge Not Working

**Symptom**: PRs created but not automatically merged

**Causes**:
1. Auto-merge not enabled in repo settings
2. Branch protection rules blocking
3. Required checks not passing
4. Insufficient permissions

**Solutions**:
```bash
# Setup GitHub permissions
pipecraft setup

# Check PR status
gh pr status

# Enable auto-merge manually
gh pr merge --auto --squash
```

### Version Not Bumping

**Symptom**: Version stays same after staging merge

**Causes**:
1. No conventional commits since last tag
2. All commits are `chore:` or `docs:` (ignored types)
3. Versioning not enabled in config
4. release-it not configured

**Solutions**:
```bash
# Check commit history
git log $(git describe --tags --abbrev=0)..HEAD --oneline

# Verify conventional format
pipecraft validate

# Check versioning config
cat .pipecraftrc.json | jq .versioning
```

## Next Steps

Now that you understand the current implementation:

1. **Try It**: Run `pipecraft init` in your project
2. **Customize**: Edit `.pipecraftrc.json` for your workflow
3. **Review**: Check generated workflows in `.github/workflows/`
4. **Test**: Create a feature branch and merge to see promotion
5. **Monitor**: Watch GitHub Actions to see workflow execution

## Future Enhancements

See [TRUNK_FLOW_PLAN.md](https://github.com/jamesvillarrubia/pipecraft/blob/main/TRUNK_FLOW_PLAN.md) for planned improvements:
- Multiple flow patterns
- GitLab support
- Manual approval gates
- Matrix builds
- Custom action hooks
- Deployment environments

