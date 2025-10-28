---
sidebar_position: 3
---

# Configuration Reference

This page provides a comprehensive reference for all PipeCraft configuration options, with detailed explanations, defaults, and examples.

## Domain Configuration

Each domain in your `domains` object represents a logical part of your codebase with independent test and deployment requirements.

### Domain Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `paths` | `string[]` | **required** | Glob patterns matching files in this domain |
| `description` | `string` | **required** | Human-readable description |
| `testable` | `boolean` | `true` | Generate test jobs for this domain |
| `deployable` | `boolean` | `false` | Generate deployment jobs for this domain |
| `remoteTestable` | `boolean` | `false` | Generate remote test jobs (runs after deployment) |

### Understanding Domain Capabilities

#### Testable Domains
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
      "testable": false  // No tests needed
    }
  }
}
```

#### Deployable Domains
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
      "deployable": true  // Deploy after tests pass
    }
  }
}
```

#### Remote Testable Domains
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
      "remoteTestable": true  // Test deployed app
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

### Example Configurations

**Full-stack monorepo with different requirements**:
```json
{
  "domains": {
    "api": {
      "paths": ["services/api/**"],
      "description": "Backend API",
      "testable": true,
      "deployable": true,
      "remoteTestable": true
    },
    "web": {
      "paths": ["apps/web/**"],
      "description": "Frontend",
      "testable": true,
      "deployable": true,
      "remoteTestable": false  // No remote tests needed
    },
    "shared": {
      "paths": ["libs/**"],
      "description": "Shared libraries",
      "testable": true,
      "deployable": false,  // Libraries aren't deployed
      "remoteTestable": false
    },
    "docs": {
      "paths": ["docs/**"],
      "description": "Documentation",
      "testable": false,  // No tests for docs
      "deployable": true,  // Deploy to docs site
      "remoteTestable": false
    }
  }
}
```

## Complete Configuration Schema

### Basic Configuration

```json
{
  "ciProvider": "github",
  "mergeStrategy": "fast-forward",
  "requireConventionalCommits": true,
  "initialBranch": "develop",
  "finalBranch": "main",
  "branchFlow": ["develop", "staging", "main"],
  "autoMerge": {
    "staging": true,
    "main": true
  },
  "semver": {
    "bumpRules": {
      "feat": "minor",
      "fix": "patch",
      "breaking": "major"
    }
  },
  "domains": {
    // Domain configurations as described above
  }
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ciProvider` | `"github" \| "gitlab"` | `"github"` | CI/CD platform |
| `mergeStrategy` | `"fast-forward" \| "merge"` | `"fast-forward"` | Git merge strategy |
| `requireConventionalCommits` | `boolean` | `true` | Enforce conventional commit format |
| `packageManager` | `"npm" \| "yarn" \| "pnpm"` | `"npm"` | Package manager for dependency installation |
| `initialBranch` | `string` | `"develop"` | First branch in promotion flow |
| `finalBranch` | `string` | `"main"` | Final production branch |
| `branchFlow` | `string[]` | `["develop", "staging", "main"]` | Ordered branch promotion sequence |
| `autoMerge` | `boolean \| Record<string, boolean>` | `false` | Auto-merge configuration |
| `semver.bumpRules` | `Record<string, string>` | See above | Version bump rules |

### Advanced Configuration

#### Auto-Merge Settings

```json
{
  "autoMerge": {
    "staging": true,   // Auto-merge PRs to staging
    "main": false     // Manual review for main
  }
}
```

#### Package Manager Configuration

PipeCraft automatically detects your package manager during `pipecraft init` by checking for lockfiles, but you can explicitly configure it:

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
- **Install commands**:
  - `npm`: `npm ci` (with fallback to `npm install`)
  - `yarn`: `yarn install --frozen-lockfile` (with fallback to `yarn install`)
  - `pnpm`: `pnpm install --frozen-lockfile` (with fallback to `pnpm install`)

**When to set explicitly:**
```json
{
  "packageManager": "pnpm",  // Explicit configuration
  "nx": {
    "enabled": true
  }
}
```

Use explicit configuration when:
- You use a package manager but haven't committed the lockfile yet
- You want to enforce a specific package manager across your team
- You're migrating between package managers

#### Custom Version Bump Rules

```json
{
  "semver": {
    "bumpRules": {
      "feat": "minor",
      "fix": "patch",
      "breaking": "major",
      "docs": "patch",
      "style": "patch",
      "refactor": "minor"
    }
  }
}
```

#### Idempotency Configuration

```json
{
  "rebuild": {
    "enabled": true,
    "skipIfUnchanged": true,
    "forceRegenerate": false,
    "watchMode": false,
    "hashAlgorithm": "sha256",
    "cacheFile": ".pipecraft-cache",
    "ignorePatterns": ["node_modules/**", ".git/**"]
  }
}
```

## Best Practices

### Domain Organization
- **Group related functionality**: Keep API routes, services, and tests together
- **Minimize cross-domain dependencies**: Each domain should be independently testable
- **Use descriptive names**: `api`, `web`, `mobile` are clearer than `app1`, `app2`

### Path Patterns
- **Be specific**: Use `apps/api/**` instead of `**/api/**` to avoid false positives
- **Include dependencies**: Add shared libraries to dependent domains
- **Test coverage**: Ensure all testable domains have comprehensive path coverage

### Capability Selection
- **Testable**: Enable for all code that has tests
- **Deployable**: Enable for services that need deployment
- **Remote Testable**: Enable for services that need post-deployment validation

### Branch Flow Design
- **Keep it simple**: 2-3 branches are usually sufficient
- **Match your process**: Align with your team's existing workflow
- **Consider environments**: Each branch typically maps to an environment