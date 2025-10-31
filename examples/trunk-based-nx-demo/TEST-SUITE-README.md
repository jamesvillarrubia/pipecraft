# Test Suite Documentation

This document describes the architecture and usage of the PipeCraft Nx integration test suite.

## Architecture

The test suite is composed of 6 utility modules and an orchestrator script:

### Utility Modules

#### 1. git-manager.mjs

Manages git operations for test isolation:

- `createBaselineTag()`: Creates a clean state tag before testing
- `createTestBranch()`: Creates a timestamped test branch
- `resetToBaseline()`: Resets to clean state (USE WITH CAUTION)
- `createTestCommit()`: Creates commits for scenario testing
- `deleteTestBranches()`: Cleanup test branches

#### 2. pipecraft-runner.mjs

Executes PipeCraft CLI operations:

- `checkNxSetup()`: Validates Nx monorepo structure
- `runPipecraftInit()`: Creates `.pipecraftrc.json` configuration
- `runPipecraftGenerate()`: Runs workflow generation
- `captureGeneratedFiles()`: Saves workflow files for comparison
- `cleanPipecraftFiles()`: Removes generated artifacts

**Important**: The config uses **path-based detection** (not Nx strategy) because proper Nx support isn't implemented yet:

```json
{
  "domains": {
    "nx-apps": {
      "paths": ["apps/**"],
      "tasks": ["build", "test", "integration-test"]
    },
    "nx-libs": {
      "paths": ["libs/**"],
      "tasks": ["build", "test"]
    }
  }
}
```

#### 3. workflow-parser.mjs

Parses and analyzes GitHub Actions workflows:

- `parseWorkflow()`: Parses YAML to document
- `getJobNames()`: Extracts job names
- `buildDependencyGraph()`: Builds job dependency graph
- `verifyTestDependsOnBuild()`: Checks task dependencies
- `validateWorkflow()`: Validates workflow structure

#### 4. custom-job-injector.mjs

Tests idempotency by injecting custom jobs:

- `injectCustomJobs()`: Adds 3 custom jobs to pipeline
  - custom-security-scan
  - custom-notification
  - custom-integration-test
- `verifyJobsPreserved()`: Checks jobs after regeneration
- `compareWorkflows()`: Diffs workflows

#### 5. act-runner.mjs

Runs workflows locally with nektos/act:

- `checkActInstalled()`: Verifies act is available
- `runAct()`: Executes act with options
- `runActScenario()`: Tests a complete scenario
  - Makes file changes
  - Commits changes
  - Runs detect-changes job
  - Verifies affected projects
  - Runs expected jobs
- `runActScenarios()`: Runs all scenarios

#### 6. test-reporter.mjs

Generates comprehensive test reports:

- `generateReport()`: Creates TEST-REPORT.md
- `generateSummary()`: Console summary
- `generateDiffReport()`: Workflow diffs

### Orchestrator: test-pipecraft.mjs

Main test script with 7 phases:

**Phase 0: Pre-flight Checks**

- Validate git repository
- Check Nx setup (nx.json, libs/, apps/)
- Check act installation

**Phase 1: Git State Setup**

- Create baseline tag: `pipecraft-test-baseline`
- Create test branch: `pipecraft-test-run-<timestamp>`

**Phase 2: Initial Generation**

- Run `pipecraft init` (creates config)
- Run `pipecraft generate`
- Capture generated workflows

**Phase 3: Inject Custom Jobs**

- Inject 3 custom jobs into pipeline.yml
- Commit changes

**Phase 4: Regenerate (Idempotency Test)**

- Run `pipecraft generate` again
- Verify custom jobs preserved

**Phase 5: Act Testing**

- Load scenarios from config
- Run each scenario:
  - Modify files
  - Commit changes
  - Run detect-changes job
  - Verify affected projects match expectations
  - Run expected jobs

**Phase 6: Generate Report**

- Create TEST-REPORT.md
- Display summary

**Phase 7: Cleanup**

- Switch back to develop branch
- Delete test branches
- (Skipped with --keep-artifacts)

## Usage

### Command Line Options

