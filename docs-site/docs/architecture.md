# PipeCraft Architecture

## Overview

PipeCraft is a CLI tool that generates intelligent CI/CD pipelines for trunk-based development workflows. It automates the creation of GitHub Actions workflows that handle:

- Automated testing on code changes
- Branch-to-branch promotions (develop → staging → main)
- Semantic versioning based on conventional commits
- Domain-based change detection for monorepos
- Fast-forward merge strategies for linear history

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         PipeCraft CLI                           │
│                      (src/cli/index.ts)                         │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ Commands: init, generate, validate, verify, setup
             │
    ┌────────┴─────────┐
    │                  │
    ▼                  ▼
┌────────┐      ┌──────────────┐
│ Config │      │  Pre-Flight  │
│ Loader │      │   Checks     │
└───┬────┘      └──────┬───────┘
    │                  │
    │ validates        │ node version, git repo, permissions
    │                  │
    ▼                  ▼
┌────────────────────────────────────────┐
│        Template Generation             │
│                                        │
│  ┌──────────────┐  ┌───────────────┐  │
│  │  Workflow    │  │  Init         │  │
│  │  Generator   │  │  Generator    │  │
│  └──────┬───────┘  └───────┬───────┘  │
└─────────┼──────────────────┼───────────┘
          │                  │
          │ uses templates   │
          │                  │
    ┌─────┴──────────────────┴─────┐
    │                              │
    ▼                              ▼
┌──────────────┐           ┌──────────────┐
│  Idempotency │           │   Version    │
│   Manager    │           │   Manager    │
└──────────────┘           └──────────────┘
    │                              │
    │ caching                      │ release-it, git tags
    │                              │
    ▼                              ▼
