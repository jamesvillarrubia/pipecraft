# Decoupling Actions from PipeCraft

> **Last Updated**: 2025-11-01
> **Status**: In Progress - Baseline established, roadmap defined

## Overview

This guide explains how to make PipeCraft-generated actions **transferable** and **reusable** by removing hard dependencies on PipeCraft's configuration format.

**Current Progress**: See [Action Status Matrix](#action-status-matrix) below.

## Current Architecture (Coupled)

```
┌──────────────┐
│   Workflow   │
└──────┬───────┘
       │
       ▼
┌──────────────┐     reads     ┌─────────────────┐
│    Action    │ ────────────> │  .pipecraftrc   │
└──────────────┘               └─────────────────┘
```

**Problems:**

- ❌ Actions can't work without `.pipecraftrc`
- ❌ Can't publish actions independently
- ❌ Hard to test in isolation
- ❌ Tight coupling to PipeCraft format

## Decoupled Architecture (Recommended)

```
┌──────────────┐     reads     ┌─────────────────┐
│   Workflow   │ ────────────> │  .pipecraftrc   │
└──────┬───────┘               │  (or any config)│
       │                       └─────────────────┘
       │ passes values
       ▼
┌──────────────┐
│    Action    │ (config-agnostic)
└──────────────┘
```

**Benefits:**

- ✅ Actions work with ANY config format (YAML, JSON, TOML, env vars)
- ✅ Actions can be published to GitHub Marketplace
- ✅ Easy to test with mock inputs
- ✅ Works in non-PipeCraft projects
- ✅ Backward compatible

## Action Status Matrix

> **Updated**: 2025-11-01 (PR #1 - Baseline Audit)

| Action                                   | Status             | Config Reading | Marketplace Ready | PR Target         | Priority     |
| ---------------------------------------- | ------------------ | -------------- | ----------------- | ----------------- | ------------ |
| [detect-changes](#detect-changes-)       | ✅ **DONE**        | ✅ Via Input   | ✅ Ready          | #2 (Publish)      | HIGH         |
| [create-tag](#create-tag-)               | ✅ **DONE**        | ✅ None        | ✅ Ready          | #3 (Publish)      | HIGH         |
| [promote-branch](#promote-branch-)       | ❌ **NEEDS WORK**  | ❌ Yes (jq)    | ❌ Blocked        | #4 (Decouple)     | **CRITICAL** |
| [calculate-version](#calculate-version-) | ⚠️ **UNKNOWN**     | ⚠️ Unknown     | ❌ Needs Review   | #6-7 (Audit/Fix)  | HIGH         |
| [manage-branch](#other-actions-)         | ❓ **UNKNOWN**     | ❓ Unknown     | ❌ Needs Audit    | #6,9 (Audit/Fix)  | MEDIUM       |
| [create-pr](#other-actions-)             | ❓ **UNKNOWN**     | ❓ Unknown     | ❌ Needs Audit    | #6,10 (Audit/Fix) | MEDIUM       |
| [create-release](#other-actions-)        | ❓ **UNKNOWN**     | ❓ Unknown     | ❌ Needs Audit    | #6,11 (Audit/Fix) | MEDIUM       |
| [run-nx-affected](#other-actions-)       | ⚠️ **NX-SPECIFIC** | ❓ Unknown     | ⚠️ Nx-only OK     | #6 (Audit)        | LOW          |

**Legend**: ✅ Complete | ⚠️ In Progress | ❌ Needs Work | ❓ Unknown

### Status Definitions

- **DONE**: Fully decoupled, marketplace-ready, just needs publishing
- **NEEDS WORK**: Active coupling, requires refactoring before marketplace
- **UNKNOWN**: Requires audit to determine coupling status
- **NX-SPECIFIC**: Specialized action (Nx-only is acceptable for this one)

---

## Implementation Strategy

### Phase 1: Identify Dependencies ✅ COMPLETED (PR #1)

**Comprehensive audit completed. Findings:**

#### detect-changes ✅

- **Status**: ✅ **Already decoupled!**
- **Config Reading**: Via input (`domains-config`)
- **Strategy Support**: Multi-strategy (Nx + path-based in single file)
- **Package Manager**: Auto-detects from lockfiles
- **Marketplace Ready**: YES
- **Action**: Publish immediately (PR #2)

#### create-tag ✅

- **Status**: ✅ **Already decoupled!**
- **Config Reading**: None (all inputs explicit)
- **Strategy Support**: Agnostic (pure git operations)
- **Package Manager**: N/A
- **Marketplace Ready**: YES
- **Action**: Publish immediately (PR #3)

#### promote-branch ❌

- **Status**: ❌ **Actively coupled**
- **Config Reading**: YES - Uses jq to read `.pipecraftrc`
- **Reads**: `branchFlow`, `autoMerge`
- **Format Dependency**: JSON-only (jq parser)
- **Recent Progress**: Partial cleanup (commit `370c94f`), but still coupled
- **Blockers**:
  - Reads config file directly
  - Uses jq (breaks with YAML config)
  - Calculates target branch instead of accepting input
- **Solution**: Accept `targetBranch`, `autoMerge` as inputs
- **Action**: **CRITICAL** - Decouple in PR #4, then publish in PR #5

#### calculate-version ⚠️

- **Status**: ⚠️ **Unknown coupling level**
- **Config Reading**: Likely implicit (`.release-it.cjs`?)
- **Package Manager**: Suspected npm hardcoding
- **Needs**: Full audit
- **Action**: Audit in PR #6, fix in PR #7, publish in PR #8

#### Other Actions ❓

- **manage-branch**, **create-pr**, **create-release**: Status unknown
- **run-nx-affected**: Nx-specific (acceptable), but verify package manager handling
- **Action**: Audit all in PR #6, fix as needed in PRs #9-11

**Next Step**: Begin Phase 2 (Decoupling work)

### Phase 2: Refactor Pattern

**Before (Coupled):**

```yaml
# action.yml
runs:
  steps:
    - name: Read Config
      run: |
        CONFIG=$(cat .pipecraftrc)
        TARGET=$(echo "$CONFIG" | yq .branchFlow[1])
```

**After (Decoupled):**

```yaml
# action.yml
inputs:
  targetBranch:
    description: 'Target branch'
    required: true

runs:
  steps:
    - name: Use Input
      run: |
        TARGET="${{ inputs.targetBranch }}"
```

### Phase 3: Workflow Orchestration

**The workflow reads config and passes values:**

```yaml
# workflow.yml
jobs:
  prepare:
    runs-on: ubuntu-latest
    outputs:
      targetBranch: ${{ steps.config.outputs.targetBranch }}
    steps:
      - name: Read Config (any format!)
        id: config
        run: |
          # Read from PipeCraft config
          TARGET=$(yq eval '.branchFlow[1]' .pipecraftrc)
          echo "targetBranch=$TARGET" >> $GITHUB_OUTPUT

          # Or read from environment
          # TARGET=${{ vars.TARGET_BRANCH }}

          # Or hardcode
          # TARGET="staging"

  promote:
    needs: prepare
    steps:
      - uses: ./actions/promote-branch
        with:
          targetBranch: ${{ needs.prepare.outputs.targetBranch }}
```

## Migration Guide

### Step 1: Create Decoupled Versions

Keep both versions during migration:

```
actions/promote-branch/
├── action.yml              # Current (coupled)
└── action-decoupled.yml    # New (decoupled)
```

### Step 2: Update Workflows Gradually

Update one workflow at a time to use decoupled actions:

```yaml
# Old
- uses: ./actions/promote-branch

# New
- uses: ./actions/promote-branch/action-decoupled.yml
  with:
    targetBranch: staging # explicit
```

### Step 3: Deprecate Coupled Versions

After all workflows migrate:

1. Rename `action-decoupled.yml` to `action.yml`
2. Add deprecation notice to old version
3. Remove old version in next major release

## Publishing to Marketplace

Once decoupled, actions can be published:

```yaml
# .github/workflows/publish-actions.yml
name: Publish Actions

on:
  push:
    tags: ['v*']

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Publish promote-branch
        uses: actions/publish-action@v1
        with:
          path: actions/promote-branch
          marketplace: true
```

Users can then use:

```yaml
- uses: pipecraft/promote-branch@v1
  with:
    sourceBranch: develop
    targetBranch: staging
```

## Action Templates

### Template: Generic Action

```yaml
name: 'Generic Action'
description: 'Works with any project'

inputs:
  # All required config as inputs
  requiredValue:
    description: 'Value needed by action'
    required: true
  optionalValue:
    description: 'Optional value'
    required: false
    default: 'sensible-default'

outputs:
  result:
    description: 'Action result'
    value: ${{ steps.main.outputs.result }}

runs:
  using: 'composite'
  steps:
    - name: Main Logic
      id: main
      shell: bash
      run: |
        # Use inputs, never read files
        VALUE="${{ inputs.requiredValue }}"
        echo "result=$VALUE" >> $GITHUB_OUTPUT
```

### Template: Hybrid Action (Backward Compatible)

```yaml
name: 'Hybrid Action'
description: 'Supports both explicit inputs and config file'

inputs:
  targetBranch:
    description: 'Target branch (if not provided, read from config)'
    required: false
  configPath:
    description: 'Config path (only used if targetBranch not provided)'
    required: false
    default: '.pipecraftrc'

runs:
  using: 'composite'
  steps:
    - name: Determine Target
      id: target
      shell: bash
      run: |
        if [ -n "${{ inputs.targetBranch }}" ]; then
          # Use explicit input (decoupled mode)
          TARGET="${{ inputs.targetBranch }}"
          echo "✅ Using explicit targetBranch"
        elif [ -f "${{ inputs.configPath }}" ]; then
          # Fall back to config file (coupled mode)
          TARGET=$(yq eval '.branchFlow[1]' "${{ inputs.configPath }}")
          echo "⚠️  Reading from config file (consider passing explicit inputs)"
        else
          echo "❌ No targetBranch provided and no config file found"
          exit 1
        fi
        echo "target=$TARGET" >> $GITHUB_OUTPUT
```

## Testing Decoupled Actions

### Unit Testing

```bash
# Test with act (local GitHub Actions runner)
act -j test-promote \
  -s GITHUB_TOKEN=$TOKEN \
  --input sourceBranch=develop \
  --input targetBranch=staging \
  --input autoMerge=false
```

### Integration Testing

```yaml
# .github/workflows/test-actions.yml
name: Test Actions

on: [pull_request]

jobs:
  test-promote:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Test with Mock Inputs
        uses: ./actions/promote-branch
        with:
          sourceBranch: test-source
          targetBranch: test-target
          version: v0.0.0-test
          autoMerge: false
          token: ${{ secrets.GITHUB_TOKEN }}
```

## Best Practices

### 1. **Explicit Over Implicit**

```yaml
# ❌ Bad: Implicit dependencies
- uses: ./actions/promote-branch

# ✅ Good: Explicit inputs
- uses: ./actions/promote-branch
  with:
    targetBranch: staging
    version: v1.2.3
```

### 2. **Config Reading at Workflow Level**

```yaml
# ✅ Read config ONCE at workflow level
jobs:
  prepare:
    outputs:
      config: ${{ steps.read.outputs.config }}
    steps:
      - id: read
        run: cat .pipecraftrc > $GITHUB_OUTPUT

  use-config:
    needs: prepare
    steps:
      - uses: action
        with:
          value: ${{ needs.prepare.outputs.config.value }}
```

### 3. **Support Multiple Config Formats**

```bash
# Workflow can adapt to any format
if [ -f ".pipecraftrc" ]; then
  CONFIG=$(yq eval . .pipecraftrc)
elif [ -f ".pipecraftrc.json" ]; then
  CONFIG=$(jq . .pipecraftrc.json)
elif [ -f "package.json" ]; then
  CONFIG=$(jq .pipecraft package.json)
fi
```

### 4. **Provide Defaults**

```yaml
inputs:
  tempBranchPattern:
    required: false
    default: 'release/{source}-to-{target}' # Sensible default
```

### 5. **Document Required Inputs**

```yaml
name: 'Action Name'
description: |
  Detailed description of what the action does.

  Required Inputs:
    - targetBranch: The branch to promote to
    
  Optional Inputs:
    - version: Version tag (auto-detected if not provided)

  Example:
    - uses: ./actions/promote-branch
      with:
        targetBranch: staging
```

## FAQ

### Q: Does this break existing workflows?

**A:** Not if you use the hybrid approach. Keep the old behavior as a fallback while adding new explicit input options.

### Q: What about the `detect-changes` action?

**A:** It's already decoupled! It receives `domains-config` as an input, which is perfect. This is the model other actions should follow.

### Q: Should PipeCraft CLI still generate coupled actions?

**A:** PipeCraft can generate **workflows** that use decoupled actions. The workflow reads `.pipecraftrc` and passes values to actions, giving you the best of both worlds.

### Q: Can I still use PipeCraft if I decouple?

**A:** Yes! PipeCraft would focus on:

1. Generating workflows (not just actions)
2. Reading your config
3. Orchestrating decoupled actions
4. Managing the overall CI/CD flow

The actions become building blocks that PipeCraft (or any other tool) can use.

## Next Steps

1. **Review** current actions for dependencies
2. **Create** decoupled versions of key actions
3. **Test** decoupled actions in isolation
4. **Migrate** workflows one at a time
5. **Publish** stable actions to Marketplace
6. **Document** usage for non-PipeCraft users

## Modernization Roadmap

### Quick Wins (Weeks 1-2)

- **PR #1** ✅: Audit & Documentation (this document updated!)
- **PR #2**: Publish `detect-changes` to marketplace (already decoupled)
- **PR #3**: Publish `create-tag` to marketplace (already decoupled)

### Critical Path (Weeks 3-4)

- **PR #4**: Decouple `promote-branch` (remove config reading)
- **PR #5**: Publish `promote-branch` to marketplace
- **PR #6**: Audit remaining 5 actions

### Action Suite Completion (Weeks 5-7)

- **PR #7**: Decouple `calculate-version`
- **PR #8**: Publish `calculate-version`
- **PR #9-11**: Decouple & publish remaining actions

### Generator Modernization (Weeks 8-10)

- **PR #12**: Runtime config reading in workflows
- **PR #13**: Runtime strategy detection (Nx/turbo)
- **PR #14**: Marketplace action mode (default)
- **PR #15**: `upgrade-workflows` command
- **PR #16**: Migration commands

### Breaking Changes & Polish (Weeks 11-14)

- **Weeks 11-12**: Stabilization & beta testing
- **PR #17**: Make marketplace actions the default
- **PR #18**: Make runtime config the default
- **PR #19**: Documentation overhaul

---

## Success Metrics

**Baseline (Current)**:

- Marketplace-ready actions: **2/8** (detect-changes, create-tag)
- Config-reading actions: **≥1** (promote-branch confirmed, others unknown)
- Regeneration triggers: **~10 scenarios**

**Target (After Modernization)**:

- Marketplace-ready actions: **8/8** (100%)
- Config-reading actions: **0/8** (fully decoupled)
- Regeneration triggers: **~2 scenarios** (structural only)

---

## Related Documentation

- [Action Coupling Matrix](./action-coupling-matrix.md) - Detailed analysis of each action
- [Regeneration Requirements](./regeneration-requirements-current.md) - What triggers regeneration and why
- [Strategy Agnostic Pattern](./strategy-agnostic-pattern.md) - How to build multi-strategy actions
- [Incremental PR Plan](../INCREMENTAL_PR_PLAN.md) - Full modernization roadmap

---

## Resources

- [GitHub Actions Best Practices](https://docs.github.com/en/actions/learn-github-actions/best-practices-for-github-actions)
- [Creating Composite Actions](https://docs.github.com/en/actions/creating-actions/creating-a-composite-action)
- [Publishing Actions to Marketplace](https://docs.github.com/en/actions/creating-actions/publishing-actions-in-github-marketplace)

---

**Document Maintenance**: Update this guide after each PR that affects action decoupling status.
