# Calculate Version Action

A GitHub Action that automatically calculates semantic versions using [release-it](https://github.com/release-it/release-it) and [conventional commits](https://www.conventionalcommits.org/). Determines the next version based on commit messages without creating tags or releases.

## Features

- **Semantic Versioning**: Automatically calculates next version (major.minor.patch)
- **Conventional Commits**: Analyzes commit messages for version bumps
- **Tag Detection**: Reuses existing version tags when present
- **Git History**: Uses full history for accurate versioning
- **No Side Effects**: Only calculates - doesn't create tags or releases
- **Detached HEAD Support**: Works in workflows with specific commit checkouts

## Quick Start

```yaml
- name: Calculate Version
  id: version
  uses: ./actions/calculate-version
  with:
    baseRef: main

- name: Use Version
  run: echo "Next version: ${{ steps.version.outputs.version }}"
```

## Inputs

| Input          | Description                                   | Required | Default |
| -------------- | --------------------------------------------- | -------- | ------- |
| `baseRef`      | Base branch reference for version calculation | No       | `main`  |
| `node-version` | Node.js version to use                        | No       | `24`    |

## Outputs

| Output    | Description                     | Example  |
| --------- | ------------------------------- | -------- |
| `version` | The calculated semantic version | `v1.2.3` |

**Note**: Output will be empty string if no new version is needed.

## How It Works

### 1. Tag Detection

Checks if current commit already has a version tag:

```bash
git tag --points-at HEAD | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$'
```

### 2. Version Calculation

If no tag exists, analyzes conventional commits:

```
feat: add new feature     → minor bump (x.Y.z)
fix: resolve bug          → patch bump (x.y.Z)
feat!: breaking change    → major bump (X.y.z)
BREAKING CHANGE: ...      → major bump (X.y.z)
```

### 3. Output

Returns version with `v` prefix (e.g., `v1.2.3`) or empty string if no changes warrant a release.

## Usage Examples

### Basic Version Calculation

```yaml
jobs:
  version:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.calc.outputs.version }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Required for full git history

      - name: Calculate Version
        id: calc
        uses: ./actions/calculate-version
        with:
          baseRef: main
```

### With Conditional Release

```yaml
jobs:
  version:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.calc.outputs.version }}
      should_release: ${{ steps.check.outputs.should_release }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Calculate Version
        id: calc
        uses: ./actions/calculate-version

      - name: Check if Release Needed
        id: check
        run: |
          if [ -n "${{ steps.calc.outputs.version }}" ]; then
            echo "should_release=true" >> $GITHUB_OUTPUT
            echo "✅ New version: ${{ steps.calc.outputs.version }}"
          else
            echo "should_release=false" >> $GITHUB_OUTPUT
            echo "ℹ️  No new version needed"
          fi

  release:
    needs: [version]
    if: needs.version.outputs.should_release == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Create Release
        run: echo "Releasing ${{ needs.version.outputs.version }}"
```

### With Custom Node Version

```yaml
- name: Calculate Version
  uses: ./actions/calculate-version
  with:
    baseRef: develop
    node-version: '20'
```

### Multi-Branch Version Strategy

```yaml
jobs:
  version:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.calc.outputs.version }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Determine Base Branch
        id: base
        run: |
          # Use different base for different branches
          if [ "${{ github.ref_name }}" == "develop" ]; then
            echo "ref=main" >> $GITHUB_OUTPUT
          elif [ "${{ github.ref_name }}" == "staging" ]; then
            echo "ref=develop" >> $GITHUB_OUTPUT
          else
            echo "ref=main" >> $GITHUB_OUTPUT
          fi

      - name: Calculate Version
        id: calc
        uses: ./actions/calculate-version
        with:
          baseRef: ${{ steps.base.outputs.ref }}
```

## Conventional Commit Examples

The action analyzes commit messages following the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Patch Release (x.y.Z)

```
fix: correct calculation error
perf: improve query performance
refactor: simplify authentication logic
```

### Minor Release (x.Y.z)

```
feat: add user dashboard
feat: implement export functionality
```

### Major Release (X.y.z)

```
feat!: redesign API endpoints
BREAKING CHANGE: remove deprecated methods

fix: correct validation
BREAKING CHANGE: validation now stricter
```

## Version Calculation Logic

The action uses release-it's conventional changelog preset:

1. **Scan commits** since last version tag
2. **Classify changes**:
   - `BREAKING CHANGE` → Major bump
   - `feat:` → Minor bump
   - `fix:`, `perf:`, `refactor:` → Patch bump
   - `docs:`, `style:`, `test:`, `chore:` → No bump
3. **Calculate next version** based on highest priority change
4. **Output result** with `v` prefix

## Error Handling

### No New Version

When no version bump is needed:

```yaml
- name: Calculate Version
  id: version
  uses: ./actions/calculate-version

- name: Handle No Version
  if: steps.version.outputs.version == ''
  run: echo "No new version - skipping release"
```

### Existing Tag

When commit already has a version tag:

```
Found existing tag: v1.2.3
Using old version: v1.2.3
```

The action returns the existing tag without recalculation.

### Detached HEAD

The action automatically handles detached HEAD state:

```
⚠️  In detached HEAD state, creating temporary branch
✅ Created temporary branch: temp-release-it-abc123
```

Release-it requires a branch reference, so the action creates a temporary branch when needed.

## Troubleshooting

### Empty Version Output

**Problem**: Action completes but `version` output is empty

**Causes**:

1. No conventional commits since last tag
2. Only non-version commits (docs, chore, etc.)
3. Commit already has a version tag

**Solution**:

```yaml
- name: Check Version
  run: |
    if [ -z "${{ steps.version.outputs.version }}" ]; then
      echo "ℹ️  No new version needed"
      echo "Recent commits don't warrant a version bump"
    fi
```

### Shallow Clone Error

**Problem**: "fatal: shallow update not allowed"

**Cause**: Insufficient git history

**Solution**: Use `fetch-depth: 0`:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0 # Required for version calculation
```

### Wrong Version Calculated

**Problem**: Version bump is incorrect (e.g., minor instead of major)

**Causes**:

1. Missing `!` in breaking change commit
2. `BREAKING CHANGE:` in body not detected
3. Base branch incorrect

**Solution**: Verify commit format:

```bash
# Major (breaking)
git commit -m "feat!: redesign API"
# or
git commit -m "feat: new feature

BREAKING CHANGE: API endpoints changed"

# Minor (feature)
git commit -m "feat: add dashboard"

# Patch (fix)
git commit -m "fix: correct bug"
```

### Release-it Warnings

**Problem**: npm warnings in action logs

**Expected**: These warnings are filtered from output. Only the version number is returned.

## Integration with Other Actions

### With Create Tag Action

```yaml
jobs:
  version:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.calc.outputs.version }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Calculate Version
        id: calc
        uses: ./actions/calculate-version

  tag:
    needs: [version]
    if: needs.version.outputs.version != ''
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./actions/create-tag
        with:
          version: ${{ needs.version.outputs.version }}
