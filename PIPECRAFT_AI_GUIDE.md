# Pipecraft AI Agent Guide

> A comprehensive reference for AI assistants helping users with Pipecraft CLI setup and usage.

## What is Pipecraft?

**Pipecraft** is a trunk-based development CI/CD workflow generator for GitHub Actions. Instead of writing GitHub Actions YAML manually, users define their project structure in a configuration file (`.pipecraftrc`), and Pipecraft generates complete, production-ready workflows with:

- **Domain-based change detection** - Only run jobs for changed parts of the codebase
- **Semantic versioning** - Automatic version calculation from conventional commits
- **Branch promotion** - Automated flow through develop → staging → main
- **Best practices built-in** - PR title validation, commit enforcement, release management

**Key URLs:**

- Documentation: https://pipecraft.thecraftlab.dev
- GitHub: https://github.com/the-craftlab/pipecraft
- NPM: https://www.npmjs.com/package/pipecraft

**Requirements:** Node.js >= 18.0.0

---

## Quick Start for New Users

### 1. Installation

```bash
# Option A: Use directly with npx (recommended for trying it out)
npx pipecraft init

# Option B: Global installation
npm install -g pipecraft
pipecraft init

# Option C: Local project installation
npm install --save-dev pipecraft
npx pipecraft init
```

### 2. Initialize Configuration

`pipecraft init` prompts. Pass `--yes` to take defaults and never prompt — required in CI,
scripts, and when an agent is driving. It also skips prompting when stdin is not a TTY.

```bash
pipecraft init
```

This creates `.pipecraftrc` with sensible defaults. Edit it to match your project structure.

### 3. Generate Workflows

```bash
pipecraft validate   # Check your configuration
pipecraft generate   # Generate GitHub Actions workflows
```

### 4. Set Up Repository

```bash
pipecraft setup         # Create branches from branchFlow
pipecraft setup-github  # Configure GitHub permissions
```

### 5. Commit and Push

```bash
git add .github/workflows .pipecraftrc
git commit -m "chore: add Pipecraft CI/CD workflows"
git push
```

---

## CLI Commands Reference

### Setup Commands

#### `pipecraft init`

Creates a `.pipecraftrc` configuration file with sensible defaults.

**Options:**
| Flag | Description |
|------|-------------|
| `--force` | Overwrite existing config file |
| `--interactive` | Run interactive setup wizard |
| `--with-versioning` | Include version management setup |
| `--ci-provider <provider>` | CI provider: `github` or `gitlab` (default: github) |
| `--merge-strategy <strategy>` | `fast-forward` or `merge` (default: fast-forward) |
| `--initial-branch <branch>` | Development branch (default: develop) |
| `--final-branch <branch>` | Production branch (default: main) |

#### `pipecraft setup`

Creates repository branches defined in `branchFlow` configuration.

**Options:**
| Flag | Description |
|------|-------------|
| `--force` | Force creation even if branches exist |

#### `pipecraft setup-github`

Configures GitHub Actions permissions, auto-merge settings, and branch protection.

**Options:**
| Flag | Description |
|------|-------------|
| `--apply` / `--force` | Auto-apply changes without prompting |
| `--verbose` | Show detailed technical information |

### Generation Commands

#### `pipecraft generate`

Generates GitHub Actions workflow files from configuration.

**Options:**
| Flag | Description |
|------|-------------|
| `--output <path>` | Output directory (default: `.github/workflows`) |
| `--skip-unchanged` | Skip files that haven't changed |
| `--skip-checks` | Skip pre-flight validation checks |
| `--force` | Force regeneration even if files unchanged |
| `--dry-run` | Show what would be done without making changes |
| `--verbose` | Show file operations and decisions |
| `--debug` | Show internal processing details |

### Validation Commands

#### `pipecraft validate` vs `pipecraft doctor`

These serve different purposes:

| Command    | Scope            | What it checks                                                                     |
| ---------- | ---------------- | ---------------------------------------------------------------------------------- |
| `validate` | **Config only**  | Parses `.pipecraftrc`, checks required fields, validates schema                    |
| `doctor`   | **Entire setup** | Config, GitHub setup, branches, generated files, workflow validation, domain paths |

**When to use each:**

- `validate` → after editing config, quick syntax check before `generate`
- `doctor` → troubleshooting, health checks, after cloning a repo

There is no `verify` command. Earlier documentation described one; it is `doctor`.

#### `pipecraft validate`

Validates configuration against Pipecraft's schema. Fast, config file only.

#### `pipecraft doctor`

Full health check across six categories: Configuration, GitHub Setup, Branches, Generated
Files, Workflow Validation, and Domain Paths.

`doctor` exits 1 when it finds errors, so a non-zero exit means it worked and found problems, not that the command failed. Warnings alone exit 0.

