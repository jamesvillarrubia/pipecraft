# Regeneration Requirements (Current State)

> **Last Updated**: 2025-11-01
> **Purpose**: Document what currently triggers workflow regeneration and why
> **Status**: Baseline - represents state BEFORE modernization

This document captures the **current state** of regeneration requirements. As we progress through the modernization plan, we'll track improvements and eventually most of these will become "NO regeneration required."

---

## Quick Reference: What Requires Regeneration?

### ❌ Currently Requires Regeneration

| Change Type | Requires Regen? | Why | Target State |
|-------------|----------------|-----|--------------|
| Adding/removing domains | ❌ YES | Domains embedded in workflow ENV | ✅ NO (runtime config) |
| Changing domain paths | ❌ YES | Paths embedded in workflow | ✅ NO (runtime config) |
| Changing branch flow | ❌ YES | `promote-branch` reads config | ✅ NO (runtime config) |
| Changing autoMerge setting | ❌ YES | `promote-branch` reads config | ✅ NO (runtime config) |
| Adding/removing Nx | ❌ YES | Different workflow generated | ✅ NO (runtime detection) |
| Changing package manager | ⚠️ MAYBE | Some actions may hardcode npm | ✅ NO (auto-detect) |
| Changing merge strategy | ❌ YES | Workflow structure changes | ⚠️ YES (structural) |
| Adding custom jobs | ⚠️ MANUAL | Must use custom job markers | ✅ NO (preserved) |
| Updating action code | ❌ YES | Actions in local `.github/actions/` | ✅ NO (marketplace refs) |
| Config format change (JSON↔YAML) | ❌ YES | Actions use jq (JSON only) | ✅ NO (format-agnostic) |

### ✅ Never Requires Regeneration

| Change Type | Requires Regen? | Why |
|-------------|----------------|-----|
| Changing git branches | ✅ NO | Pure git operations |
| Changing repository URL | ✅ NO | Not part of config |
| Changing GitHub token | ✅ NO | Secrets, not config |
| Updating dependencies | ✅ NO | Package manager agnostic |

---

## Detailed Regeneration Triggers

### 1. Domain Configuration Changes

**Current State**: ❌ **REQUIRES REGENERATION**

#### What Changes Trigger This

```yaml
# .pipecraftrc
domains:
  core:
    paths:
      - 'src/core/**'    # ← Changing this
  api:                   # ← Adding/removing this
    paths:
      - 'src/api/**'
```

#### Why Regeneration is Required

Domains are **embedded in the workflow ENV section** at generation time:

```yaml
# .github/workflows/pipeline.yml (generated)
env:
  DOMAINS: |
    core:
      paths:
      - 'src/core/**'
    api:
      paths:
      - 'src/api/**'
```

The workflow passes this embedded config to `detect-changes`:
```yaml
- uses: ./.github/actions/detect-changes
  with:
    domains-config: ${{ env.DOMAINS }}
```

#### Impact
- **Frequency**: High - Monorepos evolve, domains change frequently
- **Pain Point**: Must regenerate after every domain change
- **Developer Experience**: Frustrating - feels unnecessary

#### Example Scenario

User adds new microservice:
```bash
mkdir apps/payments
# Update .pipecraftrc to add 'payments' domain
pipecraft generate --force  # ← Must regenerate
```

#### Solution Path (Future)

**Target State**: ✅ **NO REGENERATION**

Workflow reads config at runtime:
```yaml
jobs:
  read-config:
    outputs:
      domains: ${{ steps.read.outputs.domains }}
    steps:
      - name: Read Config
        run: |
          # Read .pipecraftrc
          # Export domains as output

  detect-changes:
    needs: read-config
    steps:
      - uses: pipecraft/detect-changes@v1
        with:
          domains-config: ${{ needs.read-config.outputs.domains }}
```

**PR Target**: #12 (Runtime Config Reading)

---

### 2. Branch Flow Changes

**Current State**: ❌ **REQUIRES REGENERATION**

#### What Changes Trigger This

```yaml
# .pipecraftrc
branchFlow:
  - develop
  - staging  # ← Adding this
  - main
```

#### Why Regeneration is Required

The `promote-branch` action **reads `.pipecraftrc` directly** to determine target branch:

