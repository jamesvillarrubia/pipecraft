# Strategy-Agnostic Action Pattern

> **Last Updated**: 2025-11-01
> **Purpose**: Document the pattern for building GitHub Actions that work with multiple strategies (Nx, Turbo, path-based, etc.) in a single action file

## Overview

A **strategy-agnostic action** is a single GitHub Action that can adapt to different project structures and build strategies without requiring separate action files or regeneration.

**Key Principle**: One action file, multiple strategies, runtime detection, conditional execution.

---

## Why Strategy-Agnostic?

### The Problem

**Traditional approach** (anti-pattern):
```
actions/
├── detect-changes-nx/        # Separate action for Nx
│   └── action.yml
└── detect-changes-path/      # Separate action for path-based
    └── action.yml
```

**Problems with this approach**:
- ❌ Must generate different actions based on strategy
- ❌ Changing strategy (Nx → path-based) requires regeneration
- ❌ Adding Turbo → need third action
- ❌ Maintenance nightmare (fix bugs in 3 places)
- ❌ Users must know which action to use

### The Solution

**Strategy-agnostic approach** (best practice):
```
actions/
└── detect-changes/           # One action, multiple strategies
    └── action.yml
```

**Benefits**:
- ✅ Single action file handles all strategies
- ✅ Auto-detects strategy at runtime
- ✅ Graceful fallback between strategies
- ✅ Adding strategy (Nx → Turbo) → NO regeneration
- ✅ Easier to maintain (one codebase)
- ✅ Marketplace-ready

---

## Reference Implementation: `detect-changes`

The `detect-changes` action is the **gold standard** for this pattern.

**Location**: [`.github/actions/detect-changes/action.yml`](../.github/actions/detect-changes/action.yml)

**Strategies supported**:
1. **Nx dependency graph** (primary) - Uses `nx show projects --affected`
2. **Path-based detection** (fallback) - Uses `dorny/paths-filter@v3`

**Key features**:
- Auto-detects Nx availability
- Conditional step execution based on strategy
- Unified output format
- Package manager auto-detection
- Accepts strategy override via input

---

## Pattern Components

### 1. Strategy Detection

Auto-detect what's available in the repository:

```yaml
- name: Check for Nx
  id: nx-check
  shell: bash
  run: |
    if [ -f "nx.json" ] || ([ -f "package.json" ] && grep -q '"nx"' package.json); then
      echo "available=true" >> $GITHUB_OUTPUT
      echo "🔍 Nx detected in repository"
    else
      echo "available=false" >> $GITHUB_OUTPUT
      echo "⚠️  Nx not detected, falling back to path-based detection"
    fi
```

**Key points**:
- Check for marker files (`nx.json`, `turbo.json`, etc.)
- Output result as `available` flag
- User-friendly logging

### 2. Strategy Input Override

Allow users to override auto-detection:

```yaml
inputs:
  useNx:
    description: 'Whether to use Nx dependency graph for change detection'
    required: false
    default: 'true'  # Will be skipped if Nx not available
```

**Why provide override?**:
- Testing specific strategies
- Debugging
- Performance tuning
- Explicit control when needed

### 3. Conditional Steps

Execute strategy-specific logic based on detection:

```yaml
- name: Detect Changes with Nx (if available)
  id: nx-filter
  if: steps.nx-check.outputs.available == 'true' && inputs.useNx == 'true'
  shell: bash
  run: |
    echo "🚀 Using Nx dependency graph for change detection"
    # Nx-specific logic here
    AFFECTED_PROJECTS=$(npx nx show projects --affected --base=${{ inputs.baseRef }})
    # ... process results

- name: Detect Changes with Paths Filter (fallback)
  uses: dorny/paths-filter@v3
  id: filter
  if: steps.nx-check.outputs.available != 'true' || inputs.useNx != 'true'
  with:
    base: ${{ inputs.baseRef }}
    filters: ${{ steps.transform-config.outputs.filters }}
```

