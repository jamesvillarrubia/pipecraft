# Flowcraft Tests

This directory contains comprehensive tests for the Flowcraft CLI tool.

## Test Structure

```
tests/
├── unit/                    # Unit tests for individual components
│   ├── config.test.ts      # Configuration utilities tests
│   ├── idempotency.test.ts # Idempotency manager tests
│   └── versioning.test.ts   # Version management tests
├── integration/            # Integration tests
│   └── cli.test.ts         # CLI command integration tests
├── e2e/                    # End-to-end tests
│   └── workflow-generation.test.ts # Complete workflow tests
├── __fixtures__/           # Test data and configurations
│   ├── basic-config.json   # Valid configuration example
│   └── invalid-config.json # Invalid configuration example
├── setup.ts                # Test environment setup
└── README.md               # This file
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:run tests/unit
```

### Integration Tests Only
```bash
npm run test:run tests/integration
```

### End-to-End Tests Only
```bash
npm run test:run tests/e2e
```

### Test Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

### Test UI
```bash
npm run test:ui
```

## Test Categories

### Unit Tests
- **Configuration utilities** - Test config loading and validation
- **Idempotency manager** - Test file hashing and change detection
- **Version manager** - Test version calculation and release-it integration

### Integration Tests
- **CLI commands** - Test individual CLI commands with mocked dependencies
- **Command interactions** - Test how commands work together

### End-to-End Tests
- **Complete workflows** - Test full workflow generation from start to finish
- **Real file operations** - Test actual file system operations
- **Configuration scenarios** - Test different configuration scenarios

## Test Environment

Tests run in an isolated environment with:
- **Temporary directory** - All tests run in a clean temporary directory
- **Mocked dependencies** - External dependencies are mocked where appropriate
- **Cleanup** - Test files are automatically cleaned up after each test
- **Console mocking** - Console output is captured and can be asserted

## Writing Tests

### Test Structure
```typescript
import { describe, it, expect, beforeEach } from 'vitest'

describe('Component Name', () => {
  beforeEach(() => {
    // Setup for each test
  })

  it('should do something', () => {
    // Test implementation
    expect(result).toBe(expected)
  })
})
```

### Test Fixtures
Use the `__fixtures__` directory for test data:
- **Valid configurations** - Examples of working configurations
- **Invalid configurations** - Examples that should fail validation
- **Sample files** - Template files for testing

### Best Practices
- **Isolate tests** - Each test should be independent
- **Clean up** - Remove test files after each test
- **Mock external dependencies** - Don't rely on external services
- **Test edge cases** - Include error conditions and edge cases
- **Use descriptive names** - Test names should clearly describe what they test

## Coverage Goals

- **Unit tests**: 90%+ coverage for utility functions
- **Integration tests**: 80%+ coverage for CLI commands
- **End-to-end tests**: 70%+ coverage for complete workflows

## Continuous Integration

Tests are automatically run in CI/CD pipelines:
- **Unit tests** - Run on every commit
- **Integration tests** - Run on pull requests
- **End-to-end tests** - Run on main branch
- **Coverage reports** - Generated and published
