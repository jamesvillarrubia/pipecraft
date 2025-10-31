# PipeCraft Test Suite

This directory contains a comprehensive test suite for the PipeCraft project, organized by testing type and purpose.

## 📁 Test Structure

```
tests/
├── unit/                    # Unit tests for individual components
├── integration/             # Integration tests for component interactions
├── e2e/                     # End-to-end tests (coming soon)
├── fixtures/                # Test data and configurations
├── helpers/                 # Test helper utilities
│   ├── workspace.ts         # Workspace management helpers
│   ├── fixtures.ts          # Fixture generation
│   ├── mocks.ts             # Reusable mocks
│   └── assertions.ts        # Custom test assertions
├── tools/                   # Development and debugging tools
│   ├── debug/               # Debugging utilities
│   ├── validation/          # Validation scripts
│   ├── act/                 # Local GitHub Actions testing (Act)
│   ├── github-live/         # Live GitHub Actions testing
│   └── github-local/        # Local GitHub simulation
├── setup.ts                 # Test setup configuration
└── README.md                # This file
```

## 🧪 Test Categories

### Unit Tests (`tests/unit/`)

- **Purpose**: Test individual functions, classes, and modules in isolation
- **Scope**: Single components with mocked dependencies
- **Speed**: Fast (< 1 second per test)
- **Coverage Target**: 90%+
- **Examples**: Config parsing, versioning logic, template rendering
- **Current Files**:
  - `ast-path-operations-extended.test.ts` - Extended AST operations
  - `cli.test.ts` - CLI logic (needs expansion)
  - `config-extended.test.ts` - Extended config validation
  - `config.test.ts` - Basic config loading
  - `github-setup.test.ts` - GitHub setup utilities (needs expansion)
  - `idempotency-isolated.test.ts` - Idempotency logic
  - `job-order.test.ts` - Job ordering validation
  - `pipeline-path-based.test.ts` - Pipeline template generation
  - `validate-pipeline.test.ts` - Pipeline validation
  - `versioning-extended.test.ts` - Extended versioning
  - `versioning.test.ts` - Basic versioning

### Integration Tests (`tests/integration/`)

- **Purpose**: Test interactions between multiple components
- **Scope**: Component integration with real dependencies
- **Speed**: Medium (1-10 seconds per test)
- **Coverage Target**: 80%+
- **Examples**: CLI commands, workflow generation, configuration validation
- **Current Files**:
  - `generators.test.ts` - Generator integration
  - `path-based-template.test.ts` - Path-based template integration
  - `simple-path-based.test.ts` - Simple path-based workflow

### End-to-End Tests (`tests/e2e/`)

- **Purpose**: Test complete user workflows from start to finish
- **Scope**: Full application flow with real file system
- **Speed**: Slow (10+ seconds per test)
- **Coverage Target**: Critical paths covered
- **Examples**: Complete workflow generation, version management, deployment
- **Status**: Coming soon (Phase 4)

### Test Helpers (`tests/helpers/`)

- **Purpose**: Reusable utilities for writing tests
- **Scope**: Workspace management, fixtures, mocks, custom assertions
- **Status**: To be created (Phase 2)
- **Planned Files**:
  - `workspace.ts` - Create/cleanup isolated test workspaces
  - `fixtures.ts` - Generate test configurations programmatically
  - `mocks.ts` - Reusable mocks for fs, child_process, GitHub API
  - `assertions.ts` - Custom matchers for YAML, config validation

### Development Tools (`tests/tools/`)

#### Debugging Tools (`tests/tools/debug/`)

- **Purpose**: Debug and analyze GitHub Actions failures
- **Scope**: Workflow analysis, log parsing, failure diagnosis
- **Files**:
  - `debug-workflows.sh` - Workflow debugging script
  - `parse-pipeline.js` - Pipeline parser for debugging
  - `debug-utils.ts` - Debugging utilities
  - `debug-workflow.test.ts` - Debugging test suite
  - `iterative-debug.ts` - Iterative debugging system
  - `run-debug-tests.sh` - Debug test runner

#### Validation Tools (`tests/tools/validation/`)

- **Purpose**: Validate generated workflows and configurations
- **Files**:
  - `validate-pipeline.cjs` - Pipeline YAML validation
  - `test-job-order.cjs` - Job order verification
  - `verify-job-order.sh` - Job order validation script

#### Act Testing (`tests/tools/act/`)

- **Purpose**: Test GitHub Actions workflows locally using Act
- **Scope**: Local simulation of GitHub Actions environment
- **Speed**: Medium (5-30 seconds per test)
- **Requirements**: Docker, Act (nektos/act)

#### GitHub Live Testing (`tests/tools/github-live/`)