**Key points**:
- Mutually exclusive conditions
- Clear logging of which strategy is active
- Same `id` namespace can be used if outputs differ

### 4. Unified Output

Regardless of strategy, provide consistent outputs:

```yaml
outputs:
  changes:
    description: 'JSON object with domain change results'
    value: ${{ steps.output.outputs.changes }}
  affectedDomains:
    description: 'Comma-separated list of domains with changes'
    value: ${{ steps.output.outputs.affectedDomains }}
  nxAvailable:
    description: 'Whether Nx is available in the repository'
    value: ${{ steps.nx-check.outputs.available }}
```

**Consolidation step**:
```yaml
- name: Generate Outputs
  id: output
  shell: bash
  run: |
    # Determine which detection method was used
    if [ "${{ steps.nx-check.outputs.available }}" == "true" ] && [ "${{ inputs.useNx }}" == "true" ]; then
      # Use Nx results
      CHANGES_JSON=$(cat /tmp/nx-results.json)
      echo "🔍 Using Nx dependency analysis results"
    else
      # Use path filter results
      CHANGES_JSON=$(cat /tmp/path-results.json)
      echo "📁 Using path-based change detection"
    fi

    # Output unified format
    echo "changes<<EOF" >> $GITHUB_OUTPUT
    echo "$CHANGES_JSON" >> $GITHUB_OUTPUT
    echo "EOF" >> $GITHUB_OUTPUT
```

---

## Complete Pattern Template

Use this template to create strategy-agnostic actions:

```yaml
name: 'Strategy-Agnostic Action'
description: 'Works with multiple strategies (Nx, Turbo, path-based, etc.)'

inputs:
  # Strategy control
  useNx:
    description: 'Use Nx strategy if available'
    required: false
    default: 'true'
  useTurbo:
    description: 'Use Turbo strategy if available'
    required: false
    default: 'true'

  # Required inputs (all strategies need)
  config:
    description: 'Configuration data'
    required: true

outputs:
  result:
    description: 'Result (same format regardless of strategy)'
    value: ${{ steps.output.outputs.result }}
  strategyUsed:
    description: 'Which strategy was actually used'
    value: ${{ steps.output.outputs.strategy }}

runs:
  using: 'composite'
  steps:
    # ==========================================
    # STEP 1: DETECT AVAILABLE STRATEGIES
    # ==========================================

    - name: Detect Nx
      id: detect-nx
      shell: bash
      run: |
        if [ -f "nx.json" ]; then
          echo "available=true" >> $GITHUB_OUTPUT
          echo "✅ Nx available"
        else
          echo "available=false" >> $GITHUB_OUTPUT
          echo "⏭️  Nx not available"
        fi

    - name: Detect Turbo
      id: detect-turbo
      shell: bash
      run: |
        if [ -f "turbo.json" ]; then
          echo "available=true" >> $GITHUB_OUTPUT
          echo "✅ Turbo available"
        else
          echo "available=false" >> $GITHUB_OUTPUT
          echo "⏭️  Turbo not available"
        fi

    # ==========================================
    # STEP 2: STRATEGY-SPECIFIC EXECUTION
    # ==========================================

    - name: Execute Nx Strategy
      id: nx-strategy
      if: |
        steps.detect-nx.outputs.available == 'true' &&
        inputs.useNx == 'true'
      shell: bash
      run: |
        echo "🚀 Using Nx strategy"
        # Nx-specific logic
        # Save results to /tmp/nx-results.json

    - name: Execute Turbo Strategy
      id: turbo-strategy
      if: |
        steps.detect-turbo.outputs.available == 'true' &&
        inputs.useTurbo == 'true' &&
        steps.detect-nx.outputs.available != 'true'
      shell: bash
      run: |
        echo "⚡ Using Turbo strategy"
        # Turbo-specific logic
        # Save results to /tmp/turbo-results.json

    - name: Execute Fallback Strategy
      id: fallback-strategy
      if: |
        steps.detect-nx.outputs.available != 'true' &&
        steps.detect-turbo.outputs.available != 'true'
      shell: bash
      run: |
        echo "📁 Using fallback strategy"
        # Default/path-based logic
        # Save results to /tmp/fallback-results.json

    # ==========================================
    # STEP 3: CONSOLIDATE OUTPUTS
    # ==========================================

    - name: Generate Unified Outputs
      id: output
      shell: bash
      run: |
        # Determine which strategy ran
        if [ -f "/tmp/nx-results.json" ]; then
          RESULT=$(cat /tmp/nx-results.json)
          STRATEGY="nx"
        elif [ -f "/tmp/turbo-results.json" ]; then
          RESULT=$(cat /tmp/turbo-results.json)
          STRATEGY="turbo"
        else
          RESULT=$(cat /tmp/fallback-results.json)
          STRATEGY="path-based"
        fi

        # Output unified format
        echo "result<<EOF" >> $GITHUB_OUTPUT
        echo "$RESULT" >> $GITHUB_OUTPUT
        echo "EOF" >> $GITHUB_OUTPUT

        echo "strategy=$STRATEGY" >> $GITHUB_OUTPUT
        echo "📊 Strategy used: $STRATEGY"
```

