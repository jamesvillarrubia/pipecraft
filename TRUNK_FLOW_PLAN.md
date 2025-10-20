# Trunk-Based Flow Plan for PipeCraft

> **⚠️ FUTURE ROADMAP - NOT CURRENT IMPLEMENTATION**
>
> This document describes **planned future enhancements** to PipeCraft's trunk-based workflow.
> For the **currently implemented** workflow, see [docs/CURRENT_TRUNK_FLOW.md](docs/CURRENT_TRUNK_FLOW.md).
>
> **Current Status**:
> - ✅ **Phase 1 Implemented**: Basic PR-based promotion (develop → staging → main)
> - 🚧 **Phase 2-4 Planned**: Temporary branches, environment deployments, multiple flow patterns
>
> Last Updated: 2025-01-19

## Vision

PipeCraft generates GitHub Actions workflows that support **trunk-based delivery** with configurable promotion gates. Code flows automatically from an initial branch through intermediate branches to a final branch, with optional manual approval gates.

### Current vs. Planned

| Feature | Current (v1.x) | Planned (v2.x) |
|---------|---------------|----------------|
| Direct PR promotion | ✅ Implemented | ✅ Keep |
| Temporary branches | ❌ Not implemented | 🚧 Planned |
| Manual approval gates | ⚠️ Via PR approval only | 🚧 Environment approvals |
| Auto-merge | ✅ Per-branch config | ✅ Keep + enhance |
| Multiple flow patterns | ❌ Only one pattern | 🚧 Planned |
| GitLab support | ❌ GitHub only | 🚧 Planned |

## Why Temporary Branches Are REQUIRED

### The GitHub Token Constraint

**Critical Limitation:** Pushes made with `GITHUB_TOKEN` do NOT trigger workflows.

This is by design to prevent infinite loops of workflows triggering workflows. This means:

❌ **What DOESN'T work:**
```
git push origin staging  # Using GITHUB_TOKEN
# Result: staging is updated, but no workflow runs!
```

✅ **What DOES work:**
```
Create PR → Merge PR (even by bot)
# Result: workflow triggers naturally!
```

### Why PRs Are The Only Solution

**Key Insight:** PR merges (including auto-merges) DO trigger workflows, even with `GITHUB_TOKEN`.

Therefore:
- **All promotions must use PRs** (both auto and manual)
- **Fast-forward pushes are not reliable** with GITHUB_TOKEN
- **PAT tokens are not acceptable** (user-scoped, security risk)

### Why Direct Branch PRs Don't Work Well

**Without temp branches:**
```
develop (at commit C) → create PR from develop to staging (at commit A)

Problem: PR shows ALL commits B, C, D since branches diverged
- Can't have multiple releases "in flight"
- History becomes messy with merge commits
- Can't easily identify "what was promoted when"
```

**With temp branches:**
```
develop (at commit C) → create temp/release-v1.2.3 → PR from temp to staging

Benefits:
- PR represents single atomic promotion
- Multiple releases can be prepared simultaneously
- Clean rollback points (just delete temp branch)
- Clear audit trail (each PR = one release decision)
- History stays linear (squash merge = one commit per release)
```

## Core Concept: Promotion Flow

### Universal Flow (Both Auto and Manual)

**All promotions use the same mechanism:**

```
Source Branch → [Create Temp Branch] → [Create PR] → [Merge Strategy] → Target Branch
```

1. **Create temp branch** from source (e.g., `release/develop-to-staging-v1.2.3`)
2. **Create PR** from temp branch to target
3. **Merge strategy** determines automation level:
   - **Auto:** Enable GitHub's auto-merge feature
   - **Manual:** Require human approval

### Flow Type 1: Auto-Promote

```
develop → [temp branch + PR + auto-merge] → staging
```

- Temp branch created automatically
- PR created with auto-merge enabled
- PR merges automatically when checks pass
- Staging workflow triggers from merge
- Temp branch cleaned up

### Flow Type 2: Manual-Promote

```
staging → [temp branch + PR + approval] → production
```

- Temp branch created automatically
- PR created without auto-merge
- Human reviews and approves
- Human merges PR
- Production workflow triggers from merge
- Temp branch cleaned up

