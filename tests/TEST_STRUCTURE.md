# Flowcraft Test Structure

This document outlines the complete test structure for the Flowcraft project.

## 📁 Directory Structure

```
tests/
├── unit/                    # Unit tests for individual components
│   ├── config.test.ts       # Configuration parsing tests
│   ├── idempotency.test.ts  # Idempotency logic tests
│   ├── tag-template.test.ts # Tag template tests
│   └── versioning.test.ts   # Versioning logic tests
├── integration/             # Integration tests for component interactions
│   └── cli.test.ts         # CLI command integration tests
├── e2e/                     # End-to-end tests for complete workflows
│   └── workflow-generation.test.ts # Complete workflow generation tests
├── github-local/            # Local GitHub Actions testing with Act
│   ├── README.md           # Local testing documentation
│   └── run-local-tests.sh   # Local test runner (to be created)
├── github-live/             # Live GitHub Actions testing
│   └── README.md           # Live testing documentation
├── fixtures/                # Test data and configurations
│   ├── basic-config.json   # Basic test configuration
│   └── invalid-config.json # Invalid test configuration
├── debugging/               # GitHub Actions debugging tools
│   ├── debug-workflows.sh  # Workflow debugging script
│   ├── debug-utils.ts      # Debugging utilities
│   ├── debug-workflow.test.ts # Debugging test suite
│   ├── iterative-debug.ts  # Iterative debugging system
│   └── run-debug-tests.sh  # Debug test runner
├── README.md               # Main test documentation
├── setup.ts               # Test setup configuration
└── TEST_STRUCTURE.md      # This file
```

## 🧪 Test Categories

### 1. Unit Tests (`tests/unit/`)
- **Purpose**: Test individual functions, classes, and modules in isolation
- **Scope**: Single components with mocked dependencies
- **Speed**: Fast (< 1 second per test)
- **Examples**: Config parsing, versioning logic, template rendering
- **Files**: `config.test.ts`, `idempotency.test.ts`, `tag-template.test.ts`, `versioning.test.ts`

### 2. Integration Tests (`tests/integration/`)
- **Purpose**: Test interactions between multiple components
- **Scope**: Component integration with real dependencies
- **Speed**: Medium (1-10 seconds per test)
- **Examples**: CLI commands, workflow generation, configuration validation
- **Files**: `cli.test.ts`

### 3. End-to-End Tests (`tests/e2e/`)
- **Purpose**: Test complete user workflows from start to finish
- **Scope**: Full application flow with real file system
- **Speed**: Slow (10+ seconds per test)
- **Examples**: Complete workflow generation, version management, deployment
- **Files**: `workflow-generation.test.ts`

### 4. GitHub Local Testing (`tests/github-local/`)
- **Purpose**: Test GitHub Actions workflows locally using Act
- **Scope**: Local simulation of GitHub Actions environment
- **Speed**: Medium (5-30 seconds per test)
- **Examples**: Workflow execution, job dependencies, environment variables
- **Tools**: Act (Nectos Act)
- **Files**: `README.md`, `run-local-tests.sh` (to be created)

### 5. GitHub Live Testing (`tests/github-live/`)
- **Purpose**: Test workflows on actual GitHub Actions
- **Scope**: Real GitHub environment with live workflows
- **Speed**: Slow (1-10 minutes per test)
- **Examples**: Live workflow execution, performance testing, debugging
- **Tools**: GitHub CLI, GitHub Actions API
- **Files**: `README.md`, `run-live-tests.sh` (to be created)

### 6. Debugging Tools (`tests/debugging/`)
- **Purpose**: Debug and analyze GitHub Actions failures
- **Scope**: Workflow analysis, log parsing, failure diagnosis
- **Speed**: Variable (depends on analysis depth)
- **Examples**: Workflow debugging, failure analysis, iterative fixing
- **Files**: `debug-workflows.sh`, `debug-utils.ts`, `debug-workflow.test.ts`, `iterative-debug.ts`, `run-debug-tests.sh`

