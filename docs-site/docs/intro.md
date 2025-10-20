---
sidebar_position: 1
slug: /
---

# Getting Started with PipeCraft

Welcome to **PipeCraft** - your automated CI/CD pipeline generator for trunk-based development workflows.

## What is PipeCraft?

PipeCraft automatically generates comprehensive GitHub Actions workflows tailored for trunk-based development. It handles:

- 🚀 **Automated branch promotions** (develop → staging → main)
- 🔍 **Domain-based change detection** for monorepos
- 📦 **Semantic versioning** with conventional commits
- 🏷️ **Automated tagging and releases**
- ✅ **Idempotent workflow generation**

## Quick Start

### Installation

```bash
npm install -g pipecraft
# or
pnpm add -g pipecraft
```

### Initialize Your Project

```bash
cd your-project
pipecraft init
```

This creates a `.pipecraftrc.json` configuration file.

### Generate Workflows

```bash
pipecraft generate
```

This creates:
- `.github/workflows/pipeline.yml` - Main CI/CD pipeline
- `.github/actions/*` - Reusable composite actions

## Key Features

### 🌳 Trunk-Based Development

PipeCraft enforces trunk-based development best practices:
- Feature branches merge to `develop`
- Automated promotion through staging
- Safe deployments to `main`

### 🎯 Domain-Based Change Detection

Perfect for monorepos:

```json
{
  "domains": {
    "api": { "paths": ["apps/api/**"] },
    "web": { "paths": ["apps/web/**"] },
    "shared": { "paths": ["libs/**"] }
  }
}
```

Only builds what changed!

### 📝 Conventional Commits

Automatic semantic versioning based on commit messages:

```bash
feat: Add new feature     # → 1.1.0 (minor)
fix: Fix bug              # → 1.0.1 (patch)
feat!: Breaking change    # → 2.0.0 (major)
```

### ♻️ Idempotent Regeneration

Regenerate workflows safely:
- Preserves user comments
- Only updates when needed
- Fast and efficient

## Next Steps

- 📖 [Understanding Trunk Flow](./trunk-flow.md)
- 🏗️ [Architecture Overview](./architecture.md)
- ⚠️ [Error Handling](./error-handling.md)
- 🧪 [Testing Guide](./testing-guide.md)
- 📚 [API Reference](./api/README.md)

## Configuration Example

```json
{
  "ciProvider": "github",
  "mergeStrategy": "fast-forward",
  "requireConventionalCommits": true,
  "initialBranch": "develop",
  "finalBranch": "main",
  "branchFlow": ["develop", "staging", "main"],
  "domains": {
    "api": {
      "paths": ["apps/api/**"],
      "description": "Backend API"
    },
    "web": {
      "paths": ["apps/web/**"],
      "description": "Frontend Web App"
    }
  },
  "semver": {
    "bumpRules": {
      "feat": "minor",
      "fix": "patch",
      "breaking": "major"
    }
  }
}
```

## Support

- 🐛 [Report Issues](https://github.com/jamesvillarrubia/pipecraft/issues)
- 💬 [Discussions](https://github.com/jamesvillarrubia/pipecraft/discussions)
- 📦 [npm Package](https://www.npmjs.com/package/pipecraft)

## License

MIT © 2024 PipeCraft Contributors