- **Purpose**: Test workflows on actual GitHub Actions
- **Scope**: Real GitHub environment with live workflows
- **Speed**: Slow (1-10 minutes per test)
- **Requirements**: GitHub token, live repository

#### GitHub Local Testing (`tests/tools/github-local/`)

- **Purpose**: Local GitHub workflow simulation without Act
- **Scope**: Local testing without Docker
- **Speed**: Fast (1-5 seconds per test)

## 🚀 Running Tests

### All Tests

```bash
# Run all test suites
pnpm test

# Run with coverage
pnpm test:coverage

# Run with --run flag (no watch mode)
pnpm test:coverage --run

# Run in watch mode
pnpm test:watch
```

### Specific Test Types

```bash
# Unit tests only
pnpm test tests/unit/

# Integration tests only
pnpm test tests/integration/

# E2E tests only (when implemented)
pnpm test tests/e2e/

# Specific test file
pnpm test tests/unit/config.test.ts
```

### Development Tools

```bash
# Validate generated pipeline
node tests/tools/validation/validate-pipeline.cjs .github/workflows/pipeline.yml

# Test job order
node tests/tools/validation/test-job-order.cjs

# Debug workflows
./tests/tools/debug/debug-workflows.sh -w "My Pipeline"

# Run Act tests
./tests/tools/act/run-act-tests.sh

# Run GitHub live tests
./tests/tools/github-live/run-live-tests.sh

# Run GitHub local tests
./tests/tools/github-local/run-all-tests.sh
```

## 📋 Test Requirements

### Prerequisites

- Node.js (v18+)
- pnpm
- Git
- GitHub CLI (for live testing)
- Act + Docker (for local GitHub Actions testing)

### Environment Variables

```bash
# For GitHub live testing
export GITHUB_TOKEN="your_github_token"
export GITHUB_REPOSITORY="owner/repo"

# For debugging
export GITHUB_TOKEN="your_github_token"
export GITHUB_REPOSITORY_OWNER="owner"
export GITHUB_REPOSITORY="repo"
```

## 🔧 Test Configuration

### Vitest Configuration (`vitest.config.ts`)

Tests use Vitest with the following configuration:

- TypeScript support with path aliases
- ES modules
- Coverage reporting (v8)
- Parallel execution (threads)
- Watch mode support
- Isolated test environments

### Test Data

- **Fixtures** (`tests/fixtures/`) - Static test data and configurations
  - `basic-config.json` - Basic valid configuration
  - `invalid-config.json` - Invalid configuration for error testing
  - `test-config.json` - Test-specific configuration
  - `pipeline-*.yml` - Test pipeline YAML files
- **Mocks** - Inline mocks for external dependencies
- **Temporary files** - Created in unique temp directories, cleaned up automatically

### Test Setup (`tests/setup.ts`)

- Defines `TEST_DIR` and `FIXTURES_DIR` constants
- Sets up global test environment
- **Note**: TEST_DIR is shared and causes race conditions - will be refactored in Phase 2

## 📊 Test Coverage

### Current Coverage (as of latest run)

- **Overall**: 48%
- **CLI**: 0% ⚠️ (needs tests)
- **Preflight**: 0% ⚠️ (needs tests)
- **GitHub Setup**: 9% ⚠️ (needs expansion)
- **Init Generator**: 34% (needs expansion)
- **Versioning**: 57% (needs expansion)
- **Logger**: 60% (needs expansion)
- **Idempotency**: 91% ✅
- **Config**: 91% ✅
- **AST Operations**: 92% ✅
- **Workflow Template**: 87% ✅

### Coverage Targets (Phase 3)

- **Unit tests**: 90%+ coverage
- **Integration tests**: 80%+ coverage
- **E2E tests**: Critical paths covered
- **Overall project**: 75%+ coverage

## 🐛 Debugging Tests

### Common Issues

1. **Race Conditions**

   - **Symptom**: Intermittent test failures, `ENOENT` errors
   - **Cause**: Shared `TEST_DIR`, parallel test execution
   - **Solution**: Use unique temp directories per test (Phase 2 fix)

2. **Permission Errors**

   - **Symptom**: `EACCES` errors
   - **Solution**: Ensure test files/directories have proper permissions

3. **Environment Issues**

   - **Symptom**: Missing git repository, config not found
   - **Solution**: Check required environment variables and test setup

4. **Skipped Tests**
   - **Symptom**: Tests marked with `.skip`
   - **Cause**: Race conditions, test infrastructure issues
   - **Solution**: Will be fixed in Phase 2 (test isolation)

### Debug Commands

