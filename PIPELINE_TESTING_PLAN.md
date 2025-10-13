# Pipeline Testing Plan

## Overview

This document outlines a comprehensive testing strategy to catch CI/CD pipeline errors locally before they reach GitHub Actions. The goal is to validate generated workflows and actions to prevent common issues like:

- Missing dependencies (unused imports)
- Incorrect action syntax (secrets in composite actions)
- Missing git configuration
- Token passing issues
- Version format validation
- Build failures

## Current Pain Points

From our recent debugging session, we identified these issues that should be caught by tests:

1. **Unused imports causing build failures** (`inquirer` import)
2. **Composite actions trying to access `secrets` directly** (need inputs instead)
3. **Missing git config** (user.name/email) in actions that create commits/tags
4. **Version format mismatches** (v0.1.0 vs 0.1.0)
5. **Lockfile compatibility** (frozen-lockfile flag issues)
6. **Missing checkout steps** before using local actions
7. **Token passing** to composite actions

## Testing Strategy

### 1. Local Action Testing with `act`

**Tool**: [nektos/act](https://github.com/nektos/act)

`act` allows running GitHub Actions locally using Docker.

#### Setup
```bash
# Install act
brew install act

# Create .actrc for configuration
echo "-P ubuntu-latest=catthehacker/ubuntu:act-latest" > .actrc
```

#### Test Structure
```
tests/
├── act/
│   ├── run-act-tests.sh           # Main test runner
│   ├── test-changes-detection.sh   # Test changes action
│   ├── test-version-calculation.sh # Test version action
│   ├── test-tag-creation.sh        # Test tag action
│   └── test-pr-creation.sh         # Test PR action
```

#### Example Test Script
```bash
#!/bin/bash
# tests/act/test-tag-creation.sh

# Test tag creation action locally
act -W .github/workflows/pipeline.yml \
    --job tag \
    --secret GITHUB_TOKEN=$GITHUB_TOKEN \
    --input version=v1.0.0 \
    --dryrun

# Verify outputs
if [ $? -eq 0 ]; then
    echo "✅ Tag creation action syntax valid"
else
    echo "❌ Tag creation action failed"
    exit 1
fi
```

### 2. Static Analysis of Generated Workflows

#### YAML Linting
```bash
# Add to package.json scripts
"lint:yaml": "yamllint .github/**/*.yml"
```

#### Action Schema Validation
```bash
# Validate action.yml files against GitHub's schema
npm install -g action-validator
action-validator .github/actions/*/action.yml
```

#### Custom Validation Script
Create `scripts/validate-pipeline.js`:

```javascript
const fs = require('fs');
const yaml = require('yaml');
const path = require('path');

function validateWorkflow(workflowPath) {
  const content = fs.readFileSync(workflowPath, 'utf8');
  const workflow = yaml.parse(content);

  const errors = [];

  // Check for local actions without checkout
  for (const [jobName, job] of Object.entries(workflow.jobs || {})) {
    const steps = job.steps || [];
    let hasCheckout = false;

    for (const step of steps) {
      if (step.uses === 'actions/checkout@v4') {
        hasCheckout = true;
      }

      // Check for local action usage
      if (step.uses && step.uses.startsWith('./')) {
        if (!hasCheckout) {
          errors.push(`Job '${jobName}' uses local action '${step.uses}' without checking out code first`);
        }
      }
    }
  }

  return errors;
}

function validateCompositeAction(actionPath) {
  const content = fs.readFileSync(actionPath, 'utf8');
  const action = yaml.parse(content);

  const errors = [];

  // Check for secrets usage in composite actions
  const actionContent = fs.readFileSync(actionPath, 'utf8');
  if (actionContent.includes('secrets.')) {
    errors.push(`Composite action ${actionPath} tries to access secrets directly. Use inputs instead.`);
  }

  // Check for git operations without config
  if (action.runs && action.runs.using === 'composite') {
    const steps = action.runs.steps || [];
    let hasGitConfig = false;
    let hasGitOperations = false;

    for (const step of steps) {
      const run = step.run || '';

      if (run.includes('git config')) {
        hasGitConfig = true;
      }

      if (run.includes('git tag') || run.includes('git commit') || run.includes('git push')) {
        hasGitOperations = true;
      }
    }

    if (hasGitOperations && !hasGitConfig) {
      errors.push(`Action ${actionPath} performs git operations without setting git config`);
    }
  }

  return errors;
}

// Run validations
const workflowErrors = validateWorkflow('.github/workflows/pipeline.yml');
const actionFiles = fs.readdirSync('.github/actions')
  .map(dir => path.join('.github/actions', dir, 'action.yml'))
  .filter(p => fs.existsSync(p));

const actionErrors = actionFiles.flatMap(validateCompositeAction);

const allErrors = [...workflowErrors, ...actionErrors];

if (allErrors.length > 0) {
  console.error('❌ Pipeline validation failed:');
  allErrors.forEach(err => console.error(`  - ${err}`));
  process.exit(1);
} else {
  console.log('✅ Pipeline validation passed');
}
```

### 3. Build Verification Tests

Add to test suite:

```typescript
// tests/unit/build-verification.test.ts

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

describe('Build Verification', () => {
  it('should build without errors', () => {
    expect(() => {
      execSync('pnpm build', { encoding: 'utf8' });
    }).not.toThrow();
  });

  it('should not have unused imports', () => {
    // Use ts-unused-exports to find unused imports
    const result = execSync('npx ts-unused-exports tsconfig.json', {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    const unusedImports = result.split('\n').filter(line => line.includes('unused'));

    if (unusedImports.length > 0) {
      console.warn('Unused imports found:', unusedImports);
    }

    // This is a warning, not a failure, but we log it
  });
});
```

### 4. Integration Tests with Test Workflows

Create minimal test workflows that can be run with `act`:

```yaml
# .github/workflows/test-actions.yml
name: Test Actions

on:
  workflow_dispatch:

jobs:
  test-detect-changes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: ./.github/actions/detect-changes
        id: changes
        with:
          baseRef: main

      - name: Verify outputs
        run: |
          echo "Changes detected: ${{ steps.changes.outputs.core }}"
          if [ -z "${{ steps.changes.outputs.core }}" ]; then
            echo "❌ No output from detect-changes"
            exit 1
          fi

  test-calculate-version:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: ./.github/actions/calculate-version
        id: version
        with:
          baseRef: main

      - name: Verify version format
        run: |
          VERSION="${{ steps.version.outputs.nextVersion }}"
          if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "❌ Invalid version format: $VERSION"
            exit 1
          fi
          echo "✅ Valid version: $VERSION"
```

### 5. Pre-commit Hooks

Add validation to pre-commit hooks:

```bash
# .husky/pre-commit (or use lefthook/pre-commit)

#!/bin/bash

echo "🔍 Validating generated workflows..."

# Run validation script
node scripts/validate-pipeline.js

if [ $? -ne 0 ]; then
    echo "❌ Pipeline validation failed. Please fix errors before committing."
    exit 1
fi

# Lint YAML files
pnpm lint:yaml

# Run build to catch TypeScript errors
pnpm build

echo "✅ Pre-commit validation passed"
```

### 6. Automated Testing Matrix

#### Test Categories

| Category | Tool | Tests | Frequency |
|----------|------|-------|-----------|
| **Syntax Validation** | yamllint, action-validator | YAML syntax, schema validation | Pre-commit |
| **Build Verification** | TypeScript, pnpm | No unused imports, successful build | Pre-commit, CI |
| **Action Logic** | act, vitest | Action inputs/outputs, error handling | Pre-push, CI |
| **Integration** | act with test workflows | End-to-end workflow execution | Manual, CI |
| **Custom Validation** | Custom scripts | Git config, token passing, checkout order | Pre-commit, CI |

## Implementation Checklist

### Phase 1: Basic Validation (1-2 hours)
- [ ] Add yamllint to project
- [ ] Create `scripts/validate-pipeline.js`
- [ ] Add validation npm script
- [ ] Test with current pipeline

### Phase 2: Act Integration (2-3 hours)
- [ ] Install and configure act
- [ ] Create test workflow (`.github/workflows/test-actions.yml`)
- [ ] Write basic act test scripts
- [ ] Document how to run act tests locally

### Phase 3: Pre-commit Integration (1 hour)
- [ ] Set up husky or lefthook
- [ ] Add validation to pre-commit hook
- [ ] Add build check to pre-commit hook
- [ ] Test pre-commit hook

### Phase 4: CI Integration (1-2 hours)
- [ ] Add validation job to pipeline
- [ ] Run act tests in CI (if feasible)
- [ ] Add build verification tests to test suite
- [ ] Configure failure notifications

### Phase 5: Documentation (1 hour)
- [ ] Document how to run tests locally
- [ ] Add troubleshooting guide
- [ ] Create video/gif demos
- [ ] Update CONTRIBUTING.md

## Testing Workflow

### For Developers

```bash
# Before committing changes to workflow/actions:

# 1. Validate pipeline syntax
npm run validate:pipeline

# 2. Test specific action locally with act
./tests/act/test-tag-creation.sh

# 3. Run full build
pnpm build

# 4. Commit (pre-commit hooks will run automatically)
git commit -m "fix: update workflow"
```

### For CI

```yaml
# Add to pipeline.yml or separate validation workflow
validate:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Validate Pipeline
      run: node scripts/validate-pipeline.js

    - name: Lint YAML
      run: pnpm lint:yaml

    - name: Build Verification
      run: pnpm build
```

## Specific Validations to Implement

### 1. Git Config Validation
```javascript
function checkGitConfig(actionPath) {
  const content = fs.readFileSync(actionPath, 'utf8');
  const gitOperations = ['git commit', 'git tag', 'git push'];
  const hasGitOps = gitOperations.some(op => content.includes(op));
  const hasGitConfig = content.includes('git config user.name');

  if (hasGitOps && !hasGitConfig) {
    return `❌ ${actionPath}: Git operations without git config`;
  }
  return null;
}
```

### 2. Token Passing Validation
```javascript
function checkTokenUsage(actionPath) {
  const content = fs.readFileSync(actionPath, 'utf8');
  const action = yaml.parse(content);

  // Check if composite action tries to use secrets
  if (action.runs?.using === 'composite' && content.includes('secrets.')) {
    return `❌ ${actionPath}: Composite action accessing secrets directly`;
  }

  // Check if action needs token but doesn't have input
  if (content.includes('gh ') || content.includes('hub ')) {
    const hasTokenInput = action.inputs?.token !== undefined;
    if (!hasTokenInput) {
      return `⚠️  ${actionPath}: Uses gh CLI but no token input defined`;
    }
  }

  return null;
}
```

### 3. Version Format Validation
```javascript
function checkVersionFormat(actionPath) {
  const content = fs.readFileSync(actionPath, 'utf8');

  // Check if action validates version format
  if (content.includes('${{ inputs.version }}')) {
    const hasValidation = content.includes('VERSION="${VERSION#v}"') ||
                         content.includes('strip v prefix');
    if (!hasValidation) {
      return `⚠️  ${actionPath}: Uses version input without stripping 'v' prefix`;
    }
  }

  return null;
}
```

### 4. Checkout Before Local Action
```javascript
function checkCheckoutBeforeLocalAction(workflow) {
  const jobs = workflow.jobs || {};
  const errors = [];

  for (const [jobName, job] of Object.entries(jobs)) {
    const steps = job.steps || [];
    let hasCheckout = false;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      if (step.uses === 'actions/checkout@v4') {
        hasCheckout = true;
      }

      if (step.uses && step.uses.startsWith('./') && !hasCheckout) {
        errors.push(
          `❌ Job '${jobName}' step ${i + 1}: Local action '${step.uses}' ` +
          `used before checkout`
        );
      }
    }
  }

  return errors;
}
```

## Benefits

1. **Faster feedback loop**: Catch errors in seconds instead of waiting for CI
2. **Reduced CI costs**: Fewer failed pipeline runs
3. **Better developer experience**: Clear error messages locally
4. **Confidence**: Know changes will work before pushing
5. **Documentation**: Tests serve as examples of correct usage

## Future Enhancements

1. **Visual workflow validation**: Use mermaid diagrams to visualize workflow
2. **Automated PR comments**: Bot comments on PRs with validation results
3. **Performance testing**: Track workflow execution time
4. **Drift detection**: Alert when workflows differ from templates
5. **Security scanning**: Check for hardcoded secrets/tokens

## Resources

- [nektos/act Documentation](https://github.com/nektos/act)
- [GitHub Actions Toolkit](https://github.com/actions/toolkit)
- [yamllint](https://github.com/adrienverge/yamllint)
- [action-validator](https://github.com/mpalmer/action-validator)

## Conclusion

By implementing this testing strategy, we can catch most workflow/action errors locally before they reach GitHub Actions, saving time and improving the development experience. The key is to start with basic validation and gradually add more sophisticated tests as patterns emerge.

Start with Phase 1 (basic validation) and incrementally add more testing capabilities as needed.