```bash
# Full test suite (requires act)
./test-pipecraft.mjs

# Skip act scenarios (fast mode)
./test-pipecraft.mjs --skip-act

# Keep test artifacts for inspection
./test-pipecraft.mjs --keep-artifacts

# Clean generated files only
./test-pipecraft.mjs --clean-only

# Verbose output
./test-pipecraft.mjs --verbose
```

### npm Scripts

```bash
# Full test suite
npm run test:pipecraft

# Fast mode (skip act)
npm run test:pipecraft:fast

# Clean only
npm run test:pipecraft:clean
```

## Test Scenarios

All scenarios are defined in `test-pipecraft-config.json`:

### Nx Detection Scenarios

1. **auth-library-change**: Foundational library affecting 6+ projects
2. **database-library-change**: Library with test-WITH-build exception
3. **logging-library-change**: Library affecting 11+ projects (no build needed)
4. **analytics-library-change**: Test-WITH-build exception
5. **notifications-library-change**: Test-WITHOUT-build
6. **frontend-app-change**: Single app affected
7. **backend-app-change**: App with integration tests

### Path-Based Detection Scenarios

8. **pulumi-infrastructure-change**: Infra as code
9. **kubernetes-manifest-change**: K8s manifests
10. **pgroll-migration-change**: Database migrations

### Hybrid Detection Scenarios

11. **mixed-nx-and-path-changes**: Multiple Nx libs + infra + migrations

## Test Results

After running, you'll find:

- **TEST-REPORT.md**: Comprehensive markdown report with:

  - Pre-flight check results
  - Generation/regeneration results
  - Custom job preservation results
  - Act scenario results with details
  - Overall summary

- **Console Output**: Real-time progress and summary

## Requirements

### Required

- Node.js (ES modules support)
- npm/pnpm
- git
- PipeCraft CLI (in parent directory: `../../../`)
- Nx workspace files (nx.json, libs/, apps/)

### Optional (for act scenarios)

- nektos/act: `brew install act` (macOS)
- Docker (required by act)

## Common Issues

### Issue: Config format error

**Symptom**: `Cannot read properties of undefined (reading 'join')`

**Cause**: PipeCraft's Nx strategy isn't implemented yet. The test suite uses path-based detection as a workaround.

**Solution**: This is expected. The test suite is designed to work with the current PipeCraft implementation.

### Issue: act scenarios fail

**Symptom**: All act scenarios fail immediately

**Possible Causes**:

1. act not installed: `brew install act`
2. Docker not running: Start Docker Desktop
3. GitHub Actions syntax error: Check generated workflows

**Solution**: Use `--skip-act` flag to skip these tests

### Issue: Custom jobs lost during regeneration

**Symptom**: `verifyJobsPreserved()` shows missing jobs

**Cause**: PipeCraft's idempotency implementation may have issues

**Impact**: This is a critical finding - indicates PipeCraft needs fixes

## Development

### Adding New Scenarios

Edit `test-pipecraft-config.json`:

```json
{
  "name": "my-scenario",
  "description": "What this tests",
  "changes": ["path/to/file.ts"],
  "expectedAffected": ["project-name"],
  "expectedJobs": ["build-project", "test-project"],
  "verifyTaskDependencies": true
}
```

### Adding New Test Utilities

1. Create module in `test-utils/`
2. Export functions
3. Import in `test-pipecraft.mjs`
4. Use in appropriate phase

### Debugging

Use `--verbose` flag for detailed output:

```bash
./test-pipecraft.mjs --verbose --keep-artifacts
```

Then inspect:

- `.github/workflows/pipeline.yml`
- `.pipecraftrc.json`
- TEST-REPORT.md

## Future Improvements

1. **Proper Nx Strategy**: Implement `strategy: "nx"` in PipeCraft
2. **Matrix Job Generation**: Generate matrix strategies for affected projects
3. **Task Dependency Analysis**: Parse `project.json` to respect per-project overrides
4. **Parallel Act Execution**: Run multiple act scenarios in parallel
5. **Performance Metrics**: Track generation time, workflow complexity
6. **Regression Testing**: Compare results against baseline expectations
