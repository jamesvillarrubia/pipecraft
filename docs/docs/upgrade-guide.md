---
sidebar_position: 11
---

# Upgrade Guide

This guide helps you upgrade PipeCraft to newer versions, detailing breaking changes, migration paths, and new features for each major release.

---

## Current Version: 0.x (Pre-release)

PipeCraft is currently in pre-release (0.x versions). Breaking changes may occur between minor versions until 1.0.0 is released.

### Upgrading to Latest Pre-release

```bash
npm update @jamesvillarrubia/pipecraft
# or
pnpm update @jamesvillarrubia/pipecraft
```

After updating, regenerate your workflows:

```bash
pipecraft generate --force
```

Always review the generated changes before committing.

---

## Upcoming: Version 1.0.0

Version 1.0.0 will be the first stable release. After 1.0.0, PipeCraft will follow [Semantic Versioning](https://semver.org/):

- **Major versions (x.0.0):** Breaking changes
- **Minor versions (0.x.0):** New features, backward compatible
- **Patch versions (0.0.x):** Bug fixes, backward compatible

---

## Version Migration Guides

### From 0.27.x to 0.28.x

**New Features:**
- Nx monorepo integration with sequential pipeline support
- Automatic Nx project detection and affected analysis
- Dynamic targetDefaults extraction from nx.json

**Changes:**
- Added `nxIntegration` configuration option
- Workflow now detects Nx projects automatically

**Migration Steps:**

1. **Update PipeCraft:**
   ```bash
   npm update @jamesvillarrubia/pipecraft
   ```

2. **Enable Nx integration (if using Nx monorepo):**
   ```json
   {
     "nxIntegration": true,
     "branchFlow": ["develop", "staging", "main"]
   }
   ```

3. **Regenerate workflows:**
   ```bash
   pipecraft generate --force
   ```

4. **Test locally:**
   ```bash
   npx nx show projects --affected --base=origin/main
   ```

**Breaking Changes:** None

---

### From 0.26.x to 0.27.x

**New Features:**
- Multi-line YAML formatting for `if:` conditions
- Improved readability of generated workflows

**Changes:**
- Long conditional statements now span multiple lines
- Added `yaml-format-utils.ts` for formatting

**Migration Steps:**

1. **Update PipeCraft:**
   ```bash
   npm update @jamesvillarrubia/pipecraft
   ```

2. **Regenerate workflows:**
   ```bash
   pipecraft generate --force
   ```

3. **Review changes:**
   Check that workflow files now have better-formatted conditionals:
   ```yaml
   # Before (0.26.x)
   if: ${{ github.ref == 'refs/heads/develop' && needs.calculate-version.outputs.bumped == 'true' }}

   # After (0.27.x)
   if: ${{
       github.ref == 'refs/heads/develop' &&
       needs.calculate-version.outputs.bumped == 'true'
     }}
   ```

**Breaking Changes:** None (formatting only)

---

### From 0.25.x to 0.26.x

**New Features:**
- Type-safe YAML manipulation helpers
- Eliminated unsafe `as any` type casts

**Changes:**
- Added `yaml-helpers.ts` utility module
- Improved type safety in workflow generation

**Migration Steps:**

1. **Update PipeCraft:**
   ```bash
   npm update @jamesvillarrubia/pipecraft
   ```

2. **Regenerate workflows:**
   ```bash
   pipecraft generate --force
   ```

**Breaking Changes:** None (internal refactoring only)

---

### From 0.20.x to 0.25.x

**New Features:**
- Comprehensive documentation site (Docusaurus)
- FAQ section with 30+ questions
- Comparison guide with alternatives
- Expanded troubleshooting guide

**Changes:**
- Documentation moved to `docs/` directory
- Added CODE_OF_CONDUCT.md, SECURITY.md, CHANGELOG.md

**Migration Steps:**

1. **Update PipeCraft:**
   ```bash
   npm update @jamesvillarrubia/pipecraft
   ```

2. **View new documentation:**
   Visit the documentation site or run:
   ```bash
   cd docs
   npm install
   npm start
   ```

**Breaking Changes:** None

---

### From 0.15.x to 0.20.x

**New Features:**
- GitHub API integration for PR management
- Automated version tagging
- Branch promotion with merge/rebase strategies

**Changes:**
- Added `promotionStrategy` configuration option
- Enhanced workflow with GitHub CLI commands

**Migration Steps:**

1. **Update PipeCraft:**
   ```bash
   npm update @jamesvillarrubia/pipecraft
   ```

2. **Add promotion strategy to config (optional):**
   ```json
   {
     "promotionStrategy": "merge"
   }
   ```
   Default is "merge". Options: "merge", "rebase", "squash"

3. **Regenerate workflows:**
   ```bash
   pipecraft generate --force
   ```

4. **Ensure GitHub token has correct permissions:**
   Repository Settings → Actions → General → Workflow permissions
   - Select "Read and write permissions"

**Breaking Changes:**
- Workflows now require `contents: write` permission
- GitHub token must have write access for promotions

---

### From 0.10.x to 0.15.x

**New Features:**
- Domain-based testing
- Parallel job execution
- Change detection with path patterns

**Changes:**
- Configuration schema updated to require `domains` array
- Removed `paths` and `testPaths` from root level

**Migration Steps:**

1. **Update PipeCraft:**
   ```bash
   npm update @jamesvillarrubia/pipecraft
   ```

2. **Update configuration format:**
   ```json
   // Old format (0.10.x)
   {
     "branchFlow": ["develop", "staging", "main"],
     "paths": ["src/**"],
     "testPaths": ["tests/**"]
   }

   // New format (0.15.x)
   {
     "branchFlow": ["develop", "staging", "main"],
     "domains": [
       {
         "name": "default",
         "paths": ["src/**"],
         "testPaths": ["tests/**"]
       }
     ]
   }
   ```

3. **Regenerate workflows:**
   ```bash
   pipecraft generate --force
   ```

**Breaking Changes:**
- ⚠️ **Configuration schema changed** - must update `.pipecraftrc.json`
- `paths` and `testPaths` moved into `domains` array
- Each domain must have a unique `name`

---

### From 0.5.x to 0.10.x

**New Features:**
- Semantic versioning based on conventional commits
- Automated version calculation
- Git tag management

**Changes:**
- Added version calculation job to workflows
- Requires conventional commit format

**Migration Steps:**

1. **Update PipeCraft:**
   ```bash
   npm update @jamesvillarrubia/pipecraft
   ```

2. **Create initial version tag:**
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

3. **Regenerate workflows:**
   ```bash
   pipecraft generate --force
   ```

4. **Update commit message format:**
   Start using conventional commits:
   ```bash
   git commit -m "feat: add new feature"
   git commit -m "fix: resolve bug"
   ```

**Breaking Changes:**
- Workflows now expect version tags to exist
- Commit messages must follow conventional format for version bumps

---

### From 0.1.x to 0.5.x

**New Features:**
- Multi-branch trunk-based development flow
- Branch promotion automation
- Workflow templating with Pinion

**Changes:**
- Initial stable workflow generation
- Configuration file standardization

**Migration Steps:**

1. **Update PipeCraft:**
   ```bash
   npm update @jamesvillarrubia/pipecraft
   ```

2. **Create configuration file:**
   ```bash
   pipecraft init
   ```

3. **Review and customize `.pipecraftrc.json`:**
   ```json
   {
     "branchFlow": ["develop", "staging", "main"]
   }
   ```

4. **Generate workflows:**
   ```bash
   pipecraft generate
   ```

**Breaking Changes:**
- Configuration file format standardized
- Must recreate `.pipecraftrc.json` if upgrading from 0.1.x

---

## General Upgrade Best Practices

### 1. Review Changelog First

Always check [CHANGELOG.md](../CHANGELOG.md) before upgrading:
```bash
# View changelog in terminal
cat CHANGELOG.md | less

# Or view on GitHub
open https://github.com/jamesvillarrubia/pipecraft/blob/main/CHANGELOG.md
```

### 2. Test in a Branch

Test upgrades in a feature branch before merging:
```bash
git checkout -b upgrade-pipecraft
npm update @jamesvillarrubia/pipecraft
pipecraft generate --force
git diff .github/workflows/  # Review changes
```

### 3. Backup Current Workflows

Save current workflows before regenerating:
```bash
cp .github/workflows/pipeline.yml .github/workflows/pipeline.yml.backup
pipecraft generate --force
```

### 4. Run Tests Locally

Verify everything works before pushing:
```bash
npm test
npm run build
git add .
git commit -m "chore: upgrade pipecraft to vX.Y.Z"
```

### 5. Monitor First Workflow Run

Watch the first workflow run carefully after upgrading:
```bash
git push
gh run watch
```

### 6. Have a Rollback Plan

If issues occur, you can quickly rollback:
```bash
# Revert to previous version
npm install @jamesvillarrubia/pipecraft@0.27.0

# Restore old workflow
mv .github/workflows/pipeline.yml.backup .github/workflows/pipeline.yml

# Commit and push
git add .
git commit -m "revert: rollback pipecraft upgrade"
git push
```

---

## Version Compatibility Matrix

| PipeCraft Version | Node.js Version | GitHub Actions | Nx Version |
|-------------------|-----------------|----------------|------------|
| 0.28.x            | >= 18.0.0       | >= 3.0.0       | >= 17.0.0  |
| 0.27.x            | >= 18.0.0       | >= 3.0.0       | N/A        |
| 0.26.x            | >= 18.0.0       | >= 3.0.0       | N/A        |
| 0.25.x            | >= 16.0.0       | >= 3.0.0       | N/A        |
| 0.20.x            | >= 16.0.0       | >= 2.0.0       | N/A        |
| 0.15.x            | >= 16.0.0       | >= 2.0.0       | N/A        |
| 0.10.x            | >= 14.0.0       | >= 2.0.0       | N/A        |
| 0.5.x             | >= 14.0.0       | >= 2.0.0       | N/A        |

---

## Breaking Changes Policy

### Pre-1.0.0 (Current)

During pre-release (0.x versions):
- Breaking changes may occur in **minor** versions (0.x.0)
- Check changelog and upgrade guide for each minor version
- Always regenerate workflows after updating

### Post-1.0.0 (Future)

After 1.0.0 release:
- Breaking changes only in **major** versions (x.0.0)
- New features in **minor** versions (0.x.0), backward compatible
- Bug fixes in **patch** versions (0.0.x), backward compatible
- Deprecation warnings for at least one major version before removal

---

## Automated Upgrade Tools

### Using npm-check-updates

Check for available updates:
```bash
npx npm-check-updates @jamesvillarrubia/pipecraft
```

Upgrade to latest version:
```bash
npx npm-check-updates -u @jamesvillarrubia/pipecraft
npm install
```

### Using Dependabot

Enable Dependabot for automatic upgrade PRs:

`.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    allow:
      - dependency-name: "@jamesvillarrubia/pipecraft"
```

### Using Renovate

Configure Renovate for automated upgrades:

`renovate.json`:
```json
{
  "extends": ["config:base"],
  "packageRules": [
    {
      "matchPackageNames": ["@jamesvillarrubia/pipecraft"],
      "groupName": "pipecraft"
    }
  ]
}
```

---

## Getting Help with Upgrades

If you encounter issues during an upgrade:

1. **Check the troubleshooting guide:** [Troubleshooting](./troubleshooting.md)
2. **Search existing issues:** [GitHub Issues](https://github.com/jamesvillarrubia/pipecraft/issues)
3. **Ask in discussions:** [GitHub Discussions](https://github.com/jamesvillarrubia/pipecraft/discussions)
4. **Open a new issue:** Include:
   - Previous version
   - New version
   - Error messages
   - Configuration file (remove secrets)
   - Steps attempted

---

## Stay Updated

Subscribe to release notifications:

1. **Watch repository:** Click "Watch" → "Custom" → "Releases" on [GitHub](https://github.com/jamesvillarrubia/pipecraft)
2. **Follow changelog:** [CHANGELOG.md](../CHANGELOG.md)
3. **Subscribe to RSS:** `https://github.com/jamesvillarrubia/pipecraft/releases.atom`

---

## Downgrading

If you need to downgrade to a previous version:

```bash
# Install specific version
npm install @jamesvillarrubia/pipecraft@0.27.0

# Regenerate workflows with old version
pipecraft generate --force

# Commit changes
git add .
git commit -m "chore: downgrade pipecraft to v0.27.0"
git push
```

**Note:** Always review generated workflow changes before committing.