```bash
# Debug specific test with verbose output
pnpm test tests/unit/config.test.ts --reporter=verbose

# Debug with Node inspector
node --inspect-brk node_modules/.bin/vitest tests/unit/config.test.ts

# Run single test with debug output
pnpm test tests/unit/config.test.ts --run --reporter=verbose

# Check for test isolation issues
pnpm test --run --no-threads

# Run tests sequentially (no parallel)
pnpm test --run --pool=forks --poolOptions.forks.singleFork=true
```

## 📝 Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parseConfig } from '../../src/utils/config'

describe('Config Parser', () => {
  it('should parse valid configuration', () => {
    const config = parseConfig('{"ciProvider": "github"}')
    expect(config.ciProvider).toBe('github')
  })

  it('should throw on invalid configuration', () => {
    expect(() => parseConfig('invalid')).toThrow()
  })
})
```

### Integration Test Example

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('CLI Integration', () => {
  let testDir: string

  beforeEach(() => {
    // Create unique temp directory for this test
    testDir = join(tmpdir(), `test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('should generate workflows', async () => {
    // Test implementation
  })
})
```

### Test Best Practices

1. **Isolation**: Each test should be independent

   - Use unique temp directories
   - Clean up after yourself
   - Don't rely on test execution order

2. **Clear Assertions**: Be specific about what you're testing

   ```typescript
   // ❌ Bad: Vague assertion
   expect(result).toBeDefined()

   // ✅ Good: Specific assertion with message
   expect(config.branchFlow, 'Branch flow should match config').toEqual(['develop', 'main'])
   ```

3. **Test Behavior, Not Implementation**

   ```typescript
   // ❌ Bad: Testing internal state
   expect(manager.cache).toHaveProperty('files')

   // ✅ Good: Testing observable behavior
   expect(await manager.hasChanges()).toBe(false)
   ```

4. **Use Descriptive Names**

   ```typescript
   // ❌ Bad: Unclear what's being tested
   it('works', () => { ... })

   // ✅ Good: Clear test purpose
   it('should preserve user comments when regenerating pipeline', () => { ... })
   ```

5. **Mock External Dependencies**

   ```typescript
   import { vi } from 'vitest'

   vi.mock('child_process', () => ({
     execSync: vi.fn(() => 'mocked output')
   }))
   ```

## 🔄 Continuous Integration

### GitHub Actions

Tests run automatically on:

- Pull requests (all branches)
- Pushes to main/develop/staging branches
- Manual workflow dispatch

### Test Execution

- Node.js version: 22
- Operating system: Ubuntu latest
- Test types: Unit, Integration
- Coverage threshold: 75% (upcoming)

## 📚 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Act Documentation](https://github.com/nektos/act)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [CONTRIBUTING_TESTS.md](./CONTRIBUTING_TESTS.md) - How to write tests (coming soon)
- [Test Structure Overview](../docs/ARCHITECTURE.md#testing-strategy)

## 🤝 Contributing

When adding new tests:

1. **Choose the Right Category**

   - Unit tests for isolated logic
   - Integration tests for component interactions
   - E2E tests for complete workflows

2. **Follow Naming Conventions**

   - File: `feature-name.test.ts`
   - Describe block: `Feature Name` or `ClassName`
   - Test: `should do something specific`

3. **Ensure Test Isolation**

   - Use unique temp directories
   - Clean up all created files
   - Don't modify global state
   - Don't depend on test execution order

4. **Write Clear Tests**

   - One assertion per test (when possible)
   - Descriptive test names
   - Comments for complex test setup
   - Assertion messages for clarity

5. **Update Documentation**

   - Add new test files to this README
   - Update coverage targets
   - Document any new test patterns
   - Create examples for complex scenarios

6. **Run Tests Before Committing**

   ```bash
   # Run all tests
   pnpm test --run

   # Check coverage
   pnpm test:coverage --run

   # Verify no skipped tests (unless documented)
   grep -r "it.skip\|describe.skip" tests/
   ```

## 🚧 Known Issues & Roadmap

### Current Issues

- ❌ 15 tests skipped due to race conditions (shared TEST_DIR)
- ❌ CLI has 0% coverage (no tests)
- ❌ Preflight has 0% coverage (no tests)
- ❌ Many test files have `.skip` markers
- ❌ Tests modify process.cwd() globally

### Planned Improvements (see Phase 2-5)

- ✅ Create `tests/helpers/` utilities
- ✅ Fix test isolation (unique temp dirs)
- ✅ Unskip all 15 tests
- ✅ Add CLI command tests
- ✅ Add preflight tests
- ✅ Increase coverage to 75%+
- ✅ Create E2E test suite
- ✅ Add negative test cases
- ✅ Create CONTRIBUTING_TESTS.md guide

See [REPO_CLEANUP_PLAN.md](../docs/REPO_CLEANUP_PLAN.md) for full roadmap.
