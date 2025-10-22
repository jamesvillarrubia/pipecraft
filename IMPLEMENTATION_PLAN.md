# PipeCraft Improvements - Implementation Plan

**Date**: 2025-10-22
**Status**: Planning Complete

## Overview

This document outlines fixes and improvements identified from user testing feedback. Issues fall into three categories:
1. **Critical Bugs** - Breaking functionality that needs immediate fixing
2. **Documentation Gaps** - Missing or unclear documentation
3. **UX Improvements** - Better user guidance and workflow clarity

---

## Critical Bugs (High Priority)

### Bug #1: Domain Property Name Mismatch
**Status**: Identified - Ready to Fix
**Severity**: HIGH - Breaks deployable and remoteTestable features

**Problem**:
The TypeScript interface defines properties as `deployable`, `testable`, and (implicitly) `remoteTestable`, but the workflow template checks for `deploy`, `test`, and `remoteTest`.

**Files Affected**:
- `src/templates/workflows/pipeline-path-based.yml.tpl.ts` (lines 105-107, 369, 427, 453, 484)
- `src/types/index.ts` (missing remoteTestable property definition)

**Fix**:
1. Update `src/types/index.ts` to add `remoteTestable?: boolean` property to DomainConfig interface
2. Update `src/templates/workflows/pipeline-path-based.yml.tpl.ts`:
   - Line 105: `domainConfig.test !== false` → `domainConfig.testable !== false`
   - Line 106: `domainConfig.deploy === true` → `domainConfig.deployable === true`
   - Line 107: `domainConfig.remoteTest === true` → `domainConfig.remoteTestable === true`
   - Line 369: `ctx.domains[domain].test !== false` → `ctx.domains[domain].testable !== false`
   - Line 427: `ctx.domains[domain].deploy === true` → `ctx.domains[domain].deployable === true`
   - Line 453: `ctx.domains[domain].remoteTest === true` → `ctx.domains[domain].remoteTestable === true`
   - Line 484: `ctx.domains[domain].deploy === true` → `ctx.domains[domain].deployable === true`

**Testing**:
```bash
# Create test config with deployable domain
echo '{
  "ciProvider": "github",
  "branchFlow": ["develop", "staging", "main"],
  "initialBranch": "develop",
  "finalBranch": "main",
  "domains": {
    "api": {
      "paths": ["apps/api/**"],
      "testable": true,
      "deployable": true,
      "remoteTestable": true
    }
  }
}' > .pipecraftrc.json

# Generate and verify deploy-api and remote-test-api jobs exist
pipecraft generate --force
grep "deploy-api:" .github/workflows/pipeline.yml
grep "remote-test-api:" .github/workflows/pipeline.yml
```

**Acceptance Criteria**:
- [ ] Setting `deployable: true` generates `deploy-{domain}` jobs
- [ ] Setting `remoteTestable: true` generates `remote-test-{domain}` jobs
- [ ] Setting `testable: false` skips test job generation
- [ ] All three properties documented in DomainConfig interface
- [ ] Tests pass with new property names

---

## Documentation Improvements (Medium Priority)

### Doc #1: Init Command Behavior
**Status**: Ready to Document
**Severity**: MEDIUM - Confusing UX but not breaking

**Problem**:
`pipecraft init` shows prompts asking about branches, CI provider, merge strategy, etc., but then ignores all responses and uses hardcoded defaults from `defaultConfig`. Users expect their answers to be used.

**Current Behavior** (src/generators/init.tpl.ts:214):
```typescript
.then((ctx) => ({ ...ctx, ...defaultConfig } as PipecraftConfig))
```
This overwrites all prompt responses with defaults.

**Documentation Updates Needed**:

#### README.md (Quick Start section)
Add clarification after "Initialize PipeCraft in your project":
```markdown
# Initialize PipeCraft in your project
npx pipecraft init

# Edit the generated .pipecraftrc.json to customize:
# - Branch names (branchFlow, initialBranch, finalBranch)
# - Domain paths and configurations
# - CI provider and merge strategy
```

