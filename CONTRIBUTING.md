# Contributing to PipeCraft

Thank you for your interest in contributing to PipeCraft! This guide will help you get started with contributing to the project.

We welcome all types of contributions:

- 🐛 Bug fixes
- ✨ New features
- 📝 Documentation improvements
- 🧪 Test coverage
- 💡 Ideas and suggestions

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing Guidelines](#testing-guidelines)
- [Commit Message Convention](#commit-message-convention)
- [Pull Request Process](#pull-request-process)
- [Code Style Guide](#code-style-guide)
- [Documentation](#documentation)
- [Getting Help](#getting-help)

---

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [james.villarrubia@gmail.com](mailto:james.villarrubia@gmail.com).

---

## Getting Started

### Prerequisites

- **Node.js** 18.0.0 or higher
- **pnpm** (recommended) or npm
- **Git** 2.0 or higher
- A **GitHub account**

### Quick Setup

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/pipecraft.git
cd pipecraft

# Add upstream remote
git remote add upstream https://github.com/pipecraft-lab/pipecraft.git

# Install dependencies
pnpm install

# Build the project
pnpm run build

# Run tests to verify setup
pnpm test
```

If all tests pass, you're ready to start contributing! 🎉

---

## Development Setup

### Repository Structure

```
pipecraft/
├── src/                    # Source code
│   ├── cli/               # CLI entry point and commands
│   ├── generators/        # Pinion-based generators
│   ├── templates/         # Workflow and action templates
│   │   ├── workflows/    # GitHub Actions workflow templates
│   │   ├── actions/      # Composite action templates
│   │   └── shared/       # Shared template operations
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
├── tests/                 # Test files
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── e2e/              # End-to-end tests
├── docs/                  # Documentation site (Docusaurus)
├── examples/              # Example projects
└── .github/              # GitHub Actions workflows
```

### Development Workflow

1. **Create a feature branch**

   ```bash
   git checkout develop
   git pull upstream develop
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes**

   - Edit source files in `src/`
   - Write tests in `tests/`
   - Update documentation in `docs/`

3. **Build and test locally**

   ```bash
   pnpm run build
   pnpm test
   pnpm run lint
   ```

4. **Test your changes manually**

   ```bash
   # Test CLI locally
   pnpm run pipecraft init
   pnpm run pipecraft generate

   # Or use tsx directly
   npx tsx src/cli/index.ts --help
   ```

### Available Scripts

| Script               | Description                      |
| -------------------- | -------------------------------- |
| `pnpm run build`     | Compile TypeScript to JavaScript |
| `pnpm test`          | Run test suite                   |
| `pnpm test:watch`    | Run tests in watch mode          |
| `pnpm test:coverage` | Generate coverage report         |
| `pnpm run lint`      | Check code style                 |
| `pnpm run lint:fix`  | Fix auto-fixable style issues    |
| `pnpm run format`    | Format code with Prettier        |
| `pnpm run docs:dev`  | Start documentation dev server   |
| `pnpm run pipecraft` | Run CLI locally                  |

---

## Project Structure

### Core Modules

#### CLI Layer (`src/cli/`)

- **Purpose**: Command-line interface and user interaction
- **Key files**: `index.ts` (entry point)
- **Commands**: init, generate, verify, validate, setup-github

#### Generators (`src/generators/`)

- **Purpose**: Pinion-based file generation
- **Key files**: `init.tpl.ts`, `workflows.tpl.ts`
- **Uses**: Template engine for idempotent generation

#### Templates (`src/templates/`)

- **Purpose**: GitHub Actions workflow and action templates
- **Workflows**: `pipeline.yml.tpl.ts`, `pipeline-nx.yml.tpl.ts`
- **Actions**: Composite actions for reusable logic
- **Shared**: Common operations and helpers

#### Utilities (`src/utils/`)

- **Purpose**: Core business logic
- **Key modules**:
  - `config.ts` - Configuration loading and validation
  - `versioning.ts` - Semantic version calculation
  - `preflight.ts` - Pre-flight checks
  - `ast-path-operations.ts` - AST-based YAML manipulation
  - `idempotency.ts` - Caching and change detection
  - `logger.ts` - Logging utilities

#### Types (`src/types/`)

- **Purpose**: TypeScript type definitions
- **Key file**: `index.ts` - Centralized type exports
- **Contains**: Configuration types, workflow types, domain types

### Architecture Principles

1. **Separation of Concerns**: CLI → Business Logic → Templates
2. **Idempotent Generation**: Safe to regenerate workflows
3. **AST-Based Merging**: Preserve user customizations
4. **Type Safety**: Strict TypeScript with minimal `any` usage
5. **Testability**: Unit, integration, and E2E test coverage

---

## Making Changes

### Before You Start

1. **Check existing issues**: See if someone is already working on it
2. **Create an issue**: For significant changes, discuss first
3. **Review the roadmap**: Ensure alignment with project direction

### Types of Contributions

#### Bug Fixes

1. Create an issue describing the bug (if not already exists)
2. Write a failing test that reproduces the bug
3. Fix the bug
4. Verify the test now passes
5. Submit a PR referencing the issue

**Example:**

```typescript
// tests/unit/config.test.ts
it('should handle missing domain paths gracefully', () => {
  const config = { domains: { api: {} } }
  expect(() => validateConfig(config)).toThrow('must have a "paths" array')
})
```

#### New Features

1. Open an issue to discuss the feature
2. Wait for maintainer feedback/approval
3. Write tests for the new feature (TDD approach)
4. Implement the feature
5. Update documentation
6. Submit a PR

**Feature checklist:**

- [ ] Tests written (unit, integration, E2E if applicable)
- [ ] Documentation updated
- [ ] TypeScript types added/updated
- [ ] No breaking changes (or documented if necessary)
- [ ] Examples updated if relevant

#### Documentation

Documentation lives in two places:

1. **In-code docs**: JSDoc comments for functions/modules
2. **Documentation site**: Markdown files in `docs/docs/`

For documentation changes:

- Run `pnpm run docs:dev` to preview locally
- Ensure proper formatting and links work
- Include code examples where helpful

#### Action Template Changes

When modifying action templates in `src/templates/actions/*.tpl.ts`, you must ensure the generated actions in `/actions/` stay in sync:

**Workflow:**

1. **Edit the template** in `src/templates/actions/`:

   ```bash
   # Example: Update detect-changes template
   vim src/templates/actions/detect-changes.yml.tpl.ts
   ```

2. **Regenerate actions** from templates:

   ```bash
   pnpm sync-actions
   ```

3. **Verify sync**:

   ```bash
   pnpm sync-actions:check
   ```

4. **Review changes**:

   ```bash
   git diff actions/
   ```

5. **Commit both files**:
   ```bash
   git add src/templates/actions/*.tpl.ts actions/
   git commit -m "feat(actions): update detect-changes to support X"
   ```

**Why This Matters:**

The `/actions/` directory is published to GitHub Marketplace, while `src/templates/actions/` generates actions for local use. Keeping them in sync ensures:

- ✅ Marketplace actions match generated actions
- ✅ Users get same functionality in both modes
- ✅ No drift between template and published versions

**CI Validation:**

The `.github/workflows/verify-action-sync.yml` workflow automatically verifies sync on every PR. If you forget to run `pnpm sync-actions`, CI will fail with instructions.

**Scripts:**

| Script                     | Purpose                               |
| -------------------------- | ------------------------------------- |
| `pnpm sync-actions`        | Regenerate `/actions/` from templates |
| `pnpm sync-actions:check`  | Verify sync without changes           |
| `pnpm sync-actions:verify` | Same as check (alias)                 |

---

## Testing Guidelines

### Test Organization

```
tests/
├── unit/              # Test individual functions
├── integration/       # Test component interactions
├── e2e/              # Test complete workflows
└── helpers/          # Test utilities and fixtures
```

### Writing Tests

**Unit Tests** - Test isolated functions:

```typescript
import { describe, it, expect } from 'vitest'
import { calculateVersion } from '../src/utils/versioning'

describe('calculateVersion', () => {
  it('should bump minor version for feat commits', () => {
    const commits = [{ type: 'feat', message: 'add feature' }]
    const result = calculateVersion('1.0.0', commits)
    expect(result).toBe('1.1.0')
  })
})
```

**Integration Tests** - Test components together:

```typescript
it('should generate workflow with correct domains', async () => {
  const config = createTrunkFlowConfig()
  const result = await generateWorkflow(config)

  assertValidYAML(result.yamlContent)
  assertWorkflowHasJobs(result.yamlContent, ['changes', 'test-api', 'test-web'])
})
```

**E2E Tests** - Test complete scenarios:

```typescript
it('should complete trunk flow from develop to main', async () => {
  // Setup repository
  await createTestRepo()

  // Initialize PipeCraft
  await runCLI('init', config)

  // Generate workflows
  await runCLI('generate')

  // Verify output
  expect(fs.existsSync('.github/workflows/pipeline.yml')).toBe(true)
})
```

### Test Helpers

Use provided test helpers from `tests/helpers/`:

```typescript
import { createTestWorkspace, assertFileExists, assertValidYAML } from '../helpers'

const workspace = await createTestWorkspace('test-project')
// ... do work ...
await workspace.cleanup()
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test config.test.ts

# Run with coverage
pnpm test:coverage

# Run in watch mode
pnpm test:watch

# Run tests matching pattern
pnpm test -- --grep "version"
```

### Coverage Requirements

- **Unit tests**: 90%+ coverage for core utils
- **Integration tests**: 80%+ coverage for generators
- **E2E tests**: Key workflows must have E2E tests

Current coverage: ~85% overall

---

## Commit Message Convention

PipeCraft uses [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages.

### Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

| Type       | Description             | Version Bump  |
| ---------- | ----------------------- | ------------- |
| `feat`     | New feature             | Minor (0.x.0) |
| `fix`      | Bug fix                 | Patch (0.0.x) |
| `docs`     | Documentation only      | None          |
| `style`    | Code style changes      | None          |
| `refactor` | Code refactoring        | None          |
| `perf`     | Performance improvement | Patch         |
| `test`     | Test changes            | None          |
| `chore`    | Maintenance tasks       | None          |
| `ci`       | CI/CD changes           | None          |
| `build`    | Build system changes    | None          |
| `revert`   | Revert previous commit  | Depends       |

### Breaking Changes

Mark breaking changes with `!` or `BREAKING CHANGE:` in footer:

```bash
git commit -m "feat!: change API signature"

# Or with footer
git commit -m "feat: change API" -m "BREAKING CHANGE: API signature changed"
```

### Examples

**Good commits:**

```bash
feat: add GitLab CI support
fix: correct version calculation for pre-release tags
docs: update CLI reference with new commands
test: add coverage for Nx integration
refactor: simplify AST manipulation logic
chore: update dependencies
```

**Bad commits:**

```bash
update stuff
fixed bug
WIP
changes
```

### Scope (Optional)

Use scopes to specify what part of the codebase changed:

```bash
feat(cli): add --dry-run flag
fix(templates): correct Nx workflow generation
docs(readme): add installation instructions
test(integration): add workflow generation tests
```

---

## Pull Request Process

### 1. Before Submitting

- [ ] Tests pass locally (`pnpm test`)
- [ ] Linting passes (`pnpm run lint`)
- [ ] Code is formatted (`pnpm run format`)
- [ ] Documentation is updated
- [ ] Commit messages follow convention
- [ ] Branch is up to date with `develop`

### 2. PR Title

PR title must follow conventional commit format:

```
feat: add GitLab CI support
fix: correct version calculation
docs: improve getting started guide
```

### 3. PR Description Template

```markdown
## Description

Brief description of what this PR does.

## Motivation

Why is this change needed? What problem does it solve?

## Changes

- Change 1
- Change 2
- Change 3

## Testing

How was this tested? Include steps to reproduce.

## Screenshots (if applicable)

Add screenshots for UI changes.

## Checklist

- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
- [ ] Conventional commit format
```

### 4. Review Process

1. **Automated checks**: CI runs tests, linting, coverage
2. **Code review**: Maintainer reviews your code
3. **Feedback**: Respond to comments, make requested changes
4. **Approval**: Once approved, PR will be merged
5. **Merge**: Squash merge to `develop` branch

### 5. After Merge

- Delete your feature branch
- Pull latest `develop` branch
- Your contribution will be in the next release! 🎉

---

## Code Style Guide

### TypeScript

**Use strict typing - avoid `any`:**

```typescript
// ❌ Bad
function process(data: any): any {
  return data.value
}

// ✅ Good
function process(data: ConfigData): string {
  return data.value
}
```

**Define interfaces for complex types:**

```typescript
// ❌ Bad - inline type
function createJob(config: { name: string; steps: string[] }) {}

// ✅ Good - defined interface
interface JobConfig {
  name: string
  steps: string[]
}

function createJob(config: JobConfig) {}
```

**Use type guards for narrowing:**

```typescript
function isNxConfig(config: Config): config is NxConfig {
  return 'nx' in config && config.nx?.enabled === true
}
```

### JSDoc Comments

All public functions must have JSDoc:

````typescript
/**
 * Calculates the next semantic version based on commits.
 *
 * @param currentVersion - Current version (e.g., "1.2.3")
 * @param commits - Array of commit objects with type and message
 * @returns Next version string
 *
 * @example
 * ```typescript
 * const version = calculateVersion('1.0.0', [
 *   { type: 'feat', message: 'add feature' }
 * ])
 * // Returns: '1.1.0'
 * ```
 */
export function calculateVersion(currentVersion: string, commits: Commit[]): string {
  // Implementation
}
````

### File Organization

```typescript
// 1. Imports (external first, then internal)
import { readFileSync } from 'fs'
import { parseDocument } from 'yaml'

import { logger } from '../utils/logger.js'
import type { Config } from '../types/index.js'

// 2. Type definitions
interface LocalType {
  // ...
}

// 3. Constants
const DEFAULT_CONFIG = {
  /* ... */
}

// 4. Helper functions (non-exported)
function helper() {}

// 5. Main exports
export function mainFunction() {}
```

### Error Handling

```typescript
// ✅ Good - specific error messages
if (!config.domains || Object.keys(config.domains).length === 0) {
  throw new Error(
    'Configuration must include at least one domain. ' +
      'See: https://pipecraft.thecraftlab.dev/docs/configuration-reference'
  )
}

// ✅ Good - typed errors
class ConfigValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message)
    this.name = 'ConfigValidationError'
  }
}
```

### Naming Conventions

- **Variables/Functions**: `camelCase`
- **Types/Interfaces**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Files**: `kebab-case.ts`

```typescript
// Variables and functions
const configPath = './config'
function generateWorkflow() {}

// Types and interfaces
interface PipecraftConfig {}
type WorkflowResult = {}

// Constants
const DEFAULT_BRANCH = 'main'

// Files
// config-loader.ts
// workflow-generator.ts
```

---

## Documentation

### In-Code Documentation

- Add JSDoc to all exported functions
- Include `@param`, `@returns`, `@throws` tags
- Provide `@example` for complex functions
- Document why, not what (code shows what)

### Documentation Site

Located in `docs/`:

```bash
cd docs
pnpm install
pnpm run start  # Start dev server
```

Documentation uses [Docusaurus](https://docusaurus.io/):

- **Guides**: `docs/docs/*.md`
- **API docs**: Auto-generated from TypeScript
- **Sidebar**: `docs/sidebars.ts`

**Adding a new doc page:**

1. Create `docs/docs/your-page.md`
2. Add to `docs/sidebars.ts`
3. Preview with `pnpm run docs:dev`
4. Include in PR

---

## Getting Help

### Where to Ask

- **💬 Discussions**: [General questions, ideas, help](https://github.com/pipecraft-lab/pipecraft/discussions)
- **🐛 Issues**: [Bug reports, feature requests](https://github.com/pipecraft-lab/pipecraft/issues)
- **📖 Docs**: [pipecraft.thecraftlab.dev](https://pipecraft.thecraftlab.dev)

### Maintainer Response Times

- **Issues**: Within 2-3 business days
- **PRs**: Within 1 week for initial review
- **Discussions**: Best effort, usually within a few days

### Good First Issues

Look for issues labeled `good first issue` - these are great for new contributors:

[View Good First Issues →](https://github.com/pipecraft-lab/pipecraft/labels/good%20first%20issue)

---

## Release Process (For Maintainers)

1. **Develop branch**: All PRs merge here
2. **Version bump**: Automatic based on commits
3. **Testing**: Full test suite on develop
4. **Staging branch**: Promote for pre-release testing
5. **Main branch**: Final promotion for release
6. **npm publish**: Automated via GitHub Actions
7. **GitHub release**: Created with changelog

Contributors don't need to worry about releases - maintainers handle this!

---

## License

By contributing to PipeCraft, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

## Recognition

Contributors are recognized in:

- Release notes and changelog
- GitHub contributors page
- Project README (for significant contributions)

Thank you for contributing to PipeCraft! 🎉

---

## Questions?

Still have questions? Reach out in [GitHub Discussions](https://github.com/pipecraft-lab/pipecraft/discussions) or email [james.villarrubia@gmail.com](mailto:james.villarrubia@gmail.com).
