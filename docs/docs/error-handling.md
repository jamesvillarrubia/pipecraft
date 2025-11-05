# PipeCraft Error Handling Guide

## Overview

PipeCraft implements comprehensive error handling with clear, actionable error messages. This guide documents error types, recovery strategies, and troubleshooting steps.

## Error Categories

### 1. Configuration Errors

**When**: Loading or validating `.pipecraftrc.json`

#### Missing Configuration File

```
Error: No configuration file found. Expected: .pipecraftrc.json
```

**Cause**: No configuration file in current directory or ancestors

**Recovery**:

```bash
# Create initial configuration
pipecraft init --interactive

# Or specify custom path
pipecraft generate --config path/to/config.json
```

#### Invalid Configuration Structure

```
Error: Missing required field: branchFlow
```

**Cause**: Configuration missing required fields

**Required Fields**:

- `ciProvider`
- `mergeStrategy`
- `requireConventionalCommits`
- `initialBranch`
- `finalBranch`
- `branchFlow`
- `domains`

**Recovery**:

```bash
# Re-run init to create valid config
pipecraft init --interactive

# Or manually add missing fields to .pipecraftrc.json
```

#### Invalid Field Values

```
Error: ciProvider must be either "github" or "gitlab"
```

**Cause**: Invalid enum value in configuration

**Recovery**:

```json
{
  "ciProvider": "github", // Must be "github" or "gitlab"
  "mergeStrategy": "fast-forward" // Must be "fast-forward" or "merge"
}
```

#### Invalid Domain Configuration

```
Error: Domain "api" must have at least one path pattern
```

**Cause**: Domain configured with empty paths array

**Recovery**:

```json
{
  "domains": {
    "api": {
      "paths": ["packages/api/**"], // Must have at least one path
      "description": "API services"
    }
  }
}
```

### 2. Pre-Flight Check Failures

**When**: Running pre-flight validation before workflow generation

#### Node Version

```
Error: Node.js version 16.0.0 is too old. Required: >=18.0.0
```

**Cause**: Node.js version below minimum requirement

**Recovery**:

```bash
# Install Node 18+ using nvm
nvm install 18
nvm use 18

# Or using brew (macOS)
brew upgrade node

# Verify version
node --version
```

#### Not a Git Repository

```
Error: Current directory is not a git repository
```

**Cause**: Running PipeCraft outside a git repository

**Recovery**:

```bash
# Initialize git repository
git init

# Add remote
git remote add origin https://github.com/user/repo.git
```

#### No Git Remote

```
Error: No git remote configured
```

**Cause**: Git repository has no remote URL

**Recovery**:

```bash
# Add GitHub remote
git remote add origin https://github.com/user/repo.git

# Or GitHub CLI
gh repo create user/repo --source=. --remote=origin
```

#### Workflow Directory Not Writable

```
Error: Cannot write to .github/workflows/ directory
```

**Cause**: Insufficient permissions for workflows directory

**Recovery**:

```bash
# Fix permissions
chmod +w .github/workflows/

# Or create directory if missing
mkdir -p .github/workflows
```

#### Invalid Branch Structure

```
Error: initialBranch must be first in branchFlow
```

**Cause**: branchFlow doesn't start with initialBranch or end with finalBranch

**Recovery**:

```json
{
  "initialBranch": "develop",
  "finalBranch": "main",
  "branchFlow": ["develop", "staging", "main"] // Must match
}
```

### 3. Git Operation Errors

**When**: Executing git commands for version management or validation

#### Not a Git Repository (Runtime)

```
fatal: not a git repository (or any of the parent directories): .git
```

**Cause**: Git command executed outside repository context

**Why Suppressed**: These errors are expected in test environments and are silently handled with fallback values (e.g., version `0.0.0`).

**Recovery**: Not needed in user code; errors are caught and handled gracefully.

#### No Git Tags

```
Error: No git tags found. Cannot determine current version.
```