#### `pipecraft get-config <key>`

Retrieves specific configuration values.

**Examples:**

```bash
pipecraft get-config branchFlow
pipecraft get-config autoPromote.staging
pipecraft get-config domains.api.paths --format json
```

### Version Commands

#### `pipecraft version`

Version management utilities.

**Options:**
| Flag | Description |
|------|-------------|
| `--check` | Preview next version based on commits |

Bumping and releasing happen in the pipeline, not locally. The `version` job resolves the
next version, `tag` creates the tag, `release` cuts the GitHub release. `--check` only
reports; it writes nothing.

### Global Options

These work with any command:

| Flag                  | Description                                   |
| --------------------- | --------------------------------------------- |
| `-c, --config <path>` | Path to config file (default: `.pipecraftrc`) |
| `-v, --verbose`       | Verbose output                                |
| `--debug`             | Maximum detail output                         |
| `--force`             | Force operation                               |
| `--dry-run`           | Preview without making changes                |
| `--help`              | Show help for any command                     |

---

## Configuration File Reference

### File Locations

Pipecraft searches for configuration in this order (using cosmiconfig):

1. Path specified via `--config` flag
2. `.pipecraftrc` (YAML or JSON) **← Recommended**
3. `.pipecraftrc.json`
4. `.pipecraftrc.yaml`
5. `.pipecraftrc.yml`
6. `.pipecraftrc.js` (JavaScript module)
7. `pipecraft.config.js`
8. `pipecraft` key in `package.json`

### Required Fields

All configurations **must** include these fields:

```yaml
# CI Provider - currently only 'github' is fully supported
ciProvider: github

# How branches are merged
mergeStrategy: fast-forward # or 'merge'

# Enforce conventional commit format
requireConventionalCommits: true

# First branch in promotion flow (must be first in branchFlow)
initialBranch: develop

# Last branch in promotion flow (must be last in branchFlow)
finalBranch: main

# Ordered array of branches from development to production
branchFlow:
  - develop
  - main

# Semantic versioning configuration
semver:
  bumpRules:
    feat: minor # New features → 1.0.0 → 1.1.0
    fix: patch # Bug fixes → 1.0.0 → 1.0.1
    breaking: major # Breaking changes → 1.0.0 → 2.0.0
    chore: patch
    docs: patch
    test: ignore

# Domain definitions (your project structure)
domains:
  app:
    paths:
      - 'src/**'
      - 'tests/**'
    description: Application source code
```

### Optional Fields

```yaml
# Auto-promotion configuration
autoPromote: false                    # boolean: enable for all
# Or per-branch:
autoPromote:
  staging: true                       # Auto-promote to staging
  main: false                         # Manual promotion to main

# Merge method for auto-merge
mergeMethod: auto                     # 'auto', 'merge', 'squash', 'rebase'

# How Pipecraft actions are referenced
actionSourceMode: local               # 'local', 'remote', or 'source'

# Version when using remote actions
actionVersion: v1                     # e.g., 'v1', 'v1.2.3', 'main'

# Versioning configuration
versioning:
  enabled: true
  conventionalCommits: true
  autoTag: true
  autoPush: true
  changelog: true
```

### Domain Configuration

Domains define logical parts of your codebase for change detection:

```yaml
domains:
  # Simple domain
  api:
    paths:
      - 'packages/api/**'
      - 'libs/shared/**'
    description: Backend API service

  # Domain with job prefixes
  web:
    paths:
      - 'packages/web/**'
      - 'libs/ui/**'
    description: Frontend application
    prefixes:
      - test # Generates: test-web job
      - deploy # Generates: deploy-web job
      - remote-test # Generates: remote-test-web job

  # Infrastructure domain
  infra:
    paths:
      - 'infrastructure/**'
      - '.github/workflows/**'
    description: Infrastructure as code
```

### Reserved Domain Names

These names **cannot** be used as domain names (reserved by Pipecraft):

- `version`
- `changes`
- `gate`
- `tag`
- `promote`
- `release`

---

## Configuration Examples

### Minimal (Single Domain, 2 Branches)

```json
{
  "ciProvider": "github",
  "mergeStrategy": "fast-forward",
  "requireConventionalCommits": true,
  "initialBranch": "develop",
  "finalBranch": "main",
  "branchFlow": ["develop", "main"],
  "semver": {
    "bumpRules": {
      "feat": "minor",
      "fix": "patch",
      "breaking": "major"
    }
  },
  "domains": {
    "app": {
      "paths": ["src/**", "tests/**"],
      "description": "Application code"
    }
  }
}
```

### Multi-Domain Monorepo (3 Branches)

