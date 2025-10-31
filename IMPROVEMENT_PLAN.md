# PipeCraft Improvement Plan (Revised)

**Generated**: 2025-01-30
**Based on**: Expedition project analysis (`_expedition/.github/`)
**Approach**: User-centric, configuration-driven, provider-independent

---

## Executive Summary

The expedition project is a **production full-stack application** using PipeCraft successfully. Analysis reveals several valuable patterns that should be generalized and incorporated into PipeCraft core:

**Core Philosophy**:
- **Environment variables over config files** - users can tune without regeneration
- **Document patterns over enforce opinions** - show how expedition does it, don't force it
- **Configuration over hardcoding** - make runtime versions, depths, etc. tunable
- **Provider independence** - design for GitHub + GitLab from day one

**Key Improvements Identified**:
1. Environment-based configuration (fetch-depth, versions)
2. Workflow traceability (run_number propagation)
3. Explicit gate patterns (test-gate, smoke-test-gate)
4. Nx enhancements (exclude, verbose debugging)

---

## About the Expedition Project

**What it is**:
- Full-stack Nx monorepo (server, client, CLI apps)
- Multiple environments: develop → staging → main → load
- Real infrastructure: AWS ECS, S3, Pulumi, databases
- Domain-based testing + Nx affected
- Complete deployment pipeline with smoke tests

**Why it matters**:
- Proves PipeCraft works for complex production use
- Identifies pain points from real-world usage
- Shows patterns worth teaching (gates, excludes, traceability)
- Validates core value proposition: skip debugging cycles

**Scale**:
- ~20 Nx projects (apps + libraries)
- Multiple domains (cicd, docs, infra, migrations)
- Custom actions for deployment, testing, builds
- Production traffic handling

---

## Evaluation Framework

Each improvement is evaluated against:

1. **User Problem**: What debugging cycle or pain point does this solve?
2. **Generalizability**: Does this apply to PipeCraft's broad user base?
3. **Provider Independence**: Will this work for GitHub, GitLab, etc.?
4. **Maintainability**: Does this increase or decrease complexity?
5. **Backward Compatibility**: Breaking change risk?

### User Personas (from README)

- **Frustrated Developer**: "Skip the debugging cycles" - wants first-run success
- **Monorepo Team**: "Intelligent change detection" - needs accurate affected analysis
- **Organization**: "Consistency across projects" - wants proven patterns, not lock-in

---

## Phase 1: Environment-Based Configuration (Foundation)

### 1.1 Pipeline Environment Variables

**Problem**:
- Users must regenerate workflows to change Node versions
- Fetch depth is hardcoded, can't tune for performance
- No single source of truth for runtime configuration

**Solution**: Generate `env:` block at workflow level

```yaml
name: Pipeline

env:
  # Git fetch depth configuration
  # - FETCH_DEPTH_AFFECTED: For change detection and Nx affected analysis
  #   Lower values (50-100) improve performance, higher values (200+) improve accuracy
  #   Use 0 for complete history if your branches diverge significantly
  # - FETCH_DEPTH_VERSIONING: For semantic version calculation (needs git tags)
  #   Should almost always be 0 to access all tags
  FETCH_DEPTH_AFFECTED: '100'
  FETCH_DEPTH_VERSIONING: '0'

  # Runtime versions
  # Update these to match your project's requirements without regenerating workflows
  NODE_VERSION: '20'
  PNPM_VERSION: '9'

on:
  # ... triggers
```

**Generalizability**: ✅ **High**
- GitLab CI equivalent: top-level variables
- Works for any CI provider with env vars
- Common pattern in CI/CD configuration

**Benefits**:
- ✅ Edit directly in workflow file (no regeneration)
- ✅ All config visible upfront
- ✅ Well-documented with comments
- ✅ Easy to experiment (try different fetch depths)

**Breaking**: No (new addition)
**Complexity**: Low (template adds env block)

**Implementation**:
- Update `shared/operations-header.ts` to generate env block
- Add after `run-name`, before `on` triggers
- Include helpful comments for each variable

---

### 1.2 Use Environment Variables in Checkout Steps

