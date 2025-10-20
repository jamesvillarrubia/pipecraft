![PipeCraft Logo](https://raw.githubusercontent.com/jamesvillarrubia/pipecraft/main/assets/logo_banner.png)

# PipeCraft

[![npm version](https://badge.fury.io/js/pipecraft.svg)](https://www.npmjs.com/package/pipecraft)
[![License](https://img.shields.io/npm/l/pipecraft.svg)](https://github.com/jamesvillarrubia/pipecraft/blob/main/LICENSE)
[![NPM downloads](https://img.shields.io/npm/dm/pipecraft.svg)](https://www.npmjs.com/package/pipecraft)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/en/)
[![codecov](https://codecov.io/gh/jamesvillarrubia/pipecraft/branch/main/graph/badge.svg)](https://codecov.io/gh/jamesvillarrubia/pipecraft)

**Pipeline Status:**
[![develop](https://img.shields.io/github/actions/workflow/status/jamesvillarrubia/pipecraft/pipeline.yml?branch=develop&label=develop)](https://github.com/jamesvillarrubia/pipecraft/actions/workflows/pipeline.yml?query=branch%3Adevelop)
[![staging](https://img.shields.io/github/actions/workflow/status/jamesvillarrubia/pipecraft/pipeline.yml?branch=staging&label=staging)](https://github.com/jamesvillarrubia/pipecraft/actions/workflows/pipeline.yml?query=branch%3Astaging)
[![main](https://img.shields.io/github/actions/workflow/status/jamesvillarrubia/pipecraft/pipeline.yml?branch=main&label=main)](https://github.com/jamesvillarrubia/pipecraft/actions/workflows/pipeline.yml?query=branch%3Amain)

PipeCraft is a powerful CLI tool for automating trunk-based development workflows with GitHub Actions. It generates intelligent CI/CD pipelines that adapt to your codebase structure, support multiple domains (monorepos), handle semantic versioning, and manage branch flows with fast-forward merging strategies.

## Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Usage](#usage)
  - [CLI Examples](#cli-examples)
  - [Configuration](#configuration)
- [Commands](#commands)
- [Pre-Flight Checks](#pre-flight-checks)
- [GitHub Actions Setup](#github-actions-setup)
- [Configuration Options](#configuration-options)
- [Domain-Based Workflows](#domain-based-workflows)
- [Version Management](#version-management)
- [Examples](#examples)
- [Documentation](#documentation)
- [Roadmap & Future Features](#roadmap--future-features)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## Features

- **Automatic CI/CD Pipeline Generation** - Generate GitHub Actions workflows tailored to your branch flow
- **Pre-Flight Checks** - Validates prerequisites before generating workflows with helpful error messages
- **Domain-Based Change Detection** - Smart path-based detection for monorepo architectures
- **Semantic Versioning** - Automatic version bumping based on conventional commits
- **Branch Flow Management** - Support for custom branch flows (develop → staging → main)
- **Fast-Forward Merging** - Automatic branch management with configurable merge strategies
- **Idempotent Regeneration** - Only regenerate when configuration or templates change
- **User Job Preservation** - Regenerates pipelines while preserving your custom jobs and comments
- **Customizable Actions** - Define actions per branch merge (tests, deploys, version bumps)
- **GitHub Setup Automation** - Automated token and repository setup validation

> **Note**: This release focuses on GitHub Actions workflows. GitLab CI/CD support is [planned](#roadmap--future-features) for a future release. Currently, the `ciProvider` field accepts `'gitlab'` but generates GitHub Actions syntax.

## Prerequisites

- **Git** - Version control system
- **GitHub Account** - For GitHub Actions workflows
- **Node.js 18.0.0 or higher** - For npm installation

## Quick Start

1. Initialize PipeCraft in your project:
   ```bash
   npx pipecraft init
   ```

2. Generate your CI/CD workflows:
   ```bash
   npx pipecraft generate
   ```

3. Commit the generated files:
   ```bash
   git add .github/workflows .pipecraftrc.json
   git commit -m "chore: add PipeCraft workflows"
   git push
   ```

That's it! Your trunk-based development workflow is now automated.

## Installation

### Option 1: Using npx (recommended for trying it out)

No installation required! Just run commands with `npx`:

```bash
npx pipecraft init
```

### Option 2: Global installation via npm

```bash
npm install -g pipecraft
```

### Option 3: Local project installation

```bash
npm install --save-dev pipecraft
```

Then add to your `package.json` scripts:

```json
{
  "scripts": {
    "workflow:init": "pipecraft init",
    "workflow:generate": "pipecraft generate",
    "workflow:validate": "pipecraft validate"
  }
}
```

## Usage

### CLI Examples

PipeCraft provides several commands to manage your trunk-based development workflows:

#### 1. Initialize Configuration

Create a basic configuration with default settings:
```bash
pipecraft init
```

Force overwrite existing configuration:
```bash
pipecraft init --force
```

> **Note**: The `init` command currently generates a default configuration file with standard trunk flow settings (develop → staging → main). You can then edit the `.pipecraftrc.json` file to customize branch names, domains, and other settings.

#### 2. Generate Workflows

Generate CI/CD workflows based on your configuration:
```bash
pipecraft generate
```

The generate command automatically runs pre-flight checks to validate:
- Configuration file exists and is valid
- Required fields are present (ciProvider, branchFlow, domains)
- Current directory is a git repository
- Git remote is configured
- .github/workflows directory is writable

If any check fails, you'll see helpful error messages with suggestions. Example output:
```
🔍 Running pre-flight checks...

✅ Configuration found: /path/to/.pipecraftrc.json
✅ Configuration is valid
❌ Not in a git repository
   💡 Initialize git: 'git init' or clone an existing repository
```

**Output verbosity levels:**

Normal mode (default) - Clean, actionable output:
```bash
pipecraft generate
```
Shows only essential information: pre-flight checks and completion status.

Verbose mode - Shows file operations:
```bash
pipecraft generate --verbose
```
Includes file merge status, config paths, and workflow generation details.

Debug mode - Full internal details:
```bash
pipecraft generate --debug
```
Includes everything from verbose mode plus internal debugging information like branch flow context, job ordering, and template operations.

**Other options:**

Skip pre-flight checks (not recommended):
```bash
pipecraft generate --skip-checks
```

Force regeneration (bypass cache):
```bash
pipecraft generate --force
```

Preview what would be generated (dry run):
```bash
pipecraft generate --dry-run
```

Use custom config and output paths:
```bash
pipecraft generate --config custom-config.json --output-pipeline .github/workflows/custom.yml
```

#### 3. Validate Configuration

Check if your configuration is valid:
```bash
pipecraft validate
```

Validate a custom config file:
```bash
pipecraft validate --config custom-config.json
```

#### 4. Verify Setup

Verify that PipeCraft is properly configured:
```bash
pipecraft verify
```

This checks:
- Configuration file exists and is valid
- GitHub Actions workflows exist (for GitHub projects)
- Repository structure is correct

#### 5. Version Management

Check current and next version:
```bash
pipecraft version --check
```

Bump version based on conventional commits:
```bash
pipecraft version --bump
```

Create a release:
```bash
pipecraft version --release
```

#### 6. Branch Setup

Create all branches defined in your branch flow:
```bash
pipecraft setup
```

This automatically creates and pushes all branches to your remote repository.

### Configuration

PipeCraft uses [cosmiconfig](https://github.com/davidtheclark/cosmiconfig) for flexible configuration discovery. It will look for configuration in the following order:

1. Command-line options
2. `.pipecraftrc.json` file
3. `.pipecraftrc` file
4. `pipecraft` key in `package.json`
5. Default values

Example `.pipecraftrc.json`:

```json
{
  "ciProvider": "github",
  "mergeStrategy": "fast-forward",
  "requireConventionalCommits": true,
  "initialBranch": "develop",
  "finalBranch": "main",
  "branchFlow": ["develop", "staging", "main"],
  "semver": {
    "bumpRules": {
      "feat": "minor",
      "fix": "patch",
      "breaking": "major"
    }
  },
  "actions": {
    "onDevelopMerge": ["runTests", "fastForwardToStaging"],
    "onStagingMerge": ["runTests", "calculateVersion", "createOrFastForwardToMain"]
  },
  "domains": {
    "api": {
      "paths": ["apps/api/**"],
      "description": "API application changes"
    },
    "web": {
      "paths": ["apps/web/**"],
      "description": "Web application changes"
    }
  }
}
```

## Commands

PipeCraft provides the following commands:

| Command | Description | Key Options |
|---------|-------------|-------------|
| `init` | Initialize PipeCraft configuration | `--force` |
| `generate` | Generate CI/CD workflows with pre-flight checks | `--skip-checks`, `--force`, `--dry-run`, `--config`, `--output-pipeline`, `--verbose`, `--debug` |
| `validate` | Validate configuration file | `--config` |
| `setup-github` | Configure GitHub Actions workflow permissions | `--apply`, `--force` |
| `verify` | Verify PipeCraft setup | None |
| `version` | Version management commands | `--check`, `--bump`, `--release` |
| `setup` | Create branches from branch flow | `--force` |

> **Note**: All commands support global options like `--verbose` and `--debug` for detailed output.

### Global Options

Available for all commands:

- `-c, --config <path>` - Path to config file (default: `.pipecraftrc.json`)
- `-p, --pipeline <path>` - Path to existing pipeline file for merging
- `-o, --output-pipeline <path>` - Path to output pipeline file
- `-v, --verbose` - Verbose output (shows file operations and merge status)
- `--debug` - Debug output (includes verbose output plus internal debugging details)
- `--force` - Force operation even if unchanged
- `--dry-run` - Show what would be done without making changes

### Command Examples

```bash
# Initialize configuration (creates .pipecraftrc.json with defaults)
pipecraft init

# Generate workflows with custom paths
pipecraft generate --config .pipecraft.json --output-pipeline workflows/ci.yml

# Generate with verbose output to see file operations
pipecraft generate --verbose

# Generate with debug output to see internal details
pipecraft generate --debug

# Setup GitHub Actions permissions (interactive mode)
pipecraft setup-github

# Setup GitHub Actions permissions (auto-apply mode)
pipecraft setup-github --apply

# Validate configuration before committing
pipecraft validate && git commit -am "chore: update workflow config"

# Check what version would be bumped to
pipecraft version --check

# Bump version based on conventional commits
pipecraft version --bump

# Create a full release with tag and changelog
pipecraft version --release

# Setup all branches for new repository
pipecraft setup
```

## Pre-Flight Checks

PipeCraft includes comprehensive pre-flight validation to catch common errors before generating workflows. This helps new users avoid frustration and ensures your project is properly configured.

### What Gets Checked

When you run `pipecraft generate`, the following checks are automatically performed:

1. **Configuration File Discovery**
   - Searches for config using [cosmiconfig](https://github.com/davidtheclark/cosmiconfig)
   - Looks in: `.pipecraftrc.json`, `.pipecraftrc`, `package.json` (pipecraft key)
   - Searches parent directories recursively
   - Shows the exact path where config was found

2. **Configuration Validation**
   - Verifies JSON syntax is valid
   - Checks all required fields are present:
     - `ciProvider` (github or gitlab)
     - `branchFlow` (array of branch names)
     - `domains` (at least one domain configured)
   - Validates domain configuration has paths defined

3. **Git Repository Check**
   - Verifies current directory is a git repository
   - Suggests running `git init` if not

4. **Git Remote Check**
   - Verifies git remote is configured
   - Shows the remote URL
   - Suggests adding a remote if missing

5. **Write Permissions**
   - Tests that `.github/workflows` directory can be created/written to
   - Checks file system permissions

### Example Pre-Flight Output

**All checks passing:**
```
🔍 Running pre-flight checks...

✅ Configuration found: /path/to/project/.pipecraftrc.json
✅ Configuration is valid
✅ Current directory is a git repository
✅ Git remote configured: https://github.com/user/repo.git
✅ .github/workflows directory is writable

✅ All pre-flight checks passed!
```

**Checks failing with helpful suggestions:**
```
🔍 Running pre-flight checks...

❌ No PipeCraft configuration found
   💡 Run 'pipecraft init' to create a configuration file

❌ Not in a git repository
   💡 Initialize git: 'git init' or clone an existing repository

❌ No git remote configured
   💡 Add a remote: 'git remote add origin <url>'

❌ Pre-flight checks failed. Fix the issues above and try again.
   Or use --skip-checks to bypass (not recommended)
```

### Skipping Pre-Flight Checks

While not recommended, you can skip pre-flight checks if needed:

```bash
pipecraft generate --skip-checks
```

**When you might skip checks:**
- CI/CD environment with non-standard setup
- Using PipeCraft in a script/automation
- Advanced users who know the risks

**Why you shouldn't skip:**
- Prevents cryptic errors during generation
- Saves time by catching issues early
- Provides actionable error messages
- Ensures consistent behavior across environments

## GitHub Actions Setup

PipeCraft requires specific GitHub Actions permissions and repository settings to function correctly. The `setup-github` command helps you configure everything automatically.

### What Gets Configured

The `setup-github` command configures:

1. **Workflow Permissions**
   - Default workflow permissions: **write** (for creating tags and pushing changes)
   - Can create/approve pull requests: **Yes** (for automated PR creation)

2. **Repository Auto-Merge**
   - Enables auto-merge feature at repository level
   - Required for automatic promotion between branches

3. **Branch Protection Rules** (for branches with auto-merge enabled)
   - Status checks enabled (no specific checks required)
   - Required linear history (prevents messy merges)
   - No force pushes or branch deletion
   - These rules are required for GitHub's auto-merge feature to work

### Usage

**Interactive Mode (Default)**

Prompts you for each permission change:

```bash
pipecraft setup-github
```

The command will:
1. Check your current repository permissions
2. Enable repository-level auto-merge if needed
3. Configure branch protection for branches with `autoMerge: true` in config
4. Prompt you to apply each change
5. Update the settings if you accept

**Auto-Apply Mode**

Automatically applies all required changes without prompting:

```bash
pipecraft setup-github --apply
# or
pipecraft setup-github --force
```

This mode is useful for:
- CI/CD pipeline setup scripts
- Automated repository initialization
- Batch configuration of multiple repositories

### Example Output

**Interactive mode:**
```
🔍 Checking GitHub repository configuration...

📦 Repository: user/repo
✅ GitHub token found
🔍 Fetching current workflow permissions...

📋 Current GitHub Actions Workflow Permissions:
   Default permissions: read
   Can create/approve PRs: No

⚠️  PipeCraft requires the following permissions:
   • Default permissions: write (for creating tags and pushing)
   • Can create/approve PRs: Yes (for automated PR creation)

? Change default workflow permissions from "read" to "write"? (Y/n) Yes

🔍 Checking auto-merge configuration...
✅ Enabled auto-merge for repository
📋 Branches with auto-merge enabled: staging
? Enable branch protection for 'staging' to support auto-merge? (Y/n) Yes
🔧 Configuring branch protection for staging...
✅ Branch protection enabled for staging

✨ Setup complete!
```

**Auto-apply mode:**
```
🔍 Checking GitHub repository configuration...

📦 Repository: user/repo
✅ GitHub token found
🔍 Fetching current workflow permissions...

✅ Workflow permissions are already configured correctly!

🔍 Checking auto-merge configuration...
✅ Enabled auto-merge for repository
📋 Branches with auto-merge enabled: staging
🔧 Configuring branch protection for staging...
✅ Branch protection enabled for staging

✨ Setup complete!

💡 You can verify the changes at:
   https://github.com/user/repo/settings/actions
```

### Authentication

The command requires a GitHub token with admin access to your repository. It will automatically use:

1. `GITHUB_TOKEN` environment variable
2. `GH_TOKEN` environment variable
3. GitHub CLI (`gh`) authentication

To authenticate with GitHub CLI:
```bash
gh auth login
```

Or set an environment variable:
```bash
export GITHUB_TOKEN=ghp_your_token_here
```

### Manual Configuration

You can also configure these settings manually:

**Workflow Permissions:**
1. Go to your repository on GitHub
2. Navigate to **Settings** → **Actions** → **General**
3. Under "Workflow permissions":
   - Select **Read and write permissions**
   - Check **Allow GitHub Actions to create and approve pull requests**
4. Click **Save**

**Repository Auto-Merge:**
1. Navigate to **Settings** → **General**
2. Scroll to "Pull Requests"
3. Check **Allow auto-merge**
4. Click **Save**

**Branch Protection (for branches with auto-merge):**
1. Navigate to **Settings** → **Branches**
2. Click **Add branch protection rule** or edit existing rule
3. In "Branch name pattern", enter the branch name (e.g., `staging`)
4. Configure the following:
   - Check **Require status checks to pass before merging**
   - Leave status checks empty (or add your own)
   - Check **Require linear history**
   - Leave other options as needed
5. Click **Create** or **Save changes**

Note: Branch protection rules are required for auto-merge to work in GitHub.

## Configuration Options

### Core Configuration

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `ciProvider` | `'github' \| 'gitlab'` | Yes | `'github'` | CI/CD provider |
| `mergeStrategy` | `'fast-forward' \| 'merge'` | Yes | `'fast-forward'` | Branch merge strategy |
| `requireConventionalCommits` | `boolean` | No | `true` | Enforce conventional commits |
| `initialBranch` | `string` | Yes | `'develop'` | First branch in flow |
| `finalBranch` | `string` | Yes | `'main'` | Final production branch |
| `branchFlow` | `string[]` | Yes | - | Ordered list of branches |

### Semantic Versioning

| Option | Type | Description |
|--------|------|-------------|
| `semver.bumpRules.feat` | `'major' \| 'minor' \| 'patch'` | Version bump for features |
| `semver.bumpRules.fix` | `'major' \| 'minor' \| 'patch'` | Version bump for fixes |
| `semver.bumpRules.breaking` | `'major' \| 'minor' \| 'patch'` | Version bump for breaking changes |

### Actions

Define what happens on branch merges:

```json
{
  "actions": {
    "onDevelopMerge": [
      "runTests",
      "fastForwardToStaging"
    ],
    "onStagingMerge": [
      "runTests",
      "calculateVersion",
      "createOrFastForwardToMain"
    ]
  }
}
```

Available actions:
- `runTests` - Run test suite
- `fastForwardToStaging` - Fast-forward develop to staging
- `calculateVersion` - Calculate next semantic version
- `createOrFastForwardToMain` - Merge or fast-forward to main
- `deploy` - Run deployment steps

### Domains (Monorepo Support)

Define multiple domains for path-based change detection:

```json
{
  "domains": {
    "api": {
      "paths": ["apps/api/**", "libs/api-utils/**"],
      "description": "API application and utilities"
    },
    "web": {
      "paths": ["apps/web/**", "libs/ui-components/**"],
      "description": "Web application and UI components"
    },
    "mobile": {
      "paths": ["apps/mobile/**"],
      "description": "Mobile application"
    }
  }
}
```

Each domain can have:
- `paths` (required): Array of glob patterns for file matching
- `description` (optional): Human-readable description

### Versioning Configuration

```json
{
  "versioning": {
    "enabled": true,
    "releaseItConfig": ".release-it.cjs",
    "conventionalCommits": true,
    "autoTag": true,
    "autoPush": true,
    "changelog": true,
    "bumpRules": {
      "feat": "minor",
      "fix": "patch",
      "breaking": "major"
    }
  }
}
```

### Rebuild/Idempotency Configuration

Control when workflows are regenerated:

```json
{
  "rebuild": {
    "enabled": true,
    "skipIfUnchanged": true,
    "forceRegenerate": false,
    "watchMode": false,
    "hashAlgorithm": "sha256",
    "cacheFile": ".pipecraft-cache.json",
    "ignorePatterns": ["*.md", "docs/**"]
  }
}
```

## Domain-Based Workflows

PipeCraft excels at managing monorepo workflows with multiple domains. The generated workflows automatically detect which domains have changes and run appropriate jobs.

### How It Works

1. **Change Detection**: The `changes` job uses GitHub's `paths-filter` action to detect which domains have modifications
2. **Conditional Jobs**: Domain-specific jobs only run if changes are detected in their paths
3. **Parallel Execution**: Independent domains run in parallel for faster CI times
4. **Dependency Management**: Jobs can depend on specific domain changes

### Example Generated Workflow

```yaml
name: Pipeline

on:
  pull_request:
    branches:
      - develop
      - staging
      - main

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
              - 'apps/api/**'
            web:
              - 'apps/web/**'

  test-api:
    needs: changes
    if: needs.changes.outputs.api == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run API tests
        run: npm test --workspace=api

  test-web:
    needs: changes
    if: needs.changes.outputs.web == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Web tests
        run: npm test --workspace=web
```

## Version Management

PipeCraft integrates with [release-it](https://github.com/release-it/release-it) for automated semantic versioning.

### Setup Version Management

```bash
pipecraft init --with-versioning
```

This creates:
- `.release-it.cjs` - Release-it configuration
- `commitlint.config.js` - Commit message linting
- `.husky/commit-msg` - Git hook for commit validation

### Version Commands

Check what the next version would be:
```bash
pipecraft version --check
```

Output:
```
📦 Current version: 1.2.3
📦 Next version: 1.3.0 (minor)
📝 Conventional commits: ✅ Valid
```

Bump version based on commits:
```bash
pipecraft version --bump
```

Create a full release:
```bash
pipecraft version --release
```

### Conventional Commits

PipeCraft works best with conventional commits:

- `feat:` - New feature (minor bump)
- `fix:` - Bug fix (patch bump)
- `feat!:` or `BREAKING CHANGE:` - Breaking change (major bump)
- `chore:`, `docs:`, `style:`, `refactor:`, `test:` - No version bump

Example:
```bash
git commit -m "feat: add user authentication"  # Bumps to 1.3.0
git commit -m "fix: resolve login bug"         # Bumps to 1.3.1
git commit -m "feat!: redesign API structure"  # Bumps to 2.0.0
```

## Examples

### Example 1: Simple Project with Linear Branch Flow

Configuration for a project with develop → main flow:

```json
{
  "ciProvider": "github",
  "mergeStrategy": "fast-forward",
  "initialBranch": "develop",
  "finalBranch": "main",
  "branchFlow": ["develop", "main"],
  "domains": {
    "app": {
      "paths": ["src/**"],
      "description": "Application code"
    }
  }
}
```

### Example 2: Enterprise Monorepo with Multiple Environments

Configuration for staging environment:

```json
{
  "ciProvider": "github",
  "mergeStrategy": "fast-forward",
  "requireConventionalCommits": true,
  "initialBranch": "develop",
  "finalBranch": "production",
  "branchFlow": ["develop", "staging", "uat", "production"],
  "semver": {
    "bumpRules": {
      "feat": "minor",
      "fix": "patch",
      "breaking": "major"
    }
  },
  "actions": {
    "onDevelopMerge": ["runTests", "fastForwardToStaging"],
    "onStagingMerge": ["runTests", "deployToStaging"],
    "onUatMerge": ["runTests", "calculateVersion", "deployToUat"],
    "onProductionMerge": ["runTests", "deployToProduction", "createRelease"]
  },
  "domains": {
    "api": {
      "paths": ["services/api/**", "libs/api-core/**"],
      "description": "API services and core libraries"
    },
    "web": {
      "paths": ["apps/web/**", "libs/ui/**"],
      "description": "Web application and UI libraries"
    },
    "mobile": {
      "paths": ["apps/mobile/**"],
      "description": "Mobile application"
    },
    "shared": {
      "paths": ["libs/shared/**", "packages/**"],
      "description": "Shared libraries and packages"
    }
  },
  "versioning": {
    "enabled": true,
    "conventionalCommits": true,
    "autoTag": true,
    "changelog": true
  }
}
```

### Example 3: GitLab CI Project

Configuration for GitLab:

```json
{
  "ciProvider": "gitlab",
  "mergeStrategy": "merge",
  "initialBranch": "develop",
  "finalBranch": "main",
  "branchFlow": ["develop", "main"],
  "domains": {
    "backend": {
      "paths": ["backend/**"],
      "description": "Backend services"
    },
    "frontend": {
      "paths": ["frontend/**"],
      "description": "Frontend application"
    }
  }
}
```

### Example 4: Custom Branch Names

Configuration with non-standard branch names:

```json
{
  "ciProvider": "github",
  "mergeStrategy": "fast-forward",
  "initialBranch": "alpha",
  "finalBranch": "release",
  "branchFlow": ["alpha", "beta", "gamma", "release"],
  "domains": {
    "core": {
      "paths": ["core/**"],
      "description": "Core functionality"
    }
  }
}
```

## Documentation

PipeCraft provides comprehensive documentation for different aspects of the project:

### Core Documentation

- **[Architecture](./architecture)** - System architecture overview, design patterns, and component interactions
- **[Current Trunk Flow](./trunk-flow)** - Current implemented trunk-based development workflow
- **[Error Handling](./error-handling)** - Error handling strategies and common error scenarios
- **[Testing Guide](./testing-guide)** - Complete testing guide with examples and best practices

### Development Documentation

- **[Test Structure](https://github.com/jamesvillarrubia/pipecraft/tree/main/tests)** - Test structure and organization on GitHub
- **[Repository Structure](https://github.com/jamesvillarrubia/pipecraft)** - Repository organization and structure

### Planning Documents

- **[Trunk Flow Roadmap](https://github.com/jamesvillarrubia/pipecraft/blob/main/TRUNK_FLOW_PLAN.md)** - Future roadmap for trunk flow variations *(future plans, not current implementation)*

### Quick Links

- **Architecture**: Understand how PipeCraft works internally
- **Current Trunk Flow**: See what's implemented in this release
- **Testing Guide**: Learn how to test PipeCraft or contribute tests
- **Error Handling**: Debug issues and understand error messages

## Roadmap & Future Features

PipeCraft is actively being developed with plans for additional features and improvements.

### Current Release (v1.x)

This release focuses on a **solid, working trunk-based development workflow** for GitHub Actions with:

✅ **Develop → Staging → Main** branch flow  
✅ **Domain-based change detection** for monorepos  
✅ **Semantic versioning** with conventional commits  
✅ **User job preservation** during regeneration  
✅ **Pre-flight checks** for smooth setup  
✅ **Comprehensive documentation** and testing  

See [Current Trunk Flow](./trunk-flow) for details on what's implemented.

### Planned Features

The roadmap is documented in [TRUNK_FLOW_PLAN.md](https://github.com/jamesvillarrubia/pipecraft/blob/main/TRUNK_FLOW_PLAN.md). Key planned features include:

#### Short Term (v2.x)
- **Enhanced GitLab Support** - Full GitLab CI/CD pipeline generation
- **Interactive Configuration** - Interactive `init` command with prompts
- **Additional Flow Variations** - Gitflow, release branches, hotfix workflows
- **CLI Improvements** - Better error messages, configuration migration tools

#### Medium Term (v3.x)
- **Extended CI/CD Providers** - Azure DevOps, Jenkins, CircleCI, Bitbucket
- **Advanced Branch Management** - Conflict resolution, PR templates
- **Visual Workflow Editor** - Web-based workflow configuration tool

#### Long Term (v4.x+)
- **Enterprise Features** - Team templates, policy enforcement, audit logging
- **Plugin System** - Custom workflow patterns and extensions
- **Multi-Repository** Support - Manage pipelines across multiple repos

For the complete roadmap and feature comparison, see [TRUNK_FLOW_PLAN.md](https://github.com/jamesvillarrubia/pipecraft/blob/main/TRUNK_FLOW_PLAN.md).

### Contributing to the Roadmap

Have a feature request? We'd love to hear from you!

1. Check existing [feature requests](https://github.com/jamesvillarrubia/pipecraft/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement)
2. [Open a new feature request](https://github.com/jamesvillarrubia/pipecraft/issues/new?labels=enhancement)
3. Vote on existing feature requests with 👍
4. Consider contributing! See [Contributing](#contributing)

## Troubleshooting

### Common Issues

#### 1. Workflows Not Generating

**Problem**: Running `pipecraft generate` doesn't create files.

**Solutions**:
- PipeCraft now runs automatic pre-flight checks that will catch most issues
- Review the pre-flight check output for specific problems
- Check if configuration is valid: `pipecraft validate`
- Use `--force` to bypass cache: `pipecraft generate --force`
- Use `--verbose` for detailed output: `pipecraft generate --verbose`
- Use `--debug` for full debugging output: `pipecraft generate --debug`
- Verify file permissions in `.github/workflows/`

#### 2. Configuration Validation Errors

**Problem**: Getting validation errors when running commands.

**Solutions**:
- Ensure all required fields are present (ciProvider, branchFlow, domains)
- Check that `initialBranch` and `finalBranch` are in `branchFlow`
- Verify domain paths are valid glob patterns
- Use `pipecraft validate` to see specific errors

#### 3. Branch Flow Not Working

**Problem**: Branches aren't being created or fast-forwarded.

**Solutions**:
- Run `pipecraft setup` to create missing branches
- Verify GitHub token has push permissions
- Check that branch protection rules allow fast-forward merges
- Ensure branches exist on remote: `git push origin branch-name`

#### 4. Version Management Not Working

**Problem**: Version bumps aren't happening automatically.

**Solutions**:
- Initialize version management: `pipecraft init --with-versioning`
- Ensure commits follow conventional format
- Check that `package.json` exists with version field
- Verify `release-it` is configured: check `.release-it.cjs`

#### 5. Cache Issues

**Problem**: Changes not being detected after config update.

**Solutions**:
- Force regeneration: `pipecraft generate --force`
- Delete cache file: `rm .pipecraft-cache.json`
- Check cache file permissions
- Verify `rebuild.enabled` is `true` in config

### Getting Help

If you encounter issues not covered here:

1. Check the [GitHub Issues](https://github.com/jamesvillarrubia/pipecraft/issues)
2. Enable verbose logging: `pipecraft generate --verbose`
3. Enable debug logging for more detail: `pipecraft generate --debug`
4. Validate your configuration: `pipecraft validate`
5. [Open a new issue](https://github.com/jamesvillarrubia/pipecraft/issues/new) with:
   - PipeCraft version: `pipecraft --version`
   - Node version: `node --version`
   - Your configuration (sanitized)
   - Full error output with `--debug`

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](https://github.com/jamesvillarrubia/pipecraft/blob/main/CONTRIBUTING.md) for details on:

- Code of conduct
- Development setup
- Running tests
- Submitting pull requests
- Coding standards

### Development Setup

```bash
# Clone the repository
git clone https://github.com/jamesvillarrubia/pipecraft.git
cd pipecraft

# Install dependencies
npm install

# Run tests
npm test

# Run in development mode
npm run dev -- init --interactive
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npm test tests/unit/config.test.ts
```

## License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/jamesvillarrubia/pipecraft/blob/main/LICENSE) file for details.

## Acknowledgments

- **PullCraft** - Sister project for automated PR generation
- **Pinion** - Template generation framework by FeathersCloud
- **Commander** - CLI framework
- **release-it** - Version management and releases
- All contributors who have helped improve PipeCraft

---

<div align="center">

**Built with ❤️ for trunk-based development teams**

[Report Bug](https://github.com/jamesvillarrubia/pipecraft/issues) · [Request Feature](https://github.com/jamesvillarrubia/pipecraft/issues) · [Documentation](https://github.com/jamesvillarrubia/pipecraft/wiki)

</div>