## 🚀 Running Tests

### All Tests
```bash
# Run all test suites
pnpm test

# Run with coverage
pnpm test:coverage

# Run in watch mode
pnpm test:watch
```

### Specific Test Types
```bash
# Unit tests only
pnpm test tests/unit/

# Integration tests only
pnpm test tests/integration/

# E2E tests only
pnpm test tests/e2e/

# GitHub local tests only
./tests/github-local/run-local-tests.sh

# GitHub live tests only
./tests/github-live/run-live-tests.sh

# Debugging tools
./tests/debugging/debug-workflows.sh -w "My Pipeline"
```

## 📋 Test Requirements

### Prerequisites
- Node.js (v18+)
- pnpm
- Git
- GitHub CLI (for live testing)
- Act (for local GitHub Actions testing)
- Docker (for Act)

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

### Vitest Configuration
Tests use Vitest with the following configuration:
- TypeScript support
- ES modules
- Coverage reporting
- Parallel execution
- Watch mode support

### Test Data
- **Fixtures**: `tests/fixtures/` - Static test data and configurations
- **Mocks**: Inline mocks for external dependencies
- **Temporary files**: Created and cleaned up automatically

## 📊 Test Coverage

We aim for:
- **Unit tests**: 90%+ coverage
- **Integration tests**: 80%+ coverage
- **E2E tests**: Critical paths covered
- **GitHub local tests**: All workflow types tested
- **Live tests**: Production-like scenarios

## 🐛 Debugging Tests

### Common Issues
1. **Permission errors**: Ensure test files are executable
2. **Environment issues**: Check required environment variables
3. **Dependency issues**: Run `pnpm install` to update dependencies
4. **GitHub API limits**: Use appropriate rate limiting for live tests

### Debug Commands
```bash
# Debug specific test
pnpm test tests/unit/config.test.ts --reporter=verbose

# Debug with Node inspector
node --inspect-brk node_modules/.bin/vitest tests/unit/config.test.ts

# Debug GitHub local tests
./tests/github-local/run-local-tests.sh --verbose --debug

# Debug GitHub live tests
./tests/github-live/run-live-tests.sh --debug --workflow "My Pipeline"
```

## 📝 Writing Tests

### Unit Test Example
```typescript
import { describe, it, expect } from 'vitest'
import { parseConfig } from '../src/utils/config'

describe('Config Parser', () => {
  it('should parse valid configuration', () => {
    const config = parseConfig('{"version": "1.0.0"}')
    expect(config.version).toBe('1.0.0')
  })
})
```

### Integration Test Example
```typescript
import { describe, it, expect } from 'vitest'
import { runCLI } from './helpers/cli'

describe('CLI Integration', () => {
  it('should generate workflows', async () => {
    const result = await runCLI(['generate'])
    expect(result.exitCode).toBe(0)
  })
})
```

### E2E Test Example
```typescript
import { describe, it, expect } from 'vitest'
import { generateWorkflows } from './helpers/workflow'

describe('E2E Workflow Generation', () => {
  it('should generate complete workflow suite', async () => {
    const result = await generateWorkflows()
    expect(result.success).toBe(true)
    expect(result.workflows).toHaveLength(7)
  })
})
```

## 🔄 Continuous Integration

### GitHub Actions
Tests run automatically on:
- Pull requests
- Pushes to main branch
- Scheduled runs (nightly)

### Test Matrix
- Node.js versions: 18, 20, 22
- Operating systems: Ubuntu, macOS, Windows
- Test types: Unit, Integration, E2E

## 📚 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Act Documentation](https://github.com/nektos/act)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Testing Best Practices](./testing-best-practices.md)

## 🤝 Contributing

When adding new tests:
1. Follow the existing structure and naming conventions
2. Add appropriate test data to fixtures
3. Update this document if adding new test categories
4. Ensure tests are fast and reliable
5. Add documentation for complex test scenarios
