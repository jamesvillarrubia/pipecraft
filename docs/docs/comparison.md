---
sidebar_position: 9
---

# Comparison with Alternatives

Understanding how PipeCraft compares to other CI/CD solutions helps you choose the right tool for your needs.

---

## Quick Comparison

| Feature | PipeCraft | Manual GitHub Actions | GitHub Actions Starter Workflows | Nx Cloud | CircleCI |
|---------|-----------|----------------------|----------------------------------|----------|----------|
| **Learning Curve** | Low | High | Medium | Medium | High |
| **Setup Time** | 5 minutes | 2-4 hours | 30-60 minutes | 1-2 hours | 2-4 hours |
| **Monorepo Support** | Excellent | Manual | Limited | Excellent | Good |
| **Domain-based Testing** | Built-in | Manual | No | Project-based | Manual |
| **Semantic Versioning** | Automated | Manual | No | No | Manual |
| **Branch Flow Management** | Automated | Manual | No | No | Manual |
| **Workflow Updates** | Safe regeneration | Manual merge | Manual merge | N/A | Manual |
| **Custom Jobs** | Preserved | Full control | Full control | Full control | Full control |
| **Cost** | Free (OSS) | Free (2000 min/mo) | Free (2000 min/mo) | Paid | Paid |
| **Nx Integration** | Native | Manual | No | Native | Manual |
| **Lock-in** | None (generates files) | None | None | Medium | High |

---

## PipeCraft vs Manual GitHub Actions

### Manual GitHub Actions

**When to use:**
- You have very specific, unique workflow requirements
- Your team has deep GitHub Actions expertise
- You want maximum control over every aspect
- Your workflow is simple (single app, no monorepo)

**Pros:**
- Complete flexibility and control
- No abstraction layer to learn
- Direct access to all GitHub Actions features
- No additional dependencies

**Cons:**
- Time-consuming to write and maintain
- Error-prone (YAML syntax, conditional logic)
- Difficult to keep consistent across projects
- Manual semantic versioning and branch management
- No built-in domain-based testing for monorepos
- Copy/paste leads to drift over time

**Example workflow complexity:**
```yaml
# Manual approach: 300+ lines of YAML with complex conditionals
# PipeCraft approach: 20 lines of config → generates 300+ lines
```

### PipeCraft

**When to use:**
- You want production-ready workflows quickly
- You're managing a monorepo
- You want consistent CI/CD across projects
- You value semantic versioning automation
- You need domain-based change detection

**Pros:**
- Fast setup (5 minutes to working pipeline)
- Best practices built-in
- Domain-based testing (only test what changed)
- Automatic semantic versioning
- Safe regeneration preserves customizations
- Branch flow automation (develop → staging → main)
- No vendor lock-in (generates standard GitHub Actions)

**Cons:**
- Abstracts away some GitHub Actions details
- Requires learning PipeCraft configuration
- Limited to supported workflow patterns (currently trunk-based)
- GitHub Actions only (GitLab support planned)

**Migration path:**
- Generated workflows are standard GitHub Actions
- Can migrate away by just not regenerating
- Full control over generated files

---

## PipeCraft vs GitHub Starter Workflows

### GitHub Starter Workflows

