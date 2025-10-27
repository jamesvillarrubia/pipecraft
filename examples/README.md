# PipeCraft Examples

This directory contains example repositories demonstrating different PipeCraft configurations and use cases.

## Available Examples

### 1. [pipecraft-example-minimal](./pipecraft-example-minimal/)
**Perfect for: Getting started in 5 minutes**

The simplest possible PipeCraft configuration.

- **Complexity:** ⭐ Minimal
- **Branches:** 2 (develop → main)
- **Domains:** 1 (single app)
- **Auto-merge:** ✅ Enabled
- **Initial Tag:** ❌ None (demonstrates bootstrap)
- **Use Case:** Quickstart, learning PipeCraft basics

```bash
cd pipecraft-example-minimal
npm test
```

---

### 2. [pipecraft-example-basic](./pipecraft-example-basic/)
**Perfect for: Multi-service applications**

Standard trunk-based workflow with multiple domains.

- **Complexity:** ⭐⭐ Medium
- **Branches:** 3 (develop → staging → main)
- **Domains:** 4 (frontend, backend, api, shared)
- **Auto-merge:** ✅ Enabled
- **Initial Tag:** ✅ v0.1.0
- **Use Case:** Standard web applications, microservices

```bash
cd pipecraft-example-basic
npm test
npm run test:frontend  # Test specific domain
```

---

### 3. [pipecraft-example-nx](./pipecraft-example-nx/)
**Perfect for: Large monorepos with Nx**

Advanced Nx monorepo with mixed detection strategies.

- **Complexity:** ⭐⭐⭐ High
- **Branches:** 3 (develop → staging → main)
- **Domains:** 10+ Nx projects + 2 path-based (infra, migrations)
- **Auto-merge:** ✅ Enabled
- **Initial Tag:** ✅ v0.1.0
- **Use Case:** Large monorepos, complex dependencies, Nx workspaces

```bash
cd pipecraft-example-nx
npm test
npx nx graph  # View dependency graph
```

---

### 4. [pipecraft-example-gated](./pipecraft-example-gated/)
**Perfect for: Enterprise with approval gates**

Gated workflow with manual approvals at each stage.

- **Complexity:** ⭐⭐ Medium
- **Branches:** 5 (develop → alpha → beta → release → production)
- **Domains:** 4 (services, web, api, shared)
- **Auto-merge:** ❌ Disabled (manual PRs)
- **Initial Tag:** ✅ v1.0.0
- **Use Case:** Enterprise workflows, compliance requirements, scheduled releases

```bash
cd pipecraft-example-gated
npm test
```

---

## Quick Comparison

| Feature | Minimal | Basic | Nx | Gated |
|---------|---------|-------|-----|-------|
| **Complexity** | Simplest | Standard | Advanced | Enterprise |
| **Branch Flow** | 2-branch | 3-branch | 3-branch | 5-branch |
| **Domains** | 1 | 4 | 10+ | 4 |
| **Auto-merge** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Merge Strategy** | fast-forward | fast-forward | fast-forward | merge |
| **Nx Integration** | ❌ No | ❌ No | ✅ Yes | ❌ No |
| **Bootstrap Test** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Manual Gates** | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **Best For** | Learning | Standard apps | Monorepos | Enterprise |

## Choosing an Example

### Start with Minimal if:
- 👋 You're new to PipeCraft
- 🚀 You want to get started quickly
- 📚 You're learning trunk-based development
- 🧪 You want to test PipeCraft locally

### Use Basic if:
- 🏢 You have multiple independent services
- 📦 You're NOT using a monorepo tool (Nx, Turborepo)
- ⚡ You want fast, automated deployments
- 🔄 You practice continuous deployment

### Use Nx if:
- 🏗️ You have a large monorepo (10+ packages)
- 📊 You need dependency-aware change detection
- 🎯 You're already using Nx
- 🔧 You have infrastructure as separate domains

### Use Gated if:
- 🏛️ You need human approval before production
- ✅ You have QA sign-off requirements
- 📋 You need compliance/audit trails
- ⏰ You deploy on scheduled windows

---

## Using as Templates

### Option 1: Clone and Modify

```bash
# Clone an example
git clone https://github.com/jamesvillarrubia/pipecraft-example-basic.git my-project
cd my-project

# Update remote
git remote set-url origin https://github.com/yourusername/your-project.git

# Customize
# 1. Edit .pipecraftrc.json with your domains
# 2. Update package.json name and repository
# 3. Regenerate workflows
npx pipecraft generate

# Push to your repo
git push -u origin develop
```

### Option 2: Use as Reference

1. Review the example's configuration
2. Copy relevant parts to your project
3. Run `pipecraft init` in your project
4. Customize the generated config
5. Run `pipecraft generate`

---

## Configuration Patterns

### Basic Multi-Domain
```json
{
  "branchFlow": ["develop", "staging", "main"],
  "autoMerge": { "staging": true, "main": true },
  "domains": {
    "frontend": { "paths": ["src/frontend/**"] },
    "backend": { "paths": ["src/backend/**"] }
  }
}
```