**Problem**: fetch-depth hardcoded to 0 everywhere (slow on large repos)

**Solution**: Different depths for different purposes

```yaml
# In changes job (needs recent commits for affected detection)
- uses: actions/checkout@v4
  with:
    ref: ${{ inputs.commitSha || github.sha }}
    fetch-depth: ${{ env.FETCH_DEPTH_AFFECTED }}

# In version job (needs full history for tags)
- uses: actions/checkout@v4
  with:
    ref: ${{ inputs.commitSha || github.sha }}
    fetch-depth: ${{ env.FETCH_DEPTH_VERSIONING }}

# In test-nx job (needs recent commits for affected)
- uses: actions/checkout@v4
  with:
    ref: ${{ inputs.commitSha || github.sha }}
    fetch-depth: ${{ env.FETCH_DEPTH_AFFECTED }}
```

**Expedition Evidence**: Uses fetch-depth: 100 for Nx jobs (optimized)

**Generalizability**: ✅ **High**
- GitLab: `GIT_DEPTH` variable
- Performance win for large repos
- Configurable per use case

**Benefits**:
- ✅ Faster checkouts (100 commits vs entire history)
- ✅ User can tune based on branch strategy
- ✅ Accurate where needed (version needs all tags)

**Breaking**: No (defaults maintain current behavior)
**Complexity**: Low

**Implementation**:
- Update `shared/operations-changes.ts` (use FETCH_DEPTH_AFFECTED)
- Update `shared/operations-version.ts` (use FETCH_DEPTH_VERSIONING)
- Update `shared/operations-tag-promote.ts` (use FETCH_DEPTH_VERSIONING)
- Update `pipeline-nx.yml.tpl.ts` test-nx job (use FETCH_DEPTH_AFFECTED)

---

### 1.3 Runtime Version Inputs for Actions

**Problem**:
- Node version hardcoded in action templates (inconsistent across actions)
- Users can't override without editing generated actions
- Expedition has Node 20 in some places, 24 in others (inconsistent)

**Solution**: Actions accept version inputs, pipeline passes env vars

**Action template changes**:

```yaml
# detect-changes/action.yml
inputs:
  baseRef:
    description: 'Base reference to compare against'
    required: false
    default: 'main'
  useNx:
    description: 'Whether to use Nx dependency graph'
    required: false
    default: 'true'
  node-version:
    description: 'Node.js version to use'
    required: false
    default: '20'
  pnpm-version:
    description: 'pnpm version (only used if pnpm detected)'
    required: false
    default: '9'

runs:
  using: composite
  steps:
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
```

**Pipeline usage**:

```yaml
- uses: ./.github/actions/detect-changes
  with:
    baseRef: ${{ inputs.baseRef || 'origin/main' }}
    useNx: 'true'
    node-version: ${{ env.NODE_VERSION }}
    pnpm-version: ${{ env.PNPM_VERSION }}
```

**Generalizability**: ✅ **High**
- Actions remain reusable (have defaults)
- Pipeline controls versions centrally
- GitLab: pass variables to included jobs

**Benefits**:
- ✅ Single source of truth (env vars)
- ✅ Actions work standalone (have defaults)
- ✅ Easy to upgrade: change one env var

**Breaking**: No (inputs have defaults)
**Complexity**: Medium (update 3-4 action templates)

**Implementation**:
- Update `detect-changes.yml.tpl.ts` (add version inputs)
- Update `run-nx-affected.yml.tpl.ts` (add version inputs)
- Update `calculate-version.yml.tpl.ts` (add version inputs)
- Update pipeline templates to pass env vars

---

## Phase 2: Workflow Intelligence Features

### 2.1 run_number Propagation for Traceability

**Problem**:
- When promote-branch triggers staging workflow, can't trace back to original develop run
- Debugging: "Which develop build triggered this staging failure?"
- Lost context across workflow boundaries

**Solution**: Pass run_number through workflow triggers

```yaml
# In pipeline.yml triggers
on:
  workflow_dispatch:
    inputs:
      version:
        description: The version to deploy
        required: false
        type: string
      baseRef:
        description: The base reference for comparison
        required: false
        type: string
      run_number:
        description: The original run number from develop branch
        required: false
        type: string
      commitSha:
        description: The exact commit SHA to checkout and test
        required: false
        type: string
  workflow_call:
    inputs:
      # ... same inputs as workflow_dispatch
```