GitHub provides [starter workflows](https://github.com/actions/starter-workflows) for common scenarios.

**When to use:**
- You need a simple, one-time workflow setup
- Your project matches a starter template exactly
- You don't need monorepo support
- You want to learn GitHub Actions syntax

**Pros:**
- Official GitHub templates
- Good starting point for learning
- Free and open-source
- Wide variety of templates (Node, Python, Docker, etc.)

**Cons:**
- One-time generation (no updates)
- No monorepo support
- No semantic versioning
- No branch flow management
- Manual customization required
- Copy/paste across projects

### PipeCraft

**Advantages over Starter Workflows:**
- **Regeneration support**: Update workflows safely
- **Monorepo intelligence**: Domain-based change detection
- **Automation**: Semantic versioning, branch promotion
- **Consistency**: Same config → same workflow across projects
- **Preservation**: Custom jobs survive regeneration

**Use both:**
You can start with a GitHub starter workflow and migrate to PipeCraft later, or use PipeCraft for orchestration and starter workflows for specific deployment steps.

---

## PipeCraft vs Nx Cloud

### Nx Cloud

[Nx Cloud](https://nx.app/) is a paid service that provides distributed caching and task execution for Nx workspaces.

**When to use:**
- You have a large Nx monorepo (50+ projects)
- Build times are critical
- You want distributed task execution
- Budget allows for paid service

**Pros:**
- Distributed caching across machines
- Parallel task execution across agents
- Advanced analytics and insights
- Official Nx support
- Optimized for very large monorepos

**Cons:**
- Paid service (after free tier)
- Nx-specific (not general monorepo solution)
- Requires Nx adoption
- Additional service dependency
- Doesn't handle semantic versioning or branch flows

### PipeCraft

**Complementary to Nx Cloud:**
- PipeCraft generates the **workflow orchestration**
- Nx Cloud provides the **execution optimization**
- They work together, not as alternatives

**Use both:**
```json
{
  "nx": {
    "enabled": true,
    "tasks": ["lint", "test", "build"],
    "nxCloudToken": "your-token-here"
  }
}
```

PipeCraft generates workflows that use Nx Cloud if configured.

**Use PipeCraft alone if:**
- You want free, open-source solution
- Your monorepo is small-to-medium (< 50 projects)
- Nx's built-in caching is sufficient
- You don't need distributed execution

---

## PipeCraft vs CircleCI

### CircleCI

[CircleCI](https://circleci.com/) is a popular CI/CD platform.

**When to use:**
- You need advanced features (test splitting, parallel execution)
- You're already invested in CircleCI
- You need multi-cloud support
- Your team prefers CircleCI's interface

**Pros:**
- Mature platform with many features
- Good monorepo support (with setup)
- Test splitting and parallelization
- Orbs for reusable config
- Works with any VCS

**Cons:**
- Paid service (limited free tier)
- Separate platform from GitHub
- Additional service to manage
- Vendor lock-in
- More complex configuration

### PipeCraft

**Advantages:**
- **Free**: Uses GitHub Actions' free tier
- **Integrated**: Native GitHub integration
- **No lock-in**: Generates standard files
- **Simpler**: Config is more straightforward
- **Open source**: Customize and extend

**Disadvantages:**
- GitHub-only (currently)
- Fewer advanced features
- Relies on GitHub Actions infrastructure

**Migration:**
If you're on CircleCI and considering GitHub Actions, PipeCraft provides a smooth path with automatic workflow generation.

---

## PipeCraft vs Jenkins

### Jenkins

[Jenkins](https://www.jenkins.io/) is a self-hosted automation server.

**When to use:**
- You need complete control over CI infrastructure
- You have complex, custom build requirements
- You're already running Jenkins
- You have dedicated DevOps team

**Pros:**
- Unlimited customization
- Self-hosted (no external dependency)
- Mature ecosystem (plugins)
- No usage limits
- Works with any VCS

**Cons:**
- Requires infrastructure management
- Complex setup and maintenance
- Steep learning curve
- UI feels dated
- Plugin compatibility issues

### PipeCraft

**Advantages:**
- **No infrastructure**: Uses GitHub Actions
- **No maintenance**: GitHub manages runners
- **Modern**: Built for 2024+ workflows
- **Fast setup**: Minutes vs. days
- **Free tier**: 2000 minutes/month

**When to keep Jenkins:**
- Very specific custom requirements
- Already heavily invested
- Need on-premise execution
- Security/compliance requires self-hosting

---

## PipeCraft vs GitLab CI/CD

### GitLab CI/CD

[GitLab CI/CD](https://docs.gitlab.com/ee/ci/) is GitLab's built-in CI/CD.

**When to use:**
- You use GitLab (not GitHub)
- You want all-in-one platform (VCS + CI/CD)
- You need GitLab-specific features

**Pros:**
- Integrated with GitLab
- Good monorepo support
- Free tier available
- Self-hosted option
- Feature-rich

**Cons:**
- GitLab-only (not GitHub)
- Separate platform if using GitHub
- `.gitlab-ci.yml` syntax different from GitHub Actions

### PipeCraft

**Current status:**
- GitHub Actions only (for now)
- GitLab support is on the roadmap

**If you're on GitLab:**
- PipeCraft doesn't support GitLab yet
- Watch the [roadmap](./roadmap.md) for updates
- Vote on [GitLab CI support issue](https://github.com/jamesvillarrubia/pipecraft/issues)

---

## PipeCraft vs Turborepo

### Turborepo

[Turborepo](https://turbo.build/) is a build system for monorepos with smart caching.

**Important:** Turborepo is a **build tool**, not a CI/CD platform.

**They solve different problems:**
- **Turborepo**: Optimizes build/test execution (caching, parallelization)
- **PipeCraft**: Generates CI/CD workflows (orchestration, versioning, deployment)

**Use both:**
```json
{
  "domains": {
    "api": {
      "paths": ["apps/api/**"],
      "testCommand": "turbo run test --filter=api"
    }
  }
}
```

PipeCraft can generate workflows that use Turborepo for execution.

---

## PipeCraft vs Lerna/npm Workspaces

### Lerna / npm Workspaces

Tools for managing JavaScript monorepos.

**They solve different problems:**
- **Lerna/npm workspaces**: Package management and versioning
- **PipeCraft**: CI/CD workflow generation

**Use together:**
PipeCraft works great with Lerna or npm workspaces:

```json
{
  "domains": {
    "packages": {
      "paths": ["packages/**"],
      "testCommand": "lerna run test --since origin/main"
    }
  }
}
```

---

## Feature-by-Feature Comparison

### Domain-Based Testing

**Problem:** In a monorepo, you don't want to run all tests for every change.

| Solution | Approach | Complexity |
|----------|----------|------------|
| **PipeCraft** | Automatic via config | Low - define paths |
| **Manual GHA** | Custom scripts | High - write logic |
| **Nx Cloud** | Nx affected | Medium - Nx setup |
| **CircleCI** | Path filtering | Medium - config |

**Winner:** PipeCraft (simplest) or Nx Cloud (most powerful)

### Semantic Versioning

**Problem:** Automating version bumps based on commit messages.

| Solution | Built-in? | Complexity |
|----------|-----------|------------|
| **PipeCraft** | Yes | Low |
| **Manual GHA** | No (use semantic-release) | High |
| **CircleCI** | No (use orb) | Medium |
| **GitLab** | No (use semantic-release) | High |

**Winner:** PipeCraft (only one with built-in support)

### Branch Flow Management

**Problem:** Automating promotions (develop → staging → main).

| Solution | Built-in? | Complexity |
|----------|-----------|------------|
| **PipeCraft** | Yes | Low |
| **Manual GHA** | No (write custom) | High |
| **CircleCI** | No (workflows) | Medium |
| **GitLab** | No (pipelines) | Medium |

**Winner:** PipeCraft (designed for trunk-based flow)

### Workflow Maintenance

**Problem:** Keeping workflows up-to-date across projects.

| Solution | Approach | Risk |
|----------|----------|------|
| **PipeCraft** | Safe regeneration | Low |
| **Manual GHA** | Manual updates | High (copy/paste errors) |
| **Starter Workflows** | One-time generation | N/A (no updates) |

**Winner:** PipeCraft (safe, automated updates)

---

## Cost Comparison

### GitHub Actions (with PipeCraft)

**Free tier:**
- 2,000 minutes/month for private repos
- Unlimited for public repos

**Paid:**
- $0.008/minute for Linux
- $0.016/minute for Windows
- $0.064/minute for macOS

**PipeCraft impact:**
- **Reduces costs**: Domain-based testing = fewer minutes
- Example: 30% reduction by testing only changed domains

### Nx Cloud

**Free tier:**
- 500 hours/month of remote cache

**Paid:**
- $69/month for Pro (15 users)
- Custom enterprise pricing

### CircleCI

**Free tier:**
- 6,000 build minutes/month

**Paid:**
- $15/month per user
- $15/month per credit (500 credits)

### Jenkins

**Cost:**
- $0 for software
- Infrastructure costs (servers, maintenance, DevOps time)
- Estimated: $500-5000/month for small team

---

## Migration Paths

### From Manual GitHub Actions to PipeCraft

**Effort:** Low (1-2 hours)

1. Run `npx pipecraft init`
2. Map your jobs to domains
3. Run `npx pipecraft generate`
4. Copy custom logic from old workflows to new jobs
5. Test in a feature branch
6. Replace old workflow

**Risk:** Low (can revert to old workflow)

### From CircleCI to PipeCraft

**Effort:** Medium (4-8 hours)

1. Set up GitHub Actions permissions
2. Convert CircleCI config to PipeCraft config
3. Migrate environment variables and secrets
4. Test workflows thoroughly
5. Switch over

**Risk:** Medium (different platform)

### From Jenkins to PipeCraft

**Effort:** High (1-2 weeks)

1. Document current Jenkins pipelines
2. Redesign for GitHub Actions paradigm
3. Migrate in phases (one pipeline at a time)
4. Test extensively
5. Decommission Jenkins gradually

**Risk:** High (major change)

---

## Decision Matrix

### Choose PipeCraft if:

✅ You use GitHub (not GitLab/Bitbucket)
✅ You want fast, low-effort setup
✅ You have a monorepo (or plan to)
✅ You value semantic versioning automation
✅ You want trunk-based development flow
✅ You prefer open-source, no lock-in
✅ You want to save on CI costs

### Choose Manual GitHub Actions if:

✅ You have unique, highly custom requirements
✅ Your team has deep GitHub Actions expertise
✅ You need features PipeCraft doesn't support yet
✅ You enjoy writing YAML

### Choose Nx Cloud if:

✅ You have a large Nx monorepo (50+ projects)
✅ Build speed is critical
✅ Budget allows for paid service
✅ You need distributed task execution

### Choose CircleCI if:

✅ You're already invested in CircleCI
✅ You need advanced features (test splitting, etc.)
✅ You use multiple VCS platforms
✅ Budget allows for paid service

### Choose Jenkins if:

✅ You need self-hosted CI/CD
✅ You have complex, custom requirements
✅ You have dedicated DevOps team
✅ Compliance requires on-premise

---

## Combining Tools

**Best combination for most teams:**

```
PipeCraft (orchestration)
  ↓
GitHub Actions (execution)
  ↓
Nx or Turborepo (build optimization - optional)
  ↓
Nx Cloud (distributed caching - optional)
```

**Example workflow:**
1. PipeCraft generates the workflow
2. GitHub Actions runs the workflow
3. Nx determines affected projects
4. Nx Cloud caches results (optional)
5. PipeCraft handles versioning and deployment

---

## Frequently Asked Questions

### Can I use PipeCraft with [tool X]?

**Yes, in most cases:**
- ✅ Nx / Turborepo: Native support
- ✅ Jest / Vitest / Mocha: Configure test commands
- ✅ Docker: Add Docker steps to deploy jobs
- ✅ Kubernetes: Add kubectl commands to deploy jobs
- ✅ Vercel / Netlify: Add deployment commands
- ✅ npm / yarn / pnpm: Works with all package managers

### Will PipeCraft slow down my builds?

**No, it actually speeds them up:**
- Domain-based testing runs only affected tests
- Nx integration leverages computation caching
- GitHub Actions caching built-in
- Less wasted CI time = faster feedback

### Can I migrate away from PipeCraft?

**Yes, easily:**
- Generated files are standard GitHub Actions
- No runtime dependency on PipeCraft
- Just stop regenerating workflows
- Keep using what PipeCraft generated
- Zero lock-in

### Is PipeCraft production-ready?

**Yes:**
- Used in production by teams
- Comprehensive test suite (90%+ coverage)
- Active development and maintenance
- Semantic versioning for stable releases
- Community support available

---

## Summary

**PipeCraft is best for:**
- Teams wanting fast setup with best practices built-in
- Monorepos needing intelligent change detection
- Projects requiring semantic versioning automation
- Organizations standardizing CI/CD across repositories
- Teams migrating from complex manual workflows

**Not ideal for:**
- GitLab/Bitbucket users (GitHub Actions only currently)
- Teams needing features outside trunk-based flow
- Projects with extremely custom workflow requirements
- Teams deeply invested in other platforms

---

## Try It Yourself

The best way to decide is to try PipeCraft:

```bash
# Takes 5 minutes
npx pipecraft init
npx pipecraft generate
git add .github .pipecraftrc.json
git commit -m "feat: add PipeCraft workflows"
git push
```

If it doesn't fit, you've lost 5 minutes and gained some generated workflows you can use as a starting point.

---

**Still have questions?** Ask in [GitHub Discussions](https://github.com/jamesvillarrubia/pipecraft/discussions) or check the [FAQ](./faq.md).