```yaml
# .github/actions/promote-branch/action.yml (generated)
steps:
  - name: Determine Target Branch
    run: |
      BRANCH_FLOW=$(cat .pipecraftrc | jq -r '.branchFlow | join(" ")')
      # Calculate next branch in flow
```

**Problems**:
1. Action is **tightly coupled** to PipeCraft config
2. Uses **jq** (JSON only) - breaks with YAML config
3. Can't be used in non-PipeCraft workflows
4. Blocks marketplace publication

#### Impact
- **Frequency**: Medium - Branch flow changes during workflow maturity
- **Pain Point**: Config coupling prevents action reuse
- **Developer Experience**: Confusing - why does branch change need regeneration?

#### Example Scenario

Team adds staging environment:
```yaml
# .pipecraftrc
branchFlow: ['develop', 'staging', 'main']  # ← Add staging

# Must regenerate because promote-branch needs to know new flow
pipecraft generate --force
```

#### Solution Path (Future)

**Target State**: ✅ **NO REGENERATION**

Workflow calculates target branch, passes to action:
```yaml
jobs:
  read-config:
    outputs:
      targetBranch: ${{ steps.calc.outputs.targetBranch }}
    steps:
      - name: Calculate Target Branch
        run: |
          # Read branchFlow from .pipecraftrc
          # Determine next branch based on current branch
          # Export as output

  promote:
    needs: read-config
    steps:
      - uses: pipecraft/promote-branch@v1
        with:
          target-branch: ${{ needs.read-config.outputs.targetBranch }}
```

Action accepts input:
```yaml
# promote-branch action
inputs:
  targetBranch:
    required: true
# No config file reading!
```

**PR Target**: #4 (Decouple promote-branch) - **CRITICAL PRIORITY**

---

### 3. Auto-Merge Setting Changes

**Current State**: ❌ **REQUIRES REGENERATION**

#### What Changes Trigger This

```yaml
# .pipecraftrc
autoMerge:
  staging: true   # ← Changing this
  main: false
```

#### Why Regeneration is Required

Same issue as branch flow - `promote-branch` reads config:
```yaml
AUTO_MERGE=$(cat .pipecraftrc | jq -r '.autoMerge')
```

#### Impact
- **Frequency**: Medium - Teams toggle as workflow matures
- **Pain Point**: Simple config change requires full regeneration

#### Solution Path (Future)

**Target State**: ✅ **NO REGENERATION**

Pass as input:
```yaml
- uses: pipecraft/promote-branch@v1
  with:
    auto-merge: ${{ needs.read-config.outputs.autoMerge }}
```

**PR Target**: #4 (Decouple promote-branch)

---

### 4. Adding/Removing Nx

**Current State**: ❌ **REQUIRES REGENERATION**

#### What Changes Trigger This

```bash
# Add Nx to project
npx nx init

# Or remove Nx
rm nx.json
```

#### Why Regeneration is Required

PipeCraft generates **different workflows** for Nx vs path-based:
- Nx projects get additional jobs
- Different change detection logic
- Different build orchestration
- `run-nx-affected` action generated conditionally

#### Impact
- **Frequency**: Low - Usually one-time decision
- **Pain Point**: Major workflow restructure
- **Developer Experience**: Acceptable for major strategy change, but shouldn't be necessary

#### Example Scenario

```bash
# Project starts path-based
pipecraft init
pipecraft generate

# Later, add Nx
npx nx init
pipecraft generate --force  # ← Must regenerate for Nx support
```

#### Current Detection (Generation Time)

```typescript
// src/generators/workflows.tpl.ts
const hasNx = fs.existsSync('nx.json') ||
  (packageJson && packageJson.dependencies?.['nx'])

if (hasNx) {
  // Generate Nx-specific workflow
} else {
  // Generate path-based workflow
}
```

#### Solution Path (Future)

**Target State**: ✅ **NO REGENERATION**

Strategy detected at **runtime**:
```yaml
jobs:
  detect-strategy:
    outputs:
      useNx: ${{ steps.detect.outputs.useNx }}
    steps:
      - name: Detect Nx
        id: detect
        run: |
          if [ -f "nx.json" ]; then
            echo "useNx=true" >> $GITHUB_OUTPUT
          else
            echo "useNx=false" >> $GITHUB_OUTPUT
          fi

  detect-changes:
    needs: detect-strategy
    steps:
      - uses: pipecraft/detect-changes@v1
        with:
          useNx: ${{ needs.detect-strategy.outputs.useNx }}
```