┌──────────────────────────────────────────┐
│          Generated Workflows              │
│                                          │
│  .github/workflows/pipeline.yml          │
│  .github/actions/*/action.yml            │
└──────────────────────────────────────────┘
```

## Core Components

### 1. CLI Layer (`src/cli/index.ts`)

**Purpose**: Command-line interface and user interaction

**Responsibilities**:
- Parse command-line arguments using Commander.js
- Coordinate between different subsystems
- Handle user prompts and interactive mode
- Set logging verbosity based on flags

**Commands**:
- `init`: Initialize PipeCraft configuration interactively
- `generate`: Generate workflows from configuration
- `validate`: Validate existing workflow files
- `verify`: Verify pipeline job order and structure
- `setup`: Configure GitHub repository permissions
- `version`: Display version information

### 2. Configuration System (`src/utils/config.ts`)

**Purpose**: Load and validate project configuration

**Responsibilities**:
- Search for configuration files using cosmiconfig
- Parse `.pipecraftrc.json` or `package.json` (pipecraft key)
- Validate required fields and types
- Set default values for optional fields
- Provide type-safe configuration object

**Configuration Sources** (in order):
1. `.pipecraftrc.json`
2. `.pipecraftrc` (JSON or YAML)
3. `pipecraft.config.js`
4. `package.json` (pipecraft key)

### 3. Pre-Flight Checks (`src/utils/preflight.ts`)

**Purpose**: Validate environment before workflow generation

**Checks Performed**:
- Node.js version (>= 18.0.0 required)
- Git repository existence
- Git remote configuration
- Workflow directory write permissions
- Branch structure validity
- Configuration completeness

**Why**: Prevents generating workflows that won't work, providing clear error messages with actionable suggestions.

### 4. Template Generation (`src/generators/`)

**Purpose**: Generate workflow and configuration files from templates

**Components**:

#### Workflow Generator (`workflows.tpl.ts`)
- Orchestrates workflow generation
- Calls template functions with context
- Handles file writing and permissions

#### Init Generator (`init.tpl.ts`)
- Creates initial `.pipecraftrc.json` configuration
- Prompts user for project settings interactively
- Validates and writes configuration

#### Pipeline Template (`src/templates/workflows/pipeline-path-based.yml.tpl.ts`)
- **Core template**: Generates main pipeline workflow YAML
- Implements domain-based change detection
- Creates jobs for each domain (test, deploy)
- Handles promotion jobs (develop → staging → main)
- Preserves user comments and modifications
- Uses YAML AST manipulation for intelligent merging

#### Action Templates (`src/templates/actions/`)
- `detect-changes.yml.tpl.ts`: Path-based change detection
- `calculate-version.yml.tpl.ts`: Semantic version calculation
- `create-tag.yml.tpl.ts`: Git tag creation
- `create-pr.yml.tpl.ts`: PR creation for promotions
- `manage-branch.yml.tpl.ts`: Branch management operations
- `promote-branch.yml.tpl.ts`: Branch-to-branch promotions

### 5. YAML AST Operations (`src/utils/ast-path-operations.ts`)

**Purpose**: Intelligently manipulate YAML while preserving structure and comments

**Key Capabilities**:
- Parse YAML to Abstract Syntax Tree (AST)
- Preserve user comments when regenerating
- Preserve quote styles (single, double, unquoted)
- Apply path-based operations (add, update, delete nodes)
- Rebuild YAML with formatting intact

**Why**: Allows regenerating workflows without losing user customizations. Users can add comments or modify specific parts, and PipeCraft will preserve them while updating managed sections.

### 6. Idempotency Manager (`src/utils/idempotency.ts`)

**Purpose**: Skip regeneration when nothing has changed

**How It Works**:
1. Hash configuration file (`.pipecraftrc.json`)
2. Hash template source files (`src/templates/`)
3. Hash generator code (`src/generators/`)
4. Store hashes in `.pipecraft-cache.json`
5. On next run, compare hashes
6. Only regenerate if hashes differ

**Benefits**:
- Faster iterative development
- Avoids unnecessary git diffs
- Clear indication when regeneration is needed

### 7. Version Manager (`src/utils/versioning.ts`)

**Purpose**: Automated semantic versioning based on conventional commits

**Capabilities**:
- Generate `release-it` configuration
- Generate `commitlint` configuration
- Setup Husky git hooks for commit validation
- Calculate next version from commit history
- Create git tags automatically

**Integration**: Works with GitHub Actions to automatically bump versions when code is promoted to staging/main.

### 8. GitHub Setup (`src/utils/github-setup.ts`)

**Purpose**: Configure GitHub repository for PipeCraft workflows

**Responsibilities**:
- Extract repository info from git remote
- Create GitHub API client
- Setup branch protection rules
- Configure auto-merge settings
- Set required status checks
- Validate GitHub token permissions

**Why**: Many PipeCraft features require specific GitHub settings (e.g., auto-merge, branch protection). This utility automates the setup.

### 9. Logger (`src/utils/logger.ts`)

**Purpose**: Configurable console output

**Log Levels**:
- `silent`: No output (for programmatic use)
- `normal`: Standard messages (default)
- `verbose`: Detailed operational info (`--verbose` flag)
- `debug`: Maximum detail for troubleshooting (`--debug` flag)

**Usage**: Singleton instance imported throughout the application, controlled by CLI flags.

## Data Flow

### Workflow Generation Flow

```
1. User runs: pipecraft generate

2. CLI parses arguments
   ├─ Set log level (--verbose, --debug)
   └─ Determine command (generate)

3. Load & Validate Configuration
   ├─ Search for config file (cosmiconfig)
   ├─ Parse JSON/YAML
   ├─ Validate required fields
   └─ Apply defaults

4. Pre-Flight Checks
   ├─ Check Node version
   ├─ Verify git repository
   ├─ Check git remote
   ├─ Verify write permissions
   └─ Validate branch structure

5. Idempotency Check
   ├─ Load cache (.pipecraft-cache.json)
   ├─ Hash current config
   ├─ Hash template files
   ├─ Compare hashes
   └─ Skip if unchanged (unless --force)

6. Generate Workflows
   ├─ Create PipecraftContext from config
   ├─ Generate pipeline.yml (path-based template)
   │   ├─ Load existing pipeline (if present)
   │   ├─ Parse to YAML AST
   │   ├─ Preserve user comments
   │   ├─ Update managed sections
   │   ├─ Generate domain jobs
   │   ├─ Generate promotion jobs
   │   └─ Write YAML with preserved formatting
   ├─ Generate action files
   │   ├─ detect-changes
   │   ├─ calculate-version
   │   ├─ create-tag
   │   ├─ create-pr
   │   └─ promote-branch
   └─ Generate composite actions

7. Update Cache
   ├─ Calculate new hashes
   ├─ Store in cache file
   └─ Record generation timestamp

8. Success Message
   └─ Display generated file paths
```

### Configuration to Workflow Mapping

```
.pipecraftrc.json
│
├─ ciProvider → workflow: platform selection
├─ branchFlow → jobs: on.push.branches
├─ initialBranch → jobs: trigger on this branch
├─ finalBranch → jobs: final deployment target
├─ mergeStrategy → promote-branch: merge method
├─ domains → jobs: test-{domain}, deploy-{domain}
│   ├─ paths → detect-changes: path patterns
│   ├─ testable → generate test jobs
│   └─ deployable → generate deploy jobs
├─ semver.bumpRules → calculate-version: bump logic
├─ actions.onDevelopMerge → jobs: on develop merge
├─ actions.onStagingMerge → jobs: on staging merge
├─ autoMerge → create-pr: auto-merge setting
├─ mergeMethod → create-pr: merge method
├─ rebuild → idempotency: caching behavior
└─ versioning → version-manager: setup
```

## File Structure

```
pipecraft/
├── src/
│   ├── cli/
│   │   └── index.ts                    # CLI entry point
│   ├── generators/
│   │   ├── init.tpl.ts                 # Init command generator
│   │   └── workflows.tpl.ts            # Workflow generation orchestrator
│   ├── templates/
│   │   ├── workflows/
│   │   │   └── pipeline-path-based.yml.tpl.ts  # Main pipeline template
│   │   └── actions/
│   │       ├── detect-changes.yml.tpl.ts
│   │       ├── calculate-version.yml.tpl.ts
│   │       ├── create-tag.yml.tpl.ts
│   │       ├── create-pr.yml.tpl.ts
│   │       ├── manage-branch.yml.tpl.ts
│   │       └── promote-branch.yml.tpl.ts
│   ├── types/
│   │   └── index.ts                    # TypeScript interfaces
│   └── utils/
│       ├── config.ts                   # Configuration loading
│       ├── preflight.ts                # Pre-flight checks
│       ├── idempotency.ts              # Caching for idempotency
│       ├── versioning.ts               # Semantic versioning
│       ├── github-setup.ts             # GitHub API integration
│       ├── logger.ts                   # Logging utility
│       └── ast-path-operations.ts      # YAML AST manipulation
├── tests/
│   ├── unit/                           # Unit tests
│   ├── integration/                    # Integration tests
│   └── e2e/                            # End-to-end tests
└── docs/
    ├── architecture.md                 # This file
    ├── trunk-flow.md                   # Current implementation
    └── error-handling.md               # Error handling guide
```

## Design Decisions

### Why YAML AST Manipulation?

**Problem**: When regenerating workflows, we need to update PipeCraft-managed sections while preserving user customizations.

**Solution**: Parse YAML to Abstract Syntax Tree, identify managed vs. user sections by comments, update only managed sections, rebuild YAML with preserved comments and formatting.

**Trade-off**: More complex than simple template generation, but enables true idempotency with user customization support.

### Why Idempotency Caching?

**Problem**: Regenerating workflows on every run is slow and creates unnecessary git diffs.

**Solution**: Hash configuration and template files, cache hashes, skip regeneration if unchanged.

**Trade-off**: Slightly more complex implementation, but dramatically improves developer experience.

### Why Path-Based Change Detection?

**Problem**: In monorepos, not all domains change with every commit. Running all tests/deploys wastes CI time.

**Solution**: Use `git diff` to detect changed files, match against domain path patterns, only run jobs for affected domains.

**Benefits**:
- Faster CI runs (only test what changed)
- Lower costs (less compute time)
- Faster feedback (relevant tests run first)

### Why Trunk-Based Flow?

**Problem**: Long-lived feature branches lead to merge conflicts and integration issues.

**Solution**: All work happens on trunk (develop), code promotes through stages (develop → staging → main) automatically.

**Benefits**:
- Continuous integration (code integrates immediately)
- Linear history (no complex merge graphs)
- Automatic promotion (less manual work)
- Clear rollback points (each promotion is a milestone)

## Extension Points

### Adding New CI Provider

1. Update `PipecraftConfig.ciProvider` type in `src/types/index.ts`
2. Create new template in `src/templates/workflows/`
3. Add provider-specific logic in `src/generators/workflows.tpl.ts`
4. Update validation in `src/utils/config.ts`

### Adding New Actions

1. Create template in `src/templates/actions/`
2. Export from `src/generators/workflows.tpl.ts`
3. Reference in pipeline template
4. Add tests in `tests/integration/`

### Adding New Branch Flow Patterns

1. Update configuration schema in `src/types/index.ts`
2. Create new template or extend existing
3. Add validation in `src/utils/config.ts`
4. Update pre-flight checks in `src/utils/preflight.ts`

## Performance Considerations

### Idempotency

- **Cache hit**: ~50ms (just hash comparison)
- **Cache miss**: ~2-5s (full generation)
- **Benefit**: 40-100x faster for unchanged configs

### YAML Parsing

- **AST parsing**: ~10-50ms depending on file size
- **Comment preservation**: Minimal overhead (less than 5ms)
- **Trade-off**: Worth it for user customization support

### GitHub API

- **Rate limits**: 5000 requests/hour (authenticated)
- **Caching**: Not currently implemented (future enhancement)
- **Batch operations**: Not currently used (future enhancement)

## Security Considerations

### GitHub Token

- Never logged or stored in cache
- Required permissions: `repo`, `workflow`
- Used only for API calls, never committed
- Should use environment variable (`GITHUB_TOKEN`)

### Git Hooks

- Husky hooks run locally, not in CI
- Can be bypassed with `--no-verify` (document this)
- Commitlint prevents malformed commits
- Does not block emergency fixes

### File Permissions

- Workflow files: 644 (readable by all, writable by owner)
- Action files: 644
- Husky hooks: 755 (executable)
- Cache file: 644 (not sensitive)

## Testing Strategy

### Unit Tests

- Test individual functions in isolation
- Mock external dependencies (fs, git, GitHub API)
- Fast execution (less than 100ms per test)
- High coverage target (greater than 80%)

### Integration Tests

- Test component interactions
- Use real filesystem (isolated directories)
- Mock only external services
- Medium execution time (~1s per test)

### E2E Tests

- Test complete workflows
- Minimal mocking
- Real git operations (isolated repos)
- Slow execution (~5-10s per test)
- Test actual user journeys

## Troubleshooting

### Common Issues

**Workflow not triggering**:
- Check branch names match configuration
- Verify workflow file is in `.github/workflows/`
- Check GitHub Actions are enabled
- Verify branch protection isn't blocking

**Idempotency not working**:
- Delete `.pipecraft-cache.json`
- Use `--force` flag to force regeneration
- Check file permissions on cache file

**Comments being lost**:
- Ensure comments are outside PipeCraft-managed blocks
- User comments should not be within `# PIPECRAFT` markers
- Report as bug if comments are in valid location

**Version calculation wrong**:
- Check conventional commit format
- Verify git tags exist
- Check `release-it` configuration
- Validate bump rules in config

## Future Enhancements

### Planned Features

1. **GitLab CI Support**: Full parity with GitHub Actions
2. **Multiple Flow Patterns**: Support other trunk-based variations
3. **GitHub App**: Replace PAT with app-based authentication
4. **Workflow Visualization**: Generate diagrams from config
5. **Configuration Migration**: Auto-migrate old configs
6. **Plugin System**: Allow custom actions and templates

### Under Consideration

- **Matrix Builds**: Test across multiple environments
- **Parallel Domain Testing**: Run domain tests in parallel
- **Slack/Discord Notifications**: Integration with communication tools
- **Deployment Status Dashboard**: Web UI for deployment tracking
- **Rollback Automation**: Automatic rollback on failure detection

## Contributing

When contributing to PipeCraft:

1. **Understand the Architecture**: Read this document first
2. **Follow TypeScript Best Practices**: Strict typing, no `any`
3. **Add JSDoc Comments**: Document all public APIs
4. **Write Tests**: Unit + integration + e2e
5. **Update Documentation**: Keep docs in sync with code
6. **Test Idempotency**: Ensure regeneration doesn't break
7. **Preserve User Comments**: Don't overwrite user customizations

## Related Documentation

- [Current Trunk Flow](./trunk-flow) - Current implementation details
- [Error Handling](./error-handling) - Error types and recovery
- [Testing Guide](./testing-guide) - Testing guidelines and best practices
- [Getting Started](./intro) - User-facing documentation