#### docs/docs/intro.md (Getting Started - Initialize section)
Expand lines 32-48 to include:
```markdown
### Initialize your configuration

Navigate to your project and run the init command:

```bash
cd my-monorepo
pipecraft init
```

This creates a `.pipecraftrc.json` file with sensible defaults:
- **CI Provider**: GitHub Actions
- **Branch Flow**: develop → staging → main
- **Merge Strategy**: fast-forward
- **Default Domains**: api, web, libs, cicd

**Next, customize the configuration**:

1. **Update branch names** if you use different naming (e.g., dev, prod):
   ```json
   {
     "branchFlow": ["dev", "uat", "prod"],
     "initialBranch": "dev",
     "finalBranch": "prod"
   }
   ```

2. **Configure your domains** to match your monorepo structure:
   ```json
   {
     "domains": {
       "api": {
         "paths": ["packages/api/**"],
         "description": "Backend API services",
         "testable": true,
         "deployable": true,
         "remoteTestable": false
       },
       "web": {
         "paths": ["packages/web/**"],
         "description": "Frontend web application",
         "testable": true,
         "deployable": true,
         "remoteTestable": true
       }
     }
   }
   ```

3. **Set domain capabilities** based on your needs:
   - `testable: true` (default) - Generates test jobs
   - `deployable: true` (default: false) - Generates deployment jobs
   - `remoteTestable: true` (default: false) - Generates remote testing jobs after deployment

After editing `.pipecraftrc.json`, you're ready to generate workflows.


**Acceptance Criteria**:
- [ ] README clearly states init creates defaults, then edit manually
- [ ] Getting Started guide shows step-by-step config customization
- [ ] Domain field defaults explicitly documented
- [ ] Examples show all three domain flags with explanations

---

### Doc #2: Domain Field Defaults and Capabilities
**Status**: Ready to Document
**Severity**: MEDIUM - Users confused about what fields do

**Problem**:
No documentation explains:
- What `testable`, `deployable`, `remoteTestable` do
- What the default values are
- When you'd set each to true/false

**Documentation Updates Needed**:

#### New Section in Configuration Reference
Add to `docs/docs/configuration-reference.md` (create if doesn't exist):

```markdown
## Domain Configuration

Each domain in your `domains` object represents a logical part of your codebase with independent test and deployment requirements.

### Domain Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `paths` | `string[]` | **required** | Glob patterns matching files in this domain |
| `description` | `string` | **required** | Human-readable description |
| `testable` | `boolean` | `true` | Generate test jobs for this domain |
| `deployable` | `boolean` | `false` | Generate deployment jobs for this domain |
| `remoteTestable` | `boolean` | `false` | Generate remote test jobs (runs after deployment) |

### Understanding Domain Capabilities

#### Testable Domains
When `testable: true` (the default), PipeCraft generates a `test-{domain}` job that:
- Only runs when the domain has changes
- Runs in parallel with other domain tests
- Must pass before versioning and promotion

Set `testable: false` for domains that don't need testing (e.g., documentation, configuration files).