Action uses **conditional steps** (already implemented in detect-changes!):
```yaml
- name: Nx Detection
  if: inputs.useNx == 'true'
  # Nx logic

- name: Path-Based Fallback
  if: inputs.useNx != 'true'
  # Path logic
```

**PR Target**: #13 (Runtime Strategy Detection)

---

### 5. Package Manager Changes

**Current State**: ⚠️ **MAYBE REQUIRES REGENERATION**

#### What Changes Trigger This

```bash
# Switch from npm to pnpm
rm package-lock.json
pnpm install

# Update .pipecraftrc
packageManager: 'pnpm'  # ← Change this
```

#### Why Regeneration Might Be Required

**Mixed state**:
- ✅ `detect-changes` - **Auto-detects** from lockfiles (good!)
- ❌ `calculate-version` - **Hardcoded to npm** (bad!)
- ❓ Other actions - Unknown

#### Impact
- **Frequency**: Low - Usually one-time decision
- **Pain Point**: Should be transparent, but might not be

#### Current State Analysis

**Good example** (`detect-changes`):
```yaml
- name: Install Dependencies
  run: |
    if [ -f "pnpm-lock.yaml" ]; then
      corepack enable && pnpm install
    elif [ -f "yarn.lock" ]; then
      yarn install
    elif [ -f "package-lock.json" ]; then
      npm ci || npm install
    else
      npm install
    fi
```

**Bad example** (`calculate-version` - suspected):
```yaml
- name: Install Dependencies
  run: npm install @release-it/conventional-changelog  # ← Hardcoded!
```

#### Solution Path (Future)

**Target State**: ✅ **NO REGENERATION**

All actions use auto-detection pattern:
1. Check for lockfiles
2. Use appropriate package manager
3. Fall back to npm (always available in GitHub runners)

**PR Target**: #7 (Audit and fix calculate-version)

---

### 6. Config Format Changes (JSON ↔ YAML)

**Current State**: ❌ **REQUIRES REGENERATION**

#### What Changes Trigger This

```bash
# Migrate config format
mv .pipecraftrc.json .pipecraftrc  # JSON → YAML
```

#### Why Regeneration is Required

**Recent pain point** - `promote-branch` uses `jq` (JSON parser):
```yaml
BRANCH_FLOW=$(cat .pipecraftrc | jq -r '.branchFlow')
```

When config is YAML, `jq` fails!

#### Impact
- **Frequency**: Low - One-time migration
- **Pain Point**: High - Actions break after format change
- **Developer Experience**: Confusing errors

#### Recent History

Commits showing this pain:
- `e29e963` - "fix(cicd): replace jq with yq for YAML parsing"
- `2046f94` - "fix(cicd): resolve YAML parse error"

Format migration caused cascading issues.

#### Solution Path (Future)

**Target State**: ✅ **NO REGENERATION** + Format Agnostic

Actions don't read config files at all:
- Workflow reads config (can handle any format with proper tools)
- Workflow passes values as inputs to actions
- Actions are format-agnostic (accept inputs only)

**PR Target**: #4 (Decouple promote-branch) - removes config reading

---

### 7. Merge Strategy Changes

**Current State**: ❌ **REQUIRES REGENERATION**

#### What Changes Trigger This

```yaml
# .pipecraftrc
mergeStrategy: 'fast-forward'  # ← Change this
# or
mergeStrategy: 'merge'
```

#### Why Regeneration is Required

This is a **structural change** - workflow logic differs:
- Fast-forward: Rebase-based workflow
- Merge: Merge commit workflow
- Different job dependencies
- Different branch handling

#### Impact
- **Frequency**: Very Low - Strategic decision, rarely changes
- **Pain Point**: Acceptable - This is a major workflow change
- **Developer Experience**: Expected

#### Future State

**Target State**: ⚠️ **STILL REQUIRES REGENERATION**

This is acceptable - merge strategy is a fundamental workflow architecture decision.

**PR Target**: None - This is expected behavior

---

### 8. Adding Custom Jobs

**Current State**: ⚠️ **MANUAL PRESERVATION**

#### How It Works

Workflows have custom job markers:
```yaml
# .github/workflows/pipeline.yml
jobs:
  # <--START CUSTOM JOBS-->
  my-custom-job:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Custom logic"
  # <--END CUSTOM JOBS-->
```