```json
{
  "ciProvider": "github",
  "mergeStrategy": "fast-forward",
  "requireConventionalCommits": true,
  "initialBranch": "develop",
  "finalBranch": "main",
  "branchFlow": ["develop", "staging", "main"],
  "autoPromote": {
    "staging": true,
    "main": false
  },
  "semver": {
    "bumpRules": {
      "feat": "minor",
      "fix": "patch",
      "breaking": "major",
      "chore": "patch",
      "docs": "ignore"
    }
  },
  "domains": {
    "api": {
      "paths": ["apps/api/**", "libs/api-core/**", "libs/shared/**"],
      "description": "Backend API service",
      "prefixes": ["test", "deploy"]
    },
    "web": {
      "paths": ["apps/web/**", "libs/ui/**", "libs/shared/**"],
      "description": "Frontend web application",
      "prefixes": ["test", "deploy"]
    },
    "docs": {
      "paths": ["docs/**", "README.md"],
      "description": "Documentation"
    }
  }
}
```

### Enterprise (4-Branch Flow)

```yaml
ciProvider: github
mergeStrategy: fast-forward
requireConventionalCommits: true
initialBranch: develop
finalBranch: production
branchFlow:
  - develop
  - staging
  - uat
  - production
autoPromote:
  staging: true
  uat: true
  production: false
semver:
  bumpRules:
    feat: minor
    fix: patch
    breaking: major
domains:
  services:
    paths:
      - 'services/**'
    description: Microservices
    prefixes: [test, deploy, remote-test]
  infrastructure:
    paths:
      - 'terraform/**'
      - 'k8s/**'
    description: Infrastructure
```

---

## What Gets Generated

When you run `pipecraft generate`, it creates:

### Main Workflow

- `.github/workflows/pipeline.yml` - Main CI/CD pipeline

### Reusable Actions (when `actionSourceMode: local`)

- `.github/actions/detect-changes/action.yml` - Path-based change detection
- `.github/actions/calculate-version/action.yml` - Semantic version calculation
- `.github/actions/create-tag/action.yml` - Git tag creation
- `.github/actions/create-pr/action.yml` - Pull request management
- `.github/actions/manage-branch/action.yml` - Branch operations
- `.github/actions/promote-branch/action.yml` - Branch promotion
- `.github/actions/create-release/action.yml` - GitHub release creation

### Additional Workflows

- `.github/workflows/enforce-pr-target.yml` - Ensures PRs target correct branches
- `.github/workflows/pr-title-check.yml` - Validates conventional commit format

### Configuration

- `.release-it.cjs` - Release-it configuration for version management

---

## Generated Workflow Structure

### Managed Jobs (Pipecraft controls these)

| Job       | Purpose                                                |
| --------- | ------------------------------------------------------ |
| `changes` | Detects which domains changed using path patterns      |
| `version` | Calculates semantic version from conventional commits  |
| `gate`    | Ensures all prerequisite jobs passed before continuing |
| `tag`     | Creates git tags for new versions                      |
| `promote` | Merges code through branch flow                        |
| `release` | Creates GitHub releases                                |

### Custom Jobs (You control these)

Generated jobs based on domain prefixes:

- `test-{domain}` - Test jobs for each domain
- `deploy-{domain}` - Deploy jobs for each domain
- `remote-test-{domain}` - Post-deployment test jobs

### Custom Sections

Workflows include markers for your custom jobs:

```yaml
# <--START CUSTOM JOBS-->
# Your custom jobs here - preserved on regeneration
# <--END CUSTOM JOBS-->
```

Everything inside custom sections is preserved when you regenerate workflows.

---

## Branch Promotion Patterns

### Two-Stage (Simple Projects)

```
feature/* → develop → main
```

### Three-Stage (Recommended)

```
feature/* → develop → staging → main
              ↑
         integration    QA/staging    production
```

### Four-Stage (Enterprise)

```
feature/* → develop → staging → uat → production
              ↑          ↑        ↑        ↑
         integration   QA      UAT     production
```

---

## Conventional Commits

Pipecraft requires conventional commits for semantic versioning:

```
type(scope): description

# Examples:
feat: add user authentication
fix: resolve memory leak in connection pool
docs: update API documentation
chore: update dependencies
feat!: redesign API endpoints
```

### Commit Types and Version Bumps

| Commit Type                    | Default Bump | Example                 |
| ------------------------------ | ------------ | ----------------------- |
| `feat:`                        | minor        | 1.0.0 → 1.1.0           |
| `fix:`                         | patch        | 1.0.0 → 1.0.1           |
| `feat!:` or `BREAKING CHANGE:` | major        | 1.0.0 → 2.0.0           |
| `docs:`, `chore:`, `test:`     | configurable | Usually patch or ignore |

---

## Troubleshooting

### Common Issues

**"Configuration not found"**

```bash
pipecraft validate  # Check if config exists and is valid
```

**"Branch flow validation failed"**

