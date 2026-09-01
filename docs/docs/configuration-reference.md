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
  "packageManager": "pnpm"
}
```

### runtime

**Type**: `object`
**Required**: No
**Default**: `{ nodeVersion: '22', pnpmVersion: '10' }`

Controls the Node.js and pnpm versions used in generated CI/CD workflows, so you can pin or bump them from config instead of hand-editing `pipeline.yml`.

```json
{
  "runtime": {
    "nodeVersion": "22",
    "pnpmVersion": "10"
  }
}
```

**Properties:**

- **nodeVersion** (`string`, optional): Node.js version for workflows. Accepts a major (e.g. `'22'`, `'24'`) or an exact version (e.g. `'22.18.0'`). Default: `'22'`.
- **pnpmVersion** (`string`, optional): pnpm version for workflows (used when the project installs with pnpm). Accepts a major (e.g. `'10'`) or an exact version (e.g. `'10.6.2'`). Default: `'10'`.

**Impact on generated workflows:**

- Sets the `NODE_VERSION` and `PNPM_VERSION` env vars in `pipeline.yml`
- The `version` job passes `NODE_VERSION` into the `calculate-version` action

**Authority and preservation:**

- When a value is set in `runtime`, it is **authoritative** — regeneration overwrites the corresponding env var with the configured value.
- When unset, the existing value in `pipeline.yml` is **preserved**, falling back to the defaults on first generation.

> Tip: pin `pnpmVersion` (e.g. `'10'`) to avoid `pnpm/action-setup`'s `latest` pulling a major release with breaking changes into CI.

### Checkout depth

Two env vars in the generated `pipeline.yml` control how much history each job fetches.
Both are preserved across regeneration, so edit them in the workflow and they stick.

| Variable                 | Default | Used by                        |
| ------------------------ | ------- | ------------------------------ |
| `FETCH_DEPTH_AFFECTED`   | `100`   | change detection               |
| `FETCH_DEPTH_VERSIONING` | `0`     | version, tag, promote, release |

`FETCH_DEPTH_AFFECTED` bounds the diff used to decide which domains changed. 100 commits
covers a normal pull request. Raise it if your branches diverge by more than that, or set
`0` for complete history at the cost of a slower checkout.

`FETCH_DEPTH_VERSIONING` must stay `0`. Semantic versioning reads the full tag history, and
a shallow fetch silently resolves the wrong previous version.

The `version` job checks out with `filter: blob:none`, a partial clone. It fetches every
commit and every tag, and skips the historical file contents it never reads.

It does not skip blobs entirely. `actions/checkout` still builds a working tree, so Git
fetches the files at the checked-out commit. You pay for one commit's files instead of every
version of every file in the history. Measured on a 20-commit repository with one large file
rewritten each time: 428 KB against 6040 KB, and the gap widens with history length.

Two things to know:

- **Partial clone needs the server to allow it.** GitHub does. A self-hosted Git server
  without `uploadpack.allowFilter` ignores the filter and sends everything, with no error
  and no saving.
- **A missing blob costs a round trip.** If a step reads a file, Git fetches that blob on
  demand, so the filter cannot break a step that needs one. Today the job runs only
  `calculate-version`, which reads tags and commit subjects.

`tag` and `promote` are deliberately left unfiltered: both move refs and can merge, so they
may legitimately need file contents.

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
      "prefixes": ["test", "deploy"]
    },
    "web": {
      "paths": ["apps/web/**", "libs/ui-components/**"],
      "description": "Web application and UI components",
      "prefixes": ["test", "deploy", "remote-test"]
    },
    "mobile": {
      "paths": ["apps/mobile/**"],
      "description": "Mobile application",
      "prefixes": ["test"]
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

#### prefixes (optional)

**Type**: `string[]`
**Default**: none

The job types PipeCraft generates for this domain. Each entry produces one job named
`{prefix}-{domain}`.

```json
{
  "domains": {
    "api": {
      "paths": ["apps/api/**"],
      "description": "API service",
      "prefixes": ["test", "deploy"]
    }
  }
}
```

That config generates `test-api` and `deploy-api`. Each job:

- Only runs when the domain has changes
- Runs in parallel with the other domains' jobs of the same prefix
- Must pass (or be skipped) before versioning and promotion

Three prefixes have wiring in the managed jobs:

| Prefix        | Job                    | Runs                                      |
| ------------- | ---------------------- | ----------------------------------------- |
| `test`        | `test-{domain}`        | On changes, before versioning             |
| `deploy`      | `deploy-{domain}`      | After tests pass and the version resolves |
| `remote-test` | `remote-test-{domain}` | After `deploy-{domain}` succeeds          |

Any other prefix generates a placeholder job you can fill in, so `prefixes: ["lint", "build", "test"]`
produces `lint-api`, `build-api` and `test-api`.

**A domain with no `prefixes` and no legacy flags generates no jobs of its own.** It still
takes part in change detection, so `changes` reports whether it was touched, but nothing
runs. If you configured a domain and see no jobs in `pipeline.yml`, this is why.

#### testable / deployable / remoteTestable (deprecated)

**Type**: `boolean`

Superseded by `prefixes`. PipeCraft translates them during config load, so they still work:

| Legacy flag              | Equivalent                    |
| ------------------------ | ----------------------------- |
| `"testable": true`       | `"prefixes": ["test"]`        |
| `"deployable": true`     | `"prefixes": ["deploy"]`      |
| `"remoteTestable": true` | `"prefixes": ["remote-test"]` |

Set several and they combine, so `"testable": true, "deployable": true` is
`"prefixes": ["test", "deploy"]`. A flag set to `false` contributes nothing.

Two things to know:

- **Only flags you write are translated.** These are not applied by default, so a domain
  that mentions neither `prefixes` nor any flag gets no jobs.
- **`prefixes` wins.** If a domain has both, the flags are ignored entirely.

`generate` warns when a domain uses them. Migrate by replacing the flags with the
equivalent `prefixes` array; the generated workflow is identical.

### Workflow Phase Flow

Domains flow through phases according to their `prefixes`:

**Domain with `prefixes: ["test", "deploy", "remote-test"]`**:

1. **Change Detection** → Determines if domain changed
2. **Test** (`test-{domain}`) → Runs if changed
3. **Version** → Calculates next version (after all tests)
4. **Deploy** (`deploy-{domain}`) → Deploys if changed and tests passed
5. **Remote Test** (`remote-test-{domain}`) → Tests deployed service
6. **Tag** → Creates git tag if all deployments/remote tests passed
7. **Promote** → Creates PR to next branch
8. **Release** → Creates GitHub release (on final branch only)

**Domain with `prefixes: ["test"]`**:

1. Change Detection → Test → Version → Tag → Promote → Release

**Domain with `prefixes: ["test", "deploy"]`**:

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
      "prefixes": ["test", "deploy", "remote-test"]
    },
    "web": {
      "paths": ["apps/web/**", "libs/ui-components/**", "libs/shared/**"],
      "description": "Web application and reusable UI components",
      "prefixes": ["test", "deploy", "remote-test"]
    },
    "mobile": {
      "paths": ["apps/mobile/**", "libs/mobile-components/**", "libs/shared/**"],
      "description": "Mobile application for iOS and Android",
      "prefixes": ["test"]
    },
    "infrastructure": {
      "paths": ["infrastructure/**", "docker/**", ".github/workflows/**"],
      "description": "Infrastructure as code and deployment configurations",
      "prefixes": []
    }
  }
}
```

