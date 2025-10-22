---
sidebar_position: 8
---

# Version Management

PipeCraft integrates with [release-it](https://github.com/release-it/release-it) to provide automated semantic versioning based on your commit history. This means you don't have to manually decide what version number comes next or remember to update changelog files—PipeCraft handles it based on the nature of your changes.

## Understanding Semantic Versioning

Semantic versioning uses three numbers: major, minor, and patch. A version like `2.4.7` means major version 2, minor version 4, patch version 7. Each number increment has specific meaning:

**Major version** (2.x.x → 3.0.0): Breaking changes that aren't backward compatible. Existing users might need to modify their code to upgrade.

**Minor version** (2.4.x → 2.5.0): New features that are backward compatible. Existing functionality still works, but new capabilities are available.

**Patch version** (2.4.7 → 2.4.8): Bug fixes and small improvements that don't change functionality. Safe to upgrade without any code changes.

PipeCraft determines which number to increment by analyzing your commit messages. This is why conventional commits are so powerful—they turn your commit history into a machine-readable specification of what changed.

## Conventional Commits

A conventional commit looks like this:

```
feat: add user authentication with OAuth
```

The prefix before the colon indicates the type of change. Common types include:

**feat**: A new feature (triggers minor version bump)
```
feat: add dark mode toggle
feat: implement PDF export
feat: support multiple currencies
```

**fix**: A bug fix (triggers patch version bump)
```
fix: resolve memory leak in cache
fix: correct timezone calculation
fix: prevent duplicate submissions
```

**breaking**: A breaking change (triggers major version bump)
```
feat!: redesign API endpoints
fix!: change default sort order
```

Notice the exclamation mark—that signals a breaking change even in a fix or feat commit. You can also indicate breaking changes in the commit body:

```
feat: redesign user preferences system

BREAKING CHANGE: User preferences now use a different storage format.
Existing preference data will need to be migrated.
```

**Other types** (no version bump): Changes that don't affect functionality
```
docs: update installation instructions
chore: upgrade dependencies
style: fix code formatting
refactor: reorganize user service
test: add coverage for edge cases
```

## Setting Up Version Management

When you initialize PipeCraft, version management is enabled by default. Your configuration includes versioning settings:

```json
{
  "versioning": {
    "enabled": true,
    "releaseItConfig": ".release-it.cjs",
    "conventionalCommits": true,
    "autoTag": true,
    "autoPush": true,
    "changelog": true
  },
  "semver": {
    "bumpRules": {
      "feat": "minor",
      "fix": "patch",
      "breaking": "major"
    }
  }
}
```

PipeCraft uses release-it under the hood, which means you need a release-it configuration file. If you don't have one, create `.release-it.cjs` in your project root:

```javascript
module.exports = {
  git: {
    requireBranch: 'main',
    commitMessage: 'chore: release v${version}',
    tagName: 'v${version}',
  },
  github: {
    release: true,
  },
  npm: {
    publish: false,  // Set to true if you're publishing to npm
  },
  plugins: {
    '@release-it/conventional-changelog': {
      preset: 'angular',
      infile: 'CHANGELOG.md',
    },
  },
};
```

This configuration tells release-it to:
- Create version commits and tags on the main branch
- Use conventional changelog format
- Create GitHub releases
- Skip npm publishing (you can enable this if you're publishing packages)

## Checking Version Information

Before making any changes, you can check what version you're currently on and what version would come next based on your commits:

```bash
pipecraft version --check
```

This analyzes your commit history since the last version tag and shows:
- Your current version (from package.json)
- What the next version would be
- Which commits would be included
- Whether your commits follow conventional format

Example output:

```
📦 Current version: 1.4.2
📦 Next version: 1.5.0 (minor)
📝 Changes since last version:
   - feat: add search filters (minor bump)
   - feat: implement pagination (minor bump)
   - fix: resolve sort order bug (patch bump)
   - docs: update README (no bump)

📝 Conventional commits: ✅ Valid
```

The preview shows that you have two feature commits and one fix commit. Features trigger minor bumps, so your next version will be 1.5.0. If you only had fix commits, it would be 1.4.3.

## Bumping Versions

When you're ready to create a new version, the bump command handles everything:

```bash
pipecraft version --bump
```

This command:
1. Analyzes your commit history since the last version tag
2. Determines the appropriate version number based on your bump rules
3. Updates the version field in package.json
4. Creates a git commit with the version change
5. Creates a git tag with the version number
6. Optionally generates changelog entries

The commit message will be something like `chore: release v1.5.0`, and the tag will be `v1.5.0`. If you have auto-push enabled in your configuration, these get pushed to your remote repository automatically.

## Creating Releases

For a complete release with changelog generation and GitHub release creation, use:

```bash
pipecraft version --release
```

This runs the full release-it flow, which includes everything that `--bump` does plus:
- Generates or updates your CHANGELOG.md file
- Creates a GitHub release with release notes
- Runs any hooks defined in your release-it config
- Handles npm publishing if configured

The changelog generation groups commits by type:

```markdown
## [1.5.0] - 2024-01-15

### Features
- add search filters
- implement pagination

### Bug Fixes
- resolve sort order bug
```

## Automatic Version Bumping in Workflows

When PipeCraft generates your workflows, it includes version bumping steps that run automatically when code reaches your final branch (typically `main` or `production`):

```yaml
- name: Bump version
  if: github.ref == 'refs/heads/main'
  run: npx pipecraft version --bump
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

This means you don't manually run version commands at all in most cases—they happen automatically as part of your branch promotion flow. When you merge code to main, the workflow bumps the version, creates the tag, and pushes everything.

## Customizing Bump Rules

The default bump rules follow conventional commit standards, but you can customize them in your configuration. For example, during early development (pre-1.0), you might want all features to bump the major version:

```json
{
  "semver": {
    "bumpRules": {
      "feat": "major",
      "fix": "minor",
      "breaking": "major"
    }
  }
}
```

Or if you're working on a stable project where any feature warrants a major version bump:

```json
{
  "semver": {
    "bumpRules": {
      "feat": "major",
      "fix": "patch",
      "breaking": "major"
    }
  }
}
```

## Migrating from Manual Versioning

If you're currently managing versions manually, transitioning to automated versioning requires some initial setup:

### Step 1: Tag Your Current Version

First, ensure your current version in package.json has a corresponding git tag:

```bash
# If your package.json says version 1.2.3
git tag v1.2.3
git push origin v1.2.3
```

This gives PipeCraft a starting point for analyzing commit history.

### Step 2: Adopt Conventional Commits

Start using conventional commit messages for all new commits. You don't need to rewrite history—just start from your next commit:

```bash
git commit -m "feat: add new feature"  # Not just "add new feature"
git commit -m "fix: resolve bug"       # Not just "bug fix"
```

### Step 3: Enable Versioning in PipeCraft

Update your `.pipecraftrc.json` to enable versioning if it isn't already:

```json
{
  "versioning": {
    "enabled": true,
    "conventionalCommits": true
  }
}
```

### Step 4: Generate Updated Workflows

Regenerate your workflows to include version management steps:

```bash
pipecraft generate
```

### Step 5: Test the Process

Before relying on automatic versioning in production, test it:

```bash
# Create a feature branch
git checkout -b test-versioning

# Make some conventional commits
git commit --allow-empty -m "feat: test version bumping"
git commit --allow-empty -m "fix: test patch bump"

# Check what version would result
pipecraft version --check

# If it looks right, try bumping
pipecraft version --bump

# Clean up
git tag -d v1.2.4  # or whatever version was created
git checkout main
git branch -D test-versioning
```

## Troubleshooting Version Management

### Version Not Bumping

If your workflows run but versions don't change, check:

**Commit format**: Run `pipecraft version --check` to see if your commits are valid conventional commits. The command will show which commits don't follow the format.

**Bump rules**: Verify your `semver.bumpRules` include the commit types you're using. If you're making `chore` commits and wondering why version doesn't bump, that's expected—chore commits don't trigger bumps.

**Git tags**: Ensure you have at least one version tag. PipeCraft can't determine "next version" without knowing the current version.

```bash
git tag v1.0.0  # Create initial tag if none exists
git push origin v1.0.0
```

### Changelog Not Generating

If version bumps work but changelog doesn't update:

**Release-it plugin**: Verify you have `@release-it/conventional-changelog` installed:

```bash
npm install --save-dev @release-it/conventional-changelog
```

**Configuration**: Check that your `.release-it.cjs` includes the conventional-changelog plugin:

```javascript
plugins: {
  '@release-it/conventional-changelog': {
    preset: 'angular',
    infile: 'CHANGELOG.md',
  },
}
```

**Changelog setting**: Ensure your PipeCraft config has `changelog: true`:

```json
{
  "versioning": {
    "changelog": true
  }
}
```

### Wrong Version Number

If versions bump but to unexpected numbers:

**Check your commits**: Use `pipecraft version --check` to see which commits are being analyzed and what bump each one triggers.

**Review bump rules**: Your `semver.bumpRules` might not match your intentions. Remember that the highest bump wins—if you have both feat and fix commits, the minor bump from feat takes precedence over the patch bump from fix.

**Look for breaking changes**: Make sure you're not accidentally including breaking change indicators. A single `!` or `BREAKING CHANGE:` in any commit triggers a major bump.

### Conflicts with Existing Tags

If you have existing tags that don't follow semantic versioning:

**Filter tags**: Configure release-it to only consider tags matching a pattern:

```javascript
git: {
  tagMatch: 'v[0-9]*',  // Only match tags like v1.0.0
}
```

**Clean up**: Remove tags that conflict with your versioning scheme:

```bash
git tag -d old-tag-name
git push origin :refs/tags/old-tag-name
```

## Best Practices

**Commit atomically**: Make each commit represent a single logical change. This makes it easier to write accurate commit messages and produces more useful changelogs.

**Write clear descriptions**: The commit message body helps future maintainers understand why a change was made:

```
feat: add OAuth authentication

Users can now log in using their GitHub accounts, reducing friction
during signup and eliminating the need to remember another password.
```

**Use breaking changes carefully**: Major version bumps signal significant changes to users. Only mark commits as breaking when they genuinely break backward compatibility.

**Review before release**: Run `pipecraft version --check` before merging to your final branch. This preview helps catch mistakes before they're permanent.

**Tag releases consistently**: Always use the same format for version tags. PipeCraft expects `v1.2.3` format by default.

For more details on how versioning integrates with your workflows, see [Workflow Generation](workflow-generation.md). For configuring bump rules and versioning options, see [Configuration Reference](configuration-reference.md).
