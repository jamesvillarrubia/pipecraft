---
sidebar_position: 3
---

# Configuration Reference

PipeCraft uses a JSON configuration file to define how your CI/CD workflows should behave. This configuration controls everything from which branches participate in your flow to how domain changes are detected in your monorepo. The goal is to give you fine-grained control while keeping the configuration file human-readable and maintainable.

## Configuration Discovery

PipeCraft uses [cosmiconfig](https://github.com/davidtheclark/cosmiconfig) for configuration discovery, which means it searches for your configuration in multiple places and formats. This flexibility lets you choose the approach that best fits your project structure.

When you run any PipeCraft command, it searches for configuration in this order:

1. The path specified via `--config` flag (if provided)
2. A `.pipecraftrc` file (YAML or JSON format, recommended)
3. A `.pipecraftrc.json` file
4. A `.pipecraftrc.yaml` file
5. A `.pipecraftrc.yml` file
6. A `.pipecraftrc.js` file (JavaScript module)
7. A `pipecraft.config.js` file
8. A `pipecraft` key in your `package.json`
9. Built-in default values

The search walks up your directory tree, so you can run PipeCraft commands from subdirectories and it will still find your configuration at the project root. This is particularly useful in monorepo setups where you might be working deep in the directory structure.

### Supported File Formats

PipeCraft supports multiple configuration file formats to match your preferences:

- **JSON** (`.pipecraftrc.json`): Traditional JSON format
- **YAML** (`.pipecraftrc.yml` or `.pipecraftrc.yaml`): Human-friendly YAML format
- **JavaScript** (`.pipecraftrc.js` or `pipecraft.config.js`): JavaScript module for dynamic configuration
- **No extension** (`.pipecraftrc`): Can be either JSON or YAML format

## Core Configuration

### ciProvider

**Type**: `'github' | 'gitlab'`
**Required**: Yes
**Default**: `'github'`

Specifies which CI/CD platform you're using. Currently, PipeCraft generates GitHub Actions syntax regardless of this setting, but this field is required for future GitLab CI/CD support.

```json
{
  "ciProvider": "github"
}
```

Even though only GitHub Actions is fully supported in the current release, setting this correctly now will make migration smoother when multi-platform support arrives.

### mergeStrategy

**Type**: `'fast-forward' | 'merge'`
**Required**: Yes
**Default**: `'fast-forward'`

Controls how branches are merged during promotion. The fast-forward strategy maintains a linear git history by requiring that the target branch can be fast-forwarded to include the source branch. This means you can't promote a branch until it includes all commits from the target.

```json
{
  "mergeStrategy": "fast-forward"
}
```

Fast-forward merging is the recommended strategy for trunk-based development because it keeps your history clean and makes it obvious how code flows through your branches. When a fast-forward merge isn't possible, PipeCraft workflows will fail gracefully, prompting you to merge or rebase first.

The `'merge'` strategy creates merge commits, which can make history harder to follow but may be necessary if you have complex branch structures or if your team prefers this approach.

### requireConventionalCommits

**Type**: `boolean`
**Required**: No
**Default**: `true`

Determines whether your commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. When enabled, PipeCraft validates commit messages and uses them to determine semantic version bumps.

```json
{
  "requireConventionalCommits": true
}
```

Conventional commits look like this:

```
feat: add user authentication
fix: resolve memory leak in cache
docs: update API documentation
feat!: redesign API endpoints
```

The prefix (feat, fix, docs, etc.) and format allow PipeCraft to automatically determine whether a change warrants a major, minor, or patch version bump. Breaking changes are indicated with `!` or by including `BREAKING CHANGE:` in the commit body.

If you set this to `false`, version bumping becomes manual rather than automatic, and you lose the ability to generate changelogs from commit history.

### packageManager

**Type**: `'npm' | 'yarn' | 'pnpm'`
**Required**: No
**Default**: `'npm'`

Specifies which package manager to use for dependency installation in generated workflows. PipeCraft automatically detects your package manager during `pipecraft init` by checking for lockfiles, but you can explicitly configure it.

```json
{
  "packageManager": "pnpm"
}
```

**Auto-detection during init:**

- Checks for `pnpm-lock.yaml` → selects `pnpm`
- Checks for `yarn.lock` → selects `yarn`
- Checks for `package-lock.json` → selects `npm`
- Defaults to `npm` if no lockfile found

**Impact on generated workflows:**

- **Nx workflows**: Uses the configured package manager for dependency installation
- **Install commands** with automatic fallback:
  - `npm`: `npm ci || npm install`
  - `yarn`: `yarn install --frozen-lockfile || yarn install`
  - `pnpm`: `pnpm install --frozen-lockfile || pnpm install`

**When to set explicitly:**

Use explicit configuration when:

- You use a package manager but haven't committed the lockfile yet
- You want to enforce a specific package manager across your team
- You're migrating between package managers

```json
{
  "packageManager": "pnpm",
  "nx": {
    "enabled": true
  }
}
```

### initialBranch

**Type**: `string`
**Required**: Yes
**Default**: `'develop'`

The first branch in your flow—typically where feature development happens. This is where developers merge their feature branches and where the CI/CD pipeline begins its testing and promotion process.

```json
{
  "initialBranch": "develop"
}
```

This branch must also appear in your `branchFlow` array. PipeCraft uses this to understand where the flow begins and to configure appropriate triggers for the workflow.

### finalBranch

**Type**: `string`
**Required**: Yes
**Default**: `'main'`

The last branch in your flow—typically your production branch. Code only reaches this branch after passing through all intermediate stages defined in your branch flow.

```json
{
  "finalBranch": "main"
}
```

Like `initialBranch`, this must appear in your `branchFlow` array. It's used to determine when versioning and release activities should occur.

### branchFlow

**Type**: `string[]`
**Required**: Yes
**Default**: `['develop', 'staging', 'main']`

An ordered array of branch names that defines your promotion flow. Code moves through these branches in sequence, with each branch typically representing a different environment or stage of testing.

```json
{
  "branchFlow": ["develop", "staging", "main"]
}
```

Your `initialBranch` and `finalBranch` must be present in this array. The order matters—PipeCraft uses it to determine which branch promotions are valid and what tests to run at each stage.

Common patterns include:

**Three-stage flow** (recommended starting point):

```json
{
  "branchFlow": ["develop", "staging", "main"]
}
```

**Simple two-stage flow**:

```json
{
  "branchFlow": ["develop", "main"]
}
```

**Enterprise four-stage flow**:

```json
{
  "branchFlow": ["develop", "staging", "uat", "production"]
}
```

Each branch in the flow can have different tests, deployment targets, and approval requirements defined in the generated workflows.

## Semantic Versioning Configuration

### semver.bumpRules

**Type**: `object`
**Required**: No
**Default**: See below

Controls how different types of conventional commits affect version numbers. These rules only apply when `requireConventionalCommits` is enabled.

```json
{
  "semver": {
    "bumpRules": {
      "feat": "minor",
      "fix": "patch",
      "breaking": "major"
    }
  }
}
```

The three bump types are:

- **patch**: Increment the patch version (1.0.0 → 1.0.1)
- **minor**: Increment the minor version and reset patch (1.0.0 → 1.1.0)
- **major**: Increment the major version and reset minor and patch (1.0.0 → 2.0.0)

You can customize these rules based on your team's versioning philosophy. For example, if you want all features to trigger major bumps during pre-1.0 development:

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

Commits that don't match these types (like `docs:`, `chore:`, `style:`, `refactor:`, or `test:`) don't trigger version bumps.

## Domain Configuration

### domains

**Type**: `object`
**Required**: Yes

Defines the different areas of your codebase and which file paths belong to each. This is PipeCraft's powerful feature for monorepo support—it allows workflows to run tests only for the code that actually changed.

Each domain is an object with a name as its key and configuration as its value:

```json
{
  "domains": {
    "api": {
      "paths": ["apps/api/**", "libs/api-utils/**"],
      "description": "API application and shared utilities",
      "testable": true,
      "deployable": true,
      "remoteTestable": false
    },
    "web": {
      "paths": ["apps/web/**", "libs/ui-components/**"],
      "description": "Web application and UI components",
      "testable": true,
      "deployable": true,
      "remoteTestable": true
    },
    "mobile": {
      "paths": ["apps/mobile/**"],
      "description": "Mobile application",
      "testable": true,
      "deployable": false,
      "remoteTestable": false
    }
  }
}
```

### Domain Properties

#### paths (required)

**Type**: `string[]`

An array of glob patterns matching files that belong to this domain. These patterns use the same syntax as `.gitignore` files:

- `**` matches any number of directories
- `*` matches any file or directory name
- Specific file extensions can be targeted: `**/*.ts`
- Negation patterns are supported: `!**/*.test.ts`

```json
{
  "paths": [
    "apps/api/**", // Everything in apps/api
    "libs/api-core/**", // Core API library
    "!**/*.test.ts" // Exclude test files
  ]
}
```

The generated workflows use these patterns to detect changes. When you push commits or open a pull request, GitHub Actions checks which files changed and compares them against these patterns. Only domains with changes will have their jobs executed.

#### description (required)

**Type**: `string`

A human-readable description of what this domain represents. This appears in generated workflow files as comments, helping future maintainers understand the structure.

```json
{
  "description": "API services and their supporting libraries"
}
```

Good descriptions explain the purpose or responsibility of the domain, not just what directories it contains. They answer "what is this for?" rather than "where is this?"

#### testable (optional)

**Type**: `boolean`
**Default**: `true`

When `testable: true` (the default), PipeCraft generates a `test-{domain}` job that:

- Only runs when the domain has changes
- Runs in parallel with other domain tests
- Must pass before versioning and promotion

Set `testable: false` for domains that don't need testing (e.g., documentation, configuration files).

```json
{
  "domains": {
    "docs": {
      "paths": ["docs/**"],
      "description": "Documentation",
      "testable": false // No tests needed
    }
  }
}
```

#### deployable (optional)

**Type**: `boolean`
**Default**: `false`

When `deployable: true`, PipeCraft generates a `deploy-{domain}` job that:

- Only runs after tests pass and version is calculated
- Runs in parallel with other deployments
- Must succeed (or be skipped) for tagging to occur

Use this for domains that need deployment (APIs, web apps, services):

```json
{
  "domains": {
    "api": {
      "paths": ["apps/api/**"],
      "description": "API service",
      "testable": true,
      "deployable": true // Deploy after tests pass
    }
  }
}
```

#### remoteTestable (optional)

**Type**: `boolean`
**Default**: `false`

When `remoteTestable: true`, PipeCraft generates a `remote-test-{domain}` job that:

- Runs after `deploy-{domain}` succeeds
- Tests the deployed service in its live environment
- Must pass for tagging and promotion

Use this for integration tests, smoke tests, or health checks against deployed services:

```json
{
  "domains": {
    "web": {
      "paths": ["apps/web/**"],
      "description": "Web application",
      "testable": true,
      "deployable": true,
      "remoteTestable": true // Test deployed app
    }
  }
}
```

### Workflow Phase Flow

Domains with different capabilities flow through phases differently:

**Domain with all capabilities enabled**:

1. **Change Detection** → Determines if domain changed
2. **Test** (`test-{domain}`) → Runs if changed
3. **Version** → Calculates next version (after all tests)
4. **Deploy** (`deploy-{domain}`) → Deploys if changed and tests passed
5. **Remote Test** (`remote-test-{domain}`) → Tests deployed service
6. **Tag** → Creates git tag if all deployments/remote tests passed
7. **Promote** → Creates PR to next branch
8. **Release** → Creates GitHub release (on final branch only)

**Domain with only testable**:

1. Change Detection → Test → Version → Tag → Promote → Release

**Domain with testable and deployable**:

1. Change Detection → Test → Version → Deploy → Tag → Promote → Release

## Complete Example Configuration

Here's a comprehensive example showing all major configuration options working together:

```json
{
  "ciProvider": "github",
  "mergeStrategy": "fast-forward",
  "requireConventionalCommits": true,
  "packageManager": "pnpm",
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

  "domains": {
    "api": {
      "paths": ["apps/api/**", "libs/api-core/**", "libs/shared/**"],
      "description": "API services and shared business logic",
      "testable": true,
      "deployable": true,
      "remoteTestable": true
    },
    "web": {
      "paths": ["apps/web/**", "libs/ui-components/**", "libs/shared/**"],
      "description": "Web application and reusable UI components",
      "testable": true,
      "deployable": true,
      "remoteTestable": true
    },
    "mobile": {
      "paths": ["apps/mobile/**", "libs/mobile-components/**", "libs/shared/**"],
      "description": "Mobile application for iOS and Android",
      "testable": true,
      "deployable": false,
      "remoteTestable": false
    },
    "infrastructure": {
      "paths": ["infrastructure/**", "docker/**", ".github/workflows/**"],
      "description": "Infrastructure as code and deployment configurations",
      "testable": false,
      "deployable": false,
      "remoteTestable": false
    }
  }
}
```

## Validation

PipeCraft validates your configuration when you run any command. Common validation errors and their solutions:

**Missing required fields**: Make sure `ciProvider`, `branchFlow`, `initialBranch`, `finalBranch`, and at least one domain are defined.

**Branch flow inconsistency**: Your `initialBranch` and `finalBranch` must both appear in the `branchFlow` array.

**Invalid domain paths**: Each domain must have at least one path pattern. Empty path arrays will cause validation errors.

**JSON syntax errors**: Use a JSON validator or your editor's JSON support to catch syntax mistakes. PipeCraft will show you the parse error location.

Run `pipecraft validate` after editing your configuration to catch issues before generating workflows:

```bash
pipecraft validate
```

For more examples of configurations in different scenarios, see the [Examples](examples.md) page. For understanding how configuration maps to generated workflows, see [Workflow Generation](workflow-generation.md).
