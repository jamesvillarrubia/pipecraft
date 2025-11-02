# Promote Branch Action

A GitHub Action for safely promoting code between branches using temporary release branches and pull requests. Supports both automated fast-forward merges and manual approval workflows.

## Features

- **Safe Promotion**: Creates temporary branches for controlled promotions
- **Flexible Merge Strategies**: Auto-merge (fast-forward) or manual approval
- **PR Management**: Automatically creates, tracks, and cleans up PRs
- **Version Tracking**: Integrates with semantic versioning
- **Linear History**: Maintains clean git history with fast-forward merges
- **Audit Trail**: Creates PRs for traceability even with auto-merge
- **Workflow Triggering**: Automatically triggers pipeline on target branch

## Quick Start

```yaml
- name: Promote to Production
  uses: ./.github/actions/promote-branch
  with:
    sourceBranch: staging
    targetBranch: main
    version: v1.2.3
    autoMerge: 'false' # Require manual approval
```

## Inputs

### Required

| Input          | Description                 | Example |
| -------------- | --------------------------- | ------- |
| `targetBranch` | Target branch to promote to | `main`  |

### Optional

| Input               | Description                                   | Default                                  | Example                       |
| ------------------- | --------------------------------------------- | ---------------------------------------- | ----------------------------- |
| `sourceBranch`      | Source branch to promote from                 | `${{ github.ref_name }}`                 | `develop`                     |
| `autoMerge`         | Auto-merge (fast-forward) or require approval | `false`                                  | `true`                        |
| `version`           | Version being promoted                        | Auto-detected from tags                  | `v1.2.3`                      |
| `run_number`        | Original run number for traceability          | `''`                                     | `${{ github.run_number }}`    |
| `tempBranchPattern` | Pattern for temp branch name                  | `release/{source}-to-{target}-{version}` | `promote/{version}`           |
| `token`             | GitHub token for authentication               | `${{ github.token }}`                    | `${{ secrets.GITHUB_TOKEN }}` |

## Outputs

| Output       | Description               | Example                                  |
| ------------ | ------------------------- | ---------------------------------------- |
| `prNumber`   | The created PR number     | `123`                                    |
| `prUrl`      | The created PR URL        | `https://github.com/owner/repo/pull/123` |
| `tempBranch` | The temporary branch name | `release/develop-to-main-1.2.3`          |

## Usage Examples

### Manual Approval (Recommended for Production)

```yaml
name: Promote to Production

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to promote'
        required: true

jobs:
  promote:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Promote to Main
        uses: ./.github/actions/promote-branch
        with:
          sourceBranch: staging
          targetBranch: main
          version: ${{ github.event.inputs.version }}
          autoMerge: 'false'
```

### Automatic Fast-Forward

```yaml
name: Auto-Promote to Staging

on:
  push:
    branches: [develop]
    tags: ['v*']

jobs:
  promote:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Auto-Promote to Staging
        uses: ./.github/actions/promote-branch
        with:
          sourceBranch: develop
          targetBranch: staging
          autoMerge: 'true'
```

### Multi-Environment Flow

```yaml
name: Release Pipeline

on:
  push:
    branches: [develop, staging]

jobs:
  promote:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Determine Target Branch
        id: target
        run: |
          if [ "${{ github.ref_name }}" == "develop" ]; then
            echo "branch=staging" >> $GITHUB_OUTPUT
            echo "auto=true" >> $GITHUB_OUTPUT
          elif [ "${{ github.ref_name }}" == "staging" ]; then
            echo "branch=main" >> $GITHUB_OUTPUT
            echo "auto=false" >> $GITHUB_OUTPUT
          fi

      - name: Promote to Next Environment
        uses: ./.github/actions/promote-branch
        with:
          targetBranch: ${{ steps.target.outputs.branch }}
          autoMerge: ${{ steps.target.outputs.auto }}
```

### Custom Branch Pattern

```yaml
- name: Promote with Custom Branch Pattern
  uses: ./.github/actions/promote-branch
  with:
    sourceBranch: develop
    targetBranch: main
    version: v2.0.0
    tempBranchPattern: 'releases/{version}/{target}'
    # Creates: releases/2.0.0/main
```