#### Why It's Manual

PipeCraft uses **AST-based merging**:
1. Extracts content between markers
2. Regenerates managed sections
3. Re-inserts custom content

Works well, but requires:
- Users to know about markers
- Careful placement of custom jobs
- Understanding of merge logic

#### Impact
- **Frequency**: Medium - Custom jobs added over time
- **Pain Point**: Documentation needed
- **Developer Experience**: Good once understood

#### Solution Path (Future)

**Target State**: ✅ **AUTOMATIC PRESERVATION**

Improvements:
1. Better documentation of custom job pattern
2. `pipecraft add-job` command to generate markers automatically
3. Validation that custom jobs are preserved during regeneration

**PR Target**: #19 (Documentation overhaul) - document pattern clearly

---

### 9. Updating Action Code

**Current State**: ❌ **REQUIRES REGENERATION**

#### What Changes Trigger This

PipeCraft CLI is updated with action improvements:
```bash
npm update pipecraft
# Actions in .github/actions/ are now outdated
pipecraft generate --force  # ← Must regenerate
```

#### Why Regeneration is Required

Actions are **local code** in `.github/actions/`:
- Not versioned independently
- Tied to PipeCraft CLI version
- Must regenerate to get updates

#### Impact
- **Frequency**: Medium - With each PipeCraft update
- **Pain Point**: Tedious
- **Developer Experience**: Annoying - feels like unnecessary churn

#### Solution Path (Future)

**Target State**: ✅ **NO REGENERATION** - Version Bump Only

With marketplace actions:
```yaml
# Workflow references marketplace
- uses: pipecraft/detect-changes@v1  # ← Pinned to major version

# Updates are automatic (patches/minors)
# Or manual version bump:
- uses: pipecraft/detect-changes@v2  # ← Update reference
```

Use `pipecraft upgrade-workflows` command:
```bash
pipecraft upgrade-workflows
# Updates all action refs to latest versions
# Preserves all customizations
# NO full regeneration
```

**PR Target**:
- #14 (Marketplace mode option)
- #15 (Upgrade workflows command)

---

## Regeneration Frequency Analysis

### High Frequency (Weekly/Monthly)
These happen often during active development:
1. ❌ Domain changes
2. ❌ Action code updates (with PipeCraft updates)
3. ⚠️ Custom job additions

**Priority**: **CRITICAL** - Reduce these first

### Medium Frequency (Quarterly)
These happen during workflow maturation:
4. ❌ Branch flow changes
5. ❌ Auto-merge setting changes
6. ⚠️ Package manager changes (usually once)

**Priority**: **HIGH** - Significant pain point

### Low Frequency (Rarely)
These are strategic decisions:
7. ❌ Adding/removing Nx
8. ❌ Config format changes (one-time migration)
9. ❌ Merge strategy changes

**Priority**: **MEDIUM** - Low frequency reduces pain

---

## Developer Experience Impact

### Current Pain Points

**Quote from analysis**:
> "Recent commits show: Active decoupling work (promote-branch changes), Config format evolution (JSON → YAML), **Fragility from tight coupling** (parsing errors), Multiple fixes in Oct-Nov 2025"

### Regeneration Workflow (Current)

```bash
# Developer wants to add new domain
vim .pipecraftrc
# Add new domain

# Must regenerate
pipecraft generate

# What if they have custom jobs?
# Hope the markers work correctly
# Hope nothing breaks

# What if they're on a feature branch?
# Now have workflow changes mixed with feature changes
# PR becomes messy

# What if regeneration fails?
# Rollback? Fix? Unclear

git add .github/
git commit -m "chore: regenerate workflows for new domain"
# Now have chore commit mixed with feature work
```

### Target Experience (Future)

```bash
# Developer wants to add new domain
vim .pipecraftrc
# Add new domain

# Commit config change only
git add .pipecraftrc
git commit -m "feat: add payments domain"

# Workflow adapts automatically at runtime
# No regeneration needed!
# No workflow churn in PR
# Clean feature commits only
```

**Much better!**

---

## Testing Regeneration (Current Process)

### When You Must Regenerate