### Key Innovation

**Auto and manual use the SAME mechanism** - just different merge policies!
- Not two different systems
- Same code paths
- Same audit trail
- Same cleanup process

## Configuration Schema

### `.pipecraftrc.json`

```json
{
  "branchFlow": ["develop", "staging", "main"],

  "autoMerge": {
    "staging": true,   // Auto-merge to staging (temp branch + PR + auto-merge)
    "main": false      // Manual gate to main (temp branch + PR + approval)
  },

  // Optional: customize temp branch naming
  "tempBranchPattern": "release/{source}-to-{target}-{version}"
}
```

### How autoMerge Works

**Both `true` and `false` create temp branches + PRs:**

**When `true` (Auto-promote):**
1. Create temp branch: `release/develop-to-staging-v1.2.3`
2. Create PR from temp to target
3. **Enable GitHub auto-merge on PR**
4. PR merges automatically when checks pass
5. Target workflow triggers
6. Temp branch cleaned up

**When `false` (Manual-promote):**
1. Create temp branch: `release/staging-to-main-v1.2.3`
2. Create PR from temp to target
3. **Leave PR for human approval**
4. Human reviews and merges
5. Target workflow triggers
6. Temp branch cleaned up

### Common Patterns

**Pattern 1: Auto-all-but-final (RECOMMENDED)**
```json
{
  "branchFlow": ["develop", "staging", "main"],
  "autoMerge": {
    "staging": true,
    "main": false
  }
}
```
Result: develop → auto → staging → manual → main

**Pattern 2: Auto-all**
```json
{
  "branchFlow": ["develop", "staging", "main"],
  "autoMerge": {
    "staging": true,
    "main": true
  }
}
```
Result: develop → auto → staging → auto → main

**Pattern 3: Manual-all**
```json
{
  "branchFlow": ["develop", "staging", "main"],
  "autoMerge": {
    "staging": false,
    "main": false
  }
}
```
Result: develop → manual → staging → manual → main

## Implementation Plan

### Phase 1: Core Flow Engine (Current Work)

**Goal:** Get basic auto-merge working for PipeCraft itself

- [x] Add `autoMerge` config support (per-branch boolean)
- [x] Generate conditional `branch` job based on config
- [x] Trigger workflow on target branch after fast-forward
- [ ] Fix PR creation for manual gates
- [ ] Test end-to-end flow

**PipeCraft Config (for itself):**
```json
{
  "branchFlow": ["develop", "staging", "main"],
  "autoMerge": {
    "staging": true,   // develop → auto → staging
    "main": false      // staging → PR → main
  }
}
```

### Phase 2: Strategy Abstraction

**Goal:** Make promotion strategies configurable and reusable

#### 2.1 Add `promotionStrategy` to config
- Replace simple `autoMerge` boolean with strategy object
- Support preset strategies: `auto-all-but-final`, `auto-all`, `manual-all`
- Default to `auto-all-but-final`

#### 2.2 Strategy Resolution
- Convert strategy preset to per-branch settings
- Generate appropriate workflow jobs based on strategy
- Backward compatible with existing `autoMerge` config

#### 2.3 Template Updates
- Update `pipeline-path-based.yml.tpl.ts` to use strategy config
- Generate `branch` job for auto promotion
- Generate `createpr` job for manual gates
- Conditional job generation based on strategy

### Phase 3: Temporary Branch Support

**Goal:** Support clean branch history with approval gates

#### 3.1 Temp Branch Creation
- Add `useTempBranch` option per target branch
- Generate temp branch name from pattern
- Create temp branch from source
- Push temp branch to remote

#### 3.2 PR from Temp Branch
- Create PR from temp branch to target
- Include version info in PR body
- Tag temp branch for traceability

#### 3.3 Cleanup
- Delete temp branch after successful merge
- Optional: keep temp branches for audit trail

### Phase 4: Advanced Features

#### 4.1 Environment Gates
- Link branches to deployment environments
- Support GitHub environment protection rules
- Required reviewers per environment