**In run-name**:
```yaml
run-name: "${{ github.ref_name }} #${{ inputs.run_number || github.run_number }}${{ inputs.version && format(' - {0}', inputs.version) || '' }}"
```

**In promote-branch action**:
```yaml
gh workflow run pipeline.yml \
  --ref ${{ inputs.nextBranch }} \
  --field version=${{ inputs.version }} \
  --field commitSha=${{ github.sha }} \
  --field baseRef=${{ inputs.currentBranch }} \
  --field run_number=${{ inputs.runNumber || github.run_number }}
```

**Expedition Evidence**: Uses this pattern, shows "staging #45 (from develop #123)"

**Generalizability**: ✅ **High**
- GitLab: pass variables through pipeline triggers
- Common need: trace deployments to source
- Metadata propagation pattern

**Benefits**:
- ✅ Clear lineage: staging run links back to develop
- ✅ Easier debugging: find original logs
- ✅ Audit trail: know what triggered what

**Breaking**: No (optional input with fallback)
**Complexity**: Low (metadata passing)

**Implementation**:
- Update `shared/operations-header.ts` (add run_number input)
- Update run-name expression to show it
- Update `promote-branch.yml.tpl.ts` (pass run_number)

---

### 2.2 Explicit Test Gate Pattern

**Problem**:
- GitHub Actions allows downstream jobs to run if tests are skipped
- No built-in "all tests must pass" gate
- Users want: "don't build/deploy if any test failed"

**Solution**: Generate test-gate job as example in custom section

```yaml
  #=============================================================================
  # TEST GATE (✅ Recommended Pattern)
  #=============================================================================
  # This job ensures all tests pass before proceeding to builds and deployments.
  # It succeeds if:
  #   1. No tests failed (any failure blocks everything downstream)
  #   2. At least one test ran successfully (prevents accidental "all skipped" passes)
  #
  # Customize:
  # - Add all your test jobs to the 'needs' array below
  # - Add to conditionals for both "no failures" and "at least one success"
  # - Make downstream jobs (build, deploy) depend on this gate

  test-gate:
    needs: [ test-cicd, test-docs, test-infra ]  # TODO: Add all your test jobs
    if: ${{
          always() && (
            needs.test-cicd.result != 'failure' &&
            needs.test-docs.result != 'failure' &&
            needs.test-infra.result != 'failure'
          ) && (
            needs.test-cicd.result == 'success' ||
            needs.test-docs.result == 'success' ||
            needs.test-infra.result == 'success'
          )
        }}
    runs-on: ubuntu-latest
    steps:
      - name: Tests passed
        run: echo "✅ All tests passed or were skipped. Ready for deployment."
```

**Expedition Evidence**: Uses this exact pattern, also has smoke-test-gate

**Generalizability**: ✅ **High**
- GitLab: `needs` with rules
- Common pattern in trunk-based development
- Prevents broken deployments

**Benefits**:
- ✅ Explicit intent: gate is obvious in workflow
- ✅ Prevents errors: no deploying broken code
- ✅ Pattern reusable: test-gate, smoke-test-gate, etc.

**Breaking**: No (generated as example, user opts in)
**Complexity**: Low (conditional logic, well-commented)

**Implementation**:
- Update custom section template in `pipeline.yml.tpl.ts`
- Generate test-gate as commented example
- Document pattern in "Workflow Patterns" guide
- Show expedition's smoke-test-gate as advanced example

---

### 2.3 Nx Exclude Parameter

**Problem**:
- Some Nx projects are broken, deprecated, or not ready for CI
- Without exclude, entire affected run fails
- Need incremental CI adoption

**Solution**: Add exclude input to run-nx-affected action

```yaml
# In run-nx-affected/action.yml
inputs:
  # ... existing inputs
  exclude:
    description: 'Comma-separated list of Nx projects to exclude (e.g., "@mf/app1,@mf/lib2")'
    required: false
    default: ''
```

