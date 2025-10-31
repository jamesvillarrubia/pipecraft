# Trunk Flow

PipeCraft implements a **promote-on-merge trunk-based workflow** with automatic branch-to-branch promotion. This is the default and currently the only supported flow pattern.

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
    "staging": true, // Auto-merge develop → staging PRs
    "main": false // Manual approval for staging → main
  },
  "mergeMethod": {
    "staging": "squash", // Squash commits when promoting to staging
    "main": "merge" // Create merge commit when promoting to main
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

PipeCraft generates a single comprehensive workflow file that handles all stages of the trunk-based flow. The workflow is divided into distinct phases:

### Workflow Phases

```yaml
name: Pipeline

on:
  workflow_dispatch: # Manual trigger
  workflow_call: # Called by other workflows
  push:
    branches: [develop, staging, main]
  pull_request:
    branches: [develop]

jobs:
  # Phase 1: Change Detection (Managed by PipeCraft)
  changes:
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/detect-changes
    outputs:
      domain1: ${{ steps.detect.outputs.domain1 }}
      domain2: ${{ steps.detect.outputs.domain2 }}

  # Phase 2: Testing (Customizable)
  test-domain1:
    needs: changes
    if: needs.changes.outputs.domain1 == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: npm test -- packages/domain1

  test-domain2:
    needs: changes
    if: needs.changes.outputs.domain2 == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: npm test -- packages/domain2

  # Phase 3: Versioning (Managed by PipeCraft)
  version:
    needs: [changes, test-domain1, test-domain2]
    if: github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/calculate-version
    outputs:
      version: ${{ steps.version.outputs.version }}

  # Phase 4: Deployment (Customizable)
  deploy-domain1:
    needs: [version, changes]
    if: needs.changes.outputs.domain1 == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: npm run deploy -- packages/domain1

  # Phase 5: Remote Testing (Customizable)
  remote-test-domain1:
    needs: [deploy-domain1]
    if: needs.deploy-domain1.result == 'success'
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:remote -- packages/domain1

  # Phase 6: Tagging (Managed by PipeCraft)
  tag:
    needs: [version, deploy-domain1, remote-test-domain1]
    if: |
      github.ref_name == 'develop' &&
      needs.version.outputs.version != ''
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/create-tag
        with:
          version: ${{ needs.version.outputs.version }}

  # Phase 7: Promotion (Managed by PipeCraft)
  promote:
    needs: [version, tag]
    if: |
      needs.version.outputs.version != '' &&
      (github.ref_name == 'develop' || github.ref_name == 'staging')
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/promote-branch
        with:
          sourceBranch: ${{ github.ref_name }}
          version: ${{ needs.version.outputs.version }}

  # Phase 8: Release (Managed by PipeCraft)
  release:
    needs: [version, tag]
    if: |
      github.ref_name == 'main' &&
      needs.version.outputs.version != ''
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/create-release
        with:
          version: ${{ needs.version.outputs.version }}
```

### What You Can Customize

PipeCraft manages the workflow structure, but you can customize:

- **Test jobs** (`test-*`): Add your testing commands
- **Deploy jobs** (`deploy-*`): Add your deployment commands
- **Remote test jobs** (`remote-test-*`): Add integration/E2E tests
- **Workflow name**: Change the workflow display name

### What PipeCraft Manages

These sections are automatically generated and should not be modified:

- **Workflow triggers**: Push, PR, and workflow_dispatch events
- **Changes detection**: Domain-based change detection logic
- **Versioning**: Semantic version calculation from commits
- **Tagging**: Git tag creation on develop branch
- **Promotion**: Branch-to-branch promotion logic
- **Release**: GitHub release creation on main branch
- **Job dependencies**: Conditional logic and job ordering

## Promotion Mechanism

### How Promotions Work

PipeCraft uses **workflow dispatch** to trigger promotions between branches:

1. **Version Calculation**: On `develop`, calculate semantic version from commits
2. **Tagging**: Create a git tag with the version on `develop`
3. **Promote**: Trigger the next branch's workflow via `workflow_dispatch`
4. **Pass Context**: Version and run number are passed to maintain traceability
5. **Next Stage**: The target branch (`staging` or `main`) runs the same workflow with the version context

### Promotion Flow

```
develop (push)
  ↓
  tests pass
  ↓
  version calculated
  ↓
  tag created on develop
  ↓
  promote job triggers staging workflow
  ↓
staging (workflow_dispatch)
  ↓
  tests run with develop's commitSha
  ↓
  promote job triggers main workflow
  ↓
main (workflow_dispatch)
  ↓
  tests run with develop's commitSha
  ↓
  deploy & release created
```

### Key Features

- **Version Gating**: Only commits that bump the version trigger promotions
- **Commit SHA Tracking**: The same commit SHA is tested across all branches
- **Traceability**: Original run number and version are passed through all stages
- **Idempotent**: Re-running the same version on a branch is safe

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
