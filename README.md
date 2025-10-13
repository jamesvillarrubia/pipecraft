<img src="./assets/logo_banner.png" alt="FlowCraft Logo" width="auto">

# FlowCraft

[![npm version](https://badge.fury.io/js/flowcraft.svg)](https://badge.fury.io/js/flowcraft)
[![License](https://img.shields.io/npm/l/flowcraft.svg)](https://github.com/jamesvillarrubia/flowcraft/blob/main/LICENSE)
[![Build Status](https://img.shields.io/github/actions/workflow/status/jamesvillarrubia/flowcraft/publish.yml?branch=main)](https://github.com/jamesvillarrubia/flowcraft/actions)
[![codecov](https://codecov.io/gh/jamesvillarrubia/flowcraft/branch/main/graph/badge.svg)](https://codecov.io/gh/jamesvillarrubia/flowcraft)
[![NPM downloads](https://img.shields.io/npm/dm/flowcraft.svg)](https://www.npmjs.com/package/flowcraft)
[![Node.js Version](https://img.shields.io/node/v/flowcraft.svg)](https://nodejs.org/en/)

FlowCraft is a powerful CLI tool for automating trunk-based development workflows with GitHub Actions. It generates intelligent CI/CD pipelines that adapt to your codebase structure, support multiple domains (monorepos), handle semantic versioning, and manage branch flows with fast-forward merging strategies.

## Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Usage](#usage)
  - [CLI Examples](#cli-examples)
  - [Configuration](#configuration)
- [Commands](#commands)
- [Configuration Options](#configuration-options)
- [Domain-Based Workflows](#domain-based-workflows)
- [Version Management](#version-management)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## Features

- **Automatic CI/CD Pipeline Generation** - Generate GitHub Actions workflows tailored to your branch flow
- **Domain-Based Change Detection** - Smart path-based detection for monorepo architectures
- **Semantic Versioning** - Automatic version bumping based on conventional commits
- **Branch Flow Management** - Support for custom branch flows (develop → staging → main)
- **Fast-Forward Merging** - Automatic branch management with configurable merge strategies
- **Idempotent Regeneration** - Only regenerate when configuration or templates change
- **GitLab Support** - Works with both GitHub Actions and GitLab CI (configurable)
- **Customizable Actions** - Define actions per branch merge (tests, deploys, version bumps)

## Prerequisites

- Git
- A GitHub or GitLab account
- Node.js 18+ (for npm installation)

## Quick Start

1. Initialize FlowCraft in your project:
   ```bash
   npx flowcraft init --interactive
   ```

2. Generate your CI/CD workflows:
   ```bash
   npx flowcraft generate
   ```

3. Commit the generated files:
   ```bash
   git add .github/workflows .flowcraftrc.json
   git commit -m "chore: add FlowCraft workflows"
   git push
   ```

That's it! Your trunk-based development workflow is now automated.

## Installation

### Option 1: Using npx (recommended for trying it out)

No installation required! Just run commands with `npx`:

```bash
npx flowcraft init
```

### Option 2: Global installation via npm

```bash
npm install -g flowcraft
```

### Option 3: Local project installation

```bash
npm install --save-dev flowcraft
```

Then add to your `package.json` scripts:

```json
{
  "scripts": {
    "workflow:init": "flowcraft init",
    "workflow:generate": "flowcraft generate",
    "workflow:validate": "flowcraft validate"
  }
}
```

## Usage

### CLI Examples

FlowCraft provides several commands to manage your trunk-based development workflows:

#### 1. Initialize Configuration

Start with an interactive setup wizard:
```bash
flowcraft init --interactive
```

Or create a basic configuration:
```bash
flowcraft init --ci-provider github --initial-branch develop --final-branch main
```

Include version management setup:
```bash
flowcraft init --with-versioning
```

#### 2. Generate Workflows

Generate CI/CD workflows based on your configuration:
```bash
flowcraft generate
```

Force regeneration (bypass cache):
```bash
flowcraft generate --force
```

Preview what would be generated (dry run):
```bash
flowcraft generate --dry-run
```

Use custom config and output paths:
```bash
flowcraft generate --config custom-config.json --output-pipeline .github/workflows/custom.yml
```

#### 3. Validate Configuration

Check if your configuration is valid:
```bash
flowcraft validate
```

Validate a custom config file:
```bash
flowcraft validate --config custom-config.json
```

#### 4. Verify Setup

Verify that FlowCraft is properly configured:
```bash
flowcraft verify
```

This checks:
- Configuration file exists and is valid
- GitHub Actions workflows exist (for GitHub projects)
- Repository structure is correct

#### 5. Version Management

Check current and next version:
```bash
flowcraft version --check
```

Bump version based on conventional commits:
```bash
flowcraft version --bump
```

Create a release:
```bash
flowcraft version --release
```

#### 6. Branch Setup

Create all branches defined in your branch flow:
```bash
flowcraft setup
```

This automatically creates and pushes all branches to your remote repository.

### Configuration

FlowCraft uses [cosmiconfig](https://github.com/davidtheclark/cosmiconfig) for flexible configuration discovery. It will look for configuration in the following order:

1. Command-line options
2. `.flowcraftrc.json` file
3. `.flowcraftrc` file
4. `flowcraft` key in `package.json`
5. Default values

Example `.flowcraftrc.json`:

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

FlowCraft provides the following commands:

| Command | Description | Options |
|---------|-------------|---------|
| `init` | Initialize FlowCraft configuration | `--interactive`, `--force`, `--with-versioning`, `--ci-provider`, `--merge-strategy`, `--initial-branch`, `--final-branch` |
| `generate` | Generate CI/CD workflows | `--force`, `--dry-run`, `--config`, `--output-pipeline`, `--verbose` |
| `validate` | Validate configuration file | `--config` |
| `verify` | Verify FlowCraft setup | None |
| `version` | Version management commands | `--check`, `--bump`, `--release` |
| `setup` | Create branches from branch flow | `--force` |

### Global Options

Available for all commands:

- `-c, --config <path>` - Path to config file (default: `.flowcraftrc.json`)
- `-p, --pipeline <path>` - Path to existing pipeline file for merging
- `-o, --output-pipeline <path>` - Path to output pipeline file
- `-v, --verbose` - Verbose output
- `--force` - Force operation even if unchanged
- `--dry-run` - Show what would be done without making changes

### Command Examples

```bash
# Initialize with all options
flowcraft init --interactive --with-versioning --ci-provider github

# Generate workflows with custom paths
flowcraft generate --config .flowcraft.json --output-pipeline workflows/ci.yml

# Validate before committing
flowcraft validate && git commit -am "chore: update workflow config"

# Check version and create release
flowcraft version --check
flowcraft version --bump
flowcraft version --release

# Setup all branches for new repository
flowcraft setup
```

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
    "cacheFile": ".flowcraft-cache.json",
    "ignorePatterns": ["*.md", "docs/**"]
  }
}
```

## Domain-Based Workflows

FlowCraft excels at managing monorepo workflows with multiple domains. The generated workflows automatically detect which domains have changes and run appropriate jobs.

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

FlowCraft integrates with [release-it](https://github.com/release-it/release-it) for automated semantic versioning.

### Setup Version Management

```bash
flowcraft init --with-versioning
```

This creates:
- `.release-it.cjs` - Release-it configuration
- `commitlint.config.js` - Commit message linting
- `.husky/commit-msg` - Git hook for commit validation

### Version Commands

Check what the next version would be:
```bash
flowcraft version --check
```

Output:
```
📦 Current version: 1.2.3
📦 Next version: 1.3.0 (minor)
📝 Conventional commits: ✅ Valid
```

Bump version based on commits:
```bash
flowcraft version --bump
```

Create a full release:
```bash
flowcraft version --release
```

### Conventional Commits

FlowCraft works best with conventional commits:

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

## Troubleshooting

### Common Issues

#### 1. Workflows Not Generating

**Problem**: Running `flowcraft generate` doesn't create files.

**Solutions**:
- Check if configuration is valid: `flowcraft validate`
- Use `--force` to bypass cache: `flowcraft generate --force`
- Use `--verbose` for detailed output: `flowcraft generate --verbose`
- Verify file permissions in `.github/workflows/`

#### 2. Configuration Validation Errors

**Problem**: Getting validation errors when running commands.

**Solutions**:
- Ensure all required fields are present (ciProvider, branchFlow, domains)
- Check that `initialBranch` and `finalBranch` are in `branchFlow`
- Verify domain paths are valid glob patterns
- Use `flowcraft validate` to see specific errors

#### 3. Branch Flow Not Working

**Problem**: Branches aren't being created or fast-forwarded.

**Solutions**:
- Run `flowcraft setup` to create missing branches
- Verify GitHub token has push permissions
- Check that branch protection rules allow fast-forward merges
- Ensure branches exist on remote: `git push origin branch-name`

#### 4. Version Management Not Working

**Problem**: Version bumps aren't happening automatically.

**Solutions**:
- Initialize version management: `flowcraft init --with-versioning`
- Ensure commits follow conventional format
- Check that `package.json` exists with version field
- Verify `release-it` is configured: check `.release-it.cjs`

#### 5. Cache Issues

**Problem**: Changes not being detected after config update.

**Solutions**:
- Force regeneration: `flowcraft generate --force`
- Delete cache file: `rm .flowcraft-cache.json`
- Check cache file permissions
- Verify `rebuild.enabled` is `true` in config

### Getting Help

If you encounter issues not covered here:

1. Check the [GitHub Issues](https://github.com/jamesvillarrubia/flowcraft/issues)
2. Enable verbose logging: `flowcraft generate --verbose`
3. Validate your configuration: `flowcraft validate`
4. [Open a new issue](https://github.com/jamesvillarrubia/flowcraft/issues/new) with:
   - FlowCraft version: `flowcraft --version`
   - Node version: `node --version`
   - Your configuration (sanitized)
   - Full error output with `--verbose`

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details on:

- Code of conduct
- Development setup
- Running tests
- Submitting pull requests
- Coding standards

### Development Setup

```bash
# Clone the repository
git clone https://github.com/jamesvillarrubia/flowcraft.git
cd flowcraft

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

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Acknowledgments

- **PullCraft** - Sister project for automated PR generation
- **Pinion** - Template generation framework by FeathersCloud
- **Commander** - CLI framework
- **release-it** - Version management and releases
- All contributors who have helped improve FlowCraft

---

<div align="center">

**Built with ❤️ for trunk-based development teams**

[Report Bug](https://github.com/jamesvillarrubia/flowcraft/issues) · [Request Feature](https://github.com/jamesvillarrubia/flowcraft/issues) · [Documentation](https://github.com/jamesvillarrubia/flowcraft/wiki)

</div>