---

## Package Manager Auto-Detection

Another common multi-strategy concern: package managers.

**Pattern from `detect-changes`**:

```yaml
- name: Install Dependencies
  if: steps.nx-check.outputs.available == 'true' && inputs.useNx == 'true'
  shell: bash
  run: |
    echo "📦 Installing dependencies for Nx..."
    if [ -f "pnpm-lock.yaml" ]; then
      corepack enable
      pnpm install --frozen-lockfile || pnpm install
    elif [ -f "yarn.lock" ]; then
      yarn install --frozen-lockfile || yarn install
    elif [ -f "package-lock.json" ]; then
      npm ci || npm install
    else
      npm install  # Fallback (npm always available in GitHub runners)
    fi
```

**Key points**:
- Check for lockfiles in priority order
- Use frozen installs when possible
- Fallback to npm (always available)
- No hardcoding

---

## Testing Strategy-Agnostic Actions

### Test Matrix

Test each strategy independently:

```yaml
# .github/workflows/test-actions.yml
name: Test Strategy-Agnostic Actions

on: [pull_request]

jobs:
  test-nx-strategy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Nx Test Environment
        run: |
          npm install nx
          echo '{}' > nx.json

      - name: Test Action (Nx Mode)
        uses: ./.github/actions/detect-changes
        with:
          useNx: true
          config: |
            domain-a:
              paths: ['apps/a/**']

  test-path-strategy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Path-based Test Environment
        run: |
          # Remove nx.json if exists
          rm -f nx.json

      - name: Test Action (Path Mode)
        uses: ./.github/actions/detect-changes
        with:
          useNx: false
          config: |
            domain-a:
              paths: ['apps/a/**']
```

### Integration Tests

Test strategy switching without regeneration:

```yaml
test-strategy-switching:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    # Test 1: Path-based (no Nx)
    - name: Test Path-based
      uses: ./.github/actions/detect-changes
      with:
        config: ${{ env.DOMAINS }}

    # Add Nx
    - name: Add Nx
      run: |
        npm install nx
        echo '{}' > nx.json

    # Test 2: Nx (auto-detected)
    - name: Test Nx (should auto-switch)
      uses: ./.github/actions/detect-changes
      with:
        config: ${{ env.DOMAINS }}

    # Result: Same action, different strategies, NO REGENERATION
```

---

## When to Use This Pattern

### ✅ Good Use Cases

1. **Change detection** - Nx vs Turbo vs path-based
2. **Build orchestration** - Nx vs Turbo vs custom
3. **Test execution** - Monorepo vs single package
4. **Versioning** - Monorepo vs independent
5. **Package manager operations** - npm vs yarn vs pnpm

### ❌ Not Suitable