**Cause**: Repository has no version tags

**Recovery**:

```bash
# Create initial version tag
git tag v0.1.0
git push --tags

# Or disable versioning
# Edit .pipecraftrc.json: "versioning": { "enabled": false }
```

#### Conventional Commits Not Followed

```
Warning: Some commits do not follow conventional format
```

**Cause**: Recent commits don't match `type(scope?): subject` format

**Recovery**:

```bash
# Setup commit message validation
pipecraft init --with-versioning

# This creates:
# - commitlint.config.js
# - .husky/commit-msg hook

# Future commits will be validated automatically
```

### 4. GitHub API Errors

**When**: Configuring repository settings via GitHub API

#### Missing GitHub Token

```
Error: GITHUB_TOKEN not found in environment
```

**Cause**: No GitHub token provided for API operations

**Recovery**:

```bash
# Create personal access token at github.com/settings/tokens
# Required scopes: repo, workflow

# Set environment variable
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Or use GitHub CLI (automatically authenticated)
gh auth login
```

#### Insufficient Permissions

```
Error: Token does not have required permissions: repo, workflow
```

**Cause**: GitHub token missing required scopes

**Recovery**:

1. Go to https://github.com/settings/tokens
2. Select your token
3. Enable scopes: `repo`, `workflow`
4. Regenerate token
5. Update `GITHUB_TOKEN` environment variable

#### Rate Limit Exceeded

```
Error: GitHub API rate limit exceeded. Resets at 2024-01-01T12:00:00Z
```

**Cause**: Made too many API requests (5000/hour for authenticated)

**Recovery**:

```bash
# Wait for rate limit reset (shown in error message)

# Or use authenticated requests (higher limit)
export GITHUB_TOKEN=your_token

# Check current rate limit
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/rate_limit
```

#### Repository Not Found

```
Error: Repository not found: user/repo
```

**Cause**: Repository doesn't exist or token lacks access

**Recovery**:

```bash
# Verify repository exists
gh repo view user/repo

# Check git remote URL matches
git remote -v

# Ensure token has access to private repos (if applicable)
```

### 5. File System Errors

**When**: Reading or writing files during workflow generation

#### Permission Denied

```
Error: EACCES: permission denied, open '.pipecraftrc.json'
```

**Cause**: Insufficient permissions to read/write files

**Recovery**:

```bash
# Fix file permissions
chmod 644 .pipecraftrc.json

# Fix directory permissions
chmod 755 .github/workflows/
```

#### File Already Exists (Overwrite Protection)

```
Error: .pipecraftrc.json already exists. Use --force to overwrite.
```

**Cause**: Trying to initialize when config already exists

**Recovery**:

```bash
# Overwrite existing config
pipecraft init --force

# Or manually edit existing config
vim .pipecraftrc.json
```

#### Disk Full

```
Error: ENOSPC: no space left on device
```

**Cause**: Insufficient disk space

**Recovery**:

```bash
# Free up disk space
# Check disk usage
df -h

# Clean up
npm cache clean --force
rm -rf node_modules/.cache
```

### 6. YAML Parsing Errors

**When**: Parsing or generating workflow YAML files

#### Invalid YAML Syntax

```
Error: Invalid YAML in .github/workflows/pipeline.yml
  Line 42: Unexpected token
```

**Cause**: Malformed YAML in existing workflow file

**Recovery**:

```bash
# Validate YAML syntax
pipecraft validate

# Fix syntax errors manually
# Or regenerate from scratch
pipecraft generate --force
```

#### Comment Preservation Failed

```
Warning: Could not preserve comments in existing workflow
```

**Cause**: User comments within PipeCraft-managed blocks

**Why**: PipeCraft can only preserve comments OUTSIDE managed blocks

**Recovery**:

1. Move user comments outside `# PIPECRAFT-MANAGED` blocks
2. Regenerate workflow
3. Comments should now be preserved

