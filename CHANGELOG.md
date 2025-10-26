# Changelog

All notable changes to PipeCraft will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Preparing for 1.0.0 Release

#### Added
- Multi-line formatting for GitHub Actions `if:` conditions for improved readability
- Comprehensive YAML formatting utilities for workflow generation
- Open-source release preparation documentation

#### Changed
- Improved template organization with shared operations architecture
- Enhanced Nx integration with sequential pipeline strategy
- Standardized template naming conventions

#### Fixed
- YAML formatting now respects multi-line `if:` conditions for better DX
- Resolved hyphenated function names in Nx demo libraries

## [0.28.2] - 2024-10-XX (Pre-Release Versions)

### Summary of Pre-1.0 Development

PipeCraft has been in active internal development through versions 0.0.1 to 0.28.2. Key features developed:

#### Core Features
- **Trunk-Based Development Flow**: Automated CI/CD pipeline generation for develop → staging → main workflows
- **Domain-Based Change Detection**: Intelligent path-based and Nx-based change detection to run only affected jobs
- **Semantic Versioning**: Automated version calculation using conventional commits
- **Branch Flow Management**: Configurable multi-stage promotion with version gating
- **GitHub Actions Integration**: Complete workflow and composite action generation

#### Advanced Capabilities
- **Nx Monorepo Support**: Full integration with Nx workspaces including:
  - Automatic Nx detection and configuration
  - Project-to-domain mapping
  - Dependency graph-aware change detection
  - Sequential task execution with Nx caching
- **AST-Based Workflow Merging**: Preserves user customizations during workflow regeneration
- **Custom Job Preservation**: User-defined jobs survive regeneration
- **Idempotent Generation**: Safe to regenerate workflows without losing manual changes

#### CLI Commands
- `pipecraft init` - Interactive project initialization
- `pipecraft generate` - Workflow generation with smart merging
- `pipecraft verify` - Configuration validation
- `pipecraft validate` - Workflow syntax validation
- `pipecraft setup-github` - GitHub permissions configuration

#### Composite Actions
- `detect-changes` - Path-based change detection
- `detect-changes-nx` - Nx-aware change detection
- `calculate-version` - Semantic version calculation
- `create-tag` - Git tag creation
- `create-release` - GitHub release creation
- `promote-branch` - Branch promotion automation
- `create-pr` - Pull request creation
- `manage-branch` - Branch management operations

#### Testing & Validation
- Comprehensive test suite (347+ tests)
- Unit, integration, and E2E test coverage
- Test coverage reporting and thresholds
- Workflow validation utilities
- Example repositories for testing patterns

#### Documentation
- Complete Docusaurus documentation site at pipecraft.thecraftlab.dev
- Getting started guides
- Configuration reference
- Architecture documentation
- API documentation (auto-generated from TypeScript)
- Multiple example configurations
- Troubleshooting guides

#### Developer Experience
- Pre-flight checks with actionable suggestions
- Verbose logging modes for debugging
- Error handling with recovery instructions
- Persona-aware help messaging
- Interactive initialization workflow

### Version History Highlights

**v0.28.x Series** (Latest Pre-Release)
- Enhanced Nx integration
- Improved test coverage (>85% for core modules)
- Refined template architecture
- Better error messaging

**v0.20.x - v0.27.x Series**
- Nx monorepo support implementation
- AST-based workflow merging
- Custom job preservation
- Enhanced change detection

**v0.10.x - v0.19.x Series**
- Core workflow generation refinement
- Composite actions development
- Version management improvements
- Branch flow automation

**v0.0.1 - v0.9.x Series**
- Initial project architecture
- Basic workflow generation
- Domain-based testing concept
- GitHub Actions integration

---

## [1.0.0] - TBD

### Breaking Changes
- None (initial stable release)

### Added
- **First Stable Release**: Production-ready workflow generation for trunk-based development
- **Full Feature Set**: Complete implementation of all core capabilities
- **Open Source**: Public release under MIT license
- **Documentation**: Comprehensive guides and examples
- **Testing**: High coverage with robust test suite
- **Community**: Contributing guidelines and code of conduct

### Fixed
- All known critical issues addressed
- Test suite fully passing
- Type safety improvements

---

## Notes

### Commit Message Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `test:` - Test additions or modifications
- `refactor:` - Code refactoring without feature changes
- `chore:` - Maintenance tasks
- `perf:` - Performance improvements
- `ci:` - CI/CD changes
- `build:` - Build system changes
- `revert:` - Revert previous commits

### Version Numbering

- **Major (1.x.x)**: Breaking changes
- **Minor (x.1.x)**: New features (backward compatible)
- **Patch (x.x.1)**: Bug fixes and minor improvements

### Links

- [Documentation](https://pipecraft.thecraftlab.dev)
- [GitHub Repository](https://github.com/jamesvillarrubia/pipecraft)
- [npm Package](https://www.npmjs.com/package/pipecraft)
- [Issue Tracker](https://github.com/jamesvillarrubia/pipecraft/issues)