\`\`\`json
{
  "domains": {
    "docs": {
      "paths": ["docs/**"],
      "description": "Documentation",
      "testable": false  // No tests needed
    }
  }
}
\`\`\`

#### Deployable Domains
When `deployable: true`, PipeCraft generates a `deploy-{domain}` job that:
- Only runs after tests pass and version is calculated
- Runs in parallel with other deployments
- Must succeed (or be skipped) for tagging to occur

Use this for domains that need deployment (APIs, web apps, services):

\`\`\`json
{
  "domains": {
    "api": {
      "paths": ["apps/api/**"],
      "description": "API service",
      "testable": true,
      "deployable": true  // Deploy after tests pass
    }
  }
}
\`\`\`


#### Remote Testable Domains
When `remoteTestable: true`, PipeCraft generates a `remote-test-{domain}` job that:
- Runs after `deploy-{domain}` succeeds
- Tests the deployed service in its live environment
- Must pass for tagging and promotion

Use this for integration tests, smoke tests, or health checks against deployed services:

\`\`\`json
{
  "domains": {
    "web": {
      "paths": ["apps/web/**"],
      "description": "Web application",
      "testable": true,
      "deployable": true,
      "remoteTestable": true  // Test deployed app
    }
  }
}
\`\`\`

### Workflow Phase Flow

Domains with different capabilities flow through phases differently:

**Domain with all capabilities enabled**:
1. **Change Detection** → Determines if domain changed
2. **Test** (`test-{domain}`) → Runs if changed
3. **Version** → Calculates next version (after all tests)
4. **Deploy** (`deploy-{domain}`) → Deploys if changed and tests passed
5. **Remote Test** (`remote-test-{domain}`) → Tests deployed service
6. **Tag** → Creates git tag if all deployments/remote tests passed
7. **Promote** → Creates PR to next branch
8. **Release** → Creates GitHub release (on final branch only)

**Domain with only testable**:
1. Change Detection → Test → Version → Tag → Promote → Release

**Domain with testable and deployable**:
1. Change Detection → Test → Version → Deploy → Tag → Promote → Release

### Example Configurations

**Full-stack monorepo with different requirements**:
\`\`\`json
{
  "domains": {
    "api": {
      "paths": ["services/api/**"],
      "description": "Backend API",
      "testable": true,
      "deployable": true,
      "remoteTestable": true
    },
    "web": {
      "paths": ["apps/web/**"],
      "description": "Frontend",
      "testable": true,
      "deployable": true,
      "remoteTestable": false  // No remote tests needed
    },
    "shared": {
      "paths": ["libs/**"],
      "description": "Shared libraries",
      "testable": true,
      "deployable": false,  // Libraries aren't deployed
      "remoteTestable": false
    },
    "docs": {
      "paths": ["docs/**"],
      "description": "Documentation",
      "testable": false,  // No tests for docs
      "deployable": true,  // Deploy to docs site
      "remoteTestable": false
    }
  }
}
\`\`\`
```

**Acceptance Criteria**:
- [ ] All three domain capabilities documented with clear descriptions
- [ ] Default values explicitly stated
- [ ] Workflow phase flow shows how capabilities affect job order
- [ ] Multiple examples showing different capability combinations
- [ ] Clear guidance on when to use each capability

---

### Doc #3: Complete Workflow Phases
**Status**: Ready to Document
**Severity**: MEDIUM - Missing important phase information

**Problem**:
The "Understanding the workflow" section in Getting Started (docs/docs/intro.md:209-220) only mentions 4 phases:
1. Change detection
2. Testing
3. Versioning
4. Promotion

But it's missing:
- Deployment phase (between versioning and tagging)
- Remote testing phase (after deployment)
- Tagging phase (after deployments pass)
- Release phase (on final branch)
- How phases interact with domain capabilities

**Documentation Updates Needed**:

Replace docs/docs/intro.md lines 209-220 with:

```markdown
## Understanding the workflow

The generated workflow orchestrates multiple phases that run automatically based on your configuration and what changed in your commit.

### Complete Phase Flow

#### 1. Change Detection
**When**: Every workflow run
**What**: Analyzes which files changed and maps them to domains

The `changes` job looks at modified file paths and determines which domains are affected. If you modify `packages/api/server.ts`, only the API domain is marked as changed. If you modify `packages/shared/utils.ts` used by multiple domains, all dependent domains may be marked.

**Output**: Boolean flags for each domain (`api: true`, `web: false`, etc.)

#### 2. Testing
**When**: After change detection, for domains with `testable: true` (default) that have changes
**What**: Runs your test commands for affected domains in parallel

Jobs run concurrently to save time. `test-api` and `test-web` run simultaneously if both domains changed. Each job only runs if its domain has changes (`if: needs.changes.outputs.api == 'true'`).

**Output**: Pass/fail status for each domain's tests

#### 3. Versioning
**When**: After all tests pass, only on push events (not PRs)
**What**: Calculates the next version number based on conventional commits

The `version` job analyzes commit messages since the last version:
- `feat:` commits bump the minor version (1.0.0 → 1.1.0)
- `fix:` commits bump the patch version (1.0.0 → 1.0.1)
- `feat!:` or `BREAKING CHANGE:` bumps major version (1.0.0 → 2.0.0)
- `chore:`, `docs:`, `style:`, `refactor:` don't trigger version bumps

**Output**: New version number (e.g., `1.2.0`) or empty if no versioned commits

#### 4. Deployment (if domains have `deployable: true`)
**When**: After versioning succeeds, for domains with `deployable: true` that have changes
**What**: Deploys services to their respective environments

Deployment jobs (`deploy-api`, `deploy-web`, etc.) run in parallel. Each only runs if its domain changed and tests passed. This is where you add your actual deployment commands (push to cloud, update Kubernetes, deploy to CDN, etc.).

**Output**: Pass/fail status for each deployment

#### 5. Remote Testing (if domains have `remoteTestable: true`)
**When**: After deployment succeeds, for domains with `remoteTestable: true`
**What**: Tests deployed services in their live environment

Remote test jobs (`remote-test-api`, `remote-test-web`, etc.) verify deployments work correctly. Use these for integration tests, smoke tests, health checks, or end-to-end tests against deployed services.

**Output**: Pass/fail status for each remote test

#### 6. Tagging
**When**: After deployments and remote tests pass, only on initial branch (e.g., develop)
**What**: Creates a git tag with the calculated version

The `tag` job only runs if:
- A version was calculated
- All deployments succeeded or were skipped
- All remote tests passed or were skipped
- We're on the initial branch (develop)

This creates an immutable reference to the tested and deployed code.

**Output**: Git tag created (e.g., `v1.2.0`)

#### 7. Promotion
**When**: After tagging succeeds, on any branch except the final branch
**What**: Creates a PR to promote code to the next branch in the flow

The `promote` job triggers the workflow on the next branch (develop → staging → main). It creates a PR with the version number and passes metadata (version, run number, commit SHA) to maintain traceability.

**Branch flow example** (develop → staging → main):
1. PR merged to develop → Tests pass → Version 1.2.0 calculated → Deploy → Tag → Create PR to staging
2. Staging PR auto-merged → Tests pass → (version already set) → Deploy → Create PR to main
3. Main PR auto-merged → Tests pass → (version already set) → Deploy → Create release

**Output**: PR created to next branch

#### 8. Release (final branch only)
**When**: After tests pass on the final branch (e.g., main)
**What**: Creates a GitHub release with changelog

The `release` job only runs on your production branch (typically `main`). It creates a GitHub release with:
- Version number from tag
- Changelog generated from conventional commits
- Links to compare changes
- Artifacts (if configured)

**Output**: GitHub release created

### Phase Dependencies

Phases depend on previous phases succeeding:

\`\`\`
Change Detection (always runs)
    ↓
Testing (if testable: true and changes detected)
    ↓
Versioning (if tests pass and push event)
    ↓
Deployment (if deployable: true and version calculated)
    ↓
Remote Testing (if remoteTestable: true and deployment succeeded)
    ↓
Tagging (if version calculated and deployments/remote-tests passed)
    ↓
Promotion (if on non-final branch and tag created)
    OR
Release (if on final branch and tests passed)
\`\`\`

### Phase Behavior by Event Type

**Pull Request to develop**:
- Runs: Change Detection → Testing
- Skips: Versioning, Deployment, Remote Testing, Tagging, Promotion, Release
- Why: PRs only verify code quality, don't version or promote

**Push to develop** (after PR merge):
- Runs: Change Detection → Testing → Versioning → Deployment → Remote Testing → Tagging → Promotion
- Creates: PR from develop to staging
- Why: First branch gets full pipeline and initiates promotion flow

**Push to staging** (after promotion PR merges):
- Runs: Change Detection → Testing → Deployment → Remote Testing → Promotion
- Skips: Versioning (version already set from develop), Tagging (only on initial branch)
- Creates: PR from staging to main
- Why: Middle branches test and deploy but don't re-version

**Push to main** (after promotion PR merges):
- Runs: Change Detection → Testing → Deployment → Remote Testing → Release
- Skips: Promotion (no next branch)
- Creates: GitHub release
- Why: Final branch creates release instead of promoting

### Customizing Phases

You can customize test and deployment logic in the generated workflow:

**Test jobs** - Add your test commands:
\`\`\`yaml
test-api:
  needs: changes
  if: needs.changes.outputs.api == 'true'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npm install
    - run: npm test -- apps/api  # Your test command
\`\`\`

**Deploy jobs** - Add your deployment commands:
\`\`\`yaml
deploy-api:
  needs: [version, changes]
  if: needs.changes.outputs.api == 'true'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: ./deploy-api.sh ${{ needs.version.outputs.version }}
\`\`\`

**Remote test jobs** - Add your remote testing:
\`\`\`yaml
remote-test-api:
  needs: [deploy-api, changes]
  if: needs.deploy-api.result == 'success'
  runs-on: ubuntu-latest
  steps:
    - run: curl -f https://api.example.com/health
    - run: npm run test:e2e -- --api-url=https://api.example.com
\`\`\`

PipeCraft preserves your customizations during regeneration, so you only need to configure these once.
```

