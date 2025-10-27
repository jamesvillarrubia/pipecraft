# PipeCraft Example: Gated Workflow

[![CI/CD Pipeline](https://github.com/jamesvillarrubia/pipecraft-example-gated/actions/workflows/pipeline.yml/badge.svg)](https://github.com/jamesvillarrubia/pipecraft-example-gated/actions/workflows/pipeline.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Enterprise gated workflow with manual approvals at each stage.

## Purpose

This example demonstrates:
- ✅ **5-stage gated flow** - develop → alpha → beta → release → production
- ✅ **Manual approvals** - No auto-merge, all promotions via PR approval
- ✅ **Merge commits** - Creates merge commits (not fast-forward) for audit trail
- ✅ **Custom branch names** - alpha, beta, release instead of staging
- ✅ **Enterprise workflow** - Real-world approval process
- ✅ **Production-ready** - Starts at v1.0.0
- ✅ **4 domains** - services, web, api, shared

## Configuration

```json
{
  "branchFlow": ["develop", "alpha", "beta", "release", "production"],
  "mergeStrategy": "merge",
  "autoMerge": {
    "alpha": false,
    "beta": false,
    "release": false,
    "production": false
  },
  "domains": {
    "services": { "paths": ["services/**"] },
    "web": { "paths": ["web/**"] },
    "api": { "paths": ["api/**"] },
    "shared": { "paths": ["shared/**"] }
  }
}
```

## Workflow

### Stage 1: Development (develop branch)
```bash
git checkout develop
git commit -m "feat: add new feature"
git push origin develop
```

**PipeCraft:**
- Runs tests
- Calculates version
- **Creates PR** to alpha (awaits approval)

### Stage 2: Alpha Testing (alpha branch)
**Manual Action Required:**
1. Review PR from develop → alpha
2. Approve and merge PR

**PipeCraft:**
- Runs tests on alpha
- **Creates PR** to beta (awaits approval)

### Stage 3: Beta Testing (beta branch)
**Manual Action Required:**
1. QA team reviews PR from alpha → beta
2. Runs acceptance tests
3. Approves and merges PR

**PipeCraft:**
- Runs tests on beta
- **Creates PR** to release (awaits approval)

### Stage 4: Release Candidate (release branch)
**Manual Action Required:**
1. Stakeholders review PR from beta → release
2. Final approval for production readiness
3. Approves and merges PR

**PipeCraft:**
- Runs final tests
- **Creates PR** to production (awaits approval)

### Stage 5: Production (production branch)
**Manual Action Required:**
1. DevOps/Release Manager reviews PR
2. Schedules deployment window
3. Approves and merges PR

**PipeCraft:**
- Creates version tag (e.g., v1.2.0)
- Triggers deployment

## Branch Flow Diagram

```
develop ──PR──► alpha ──PR──► beta ──PR──► release ──PR──► production
  │               │             │             │               │
  │ tests pass    │ QA review   │ acceptance  │ final review  │ tagged
  └──────────────►└────────────►└────────────►└──────────────►v1.2.0
     (creates PR)   (manual)      (manual)       (manual)
```

## Key Differences from Other Examples

| Feature | Minimal | Basic | Nx | Gated |
|---------|---------|-------|-----|-------|
| Branches | 2 | 3 | 3 | **5** |
| Auto-merge | ✅ Yes | ✅ Yes | ✅ Yes | **❌ No** |
| Merge Strategy | fast-forward | fast-forward | fast-forward | **merge** |
| Approval Gates | None | None | None | **All stages** |
| Use Case | Quickstart | Standard | Complex | **Enterprise** |

## Why Use Gated Workflow?

**Use when you need:**
- Human approval before production
- QA sign-off at specific stages
- Stakeholder review before release
- Audit trail with merge commits
- Scheduled deployment windows
- Compliance requirements

**Don't use if:**
- You want fast iteration
- Team is small (<5 people)
- CI/CD should be fully automated
- You practice continuous deployment

## Getting Started

```bash
# Clone
git clone https://github.com/jamesvillarrubia/pipecraft-example-gated.git
cd pipecraft-example-gated

# Test locally
npm test
npm run build

# Make a change
echo "export const newFeature = () => {};" >> services/auth-service.js
git add .
git commit -m "feat: add new authentication feature"
git push origin develop

# Watch for PR creation
gh pr list
```

## Approval Process

### As a Developer
1. Push to `develop`
2. Wait for tests to pass
3. PR to `alpha` is created automatically
4. Notify QA team

### As QA Engineer
1. Review PRs targeting `beta`
2. Run manual acceptance tests
3. Approve if tests pass
4. Merge PR

### As Release Manager
1. Review PRs targeting `production`
2. Verify all gates passed
3. Schedule deployment
4. Approve and merge
5. Monitor deployment

## Troubleshooting

### PR Not Created

Check workflow logs:
```bash
gh run view --log | grep "create-pr"
```

Verify `autoMerge` is `false` in config.

### Tests Failing

Run locally first:
```bash
npm test
npm run build
```

### Merge Conflicts

Resolve in PR:
```bash
git checkout alpha
git merge develop
# Resolve conflicts
git push origin alpha
```

## Related Examples

- **[minimal](https://github.com/jamesvillarrubia/pipecraft-example-minimal)** - Simplest setup
- **[basic](https://github.com/jamesvillarrubia/pipecraft-example-basic)** - Standard trunk flow
- **[nx](https://github.com/jamesvillarrubia/pipecraft-example-nx)** - Nx monorepo

## Learn More

- [PipeCraft Docs](https://pipecraft.dev)
- [Trunk-Based Development](https://trunkbaseddevelopment.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)

## License

MIT © PipeCraft Team