Run this workflow:
```bash
# 1. Backup existing workflows (optional but recommended)
cp -r .github/workflows .github/workflows.backup

# 2. Regenerate
pipecraft generate --force

# 3. Review changes
git diff .github/

# 4. Test locally if possible
# (workflows can't easily run locally)

# 5. Commit
git add .github/
git commit -m "chore: regenerate workflows"

# 6. Push and test in CI
git push

# 7. Watch CI, hope nothing broke
```

### Common Regeneration Issues

1. **Custom jobs lost**
   - Forgot to use markers
   - Markers in wrong place
   - Solution: Add markers, regenerate again

2. **Syntax errors in generated YAML**
   - Rare, but happens
   - Solution: Report bug, manual fix

3. **Merge conflicts**
   - Multiple people regenerating
   - Solution: Coordinate, regenerate from main

4. **Workflow churn in PRs**
   - Feature branch + workflow regeneration
   - Solution: Separate PRs, or accept mixed commits

---

## Migration Path: Reducing Regeneration

### Phase 1: Decouple Actions (Weeks 1-4)
**Impact**: Enables marketplace publication
- PR #4: Decouple promote-branch
- PR #7: Decouple calculate-version
- PR #9-11: Decouple remaining actions

**Regeneration Reduction**: None yet, but enables next phases

### Phase 2: Runtime Config (Weeks 5-8)
**Impact**: Eliminates config change regeneration
- PR #12: Runtime config reading
- PR #13: Runtime strategy detection

**Regeneration Reduction**: 70%
- ✅ Domain changes → NO regen
- ✅ Branch flow changes → NO regen
- ✅ Auto-merge changes → NO regen
- ✅ Nx addition → NO regen
- ✅ Package manager changes → NO regen

### Phase 3: Marketplace Actions (Weeks 9-12)
**Impact**: Eliminates action update regeneration
- PR #14: Marketplace mode
- PR #15: Upgrade workflows command

**Regeneration Reduction**: Additional 20%
- ✅ Action updates → version bump only
- ✅ Use `upgrade-workflows` command

### Phase 4: Stabilization (Weeks 13-14)
**Impact**: Polish and documentation

**Final State**: 90% reduction in regeneration needs
- Only structural changes require regeneration
- Most common changes handled at runtime
- Clear documentation of what still requires regeneration

---

## Success Metrics

### Current State (Baseline)
- Regeneration triggers: **10 different scenarios**
- High-frequency triggers: **3**
- Developer pain: **High**
- Workflow churn in PRs: **Common**
- Marketplace readiness: **2/8 actions**

### Target State (After Modernization)
- Regeneration triggers: **2 scenarios** (structural only)
- High-frequency triggers: **0**
- Developer pain: **Low**
- Workflow churn in PRs: **Rare**
- Marketplace readiness: **8/8 actions**

### Tracking Progress

Update this table after each relevant PR:

| Trigger | Baseline | After PR #4 | After PR #12 | After PR #14 | Target |
|---------|----------|-------------|--------------|--------------|--------|
| Domain changes | ❌ YES | ❌ YES | ✅ NO | ✅ NO | ✅ NO |
| Branch flow | ❌ YES | ✅ NO | ✅ NO | ✅ NO | ✅ NO |
| AutoMerge | ❌ YES | ✅ NO | ✅ NO | ✅ NO | ✅ NO |
| Nx changes | ❌ YES | ❌ YES | ✅ NO | ✅ NO | ✅ NO |
| Pkg manager | ⚠️ MAYBE | ⚠️ MAYBE | ✅ NO | ✅ NO | ✅ NO |
| Action updates | ❌ YES | ❌ YES | ❌ YES | ✅ NO | ✅ NO |
| Merge strategy | ❌ YES | ❌ YES | ❌ YES | ❌ YES | ⚠️ YES (OK) |

---

## Related Documentation

- [Action Coupling Matrix](./action-coupling-matrix.md) - Which actions need decoupling
- [DECOUPLING_GUIDE.md](./DECOUPLING_GUIDE.md) - Decoupling strategy and progress
- [Strategy Agnostic Pattern](./strategy-agnostic-pattern.md) - How to build reusable actions

---

## Document Maintenance

Update this document:
- ✅ After each PR that reduces regeneration triggers
- ✅ When new regeneration triggers are discovered
- ✅ When developer pain points change
- ✅ After collecting user feedback

**Next Review**: After PR #4 (promote-branch decoupling)