**Acceptance Criteria**:
- [ ] All 8 phases documented with clear descriptions
- [ ] Phase dependencies visualized
- [ ] Different behavior explained for PR vs push events
- [ ] Examples show how to customize test/deploy/remote-test jobs
- [ ] Domain capability flags connected to phase flow

---

### Doc #4: Setup-GitHub Command Fix
**Status**: Ready to Fix
**Severity**: LOW - Documentation error, easy to fix

**Problem**:
Post-generation message says `pipecraft setup-github --verify` but `--verify` flag doesn't exist. The command accepts `--apply` or `--force`.

**Files to Update**:

#### src/utils/preflight.ts
Find where next steps are generated and update:
```typescript
// BEFORE
'  pipecraft setup-github --verify    # Configure GitHub permissions'

// AFTER
'  pipecraft setup-github             # Configure GitHub permissions (interactive)'
'  pipecraft setup-github --apply     # Configure GitHub permissions (auto-apply)'
```

#### docs/docs/intro.md (What's Next section around line 239)
```markdown
**Set up branch protection** by running `pipecraft setup-github`. This configures required status checks and auto-merge settings.

For non-interactive setup (useful in CI/CD):
\`\`\`bash
pipecraft setup-github --apply
\`\`\`

**Acceptance Criteria**:
- [ ] Post-generation message shows correct flags
- [ ] Documentation shows both interactive and auto-apply modes
- [ ] No references to `--verify` flag remain

---

### Doc #5: Post-Generation Instructions Clarity
**Status**: Ready to Document
**Severity**: LOW - Minor confusion about command order

**Problem**:
After generation, users see:

```bash
pipecraft validate:pipeline
pipecraft setup-github --verify
```

But it's unclear:
- What `validate:pipeline` does (it's an npm script, not a pipecraft command)
- Which to run first
- That `validate` checks YAML syntax, `setup-github` configures permissions

**Documentation Updates Needed**:

#### Update post-generation message in src/cli/index.ts
Around line 269-273, improve next steps message:

\`\`\`typescript
const nextSteps = [
  '',
  '📋 Next steps:',
  '',
  '1. Review and customize the generated workflows:',
  '   - Add test commands to test-* jobs',
  '   - Add deployment logic to deploy-* jobs (if deployable: true)',
  '   - Add remote tests to remote-test-* jobs (if remoteTestable: true)',
  '',
  '2. Validate the workflow syntax:',
  '   npm run validate:pipeline        # Check YAML is valid',
  '',
  '3. Configure GitHub permissions for auto-merge:',
  '   pipecraft setup-github           # Interactive setup',
  '   pipecraft setup-github --apply   # Auto-apply (no prompts)',
  '',
  '4. Commit and push:',
  '   git add .github/workflows/ .pipecraftrc.json',
  '   git commit -m "feat: add pipecraft workflows"',
  '   git push',
  '',
  '5. Watch your first pipeline run at:',
  `   https://github.com/${getRepoInfo()}/actions`,
  ''
]
\`\`\`

**Acceptance Criteria**:
- [ ] Post-generation instructions clearly numbered
- [ ] Each step explains what it does
- [ ] setup-github shows both modes
- [ ] validate:pipeline explained as syntax check
- [ ] Instructions lead naturally from one step to next

---

## Testing Plan

After implementing fixes:

### Unit Tests
- [ ] Test `deployable: true` generates deploy jobs
- [ ] Test `remoteTestable: true` generates remote-test jobs
- [ ] Test `testable: false` skips test jobs
- [ ] Test domain property defaults are applied correctly

### Integration Tests

```bash
# Test 1: Deployable domains
cat > .pipecraftrc.json << 'EOF'
{
  "ciProvider": "github",
  "branchFlow": ["develop", "staging", "main"],
  "initialBranch": "develop",
  "finalBranch": "main",
  "domains": {
    "api": {
      "paths": ["apps/api/**"],
      "deployable": true
    }
  }
}
EOF