- Ensure `initialBranch` is first in `branchFlow`
- Ensure `finalBranch` is last in `branchFlow`

**"Reserved job name used as domain"**

- Don't use: `version`, `changes`, `gate`, `tag`, `promote`, `release` as domain names

**"Pre-flight checks failed"**

```bash
pipecraft generate --skip-checks  # Skip checks (not recommended)
pipecraft doctor                  # See what's wrong
```

### Debug Commands

```bash
# Full health check
pipecraft doctor

# Validate config syntax
pipecraft validate

# Preview what would be generated
pipecraft generate --dry-run --verbose

# Maximum debug output
pipecraft generate --debug --dry-run
```

---

## Typical Workflows

### First-Time Setup

```bash
pipecraft init                   # Create configuration
# Edit .pipecraftrc to match your project
pipecraft validate               # Verify configuration
pipecraft setup                  # Create branches
pipecraft generate               # Generate workflows
pipecraft setup-github           # Configure permissions
git add .github/ .pipecraftrc
git commit -m "chore: add Pipecraft CI/CD"
git push
```

### Updating Configuration

```bash
# Edit .pipecraftrc
pipecraft validate               # Check for errors
pipecraft generate --verbose     # Regenerate workflows
git diff .github/workflows/      # Review changes
git add .pipecraftrc .github/
git commit -m "chore: update workflow config"
```

### Adding a New Domain

```bash
# Edit .pipecraftrc, add domain to 'domains' section
pipecraft validate
pipecraft generate
# Review new jobs in pipeline.yml
git add .pipecraftrc .github/workflows/
git commit -m "feat: add monitoring domain to CI/CD"
```

### Checking Version

```bash
pipecraft version --check        # Preview next version
```

---

## AI Agent Guidelines

When helping users with Pipecraft:

### Questions to Ask

1. **Project Structure**: "Is this a monorepo or single-app project?"
2. **Branch Strategy**: "What branches do you use? (develop/main, or develop/staging/main?)"
3. **Domains**: "What logical parts of your codebase need separate testing/deployment?"
4. **Auto-promotion**: "Should code automatically promote through branches, or require manual approval?"

### Common Mistakes to Avoid

1. Using reserved names (`version`, `changes`, `gate`, etc.) as domain names
2. `initialBranch` not being first in `branchFlow`
3. `finalBranch` not being last in `branchFlow`
4. Missing required fields in configuration
5. Forgetting to run `pipecraft setup-github` for permissions

### Validation Flow

Always recommend this sequence:

1. `pipecraft validate` - Check config
2. `pipecraft generate --dry-run` - Preview changes
3. `pipecraft generate` - Apply changes
4. Review generated files before committing

---

## Action Reference Modes

| Mode              | Behavior                                              | Use Case                       |
| ----------------- | ----------------------------------------------------- | ------------------------------ |
| `local` (default) | Actions copied to `.github/actions/`                  | Full control, works offline    |
| `remote`          | References `the-craftlab/pipecraft/actions/[name]@v1` | Less maintenance, auto-updates |
| `source`          | References `./actions/` from repo root                | Internal development only      |

---

## Version in package.json

When using Pipecraft's versioning, set your package.json version to:

```json
{
  "version": "0.0.0-pipecraft"
}
```

Pipecraft calculates the actual version from conventional commits during CI/CD.

---

## Additional Resources

- **Full Documentation**: https://pipecraft.thecraftlab.dev
- **GitHub Repository**: https://github.com/the-craftlab/pipecraft
- **NPM Package**: https://www.npmjs.com/package/pipecraft
- **Configuration Schema**: `.pipecraft-schema.json` in project root

## Behaviour that surprises agents

### Why didn't my push release anything?

`tag`, `release` and `promote` only run for commits GitHub authored — that is, commits
created by merging a pull request — or for a run started from the Actions tab.

A commit you push directly keeps your own committer address, so the pipeline tests it and
reports the version it _would_ have used, then stops. `tag`, `release` and `promote` show as
skipped. That is deliberate: it stops a hotfix typed on the wrong branch from cutting a
release.

To release a directly-pushed commit, run the workflow manually from the Actions tab.

### Domain job bodies belong to the user

Pipecraft generates a placeholder for each domain job, marked
`# TODO: Replace with your <domain> test logic`. It writes **no** install step, no toolchain
setup, and no test command — those are the user's decisions. Do not tell a user their
pipeline is broken because the domain jobs only echo; fill them in.

### Two workflows are rewritten every time

`enforce-pr-target.yml` and `pr-title-check.yml` are generated whole from config and
overwritten on every `generate`. Never edit them. Change `.pipecraftrc` and regenerate, or
put custom checks in a separate workflow file.

`pipeline.yml` is different: it merges, and preserves custom jobs between its
`# <--START CUSTOM JOBS-->` markers.
