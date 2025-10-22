---
sidebar_position: 3
---

# Configuration Reference

PipeCraft uses a JSON configuration file to define how your CI/CD workflows should behave. This configuration controls everything from which branches participate in your flow to how domain changes are detected in your monorepo. The goal is to give you fine-grained control while keeping the configuration file human-readable and maintainable.

## Configuration Discovery

PipeCraft uses [cosmiconfig](https://github.com/davidtheclark/cosmiconfig) for configuration discovery, which means it searches for your configuration in multiple places and formats. This flexibility lets you choose the approach that best fits your project structure.

When you run any PipeCraft command, it searches for configuration in this order:

1. The path specified via `--config` flag (if provided)
2. A `.pipecraftrc.json` file in the current or parent directories
3. A `.pipecraftrc` file (JSON format) in the current or parent directories
4. A `pipecraft` key in your `package.json`
5. Built-in default values

The search walks up your directory tree, so you can run PipeCraft commands from subdirectories and it will still find your configuration at the project root. This is particularly useful in monorepo setups where you might be working deep in the directory structure.

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
      "description": "API application and shared utilities"
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
    "apps/api/**",           // Everything in apps/api
    "libs/api-core/**",      // Core API library
    "!**/*.test.ts"          // Exclude test files
  ]
}
```

The generated workflows use these patterns to detect changes. When you push commits or open a pull request, GitHub Actions checks which files changed and compares them against these patterns. Only domains with changes will have their jobs executed.

#### description (optional)

**Type**: `string`

A human-readable description of what this domain represents. This appears in generated workflow files as comments, helping future maintainers understand the structure.

```json
{
  "description": "API services and their supporting libraries"
}
```

Good descriptions explain the purpose or responsibility of the domain, not just what directories it contains. They answer "what is this for?" rather than "where is this?"

## Versioning Configuration

### versioning

**Type**: `object`
**Required**: No

Controls integration with release-it for automated versioning and changelog generation. When enabled, PipeCraft workflows can automatically bump versions and create releases based on your commits.

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

### Versioning Properties

#### enabled

**Type**: `boolean`
**Default**: `true`

Master switch for version management features. When disabled, PipeCraft workflows won't include version bumping or release creation steps.

#### releaseItConfig

**Type**: `string`
**Default**: `".release-it.cjs"`

Path to your release-it configuration file. PipeCraft uses release-it behind the scenes for the actual version bumping and changelog generation.

#### conventionalCommits

**Type**: `boolean`
**Default**: `true`

Whether to use conventional commits for determining version bumps. This should typically match your `requireConventionalCommits` setting.

#### autoTag

**Type**: `boolean`
**Default**: `true`

Automatically create git tags when versions are bumped. Tags use the format `v1.2.3` by default.

#### autoPush

**Type**: `boolean`
**Default**: `true`

Automatically push version commits and tags to the remote repository after creating them.

#### changelog

**Type**: `boolean`
**Default**: `true`

Generate a CHANGELOG.md file automatically from commit history. This requires conventional commits to work effectively.

## Rebuild and Idempotency Configuration

### rebuild

**Type**: `object`
**Required**: No

Controls when and how PipeCraft regenerates workflow files. These settings help prevent unnecessary churn in your workflow files while still allowing updates when needed.

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

### Rebuild Properties

#### enabled

**Type**: `boolean`
**Default**: `true`

Master switch for the caching and change detection system. When enabled, PipeCraft tracks configuration and template changes to avoid regenerating workflows unnecessarily.

#### skipIfUnchanged

**Type**: `boolean`
**Default**: `true`

Skip regeneration if the configuration and templates haven't changed since the last run. This prevents adding unchanged files to your git staging area.

You can override this on the command line with `pipecraft generate --force`.

#### cacheFile

**Type**: `string`
**Default**: `".pipecraft-cache.json"`

Where to store hashes of your configuration and templates for change detection. This file should be gitignored—it's purely for local optimization.

#### hashAlgorithm

**Type**: `string`
**Default**: `"sha256"`

Which hashing algorithm to use for change detection. Unless you have specific requirements, the default is fine.

#### ignorePatterns

**Type**: `string[]`
**Default**: `[]`

Glob patterns for files to ignore when determining if regeneration is needed. Useful if you have documentation or comments in your configuration that change frequently but don't affect workflow generation.

```json
{
  "ignorePatterns": ["*.md", "docs/**", "# comments"]
}
```

## Complete Example Configuration

Here's a comprehensive example showing all major configuration options working together:

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

  "domains": {
    "api": {
      "paths": [
        "apps/api/**",
        "libs/api-core/**",
        "libs/shared/**"
      ],
      "description": "API services and shared business logic"
    },
    "web": {
      "paths": [
        "apps/web/**",
        "libs/ui-components/**",
        "libs/shared/**"
      ],
      "description": "Web application and reusable UI components"
    },
    "mobile": {
      "paths": [
        "apps/mobile/**",
        "libs/mobile-components/**",
        "libs/shared/**"
      ],
      "description": "Mobile application for iOS and Android"
    },
    "infrastructure": {
      "paths": [
        "infrastructure/**",
        "docker/**",
        ".github/workflows/**"
      ],
      "description": "Infrastructure as code and deployment configurations"
    }
  },

  "versioning": {
    "enabled": true,
    "releaseItConfig": ".release-it.cjs",
    "conventionalCommits": true,
    "autoTag": true,
    "autoPush": true,
    "changelog": true
  },

  "rebuild": {
    "enabled": true,
    "skipIfUnchanged": true,
    "cacheFile": ".pipecraft-cache.json",
    "ignorePatterns": ["*.md", "docs/**"]
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