**In the action script**:
```bash
# Build exclude flag if provided
EXCLUDE_FLAG=""
if [ -n "${{ inputs.exclude }}" ]; then
  EXCLUDE_LIST=$(echo "${{ inputs.exclude }}" | tr -d ' ')
  EXCLUDE_FLAG="--exclude=$EXCLUDE_LIST"
fi

# Run with exclude
$NX_CMD affected --target=$target --base=$BASE --head=$HEAD $EXCLUDE_FLAG
```

**In pipeline test-nx job**:
```yaml
- uses: ./.github/actions/run-nx-affected
  with:
    targets: 'lint,test,build'
    exclude: ''  # TODO: Add excluded projects (comma-separated)
    # Example: exclude: '@myapp/legacy,@myapp/broken-tests'
```

**Expedition Evidence**: Excludes 15+ projects during migration

**Generalizability**: ✅ **High**
- Nx-specific but aligns with Nx CLI
- Common need: gradual CI adoption
- Prevents "all or nothing" problem

**Benefits**:
- ✅ Incremental migration: exclude broken tests temporarily
- ✅ Flexibility: keep deprecated code without CI burden
- ✅ Clear documentation: excluded projects listed in workflow

**Breaking**: No (optional input)
**Complexity**: Low (pass-through to Nx)

**Implementation**:
- Update `run-nx-affected.yml.tpl.ts` (add exclude input)
- Add exclude handling in script
- Update `pipeline-nx.yml.tpl.ts` (add exclude with TODO comment)
- Document use cases

---

### 2.4 Verbose Debugging for Nx

**Problem**:
- "Why isn't Nx detecting my project?"
- Hard to debug affected detection issues
- Need visibility into comparison base, commit range

**Solution**: Add verbose input for detailed logging

```yaml
# In run-nx-affected/action.yml
inputs:
  # ... existing inputs
  verbose:
    description: 'Enable verbose logging for debugging affected detection'
    required: false
    default: 'false'
```

**Conditional debugging step**:
```yaml
- name: Show Nx Comparison Info
  if: inputs.verbose == 'true'
  shell: bash
  run: |
    echo "=========================================="
    echo "🔍 Nx Affected Analysis Configuration"
    echo "=========================================="
    echo ""
    echo "📌 Current HEAD:"
    echo "  Commit: ${{ inputs.commitSha }}"
    git log -1 --oneline ${{ inputs.commitSha }}
    echo ""
    echo "📌 Base for comparison:"
    echo "  Base ref: ${{ inputs.baseRef }}"
    git log -1 --oneline ${{ inputs.baseRef }}
    echo ""
    echo "📊 Commits being analyzed:"
    git log --oneline ${{ inputs.baseRef }}..${{ inputs.commitSha }}
    echo ""
    echo "🎯 Targets to run: ${{ inputs.targets }}"
    if [ -n "${{ inputs.exclude }}" ]; then
      echo "🚫 Excluding projects: ${{ inputs.exclude }}"
    fi
    echo "=========================================="
```

**Expedition Evidence**: Has this detailed debugging output

**Generalizability**: ⚠️ **Medium**
- Very helpful for Nx users
- Adds log noise if always on
- Nx-specific (but pattern generalizable)

**Benefits**:
- ✅ Debug affected detection issues
- ✅ Verify base ref and commit range
- ✅ See what Nx is actually comparing

**Breaking**: No (default false)
**Complexity**: Low (conditional logging)

**Implementation**:
- Update `run-nx-affected.yml.tpl.ts` (add verbose input)
- Add conditional debugging step
- Document when to enable (troubleshooting guide)

---

## Phase 3: Documentation & Examples

### 3.1 Environment Variables Reference

Create comprehensive guide in docs:

**Topics**:
- What each env var controls
- When to change values
- Performance tradeoffs (fetch-depth)
- Version compatibility (NODE_VERSION)
- Examples for different repo sizes

**Location**: `docs/configuration-reference.md`

---

### 3.2 Workflow Patterns Guide

Document patterns expedition demonstrates:

**Patterns**:
1. **Test Gate** - prevent deployments on test failure
2. **Smoke Test Gate** - verify deployments before promoting
3. **Build Artifacts** - separate build from deploy
4. **Environment-based deployment** - use GitHub environments
5. **Exclude projects** - incremental CI adoption

**Location**: `docs/workflow-patterns.md`

---

### 3.3 Expedition as Reference Implementation

Link to expedition project as example:

**Content**:
- "Real-world production example"
- Link to `_expedition/.github/` directory
- Highlight custom actions (build, deploy, smoke test)
- Explain domain structure (cicd, docs, infra, migrations)
- Show how they use gates, excludes, verbose logging

**Location**: `docs/examples/production-monorepo.md`

---

### 3.4 Nx Troubleshooting Guide

**Topics**:
- Why Nx isn't detecting expected projects
- How to use verbose logging
- Fetch depth issues (shallow history)
- Exclude vs skip
- Base ref problems

**Location**: `docs/nx-troubleshooting.md`

---

## Phase 4: Future/Research (Deferred)

### 4.1 PR Comment Reporting (GitHub-specific)

**What expedition has**: Posts Nx test results as PR comments

**Why defer**:
- GitHub-specific (doesn't generalize to GitLab)
- Requires provider-specific code
- Wait for plugin/hook system

**Future approach**:
- Design plugin architecture
- GitHub plugin provides PR comments
- GitLab plugin provides MR notes
- Keep core provider-agnostic

---

### 4.2 Provider Abstraction Layer

**Research needed**:
- How to express workflows in provider-agnostic way?
- Common primitives across GitHub/GitLab/etc.
- Template generation per provider
- Config format that works for all

**Don't implement yet** - learn from GitHub+GitLab before abstracting

---

## What NOT to Incorporate

### ❌ Hardcoded Node 24

**Expedition uses**: Node 24 in some actions

**Why reject**:
- Node 24 isn't even released yet
- Not generalizable (their specific need)
- PipeCraft should default to LTS (Node 20)
- Made configurable instead (env vars)

---

### ❌ Switch to pnpm/action-setup

**Improvement plan suggests**: Replace corepack with pnpm/action-setup@v4

**Why reject**:
- Current approach (corepack) works fine
- corepack is built into Node, simpler
- Less dependencies = better
- If users need pnpm/action-setup features, they can customize

**Keep**: corepack enable

---

### ❌ Opinionated Action Templates

**Expedition has**: lint (Biome), typecheck, build-client actions

**Why reject**:
- Too opinionated (forces Biome, specific tools)
- Violates "fully customizable" principle
- Application-specific, not template-worthy

**Instead**: Document as examples, link to expedition repo

---

## Implementation Priorities

### P0: Foundation (Week 1)
- [ ] Environment variables section generation
- [ ] Update checkout steps to use fetch-depth env vars
- [ ] Add version inputs to action templates
- [ ] Pass env vars from pipeline to actions
- [ ] Unit tests

**User Impact**: High - enables configuration without regeneration
**Risk**: Low - additive changes
**Effort**: 3-5 days

---

### P1: Intelligence (Week 2)
- [ ] Add run_number input and propagation
- [ ] Generate test-gate example in custom section
- [ ] Add exclude parameter to Nx
- [ ] Add verbose option to Nx
- [ ] Integration tests

**User Impact**: High - solves real debugging/workflow issues
**Risk**: Low - optional features
**Effort**: 3-5 days

---

### P2: Documentation (Week 3)
- [ ] Environment variables reference
- [ ] Workflow patterns guide
- [ ] Expedition project example
- [ ] Nx troubleshooting guide
- [ ] Migration guide for existing users

**User Impact**: Medium - educational, enables advanced usage
**Risk**: None - docs only
**Effort**: 3-5 days

---

### P3: Polish & Release (Week 4)
- [ ] E2E testing with example repos
- [ ] Test with expedition project
- [ ] Update CHANGELOG
- [ ] Beta release for feedback
- [ ] Full release

**User Impact**: Ensures quality
**Risk**: Medium - real-world validation
**Effort**: 3-5 days

---

## Testing Strategy

### Unit Tests

```typescript
describe('Environment Variables', () => {
  it('generates env block with defaults', () => {
    const ops = createHeaderOperations({ branchFlow: ['develop', 'main'] })
    const envOp = ops.find(op => op.path === 'env')
    expect(envOp.value).toContain('FETCH_DEPTH_AFFECTED: \'100\'')
    expect(envOp.value).toContain('NODE_VERSION: \'20\'')
  })
})

describe('Checkout with fetch-depth', () => {
  it('uses FETCH_DEPTH_AFFECTED for changes job', () => {
    const op = createChangesJobOperation({ domains: {}, useNx: false })
    expect(op.value).toContain('fetch-depth: ${{ env.FETCH_DEPTH_AFFECTED }}')
  })

  it('uses FETCH_DEPTH_VERSIONING for version job', () => {
    const op = createVersionJobOperation({ testJobNames: [], nxEnabled: false })
    expect(op.value).toContain('fetch-depth: ${{ env.FETCH_DEPTH_VERSIONING }}')
  })
})

describe('run_number propagation', () => {
  it('adds run_number to workflow inputs', () => {
    const ops = createHeaderOperations({ branchFlow: ['develop', 'main'] })
    const onOp = ops.find(op => op.path === 'on')
    expect(onOp.value).toContain('run_number:')
  })
})

describe('Nx exclude parameter', () => {
  it('generates exclude input in action', async () => {
    const content = await generateRunNxAffectedAction(ctx)
    expect(content).toContain('exclude:')
    expect(content).toContain('Comma-separated list of Nx projects')
  })

  it('handles exclude in script', async () => {
    const content = await generateRunNxAffectedAction(ctx)
    expect(content).toContain('EXCLUDE_FLAG')
    expect(content).toContain('--exclude=')
  })
})
```

---

### Integration Tests

```typescript
describe('Full Pipeline Generation', () => {
  it('generates pipeline with env vars', async () => {
    const result = await generatePipeline(ctx)
    expect(result).toContain('env:')
    expect(result).toContain('FETCH_DEPTH_AFFECTED')
    expect(result).toContain('NODE_VERSION')
  })

  it('passes env vars to actions', async () => {
    const result = await generatePipeline(ctx)
    expect(result).toContain('node-version: ${{ env.NODE_VERSION }}')
    expect(result).toContain('fetch-depth: ${{ env.FETCH_DEPTH_AFFECTED }}')
  })

  it('generates test-gate example', async () => {
    const result = await generatePipeline(ctx)
    expect(result).toContain('test-gate:')
    expect(result).toContain('TODO: Add all your test jobs')
  })
})
```

---

### E2E Tests

1. **Environment Variables**
   - Generate workflow, modify env vars
   - Run workflow, verify checkout uses modified values
   - Confirm no regeneration needed

2. **run_number Propagation**
   - Push to develop (run #100)
   - Verify promote triggers staging
   - Check staging run name shows "staging #45 (from #100)"

3. **Test Gate**
   - Create failing test
   - Verify test-gate fails
   - Verify build/deploy don't run

4. **Nx Exclude**
   - Add projects to exclude list
   - Run test-nx job
   - Verify excluded projects don't run

5. **Nx Verbose**
   - Enable verbose: 'true'
   - Check logs show detailed comparison info
   - Disable verbose, verify logs are minimal

---

## Backward Compatibility

### For New Users
- Get all new features by default
- Well-documented env vars section
- test-gate example to learn from

### For Existing Users
- Run `pipecraft generate`
- Existing workflows preserved (AST merging)
- New env vars section added (doesn't break anything)
- test-gate appears as example (optional)
- Existing custom jobs untouched

### Breaking Changes
**None** - all changes are additive:
- Env vars are new (don't affect existing workflows)
- Inputs have defaults (actions work without them)
- test-gate is example (user opts in)
- exclude is optional (empty string = no exclusion)
- verbose defaults to false (no noise)

---

## Migration Guide

### Updating from Previous Versions

1. **Backup your customizations**
   ```bash
   git diff .github/workflows/pipeline.yml > my-customizations.patch
   ```

2. **Run generate**
   ```bash
   pipecraft generate
   ```

3. **Review new sections**
   - Check `env:` block at top of workflow
   - Review test-gate example in custom jobs section
   - Verify your customizations are preserved

4. **Tune configuration**
   ```yaml
   env:
     FETCH_DEPTH_AFFECTED: '100'  # Adjust for your repo size
     NODE_VERSION: '20'           # Match your project
   ```

5. **Optional: Add test-gate**
   - Copy test-gate example
   - Update needs array with your test jobs
   - Make build/deploy jobs depend on test-gate

6. **Optional: Use exclude (Nx projects)**
   ```yaml
   test-nx:
     steps:
       - uses: ./.github/actions/run-nx-affected
         with:
           exclude: '@myapp/broken,@myapp/deprecated'
   ```

---

## Success Metrics

### How We'll Know This Worked

1. **Users edit env vars, not config files**
   - GitHub discussions: "How do I change Node version?" → "Edit env var"
   - No issues about "regeneration doesn't pick up my changes"

2. **Clearer debugging**
   - Fewer issues: "Why isn't Nx detecting my project?"
   - Users use verbose logging to self-diagnose

3. **Better deployment safety**
   - Users adopt test-gate pattern
   - Fewer "oops, deployed broken code" reports

4. **Incremental CI adoption**
   - Users use exclude for gradual migration
   - No more "all or nothing" problems

5. **Traceability**
   - Users can trace staging/prod back to source run
   - Easier incident debugging

---

## Risks & Mitigation

### Risk: Users confused by env vars
**Mitigation**:
- Excellent inline documentation
- Configuration reference guide
- Examples for common scenarios

### Risk: Fetch-depth too shallow
**Mitigation**:
- Conservative default (100)
- Clear documentation on when to increase
- Verbose logging shows what's being compared

### Risk: Breaking existing workflows
**Mitigation**:
- All changes are additive
- Extensive testing with real repos
- Beta release for feedback

---

## Open Questions

### For Discussion

1. **Default fetch-depth**: 100 vs 50 vs 0?
   - 100 = good balance for most workflows
   - 0 = safest but slower
   - Make it configurable and document tradeoffs

2. **Should test-gate be auto-generated or example?**
   - Proposal: Generate as commented example (user opts in)
   - Rationale: Too opinionated to force on everyone

3. **Verbose default: true or false?**
   - Proposal: false (opt-in debugging)
   - Rationale: Minimize log noise for users who don't need it

---

## Appendix: File Changes Matrix

| File | Change | Priority | Breaking |
|------|--------|----------|----------|
| `shared/operations-header.ts` | Add env vars generation | P0 | No |
| `shared/operations-changes.ts` | Use FETCH_DEPTH_AFFECTED | P0 | No |
| `shared/operations-version.ts` | Use FETCH_DEPTH_VERSIONING | P0 | No |
| `shared/operations-tag-promote.ts` | Use FETCH_DEPTH_VERSIONING | P0 | No |
| `pipeline.yml.tpl.ts` | test-gate example | P1 | No |
| `pipeline-nx.yml.tpl.ts` | Fetch-depth, version inputs | P0 | No |
| `detect-changes.yml.tpl.ts` | Version inputs | P0 | No |
| `run-nx-affected.yml.tpl.ts` | Version inputs, exclude, verbose | P1 | No |
| `calculate-version.yml.tpl.ts` | Version input | P0 | No |
| `promote-branch.yml.tpl.ts` | Pass run_number | P1 | No |

---

## Conclusion

The expedition project validates PipeCraft's core value proposition and reveals patterns worth generalizing:

**Core Wins**:
1. **Environment-based config** - tune without regeneration
2. **Workflow intelligence** - traceability, gates, excludes
3. **Better debugging** - verbose mode, clear fetch-depth strategy
4. **Documented patterns** - show expedition's approach, don't force it

**Philosophy**:
- Configuration over hardcoding
- Documentation over enforcement
- User control over magic
- Provider independence over GitHub-specific tricks

**Timeline**: 4 weeks to full release (P0-P3)

**Next Step**: Begin Phase 1 (environment variables foundation)

---

*This plan will be updated as implementation progresses and user feedback is gathered.*