## How It Works

### With Manual Approval (`autoMerge: false`)

1. **Create Temp Branch**: Creates a temporary release branch from source
2. **Create PR**: Opens PR from temp branch to target branch
3. **Enable Auto-Merge**: Configures PR for rebase (fast-forward) when approved
4. **Wait for Approval**: Requires manual review and approval
5. **Auto-Complete**: Once approved, GitHub automatically merges and cleans up

### With Auto-Merge (`autoMerge: true`)

1. **Create Temp Branch**: Creates a temporary release branch from source
2. **Create PR**: Opens PR for audit trail
3. **Fast-Forward**: Immediately fast-forwards target to source commit
4. **Trigger Pipeline**: Triggers workflow on target branch
5. **Cleanup**: Closes PR and deletes temp branch

## Version Detection

If no `version` input is provided, the action auto-detects the version:

1. Uses `git describe --tags --abbrev=0` to find the latest tag
2. Falls back to `v0.1.0` if no tags exist

```yaml
- name: Promote with Auto-Detected Version
  uses: ./.github/actions/promote-branch
  with:
    targetBranch: main
    # version is auto-detected from tags
```

## Error Handling

### Cannot Fast-Forward

When branches have diverged (non-linear history):

```
❌ Cannot fast-forward - branches have diverged
Target branch has commits not in source branch
```

**Solution**: Use `autoMerge: false` to require manual merge conflict resolution.

### Branch Already Exists

If a temp branch already exists:

```
⚠️  Temp branch release/develop-to-main-1.2.3 already exists, using existing branch
```

The action reuses the existing branch and checks for an existing PR.

### PR Already Exists

If a PR already exists for the promotion:

```
⚠️  PR already exists: #123
```

The action uses the existing PR instead of creating a duplicate.

## Advanced Usage

### Traceability with Run Numbers

Track which pipeline run triggered the promotion:

```yaml
- name: Promote with Traceability
  uses: ./.github/actions/promote-branch
  with:
    targetBranch: main
    version: ${{ needs.version.outputs.version }}
    run_number: ${{ github.run_number }}
```

The `run_number` is passed to the triggered pipeline workflow for linking back to the original run.

### Custom GitHub Token

Use a custom token for cross-repository workflows:

```yaml
- name: Promote with Custom Token
  uses: ./.github/actions/promote-branch
  with:
    targetBranch: main
    token: ${{ secrets.CUSTOM_PAT }}
```

**Note**: The default `GITHUB_TOKEN` works for most cases. Use a PAT only if you need:

- Cross-repository access
- Workflow triggering (GITHUB_TOKEN pushes don't trigger workflows by default)

### Branch Protection Compatibility

The action works with branch protection rules:

- **Auto-Merge Mode**: Fast-forward must be possible (linear history)
- **Manual Mode**: PR must satisfy all branch protection requirements (reviews, status checks)

```yaml
# Works with protected branches
- name: Promote to Protected Branch
  uses: ./.github/actions/promote-branch
  with:
    targetBranch: main # Protected branch
    autoMerge: 'false' # Requires approval per branch protection
```

## Workflow Integration

### Complete Release Flow

```yaml
name: Release Pipeline

on:
  push:
    branches: [develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test

  version:
    needs: [test]
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.calc.outputs.version }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - id: calc
        run: |
          VERSION=$(git describe --tags --abbrev=0 | sed 's/v//')
          echo "version=v${VERSION}" >> $GITHUB_OUTPUT

  tag:
    needs: [version]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/create-tag
        with:
          version: ${{ needs.version.outputs.version }}

  promote:
    needs: [version, tag]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: ./.github/actions/promote-branch
        with:
          targetBranch: staging
          version: ${{ needs.version.outputs.version }}
          autoMerge: 'true'
```

## Comparison with Other Actions

| Feature             | promote-branch | Manual Git | GitHub Flow | GitLab Flow |
| ------------------- | -------------- | ---------- | ----------- | ----------- |
| Temporary branches  | ✅             | ❌         | ❌          | ✅          |
| PR audit trail      | ✅             | ❌         | ✅          | ✅          |
| Fast-forward option | ✅             | ✅         | ❌          | ❌          |
| Auto-cleanup        | ✅             | ❌         | ✅          | ✅          |
| Linear history      | ✅             | ✅         | ❌          | ❌          |
| Manual approval     | ✅             | ✅         | ✅          | ✅          |

## Troubleshooting

### Promotion Workflow Not Triggered

**Problem**: Pipeline doesn't run on target branch after auto-merge

**Cause**: Default `GITHUB_TOKEN` doesn't trigger workflows on push

**Solution**: The action automatically triggers the pipeline workflow using `gh workflow run`

### Temp Branch Not Deleted

**Problem**: Temporary branch remains after promotion

**Cause**: PR was merged manually before cleanup step

**Solution**: Manually delete with:

```bash
git push origin --delete release/develop-to-main-1.2.3
```

### Fast-Forward Failed

**Problem**: "Cannot fast-forward - branches have diverged"

**Cause**: Target branch has commits not in source branch

**Solutions**:

1. Use `autoMerge: false` for manual merge conflict resolution
2. Rebase or merge target into source before promoting
3. Check if target branch should actually be ahead

## Best Practices

### 1. Use Manual Approval for Production

```yaml
- uses: ./.github/actions/promote-branch
  with:
    targetBranch: main
    autoMerge: 'false' # Safer for production
```

### 2. Auto-Merge for Lower Environments

```yaml
- uses: ./.github/actions/promote-branch
  with:
    targetBranch: staging
    autoMerge: 'true' # Faster for staging
```

### 3. Always Fetch Full History

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0 # Required for proper fast-forward checks
```

### 4. Version from Trusted Source

```yaml
# Good: Version from previous job
version: ${{ needs.version.outputs.version }}

# Avoid: User input without validation
version: ${{ github.event.inputs.version }}
```

### 5. Use Descriptive Branch Patterns

```yaml
# Good: Shows source, target, and version
tempBranchPattern: 'release/{source}-to-{target}-{version}'

# Avoid: Too generic
tempBranchPattern: 'temp-{version}'
```

## FAQ

### Q: Can I promote to multiple branches?

A: No, use multiple action invocations:

```yaml
- uses: ./.github/actions/promote-branch
  with:
    targetBranch: staging
- uses: ./.github/actions/promote-branch
  with:
    targetBranch: qa
```

### Q: Does this work with protected branches?

A: Yes, but requirements vary:

- **Auto-merge**: Must allow fast-forward merges
- **Manual**: Must satisfy all protection rules (reviews, status checks)

### Q: What happens if the temp branch already exists?

A: The action reuses it and checks for an existing PR. If found, it uses the existing PR.

### Q: Can I use this outside PipeCraft?

A: Yes! The action has no PipeCraft dependencies and works in any Git repository.

### Q: How do I rollback a promotion?

A:

1. **Auto-merged**: Revert the merge commit on target branch
2. **Not merged**: Close the PR and delete temp branch

### Q: What's the difference between this and `gh pr create`?

A: This action:

- Creates temporary branches for clean isolation
- Supports fast-forward merges for linear history
- Handles branch promotion logic
- Automatically cleans up after merge
- Triggers workflows on target branch

## Security Considerations

### Token Permissions

Required permissions:

- `contents: write` - Create branches and push
- `pull-requests: write` - Create and merge PRs
- `workflows: write` - Trigger workflows (for auto-merge mode)

```yaml
permissions:
  contents: write
  pull-requests: write
  workflows: write
```

### Branch Protection

Works with branch protection:

- Honors required reviews
- Respects status check requirements
- Follows CODEOWNERS rules

### Audit Trail

Always creates a PR, even with auto-merge, ensuring:

- Visibility into promotions
- Trackable history
- Compliance with change management

## License

This action is part of the PipeCraft project.

## Contributing

Issues and pull requests welcome at the PipeCraft repository.

## Related Actions

- [create-tag](../create-tag) - Create semantic version tags
- [detect-changes](../detect-changes) - Detect changed projects
- [calculate-version](../calculate-version) - Calculate semantic versions
