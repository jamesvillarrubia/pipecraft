# PipeCraft User Journey Error Analysis

This document maps out every failure point a new user might encounter and the error handling needed.

## Phase 1: Installation

### Scenario A: User tries `npm install -g pipecraft`

**Prerequisites Check:**
- [ ] Node.js installed (>=18.0.0)
- [ ] npm installed
- [ ] Proper permissions (or using sudo)
- [ ] Package published to npm

**Possible Errors:**
```bash
# Error: Node not installed
bash: npm: command not found
→ Need: "Please install Node.js: https://nodejs.org"

# Error: Old Node version
npm ERR! Unsupported engine
→ Need: "PipeCraft requires Node.js >=18.0.0. Current: vX.X.X"

# Error: Permission denied
EACCES: permission denied
→ Need: "Try: sudo npm install -g pipecraft OR use npx"

# Error: Package not found (before published)
404 Not Found - GET https://registry.npmjs.org/pipecraft
→ Need: "Use npx or install from source"
```

### Scenario B: User tries `npx pipecraft`

**Prerequisites Check:**
- [ ] Node.js installed
- [ ] npm installed
- [ ] In a directory (any directory)

**Possible Errors:**
```bash
# Same Node/npm errors as above
```

## Phase 2: `pipecraft init`

### User Location Check

**Where might users run this?**

1. **❌ Not in git repo yet**
```bash
cd ~/projects/my-new-project
pipecraft init
```
→ Should work! (git not required for init)

2. **❌ In git repo but no remote**
```bash
git init
pipecraft init
```
→ Should work! (remote not required for init)

3. **✅ In git repo with remote**
```bash
git clone <repo>
pipecraft init
```
→ Should work!

**Current Issues:**
- ❌ No check for existing config file
- ❌ No warning about overwriting
- ❌ Unclear prompts for new users
- ❌ No validation of branch names

### Init Process Errors

**Error 1: Config Already Exists**
```bash
pipecraft init
# .pipecraftrc.json already exists
```
→ Need: "Config already exists. Use --force to overwrite or edit manually"

**Error 2: Invalid Branch Names**
```bash
# User enters: "my branch" (with space)
```
→ Need: Validate branch names (no spaces, valid git ref)

**Error 3: Duplicate Branch Names**
```bash
# User enters same branch for develop and main
```
→ Need: "Branch names must be unique"

**Error 4: Invalid Domain Paths**
```bash
# User enters: "../../../etc/passwd"
```
→ Need: Validate paths are within project

**Error 5: No Domains Configured**
```bash
# User skips all domain configuration
```
→ Need: "At least one domain is required"

## Phase 3: `pipecraft generate`

### Prerequisites Check

**Must Have:**
- [ ] Config file exists (.pipecraftrc.json)
- [ ] Config is valid JSON
- [ ] Config has required fields
- [ ] In git repository (for git commands)
- [ ] Has git remote (for GitHub Actions)
- [ ] Branches exist or can be created

### Error Scenarios

**Error 1: No Config File**
```bash
pipecraft generate
# Error: Config file not found
```
→ Current: Generic error
→ Need: "No configuration found. Run 'pipecraft init' first"

**Error 2: Invalid Config**
```bash
# .pipecraftrc.json has syntax error
{
  "ciProvider": "github",
  missing closing brace
```
→ Need: "Invalid JSON in .pipecraftrc.json: <specific error>"

**Error 3: Missing Required Fields**
```bash
# Config missing 'domains' field
```
→ Need: "Config validation failed: Missing required field 'domains'"

**Error 4: Not in Git Repo**
```bash
cd ~/not-a-git-repo
pipecraft generate
```
→ Need: "Must be in a git repository. Run 'git init' first"

**Error 5: No Git Remote**
```bash
git init  # But no remote added
pipecraft generate
```
→ Need: "No git remote found. Add remote: git remote add origin <url>"

**Error 6: Can't Write to .github Directory**
```bash
# Permission denied
```
→ Need: "Permission denied writing to .github/workflows. Check permissions"

**Error 7: Branches Don't Exist**
```bash
# Config specifies 'staging' but doesn't exist
```
→ Need: "Branch 'staging' not found. Run 'pipecraft setup' to create branches"

## Phase 4: `pipecraft setup-github`

### Prerequisites Check

**Must Have:**
- [ ] In git repository
- [ ] Git remote is GitHub (not GitLab/Bitbucket)
- [ ] GitHub token available
- [ ] Token has correct permissions

### Error Scenarios

**Error 1: No Token**
```bash
pipecraft setup-github
```
→ Current: Good error message ✅
→ Shows: How to set GITHUB_TOKEN or use gh CLI