#### 4.2 Promotion Triggers
- Manual workflow dispatch to promote
- Scheduled promotions (e.g., production deploys Friday 5pm)
- Event-driven promotions (e.g., after stakeholder approval)

#### 4.3 Rollback Support
- Fast-forward rollback to previous commit
- Create rollback PR with previous version
- Automated rollback on failure detection

## Workflow Job Structure

### Jobs Generated Based on Strategy

```yaml
jobs:
  changes:
    # Always runs - detects what changed

  version:
    # Always runs on initial branch - calculates next version

  test-*:
    # Conditional - runs if relevant changes detected

  tag:
    # Always runs on initial branch - creates git tag

  # PROMOTION JOBS (generated based on strategy):

  promote-to-staging:
    # If auto: fast-forward staging, trigger workflow
    # If manual + no temp: create PR to staging
    # If manual + temp: create temp branch + PR to staging
    if: github.ref_name == 'develop'  # Source branch condition
    needs: [test-*, tag]
    runs-on: ubuntu-latest
    steps:
      - name: Auto Promote
        if: strategy == 'auto'
        # Fast-forward staging to develop
        # Trigger workflow on staging

      - name: Create Temp Branch
        if: strategy == 'manual' && useTempBranch
        # Create release/develop-to-staging-v1.2.3

      - name: Create PR
        if: strategy == 'manual'
        # Create PR (from temp branch or source)
```

## Success Criteria

### Phase 1 (Current)
- [ ] PipeCraft successfully auto-merges develop → staging
- [ ] Staging workflow triggers automatically after merge
- [ ] Manual PR created for staging → main
- [ ] PR merge triggers main workflow

### Phase 2
- [ ] Config supports `promotionStrategy` with presets
- [ ] `auto-all-but-final` works for 3+ branch flows
- [ ] Documentation for all strategy types
- [ ] Migration guide from `autoMerge` to `promotionStrategy`

### Phase 3
- [ ] Temp branches created for manual gates
- [ ] Clean branch history (no merge commits from temp branches)
- [ ] Temp branches properly cleaned up after merge

### Phase 4
- [ ] Environment protection integrated
- [ ] Manual promotion triggers work
- [ ] Rollback workflows generated and tested

## Migration Path

### Current Users (with `autoMerge`)
```json
// OLD
{
  "autoMerge": {
    "staging": true,
    "main": false
  }
}

// NEW (automatically converted)
{
  "promotionStrategy": {
    "type": "custom",
    "branches": {
      "staging": { "strategy": "auto" },
      "main": { "strategy": "manual" }
    }
  }
}
```

### PipeCraft Itself
```json
{
  "branchFlow": ["develop", "staging", "main"],
  "promotionStrategy": {
    "type": "auto-all-but-final"  // Simple!
  }
}
```

This expands to:
- develop → auto → staging
- staging → auto → (no more branches, so this is skipped)
- staging → manual → main (final branch gets manual gate)

## Questions to Resolve

1. **Temp branch naming:** Pattern should be configurable or fixed?
   - Proposal: `release/{source}-to-{target}-{version}`

2. **PR body format:** What info to include?
   - Version
   - Changelog since last promotion
   - Test results summary

3. **Cleanup timing:** When to delete temp branches?
   - Immediately after merge
   - After next successful promotion
   - Manual cleanup only

4. **Failed promotions:** What happens?
   - Leave temp branch and PR open
   - Auto-close and create new temp branch on retry

5. **Multiple pending promotions:** Allow or block?
   - One temp branch per target at a time
   - Multiple temp branches allowed (might be confusing)

## Next Steps

1. **Finish Phase 1** - Get current implementation working for PipeCraft
2. **Document current behavior** - Write user guide for `autoMerge` config
3. **Design Phase 2 config** - Get feedback on `promotionStrategy` schema
4. **Prototype temp branches** - Test the concept with manual workflow
5. **Implement Phase 2** - Add strategy abstraction layer

---

**Key Insight:** The "temp branch flow" is actually the **best default for manual gates** because it keeps the branch history clean and makes the approval action explicit and traceable. The PR represents "the decision to promote" rather than "these commits".