### 7. Dependency Errors

**When**: Running commands that depend on external tools

#### release-it Not Found

```
Error: npx release-it: command not found
```

**Cause**: release-it not installed (when versioning is enabled)

**Recovery**:

```bash
# Install release-it
npm install --save-dev release-it @release-it/conventional-changelog

# Or disable versioning
# Edit .pipecraftrc.json: "versioning": { "enabled": false }
```

#### commitlint Not Found

```
Error: commitlint: command not found
```

**Cause**: commitlint not installed (when conventional commits required)

**Recovery**:

```bash
# Install commitlint
npm install --save-dev @commitlint/cli @commitlint/config-conventional

# Or disable conventional commits
# Edit .pipecraftrc.json: "requireConventionalCommits": false
```

#### husky Not Found

```
Error: husky: command not found
```

**Cause**: husky not installed (when setting up version management)

**Recovery**:

```bash
# Install husky
npm install --save-dev husky

# Initialize husky
npx husky install
```

## Error Recovery Strategies

### General Recovery Flow

```
1. Read Error Message
   ↓
2. Identify Error Category (config, preflight, git, etc.)
   ↓
3. Check Error Details (file, line number, field name)
   ↓
4. Apply Recovery Strategy (see above)
   ↓
5. Retry Operation
   ↓
6. If Still Failing → Enable Debug Mode
```

### Debug Mode

Enable verbose logging to diagnose issues:

```bash
# Verbose mode (detailed operation info)
pipecraft generate --verbose

# Debug mode (maximum detail)
pipecraft generate --debug

# Example output:
# [DEBUG] Loading config from /path/to/.pipecraftrc.json
# [DEBUG] Validating configuration...
# [DEBUG] Running preflight checks...
# [DEBUG] Checking Node version: 18.0.0
# [DEBUG] Checking git repository...
# [DEBUG] Generating workflow template...
```

### Dry Run Mode

Preview changes without writing files:

```bash
# See what would be generated without making changes
pipecraft generate --dry-run

# Example output:
# Would create: .github/workflows/pipeline.yml
# Would create: actions/detect-changes/action.yml
# Would update: .pipecraft-cache.json
```

### Force Regeneration

Bypass idempotency checks:

```bash
# Regenerate even if cache says nothing changed
pipecraft generate --force

# Useful when:
# - Cache is corrupted
# - Manual workflow edits were lost
# - Debugging template issues
```

## Testing Error Scenarios

### Unit Tests

Mock errors to test error handling:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { loadConfig } from './config'

describe('Config Error Handling', () => {
  it('throws clear error when config file missing', () => {
    vi.mock('fs', () => ({
      existsSync: () => false
    }))

    expect(() => loadConfig()).toThrow('No configuration file found')
  })

  it('throws validation error for invalid ciProvider', () => {
    const invalidConfig = { ciProvider: 'invalid' }

    expect(() => validateConfig(invalidConfig)).toThrow(
      'ciProvider must be either "github" or "gitlab"'
    )
  })
})
```

### Integration Tests

Test real error scenarios:

```typescript
describe('Git Error Handling', () => {
  it('handles missing git repository gracefully', async () => {
    const tempDir = await createTempDir() // No git init
    process.chdir(tempDir)

    const version = versionManager.getCurrentVersion()
    expect(version).toBe('0.0.0') // Fallback value
  })
})
```

## Error Message Guidelines

When adding new error handling:

### Good Error Messages

✅ **Specific**:

```
Error: Domain "api" must have at least one path pattern
```

✅ **Actionable**:

```
Error: Node.js version 16.0.0 is too old. Required: >=18.0.0
Suggestion: Run 'nvm install 18 && nvm use 18'
```

✅ **Context-Rich**:

```
Error: Invalid YAML in .github/workflows/pipeline.yml
  Line 42: Unexpected token ':'
  Context: jobs.test-api.steps[0]