**Error 2: Invalid Token**
```bash
export GITHUB_TOKEN=invalid_token_123
pipecraft setup-github
```
→ Need: "GitHub API returned 401 Unauthorized. Check your token"

**Error 3: Token Missing Permissions**
```bash
# Token has read-only access
```
→ Need: "Token needs 'admin:org' or 'repo' scope. Create new token at: <url>"

**Error 4: Not a GitHub Repo**
```bash
git remote add origin git@gitlab.com:user/repo.git
pipecraft setup-github
```
→ Current: Good error ✅
→ Shows: "Could not parse GitHub repository URL"

**Error 5: Private Repo, Wrong Token**
```bash
# Using personal token on org repo
```
→ Need: "403 Forbidden. You may need organization admin access"

## Phase 5: First Workflow Run

### Prerequisites Check

**Must Have:**
- [ ] GitHub Actions enabled on repo
- [ ] Workflow file exists (.github/workflows/pipeline.yml)
- [ ] Branches exist (develop, staging, main)
- [ ] Repository permissions configured
- [ ] At least one commit

### Error Scenarios

**Error 1: Actions Disabled**
```bash
# User pushes, nothing happens
```
→ Need: Documentation/CLI check: "Verify Actions enabled at: <repo>/settings/actions"

**Error 2: Missing Branches**
```bash
# Workflow references 'staging' but doesn't exist
```
→ Need: "Run 'pipecraft setup' to create all branches"

**Error 3: Permissions Not Set**
```bash
# Workflow fails: "Resource not accessible by integration"
```
→ Current: Good error from setup-github ✅
→ But: Could add to generate command validation

## Required Error Handling Improvements

### Priority 1: Critical Path

1. **✅ DONE**: setup-github token validation
2. **❌ TODO**: init - check for existing config
3. **❌ TODO**: generate - validate config file exists
4. **❌ TODO**: generate - validate in git repo
5. **❌ TODO**: generate - validate git remote exists

### Priority 2: User Experience

6. **❌ TODO**: Validate branch names in init
7. **❌ TODO**: Check Node.js version on startup
8. **❌ TODO**: Better error messages for JSON parse errors
9. **❌ TODO**: Suggest next steps after each command

### Priority 3: Nice to Have

10. **❌ TODO**: Pre-flight checks before generate
11. **❌ TODO**: Dry-run mode for generate
12. **❌ TODO**: Validation summary before applying changes
13. **❌ TODO**: Interactive troubleshooting guide

## Proposed CLI Flow with Checks

```bash
# Step 1: Install
npm install -g pipecraft
→ Check: Node version
→ Success: "PipeCraft installed! Run 'pipecraft init' to get started"

# Step 2: Init
pipecraft init
→ Check: Existing config? Warn before overwrite
→ Interactive: Guide through configuration
→ Validate: Branch names, domain paths
→ Success: "Config created! Next: 'pipecraft generate'"

# Step 3: Setup branches (optional but recommended)
pipecraft setup
→ Check: Git repo exists
→ Check: Git remote configured
→ Create: All branches from branchFlow
→ Success: "Branches created! Next: 'pipecraft setup-github'"

# Step 4: Setup GitHub
pipecraft setup-github
→ Check: Git remote is GitHub
→ Check: Token available
→ Check: Token has permissions
→ Update: Repository settings
→ Success: "GitHub configured! Next: 'pipecraft generate'"

# Step 5: Generate
pipecraft generate
→ Pre-flight checks:
  - Config valid?
  - In git repo?
  - Remote exists?
  - Branches exist? (suggest 'pipecraft setup')
  - Can write to .github/?
→ Generate: Workflows and actions
→ Update: Idempotency cache
→ Success: "Workflows generated! Commit and push to test"

# Step 6: First run
git add .
git commit -m "feat: add pipecraft workflows"
git push
→ Instructions: "Check Actions at: <repo>/actions"
→ If fails: "Run 'pipecraft verify' to troubleshoot"
```

## New Command Idea: `pipecraft verify`

A troubleshooting command that checks everything:

```bash
pipecraft verify

Checking PipeCraft setup...

✅ Node.js version: 20.0.0 (>= 18.0.0)
✅ Git repository: Yes
✅ Git remote: Yes (github.com/user/repo)
✅ Config file: .pipecraftrc.json (valid)
✅ Branches exist: develop, staging, main
✅ Workflows exist: .github/workflows/pipeline.yml
⚠️  GitHub Actions permissions: Not configured
    → Run: pipecraft setup-github

✅ GitHub token: Found (GITHUB_TOKEN)
❌ Branches don't match config
    → Config expects: develop, staging, main
    → Repo has: main, master
    → Run: pipecraft setup --force

Summary: 7 passed, 1 warning, 1 error
```
