# Example Repositories Publication Plan

This document outlines the complete plan for publishing the 4 PipeCraft example repositories to GitHub.

## Status: Phase 1 Complete ✅

All 4 example repositories have been:
- ✅ Created with complete source code
- ✅ Configured with proper .pipecraftrc.json
- ✅ Documented with comprehensive READMEs
- ✅ Equipped with working test/build/lint scripts
- ✅ Integrated into main PipeCraft documentation
- ✅ Committed to branch: `pipecraft-test-run-1761333848846`

## Repository Details

### 1. pipecraft-example-minimal
- **Location:** `examples/pipecraft-example-minimal/`
- **Purpose:** Quickstart, simplest possible setup
- **Branches needed:** develop, main
- **Initial tag:** None (demonstrates bootstrap)
- **GitHub URL:** https://github.com/jamesvillarrubia/pipecraft-example-minimal

### 2. pipecraft-example-basic
- **Location:** `examples/pipecraft-example-basic/`
- **Purpose:** Standard multi-domain application
- **Branches needed:** develop, staging, main
- **Initial tag:** v0.1.0
- **GitHub URL:** https://github.com/jamesvillarrubia/pipecraft-example-basic

### 3. pipecraft-example-nx
- **Location:** `examples/pipecraft-example-nx/`
- **Purpose:** Advanced Nx monorepo
- **Branches needed:** develop, staging, main
- **Initial tag:** v0.1.0
- **GitHub URL:** https://github.com/jamesvillarrubia/pipecraft-example-nx
- **Note:** This is a Git submodule currently

### 4. pipecraft-example-gated
- **Location:** `examples/pipecraft-example-gated/`
- **Purpose:** Enterprise gated workflow
- **Branches needed:** develop, alpha, beta, release, production
- **Initial tag:** v1.0.0
- **GitHub URL:** https://github.com/jamesvillarrubia/pipecraft-example-gated

---

## Phase 2: Create GitHub Repositories

### Step 1: Create Repositories on GitHub

For each example, create a public repository:

```bash
# Using GitHub CLI
gh repo create jamesvillarrubia/pipecraft-example-minimal --public --description "Minimal PipeCraft example - quickstart setup" --source=.
gh repo create jamesvillarrubia/pipecraft-example-basic --public --description "Multi-domain PipeCraft example - standard trunk-based workflow" --source=.
gh repo create jamesvillarrubia/pipecraft-example-nx --public --description "Nx monorepo PipeCraft example - advanced with mixed detection" --source=.
gh repo create jamesvillarrubia/pipecraft-example-gated --public --description "Enterprise gated workflow PipeCraft example" --source=.
```

Or manually via GitHub web interface:
1. Go to https://github.com/new
2. Repository name: `pipecraft-example-minimal` (etc.)
3. Description: (as above)
4. Public
5. Don't initialize with README, .gitignore, or license (we have those)

### Step 2: Initialize Git Repositories Locally

For each example directory:

```bash
cd examples/pipecraft-example-minimal
git init
git add .
git commit -m "feat: initial commit - minimal PipeCraft example

Complete quickstart example demonstrating:
- Single domain configuration
- 2-branch trunk flow (develop → main)
- Bootstrap behavior (no initial tag)
- Auto-merge enabled
- Working test, build, lint scripts

Perfect for learning PipeCraft basics in 5 minutes."

# Create branches
git branch -M develop
git checkout -b main

# Add remote
git remote add origin https://github.com/jamesvillarrubia/pipecraft-example-minimal.git

# Push branches
git push -u origin develop
git push -u origin main
```

Repeat for each example with appropriate commit message and branch structure.

### Step 3: Set Up Branches

**For minimal (2 branches):**
```bash
git checkout -b develop
git push -u origin develop
git checkout -b main
git push -u origin main
```

**For basic and nx (3 branches):**
```bash
git checkout -b develop
git push -u origin develop
git checkout -b staging
git push -u origin staging
git checkout -b main
git push -u origin main

# Add initial tag
git tag v0.1.0
git push origin v0.1.0
```

**For gated (5 branches):**
```bash
git checkout -b develop
git push -u origin develop
git checkout -b alpha
git push -u origin alpha
git checkout -b beta
git push -u origin beta
git checkout -b release
git push -u origin release
git checkout -b production
git push -u origin production

# Add initial tag
git tag v1.0.0
git push origin v1.0.0
```

---

## Phase 3: Configure GitHub Settings

For EACH repository:

### 3.1 General Settings
- ✅ Verify repository is Public
- ✅ Add topics: `pipecraft`, `ci-cd`, `trunk-based`, `example`, `github-actions`
- ✅ Enable Issues
- ✅ Enable Discussions (optional)
- ✅ Set default branch to `develop`

