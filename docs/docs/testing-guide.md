# PipeCraft Testing Guide

Comprehensive guide to testing in the PipeCraft project.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Test Helpers](#test-helpers)
- [Writing Tests](#writing-tests)
- [Running Tests](#running-tests)
- [Coverage](#coverage)
- [Best Practices](#best-practices)

## Overview

PipeCraft uses [Vitest](https://vitest.dev/) for testing with a comprehensive test suite covering:

- **Unit Tests**: Individual functions and modules
- **Integration Tests**: Component interactions
- **Generator Tests**: Template generation
- **CLI Tests**: Command-line interface

### Test Statistics

- **Total Tests**: 347+ passing
- **Test Files**: 19
- **Coverage**: ~85% across core modules
- **Test Helpers**: 4 comprehensive modules

## Test Structure

```
tests/
├── unit/               # Unit tests for individual modules
│   ├── config*.test.ts
│   ├── versioning*.test.ts
│   ├── logger.test.ts
│   ├── preflight.test.ts
│   ├── github-setup.test.ts
│   ├── init-generator.test.ts
│   └── ...
├── integration/        # Integration tests
│   ├── generators.test.ts
│   ├── path-based-template.test.ts
│   └── simple-path-based.test.ts
├── helpers/            # Test helper utilities
│   ├── workspace.ts    # Workspace management
│   ├── fixtures.ts     # Fixture generation
│   ├── mocks.ts        # Mocking utilities
│   └── assertions.ts   # Custom assertions
└── tools/              # Test tooling
    ├── debug/          # Debug utilities
    └── validation/     # Validation scripts
```

## Test Helpers

PipeCraft provides four comprehensive test helper modules to make testing easier and more maintainable.

### 1. Workspace Management (`tests/helpers/workspace.ts`)

Create isolated test workspaces to prevent race conditions:

```typescript
import { createWorkspaceWithCleanup, inWorkspace } from '../helpers/workspace'

describe('My Test', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('my-test')
  })

  afterEach(() => {
    cleanup()
  })

  it('should do something', async () => {
    await inWorkspace(workspace, () => {
      // Test code runs with workspace as cwd
      writeFileSync('.pipecraftrc.json', JSON.stringify(config))
      // ...
    })
  })
})
```

**Key Functions:**

- `createTestWorkspace(prefix)` - Create unique temp directory
- `cleanupTestWorkspace(path)` - Safe cleanup
- `createPipecraftWorkspace(prefix, options)` - Pre-configured structure
- `inWorkspace(path, fn)` - Execute with cwd context
- `createWorkspaceWithCleanup(prefix)` - Returns [workspace, cleanup]

### 2. Fixture Generation (`tests/helpers/fixtures.ts`)

Generate test fixtures programmatically instead of using static files:

```typescript
import { createMinimalConfig, createTrunkFlowConfig } from '../helpers/fixtures'

it('should validate config', () => {
  const config = createMinimalConfig({
    initialBranch: 'develop',
    finalBranch: 'production'
  })

  expect(() => validateConfig(config)).not.toThrow()
})
```

**Key Functions:**

- `createMinimalConfig(overrides)` - Basic valid config
- `createTrunkFlowConfig(overrides)` - Full trunk flow
- `createMonorepoConfig(domainCount, overrides)` - Multi-domain
- `createInvalidConfig(type)` - Invalid configs for error testing
- `createBasicWorkflowYAML(name)` - Simple workflow
- `createPipelineWorkflowYAML(options)` - Complex workflow
- `createPackageJSON(overrides)` - package.json generation

### 3. Mocking Utilities (`tests/helpers/mocks.ts`)

Mock common dependencies with ease:

```typescript
import { mockExecSync, mockLogger, mockGitRepository } from '../helpers/mocks'

// Mock git commands
const gitMock = mockGitRepository({
  currentBranch: 'develop',
  hasRemote: true,
  latestTag: 'v1.0.0'
})

// Mock logger to suppress output
const logger = mockLogger()
logger.info('test')
expect(logger.info).toHaveBeenCalledWith('test')
```

**Key Functions:**

- `mockExecSync(commandMap)` - Mock shell commands
- `mockLogger()` - Mock logger with tracking
- `mockGitRepository(options)` - Complete git state
- `mockFileSystem(fileContents)` - Mock fs operations
- `mockGitHubAPI(responses)` - Mock GitHub API
- `mockEnv(env)` - Safe environment mocking
- `spyOnConsole(method)` - Console method spies

### 4. Custom Assertions (`tests/helpers/assertions.ts`)

Readable, reusable assertions:

```typescript
import { assertFileExists, assertValidYAML, assertWorkflowHasJobs } from '../helpers/assertions'

it('should generate workflow', () => {
  assertFileExists('workflow.yml', 'Pipeline workflow should exist')
  assertValidYAML('workflow.yml')
  assertWorkflowHasJobs('workflow.yml', ['test', 'build', 'deploy'])
})
```

**Key Functions:**

- `assertFileExists/NotExists(path, message)` - File existence
- `assertFileContains/NotContains(path, pattern, message)` - Content checks
- `assertValidYAML/JSON(path, message)` - Parse validation
- `assertWorkflowHasJobs(path, jobs, message)` - Workflow jobs
- `assertWorkflowJobHasSteps(path, job, steps, message)` - Job steps
- `assertJobOrder(path, order, message)` - Job sequence
- `assertValidConfig/Semver(value, message)` - Validation
- `assertErrorMessage(error, pattern, message)` - Error checking

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { myFunction } from '../../src/utils/myModule.js'
import { createWorkspaceWithCleanup } from '../helpers/workspace.js'
import { createMinimalConfig } from '../helpers/fixtures.js'

describe('myFunction', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('my-function')
  })

  afterEach(() => {
    cleanup()
  })

  it('should do something', () => {
    const config = createMinimalConfig()
    const result = myFunction(config)

    expect(result).toBeDefined()
    expect(result.status).toBe('success')
  })
})
```

### Integration Test Example

```typescript
import { describe, it, expect } from 'vitest'
import { generate } from '../../src/generators/init.tpl.js'
import { createPipecraftWorkspace } from '../helpers/workspace.js'
import { assertFileExists, assertValidJSON } from '../helpers/assertions.js'

describe('Init Generator', () => {
  it('should generate complete config', async () => {
    const workspace = createPipecraftWorkspace('init-test')

    await generate({
      cwd: workspace
      // ... generator context
    })

    assertFileExists('.pipecraftrc.json')
    const config = assertValidJSON('.pipecraftrc.json')
    expect(config.ciProvider).toBe('github')
  })
})
```

### Mocking Example

```typescript
import { vi } from 'vitest'
import { execSync } from 'child_process'

// Mock at module level
vi.mock('child_process', async () => {
  const actual = await vi.importActual('child_process')
  return {
    ...actual,
    execSync: vi.fn()
  }
})

const mockExecSync = execSync as unknown as ReturnType<typeof vi.fn>

describe('Git Commands', () => {
  it('should call git', () => {
    mockExecSync.mockReturnValue('main')

    const branch = getCurrentBranch()

    expect(mockExecSync).toHaveBeenCalledWith('git branch --show-current', expect.any(Object))
    expect(branch).toBe('main')
  })
})
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Specific Test File

```bash
npm test -- tests/unit/config.test.ts
```

### Run with Coverage

```bash
npm run test:coverage
```

### Run in Watch Mode

```bash
npm test -- --watch
```

### Run Tests Matching Pattern

```bash
npm test -- -t "should validate"
```

### Run with Debug Output

```bash
npm test -- --reporter=verbose
```

## Coverage

### Current Coverage by Module

| Module       | Coverage | Tests |
| ------------ | -------- | ----- |
| Logger       | 95%+     | 44    |
| Preflight    | 95%+     | 31    |
| GitHub Setup | 85%+     | 33    |
| Versioning   | 85%+     | 35    |
| Generators   | 80%+     | 18    |
| Config       | 75%+     | 25    |
| Pipeline     | 70%+     | 21    |
| Idempotency  | 65%+     | 18    |

### Coverage Goals

- **Critical modules** (preflight, config, versioning): 90%+
- **Core utilities** (logger, github-setup): 85%+
- **Generators & templates**: 80%+
- **CLI commands**: 80%+
- **Overall project**: 75%+

## Best Practices

### 1. Test Isolation

✅ **DO:** Use unique workspaces per test

```typescript
beforeEach(() => {
  ;[workspace, cleanup] = createWorkspaceWithCleanup('my-test')
})
```

❌ **DON'T:** Share directories between tests

```typescript
const TEST_DIR = './test-temp' // Causes race conditions!
```

### 2. Descriptive Test Names

✅ **DO:** Describe behavior and expected outcome

```typescript
it('should validate config with all required fields', () => {})
it('should throw when config is missing ciProvider', () => {})
```

❌ **DON'T:** Use vague names

```typescript
it('works', () => {})
it('test 1', () => {})
```

### 3. Use Helpers

✅ **DO:** Use test helpers for common operations

```typescript
const config = createMinimalConfig()
assertFileExists('.pipecraftrc.json')
```

❌ **DON'T:** Repeat boilerplate

```typescript
const config = {
  ciProvider: 'github',
  mergeStrategy: 'fast-forward'
  // ... 50 more lines
}
```

### 4. Test Behavior, Not Implementation

✅ **DO:** Test what the function does

```typescript
it('should generate workflow with correct jobs', () => {
  const result = generateWorkflow(config)
  assertWorkflowHasJobs(result, ['test', 'build'])
})
```

❌ **DON'T:** Test internal details

```typescript
it('should call parseYAML 3 times', () => {
  expect(parseYAMLSpy).toHaveBeenCalledTimes(3) // Brittle!
})
```

### 5. Clear Assertions

✅ **DO:** Include descriptive messages

```typescript
expect(config.domains).toBeDefined('Config should have domains')
assertFileExists('.pipecraftrc.json', 'Init should create config file')
```

❌ **DON'T:** Use generic assertions

```typescript
expect(config.domains).toBeDefined()
```

### 6. Setup and Teardown

✅ **DO:** Clean up after tests

```typescript
afterEach(() => {
  cleanup() // Remove test workspace
  vi.restoreAllMocks()
})
```

❌ **DON'T:** Leave test artifacts

```typescript
// No cleanup = polluted environment for next test
```

### 7. Mock External Dependencies

✅ **DO:** Mock file system, network, external commands

```typescript
vi.mock('child_process')
mockExecSync.mockReturnValue('mocked output')
```

❌ **DON'T:** Rely on real external state

```typescript
// Will fail in CI if git not configured
execSync('git config user.name')
```

## Common Patterns

### Testing Async Functions

```typescript
it('should generate config', async () => {
  await generateConfig(ctx)
  assertFileExists('.pipecraftrc.json')
})
```

### Testing Error Cases

```typescript
it('should throw for invalid config', () => {
  const invalid = createInvalidConfig('missing-fields')
  expect(() => validateConfig(invalid)).toThrow('missing required fields')
})
```

### Testing File Generation

```typescript
it('should create workflow file', async () => {
  await generateWorkflows(config)

  assertFileExists('.github/workflows/pipeline.yml')
  const workflow = assertValidYAML('.github/workflows/pipeline.yml')
  expect(workflow.jobs.test).toBeDefined()
})
```

### Testing with Different Configurations

```typescript
const scenarios = [
  { name: 'GitHub', provider: 'github' },
  { name: 'GitLab', provider: 'gitlab' }
]

scenarios.forEach(scenario => {
  it(`should work with ${scenario.name}`, () => {
    const config = createMinimalConfig({ ciProvider: scenario.provider })
    const result = myFunction(config)
    expect(result).toBeDefined()
  })
})
```

## Troubleshooting

### Tests Fail Intermittently

**Problem:** Race conditions from shared resources

**Solution:** Use isolated workspaces

```typescript
// Before: shared TEST_DIR
const TEST_DIR = ('./test-temp'[
  // After: unique workspace per test
  (workspace, cleanup)
] = createWorkspaceWithCleanup('my-test'))
```

### Mock Not Working

**Problem:** Mock applied after import

**Solution:** Use vi.mock() at module level

```typescript
// At top of file, before imports
vi.mock('child_process', () => ({ ... }))

// Then import
import { myFunction } from './module.js'
```

### File Not Found Errors

**Problem:** Working directory not set correctly

**Solution:** Use `inWorkspace()` helper

```typescript
await inWorkspace(workspace, () => {
  // File operations here have correct cwd
  writeFileSync('.pipecraftrc.json', '...')
})
```

### Coverage Not Updating

**Problem:** Source maps or build artifacts

**Solution:** Clean and rebuild

```bash
rm -rf dist/ coverage/
npm run build
npm run test:coverage
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [PipeCraft Architecture](./architecture)
- [Test Structure](https://github.com/jamesvillarrubia/pipecraft/tree/main/tests)
- [Contributing Guide](https://github.com/jamesvillarrubia/pipecraft/blob/main/CONTRIBUTING.md)

## Questions?

If you have questions about testing:

1. Check existing tests for similar patterns
2. Review test helpers documentation
3. Run tests with `--reporter=verbose` for details
4. Open an issue for clarification

---

**Happy Testing! 🧪**
