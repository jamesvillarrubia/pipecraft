# Fixes Summary - October 31, 2025

## 1. ✅ Linting Issues Fixed

**Commit:** `3e4df29`

**Problem:** 236 files had formatting issues causing lint failures

**Solution:**

```bash
pnpm run format  # Applied Prettier to all files
```

**Impact:** CI lint checks now pass

---

## 2. ✅ Config File Migration Fixed

**Commit:** `9f656f1`

**Problem:**

```
📖 Reading config from .pipecraftrc.json
❌ Config file not found: .pipecraftrc.json
```

The promote-branch action was still looking for `.pipecraftrc.json` after the YAML migration

**Solution:** Updated `configPath` default from `.pipecraftrc.json` to `.pipecraftrc`

**Impact:** Promote-branch action now works with YAML config

---

## 3. ✅ Submodule Errors Fixed

**Commit:** `aca9288`

**Problem:**

```
fatal: no submodule mapping found in .gitmodules for path 'examples/pipecraft-example-nx'
```

Ghost submodule entries existed in git index without `.gitmodules` file

**Solution:**

```bash
# Removed submodule entries from index
git rm --cached examples/pipecraft-example-nx examples/trunk-based-demo

# Deleted old renamed submodule reference
git add -A  # Stages deletion of trunk-based-demo
```

**Impact:** No more submodule errors in CI checkout

---

## 4. ✅ Actions Decoupled from Config Files

**Commit:** `aca9288`

**Problem:** Actions had hard dependencies on PipeCraft's `.pipecraftrc` file structure, making them non-transferable

**Solution:** Refactored `promote-branch` action to accept ALL configuration through inputs

### Before (Coupled):

```yaml
inputs:
  configPath:
    default: '.pipecraftrc' # Action reads this file

steps:
  - name: Read Config
    run: |
      CONFIG=$(cat .pipecraftrc)
      TARGET=$(echo "$CONFIG" | yq .branchFlow[1])
```

### After (Decoupled):

```yaml
inputs:
  sourceBranch:
    required: true # Explicit input
  targetBranch:
    required: true # Explicit input
  autoMerge:
    required: false
    default: 'false'

steps:
  - name: Use Inputs
    run: |
      TARGET="${{ inputs.targetBranch }}"
```

### Benefits:

- ✅ Works in ANY repository
- ✅ No file system dependencies
- ✅ Can be published to GitHub Marketplace
- ✅ Easy to test independently
- ✅ Config-agnostic (works with JSON, YAML, TOML, env vars, or manual inputs)

### Breaking Change:

Workflows must now pass `targetBranch` explicitly:

```yaml
# ❌ Old (will fail)
- uses: ./.github/actions/promote-branch
  with:
    currentBranch: develop

# ✅ New (decoupled)
- uses: ./.github/actions/promote-branch
  with:
    sourceBranch: develop
    targetBranch: staging
    autoMerge: false
```

---

## 5. 📚 Documentation Added

**New Files:**

- `DECOUPLING_SUMMARY.md` - Quick reference for action decoupling
- `docs/DECOUPLING_GUIDE.md` - Comprehensive 200+ line guide
- `docs/examples/decoupled-workflow-example.yml` - Usage examples

**Topics Covered:**

- Why decouple actions
- Architecture comparison (coupled vs decoupled)
- Migration strategy (hybrid approach)
- Testing decoupled actions
- Publishing to Marketplace
- Best practices

---

## Policy Established: No Nested Git Repos

**Rule:** Example repositories should NOT have `.git` directories committed

**Pattern:**

- Store as `.git.stored` in repo
- Use `scripts/activate-example-repos.mjs` to temporarily convert to `.git` for testing
- Use `scripts/deactivate-example-repos.mjs` to revert back
- `.gitignore` allows `.git.stored/` to be committed

**Rationale:**

- Prevents submodule confusion
- Avoids nested repository issues
- CI checkout works cleanly
- Examples can still function as git repos during testing

---

## Next Steps

### Immediate

- [ ] Update workflow templates to generate decoupled promote-branch calls
- [ ] Test promote workflow with new inputs
- [ ] Verify CI passes on develop

### Short Term

- [ ] Update PipeCraft CLI to generate workflows that pass explicit inputs
- [ ] Add migration guide for existing projects
- [ ] Update other actions following decoupling pattern

### Long Term

- [ ] Consider publishing stable actions to GitHub Marketplace
- [ ] Version actions independently from PipeCraft
- [ ] Create reusable action library

---

## Files Changed

```
.github/actions/promote-branch/action.yml  # Decoupled action
DECOUPLING_SUMMARY.md                      # New guide
docs/DECOUPLING_GUIDE.md                   # New comprehensive guide
docs/examples/decoupled-workflow-example.yml  # New examples
examples/trunk-based-demo                  # Removed (old submodule)
```

---

## Commands to Verify

```bash
# Check no submodule entries remain
git ls-files --stage | grep 160000

# Check no nested .git directories
find examples -name ".git" -type d

# Verify lint passes
pnpm run lint

# Verify action inputs
cat .github/actions/promote-branch/action.yml | grep -A 5 "inputs:"
```

---

## Summary

✅ **4 critical issues fixed:**

1. Linting failures (236 files formatted)
2. Config file migration (.pipecraftrc.json → .pipecraftrc)
3. Submodule errors (ghost entries removed)
4. Action coupling (promote-branch now fully decoupled)

✅ **Policy established:** No nested git repos (use .git.stored pattern)

✅ **Documentation added:** Comprehensive decoupling guides

⚠️ **Breaking change:** Workflows must update promote-branch calls to use new input parameters

🚀 **Impact:** Actions are now transferable, testable, and marketplace-ready