1. **Fundamentally different purposes** - Don't force unrelated actions into one
2. **No common output** - If strategies can't produce compatible results
3. **Completely different inputs** - When inputs don't overlap at all

### ⚠️ When to Create Separate Actions

Create separate actions when:
- Strategies serve different purposes (e.g., `run-nx-affected` is Nx-only by design)
- No meaningful fallback exists
- Outputs are incompatible
- Clear naming improves usability (e.g., `@pipecraft/run-nx-affected` vs `@pipecraft/run-affected`)

---

## Adding New Strategies

### Example: Adding Turbo Support

1. **Add detection step**:
```yaml
- name: Detect Turbo
  id: turbo-check
  run: |
    if [ -f "turbo.json" ]; then
      echo "available=true" >> $GITHUB_OUTPUT
    else
      echo "available=false" >> $GITHUB_OUTPUT
    fi
```

2. **Add strategy input**:
```yaml
inputs:
  useTurbo:
    description: 'Use Turbo if available'
    required: false
    default: 'true'
```

3. **Add conditional step**:
```yaml
- name: Execute Turbo Strategy
  if: steps.turbo-check.outputs.available == 'true' && inputs.useTurbo == 'true'
  run: |
    # Turbo logic
```

4. **Update fallback conditions**:
```yaml
- name: Fallback
  if: |
    steps.nx-check.outputs.available != 'true' &&
    steps.turbo-check.outputs.available != 'true'
```

5. **Update consolidation logic**:
```yaml
- name: Generate Outputs
  run: |
    if [ -f "/tmp/turbo-results.json" ]; then
      RESULT=$(cat /tmp/turbo-results.json)
    elif ...
```

**Result**: New strategy added without breaking existing functionality!

---

## Strategy Priority

When multiple strategies are available, define priority:

```yaml
# Priority: Nx > Turbo > Path-based

- name: Nx Strategy (highest priority)
  if: steps.detect-nx.outputs.available == 'true' && inputs.useNx == 'true'
  # ...

- name: Turbo Strategy (medium priority)
  if: |
    steps.detect-turbo.outputs.available == 'true' &&
    inputs.useTurbo == 'true' &&
    (steps.detect-nx.outputs.available != 'true' || inputs.useNx != 'true')
  # Only if Nx not available or disabled

- name: Path-based Strategy (fallback)
  if: |
    (steps.detect-nx.outputs.available != 'true' || inputs.useNx != 'true') &&
    (steps.detect-turbo.outputs.available != 'true' || inputs.useTurbo != 'true')
  # Only if neither Nx nor Turbo available
```

---

## Best Practices

### 1. Clear Logging

```yaml
run: |
  echo "🔍 Detecting available strategies..."
  echo "  ✅ Nx: available"
  echo "  ❌ Turbo: not available"
  echo "  🚀 Using Nx strategy"
```

Users should understand what's happening.

### 2. Fail Gracefully

```yaml
- name: Validate Strategy
  run: |
    if [ "$STRATEGY" == "none" ]; then
      echo "❌ No valid strategy detected"
      echo "💡 Ensure nx.json, turbo.json, or path config exists"
      exit 1
    fi
```

### 3. Document Strategy Support

In action README:
```markdown
## Supported Strategies

This action automatically detects and uses the best available strategy:

1. **Nx** (preferred): Uses dependency graph for intelligent change detection
   - Requires: `nx.json` or Nx in `package.json`
   - Override: Set `useNx: false` to disable

2. **Turbo**: Uses Turbo's caching and task detection
   - Requires: `turbo.json`
   - Override: Set `useTurbo: false` to disable

3. **Path-based** (fallback): Git-based path filtering
   - Always available
   - Used when Nx/Turbo not detected
```

### 4. Provide Strategy Output

Let callers know which strategy was used:

```yaml
outputs:
  strategyUsed:
    description: 'Which strategy was used: nx, turbo, or path-based'
    value: ${{ steps.output.outputs.strategy }}
```

Useful for:
- Debugging
- Analytics
- Conditional downstream logic