```

### Bad Error Messages

❌ **Vague**:

```
Error: Invalid configuration
```

❌ **Non-Actionable**:

```
Error: Something went wrong
```

❌ **No Context**:

```
Error: Syntax error
```

## Logging Best Practices

### Log Levels

Use appropriate log levels:

```typescript
import { logger } from './logger'

// Informational (always shown)
logger.info('✓ Workflows generated successfully')

// Success (always shown)
logger.success('✓ GitHub repository configured')

// Warning (always shown, non-fatal)
logger.warn('⚠ No git tags found, using version 0.0.0')

// Error (always shown, fatal)
logger.error('✗ Pre-flight check failed: Node version too old')

// Verbose (shown with --verbose)
logger.verbose('Loading config from .pipecraftrc.json')

// Debug (shown with --debug)
logger.debug('Config hash: abc123')
```

### Error Context

Always provide context:

```typescript
try {
  writeFileSync(path, content)
} catch (error) {
  // ❌ Bad: Generic error
  throw new Error('Failed to write file')

  // ✅ Good: Specific error with context
  throw new Error(`Failed to write ${path}: ${error.message}`)
}
```

## Common Pitfalls

### 1. Swallowing Errors

```typescript
// ❌ Bad: Silent failure
try {
  dangerousOperation()
} catch (error) {
  // Nothing - user has no idea what went wrong
}

// ✅ Good: Log and handle
try {
  dangerousOperation()
} catch (error) {
  logger.error('Failed to perform operation:', error.message)
  throw error // Re-throw or handle appropriately
}
```

### 2. Not Validating Input

```typescript
// ❌ Bad: No validation
function generateWorkflow(config: any) {
  return template(config.branchFlow) // Might be undefined!
}

// ✅ Good: Validate first
function generateWorkflow(config: PipecraftConfig) {
  validateConfig(config) // Throws if invalid
  return template(config.branchFlow)
}
```

### 3. Async Error Handling

```typescript
// ❌ Bad: Unhandled promise rejection
async function generate() {
  await generateWorkflows() // If this throws, unhandled rejection
}

// ✅ Good: Proper error handling
async function generate() {
  try {
    await generateWorkflows()
  } catch (error) {
    logger.error('Generation failed:', error.message)
    process.exit(1)
  }
}
```

## Debugging Checklist

When troubleshooting issues:

- [ ] Check Node.js version (`node --version`)
- [ ] Verify git repository (`git status`)
- [ ] Verify git remote (`git remote -v`)
- [ ] Check configuration validity (`pipecraft validate`)
- [ ] Enable verbose logging (`--verbose`)
- [ ] Enable debug logging (`--debug`)
- [ ] Check file permissions (`ls -la .github/workflows/`)
- [ ] Verify GitHub token (`echo $GITHUB_TOKEN`)
- [ ] Check GitHub Actions tab for workflow runs
- [ ] Review workflow logs for errors
- [ ] Verify branch names match configuration
- [ ] Check for uncommitted changes (`git status`)
- [ ] Review cache file (`.pipecraft-cache.json`)
- [ ] Try force regeneration (`--force`)
- [ ] Check for conflicting workflows

## Getting Help

If you encounter an error not covered in this guide:

1. **Enable Debug Mode**: `pipecraft generate --debug`
2. **Check GitHub Issues**: https://github.com/jamesvillarrubia/pipecraft/issues
3. **Create Issue**: Include:
   - PipeCraft version (`pipecraft --version`)
   - Node.js version (`node --version`)
   - Operating system
   - Full error message
   - Debug output
   - Configuration file (remove sensitive data)
4. **Stack Overflow**: Tag with `pipecraft` and `github-actions`

## Related Documentation

- [Architecture](./architecture) - System design and components
- [Current Trunk Flow](./flows/trunk-flow) - Implementation details
- [Getting Started](./intro) - User guide and examples
- [Testing Guide](./testing-guide) - Testing guidelines