```

### With Promote Branch Action

```yaml
jobs:
  version:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.calc.outputs.version }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Calculate Version
        id: calc
        uses: ./actions/calculate-version

  promote:
    needs: [version]
    if: needs.version.outputs.version != ''
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: ./actions/promote-branch
        with:
          version: ${{ needs.version.outputs.version }}
          targetBranch: main
```

## Best Practices

### 1. Always Use Full Git History

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0 # Critical for accurate versioning
```

### 2. Use Version in Job Outputs

```yaml
jobs:
  version:
    outputs:
      version: ${{ steps.calc.outputs.version }}
    steps:
      - id: calc
        uses: ./actions/calculate-version
```

### 3. Check for Empty Version

```yaml
- name: Calculate Version
  id: version
  uses: ./actions/calculate-version

- name: Verify Version
  run: |
    if [ -z "${{ steps.version.outputs.version }}" ]; then
      echo "No version bump needed"
      exit 0
    fi
    echo "Version: ${{ steps.version.outputs.version }}"
```

### 4. Use Conventional Commits

Train team on commit format:

```bash
# Template
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]

# Examples
feat: add user authentication
fix: resolve memory leak
docs: update API documentation
feat!: change authentication flow
```

### 5. Consistent Base Branch

Use the same base branch across workflows:

```yaml
# All workflows use same baseRef
- uses: ./actions/calculate-version
  with:
    baseRef: main # Consistent across all workflows
```

## FAQ

### Q: Does this action create tags?

A: No, this action only calculates versions. Use the `create-tag` action to actually create tags.

### Q: What if there are no commits since last tag?

A: The output will be an empty string, indicating no new version is needed.

### Q: Can I use this without conventional commits?

A: release-it requires some commit format for analysis. Conventional commits provide the most accurate results.

### Q: What happens if I force push?

A: The action recalculates based on the current git history. Previous calculations are not cached.

### Q: Can I customize the versioning strategy?

A: The action uses release-it's conventional changelog preset. For custom strategies, fork and modify the action.

### Q: How does this differ from GitHub's auto-versioning?

A: This action:

- Uses conventional commits for semantic versioning
- Provides version before creating tags
- Works with any git workflow
- Doesn't create tags/releases automatically

## License

Part of the PipeCraft project.

## Contributing

Issues and pull requests welcome at the PipeCraft repository.

## Related Actions

- [create-tag](../create-tag) - Create and push version tags
- [detect-changes](../detect-changes) - Detect changed projects in monorepos
- [promote-branch](../promote-branch) - Promote releases between branches
- [create-release](../create-release) - Create GitHub releases
