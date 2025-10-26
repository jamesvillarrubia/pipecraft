---
sidebar_position: 10
---

# Troubleshooting

When something goes wrong with PipeCraft, this guide will help you diagnose and fix common issues. This guide covers the most common problems users encounter, with specific error messages and step-by-step solutions.

---

## Table of Contents

- [Configuration Errors](#configuration-errors)
- [Workflow Generation Issues](#workflow-generation-issues)
- [GitHub Actions Failures](#github-actions-failures)
- [Change Detection Problems](#change-detection-problems)
- [Version Calculation Issues](#version-calculation-issues)
- [Branch Promotion Failures](#branch-promotion-failures)
- [Permission and Authentication Errors](#permission-and-authentication-errors)
- [Nx Integration Issues](#nx-integration-issues)
- [Performance Problems](#performance-problems)
- [Getting More Help](#getting-more-help)

---

## Configuration Errors

### Error: "Configuration file not found"

**Error message:**
```
Error: Configuration file not found at .pipecraftrc.json
```

**Cause:** PipeCraft requires a configuration file to generate workflows.

**Solution:**
1. Initialize PipeCraft in your repository:
   ```bash
   pipecraft init
   ```

2. If you've placed the config file elsewhere, specify the path:
   ```bash
   pipecraft generate --config path/to/.pipecraftrc.json
   ```

### Error: "Invalid configuration schema"

**Error message:**
```
Error: Configuration validation failed: "branchFlow" must be an array
```

**Cause:** Your configuration file has invalid structure or missing required fields.

**Solution:**
1. Validate your config against the schema. Required fields are:
   ```json
   {
     "branchFlow": ["develop", "staging", "main"],
     "domains": [
       { "name": "api", "paths": ["src/api/**"], "testPaths": ["tests/api/**"] }
     ]
   }
   ```

2. Check for common mistakes:
   - `branchFlow` must be an array with at least 2 branches
   - Each domain must have `name`, `paths`, and `testPaths`
   - Path patterns must be strings, not regex objects

3. Use the verbose flag to see detailed validation errors:
   ```bash
   pipecraft generate --verbose
   ```

### Error: "Duplicate domain names detected"

**Error message:**
```
Error: Domain name "api" appears multiple times in configuration
```

**Cause:** Each domain must have a unique name.

**Solution:**
Rename duplicate domains in your `.pipecraftrc.json`:
```json
{
  "domains": [
    { "name": "api-v1", "paths": ["src/api/v1/**"] },
    { "name": "api-v2", "paths": ["src/api/v2/**"] }
  ]
}
```

### Error: "Branch flow must be linear"

**Error message:**
```
Error: Branch flow must contain unique branches in order
```

**Cause:** Your `branchFlow` array contains duplicate branches or is empty.

**Solution:**
Ensure each branch appears only once:
```json
{
  "branchFlow": ["develop", "staging", "main"]  // ✓ Correct
  // NOT: ["develop", "staging", "develop"]     // ✗ Duplicate
  // NOT: []                                    // ✗ Empty
}
```

---

## Workflow Generation Issues

### Error: "ENOENT: no such file or directory"

**Error message:**
```
Error: ENOENT: no such file or directory, open '.github/workflows/pipeline.yml'
```

**Cause:** The `.github/workflows` directory doesn't exist.

**Solution:**
PipeCraft should create this automatically, but if not:
```bash
mkdir -p .github/workflows
pipecraft generate
```

### Error: "Workflow file exists but differs from generated"

**Error message:**
```
Warning: .github/workflows/pipeline.yml exists and differs from generated content
```

**Cause:** You've manually edited the workflow file, and PipeCraft detected differences.

**Solution:**
1. **If you want to keep your changes:** Back them up first
   ```bash
   cp .github/workflows/pipeline.yml .github/workflows/pipeline.yml.backup
   ```

2. **If you want PipeCraft to regenerate:** Use the `--force` flag
   ```bash
   pipecraft generate --force
   ```

3. **Best practice:** Don't manually edit generated files. Use configuration options instead.

### Regeneration says "No changes detected"

**Error message:**
```
No changes detected in configuration. Skipping regeneration.
```

**Cause:** PipeCraft caches your configuration to avoid unnecessary regeneration.

**Solution:**
Use the `--force` flag to bypass the cache:
```bash
pipecraft generate --force
```

### Error: "Template rendering failed"

**Error message:**
```
Error: Template rendering failed for pipeline.yml
```

**Cause:** Internal error with the template engine, usually due to invalid configuration values.

**Solution:**
1. Check for special characters in domain names (use alphanumeric and hyphens only)
2. Ensure all required fields are present in config
3. Enable verbose mode to see the exact template error:
   ```bash
   pipecraft generate --verbose
   ```

---

## GitHub Actions Failures

### Workflow isn't running at all

**Symptoms:** You push code but don't see any workflow runs in GitHub Actions.

**Debugging steps:**

1. **Check the workflow file exists:**
   ```bash
   ls .github/workflows/pipeline.yml
   ```
   If missing, run `pipecraft generate` to create it.

2. **Verify you've committed and pushed the workflow file:**
   ```bash
   git ls-files .github/workflows/pipeline.yml
   ```
   If not listed, add and commit it:
   ```bash
   git add .github/workflows/pipeline.yml
   git commit -m "chore: add pipecraft workflow"
   git push
   ```

3. **Check your branch matches configuration:**
   ```bash
   # Check current branch
   git branch --show-current

   # Compare with config
   cat .pipecraftrc.json | jq .branchFlow
   ```
   The workflow only runs on branches in your `branchFlow` array.

4. **Verify GitHub Actions is enabled:**
   - Go to repository Settings → Actions → General
   - Ensure "Allow all actions and reusable workflows" is selected
   - Check that Actions aren't disabled for your organization

5. **Check workflow syntax:**
   ```bash
   gh workflow view pipeline.yml
   ```
   If you see syntax errors, regenerate with `pipecraft generate --force`

### Error: "Process completed with exit code 1"

**Error message in GitHub Actions:**
```
Error: Process completed with exit code 1
```

**Cause:** Generic error - need to check job-specific logs.

**Solution:**
1. Click on the failing job to see detailed logs
2. Look for the actual error message (often near the bottom)
3. Common causes:
   - **Tests failing:** Fix the failing tests
   - **Build errors:** Fix compilation/build issues
   - **Missing dependencies:** Ensure `package.json` is up to date
   - **Environment issues:** Check Node version matches your requirements

### Error: "Resource not accessible by integration"

**Error message:**
```
Resource not accessible by integration
```

**Cause:** The `GITHUB_TOKEN` doesn't have required permissions.

**Solution:**
Add permissions to your workflow (PipeCraft should do this automatically):
```yaml
permissions:
  contents: write
  pull-requests: write
```

If still failing, check repository Settings → Actions → General → Workflow permissions:
- Select "Read and write permissions"
- Enable "Allow GitHub Actions to create and approve pull requests"

### Error: "refusing to allow a GitHub App to create or update workflow"

**Error message:**
```
refusing to allow a GitHub App to create or update workflow `.github/workflows/pipeline.yml`
```

**Cause:** GitHub prevents workflows from modifying workflow files for security reasons.

**Solution:**
Don't regenerate the workflow file from within a GitHub Actions run. Generate it locally:
```bash
pipecraft generate
git add .github/workflows/pipeline.yml
git commit -m "chore: update workflow"
git push
```

### Jobs running on wrong branch

**Symptoms:** Jobs execute on branches they shouldn't (e.g., build runs on feature branches).

**Cause:** Workflow trigger conditions too broad.

**Solution:**
Check your workflow's `on:` section. PipeCraft should generate:
```yaml
on:
  push:
    branches:
      - develop
      - staging
      - main
```

If you see `branches: ['**']` or no branch filter, regenerate:
```bash
pipecraft generate --force
```

---

## Change Detection Problems

### No domains detected as changed

**Symptoms:** You've modified files but no domain jobs run.

**Cause:** Changed files don't match any domain's `paths` patterns.

**Solution:**

1. **Check which files changed:**
   ```bash
   git diff --name-only origin/main
   ```

2. **Compare with your domain paths:**
   ```bash
   cat .pipecraftrc.json | jq '.domains[].paths'
   ```

3. **Common mistakes:**
   - Paths are too specific: `src/api/users.ts` won't match pattern `src/api/auth/**`
   - Missing wildcards: Use `src/api/**` not `src/api/`
   - Wrong depth: `**/*.ts` matches all depths, `*/*.ts` matches one level only

4. **Test your patterns locally:**
   ```bash
   # List files that would match a pattern
   git ls-files 'src/api/**'
   ```

5. **Fix by updating patterns:**
   ```json
   {
     "domains": [
       {
         "name": "api",
         "paths": ["src/api/**", "src/shared/**"],  // Add shared files
         "testPaths": ["tests/api/**"]
       }
     ]
   }
   ```

### All domains run even with small changes

**Symptoms:** Every domain job runs on every commit, even when only one file changed.

**Cause:** Overly broad path patterns or changes to shared files.

**Solution:**

1. **Check for overly broad patterns:**
   ```json
   // ✗ Too broad - matches everything
   { "paths": ["**"] }

   // ✓ Specific to domain
   { "paths": ["src/api/**", "src/shared/api/**"] }
   ```

2. **Check for shared file changes:**
   If you changed `package.json`, `tsconfig.json`, or other root files, all domains may run. This is usually correct behavior.

3. **Use more specific patterns:**
   ```json
   {
     "domains": [
       { "name": "api", "paths": ["src/api/**"] },
       { "name": "web", "paths": ["src/web/**"] },
       { "name": "shared", "paths": ["src/shared/**"] }
     ]
   }
   ```

### Nx: Wrong projects detected

**Symptoms:** Nx projects run that shouldn't, or expected projects don't run.

**Cause:** PipeCraft uses `nx show projects --affected` which depends on your `nx.json` configuration.

**Solution:**

1. **Test Nx affected detection locally:**
   ```bash
   npx nx show projects --affected --base=origin/main
   ```

2. **Check your `nx.json` implicit dependencies:**
   ```json
   {
     "implicitDependencies": {
       "package.json": "*",  // All projects affected by package.json changes
       "tsconfig.base.json": "*"
     }
   }
   ```

3. **Verify project dependencies in `project.json`:**
   ```json
   {
     "implicitDependencies": ["shared-lib"]  // Explicitly depend on shared-lib
   }
   ```

4. **Check PipeCraft is using correct base:**
   In the workflow logs, look for:
   ```
   NX_BASE=origin/main npx nx show projects --affected
   ```

---

## Version Calculation Issues

### Version numbers aren't changing

**Symptoms:** You push commits but the version stays the same.

**Cause:** Commits don't follow conventional commit format or don't include version-bumping types.

**Solution:**

1. **Check recent commit messages:**
   ```bash
   git log --oneline -10
   ```

2. **Ensure commits use conventional format:**

   **Commits that bump versions:**
   ```bash
   git commit -m "feat: add new feature"    # Bumps minor (0.1.0 → 0.2.0)
   git commit -m "fix: fix bug"             # Bumps patch (0.1.0 → 0.1.1)
   git commit -m "feat!: breaking change"   # Bumps major (0.1.0 → 1.0.0)
   ```

   **Commits that don't bump versions:**
   ```bash
   git commit -m "chore: update docs"       # No bump
   git commit -m "test: add tests"          # No bump
   git commit -m "refactor: clean code"     # No bump
   git commit -m "docs: update readme"      # No bump
   ```

3. **Amend your last commit if needed:**
   ```bash
   git commit --amend -m "feat: your message"
   git push --force-with-lease
   ```

### Error: "Unable to calculate version"

**Error message:**
```
Error: Unable to calculate version: no git tags found
```

**Cause:** Repository has no version tags yet.

**Solution:**
Create an initial version tag:
```bash
git tag v0.1.0
git push origin v0.1.0
```

PipeCraft will increment from this base version.

### Versions incrementing unexpectedly

**Symptoms:** Version jumps from 1.2.3 to 2.0.0 unexpectedly.

**Cause:** Someone pushed a commit with `!` (breaking change marker).

**Solution:**

1. **Check commit history for breaking changes:**
   ```bash
   git log --grep="!" --oneline
   ```

2. **Breaking changes are indicated by:**
   - `feat!:` or `fix!:` prefix
   - `BREAKING CHANGE:` in commit body

3. **If accidental, you can:**
   - Revert the commit
   - Manually create a corrected tag
   - Document the version in CHANGELOG.md

### Version not respecting initial version in config

**Symptoms:** You set `initialVersion: "1.0.0"` but workflow uses `0.1.0`.

**Cause:** A git tag already exists that takes precedence.

**Solution:**

1. **Check existing tags:**
   ```bash
   git tag -l
   ```

2. **If wrong tag exists, delete it:**
   ```bash
   git tag -d v0.1.0
   git push origin :refs/tags/v0.1.0
   ```

3. **Create correct initial tag:**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

---

## Branch Promotion Failures

### Code isn't promoting to the next branch

**Symptoms:** Commits stay on `develop` and don't move to `staging` or `main`.

**Cause:** PipeCraft only promotes commits that bump the version.

**Why:** This is intentional - it ensures only meaningful changes (features and fixes) move through your pipeline, while housekeeping commits stay on the development branch.

**Solution:**

1. **Ensure commits use version-bumping types:**
   ```bash
   git commit -m "feat: enable promotion"    # Will promote
   git commit -m "fix: enable promotion"     # Will promote
   git commit -m "chore: won't promote"      # Won't promote
   ```

2. **Check if version was actually bumped:**
   ```bash
   git tag --sort=-creatordate | head -5
   ```
   A new tag should appear after your commit.

3. **Verify the promotion job ran:**
   Check GitHub Actions logs for `promote-to-<branch>` job.

### Error: "Push protection" or "Branch protection" failures

**Error message:**
```
refusing to allow a GitHub App to create or update workflow
```
or
```
Required status checks must pass before merging
```

**Cause:** Branch protection rules prevent automated pushes.

**Solution:**

1. **Check branch protection settings:**
   - Go to Settings → Branches → Branch protection rules
   - Click "Edit" on your `staging` or `main` branch rule

2. **For automated promotion to work, configure:**
   - ✓ **Do NOT** require pull requests (PipeCraft uses direct pushes)
   - ✓ **Do NOT** require status checks (or make them optional)
   - ✓ **Allow force pushes** if using rebase strategy
   - ✓ **Allow bypass for GitHub Actions** or create a deploy key

3. **Alternative: Use a Personal Access Token (PAT):**
   ```yaml
   # In your workflow
   - uses: actions/checkout@v4
     with:
       token: ${{ secrets.PAT_TOKEN }}
   ```

   Create PAT at: Settings → Developer settings → Personal access tokens → Fine-grained tokens
   - Permissions needed: `Contents: Read and Write`

### Promotion creates merge conflicts

**Error message:**
```
CONFLICT (content): Merge conflict in package.json
error: Failed to merge
```

**Cause:** Target branch has diverged from source branch.

**Solution:**

1. **Understand the branch flow:**
   PipeCraft assumes linear flow: `develop → staging → main`
   Never commit directly to `staging` or `main`.

2. **If conflict exists, manually resolve:**
   ```bash
   git checkout staging
   git merge develop
   # Resolve conflicts
   git add .
   git commit
   git push
   ```

3. **Prevent future conflicts:**
   - Only commit to `develop`
   - Let PipeCraft handle promotion automatically
   - Never manually push to `staging` or `main`

### Promotion job skipped

**Symptoms:** The `promote-to-staging` job shows "Skipped" status.

**Cause:** No version bump occurred, or job conditions weren't met.

**Solution:**

1. **Check the job condition in workflow:**
   ```yaml
   if: needs.calculate-version.outputs.bumped == 'true'
   ```

2. **Verify version was bumped:**
   Check the `calculate-version` job output in GitHub Actions logs.

3. **Ensure you're on the correct branch:**
   Promotion only happens from configured branches (e.g., `develop` → `staging`).

### Double-promotion or skipped stage

**Symptoms:** Code goes from `develop` directly to `main`, skipping `staging`.

**Cause:** Branch flow configuration incorrect or manual intervention.

**Solution:**

1. **Verify branch flow in config:**
   ```json
   {
     "branchFlow": ["develop", "staging", "main"]
   }
   ```
   Order matters! Each stage promotes to the next.

2. **Check workflow trigger configuration:**
   The workflow should only trigger on the specified branches.

3. **Regenerate if needed:**
   ```bash
   pipecraft generate --force
   git add .github/workflows/pipeline.yml
   git commit -m "chore: fix workflow"
   git push
   ```

---

## Permission and Authentication Errors

### Error: "EACCES: permission denied"

**Error message:**
```
EACCES: permission denied, open '.github/workflows/pipeline.yml'
```

**Cause:** File system permissions prevent writing workflow files.

**Solution:**
Set correct permissions:
```bash
chmod 755 .github .github/workflows
chmod 644 .github/workflows/*.yml
pipecraft generate
```

### Error: "fatal: could not read Username"

**Error message in GitHub Actions:**
```
fatal: could not read Username for 'https://github.com': terminal prompts disabled
```

**Cause:** Git operations require authentication but no credentials provided.

**Solution:**

1. **Ensure GITHUB_TOKEN is available:**
   ```yaml
   - uses: actions/checkout@v4
     with:
       token: ${{ secrets.GITHUB_TOKEN }}
   ```

2. **Configure git with token:**
   ```yaml
   - name: Configure Git
     run: |
       git config user.name "github-actions[bot]"
       git config user.email "github-actions[bot]@users.noreply.github.com"
   ```

3. **For cross-repository operations, use PAT:**
   Create a Personal Access Token and add as repository secret.

### Error: "Invalid token"

**Error message:**
```
Error: Invalid token: GITHUB_TOKEN expired or lacks required permissions
```

**Cause:** The GITHUB_TOKEN lacks necessary permissions or has expired.

**Solution:**

1. **Check workflow permissions:**
   ```yaml
   permissions:
     contents: write
     pull-requests: write
   ```

2. **Verify repository settings:**
   - Settings → Actions → General → Workflow permissions
   - Select "Read and write permissions"

3. **For fine-grained control, use PAT:**
   - Create at: Settings → Developer settings → Personal access tokens
   - Grant: `repo` scope
   - Add to repository secrets as `PAT_TOKEN`

### Error: "refusing to allow an OAuth App to create or update workflow"

**Error message:**
```
refusing to allow an OAuth App to create or update workflow
```

**Cause:** Trying to modify workflow files from within a workflow run.

**Solution:**
Don't regenerate workflow files from within GitHub Actions. Generate locally:
```bash
pipecraft generate
git add .github/workflows/pipeline.yml
git commit -m "chore: update workflow"
git push
```

---

## Nx Integration Issues

### Error: "nx: command not found"

**Error message:**
```
nx: command not found
```

**Cause:** Nx isn't installed or not in PATH.

**Solution:**

1. **Install Nx:**
   ```bash
   npm install -D nx
   # or
   pnpm add -D nx
   ```

2. **Or use npx:**
   PipeCraft automatically uses `npx nx` when Nx is in devDependencies.

3. **Verify Nx is installed:**
   ```bash
   npx nx --version
   ```

### Error: "Cannot find project"

**Error message:**
```
Error: Cannot find project 'my-app'
```

**Cause:** Nx project name doesn't match your configuration or project doesn't exist.

**Solution:**

1. **List all Nx projects:**
   ```bash
   npx nx show projects
   ```

2. **Verify project names match your config:**
   If using path-based domains, ensure paths align with Nx project locations.

3. **Check project.json exists:**
   ```bash
   ls apps/my-app/project.json
   # or
   ls libs/my-lib/project.json
   ```

### Nx affected detection not working

**Symptoms:** All projects run every time, or no projects run.

**Cause:** Nx's affected detection depends on proper configuration and git history.

**Solution:**

1. **Check Nx base branch configuration:**
   ```json
   // nx.json
   {
     "affected": {
       "defaultBase": "main"
     }
   }
   ```

2. **Verify git history is available:**
   GitHub Actions needs full history:
   ```yaml
   - uses: actions/checkout@v4
     with:
       fetch-depth: 0  # Fetch full history
   ```

3. **Test locally:**
   ```bash
   npx nx show projects --affected --base=origin/main
   ```

4. **Check PipeCraft is passing correct base:**
   In workflow logs, verify:
   ```
   NX_BASE=origin/main npx nx show projects --affected
   ```

### Nx projects running out of order

**Symptoms:** Dependent projects run before dependencies.

**Cause:** PipeCraft runs projects in parallel by default, without considering Nx task graph.

**Solution:**

1. **For Nx monorepos, ensure sequential mode is used:**
   Check your generated workflow uses proper Nx run commands:
   ```yaml
   npx nx run-many -t build --projects=${{ matrix.project }}
   ```

2. **Or use Nx's built-in orchestration:**
   ```yaml
   npx nx affected -t build --parallel=3
   ```

3. **Verify project dependencies in project.json:**
   ```json
   {
     "implicitDependencies": ["shared-lib"]
   }
   ```

---

## Performance Problems

### Workflows taking too long

**Symptoms:** Workflows run for 30+ minutes on small changes.

**Cause:** Running unnecessary jobs or inefficient change detection.

**Solution:**

1. **Use domain-based or Nx-based change detection:**
   Only run jobs for changed code:
   ```json
   {
     "domains": [
       { "name": "api", "paths": ["src/api/**"] },
       { "name": "web", "paths": ["src/web/**"] }
     ]
   }
   ```

2. **Enable caching:**
   ```yaml
   - uses: actions/setup-node@v4
     with:
       cache: 'npm'  # or 'pnpm', 'yarn'
   ```

3. **Parallelize jobs:**
   PipeCraft does this automatically with matrix strategy.

4. **Skip redundant tests:**
   Use test path patterns to only run relevant tests:
   ```json
   {
     "testPaths": ["tests/api/**"]  // Only run API tests for API changes
   }
   ```

### Actions minutes quota exceeded

**Symptoms:** Workflows stop running with quota error.

**Cause:** Too many workflow runs consuming GitHub Actions minutes.

**Solution:**

1. **Check usage:**
   - Repository Settings → Billing → Actions minutes

2. **Optimize workflow efficiency:**
   - Use change detection to skip unchanged domains
   - Cache dependencies
   - Run tests in parallel

3. **Limit workflow triggers:**
   - Don't trigger on every branch
   - Use path filters:
   ```yaml
   on:
     push:
       branches: [develop, staging, main]
       paths-ignore:
         - '**.md'
         - 'docs/**'
   ```

4. **For large teams, use self-hosted runners:**
   - Free unlimited minutes
   - Requires infrastructure management

### Git operations timing out

**Error message:**
```
fatal: unable to access 'https://github.com/...': Operation timed out
```

**Cause:** Network issues or large repository size.

**Solution:**

1. **Use shallow clone for most jobs:**
   ```yaml
   - uses: actions/checkout@v4
     with:
       fetch-depth: 1  # Shallow clone
   ```

2. **Only fetch full history when needed:**
   ```yaml
   # Only for version calculation or affected detection
   - uses: actions/checkout@v4
     with:
       fetch-depth: 0  # Full history
   ```

3. **Increase git timeout:**
   ```yaml
   - name: Configure git timeout
     run: git config --global http.postBuffer 524288000
   ```

---

## Getting More Help

### Enable verbose logging

If you're stuck, enable verbose output to see what PipeCraft is doing:

```bash
pipecraft generate --verbose
```

This shows detailed information about:
- Configuration loading and validation
- Pre-flight checks
- Template rendering
- File generation decisions

### Check GitHub Actions logs

View workflow execution details:

```bash
# List recent workflow runs
gh run list

# View specific run
gh run view <run-id>

# View logs for specific run
gh run view <run-id> --log

# View logs for a specific job
gh run view <run-id> --log --job=<job-id>

# Watch a run in real-time
gh run watch
```

### Debug workflow locally with act

Test workflows locally before pushing:

```bash
# Install act
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run workflow locally
act push

# Run specific job
act -j build-api

# Use specific event
act -e .github/workflows/test-event.json
```

### Validate YAML syntax

Check workflow file syntax:

```bash
# Using GitHub CLI
gh workflow view pipeline.yml

# Using yamllint
yamllint .github/workflows/pipeline.yml

# Using online validator
# Copy workflow content to: https://www.yamllint.com/
```

### Common debugging patterns

**1. Check current state:**
```bash
# Verify config
cat .pipecraftrc.json | jq .

# Check current branch and tags
git branch --show-current
git tag --sort=-creatordate | head -5

# List workflow files
ls -la .github/workflows/

# View recent commits
git log --oneline -10
```

**2. Reset to known good state:**
```bash
# Regenerate workflows
pipecraft generate --force

# Reset git state
git fetch origin
git reset --hard origin/main

# Clear Actions cache
gh cache list
gh cache delete <cache-id>
```

**3. Test locally before pushing:**
```bash
# Validate config
node -e "JSON.parse(require('fs').readFileSync('.pipecraftrc.json'))"

# Test change detection
git diff --name-only origin/main

# Test Nx affected (if using Nx)
npx nx show projects --affected --base=origin/main

# Run tests locally
npm test
```

### Still stuck?

If you can't resolve the issue, open an issue on GitHub with:

**Required information:**
- PipeCraft version: `pipecraft version`
- Node version: `node --version`
- Operating system
- Repository type (basic repo, Nx monorepo, etc.)

**Configuration:**
- Your `.pipecraftrc.json` (remove any secrets)
- Your `package.json` scripts section

**Error details:**
- Full error message (from CLI or GitHub Actions)
- Screenshots of GitHub Actions failure (if applicable)
- Link to failed workflow run (if public repo)

**Steps to reproduce:**
1. What command did you run?
2. What did you expect to happen?
3. What actually happened?

**Submit to:** [github.com/jamesvillarrubia/pipecraft/issues](https://github.com/jamesvillarrubia/pipecraft/issues)

We'll help you figure it out!

---

## Quick Reference

### Most Common Issues

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| Workflow not running | Branch not in `branchFlow` | Push to configured branch |
| Version not bumping | Non-conventional commit | Use `feat:` or `fix:` prefix |
| Code not promoting | No version bump | Use `feat:` or `fix:` commit |
| All domains running | Broad path patterns | Use specific patterns like `src/api/**` |
| Permission denied | Missing workflow permissions | Add `contents: write` permission |
| Nx command not found | Nx not installed | Run `npm install -D nx` |
| Git auth failing | Missing/invalid token | Check `GITHUB_TOKEN` permissions |
| Workflow syntax error | Manual edits to workflow | Regenerate with `--force` |

### Useful Commands Cheat Sheet

```bash
# Configuration
pipecraft init                    # Initialize new config
pipecraft generate                # Generate workflows
pipecraft generate --force        # Force regeneration
pipecraft generate --verbose      # Verbose output
pipecraft version                 # Show version

# Git debugging
git branch --show-current         # Current branch
git tag --sort=-creatordate       # Recent tags
git log --oneline -10             # Recent commits
git diff --name-only origin/main  # Changed files

# GitHub CLI
gh run list                       # List runs
gh run watch                      # Watch current run
gh workflow view pipeline.yml     # View workflow
gh api repos/:owner/:repo/actions/runs  # API access

# Nx debugging (if applicable)
npx nx show projects              # List projects
npx nx show projects --affected   # Affected projects
npx nx graph                      # Dependency graph
npx nx run-many -t build         # Run task on all

# Testing
npm test                          # Run tests
npm run build                     # Build project
act push                          # Test workflow locally
```
