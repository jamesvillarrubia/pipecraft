# Create Tag Action

> **Simple, reliable Git tag creation for your workflows**
>
> Automatically creates and pushes semantic version tags with built-in validation and error handling.

[![Marketplace Ready](https://img.shields.io/badge/marketplace-ready-green.svg)](https://github.com/marketplace)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../../LICENSE)

## Features

- ✅ **Semantic Version Validation**: Ensures tags follow semver format (x.y.z)
- 🏷️ **Configurable Prefix**: Supports custom tag prefixes (v1.0.0, release-1.0.0, etc.)
- 🔒 **Duplicate Detection**: Prevents duplicate tags automatically
- ⚡ **Fast**: Minimal dependencies, pure git operations
- 🎯 **Clear Outputs**: Success status and tag name for downstream jobs
- 📝 **Helpful Logging**: Emoji-enhanced messages for easy debugging

## Quick Start

### Basic Usage

```yaml
- name: Create Version Tag
  uses: ./.github/actions/create-tag
  with:
    version: '1.2.3'
```

### With Custom Prefix

```yaml
- name: Create Release Tag
  uses: ./.github/actions/create-tag
  with:
    version: '1.2.3'
    tag_prefix: 'release-'
  # Creates: release-1.2.3
```

### Without Auto-Push

```yaml
- name: Create Local Tag
  uses: ./.github/actions/create-tag
  with:
    version: '1.2.3'
    push: 'false'
  # Tag created locally only
```

## Inputs

| Input        | Description                          | Required | Default |
| ------------ | ------------------------------------ | -------- | ------- |
| `version`    | Version to tag (with or without 'v') | ✅ Yes   | -       |
| `tag_prefix` | Prefix for the tag                   | ❌ No    | `v`     |
| `push`       | Whether to push the tag to remote    | ❌ No    | `true`  |

### Version Format

The action accepts versions in these formats:

- **With prefix**: `v1.2.3`, `release-1.2.3`
- **Without prefix**: `1.2.3`

**Requirements**:

- Must follow semantic versioning: `MAJOR.MINOR.PATCH`
- Each component must be a number
- No pre-release or build metadata (use separate inputs if needed)

**Examples**:

```yaml
version: '1.0.0' # ✅ Valid
version: 'v1.0.0' # ✅ Valid (v stripped)
version: '1.0' # ❌ Invalid (missing patch)
version: '1.0.0-beta' # ❌ Invalid (no pre-release)
```

### Tag Prefix

Customize the tag prefix to match your naming convention:

```yaml
tag_prefix: 'v' # Default: v1.2.3
tag_prefix: 'release-' # Result: release-1.2.3
tag_prefix: '' # Result: 1.2.3 (no prefix)
tag_prefix: 'prod/' # Result: prod/1.2.3
```

### Push Control

Control whether the tag is pushed to remote:

```yaml
push: 'true' # Default: Create and push
push: 'false' # Create locally only
```

**Use cases for `push: false`**:

- Testing tag creation
- Manual review before push
- Multi-step workflows with conditional push

## Outputs

| Output     | Description                      | Example  |
| ---------- | -------------------------------- | -------- |
| `tag_name` | The created tag name with prefix | `v1.2.3` |
| `success`  | Whether the tag was created      | `true`   |
| -          | (false if tag already exists)    |          |

### Using Outputs

**Conditional downstream steps**:

```yaml
- name: Create Tag
  id: tag
  uses: ./.github/actions/create-tag
  with:
    version: '1.2.3'

- name: Create GitHub Release
  if: steps.tag.outputs.success == 'true'
  run: |
    gh release create ${{ steps.tag.outputs.tag_name }} \
      --title "Release ${{ steps.tag.outputs.tag_name }}" \
      --generate-notes
```

**Pass to other jobs**:

```yaml
jobs:
  tag:
    runs-on: ubuntu-latest
    outputs:
      tag_name: ${{ steps.create-tag.outputs.tag_name }}
      success: ${{ steps.create-tag.outputs.success }}
    steps:
      - uses: actions/checkout@v4
      - id: create-tag
        uses: ./.github/actions/create-tag
        with:
          version: '1.2.3'

  deploy:
    needs: tag
    if: needs.tag.outputs.success == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying ${{ needs.tag.outputs.tag_name }}"
```

## How It Works

### 1. Input Validation

```bash
# Strips prefix if present
v1.2.3 → 1.2.3

# Validates format
1.2.3   ✅ Valid
1.2     ❌ Invalid (missing patch)
1.2.a   ❌ Invalid (not a number)
```

### 2. Git Configuration

```bash
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
```

### 3. Duplicate Check

```bash
git tag -l | grep -q "^${TAG_NAME}$"
```

**If tag exists**:

- Action succeeds (exit 0)
- `success` output = `false`
- Warning logged
- No error thrown

### 4. Tag Creation

```bash
git tag -a "${TAG_NAME}" -m "Release ${TAG_NAME}"
```

**Creates annotated tag** with:

- Tag name: `${PREFIX}${VERSION}`
- Message: `Release ${TAG_NAME}`
- Tagger: github-actions[bot]
- Date: Current timestamp

### 5. Optional Push

```bash
git push origin "${TAG_NAME}"
```

**Only if**:

- Tag creation succeeded
- `push` input is `true` (default)

## Complete Examples

### Release Workflow

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to release (e.g., 1.2.3)'
        required: true

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Create Version Tag
        id: tag
        uses: ./.github/actions/create-tag
        with:
          version: ${{ inputs.version }}

      - name: Create GitHub Release
        if: steps.tag.outputs.success == 'true'
        run: |
          gh release create ${{ steps.tag.outputs.tag_name }} \
            --title "Version ${{ steps.tag.outputs.tag_name }}" \
            --generate-notes
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Handle Duplicate Tag
        if: steps.tag.outputs.success == 'false'
        run: |
          echo "::warning::Tag ${{ steps.tag.outputs.tag_name }} already exists"
          echo "Skipping release creation"
```

### Automated Versioning

```yaml
name: Auto Version

on:
  push:
    branches: [main]

jobs:
  version:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Calculate Version
        id: version
        run: |
          # Get latest tag
          LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
          LATEST_VERSION=${LATEST_TAG#v}

          # Parse and increment patch version
          IFS='.' read -r MAJOR MINOR PATCH <<< "$LATEST_VERSION"
          NEXT_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"

          echo "next_version=$NEXT_VERSION" >> $GITHUB_OUTPUT
          echo "Next version: $NEXT_VERSION"

      - name: Create Tag
        uses: ./.github/actions/create-tag
        with:
          version: ${{ steps.version.outputs.next_version }}
```

### Multi-Environment Tags

```yaml
name: Multi-Environment Deploy

on:
  workflow_dispatch:
    inputs:
      version:
        required: true
      environment:
        required: true
        type: choice
        options:
          - dev
          - staging
          - production

jobs:
  tag-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Create Environment Tag
        id: tag
        uses: ./.github/actions/create-tag
        with:
          version: ${{ inputs.version }}
          tag_prefix: ${{ inputs.environment }}/

      - name: Deploy
        if: steps.tag.outputs.success == 'true'
        run: |
          echo "Deploying ${{ steps.tag.outputs.tag_name }} to ${{ inputs.environment }}"
          # Deployment logic here
```

### Conditional Tagging

```yaml
name: Conditional Tag

on:
  pull_request:
    types: [closed]

jobs:
  tag-if-release:
    if: github.event.pull_request.merged == true && startsWith(github.head_ref, 'release/')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Extract Version from Branch
        id: version
        run: |
          BRANCH="${{ github.head_ref }}"
          VERSION="${BRANCH#release/}"
          echo "version=$VERSION" >> $GITHUB_OUTPUT

      - name: Create Release Tag
        uses: ./.github/actions/create-tag
        with:
          version: ${{ steps.version.outputs.version }}
```

## Error Handling

### Duplicate Tags

**Behavior**: Action succeeds gracefully

```yaml
- name: Create Tag
  id: tag
  uses: ./.github/actions/create-tag
  with:
    version: '1.2.3'
# Output: success = 'false'
# Exit code: 0 (success)
# Log: "⚠️ Tag v1.2.3 already exists"
```

**Check for duplicates**:

```yaml
- name: Handle Duplicate
  if: steps.tag.outputs.success == 'false'
  run: |
    echo "Tag already exists, skipping..."
```

### Invalid Version Format

**Behavior**: Action fails immediately

```yaml
- name: Create Tag
  uses: ./.github/actions/create-tag
  with:
    version: '1.0' # ❌ Invalid

# Exit code: 1 (failure)
# Error: "❌ Version must be in format [v]x.y.z"
# Workflow stops
```

### Missing Version

**Behavior**: Action fails immediately

```yaml
- name: Create Tag
  uses: ./.github/actions/create-tag
  with:
    version: '' # ❌ Empty

# Exit code: 1 (failure)
# Error: "❌ Version is required"
```

### Git Push Failures

If `git push` fails (permissions, network, etc.):

- Tag created locally
- Push step fails
- Workflow stops
- Tag can be pushed manually

**Prevent push issues**:

```yaml
- uses: actions/checkout@v4
  with:
    persist-credentials: true # Ensure git credentials

# Ensure write permissions
permissions:
  contents: write
```

## Best Practices

### 1. Use Semantic Versioning

```yaml
# ✅ Good: Clear meaning
version: '1.0.0' # Major release
version: '1.1.0' # New feature
version: '1.0.1' # Bug fix

# ❌ Bad: No semantic meaning
version: '2024.11.01'
version: '1'
```

### 2. Validate Before Tagging

```yaml
- name: Run Tests
  run: npm test

- name: Build
  run: npm run build

- name: Create Tag (only if tests pass)
  uses: ./.github/actions/create-tag
  with:
    version: '1.2.3'
```

### 3. Use Meaningful Prefixes

```yaml
# Production releases
tag_prefix: 'v'

# Environment-specific
tag_prefix: 'prod/'
tag_prefix: 'staging/'

# Release candidates
tag_prefix: 'rc/'
```

### 4. Check Success in Downstream Jobs

```yaml
- name: Create Tag
  id: tag
  uses: ./.github/actions/create-tag
  with:
    version: '1.2.3'

- name: Critical Step
  if: steps.tag.outputs.success == 'true'
  run: |
    # Only runs if tag was created
    echo "Tag created: ${{ steps.tag.outputs.tag_name }}"
```

### 5. Use Permissions Wisely

```yaml
# Repository level
permissions:
  contents: write # Required for tag creation

# Or job level
jobs:
  tag:
    permissions:
      contents: write
```

## Troubleshooting

### Tag Not Pushed

**Problem**: Tag created locally but not on remote.

**Causes**:

1. **Permissions**: `contents: write` not set
2. **Authentication**: GitHub token not configured
3. **Network**: Temporary connection issue

**Solution**:

```yaml
jobs:
  tag:
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: true

      - uses: ./.github/actions/create-tag
        with:
          version: '1.2.3'
```

### Tag Creation Fails

**Problem**: "fatal: tag '...' already exists"

**Solution**: This shouldn't happen (action checks first), but if it does:

```yaml
- name: Delete Existing Tag (if needed)
  run: |
    git push --delete origin v1.2.3 || true
    git tag -d v1.2.3 || true

- uses: ./.github/actions/create-tag
  with:
    version: '1.2.3'
```

### Version Validation Fails

**Problem**: "❌ Version must be in format [v]x.y.z"

**Solutions**:

```yaml
# ❌ Wrong
version: '1.0'
version: '1.0.0-beta'
version: 'release'

# ✅ Correct
version: '1.0.0'
version: 'v1.0.0' # v is stripped automatically
```

## Advanced Usage

### Dynamic Versioning

```yaml
- name: Generate Version
  id: version
  run: |
    # From package.json
    VERSION=$(jq -r '.version' package.json)

    # From date
    VERSION="$(date +%Y).$(date +%-m).$(date +%-d)"

    # From git commits
    VERSION="1.0.$(git rev-list --count HEAD)"

    echo "version=$VERSION" >> $GITHUB_OUTPUT

- uses: ./.github/actions/create-tag
  with:
    version: ${{ steps.version.outputs.version }}
```

### Pre-Release Tags

```yaml
# Use separate prefix for pre-releases
- name: Create Beta Tag
  uses: ./.github/actions/create-tag
  with:
    version: '1.2.3'
    tag_prefix: 'beta-'
  # Creates: beta-1.2.3
```

### Monorepo Tagging

```yaml
- name: Tag Package
  uses: ./.github/actions/create-tag
  with:
    version: ${{ inputs.version }}
    tag_prefix: '@myorg/mypackage@'
  # Creates: @myorg/mypackage@1.2.3
```

### Rollback Support

```yaml
- name: Create Rollback Tag
  if: failure()
  uses: ./.github/actions/create-tag
  with:
    version: ${{ env.PREVIOUS_VERSION }}
    tag_prefix: 'rollback-'
```

## Comparison with Other Actions

| Feature            | This Action     | actions/create-release | softprops/action-gh-release |
| ------------------ | --------------- | ---------------------- | --------------------------- |
| Tag creation       | ✅ Yes          | ✅ Yes                 | ✅ Yes                      |
| Duplicate handling | ✅ Graceful     | ❌ Fails               | ❌ Fails                    |
| Version validation | ✅ Built-in     | ❌ None                | ❌ None                     |
| Prefix support     | ✅ Configurable | ⚠️ Manual              | ⚠️ Manual                   |
| Lightweight        | ✅ Git only     | ⚠️ GitHub API          | ⚠️ GitHub API               |
| Success output     | ✅ Yes          | ❌ No                  | ❌ No                       |
| Release creation   | ❌ No (focused) | ✅ Yes                 | ✅ Yes                      |
| Asset upload       | ❌ No           | ✅ Yes                 | ✅ Yes                      |

**Use this action when**:

- You want simple, fast tag creation
- You need built-in validation
- You want graceful duplicate handling
- You're handling releases separately

**Use release actions when**:

- You need release notes
- You want to upload assets
- You need GitHub release API features

## FAQ

### Q: Why does the action succeed when a tag already exists?

**A:** This prevents workflow failures in idempotent scenarios. Check `outputs.success` to handle duplicates:

```yaml
if: steps.tag.outputs.success == 'false'
```

### Q: Can I create lightweight tags instead of annotated?

**A:** Not currently. Annotated tags are recommended for releases as they include metadata. File an issue if you need this feature.

### Q: What if I need pre-release versions?

**A:** Use the prefix to differentiate:

```yaml
tag_prefix: 'beta-' # beta-1.2.3
tag_prefix: 'rc/' # rc/1.2.3
```

### Q: How do I delete a tag if needed?

**A:**

```bash
# Delete locally
git tag -d v1.2.3

# Delete remotely
git push --delete origin v1.2.3
```

### Q: Can this action modify existing tags?

**A:** No. Tags are immutable. Delete and recreate if needed.

### Q: Does this work with protected tags?

**A:** If your repository has tag protection rules, ensure the GitHub Actions token has appropriate permissions.

## Contributing

This action is part of the [PipeCraft](https://github.com/jamesvillarrubia/pipecraft) project.

**Found a bug?** [Open an issue](https://github.com/jamesvillarrubia/pipecraft/issues/new)

**Have a feature request?** [Start a discussion](https://github.com/jamesvillarrubia/pipecraft/discussions/new)

**Want to contribute?** See [CONTRIBUTING.md](../../../CONTRIBUTING.md)

## License

MIT License - see [LICENSE](../../../LICENSE) for details

## Related Documentation

- [Action Coupling Matrix](../../../docs/action-coupling-matrix.md) - Analysis of all PipeCraft actions
- [PipeCraft Documentation](../../../docs/) - Full documentation

---

**Made with ❤️ by the PipeCraft team**

🤖 Part of [PipeCraft](https://github.com/jamesvillarrubia/pipecraft) - Automated CI/CD pipeline generation