pipecraft generate --force
test -n "$(grep 'deploy-api:' .github/workflows/pipeline.yml)" && echo "✓ deploy-api generated" || echo "✗ deploy-api missing"

# Test 2: Remote testable domains
cat > .pipecraftrc.json << 'EOF'
{
  "ciProvider": "github",
  "branchFlow": ["develop", "staging", "main"],
  "initialBranch": "develop",
  "finalBranch": "main",
  "domains": {
    "web": {
      "paths": ["apps/web/**"],
      "remoteTestable": true
    }
  }
}
EOF

pipecraft generate --force
test -n "$(grep 'remote-test-web:' .github/workflows/pipeline.yml)" && echo "✓ remote-test-web generated" || echo "✗ remote-test-web missing"

# Test 3: Non-testable domains
cat > .pipecraftrc.json << 'EOF'
{
  "ciProvider": "github",
  "branchFlow": ["develop", "staging", "main"],
  "initialBranch": "develop",
  "finalBranch": "main",
  "domains": {
    "docs": {
      "paths": ["docs/**"],
      "testable": false
    }
  }
}
EOF

pipecraft generate --force
test -z "$(grep 'test-docs:' .github/workflows/pipeline.yml)" && echo "✓ test-docs correctly skipped" || echo "✗ test-docs incorrectly generated"
```

### Documentation Validation
- [ ] Follow updated Getting Started guide from scratch
- [ ] Verify all examples work as documented
- [ ] Check all links in documentation
- [ ] Verify code examples match actual implementation

---

## Implementation Order

1. **Phase 1: Critical Bugs (Day 1)**
   - Fix domain property name mismatch (#1)
   - Add remoteTestable to TypeScript interface
   - Update all template references
   - Add unit tests for property names
   - Run integration tests

2. **Phase 2: Quick Documentation Fixes (Day 1)**
   - Fix setup-github command docs (#4)
   - Update post-generation instructions (#5)

3. **Phase 3: Major Documentation (Day 2)**
   - Document init command behavior (#1)
   - Document domain field defaults (#2)
   - Expand workflow phases section (#3)
   - Add configuration reference page
   - Add examples for all domain capability combinations

4. **Phase 4: Testing & Validation (Day 3)**
   - Run full integration test suite
   - Test in real repository
   - Verify all documentation examples work
   - Get user feedback on clarity

---

## Success Criteria

- [ ] Setting `deployable: true` generates deploy jobs (currently broken)
- [ ] Setting `remoteTestable: true` generates remote test jobs
- [ ] All domain properties use consistent naming (`testable`, `deployable`, `remoteTestable`)
- [ ] Documentation clearly explains init generates defaults, then user edits config
- [ ] Domain capabilities (testable/deployable/remoteTestable) fully documented with defaults
- [ ] Complete 8-phase workflow flow documented with examples
- [ ] Post-generation instructions clear and actionable
- [ ] No references to non-existent `--verify` flag
- [ ] All tests pass
- [ ] User can follow docs from scratch successfully

---

## Notes

### Why init ignores prompts
The code at `src/generators/init.tpl.ts:214` shows:
```typescript
.then((ctx) => ({ ...ctx, ...defaultConfig } as PipecraftConfig))
```

This overwrites all prompt responses with `defaultConfig`. The comment on line 25 explains this is intentional for the initial release to ensure consistency. Future versions should respect user input.

### Property naming inconsistency root cause
The mismatch between interface (`deployable`) and template usage (`deploy`) suggests these were shortened for brevity in templates but the interface kept the full names. The fix is to use full names everywhere for consistency.

### Remote testable feature
The `remoteTestable` capability appears to be partially implemented:
- Template generates jobs when `remoteTest: true`
- But TypeScript interface doesn't define `remoteTestable` property
- Docs don't mention it
Needs full implementation and documentation.