### 5. Test All Strategies

```bash
# Test matrix
strategies=(nx turbo path-based)

for strategy in "${strategies[@]}"; do
  echo "Testing $strategy strategy..."
  # Run tests
done
```

---

## Migration Path

### From Strategy-Specific to Strategy-Agnostic

**Before** (multiple actions):
```
actions/
├── detect-changes-nx/
├── detect-changes-turbo/
└── detect-changes-path/
```

**Step 1**: Create unified action with all strategies
```
actions/
├── detect-changes/           # New unified action
├── detect-changes-nx/        # Keep for compatibility
├── detect-changes-turbo/     # Keep for compatibility
└── detect-changes-path/      # Keep for compatibility
```

**Step 2**: Deprecate old actions
```yaml
# detect-changes-nx/action.yml
name: 'Detect Changes (Nx) - DEPRECATED'
description: |
  ⚠️ DEPRECATED: Use ./../detect-changes instead
  This action is deprecated. Use the unified detect-changes action which
  automatically detects and uses Nx when available.
```

**Step 3**: Remove after migration period
```
actions/
└── detect-changes/           # Only unified action remains
```

---

## Real-World Example: Applying to `calculate-version`

**Current state** (suspected): Hardcoded to npm, unclear strategy support

**Target state**: Strategy-agnostic version calculation

```yaml
name: 'Calculate Version (Strategy-Agnostic)'

inputs:
  useNx:
    description: 'Use Nx version management if available'
    default: 'true'
  versioningRules:
    description: 'Versioning rules (for non-Nx mode)'
    required: false

steps:
  - name: Detect Nx
    id: detect-nx
    run: |
      if [ -f "nx.json" ]; then
        echo "available=true" >> $GITHUB_OUTPUT
      else
        echo "available=false" >> $GITHUB_OUTPUT
      fi

  - name: Nx Versioning
    if: steps.detect-nx.outputs.available == 'true' && inputs.useNx == 'true'
    run: |
      # Use Nx release tooling
      npx nx release version --dry-run

  - name: Conventional Changelog Versioning
    if: steps.detect-nx.outputs.available != 'true' || inputs.useNx != 'true'
    run: |
      # Install with auto-detected package manager
      if [ -f "pnpm-lock.yaml" ]; then
        corepack enable && pnpm add -D @release-it/conventional-changelog
      elif [ -f "yarn.lock" ]; then
        yarn add -D @release-it/conventional-changelog
      else
        npm install --save-dev @release-it/conventional-changelog
      fi

      # Use release-it or semantic-release
      # ...
```

---

## Summary

### Key Principles

1. ✅ **One action file, multiple strategies**
2. ✅ **Auto-detect capabilities**
3. ✅ **Conditional execution**
4. ✅ **Unified outputs**
5. ✅ **Graceful fallbacks**
6. ✅ **Clear logging**

### Pattern Checklist

When creating a strategy-agnostic action:

- [ ] Detection steps for each strategy
- [ ] Input overrides for testing/debugging
- [ ] Conditional steps with mutually exclusive conditions
- [ ] Unified output format
- [ ] Package manager auto-detection (if needed)
- [ ] Clear logging of active strategy
- [ ] Documentation of supported strategies
- [ ] Tests for each strategy
- [ ] Graceful error handling

### Benefits Recap

- ✅ No regeneration when switching strategies
- ✅ Easy to add new strategies
- ✅ Maintainable (single codebase)
- ✅ Marketplace-ready
- ✅ User-friendly
- ✅ Future-proof

---

## Related Documentation

- [Action Coupling Matrix](./action-coupling-matrix.md) - Status of each action
- [Decoupling Guide](./DECOUPLING_GUIDE.md) - Overall decoupling strategy
- [Regeneration Requirements](./regeneration-requirements-current.md) - What triggers regeneration

---

**Reference Implementation**: See [`.github/actions/detect-changes/action.yml`](../.github/actions/detect-changes/action.yml) for a complete working example of this pattern.