### 3.2 Actions Settings

Go to Settings → Actions → General:

1. **Actions permissions:**
   - ✅ Allow all actions and reusable workflows

2. **Workflow permissions:**
   - ✅ Read and write permissions
   - ✅ Allow GitHub Actions to create and approve pull requests

3. **Fork pull request workflows:**
   - ✅ Require approval for first-time contributors

### 3.3 Branch Protection (Optional for Examples)

For demonstration purposes, **DO NOT** enable branch protection initially. This makes it easier to test and demonstrate workflows.

If you want to add protection later:
- Protect `main` and `production` branches
- Don't require status checks (let workflows create them first)
- Allow force pushes (for testing)
- Allow deletions (for cleanup)

---

## Phase 4: Generate Workflows

For each example, generate the PipeCraft workflows:

```bash
cd examples/pipecraft-example-minimal

# Generate workflows
npx pipecraft generate

# Commit workflows
git add .github/
git commit -m "chore: generate PipeCraft workflows"
git push origin develop
```

Repeat for each example.

**Expected result:**
- `.github/workflows/pipeline.yml` created
- `.github/actions/` directory with reusable actions
- Workflows should be committed to the `develop` branch

---

## Phase 5: Test Workflows

### 5.1 Test Minimal Example

```bash
cd examples/pipecraft-example-minimal
git checkout develop

# Make a test change
echo "export const testFeature = () => {};" >> src/utils.js

# Commit with version-bumping message
git add .
git commit -m "feat: add test feature for workflow validation"
git push origin develop

# Watch workflow
gh run watch
```

**Expected behavior:**
1. Workflow runs on develop
2. Tests pass
3. Version v0.1.0 is created (first feat commit, bootstrap)
4. Code auto-merges to main
5. Tag v0.1.0 appears on main

### 5.2 Test Basic Example

```bash
cd examples/pipecraft-example-basic
git checkout develop

# Make a test change to one domain
echo "export const newFeature = () => {};" >> src/frontend/index.js

# Commit
git add .
git commit -m "feat(frontend): add test feature"
git push origin develop

# Watch workflow
gh run watch
```

**Expected behavior:**
1. Workflow detects frontend domain changed
2. Runs frontend tests only (not backend, api, shared)
3. Creates version tag (v0.1.0 or v0.2.0 depending on existing tag)
4. Auto-merges to staging
5. Auto-merges from staging to main
6. Tag appears on main

### 5.3 Test Nx Example

```bash
cd examples/pipecraft-example-nx
git checkout develop

# Make a change to a foundational lib
echo "export const newAuthFeature = () => {};" >> libs/auth/src/index.ts

# Commit
git add .
git commit -m "feat(auth): add new authentication method"
git push origin develop

# Watch workflow
gh run watch
```

**Expected behavior:**
1. Nx affected detection runs
2. Discovers auth + all dependent projects affected
3. Runs tests for all affected projects
4. Auto-merges through staging to main
5. Creates version tag

### 5.4 Test Gated Example

```bash
cd examples/pipecraft-example-gated
git checkout develop

# Make a change
echo "export const newServiceFeature = () => {};" >> services/auth-service.js

# Commit
git add .
git commit -m "feat(auth): add new authentication service"
git push origin develop

# Watch workflow
gh run watch
```

**Expected behavior:**
1. Workflow runs on develop
2. Tests pass
3. **Creates PR** to alpha (does NOT auto-merge)
4. PR awaits manual approval

**Manual approval needed:**
```bash
gh pr list
gh pr view <pr-number>
gh pr merge <pr-number> --merge  # Using merge strategy, not squash/rebase
```

Continue approving PRs through: alpha → beta → release → production

---

## Phase 6: Update Documentation

Once all examples are published and working:

### 6.1 Add Workflow Status Badges

Update each example's README with actual workflow status:

```markdown
[![CI/CD Pipeline](https://github.com/jamesvillarrubia/pipecraft-example-minimal/actions/workflows/pipeline.yml/badge.svg)](https://github.com/jamesvillarrubia/pipecraft-example-minimal/actions/workflows/pipeline.yml)
```

### 6.2 Document Test Results

Create a test report showing:
- Which workflows ran successfully
- Example commit demonstrating version bumping
- PR examples for gated workflow
- Any issues encountered and solutions

### 6.3 Update Main Documentation

Verify links work in:
- Main README.md
- examples/README.md
- docs/docs/examples.md

---

## Phase 7: Maintenance Automation

### Create Update Script

Create `scripts/update-examples.sh` in main PipeCraft repo:

```bash
#!/bin/bash
set -e

EXAMPLES=(
  "pipecraft-example-minimal"
  "pipecraft-example-basic"
  "pipecraft-example-nx"
  "pipecraft-example-gated"
)

echo "🔄 Updating all example repositories..."

for EXAMPLE in "${EXAMPLES[@]}"; do
  echo ""
  echo "📦 Processing $EXAMPLE..."

  # Clone if not exists
  if [ ! -d "tmp/$EXAMPLE" ]; then
    git clone "https://github.com/jamesvillarrubia/$EXAMPLE.git" "tmp/$EXAMPLE"
  fi

  cd "tmp/$EXAMPLE"

  # Checkout develop
  git checkout develop
  git pull origin develop

  # Regenerate workflows
  npx pipecraft generate

  # Check for changes
  if [ -n "$(git status --porcelain)" ]; then
    echo "  ✅ Workflows updated"
    git add .github/
    git commit -m "chore: regenerate workflows with latest PipeCraft"
    git push origin develop
    echo "  ✅ Pushed to develop"
  else
    echo "  ℹ️  No changes needed"
  fi

  cd ../..
done

echo ""
echo "✅ All examples updated!"
```

### Add to Main Repo CI

In main PipeCraft's `.github/workflows/pipeline.yml`, add a job:

```yaml
update-examples:
  name: Update Example Repositories
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  steps:
    - uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'

    - name: Update examples
      run: ./scripts/update-examples.sh
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Common Issues and Solutions

### Issue: Workflow not triggering

**Solution:**
1. Check Actions is enabled: Settings → Actions
2. Verify workflow file syntax: `gh workflow view pipeline.yml`
3. Ensure pushing to correct branch
4. Check workflow file is committed

### Issue: Permission denied

**Solution:**
1. Settings → Actions → General
2. Workflow permissions → Read and write permissions
3. Enable "Allow GitHub Actions to create and approve pull requests"

### Issue: Tests failing

**Solution:**
1. Run tests locally first: `npm test`
2. Check Node version matches: `node --version`
3. Review workflow logs: `gh run view --log`

### Issue: Version not creating

**Solution:**
1. For minimal: First feat/fix commit creates v0.1.0
2. For others: Ensure initial tag exists
3. Verify commit follows conventional commits format

### Issue: Auto-merge not working

**Solution:**
1. Check autoMerge config in .pipecraftrc.json
2. Verify no branch protection rules blocking
3. Check workflow permissions

---

## Checklist for Each Example

- [ ] GitHub repository created
- [ ] Repository is public
- [ ] Topics added
- [ ] Default branch set to develop
- [ ] Actions enabled with read/write permissions
- [ ] All branches created and pushed
- [ ] Initial tag created (if applicable)
- [ ] Workflows generated with `pipecraft generate`
- [ ] Test commit made to develop
- [ ] Workflow ran successfully
- [ ] Version tag created
- [ ] Code promoted through branches
- [ ] README badge updated with actual status
- [ ] Links verified in main documentation

---

## Timeline Estimate

- **Phase 2 (Create repos):** 30 minutes
- **Phase 3 (Configure settings):** 15 minutes
- **Phase 4 (Generate workflows):** 15 minutes
- **Phase 5 (Test workflows):** 1-2 hours (waiting for Actions to run)
- **Phase 6 (Update docs):** 30 minutes
- **Phase 7 (Automation):** 1 hour

**Total:** ~4 hours (including workflow execution time)

---

## Success Criteria

✅ All 4 repositories are public and accessible
✅ Each repository has working GitHub Actions workflows
✅ Test commits demonstrate version bumping and branch promotion
✅ Gated example shows PR creation at each gate
✅ Documentation links work correctly
✅ Each repository has 1+ successful workflow run
✅ README badges show passing status
✅ Users can clone and run examples immediately

---

## Next Actions

**Immediate:**
1. Create 4 GitHub repositories
2. Initialize local git repos in each example directory
3. Push to GitHub with branch structure
4. Generate workflows in each repo

**After testing:**
5. Document any issues encountered
6. Update READMEs with lessons learned
7. Create update automation script
8. Announce examples in main repo README

**Future:**
9. Add more examples for different scenarios
10. Create video walkthrough of examples
11. Build automated test suite that validates examples
12. Set up scheduled checks to ensure examples stay working

---

## Notes

- Examples are currently in `examples/` directory of main PipeCraft repo
- They need to be extracted into separate repositories
- Nx example is currently a Git submodule - needs special handling
- Consider whether to keep copies in main repo or only link to separate repos
- Update script should be tested on a schedule (weekly?) to catch issues