### Nx Integration
```json
{
  "branchFlow": ["develop", "staging", "main"],
  "domains": {
    "infra": { "paths": ["infra/**"] }
  },
  "nx": {
    "enabled": true,
    "tasks": ["lint", "test", "build"],
    "baseRef": "origin/main"
  }
}
```

### Gated Workflow
```json
{
  "branchFlow": ["develop", "alpha", "beta", "release", "production"],
  "mergeStrategy": "merge",
  "autoMerge": {
    "alpha": false,
    "beta": false,
    "release": false,
    "production": false
  }
}
```

---

## Testing Examples Locally

All examples can be tested locally before pushing to GitHub:

```bash
# Run tests
npm test

# Run builds
npm run build

# Test specific domain (basic, gated)
npm run test:frontend

# View Nx graph (nx only)
npm run graph

# Test affected projects (nx only)
npm run affected:test
```

---

## Example Workflows

### Development Flow (All Examples)

```bash
# 1. Check out develop branch
git checkout develop
git pull origin develop

# 2. Make changes
echo "// new feature" >> src/index.js

# 3. Commit with conventional format
git add .
git commit -m "feat: add new feature"

# 4. Push to trigger workflow
git push origin develop

# 5. Watch workflow run
gh run watch
```

### Viewing Results

```bash
# List recent workflow runs
gh run list

# View specific run
gh run view <run-id>

# Check current branch
git branch --show-current

# List tags (check version created)
git tag --sort=-creatordate | head -5
```

---

## Common Configuration Options

### Branch Flows

```json
// 2-branch (minimal)
"branchFlow": ["develop", "main"]

// 3-branch (standard)
"branchFlow": ["develop", "staging", "main"]

// 4-branch
"branchFlow": ["develop", "qa", "staging", "main"]

// 5-branch (gated)
"branchFlow": ["develop", "alpha", "beta", "release", "production"]
```

### Auto-merge Strategies

```json
// All automatic
"autoMerge": {
  "staging": true,
  "main": true
}

// Partial automation
"autoMerge": {
  "staging": true,
  "main": false  // Manual PR to main
}

// All manual (gated)
"autoMerge": {
  "alpha": false,
  "beta": false,
  "release": false,
  "production": false
}
```

### Domain Configurations

```json
// Independent services
"domains": {
  "frontend": {
    "paths": ["src/frontend/**"],
    "test": true,
    "deployable": true
  },
  "backend": {
    "paths": ["src/backend/**"],
    "test": true,
    "deployable": true
  }
}

// With shared libraries
"domains": {
  "api": {
    "paths": ["src/api/**"],
    "deployable": true
  },
  "shared": {
    "paths": ["src/shared/**"],
    "deployable": false  // Not deployed independently
  }
}
```

---

## Troubleshooting Examples

### Example Not Working?

1. **Check Node version:**
   ```bash
   node --version  # Should be 18+
   ```

2. **Verify configuration:**
   ```bash
   cat .pipecraftrc.json | jq .
   ```

3. **Run tests locally:**
   ```bash
   npm test
   npm run build
   ```

4. **Check for errors:**
   ```bash
   npm run build 2>&1 | grep -i error
   ```

### Workflow Not Triggering?

1. Ensure workflow file is committed:
   ```bash
   git ls-files .github/workflows/
   ```

2. Check branch name matches config:
   ```bash
   git branch --show-current
   ```

3. Verify GitHub Actions enabled (in repo settings)

### Version Not Creating?

1. Check commit format:
   ```bash
   git log -1
   ```

2. Should use conventional commits:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `feat!:` for breaking changes

---

## Live Examples on GitHub

Once published, these examples will be available at:

- **Minimal:** [github.com/jamesvillarrubia/pipecraft-example-minimal](https://github.com/jamesvillarrubia/pipecraft-example-minimal)
- **Basic:** [github.com/jamesvillarrubia/pipecraft-example-basic](https://github.com/jamesvillarrubia/pipecraft-example-basic)
- **Nx:** [github.com/jamesvillarrubia/pipecraft-example-nx](https://github.com/jamesvillarrubia/pipecraft-example-nx)
- **Gated:** [github.com/jamesvillarrubia/pipecraft-example-gated](https://github.com/jamesvillarrubia/pipecraft-example-gated)

Each will have:
- ✅ Working GitHub Actions workflows
- ✅ Badge showing workflow status
- ✅ Real commits demonstrating version bumping
- ✅ PRs showing promotion between branches

---

## Contributing

Found an issue with an example?

1. Open an issue: [github.com/jamesvillarrubia/pipecraft/issues](https://github.com/jamesvillarrubia/pipecraft/issues)
2. Include:
   - Which example
   - What you expected
   - What actually happened
   - Steps to reproduce

Want to suggest improvements?

- PRs welcome for:
  - Better documentation
  - Additional test cases
  - Configuration variations
  - New example scenarios

---

## Learn More

- **[PipeCraft Documentation](https://pipecraft.dev)** - Full documentation
- **[Configuration Reference](../docs/docs/configuration-reference.md)** - All config options
- **[Troubleshooting Guide](../docs/docs/troubleshooting.md)** - Common issues
- **[FAQ](../docs/docs/faq.md)** - Frequently asked questions

---

## License

All examples are MIT licensed - feel free to use them as starting points for your own projects.

MIT © PipeCraft Team