## Action Reference Configuration

### actionSourceMode

**Type**: `'local' | 'remote' | 'source'`
**Required**: No
**Default**: `'local'`

Controls how generated workflows reference GitHub Actions. This determines whether actions are copied into your repository, referenced from the marketplace, or used from source.

```json
{
  "actionSourceMode": "local"
}
```

**Available modes**:

- **`local`** (default): Actions are copied to `.github/actions/` where you can customize them

  - Full control over action code
  - Larger repository size
  - Must manually update actions
  - Best for: Teams that need customization

- **`remote`**: Actions are referenced from GitHub Marketplace with version pinning

  - No action code in your repository
  - Explicit version control via `actionVersion`
  - Can't customize actions
  - Best for: Teams that prefer marketplace stability

- **`source`**: Actions are referenced from `/actions/` directory
  - Used by PipeCraft repository itself
  - For testing actions before marketplace publication
  - Not recommended for general use
  - Best for: PipeCraft contributors

For detailed information about each mode, trade-offs, and migration strategies, see [Action Reference Modes](action-modes.md).

### actionVersion

**Type**: `string`
**Required**: No (only used when `actionSourceMode` is `'remote'`)
**Default**: `'v1'`

Specifies which version of marketplace actions to use when `actionSourceMode` is `'remote'`. Follows GitHub Actions version pinning conventions.

```json
{
  "actionSourceMode": "remote",
  "actionVersion": "v1"
}
```

**Version pinning strategies**:

- **Major version**: `"v1"` - Gets automatic minor and patch updates (recommended)
- **Minor version**: `"v1.2"` - Gets automatic patch updates only
- **Exact version**: `"v1.2.3"` - No automatic updates (maximum stability)

This option is ignored when `actionSourceMode` is `'local'` or `'source'`.

**Example with remote mode**:

```json
{
  "actionSourceMode": "remote",
  "actionVersion": "v1",
  "branchFlow": ["develop", "staging", "main"],
  "domains": {
    "core": {
      "paths": ["src/**"],
      "description": "Core application code"
    }
  }
}
```

The generated workflows will reference actions like:

```yaml
- uses: the-craftlab/pipecraft/actions/detect-changes@v1
- uses: the-craftlab/pipecraft/actions/calculate-version@v1
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
