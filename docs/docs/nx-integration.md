# Nx Integration Guide

PipeCraft provides first-class support for [Nx](https://nx.dev) monorepos, automatically detecting affected projects using Nx's dependency graph and mapping them to your configured domains.

## Overview

When you run PipeCraft in an Nx workspace, the generated detect-changes action will:

1. **Auto-detect Nx** - Checks for `nx.json` or Nx in `package.json`
2. **Use Nx dependency graph** - Runs `nx show projects --affected` to find impacted projects
3. **Map to domains** - Matches Nx projects to your PipeCraft domains
4. **Fallback gracefully** - Uses path-based detection if Nx is unavailable

This means your CI/CD pipeline only runs tests and deployments for domains that are actually affected by changes, leveraging Nx's powerful dependency analysis.

## Quick Start

### 1. Configure Domains in `.pipecraftrc.json`

```json
{
  "ciProvider": "github",
  "mergeStrategy": "fast-forward",
  "requireConventionalCommits": true,
  "packageManager": "npm",
  "initialBranch": "develop",
  "finalBranch": "main",
  "branchFlow": ["develop", "staging", "main"],
  "domains": {
    "api": {
      "paths": ["apps/api/**"],
      "description": "Backend API services",
      "testable": true,
      "deployable": true
    },
    "web": {
      "paths": ["apps/web/**"],
      "description": "Frontend web application",
      "testable": true,
      "deployable": true
    },
    "mobile": {
      "paths": ["apps/mobile/**"],
      "description": "Mobile applications",
      "testable": true,
      "deployable": true
    },
    "shared": {
      "paths": ["libs/**"],
      "description": "Shared libraries",
      "testable": true,
      "deployable": false
    }
  }
}
```

**Package Manager Support**: PipeCraft automatically detects your package manager during init and uses it for dependency installation in Nx workflows. The install commands use frozen lockfiles when available (`npm ci`, `yarn install --frozen-lockfile`, `pnpm install --frozen-lockfile`) with automatic fallback to regular install if lockfiles are missing.

### 2. Generate Workflows

```bash
pipecraft generate
```

The generated `.github/actions/detect-changes/action.yml` will automatically include Nx support!

### 3. Verify Nx Mappings

Check that all your Nx projects are properly mapped to domains:

```bash
pipecraft check-sync --nx
```

Output example:
```
🔍 Checking Nx project mappings...

📦 Found 12 Nx projects

📋 Domain Mappings:

  api:
    ✅ api
    ✅ api-e2e

  web:
    ✅ web
    ✅ web-e2e

  mobile:
    ✅ mobile-ios
    ✅ mobile-android

  shared:
    ✅ shared-ui
    ✅ shared-utils
    ✅ shared-api-client

✅ All Nx projects are mapped to domains!
```

## Domain Mapping Strategies

### Strategy 1: Automatic Inference (Recommended)

PipeCraft automatically extracts keywords from your domain `paths` and matches them against Nx project names:

```json
{
  "domains": {
    "api": {
      "paths": ["apps/api/**", "libs/api-*/**"]
      // Matches: api, api-gateway, my-api, api-utils, etc.
    }
  }
}
```

**How it works:**
- Extracts keywords: `api`, `libs`
- Creates word-boundary pattern: `(^|[-_])api([-_]|$)`
- Matches: `api`, `api-gateway`, `mobile-api`
- **Does NOT match:** `graphapi`, `api` (would need exact or pattern match)

### Strategy 2: Explicit Nx Projects

For precise control, use the `nxProjects` field with glob-like patterns:

```json
{
  "domains": {
    "api": {
      "paths": ["apps/api/**"],
      "nxProjects": [
        "api",           // Exact match
        "api-*",         // Prefix: api-gateway, api-auth
        "*-api",         // Suffix: mobile-api, admin-api
        "api-*-service"  // Pattern: api-user-service, api-order-service
      ],
      "testable": true
    }
  }
}
```

### Strategy 3: Hybrid Approach

Combine automatic inference with explicit overrides:

```json
{
  "domains": {
    "frontend": {
      "paths": ["apps/web/**", "apps/mobile/**"],
      "nxProjects": ["web", "web-e2e", "mobile-ios", "mobile-android"],
      "testable": true
    },
    "backend": {
      "paths": ["apps/api/**", "apps/services/**"],
      // Auto-infers from paths: api, services
      "testable": true
    }
  }
}
```

## Pattern Matching Examples

### Matching Rules

| Pattern | Matches | Does NOT Match |
|---------|---------|----------------|
| `api` | `api` only | `api-gateway`, `my-api` |
| `api-*` | `api-gateway`, `api-auth` | `api`, `my-api` |
| `*-api` | `mobile-api`, `admin-api` | `api`, `api-gateway` |
| `*api*` | `api`, `my-api`, `graphapi` | `my-service` |

### Common Patterns

```json
{
  "domains": {
    "frontend-apps": {
      "nxProjects": ["web", "mobile-*", "*-ui"]
      // Matches: web, mobile-ios, mobile-android, admin-ui
    },
    "backend-services": {
      "nxProjects": ["api", "api-*", "*-service"]
      // Matches: api, api-gateway, user-service, order-service
    },
    "shared-libs": {
      "nxProjects": ["shared-*", "lib-*", "*-utils"]
      // Matches: shared-ui, lib-core, date-utils
    }
  }
}
```

## Checking Sync Status

### Basic Check

```bash
pipecraft check-sync --nx
```

Shows which Nx projects are mapped to which domains.

### Get Mapping Suggestions

```bash
pipecraft check-sync --nx --suggest
```

If you have unmapped projects, PipeCraft will suggest domain mappings:

```
⚠️  Unmapped Projects:

    ❓ storybook
    ❓ docs-site
    ❓ e2e-tests

💡 Suggested Mappings:

    storybook → shared, docs
    docs-site → docs
    e2e-tests → (create new domain?)

⚠️  3 project(s) are not mapped to any domain.
💡 Tip: Add nxProjects field to domain config or adjust paths patterns.
    Run with --suggest to see mapping suggestions.
```

## Auto-Regeneration Detection

PipeCraft automatically detects when your Nx workspace structure changes and prompts you to regenerate:

```bash
# When nx.json changes
pipecraft generate
# ⚠️  nx.json has changed - consider running: pipecraft check-sync --nx

# When project.json files change
pipecraft generate
# ⚠️  apps/new-api/project.json has changed - consider running: pipecraft check-sync --nx
```

### Tracked Nx Files

PipeCraft's idempotency system automatically tracks:
- `nx.json` - Workspace configuration
- `**/project.json` - Individual project configurations

When these change, workflows are regenerated and you're prompted to verify mappings.

## How It Works

### Generated Action Flow

```yaml
# .github/actions/detect-changes/action.yml

- name: Check for Nx
  run: |
    if [ -f "nx.json" ]; then
      echo "available=true" >> $GITHUB_OUTPUT
      echo "🔍 Nx detected"
    fi

- name: Detect Changes with Nx
  if: steps.nx-check.outputs.available == 'true'
  run: |
    # Get affected Nx projects
    AFFECTED=$(npx nx show projects --affected --base=main)

    # Map to domains
    for project in $AFFECTED; do
      if echo "$project" | grep -qE "(^|[-_])api([-_]|$)"; then
        API_AFFECTED=true
      fi
    done

- name: Fallback to Path-Based Detection
  if: steps.nx-check.outputs.available != 'true'
  uses: dorny/paths-filter@v3
  # Uses domain paths as fallback
```

### Runtime Behavior

**With Nx:**
```bash
# PR changes apps/api/src/user.ts
nx show projects --affected
# → api, api-e2e, shared-api-client (due to dependencies)

# PipeCraft maps these to domains:
# api → "api" domain
# api-e2e → "api" domain
# shared-api-client → "shared" domain

# Result: Only "api" and "shared" domain tests run
```

**Without Nx:**
```bash
# Falls back to path-based detection
# apps/api/src/user.ts changed → "api" domain affected
```

## Best Practices

### 1. Use Broad Patterns for Flexibility

```json
{
  "domains": {
    "api": {
      "paths": ["apps/api/**", "apps/*-api/**", "libs/api-*/**"],
      // Automatically handles: api, mobile-api, api-client, etc.
    }
  }
}
```

### 2. Organize by Deployment Units

```json
{
  "domains": {
    "customer-portal": {
      "nxProjects": ["customer-web", "customer-api", "customer-*"],
      "deployable": true
    },
    "admin-portal": {
      "nxProjects": ["admin-web", "admin-api", "admin-*"],
      "deployable": true
    }
  }
}
```

### 3. Separate Libraries by Purpose

```json
{
  "domains": {
    "ui-libs": {
      "nxProjects": ["*-ui", "shared-components"],
      "testable": true,
      "deployable": false
    },
    "data-libs": {
      "nxProjects": ["*-data", "*-api-client"],
      "testable": true,
      "deployable": false
    }
  }
}
```

### 4. Regular Sync Checks

Add to your workflow:

```yaml
- name: Check Nx Sync
  run: pipecraft check-sync --nx --suggest
```

Or run locally after adding new Nx projects:

```bash
nx g @nx/react:app new-app
pipecraft check-sync --nx --suggest
# Adjust .pipecraftrc.json if needed
pipecraft generate --force
```

## Troubleshooting

### Problem: Project not being detected

**Check pattern matching:**
```bash
pipecraft check-sync --nx --suggest
```

**Solution:** Add explicit `nxProjects` mapping:
```json
{
  "domains": {
    "api": {
      "paths": ["apps/api/**"],
      "nxProjects": ["api", "api-gateway", "special-service"]
    }
  }
}
```

### Problem: Too many projects mapped to one domain

**Solution:** Create more specific domains or use exact matching:
```json
{
  "domains": {
    "api-core": {
      "nxProjects": ["api"],  // Exact match only
      "description": "Core API"
    },
    "api-services": {
      "nxProjects": ["api-*"],  // Services only
      "description": "API microservices"
    }
  }
}
```

### Problem: Nx not being detected in CI

**Check GitHub Actions workflow:**
```yaml
- name: Setup Node
  uses: actions/setup-node@v4
  with:
    node-version: '18'
    cache: 'npm'

- name: Install Dependencies
  run: npm ci  # Installs Nx

- name: Detect Changes
  uses: ./.github/actions/detect-changes
  # Now Nx will be available
```

## Advanced: Custom Nx Commands

If you need custom Nx affected logic, you can override the generated action or create a custom one:

```yaml
# Custom affected detection
- name: Custom Nx Affected
  run: |
    # Get affected projects with custom base
    AFFECTED=$(npx nx show projects --affected \
      --base=origin/main \
      --head=HEAD \
      --exclude=e2e-*)

    # Custom domain mapping logic
    for project in $AFFECTED; do
      case "$project" in
        *-api|*-service)
          echo "backend=true" >> $GITHUB_OUTPUT
          ;;
        *-web|*-mobile)
          echo "frontend=true" >> $GITHUB_OUTPUT
          ;;
      esac
    done
```

## Example: Full Nx Monorepo Setup

See the [pipecraft-example-nx](https://github.com/jamesvillarrubia/pipecraft-example-nx) repository for a complete working example including:
- Multi-app Nx workspace
- PipeCraft configuration
- Generated workflows
- Domain mapping strategies
- CI/CD pipeline running in GitHub Actions

## Next Steps

- [Configuration Reference](./configuration-reference.md) - All domain options
- [Workflow Generation](./workflow-generation.md) - How workflows are generated
- [CLI Reference](./cli-reference.md) - All CLI commands
- [Examples](./examples.md) - More configuration examples
